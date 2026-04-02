import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRoleRestGuard } from '../auth/guards/admin-role-rest.guard';
import { PrismaService } from '../prisma/prisma.service';

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  joinDate: string;
  status: 'active' | 'suspended';
  role: 'user' | 'admin';
  announcements: number;
  points: number;
  deletedAt: string | null;
};

@Controller('api/users')
@UseGuards(AdminRoleRestGuard)
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('statistics')
  async statistics() {
    const [total, suspended, announcements] = await Promise.all([
      this.prisma.users.count(),
      this.prisma.users.count({ where: { is_suspended: true } }),
      this.prisma.items.count(),
    ]);
    return {
      total,
      active: total - suspended,
      suspended,
      announcements,
    };
  }

  @Get()
  async list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50));
    const skip = (p - 1) * ps;

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where['is_suspended'] = status.toLowerCase() === 'suspended';
    }
    if (role && role !== 'all') {
      where['role'] = role.toUpperCase();
    }
    if (search?.trim()) {
      const q = search.trim();
      where['OR'] = [
        { email: { contains: q, mode: 'insensitive' } },
        { display_name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({
        where,
        skip,
        take: ps,
        orderBy: { created_at: 'desc' },
        include: {
          _count: { select: { items: true } },
        },
      }),
    ]);

    const data: AdminUserRow[] = rows.map((u) => ({
      id: u.id,
      name: u.display_name || u.email,
      email: u.email,
      phone: u.phone,
      joinDate: u.created_at.toISOString(),
      status: u.is_suspended ? 'suspended' : 'active',
      role: u.role === 'ADMIN' ? 'admin' : 'user',
      announcements: u._count.items,
      points: u.points,
      deletedAt: null,
    }));

    return {
      data,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps) || 1,
    };
  }

  @Get(':id/activity')
  async activity(@Param('id') id: string) {
    const u = await this.prisma.users.findUnique({ where: { id } });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return [];
  }

  @Get(':id')
  async one(@Param('id') id: string): Promise<AdminUserRow> {
    const u = await this.prisma.users.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return {
      id: u.id,
      name: u.display_name || u.email,
      email: u.email,
      phone: u.phone,
      joinDate: u.created_at.toISOString(),
      status: u.is_suspended ? 'suspended' : 'active',
      role: u.role === 'ADMIN' ? 'admin' : 'user',
      announcements: u._count.items,
      points: u.points,
      deletedAt: null,
    };
  }

  @Put(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id') id: string): Promise<AdminUserRow> {
    await this.prisma.users.update({
      where: { id },
      data: { is_suspended: true },
    });
    return this.one(id);
  }

  @Put(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  async unsuspend(@Param('id') id: string): Promise<AdminUserRow> {
    await this.prisma.users.update({
      where: { id },
      data: { is_suspended: false },
    });
    return this.one(id);
  }

  /**
   * Tessnime called this "soft delete"; merged schema has no deletedAt — suspend instead.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<AdminUserRow> {
    await this.prisma.users.update({
      where: { id },
      data: { is_suspended: true },
    });
    return this.one(id);
  }
}
