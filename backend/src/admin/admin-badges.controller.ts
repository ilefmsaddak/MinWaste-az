import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminRoleRestGuard } from '../auth/guards/admin-role-rest.guard';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminBadgeDto, UpdateAdminBadgeDto } from './dto/admin-badge.dto';

function criteriaToAdminResponse(criteria: unknown): {
  icon: string;
  pointsRequired: number;
} {
  const c = (criteria && typeof criteria === 'object' ? criteria : {}) as Record<
    string,
    unknown
  >;
  const min =
    typeof c['min'] === 'number'
      ? c['min']
      : typeof c['threshold'] === 'number'
        ? c['threshold']
        : 0;
  const icon = typeof c['icon'] === 'string' ? c['icon'] : '🏆';
  return { icon, pointsRequired: min };
}

@Controller('api/badges')
@UseGuards(AdminRoleRestGuard)
export class AdminBadgesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.badges.findMany({
      orderBy: { created_at: 'asc' },
      include: {
        _count: { select: { user_badges: true } },
      },
    });
    return rows.map((b) => {
      const { icon, pointsRequired } = criteriaToAdminResponse(b.criteria);
      return {
        id: b.id,
        name: b.name,
        description: b.description ?? '',
        icon,
        pointsRequired,
        usersEarned: b._count.user_badges,
        createdAt: b.created_at,
      };
    });
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const b = await this.prisma.badges.findUnique({
      where: { id },
      include: { _count: { select: { user_badges: true } } },
    });
    if (!b) throw new NotFoundException(`Badge ${id} not found`);
    const { icon, pointsRequired } = criteriaToAdminResponse(b.criteria);
    return {
      id: b.id,
      name: b.name,
      description: b.description ?? '',
      icon,
      pointsRequired,
      usersEarned: b._count.user_badges,
      createdAt: b.created_at,
    };
  }

  @Post()
  async create(@Body() body: CreateAdminBadgeDto) {
    const base = body.name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 36);
    const code = `${base || 'BADGE'}_${Date.now().toString(36).toUpperCase()}`;
    const criteria = {
      type: 'POINTS_TOTAL',
      min: body.pointsRequired,
      icon: body.icon,
    } as Prisma.InputJsonValue;

    const b = await this.prisma.badges.create({
      data: {
        code,
        name: body.name.trim(),
        description: body.description.trim(),
        criteria,
      },
      include: { _count: { select: { user_badges: true } } },
    });
    const { icon, pointsRequired } = criteriaToAdminResponse(b.criteria);
    return {
      id: b.id,
      name: b.name,
      description: b.description ?? '',
      icon,
      pointsRequired,
      usersEarned: 0,
      createdAt: b.created_at,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateAdminBadgeDto) {
    const existing = await this.prisma.badges.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Badge ${id} not found`);

    const prev = (existing.criteria && typeof existing.criteria === 'object'
      ? existing.criteria
      : {}) as Record<string, unknown>;
    const nextCriteria: Record<string, unknown> = { ...prev };
    if (body.pointsRequired != null) {
      nextCriteria['min'] = body.pointsRequired;
      nextCriteria['type'] = nextCriteria['type'] ?? 'POINTS_TOTAL';
    }
    if (body.icon != null) nextCriteria['icon'] = body.icon;

    const b = await this.prisma.badges.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: body.name.trim() } : {}),
        ...(body.description != null ? { description: body.description.trim() } : {}),
        criteria: nextCriteria as Prisma.InputJsonValue,
      },
      include: { _count: { select: { user_badges: true } } },
    });
    const { icon, pointsRequired } = criteriaToAdminResponse(b.criteria);
    return {
      id: b.id,
      name: b.name,
      description: b.description ?? '',
      icon,
      pointsRequired,
      usersEarned: b._count.user_badges,
      createdAt: b.created_at,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.badges.delete({ where: { id } });
  }
}
