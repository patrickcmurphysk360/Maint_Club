import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdvisorScorecard from './AdvisorScorecard';
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
  UserIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

interface StoreManagerInfo {
  id: number;
  name: string;
  email: string;
}

interface StoreScorecard {
  storeId: number;
  storeName: string;
  marketId: number;
  managerInfo: StoreManagerInfo | null;
  advisorCount: number;
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

interface StoreScorecardResponse {
  marketId: number;
  period: {
    year: number;
    month: number;
  };
  stores: StoreScorecard[];
  totalStores: number;
  lastUpdated: string;
}

interface StoreScorecardsProps {
  onMessageStore?: (store: StoreScorecard) => void;
}

const StoreScorecards: React.FC<StoreScorecardsProps> = ({ onMessageStore }) => {
  console.log('🏪 StoreScorecards component rendered');
  const { user, token } = useAuth();
  const [storeData, setStoreData] = useState<StoreScorecardResponse | null>(null);
  const [filteredStores, setFilteredStores] = useState<StoreScorecard[]>([]);
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
  
  // Available markets for filtering (will be populated based on user permissions)
  const [availableMarkets, setAvailableMarkets] = useState<Array<{id: number, name: string}>>([]);
  const [selectedMarket, setSelectedMarket] = useState('');

  useEffect(() => {
    console.log('🏪 StoreScorecards: useEffect triggered, user:', user, 'token available:', !!token);
    console.log('🏪 StoreScorecards: User role:', user?.role);
    if (user && token) {
      // Check if user can view store scorecards
      if (user.role === 'advisor') {
        setError('Advisors cannot view store scorecards');
        setLoading(false);
        return;
      }
      loadAvailableMarkets();
    }
  }, [user, token]);

  useEffect(() => {
    if (selectedMarket) {
      loadStoreScoreCards();
    }
  }, [selectedMarket, selectedMtdMonth]);

  useEffect(() => {
    // Filter stores based on search term
    if (!storeData) {
      setFilteredStores([]);
      return;
    }

    let filtered = storeData.stores;

    if (searchTerm.trim()) {
      filtered = filtered.filter(store =>
        store.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (store.managerInfo?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredStores(filtered);
  }, [storeData, searchTerm]);

  const loadAvailableMarkets = async () => {
    try {
      console.log('🏪 StoreScorecards: Loading available markets for user:', user?.id);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${user?.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('🏪 StoreScorecards: User data received:', userData);
        const userMarkets = userData.market_assignments || [];
        console.log('🏪 StoreScorecards: User markets:', userMarkets);
        
        setAvailableMarkets(userMarkets.map((m: any) => ({ id: m.market_id, name: m.market_name })));
        
        // Auto-select first market if available
        if (userMarkets.length > 0 && !selectedMarket) {
          const firstMarketId = userMarkets[0].market_id.toString();
          console.log('🏪 StoreScorecards: Auto-selecting first market:', firstMarketId);
          setSelectedMarket(firstMarketId);
        }
      } else {
        console.error('🏪 StoreScorecards: Failed to load user data:', response.status, response.statusText);
        setError(`Failed to load user data: ${response.status}`);
      }
    } catch (error) {
      console.error('🏪 StoreScorecards: Error loading markets:', error);
      setError('Failed to load available markets');
    }
  };

  const loadStoreScoreCards = async () => {
    if (!selectedMarket) {
      console.log('🏪 StoreScorecards: No market selected, skipping load');
      return;
    }
    
    console.log('🏪 StoreScorecards: Loading store scorecards for market:', selectedMarket);
    setLoading(true);
    setError('');
    
    try {
      const [mtdYear, mtdMonth] = selectedMtdMonth.split('-');
      const url = `${process.env.REACT_APP_API_URL}/api/scorecard/stores/${selectedMarket}?mtdYear=${mtdYear}&mtdMonth=${mtdMonth}`;
      console.log('🏪 StoreScorecards: Fetching from URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🏪 StoreScorecards: Store data received:', data);
        setStoreData(data);
        console.log(`🏪 StoreScorecards: Loaded ${data.stores.length} store scorecards for market ${selectedMarket}`);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('🏪 StoreScorecards: API error:', response.status, errorData);
        setError(errorData.message || `Failed to load store scorecards (${response.status})`);
      }
    } catch (error) {
      console.error('🏪 StoreScorecards: Error loading store scorecards:', error);
      setError('Failed to load store scorecards');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadStoreScoreCards();
  };

  // Convert store data to AdvisorScorecardData format for reusing AdvisorScorecard component
  const convertStoreToAdvisorFormat = (store: StoreScorecard) => {
    return {
      id: `store-${store.storeId}`,
      employee: store.storeName,
      store: store.storeName,
      marketId: store.marketId,
      totalSales: store.metrics.sales,
      salesPerVehicle: store.metrics.avgSpend,
      grossProfit: store.metrics.gpSales,
      grossProfitPercent: store.metrics.gpPercent,
      grossProfitPerVehicle: store.metrics.invoices > 0 ? store.metrics.gpSales / store.metrics.invoices : 0,
      customerCount: store.metrics.invoices,
      
      // Core metrics using template keys
      invoices: store.metrics.invoices,
      sales: store.metrics.sales,
      gpsales: store.metrics.gpSales,
      gppercent: store.metrics.gpPercent,
      'avg.spend': store.metrics.avgSpend,
      
      // Add all service values
      ...Object.fromEntries(
        Object.entries(store.services).map(([serviceName, value]) => {
          const templateKey = serviceName.toLowerCase().replace(/[^a-z0-9%]/g, '');
          return [templateKey, value];
        })
      ),
      
      goals: store.goals,
      rawApiServices: store.services,
      lastUpdated: store.lastUpdated
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

  if (loading && !storeData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Loading store scorecards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <h3 className="font-medium">Cannot Load Store Scorecards</h3>
          <p>{error}</p>
          {user?.role === 'advisor' && (
            <p className="mt-2 text-sm">Store scorecards are only available to managers and administrators.</p>
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
            <BuildingStorefrontIcon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Store Scorecards</h1>
              <p className="text-gray-600">
                Store-level performance metrics aggregated from all advisors
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Market Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FunnelIcon className="h-4 w-4 inline mr-1" />
              Market
            </label>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select Market</option>
              {availableMarkets.map(market => (
                <option key={market.id} value={market.id.toString()}>
                  {market.name}
                </option>
              ))}
            </select>
          </div>

          {/* MTD Month Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
              Search Stores
            </label>
            <input
              type="text"
              placeholder="Search by store name or manager..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary */}
      {storeData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900">
                📊 Store Performance Summary
              </h3>
              <p className="text-blue-700 text-sm">
                {storeData.period.month.toString().padStart(2, '0')}/{storeData.period.year} • 
                {filteredStores.length} of {storeData.totalStores} stores
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">
                {filteredStores.reduce((sum, store) => sum + store.metrics.invoices, 0).toLocaleString()}
              </div>
              <div className="text-sm text-blue-600">Total Invoices</div>
            </div>
          </div>
        </div>
      )}

      {/* Store Scorecards */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredStores.length > 0 ? (
        <div className="space-y-6">
          {filteredStores.map((store) => (
            <div key={store.storeId} className="bg-white rounded-lg border border-gray-200">
              {/* Store Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <BuildingStorefrontIcon className="h-6 w-6 text-gray-600 mr-3" />
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {store.storeName}
                      </h2>
                      <div className="flex items-center text-sm text-gray-600">
                        <UserIcon className="h-4 w-4 mr-1" />
                        {store.managerInfo ? (
                          <span>Manager: {store.managerInfo.name}</span>
                        ) : (
                          <span>No manager assigned</span>
                        )}
                        <span className="mx-2">•</span>
                        <UserGroupIcon className="h-4 w-4 mr-1" />
                        <span>{store.advisorCount} advisor{store.advisorCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      ${store.metrics.sales.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Sales</div>
                  </div>
                </div>
              </div>

              {/* Store Scorecard Content */}
              <div className="p-6">
                <AdvisorScorecard
                  advisor={convertStoreToAdvisorFormat(store)}
                  canSetGoals={user?.role !== 'advisor'}
                  canEditProfile={false}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <BuildingStorefrontIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Store Data Available</h3>
          <p className="text-gray-600">
            {selectedMarket ? 
              'No store performance data found for the selected month.' :
              'Please select a market to view store scorecards.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default StoreScorecards;