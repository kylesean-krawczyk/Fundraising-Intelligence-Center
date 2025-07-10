import { DonorData, AnalysisResult, MonthlyTrend, RetentionData, ForecastData } from '../types';
import { format, subMonths, getYear, getMonth } from 'date-fns';

export class DonorAnalytics {
  static analyzeData(donors: DonorData[]): AnalysisResult {
    const totalDonors = donors.length;
    const totalAmount = donors.reduce((sum, donor) => sum + donor.totalAmount, 0);
    const donationCount = donors.reduce((sum, donor) => sum + donor.donationCount, 0);
    const averageDonation = totalAmount / donationCount;

    const topDonors = donors
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    const monthlyTrends = this.calculateMonthlyTrends(donors);
    const donorRetention = this.calculateRetention(donors);
    const forecast = this.generateForecast(monthlyTrends);

    return {
      totalDonors,
      totalAmount,
      averageDonation,
      donationCount,
      topDonors,
      monthlyTrends,
      donorRetention,
      forecast
    };
  }

  private static calculateMonthlyTrends(donors: DonorData[]): MonthlyTrend[] {
    const monthlyData = new Map<string, { amount: number; donors: Set<string> }>();

    donors.forEach(donor => {
      donor.donations.forEach(donation => {
        const monthKey = format(donation.date, 'yyyy-MM');
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, { amount: 0, donors: new Set() });
        }
        const data = monthlyData.get(monthKey)!;
        data.amount += donation.amount;
        data.donors.add(donor.id);
      });
    });

    return Array.from(monthlyData.entries())
      .map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          month: format(date, 'MMM yyyy'),
          year: parseInt(year),
          amount: data.amount,
          donorCount: data.donors.size,
          averageDonation: data.amount / data.donors.size
        };
      })
      .sort((a, b) => a.year - b.year || a.month.localeCompare(b.month));
  }

  private static calculateRetention(donors: DonorData[]): RetentionData {
    const currentMonth = new Date();
    const lastMonth = subMonths(currentMonth, 1);
    
    const currentMonthDonors = new Set<string>();
    const lastMonthDonors = new Set<string>();

    donors.forEach(donor => {
      donor.donations.forEach(donation => {
        const donationMonth = getMonth(donation.date);
        const donationYear = getYear(donation.date);
        
        if (donationYear === getYear(currentMonth) && donationMonth === getMonth(currentMonth)) {
          currentMonthDonors.add(donor.id);
        }
        if (donationYear === getYear(lastMonth) && donationMonth === getMonth(lastMonth)) {
          lastMonthDonors.add(donor.id);
        }
      });
    });

    const returningDonors = Array.from(currentMonthDonors).filter(id => 
      lastMonthDonors.has(id)
    ).length;

    const newDonors = currentMonthDonors.size - returningDonors;
    const retentionRate = lastMonthDonors.size > 0 ? returningDonors / lastMonthDonors.size : 0;
    const churnRate = 1 - retentionRate;

    return {
      newDonors,
      returningDonors,
      retentionRate,
      churnRate
    };
  }

  protected static generateForecast(monthlyTrends: MonthlyTrend[]): ForecastData {
    if (monthlyTrends.length < 3) {
      return {
        nextMonth: { predictedAmount: 0, confidence: 0 },
        nextQuarter: { predictedAmount: 0, confidence: 0 },
        trendDirection: 'stable'
      };
    }

    const amounts = monthlyTrends.map(trend => trend.amount);
    const recentTrends = amounts.slice(-6); // Last 6 months
    
    // Simple linear regression for forecasting
    const regression = this.calculateLinearRegression(recentTrends);
    const nextMonthPrediction = regression.predict(recentTrends.length);
    const nextQuarterPrediction = (regression.predict(recentTrends.length + 1) + 
                                  regression.predict(recentTrends.length + 2) + 
                                  regression.predict(recentTrends.length + 3)) / 3;

    // Calculate confidence based on R-squared
    const confidence = Math.max(0, Math.min(1, regression.rSquared));

    // Determine trend direction
    const slope = regression.slope;
    const trendDirection = slope > 0.1 ? 'up' : slope < -0.1 ? 'down' : 'stable';

    return {
      nextMonth: {
        predictedAmount: Math.max(0, nextMonthPrediction),
        confidence
      },
      nextQuarter: {
        predictedAmount: Math.max(0, nextQuarterPrediction),
        confidence
      },
      trendDirection
    };
  }

  private static calculateLinearRegression(values: number[]) {
    const n = values.length;
    const sumX = values.reduce((sum, _, i) => sum + i, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = values.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssRes = values.reduce((sum, val, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const ssTot = values.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    return {
      slope,
      intercept,
      rSquared,
      predict: (x: number) => slope * x + intercept
    };
  }

  static comparePeriodsAnalysis(
    period1Data: DonorData[],
    period2Data: DonorData[]
  ): {
    period1: AnalysisResult;
    period2: AnalysisResult;
    comparison: {
      donorGrowth: number;
      amountGrowth: number;
      avgDonationGrowth: number;
    };
  } {
    const period1 = this.analyzeData(period1Data);
    const period2 = this.analyzeData(period2Data);

    const comparison = {
      donorGrowth: (period2.totalDonors - period1.totalDonors) / period1.totalDonors,
      amountGrowth: (period2.totalAmount - period1.totalAmount) / period1.totalAmount,
      avgDonationGrowth: (period2.averageDonation - period1.averageDonation) / period1.averageDonation
    };

    return {
      period1,
      period2,
      comparison
    };
  }
}