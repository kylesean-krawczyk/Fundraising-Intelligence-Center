import React from 'react';
import { AnalysisResult } from '../types';
import { MetricsCard } from './MetricsCard';
import { DonationChart } from './DonationChart';
import { TopDonorsTable } from './TopDonorsTable';
import { RetentionChart } from './RetentionChart';
import { EnhancedForecastCard } from './EnhancedForecastCard';
import { EnhancedDonorAnalytics } from '../utils/enhancedAnalytics';
import { Users, DollarSign, TrendingUp, Gift } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/helpers';

interface DashboardProps {
  analysis: AnalysisResult;
}

export const Dashboard: React.FC<DashboardProps> = ({ analysis }) => {
  const [enhancedAnalysis, setEnhancedAnalysis] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const loadEnhancedAnalysis = async () => {
      setLoading(true);
      try {
        // This would typically use the actual donor data
        // For now, we'll enhance the existing analysis
        const enhanced = {
          ...analysis,
          enhancedForecast: {
            ...analysis.forecast,
            economicFactors: {
              consumerConfidence: 0.05,
              marketPerformance: 0.03,
              unemploymentImpact: -0.02,
              gdpGrowthImpact: 0.04
            },
            adjustedPredictions: {
              nextMonth: {
                baseAmount: analysis.forecast.nextMonth.predictedAmount,
                economicAdjustment: analysis.forecast.nextMonth.predictedAmount * 0.08,
                finalAmount: analysis.forecast.nextMonth.predictedAmount * 1.08,
                confidence: Math.min(0.95, analysis.forecast.nextMonth.confidence + 0.05)
              },
              nextQuarter: {
                baseAmount: analysis.forecast.nextQuarter.predictedAmount,
                economicAdjustment: analysis.forecast.nextQuarter.predictedAmount * 0.06,
                finalAmount: analysis.forecast.nextQuarter.predictedAmount * 1.06,
                confidence: Math.min(0.95, analysis.forecast.nextQuarter.confidence + 0.03)
              }
            }
          }
        };
        setEnhancedAnalysis(enhanced);
      } catch (error) {
        console.error('Failed to load enhanced analysis:', error);
        setEnhancedAnalysis(analysis);
      } finally {
        setLoading(false);
      }
    };

    loadEnhancedAnalysis();
  }, [analysis]);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricsCard
          title="Total Donors"
          value={formatNumber(analysis.totalDonors)}
          icon={<Users className="w-6 h-6" />}
          color="blue"
        />
        <MetricsCard
          title="Total Donations"
          value={formatCurrency(analysis.totalAmount)}
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />
        <MetricsCard
          title="Average Donation"
          value={formatCurrency(analysis.averageDonation)}
          icon={<TrendingUp className="w-6 h-6" />}
          color="purple"
        />
        <MetricsCard
          title="Total Gifts"
          value={formatNumber(analysis.donationCount)}
          icon={<Gift className="w-6 h-6" />}
          color="orange"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Donation Trends</h3>
          <DonationChart data={analysis.monthlyTrends} />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Donor Retention</h3>
          <RetentionChart data={analysis.donorRetention} />
        </div>
      </div>

      {/* Forecast and Top Donors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-16 bg-gray-200 rounded"></div>
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ) : enhancedAnalysis?.enhancedForecast ? (
            <EnhancedForecastCard forecast={enhancedAnalysis.enhancedForecast} />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-500">Enhanced forecast unavailable</p>
            </div>
          )}
        </div>
        
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Donors</h3>
            <TopDonorsTable donors={analysis.topDonors} />
          </div>
        </div>
      </div>
    </div>
  );
};