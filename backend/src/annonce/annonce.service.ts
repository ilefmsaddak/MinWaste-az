import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { item_status } from '@prisma/client';
import { AzureStorageService } from '../storage/azure-storage.service';

/** Même règle que `ItemService` : UUID PostgreSQL ou `firebase_uid`. */
const PG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ITEM_OWNER_INCLUDE = {
  select: {
    id: true,
    display_name: true,
    email: true,
    points: true,
    trust_score: true,
    user_badges: {
      include: { badges: { select: { name: true } } },
    },
  },
} as const;

@Injectable()
export class AnnonceService {
  constructor(
    private prisma: PrismaService,
    private readonly azure: AzureStorageService,
  ) {}

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
        'User not found: ownerId must be PostgreSQL user id or Firebase UID.',
      );
    }
    return user.id;
  }

  private photoUrls(item_photos: { url: string; position: number }[]) {
    return (item_photos || [])
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((p) => {
        const u = p.url;
        if (u && !u.startsWith('http')) {
          return this.azure.getPhotoUrl(u);
        }
        return u;
      });
  }

  private mapRow(item: any) {
    if (!item) return null;
    const owner = item.users;
    const badgeNames: string[] =
      owner?.user_badges
        ?.map((ub: { badges?: { name?: string } }) => ub.badges?.name)
        .filter((n: string | undefined): n is string => !!n) ?? [];
    const photos = this.photoUrls(item.item_photos || []);
    return {
      id: item.id,
      title: item.title,
      description: item.description ?? undefined,
      category: item.category ?? undefined,
      photos,
      location: {
        lat: Number(item.lat),
        lng: Number(item.lng),
        addr: item.address ?? '',
      },
      status: item.status as item_status,
      suggestedCategory: (() => {
        const sc = item.suggested_category;
        if (sc == null) return undefined;
        if (Array.isArray(sc)) return sc.map(String);
        if (typeof sc === 'object')
          return Object.values(sc as object).map(String);
        return undefined;
      })(),
      fraudScore: item.fraud_score != null ? Number(item.fraud_score) : undefined,
      createdAt: item.created_at,
      expiresAt: item.expires_at ?? undefined,
      quantity: item.quantity_available ?? item.quantity_total,
      priceType: item.price_type,
      priceValue: item.price_amount != null ? Number(item.price_amount) : undefined,
      owner: owner
        ? {
            id: owner.id,
            displayName: owner.display_name,
            email: owner.email,
            points: owner.points,
            trustScore:
              owner.trust_score != null && owner.trust_score !== undefined
                ? Number(owner.trust_score)
                : 50,
            badges: badgeNames.length ? badgeNames : undefined,
          }
        : undefined,
    };
  }

  async findAll() {
    const items = await this.prisma.items.findMany({
      include: {
        users: ITEM_OWNER_INCLUDE,
        item_photos: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return items.map((i) => this.mapRow(i));
  }

  async findOne(id: string) {
    const item = await this.prisma.items.findUnique({
      where: { id },
      include: {
        users: ITEM_OWNER_INCLUDE,
        item_photos: true,
      },
    });
    return this.mapRow(item);
  }

  async findByCategory(category: string) {
    const items = await this.prisma.items.findMany({
      where: { category },
      include: {
        users: ITEM_OWNER_INCLUDE,
        item_photos: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return items.map((i) => this.mapRow(i));
  }

  async findByStatus(status: item_status) {
    const items = await this.prisma.items.findMany({
      where: { status },
      include: {
        users: ITEM_OWNER_INCLUDE,
        item_photos: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return items.map((i) => this.mapRow(i));
  }

  async findByOwnerId(ownerId: string) {
    const ownerDbId = await this.resolveOwnerDbId(ownerId);
    const items = await this.prisma.items.findMany({
      where: { owner_id: ownerDbId },
      include: {
        users: ITEM_OWNER_INCLUDE,
        item_photos: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return items.map((i) => this.mapRow(i));
  }
}
