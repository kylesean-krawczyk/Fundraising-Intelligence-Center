import { DonorData, AnalysisResult, EconomicIndicator, EnhancedForecastData } from '../types';
import { DonorAnalytics } from './analytics';
import { EconomicDataService } from '../services/economicDataService';

export class EnhancedDonorAnalytics extends DonorAnalytics {
  static async analyzeDataWithEconomicFactors(donors: DonorData[]): Promise<AnalysisResult & { enhancedForecast: EnhancedForecastData }> {
    const baseAnalysis = this.analyzeData(donors);
    const economicIndicators = await EconomicDataService.getAllEconomicIndicators();
    const enhancedForecast = await this.generateEnhancedForecast(baseAnalysis.monthlyTrends, economicIndicators);

    return {
      ...baseAnalysis,
      enhancedForecast
    };
  }

  private static async generateEnhancedForecast(
    monthlyTrends: any[],
    economicIndicators: EconomicIndicator[]
  ): Promise<EnhancedForecastData> {
    const baseForecast = this.generateForecast(monthlyTrends);
    
    // Calculate economic impact factors
    const economicFactors = this.calculateEconomicImpact(economicIndicators);
    
    // Apply economic adjustments to base predictions
    const adjustedPredictions = this.applyEconomicAdjustments(baseForecast, economicFactors);

    return {
      ...baseForecast,
      economicFactors,
      adjustedPredictions
    };
  }

  private static calculateEconomicImpact(indicators: EconomicIndicator[]): EnhancedForecastData['economicFactors'] {
    const cci = indicators.find(i => i.name === 'Consumer Confidence Index');
    const sp500 = indicators.find(i => i.name === 'S&P 500 Performance');
    const unemployment = indicators.find(i => i.name === 'Unemployment Rate');
    const gdp = indicators.find(i => i.name === 'GDP Growth Rate');

    return {
      consumerConfidence: this.calculateIndicatorImpact(cci),
      marketPerformance: this.calculateIndicatorImpact(sp500),
      unemploymentImpact: this.calculateIndicatorImpact(unemployment),
      gdpGrowthImpact: this.calculateIndicatorImpact(gdp)
    };
  }

  private static calculateIndicatorImpact(indicator?: EconomicIndicator): number {
    if (!indicator || indicator.data.length < 2) return 0;

    const recent = indicator.data.slice(-3);
    const historical = indicator.data.slice(-12, -3);
    
    const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
    const historicalAvg = historical.reduce((sum, d) => sum + d.value, 0) / historical.length;
    
    const percentChange = (recentAvg - historicalAvg) / historicalAvg;
    
    // Apply correlation coefficient to weight the impact
    return percentChange * Math.abs(indicator.correlation);
  }

  private static applyEconomicAdjustments(
    baseForecast: any,
    economicFactors: EnhancedForecastData['economicFactors']
  ): EnhancedForecastData['adjustedPredictions'] {
    // Calculate composite economic adjustment factor
    const economicAdjustment = (
      economicFactors.consumerConfidence * 0.3 +
      economicFactors.marketPerformance * 0.25 +
      economicFactors.unemploymentImpact * 0.25 +
      economicFactors.gdpGrowthImpact * 0.2
    );

    // Apply adjustment with dampening to prevent extreme swings
    const dampedAdjustment = Math.max(-0.3, Math.min(0.3, economicAdjustment));

    const nextMonthAdjustment = baseForecast.nextMonth.predictedAmount * dampedAdjustment;
    const nextQuarterAdjustment = baseForecast.nextQuarter.predictedAmount * dampedAdjustment;

    return {
      nextMonth: {
        baseAmount: baseForecast.nextMonth.predictedAmount,
        economicAdjustment: nextMonthAdjustment,
        finalAmount: baseForecast.nextMonth.predictedAmount + nextMonthAdjustment,
        confidence: Math.min(0.95, baseForecast.nextMonth.confidence + Math.abs(dampedAdjustment) * 0.1)
      },
      nextQuarter: {
        baseAmount: baseForecast.nextQuarter.predictedAmount,
        economicAdjustment: nextQuarterAdjustment,
        finalAmount: baseForecast.nextQuarter.predictedAmount + nextQuarterAdjustment,
        confidence: Math.min(0.95, baseForecast.nextQuarter.confidence + Math.abs(dampedAdjustment) * 0.1)
      }
    };
  }

  static calculateOptimalCampaignTiming(
    economicIndicators: EconomicIndicator[],
    donorData: DonorData[]
  ): {
    recommendedMonths: string[];
    reasoning: string;
    confidenceScore: number;
  } {
    const cci = economicIndicators.find(i => i.name === 'Consumer Confidence Index');
    const sp500 = economicIndicators.find(i => i.name === 'S&P 500 Performance');
    
    let score = 0;
    let reasoning = '';
    
    if (cci && cci.trend === 'up' && cci.currentValue > 95) {
      score += 0.3;
      reasoning += 'Consumer confidence is rising, indicating favorable giving conditions. ';
    }
    
    if (sp500 && sp500.trend === 'up') {
      score += 0.25;
      reasoning += 'Stock market performance is positive, potentially increasing donor wealth. ';
    }
    
    // Analyze historical giving patterns
    const monthlyGiving = this.analyzeSeasonalPatterns(donorData);
    const bestMonths = monthlyGiving
      .sort((a, b) => b.averageAmount - a.averageAmount)
      .slice(0, 3)
      .map(m => m.month);
    
    score += 0.45; // Base score for historical patterns
    reasoning += `Historical data shows strongest giving in ${bestMonths.join(', ')}.`;

    return {
      recommendedMonths: bestMonths,
      reasoning,
      confidenceScore: Math.min(1, score)
    };
  }

  private static analyzeSeasonalPatterns(donorData: DonorData[]) {
    const monthlyData = new Map<string, { total: number; count: number }>();
    
    donorData.forEach(donor => {
      donor.donations.forEach(donation => {
        const month = donation.date.toLocaleString('default', { month: 'long' });
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { total: 0, count: 0 });
        }
        const data = monthlyData.get(month)!;
        data.total += donation.amount;
        data.count += 1;
      });
    });

    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      averageAmount: data.total / data.count,
      totalAmount: data.total,
      donationCount: data.count
    }));
  }
}