import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdvisorScorecard from './AdvisorScorecard';
import { 
  MagnifyingGlassIcon,
  BuildingOffice2Icon,
  ArrowPathIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';

interface MarketScorecard {
  marketId: number;
  marketName: string;
  description: string;
  metrics: {
    invoices: number;
    sales: number;
    gpSales: number;
    gpPercent: number;
    avgSpend: number;
  };
  services: Record<string, number>;
  goals: Record<string, {
    target: number;
    periodType: string;
    effectiveDate: string;
  }>;
  lastUpdated: string;
}

interface MarketScorecardResponse {
  period: {
    year: number;
    month: number;
  };
  markets: MarketScorecard[];
  totalMarkets: number;
  lastUpdated: string;
}

interface MarketScorecardsProps {
  onMessageMarket?: (market: MarketScorecard) => void;
}

const MarketScorecards: React.FC<MarketScorecardsProps> = ({ onMessageMarket }) => {
  console.log('🏬 MarketScorecards component rendered');
  const { user, token } = useAuth();
  const [marketData, setMarketData] = useState<MarketScorecardResponse | null>(null);
  const [filteredMarkets, setFilteredMarkets] = useState<MarketScorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMtdMonth, setSelectedMtdMonth] = useState(() => {
    // Default to current month
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  });

  useEffect(() => {
    console.log('🏬 MarketScorecards: useEffect triggered, user:', user, 'token available:', !!token);
    console.log('🏬 MarketScorecards: User role:', user?.role);
    if (user && token) {
      // Check if user can view market scorecards
      if (user.role === 'advisor') {
        setError('Advisors cannot view market scorecards');
        setLoading(false);
        return;
      }
      loadMarketScoreCards();
    }
  }, [user, token, selectedMtdMonth]);

  useEffect(() => {
    // Filter markets based on search term
    if (!marketData) {
      setFilteredMarkets([]);
      return;
    }

    let filtered = marketData.markets;

    if (searchTerm.trim()) {
      filtered = filtered.filter(market =>
        market.marketName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (market.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredMarkets(filtered);
  }, [marketData, searchTerm]);

  const loadMarketScoreCards = async () => {
    console.log('🏬 MarketScorecards: Loading market scorecards');
    setLoading(true);
    setError('');
    
    try {
      const [mtdYear, mtdMonth] = selectedMtdMonth.split('-');
      const url = `${process.env.REACT_APP_API_URL}/api/scorecard/markets?mtdYear=${mtdYear}&mtdMonth=${mtdMonth}`;
      console.log('🏬 MarketScorecards: Fetching from URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🏬 MarketScorecards: Market data received:', data);
        setMarketData(data);
        console.log(`🏬 MarketScorecards: Loaded ${data.markets.length} market scorecards`);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('🏬 MarketScorecards: API error:', response.status, errorData);
        setError(errorData.message || `Failed to load market scorecards (${response.status})`);
      }
    } catch (error) {
      console.error('🏬 MarketScorecards: Error loading market scorecards:', error);
      setError('Failed to load market scorecards');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadMarketScoreCards();
  };

  // Convert market data to AdvisorScorecardData format for reusing AdvisorScorecard component
  const convertMarketToAdvisorFormat = (market: MarketScorecard) => {
    return {
      id: `market-${market.marketId}`,
      employee: market.marketName,
      store: market.marketName,
      marketId: market.marketId,
      totalSales: market.metrics.sales,
      salesPerVehicle: market.metrics.avgSpend,
      grossProfit: market.metrics.gpSales,
      grossProfitPercent: market.metrics.gpPercent,
      grossProfitPerVehicle: market.metrics.invoices > 0 ? market.metrics.gpSales / market.metrics.invoices : 0,
      customerCount: market.metrics.invoices,
      
      // Core metrics using template keys
      invoices: market.metrics.invoices,
      sales: market.metrics.sales,
      gpsales: market.metrics.gpSales,
      gppercent: market.metrics.gpPercent,
      'avg.spend': market.metrics.avgSpend,
      
      // Add all service values
      ...Object.fromEntries(
        Object.entries(market.services).map(([serviceName, value]) => {
          const templateKey = serviceName.toLowerCase().replace(/[^a-z0-9%]/g, '');
          return [templateKey, value];
        })
      ),
      
      goals: market.goals,
      rawApiServices: market.services,
      lastUpdated: market.lastUpdated
    };
  };

  // Generate month options for the last 12 months
  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const value = `${year}-${month}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    
    return options;
  };

  if (loading && !marketData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Loading market scorecards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <h3 className="font-medium">Cannot Load Market Scorecards</h3>
          <p>{error}</p>
          {user?.role === 'advisor' && (
            <p className="mt-2 text-sm">Market scorecards are only available to managers and administrators.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BuildingOffice2Icon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Market Scorecards</h1>
              <p className="text-gray-600">
                Market-level performance metrics from the "Markets" tab
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MTD Month Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarDaysIcon className="h-4 w-4 inline mr-1" />
              MTD Month
            </label>
            <select
              value={selectedMtdMonth}
              onChange={(e) => setSelectedMtdMonth(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {generateMonthOptions().map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MagnifyingGlassIcon className="h-4 w-4 inline mr-1" />
              Search Markets
            </label>
            <input
              type="text"
              placeholder="Search by market name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      {marketData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900">
                🏬 Market Performance Summary
              </h3>
              <p className="text-blue-700 text-sm">
                {marketData.period.month.toString().padStart(2, '0')}/{marketData.period.year} • 
                {filteredMarkets.length} of {marketData.totalMarkets} markets
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">
                {filteredMarkets.reduce((sum, market) => sum + market.metrics.invoices, 0).toLocaleString()}
              </div>
              <div className="text-sm text-blue-600">Total Invoices</div>
            </div>
          </div>
        </div>
      )}

      {/* Market Scorecards */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredMarkets.length > 0 ? (
        <div className="space-y-6">
          {filteredMarkets.map((market) => (
            <div key={market.marketId} className="bg-white rounded-lg border border-gray-200">
              {/* Market Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <BuildingOffice2Icon className="h-6 w-6 text-gray-600 mr-3" />
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {market.marketName}
                      </h2>
                      {market.description && (
                        <div className="text-sm text-gray-600">
                          {market.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      ${market.metrics.sales.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Sales</div>
                  </div>
                </div>
              </div>

              {/* Market Scorecard Content */}
              <div className="p-6">
                <AdvisorScorecard
                  advisor={convertMarketToAdvisorFormat(market)}
                  canSetGoals={user?.role !== 'advisor'}
                  canEditProfile={false}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Market Data Available</h3>
          <p className="text-gray-600">
            No market performance data found for the selected month. Make sure you've uploaded a spreadsheet with a "Markets" tab.
          </p>
        </div>
      )}
    </div>
  );
};

export default MarketScorecards;