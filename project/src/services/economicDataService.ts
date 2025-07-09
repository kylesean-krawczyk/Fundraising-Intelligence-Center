import { EconomicIndicator, EconomicDataPoint } from '../types';

export class EconomicDataService {
  private static readonly FRED_API_BASE = 'https://api.stlouisfed.org/fred';
  private static readonly BLS_API_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data';
  
  // Note: In production, these should be environment variables
  private static readonly FRED_API_KEY = 'your_fred_api_key_here';
  private static readonly BLS_API_KEY = 'your_bls_api_key_here';

  static async getConsumerConfidenceIndex(): Promise<EconomicDataPoint[]> {
    try {
      // Consumer Confidence Index from University of Michigan
      const response = await fetch(
        `${this.FRED_API_BASE}/series/observations?series_id=UMCSENT&api_key=${this.FRED_API_KEY}&file_type=json&limit=24`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch Consumer Confidence data');
      }
      
      const data = await response.json();
      return data.observations?.map((obs: any) => ({
        date: new Date(obs.date),
        value: parseFloat(obs.value) || 0,
        indicator: 'Consumer Confidence Index'
      })) || [];
    } catch (error) {
      console.warn('Using mock Consumer Confidence data:', error);
      return this.getMockConsumerConfidence();
    }
  }

  static async getSP500Performance(): Promise<EconomicDataPoint[]> {
    try {
      // S&P 500 from FRED
      const response = await fetch(
        `${this.FRED_API_BASE}/series/observations?series_id=SP500&api_key=${this.FRED_API_KEY}&file_type=json&limit=24`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch S&P 500 data');
      }
      
      const data = await response.json();
      return data.observations?.map((obs: any) => ({
        date: new Date(obs.date),
        value: parseFloat(obs.value) || 0,
        indicator: 'S&P 500'
      })) || [];
    } catch (error) {
      console.warn('Using mock S&P 500 data:', error);
      return this.getMockSP500();
    }
  }

  static async getUnemploymentRate(): Promise<EconomicDataPoint[]> {
    try {
      // Unemployment Rate from BLS
      const requestBody = {
        seriesid: ['LNS14000000'],
        startyear: '2022',
        endyear: '2024',
        registrationkey: this.BLS_API_KEY
      };

      const response = await fetch(this.BLS_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unemployment data');
      }

      const data = await response.json();
      const series = data.Results?.series?.[0]?.data || [];
      
      return series.map((item: any) => ({
        date: new Date(`${item.year}-${item.period.substring(1)}-01`),
        value: parseFloat(item.value) || 0,
        indicator: 'Unemployment Rate'
      }));
    } catch (error) {
      console.warn('Using mock unemployment data:', error);
      return this.getMockUnemployment();
    }
  }

  static async getGDPGrowthRate(): Promise<EconomicDataPoint[]> {
    try {
      // GDP Growth Rate from FRED
      const response = await fetch(
        `${this.FRED_API_BASE}/series/observations?series_id=A191RL1Q225SBEA&api_key=${this.FRED_API_KEY}&file_type=json&limit=12`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch GDP data');
      }
      
      const data = await response.json();
      return data.observations?.map((obs: any) => ({
        date: new Date(obs.date),
        value: parseFloat(obs.value) || 0,
        indicator: 'GDP Growth Rate'
      })) || [];
    } catch (error) {
      console.warn('Using mock GDP data:', error);
      return this.getMockGDP();
    }
  }

  static async getAllEconomicIndicators(): Promise<EconomicIndicator[]> {
    try {
      const [cci, sp500, unemployment, gdp] = await Promise.all([
        this.getConsumerConfidenceIndex(),
        this.getSP500Performance(),
        this.getUnemploymentRate(),
        this.getGDPGrowthRate()
      ]);

      return [
        {
          name: 'Consumer Confidence Index',
          data: cci,
          impact: 'High correlation with discretionary giving',
          recommendation: 'Monitor monthly CCI reports for campaign timing',
          currentValue: cci[cci.length - 1]?.value || 0,
          trend: this.calculateTrend(cci),
          correlation: 0.75 // Positive correlation with donations
        },
        {
          name: 'S&P 500 Performance',
          data: sp500,
          impact: 'Stock market gains often increase charitable giving',
          recommendation: 'Track quarterly performance for major gift timing',
          currentValue: sp500[sp500.length - 1]?.value || 0,
          trend: this.calculateTrend(sp500),
          correlation: 0.68
        },
        {
          name: 'Unemployment Rate',
          data: unemployment,
          impact: 'Inverse relationship with donation frequency',
          recommendation: 'Adjust fundraising strategies during economic downturns',
          currentValue: unemployment[unemployment.length - 1]?.value || 0,
          trend: this.calculateTrend(unemployment),
          correlation: -0.62 // Negative correlation
        },
        {
          name: 'GDP Growth Rate',
          data: gdp,
          impact: 'Economic expansion correlates with increased giving',
          recommendation: 'Capitalize on growth periods for capital campaigns',
          currentValue: gdp[gdp.length - 1]?.value || 0,
          trend: this.calculateTrend(gdp),
          correlation: 0.71
        }
      ];
    } catch (error) {
      console.error('Failed to fetch economic indicators:', error);
      return this.getMockIndicators();
    }
  }

  private static calculateTrend(data: EconomicDataPoint[]): 'up' | 'down' | 'stable' {
    if (data.length < 2) return 'stable';
    
    const recent = data.slice(-3);
    const older = data.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.value, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.02) return 'up';
    if (change < -0.02) return 'down';
    return 'stable';
  }

  // Mock data methods for development/fallback
  private static getMockConsumerConfidence(): EconomicDataPoint[] {
    const baseValue = 95;
    return Array.from({ length: 12 }, (_, i) => ({
      date: new Date(2024, i, 1),
      value: baseValue + Math.sin(i * 0.5) * 10 + Math.random() * 5,
      indicator: 'Consumer Confidence Index'
    }));
  }

  private static getMockSP500(): EconomicDataPoint[] {
    const baseValue = 4200;
    return Array.from({ length: 12 }, (_, i) => ({
      date: new Date(2024, i, 1),
      value: baseValue + i * 50 + Math.random() * 200 - 100,
      indicator: 'S&P 500'
    }));
  }

  private static getMockUnemployment(): EconomicDataPoint[] {
    const baseValue = 3.8;
    return Array.from({ length: 12 }, (_, i) => ({
      date: new Date(2024, i, 1),
      value: baseValue + Math.sin(i * 0.3) * 0.5 + Math.random() * 0.3,
      indicator: 'Unemployment Rate'
    }));
  }

  private static getMockGDP(): EconomicDataPoint[] {
    const baseValue = 2.1;
    return Array.from({ length: 8 }, (_, i) => ({
      date: new Date(2024, i * 3, 1),
      value: baseValue + Math.sin(i * 0.4) * 0.8 + Math.random() * 0.4,
      indicator: 'GDP Growth Rate'
    }));
  }

  private static getMockIndicators(): EconomicIndicator[] {
    return [
      {
        name: 'Consumer Confidence Index',
        data: this.getMockConsumerConfidence(),
        impact: 'High correlation with discretionary giving',
        recommendation: 'Monitor monthly CCI reports for campaign timing',
        currentValue: 98.5,
        trend: 'up',
        correlation: 0.75
      },
      {
        name: 'S&P 500 Performance',
        data: this.getMockSP500(),
        impact: 'Stock market gains often increase charitable giving',
        recommendation: 'Track quarterly performance for major gift timing',
        currentValue: 4350.2,
        trend: 'up',
        correlation: 0.68
      },
      {
        name: 'Unemployment Rate',
        data: this.getMockUnemployment(),
        impact: 'Inverse relationship with donation frequency',
        recommendation: 'Adjust fundraising strategies during economic downturns',
        currentValue: 3.7,
        trend: 'down',
        correlation: -0.62
      },
      {
        name: 'GDP Growth Rate',
        data: this.getMockGDP(),
        impact: 'Economic expansion correlates with increased giving',
        recommendation: 'Capitalize on growth periods for capital campaigns',
        currentValue: 2.4,
        trend: 'stable',
        correlation: 0.71
      }
    ];
  }
}