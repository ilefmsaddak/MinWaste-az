import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { FirebaseAuthRestGuard } from '../auth/guards/firebase-auth-rest.guard';
import { UsersService } from '../users/users.service';
import { DashboardService } from './dashboard.service';
import { DashboardPeriodMode } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private readonly users: UsersService,
    private readonly dashboard: DashboardService,
  ) {}

  /** Export CSV — Authorization: Bearer &lt;Firebase id token&gt; */
  @Get('export.csv')
  @UseGuards(FirebaseAuthRestGuard)
  async exportCsv(@Req() req: any, @Res() res: Response): Promise<void> {
    const decoded = req.user as { uid: string; email?: string; name?: string };
    const user = await this.users.upsertFromFirebase({
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    });
    const queryPeriod = String(req.query?.period ?? 'MONTH').toUpperCase();
    const mode: DashboardPeriodMode =
      queryPeriod === 'WEEK'
        ? 'week'
        : queryPeriod === 'YEAR'
          ? 'year'
          : queryPeriod === 'ALL'
            ? 'all'
            : 'month';

    const dashboardData = await this.dashboard.getDashboardData(user.id, mode);
    const csv = this.dashboard.buildCsvExport(user.id, dashboardData);
    const filename = `minwaste-dashboard-${user.id.slice(0, 8)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  }
}
