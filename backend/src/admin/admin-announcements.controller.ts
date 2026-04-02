import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRoleRestGuard } from '../auth/guards/admin-role-rest.guard';
import { ItemService } from '../item/item.service';
import { UpdateItemDto } from '../item/dto/update-item.dto';
import { UpdateAdminAnnouncementStatusDto } from './dto/update-admin-announcement-status.dto';

function toAdminStatus(
  s: string,
): 'ACTIVE' | 'HIDDEN' | 'UNAVAILABLE' | 'EXPIRED' {
  const u = String(s).toUpperCase();
  if (u === 'PUBLISHED' || u === 'DRAFT' || u === 'RESERVED') return 'ACTIVE';
  if (u === 'BLOCKED') return 'HIDDEN';
  if (u === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (u === 'EXPIRED') return 'EXPIRED';
  return 'ACTIVE';
}

function toItemStatusForUpdate(
  s: 'ACTIVE' | 'HIDDEN' | 'UNAVAILABLE' | 'EXPIRED',
): string {
  if (s === 'ACTIVE') return 'PUBLISHED';
  if (s === 'HIDDEN') return 'BLOCKED';
  if (s === 'UNAVAILABLE') return 'UNAVAILABLE';
  return 'EXPIRED';
}

@Controller('api/announcements')
@UseGuards(AdminRoleRestGuard)
export class AdminAnnouncementsController {
  constructor(private readonly items: ItemService) {}

  @Get('statistics')
  async statistics() {
    return this.items.getItemStats();
  }

  @Get()
  async list(@Query('includeHidden') includeHidden?: string) {
    const rows = await this.items.findAll();
    const showAll = includeHidden === 'true';
    const mapped = rows.map((row: Record<string, unknown>) =>
      this.mapAnnouncement(row),
    );
    if (showAll) return mapped;
    return mapped.filter((a) => a.status === 'ACTIVE');
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    try {
      const row = await this.items.findOne(id);
      return this.mapAnnouncement(row as unknown as Record<string, unknown>);
    } catch {
      throw new NotFoundException(`Announcement ${id} not found`);
    }
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateAdminAnnouncementStatusDto,
  ) {
    const dto = new UpdateItemDto();
    dto.status = toItemStatusForUpdate(body.status);
    const updated = await this.items.update(id, dto);
    return this.mapAnnouncement(updated as unknown as Record<string, unknown>);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.items.remove(id);
    return { ok: true, id };
  }

  private mapAnnouncement(row: Record<string, unknown>) {
    const owner = row['owner'] as Record<string, unknown> | undefined;
    const ownerName =
      (owner?.['displayName'] as string) ||
      (owner?.['email'] as string) ||
      '';
    return {
      id: row['id'],
      ownerId: row['ownerId'],
      ownerName,
      title: row['title'],
      description: row['description'],
      category: row['category'],
      locationLat: row['locationLat'],
      locationLng: row['locationLng'],
      locationAddr: row['locationAddr'],
      status: toAdminStatus(String(row['status'] ?? '')),
      fraudScore: row['fraudScore'],
      createdAt: row['createdAt'],
      expiresAt: row['expiresAt'],
      quantity: row['quantity'],
      priceType: row['priceType'],
      priceValue: row['priceValue'],
    };
  }
}
