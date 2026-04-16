import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

interface EcologyFactors {
  category: string;
  default_weight_kg: number;
  co2_factor_kg_per_kg: number;
  water_factor_l_per_kg: number;
  energy_factor_kwh_per_kg: number;
}

interface TransactionImpact {
  effective_weight_kg: number;
  food_saved_kg: number;
  co2_saved_kg: number;
  water_saved_liters: number;
  energy_saved_kwh: number;
  landfill_diversion_kg: number;
  tree_equivalent: number;
}

@Injectable()
export class EcologyService {
  private readonly logger = new Logger(EcologyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialize default ecology factors
   */
  async initializeEcologyFactors(): Promise<void> {
    const defaultFactors: EcologyFactors[] = [
      {
        category: 'FOOD',
        default_weight_kg: 1.0,
        co2_factor_kg_per_kg: 2.5,
        water_factor_l_per_kg: 50,
        energy_factor_kwh_per_kg: 0.5,
      },
      {
        category: 'CLOTHES',
        default_weight_kg: 0.6,
        co2_factor_kg_per_kg: 15,
        water_factor_l_per_kg: 8000,
        energy_factor_kwh_per_kg: 12,
      },
      {
        category: 'ELECTRONICS',
        default_weight_kg: 2.0,
        co2_factor_kg_per_kg: 25,
        water_factor_l_per_kg: 200,
        energy_factor_kwh_per_kg: 35,
      },
      {
        category: 'FURNITURE',
        default_weight_kg: 10.0,
        co2_factor_kg_per_kg: 8,
        water_factor_l_per_kg: 120,
        energy_factor_kwh_per_kg: 10,
      },
      {
        category: 'BOOKS',
        default_weight_kg: 0.5,
        co2_factor_kg_per_kg: 3,
        water_factor_l_per_kg: 25,
        energy_factor_kwh_per_kg: 1.5,
      },
      {
        category: 'OTHER',
        default_weight_kg: 1.0,
        co2_factor_kg_per_kg: 5,
        water_factor_l_per_kg: 100,
        energy_factor_kwh_per_kg: 2,
      },
    ];

    for (const factor of defaultFactors) {
      await this.prisma.ecology_factors.upsert({
        where: { category: factor.category },
        update: {},
        create: {
          category: factor.category,
          default_weight_kg: new Decimal(factor.default_weight_kg),
          co2_factor_kg_per_kg: new Decimal(factor.co2_factor_kg_per_kg),
          water_factor_l_per_kg: new Decimal(factor.water_factor_l_per_kg),
          energy_factor_kwh_per_kg: new Decimal(factor.energy_factor_kwh_per_kg),
        },
      });
    }

    this.logger.log('Ecology factors initialized');
  }

  /**
   * Calculate transaction impact when finalized
   */
  async finalizeTransactionImpact(transactionId: string): Promise<void> {
    // Check if already processed
    const existing = await this.prisma.transaction_impacts.findUnique({
      where: { transaction_id: transactionId },
    });

    if (existing) {
      this.logger.warn(`Transaction impact already calculated: ${transactionId}`);
      return;
    }

    // Get transaction details
    const transaction = await this.prisma.transactions.findUnique({
      where: { id: transactionId },
      include: {
        items: {
          select: {
            id: true,
            category: true,
            // Add actual_weight_kg and unit_weight_kg to items model if needed
          },
        },
        users_transactions_receiver_idTousers: {
          select: {
            user_profiles: {
              select: { city: true },
            },
          },
        },
      },
    });

    if (!transaction || !['COMPLETED', 'CONFIRMED_BY_SENDER'].includes(transaction.status)) {
      this.logger.warn(`Transaction not eligible for impact calculation: ${transactionId}`);
      return;
    }

    const impact = await this.computeTransactionImpact(transaction as any);

    // Save impact snapshot
    await this.prisma.transaction_impacts.create({
      data: {
        transaction_id: transactionId,
        item_id: transaction.item_id,
        owner_id: transaction.owner_id,
        receiver_id: transaction.receiver_id,
        category: transaction.items.category || 'OTHER',
        quantity: transaction.quantity,
        effective_weight_kg: new Decimal(impact.effective_weight_kg),
        food_saved_kg: new Decimal(impact.food_saved_kg),
        co2_saved_kg: new Decimal(impact.co2_saved_kg),
        water_saved_liters: new Decimal(impact.water_saved_liters),
        energy_saved_kwh: new Decimal(impact.energy_saved_kwh),
        landfill_diversion_kg: new Decimal(impact.landfill_diversion_kg),
        tree_equivalent: new Decimal(impact.tree_equivalent),
        neighborhood: transaction.users_transactions_receiver_idTousers?.user_profiles?.city,
        completed_at: new Date(),
      },
    });

    this.logger.log(`Transaction impact calculated: ${transactionId}`);
  }

  /**
   * Compute impact for a transaction
   */
  private async computeTransactionImpact(transaction: any): Promise<TransactionImpact> {
    const category = (transaction.items.category || 'OTHER').toUpperCase();
    
    // Get ecology factors
    const factors = await this.prisma.ecology_factors.findUnique({
      where: { category },
    });

    if (!factors) {
      throw new Error(`No ecology factors found for category: ${category}`);
    }

    // Calculate effective weight
    let effective_weight_kg = 0;
    
    // For now, use default weight * quantity
    // TODO: Add actual_weight_kg and unit_weight_kg to items model
    effective_weight_kg = Number(factors.default_weight_kg) * transaction.quantity;

    // Calculate impacts
    const food_saved_kg = category === 'FOOD' ? effective_weight_kg : 0;
    const landfill_diversion_kg = effective_weight_kg; // All items diverted from landfill
    const co2_saved_kg = effective_weight_kg * Number(factors.co2_factor_kg_per_kg);
    const water_saved_liters = effective_weight_kg * Number(factors.water_factor_l_per_kg);
    const energy_saved_kwh = effective_weight_kg * Number(factors.energy_factor_kwh_per_kg);
    const tree_equivalent = Math.round((co2_saved_kg / 21) * 100) / 100; // 21kg CO2 per tree

    return {
      effective_weight_kg,
      food_saved_kg,
      co2_saved_kg,
      water_saved_liters,
      energy_saved_kwh,
      landfill_diversion_kg,
      tree_equivalent,
    };
  }

  /**
   * Get user's personal ecology dashboard
   */
  async getUserEcologyDashboard(userId: string): Promise<any> {
    const impacts = await this.prisma.transaction_impacts.findMany({
      where: {
        OR: [
          { owner_id: userId },
          { receiver_id: userId },
        ],
      },
    });

    const totals = impacts.reduce(
      (acc, impact) => ({
        co2_saved_kg: acc.co2_saved_kg + Number(impact.co2_saved_kg),
        food_saved_kg: acc.food_saved_kg + Number(impact.food_saved_kg),
        water_saved_liters: acc.water_saved_liters + Number(impact.water_saved_liters),
        energy_saved_kwh: acc.energy_saved_kwh + Number(impact.energy_saved_kwh),
        landfill_diversion_kg: acc.landfill_diversion_kg + Number(impact.landfill_diversion_kg),
        tree_equivalent: acc.tree_equivalent + Number(impact.tree_equivalent),
      }),
      {
        co2_saved_kg: 0,
        food_saved_kg: 0,
        water_saved_liters: 0,
        energy_saved_kwh: 0,
        landfill_diversion_kg: 0,
        tree_equivalent: 0,
      },
    );

    // Calculate trends (this month vs last month)
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonthImpacts = impacts.filter(
      (impact) => new Date(impact.completed_at) >= thisMonth,
    );
    const lastMonthImpacts = impacts.filter(
      (impact) => new Date(impact.completed_at) >= lastMonth && new Date(impact.completed_at) < thisMonth,
    );

    const thisMonthTotals = thisMonthImpacts.reduce(
      (acc, impact) => ({
        co2_saved_kg: acc.co2_saved_kg + Number(impact.co2_saved_kg),
        food_saved_kg: acc.food_saved_kg + Number(impact.food_saved_kg),
        water_saved_liters: acc.water_saved_liters + Number(impact.water_saved_liters),
        energy_saved_kwh: acc.energy_saved_kwh + Number(impact.energy_saved_kwh),
        landfill_diversion_kg: acc.landfill_diversion_kg + Number(impact.landfill_diversion_kg),
      }),
      { co2_saved_kg: 0, food_saved_kg: 0, water_saved_liters: 0, energy_saved_kwh: 0, landfill_diversion_kg: 0 },
    );

    const lastMonthTotals = lastMonthImpacts.reduce(
      (acc, impact) => ({
        co2_saved_kg: acc.co2_saved_kg + Number(impact.co2_saved_kg),
        food_saved_kg: acc.food_saved_kg + Number(impact.food_saved_kg),
        water_saved_liters: acc.water_saved_liters + Number(impact.water_saved_liters),
        energy_saved_kwh: acc.energy_saved_kwh + Number(impact.energy_saved_kwh),
        landfill_diversion_kg: acc.landfill_diversion_kg + Number(impact.landfill_diversion_kg),
      }),
      { co2_saved_kg: 0, food_saved_kg: 0, water_saved_liters: 0, energy_saved_kwh: 0, landfill_diversion_kg: 0 },
    );

    // Calculate percentage changes
    const trends = {
      co2_trend: this.calculateTrend(thisMonthTotals.co2_saved_kg, lastMonthTotals.co2_saved_kg),
      food_trend: this.calculateTrend(thisMonthTotals.food_saved_kg, lastMonthTotals.food_saved_kg),
      water_trend: this.calculateTrend(thisMonthTotals.water_saved_liters, lastMonthTotals.water_saved_liters),
      energy_trend: this.calculateTrend(thisMonthTotals.energy_saved_kwh, lastMonthTotals.energy_saved_kwh),
      waste_trend: this.calculateTrend(thisMonthTotals.landfill_diversion_kg, lastMonthTotals.landfill_diversion_kg),
    };

    return {
      totals,
      trends,
      thisMonth: thisMonthTotals,
      lastMonth: lastMonthTotals,
    };
  }

  /**
   * Get community ecology dashboard
   */
  async getCommunityEcologyDashboard(): Promise<any> {
    const allImpacts = await this.prisma.transaction_impacts.findMany();

    const totals = allImpacts.reduce(
      (acc, impact) => ({
        co2_saved_kg: acc.co2_saved_kg + Number(impact.co2_saved_kg),
        food_saved_kg: acc.food_saved_kg + Number(impact.food_saved_kg),
        water_saved_liters: acc.water_saved_liters + Number(impact.water_saved_liters),
        energy_saved_kwh: acc.energy_saved_kwh + Number(impact.energy_saved_kwh),
        landfill_diversion_kg: acc.landfill_diversion_kg + Number(impact.landfill_diversion_kg),
        tree_equivalent: acc.tree_equivalent + Number(impact.tree_equivalent),
      }),
      {
        co2_saved_kg: 0,
        food_saved_kg: 0,
        water_saved_liters: 0,
        energy_saved_kwh: 0,
        landfill_diversion_kg: 0,
        tree_equivalent: 0,
      },
    );

    // Category breakdown
    const categoryBreakdown = allImpacts.reduce((acc, impact) => {
      const category = impact.category;
      if (!acc[category]) {
        acc[category] = {
          co2_saved_kg: 0,
          count: 0,
        };
      }
      acc[category].co2_saved_kg += Number(impact.co2_saved_kg);
      acc[category].count += 1;
      return acc;
    }, {} as Record<string, { co2_saved_kg: number; count: number }>);

    // Neighborhood breakdown
    const neighborhoodBreakdown = allImpacts.reduce((acc, impact) => {
      const neighborhood = impact.neighborhood || 'Unknown';
      if (!acc[neighborhood]) {
        acc[neighborhood] = {
          co2_saved_kg: 0,
          count: 0,
        };
      }
      acc[neighborhood].co2_saved_kg += Number(impact.co2_saved_kg);
      acc[neighborhood].count += 1;
      return acc;
    }, {} as Record<string, { co2_saved_kg: number; count: number }>);

    return {
      totals,
      categoryBreakdown,
      neighborhoodBreakdown,
    };
  }

  /**
   * Generate monthly report
   */
  async generateMonthlyReport(month: number, year: number): Promise<any> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const monthlyImpacts = await this.prisma.transaction_impacts.findMany({
      where: {
        completed_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totals = monthlyImpacts.reduce(
      (acc, impact) => ({
        co2_saved_kg: acc.co2_saved_kg + Number(impact.co2_saved_kg),
        food_saved_kg: acc.food_saved_kg + Number(impact.food_saved_kg),
        water_saved_liters: acc.water_saved_liters + Number(impact.water_saved_liters),
        energy_saved_kwh: acc.energy_saved_kwh + Number(impact.energy_saved_kwh),
        landfill_diversion_kg: acc.landfill_diversion_kg + Number(impact.landfill_diversion_kg),
        tree_equivalent: acc.tree_equivalent + Number(impact.tree_equivalent),
      }),
      {
        co2_saved_kg: 0,
        food_saved_kg: 0,
        water_saved_liters: 0,
        energy_saved_kwh: 0,
        landfill_diversion_kg: 0,
        tree_equivalent: 0,
      },
    );

    // Find top category and neighborhood
    const categoryStats = monthlyImpacts.reduce((acc, impact) => {
      const category = impact.category;
      acc[category] = (acc[category] || 0) + Number(impact.co2_saved_kg);
      return acc;
    }, {} as Record<string, number>);

    const neighborhoodStats = monthlyImpacts.reduce((acc, impact) => {
      const neighborhood = impact.neighborhood || 'Unknown';
      acc[neighborhood] = (acc[neighborhood] || 0) + Number(impact.co2_saved_kg);
      return acc;
    }, {} as Record<string, number>);

    const topCategory = Object.entries(categoryStats).sort(([,a], [,b]) => b - a)[0]?.[0];
    const topNeighborhood = Object.entries(neighborhoodStats).sort(([,a], [,b]) => b - a)[0]?.[0];

    // Generate recommendations
    const recommendations = this.generateRecommendations(categoryStats, neighborhoodStats);

    // Save report
    const report = await this.prisma.monthly_reports.upsert({
      where: { month_year: { month, year } },
      update: {
        total_co2_saved_kg: new Decimal(totals.co2_saved_kg),
        total_food_saved_kg: new Decimal(totals.food_saved_kg),
        total_water_saved_l: new Decimal(totals.water_saved_liters),
        total_energy_saved_kwh: new Decimal(totals.energy_saved_kwh),
        total_waste_reduced_kg: new Decimal(totals.landfill_diversion_kg),
        tree_equivalent: new Decimal(totals.tree_equivalent),
        top_category: topCategory,
        top_neighborhood: topNeighborhood,
        recommendations,
        generated_at: new Date(),
      },
      create: {
        month,
        year,
        total_co2_saved_kg: new Decimal(totals.co2_saved_kg),
        total_food_saved_kg: new Decimal(totals.food_saved_kg),
        total_water_saved_l: new Decimal(totals.water_saved_liters),
        total_energy_saved_kwh: new Decimal(totals.energy_saved_kwh),
        total_waste_reduced_kg: new Decimal(totals.landfill_diversion_kg),
        tree_equivalent: new Decimal(totals.tree_equivalent),
        top_category: topCategory,
        top_neighborhood: topNeighborhood,
        recommendations,
      },
    });

    return {
      ...totals,
      topCategory,
      topNeighborhood,
      recommendations,
      reportId: report.id,
    };
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 100) / 100;
  }

  private generateRecommendations(
    categoryStats: Record<string, number>,
    neighborhoodStats: Record<string, number>,
  ): string[] {
    const recommendations: string[] = [];

    const sortedCategories = Object.entries(categoryStats).sort(([,a], [,b]) => b - a);
    const topCategory = sortedCategories[0];

    if (topCategory) {
      const [category, impact] = topCategory;
      if (category === 'FOOD') {
        recommendations.push('Continue promoting electronics recycling - High impact on CO2 reduction');
      } else if (category === 'ELECTRONICS') {
        recommendations.push('Expand food sharing network - Increase food waste prevention');
      } else if (category === 'CLOTHES') {
        recommendations.push('Implement seasonal campaigns focused on high water-saving items');
      }
    }

    return recommendations;
  }
}