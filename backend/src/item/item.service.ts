import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AzureStorageService } from '../storage/azure-storage.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import {
  item_status,
  price_type,
  item_type,
  Prisma,
} from '@prisma/client';
import { GamificationService } from '../gamification/gamification.service';
import { FraudDetectionService } from './fraud-detection.service';

/** Accepte `users.id` (UUID) ou `users.firebase_uid` (ex. token Firebase). */
const PG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Map legacy / DTO status to Prisma item_status */
function toItemStatus(
  s: string | undefined,
): item_status {
  if (!s) return 'PUBLISHED';
  const u = String(s).toUpperCase();
  if (u === 'ACTIVE') return 'PUBLISHED';
  if (u === 'DRAFT') return 'DRAFT';
  if (u === 'RESERVED') return 'RESERVED';
  if (u === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (u === 'EXPIRED') return 'EXPIRED';
  if (u === 'BLOCKED') return 'BLOCKED';
  if (u === 'PUBLISHED') return 'PUBLISHED';
  return 'PUBLISHED';
}

@Injectable()
export class ItemService {
  constructor(
    private prisma: PrismaService,
    private azureStorageService: AzureStorageService,
    private readonly gamification: GamificationService,
  ) {}

  /**
   * ✅ FONCTION CENTRALISÉE DE CALCUL DU STATUS RÉEL
   * Source de vérité unique pour déterminer le statut d'un item
   * 
   * Règle de priorité :
   * 1. Si item en brouillon => DRAFT
   * 2. Si date expiration dépassée => EXPIRED
   * 3. Si quantityAvailable <= 0 :
   *    - Toutes transactions COMPLETED => RESERVED
   *    - Sinon (encore des PENDING/CONFIRMED) => UNAVAILABLE
   * 4. Si quantityAvailable >= 1 et item publié => PUBLISHED
   * 5. Sinon => utiliser le status stocké
   */
  async computeRealItemStatus(
    itemId: string,
    storedItem?: {
      status: item_status;
      quantity_available: number;
      quantity_total: number;
      expires_at: Date | null;
    },
  ): Promise<item_status> {
    // Fetch item if not provided
    const item = storedItem || (await this.prisma.items.findUnique({
      where: { id: itemId },
      select: {
        status: true,
        quantity_available: true,
        quantity_total: true,
        expires_at: true,
      },
    }));

    if (!item) return 'PUBLISHED';

    // Rule 1: If draft => DRAFT
    if (item.status === 'DRAFT') return 'DRAFT';

    // Rule 2: If expired => EXPIRED
    if (item.expires_at && new Date(item.expires_at) < new Date()) {
      return 'EXPIRED';
    }

    // Rule 3 & 4: Check quantity
    if (item.quantity_available <= 0) {
      // Fetch related transactions only for detailed check
      const relatedTransactions = await this.prisma.transactions.findMany({
        where: { item_id: itemId },
        select: { status: true },
      });

      const allCompleted = relatedTransactions.every(
        (tx) => tx.status === 'COMPLETED' || tx.status === 'CANCELED',
      );

      return allCompleted ? 'RESERVED' : 'UNAVAILABLE';
    }

    // Rule 4: If available => PUBLISHED
    if (item.quantity_available >= 1) {
      return 'PUBLISHED';
    }

    // Fallback to stored status
    return item.status;
  }

  /**
   * Update item status after any state change
   * Called after: reservation, cancellation, completion, expiration
   */
  async recalculateAndUpdateItemStatus(
    itemId: string,
  ): Promise<item_status> {
    const item = await this.prisma.items.findUnique({
      where: { id: itemId },
      select: {
        status: true,
        quantity_available: true,
        quantity_total: true,
        expires_at: true,
      },
    });

    if (!item) return 'PUBLISHED';

    const newStatus = await this.computeRealItemStatus(itemId, item);

    // Only update if status actually changed
    if (newStatus !== item.status) {
      await this.prisma.items.update({
        where: { id: itemId },
        data: { status: newStatus },
      });
    }

    return newStatus;
  }

  /** +5 pts une fois par annonce de don publiée (idempotent côté ledger). */
  private async maybeAwardGiveListing(
    ownerId: string,
    status: item_status,
    priceType: price_type,
    itemId: string,
  ): Promise<void> {
    if (status === 'PUBLISHED' && priceType === 'FREE') {
      await this.gamification.awardGiveListing(ownerId, itemId);
    }
  }

  /**
   * Résout un identifiant propriétaire vers `users.id` (UUID).
   * Le client peut envoyer soit l’UUID PostgreSQL, soit le `firebase_uid`.
   */
  private async resolveOwnerDbId(raw: string): Promise<string> {
    const id = String(raw ?? '').trim();
    if (!id) {
      throw new BadRequestException('ownerId is required');
    }
    if (PG_UUID_RE.test(id)) {
      const user = await this.prisma.users.findUnique({ where: { id } });
      if (!user) {
        throw new NotFoundException('User not found for this ownerId');
      }
      return id;
    }
    const user = await this.prisma.users.findUnique({
      where: { firebase_uid: id },
    });
    if (!user) {
      throw new NotFoundException(
        'User not found: ownerId must be your PostgreSQL user id or Firebase UID (sign in / load profile once).',
      );
    }
    return user.id;
  }

  private formatDateForPrisma(dateString?: string): Date | null {
    if (!dateString) return null;
    if (dateString.length === 10) {
      return new Date(`${dateString}T00:00:00.000Z`);
    }
    return new Date(dateString);
  }

  /** Shape attendue par le frontend REST (camelCase + owner), JSON-safe */
  private mapItemRest(item: any) {
    if (!item) return item;
    const u = item.users;
    const toIso = (d: unknown) =>
      d instanceof Date ? d.toISOString() : d ?? undefined;

    const badgeNames: string[] =
      u?.user_badges?.map((ub: { badges?: { name?: string } }) => ub.badges?.name).filter(Boolean) ??
      [];

    const ownerReviews =
      u?.reviews_reviews_reviewed_idTousers?.map(
        (r: {
          id: string;
          rating: number;
          comment: string | null;
          created_at: Date;
          users_reviews_reviewer_idTousers?: { display_name: string };
        }) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment ?? undefined,
          createdAt: toIso(r.created_at),
          reviewerName:
            r.users_reviews_reviewer_idTousers?.display_name ?? 'Member',
        }),
      ) ?? [];

    const owner = u
      ? {
          id: u.id,
          displayName: u.display_name,
          email: u.email,
          phone: u.phone,
          trustScore:
            u.trust_score != null && u.trust_score !== undefined
              ? Number(u.trust_score)
              : 50,
          badges: badgeNames.length ? badgeNames : undefined,
        }
      : undefined;

    return {
      id: item.id,
      ownerId: item.owner_id,
      title: item.title,
      description: item.description,
      category: item.category,
      photos: item.photos ?? [],
      locationLat: item.lat != null ? Number(item.lat) : undefined,
      locationLng: item.lng != null ? Number(item.lng) : undefined,
      locationAddr: item.address,
      status: item.status,
      priceType: item.price_type,
      priceValue:
        item.price_amount != null ? Number(item.price_amount) : undefined,
      quantity: item.quantity_total,
      quantityAvailable: item.quantity_available,
      expiresAt: toIso(item.expires_at),
      createdAt: toIso(item.created_at),
      updatedAt: toIso(item.updated_at),
      fraudScore: item.fraud_score,
      owner,
      ownerReviews: ownerReviews.length ? ownerReviews : undefined,
    };
  }

  private enrichItemWithPhotoUrls(item: any) {
    if (!item) return item;
    const photos = (item.item_photos || [])
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
      .map((p: any) => {
        const url = p.url as string;
        if (url && !url.startsWith('http')) {
          return this.azureStorageService.getPhotoUrl(url);
        }
        return url;
      });
    const { item_photos, users, ...rest } = item;
    const merged = { ...rest, users, photos };
    return this.mapItemRest(merged);
  }

  private enrichItemsWithPhotoUrls(items: any[]) {
    return items.map((item) => this.enrichItemWithPhotoUrls(item));
  }

  async create(createItemDto: CreateItemDto, photoBlobName?: string | null) {
    const ownerDbId = await this.resolveOwnerDbId(createItemDto.ownerId);

    const fraudScore = FraudDetectionService.validate(
      createItemDto.title,
      createItemDto.description ?? '',
      ownerDbId,
      this.prisma,
    );
    
    const status = toItemStatus(createItemDto.status as unknown as string);
    const priceType = createItemDto.priceType as price_type;
    const priceAmount =
      priceType === 'FREE'
        ? null
        : createItemDto.priceValue != null
          ? new Prisma.Decimal(createItemDto.priceValue)
          : null;

    const item = await this.prisma.items.create({
      data: {
        owner_id: ownerDbId,
        type: 'FOOD' as item_type,
        title: createItemDto.title,
        description: createItemDto.description ?? '',
        category: createItemDto.category,
        status,
        price_type: priceType,
        price_amount: priceAmount,
        lat: new Prisma.Decimal(createItemDto.locationLat),
        lng: new Prisma.Decimal(createItemDto.locationLng),
        address: createItemDto.locationAddr,
        quantity_total: createItemDto.quantity ?? 1,
        quantity_available: createItemDto.quantity ?? 1,
        expires_at: this.formatDateForPrisma(createItemDto.expiresAt),
      },
      include: {
        users: true,
        item_photos: true,
      },
    });

    if (photoBlobName) {
      await this.prisma.item_photos.create({
        data: {
          item_id: item.id,
          url: photoBlobName,
          position: 0,
        },
      });
    }

    const full = await this.prisma.items.findUnique({
      where: { id: item.id },
      include: {
        users: true,
        item_photos: true,
      },
    });

    await this.maybeAwardGiveListing(
      ownerDbId,
      status,
      priceType,
      item.id,
    );

    return this.enrichItemWithPhotoUrls(full);
  }

  async findAll(filter?: string, userLat?: string, userLng?: string) {
    const lat = userLat ? parseFloat(userLat) : null;
    const lng = userLng ? parseFloat(userLng) : null;

    let items = await this.prisma.items.findMany({
      include: {
        users: {
          select: {
            id: true,
            display_name: true,
            email: true,
            phone: true,
            points: true,
          },
        },
        item_photos: true,
      },
    });

    // Strategy 1: Popular (By Owner Points, unique owner)
    if (filter === 'popular') {
      // 1. Sort all items by owner points descending first
      items.sort((a, b) => (b.users?.points || 0) - (a.users?.points || 0));
      
      const uniqueOwners = new Map();
      items.forEach(item => {
        // Only keep the first (highest points) announce found for this owner
        if (!uniqueOwners.has(item.owner_id)) {
          uniqueOwners.set(item.owner_id, item);
        }
      });
      items = Array.from(uniqueOwners.values());
    }

    // Strategy 2: Just Now (Today's announcements)
    if (filter === 'just-now') {
      const today = new Date();
      // Use 24h window for "Just Now"
      const twentyFourHoursAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      items = items.filter(item => new Date(item.created_at) >= twentyFourHoursAgo);
      // Explicit newest first
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // Strategy 3: Near You (Diameter 50km)
    if (filter === 'near-you' && lat !== null && lng !== null) {
      items = items.filter(item => {
        const itemLat = Number(item.lat);
        const itemLng = Number(item.lng);
        const distance = this.calculateDistance(lat, lng, itemLat, itemLng);
        (item as any).distance = distance;
        return distance <= 50; // 50km
      });
      items.sort((a, b) => (a as any).distance - (b as any).distance);
    }

    return this.enrichItemsWithPhotoUrls(items);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async findOne(id: string) {
    const item = await this.prisma.items.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user_badges: { include: { badges: true } },
            reviews_reviews_reviewed_idTousers: {
              orderBy: { created_at: 'desc' },
              take: 15,
              include: {
                users_reviews_reviewer_idTousers: {
                  select: { display_name: true },
                },
              },
            },
          },
        },
        item_photos: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }

    return this.enrichItemWithPhotoUrls(item);
  }

  async findByOwner(ownerId: string) {
    const ownerDbId = await this.resolveOwnerDbId(ownerId);
    const items = await this.prisma.items.findMany({
      where: { owner_id: ownerDbId },
      include: {
        transactions: true,
        item_photos: true,
        users: true,
      },
    });
    return this.enrichItemsWithPhotoUrls(items);
  }

  async update(id: string, updateItemDto: UpdateItemDto) {
    await this.findOne(id);
    const existing = await this.prisma.items.findUniqueOrThrow({
      where: { id },
    });

    const nextPriceType =
      updateItemDto.priceType ?? existing.price_type;
    const nextPriceValue =
      updateItemDto.priceValue !== undefined
        ? updateItemDto.priceValue
        : existing.price_amount != null
          ? Number(existing.price_amount)
          : null;

    const data: Prisma.itemsUpdateInput = {};
    if (updateItemDto.title !== undefined) data.title = updateItemDto.title;
    if (updateItemDto.description !== undefined)
      data.description = updateItemDto.description;
    if (updateItemDto.category !== undefined)
      data.category = updateItemDto.category;
    if (updateItemDto.locationLat !== undefined)
      data.lat = new Prisma.Decimal(updateItemDto.locationLat);
    if (updateItemDto.locationLng !== undefined)
      data.lng = new Prisma.Decimal(updateItemDto.locationLng);
    if (updateItemDto.locationAddr !== undefined)
      data.address = updateItemDto.locationAddr;
    if (updateItemDto.status !== undefined)
      data.status = toItemStatus(updateItemDto.status as unknown as string);
    if (updateItemDto.quantity !== undefined) {
      data.quantity_total = updateItemDto.quantity;
      data.quantity_available = updateItemDto.quantity;
    }
    if (updateItemDto.priceType !== undefined)
      data.price_type = updateItemDto.priceType as price_type;
    if (
      updateItemDto.priceType !== undefined ||
      updateItemDto.priceValue !== undefined
    ) {
      data.price_amount =
        nextPriceType === 'FREE' || nextPriceValue == null
          ? null
          : new Prisma.Decimal(nextPriceValue);
    }
    if (updateItemDto.expiresAt !== undefined) {
      data.expires_at = this.formatDateForPrisma(updateItemDto.expiresAt);
    }

    const updatedItem = await this.prisma.items.update({
      where: { id },
      data,
      include: {
        users: true,
        item_photos: true,
      },
    });

    await this.maybeAwardGiveListing(
      updatedItem.owner_id,
      updatedItem.status,
      updatedItem.price_type,
      updatedItem.id,
    );

    return this.enrichItemWithPhotoUrls(updatedItem);
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.transactions.deleteMany({
      where: { item_id: id },
    });

    await this.prisma.item_photos.deleteMany({
      where: { item_id: id },
    });

    return this.prisma.items.delete({
      where: { id },
    });
  }

  async getItemStats() {
    const total = await this.prisma.items.count();
    const byStatus = await this.prisma.items.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      total,
      byStatus,
    };
  }

  async addPhoto(itemId: string, photoBlobName: string) {
    await this.findOne(itemId);
    const count = await this.prisma.item_photos.count({
      where: { item_id: itemId },
    });

    await this.prisma.item_photos.create({
      data: {
        item_id: itemId,
        url: photoBlobName,
        position: count,
      },
    });

    const updated = await this.prisma.items.findUnique({
      where: { id: itemId },
      include: { item_photos: true, users: true },
    });

    return this.enrichItemWithPhotoUrls(updated);
  }
}
