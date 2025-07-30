import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AdvisorScorecardData } from '../../types/scorecard';
import AdvisorScorecard from './AdvisorScorecard';
import GoalSettingModal from './GoalSettingModal';
import { goalsAPI } from '../../services/api';
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  UserGroupIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

// Define user interface for combined users
interface CombinedUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  isNumericId: boolean;
  store_assignments: Array<{
    store_id: number;
    store_name: string;
    market_name: string;
  }>;
  market_assignments: Array<{
    market_id: number;
    market_name: string;
  }>;
}

interface AdvisorScorecardsProps {
  onMessageAdvisor?: (advisor: AdvisorScorecardData) => void;
}

const AdvisorScorecards: React.FC<AdvisorScorecardsProps> = ({ onMessageAdvisor }) => {
  const { user, token } = useAuth();
  const [advisors, setAdvisors] = useState<AdvisorScorecardData[]>([]);
  const [filteredAdvisors, setFilteredAdvisors] = useState<AdvisorScorecardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('');
  const [error, setError] = useState('');
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [selectedAdvisorForGoal, setSelectedAdvisorForGoal] = useState<AdvisorScorecardData | null>(null);
  const [serviceMappings, setServiceMappings] = useState<Record<string, string>>({});

  // Removed mock data - now fetches from API

  useEffect(() => {
    loadAdvisors();
  }, [token]);

  useEffect(() => {
    filterAdvisors();
  }, [advisors, searchTerm, selectedStore, selectedMarket]);

  const fetchServiceMappings = async () => {
    try {
      // For now, get all mappings - later we'll filter by market
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/vendor-mappings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) return {};
      
      const data = await response.json();
      
      // Create a mapping object: service_field -> branded_name
      const mappings: Record<string, string> = {};
      (data.mappings || []).forEach((mapping: any) => {
        mappings[mapping.service_field] = mapping.product_name;
      });
      
      return mappings;
    } catch (err) {
      console.error('Error fetching service mappings:', err);
      return {};
    }
  };

  const loadAdvisors = async () => {
    setLoading(true);
    setError('');
    
    if (!token) {
      setError('Authentication required');
      setAdvisors([]);
      setLoading(false);
      return;
    }
    
    try {
      // Fetch MVP users (numeric IDs with performance data)
      const mvpResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/users?role=advisor`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Process MVP users (these have performance data)
      const allUsers: CombinedUser[] = [];
      
      if (mvpResponse.ok) {
        const mvpData = await mvpResponse.json();
        const mvpUsers = Array.isArray(mvpData) ? mvpData : mvpData.users || [];
        mvpUsers.forEach((user: any) => {
          allUsers.push({
            user_id: user.id,
            first_name: user.firstName,
            last_name: user.lastName,
            email: user.email,
            role: user.role,
            status: user.status,
            store_assignments: user.store_assignments || [],
            market_assignments: user.market_assignments || [],
            isNumericId: true // Flag to indicate this user has performance data
          });
        });
      }
      
      if (allUsers.length === 0) {
        throw new Error('No advisors found');
      }
      
      // Get market-specific service mappings for branded names
      const fetchedServiceMappings = await fetchServiceMappings();
      setServiceMappings(fetchedServiceMappings);
      
      // Transform user data to scorecard format and fetch actual performance data
      const advisorScorecards: AdvisorScorecardData[] = [];
      
      // Fetch scorecard data for each advisor
      for (const user of allUsers) {
        try {
          const scorecardResponse = await fetch(
            `${process.env.REACT_APP_API_URL}/api/scorecard/advisor/${user.user_id}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (scorecardResponse.ok) {
            const scorecardData = await scorecardResponse.json();
            
            // Extract store and market info from user assignments
            const stores = user.store_assignments?.map(s => s.store_name).join(', ') || 'Pending Assignment';
            const markets = user.market_assignments?.map(m => m.market_name).join(', ') || 
                           user.store_assignments?.[0]?.market_name || 'TBD';
            
            advisorScorecards.push({
              id: user.user_id,
              employee: `${user.first_name} ${user.last_name}`,
              store: stores,
              marketId: markets,
              mappedUserId: user.user_id,
              mappedUserName: user.email,
              totalSales: scorecardData.metrics?.sales || 0,
              salesPerVehicle: scorecardData.metrics?.invoices > 0 
                ? (scorecardData.metrics?.sales || 0) / scorecardData.metrics.invoices 
                : 0,
              grossProfit: scorecardData.metrics?.gpSales || 0,
              grossProfitPercent: parseFloat(scorecardData.metrics?.gpPercent || 0),
              grossProfitPerVehicle: scorecardData.metrics?.invoices > 0
                ? (scorecardData.metrics?.gpSales || 0) / scorecardData.metrics.invoices
                : 0,
              customerCount: scorecardData.metrics?.invoices || 0,
              // Map services - these might have branded names from the API
              premiumOilChange: scorecardData.services?.['Premium Oil Change'] || 0,
              standardOilChange: scorecardData.services?.['Oil Change'] || 0,
              conventionalOilChange: 0, // Not in current service list
              cabinAirFilter: scorecardData.services?.['Cabin Air Filter'] || 0,
              engineAirFilter: scorecardData.services?.['Engine Air Filter'] || 0,
              wiperBlades: 0, // Not in current service list
              coolantFlush: scorecardData.services?.['Coolant Flush'] || 0,
              brakeFluidFlush: scorecardData.services?.['Brake Flush'] || 0,
              transmissionFluidService: scorecardData.services?.['Transmission Fluid Service'] || 0,
              fuelAdditive: scorecardData.services?.['Fuel Additive'] || 0,
              powerSteeringFluidService: scorecardData.services?.['Power Steering Flush'] || 0,
              engineFlush: scorecardData.services?.['Engine Flush'] || 0,
              acVentService: 0, // Not in current service list
              alignment: scorecardData.services?.['Alignments'] || 0,
              tireRotation: 0, // Not in current service list
              battery: scorecardData.services?.['Battery'] || 0,
              lastUpdated: scorecardData.lastUpdated || new Date().toISOString()
            });
          } else {
            // If scorecard fetch fails, add empty scorecard but with store/market info
            const stores = user.store_assignments?.map(s => s.store_name).join(', ') || 'Pending Assignment';
            const markets = user.market_assignments?.map(m => m.market_name).join(', ') || 
                           user.store_assignments?.[0]?.market_name || 'TBD';
            
            advisorScorecards.push({
              id: user.user_id,
              employee: `${user.first_name} ${user.last_name}`,
              store: stores,
              marketId: markets,
              mappedUserId: user.user_id,
              mappedUserName: user.email,
              totalSales: 0,
              salesPerVehicle: 0,
              grossProfit: 0,
              grossProfitPercent: 0,
              grossProfitPerVehicle: 0,
              customerCount: 0,
              premiumOilChange: 0,
              standardOilChange: 0,
              conventionalOilChange: 0,
              cabinAirFilter: 0,
              engineAirFilter: 0,
              wiperBlades: 0,
              coolantFlush: 0,
              brakeFluidFlush: 0,
              transmissionFluidService: 0,
              fuelAdditive: 0,
              powerSteeringFluidService: 0,
              engineFlush: 0,
              acVentService: 0,
              alignment: 0,
              tireRotation: 0,
              battery: 0,
              lastUpdated: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error(`Error fetching scorecard for user ${user.user_id}:`, err);
        }
      }
      
      setAdvisors(advisorScorecards);
      setLoading(false);
    } catch (err) {
      console.error('Error loading advisor scorecards:', err);
      setError('Failed to load advisor scorecards');
      setAdvisors([]); // Show empty state instead of mock data
      setLoading(false);
    }
  };

  const getBrandedServiceName = (genericName: string, serviceMappings: Record<string, string>) => {
    return serviceMappings[genericName] || genericName;
  };

  const filterAdvisors = () => {
    let filtered = [...advisors];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(advisor =>
        advisor.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
        advisor.store.toLowerCase().includes(searchTerm.toLowerCase()) ||
        advisor.marketId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by store
    if (selectedStore) {
      filtered = filtered.filter(advisor => advisor.store === selectedStore);
    }

    // Filter by market
    if (selectedMarket) {
      filtered = filtered.filter(advisor => advisor.marketId === selectedMarket);
    }

    setFilteredAdvisors(filtered);
  };

  const getUniqueStores = () => {
    return Array.from(new Set(advisors.map(advisor => advisor.store))).sort();
  };

  const getUniqueMarkets = () => {
    return Array.from(new Set(advisors.map(advisor => advisor.marketId))).sort();
  };

  const handleRefresh = () => {
    loadAdvisors();
  };

  const handleSetGoal = async (metric: string, target: number, period: string) => {
    if (!selectedAdvisorForGoal?.mappedUserId) {
      throw new Error('Advisor must have a mapped user to set goals');
    }

    await goalsAPI.saveGoals({
      goalType: 'advisor',
      entityId: selectedAdvisorForGoal.mappedUserId,
      goals: { [metric]: target },
      effectiveDate: new Date().toISOString().split('T')[0],
      periodType: period
    });

    // Refresh advisor data to show updated goals
    loadAdvisors();
  };

  const handleOpenGoalModal = (advisor: AdvisorScorecardData) => {
    if (!advisor.mappedUserId) {
      alert('This advisor must be mapped to a user account before goals can be set.');
      return;
    }
    setSelectedAdvisorForGoal(advisor);
    setGoalModalOpen(true);
  };

  const canUserSetGoals = () => {
    return user?.permissions?.canSetGoals || 
           ['administrator', 'marketManager', 'storeManager', 'market_manager', 'store_manager'].includes(user?.role || '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <UserGroupIcon className="h-8 w-8 mr-2 text-blue-600" />
            Advisor Scorecards
          </h2>
          <p className="text-gray-600 mt-1">
            Performance metrics and service data for all advisors
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="btn btn-secondary flex items-center"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <FunnelIcon className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search advisors, stores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10 w-full"
            />
          </div>

          {/* Store Filter */}
          <div>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="form-input w-full"
            >
              <option value="">All Stores</option>
              {getUniqueStores().map(store => (
                <option key={store} value={store}>{store}</option>
              ))}
            </select>
          </div>

          {/* Market Filter */}
          <div>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="form-input w-full"
            >
              <option value="">All Markets</option>
              {getUniqueMarkets().map(market => (
                <option key={market} value={market}>Market {market}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredAdvisors.length} of {advisors.length} advisors
        </div>
      </div>

      {/* Scorecards */}
      {filteredAdvisors.length === 0 ? (
        <div className="text-center py-12">
          <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No advisors found</h3>
          <p className="text-gray-600">
            {advisors.length === 0 
              ? 'No advisor data available. Upload spreadsheet data to see scorecards.'
              : 'Try adjusting your filters to see more results.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredAdvisors.map((advisor) => (
            <AdvisorScorecard
              key={advisor.id}
              advisor={advisor}
              onMessageAdvisor={onMessageAdvisor}
              onSetGoals={handleOpenGoalModal}
              canSetGoals={canUserSetGoals()}
              className="border border-gray-200 rounded-lg p-6 bg-gray-50"
              serviceMappings={serviceMappings}
            />
          ))}
        </div>
      )}

      {/* Goal Setting Modal */}
      {selectedAdvisorForGoal && (
        <GoalSettingModal
          isOpen={goalModalOpen}
          onClose={() => {
            setGoalModalOpen(false);
            setSelectedAdvisorForGoal(null);
          }}
          advisor={selectedAdvisorForGoal}
          onSetGoal={handleSetGoal}
        />
      )}
    </div>
  );
};

export default AdvisorScorecards;