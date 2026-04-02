import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRoleRestGuard } from '../auth/guards/admin-role-rest.guard';
import { PrismaService } from '../prisma/prisma.service';

function levelLabel(points: number): string {
  if (points >= 500) return 'Expert';
  if (points >= 200) return 'Advanced';
  if (points >= 50) return 'Regular';
  return 'Starter';
}

@Controller('api/leaderboard')
@UseGuards(AdminRoleRestGuard)
export class AdminLeaderboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats() {
    const agg = await this.prisma.users.aggregate({
      _sum: { points: true },
      _avg: { points: true },
      _count: true,
    });
    return {
      totalPoints: agg._sum.points ?? 0,
      averagePoints: Math.round(agg._avg.points ?? 0),
      totalUsers: agg._count,
    };
  }

  @Get('user/:userId')
  async userRank(@Param('userId') userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: { _count: { select: { user_badges: true } } },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const higher = await this.prisma.users.count({
      where: { points: { gt: user.points }, is_suspended: false },
    });
    const rank = higher + 1;
    return {
      rank,
      userName: user.display_name || user.email,
      points: user.points,
      badges: user._count.user_badges,
      level: levelLabel(user.points),
    };
  }

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const lim = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10) || 50));
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize ?? '10', 10) || 10));

    if (page || pageSize) {
      const skip = (p - 1) * ps;
      const [total, users] = await Promise.all([
        this.prisma.users.count({ where: { is_suspended: false } }),
        this.prisma.users.findMany({
          where: { is_suspended: false },
          orderBy: { points: 'desc' },
          skip,
          take: ps,
          include: { _count: { select: { user_badges: true } } },
        }),
      ]);
      const data = users.map((u, i) => ({
        rank: skip + i + 1,
        userName: u.display_name || u.email,
        points: u.points,
        badges: u._count.user_badges,
        level: levelLabel(u.points),
      }));
      return { data, total };
    }

    const users = await this.prisma.users.findMany({
      where: { is_suspended: false },
      orderBy: { points: 'desc' },
      take: lim,
      include: { _count: { select: { user_badges: true } } },
    });
    return users.map((u, i) => ({
      rank: i + 1,
      userName: u.display_name || u.email,
      points: u.points,
      badges: u._count.user_badges,
      level: levelLabel(u.points),
    }));
  }
}
