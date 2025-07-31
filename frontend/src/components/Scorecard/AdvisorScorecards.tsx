import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AdvisorScorecardData } from '../../types/scorecard';
import AdvisorScorecard from './AdvisorScorecard';
import GoalSettingModal from './GoalSettingModal';
import EditAdvisorModal from './EditAdvisorModal';
import AdvisorMappingModal from './AdvisorMappingModal';
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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAdvisorForEdit, setSelectedAdvisorForEdit] = useState<AdvisorScorecardData | null>(null);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [selectedAdvisorForMapping, setSelectedAdvisorForMapping] = useState<AdvisorScorecardData | null>(null);
  const [serviceMappings, setServiceMappings] = useState<Record<string, string>>({});

  // Removed mock data - now fetches from API

  useEffect(() => {
    loadAdvisors();
  }, [token]);

  useEffect(() => {
    filterAdvisors();
  }, [advisors, searchTerm, selectedStore, selectedMarket]);

  const fetchServiceMappings = async (marketId?: number) => {
    try {
      // Get market-specific mappings if marketId is provided
      const url = marketId 
        ? `${process.env.REACT_APP_API_URL}/api/vendor-mappings?market_id=${marketId}`
        : `${process.env.REACT_APP_API_URL}/api/vendor-mappings`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) return {};
      
      const data = await response.json();
      
      // Create a mapping object: service_field -> branded_name
      const mappings: Record<string, string> = {};
      console.log('Raw vendor mappings data:', data);
      (data.mappings || []).forEach((mapping: any) => {
        console.log('Processing mapping:', mapping);
        // Map both camelCase and space-separated versions
        mappings[mapping.service_field] = mapping.product_name;
        
        // Convert camelCase to space-separated for API compatibility
        const spaceSeparated = mapping.service_field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();
        mappings[spaceSeparated] = mapping.product_name;
      });
      
      console.log('Final service mappings:', mappings);
      return mappings;
    } catch (err) {
      console.error('Error fetching service mappings:', err);
      return {};
    }
  };

  // Helper function to map API services to frontend scorecard fields using template field keys
  const mapServicesToScorecard = (apiServices: Record<string, number>) => {
    console.log('🔍 FRONTEND DEBUG: Mapping API services to template field keys:', apiServices);
    
    // Map API service names to template field keys (lowercase, as used in the template)
    const serviceMapping = {
      // Core KPIs (these use exact field names)
      invoices: 0, // Will be set from metrics, not services
      sales: 0,    // Will be set from metrics, not services
      gpsales: 0,  // Will be set from metrics, not services
      gppercent: 0, // Will be set from metrics, not services
      
      // Fluid Services
      coolantflush: apiServices['Coolant Flush'] || 0,
      powersteeringflush: apiServices['Power Steering Flush'] || 0,
      transmissionfluidservice: apiServices['Transmission Fluid Service'] || 0,
      differentialservice: apiServices['Differential Service'] || 0,
      transfercaseservice: apiServices['Transfer Case Service'] || 0,
      
      // Tires & Related Services  
      alltires: apiServices['All Tires'] || 0,
      retailtires: apiServices['Retail Tires'] || 0,
      tireprotection: apiServices['Tire Protection'] || 0,
      tirebalance: apiServices['Tire Balance'] || 0,
      tirerotation: apiServices['Tire Rotation'] || 0,
      alignments: apiServices['Alignments'] || 0,
      tpms: apiServices['TPMS'] || 0,
      nitrogen: apiServices['Nitrogen'] || 0,
      
      // Filter Services
      engineairfilter: apiServices['Engine Air Filter'] || 0,
      cabinairfilter: apiServices['Cabin Air Filter'] || 0,
      
      // Fuel & Engine Services
      fuelsystemservice: apiServices['Fuel System Service'] || 0,
      fueladditive: apiServices['Fuel Additive'] || 0,
      engineperformanceservice: apiServices['Engine Performance Service'] || 
                               apiServices['BG EPR® Engine Performance Restoration®'] || 0,
      sparkplugreplacement: apiServices['Spark Plug Replacement'] || 0,
      timingbelt: apiServices['Timing Belt'] || 0,
      
      // Electrical & Battery
      battery: apiServices['Battery'] || 0,
      batteryservice: apiServices['Battery Service'] || 0,
      
      // Maintenance & Inspection
      wiperblades: apiServices['Wiper Blades'] || 0,
      completevehicleinspection: apiServices['Complete Vehicle Inspection'] || 0,
      beltsreplacement: apiServices['Belts Replacement'] || 0,
      hosereplacement: apiServices['Hose Replacement'] || 0,
      headlightrestorationservice: apiServices['Headlight Restoration Service'] || 0,
      
      // Suspension & Steering
      'shocks&struts': apiServices['Shocks & Struts'] || 0,
      
      // HVAC Services
      acservice: apiServices['AC Service'] || 0,
      climatecontrolservice: apiServices['Climate Control Service'] || 0,
      
      // Oil Changes (can be branded)
      premiumoilchange: apiServices['Premium Oil Change'] || 
                       apiServices['BG Advanced Formula MOA®'] || 
                       apiServices['Valvoline MaxLife®'] || 0,
      oilchange: apiServices['Oil Change'] || 0,
      
      // Brake Service
      brakeservice: apiServices['Brake Service'] || 0,
      brakeflush: apiServices['Brake Flush'] || 0
    };
    
    console.log('🔍 FRONTEND DEBUG: Mapped services to template keys:', serviceMapping);
    return serviceMapping;
  };

  const fetchAdvisorGoals = async (advisorId: string) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/goals/advisor/${advisorId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) return {};
      
      const goalsData = await response.json();
      
      // Convert goals array to object keyed by metric name
      const goalsObject: Record<string, { target: number; periodType: string; effectiveDate: string }> = {};
      
      goalsData.forEach((goal: any) => {
        goalsObject[goal.metricName] = {
          target: parseFloat(goal.targetValue),
          periodType: goal.periodType,
          effectiveDate: goal.effectiveDate
        };
      });
      
      return goalsObject;
    } catch (err) {
      console.error('Error fetching goals for advisor:', advisorId, err);
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
      console.log('🔍 DEBUGGING: Starting to fetch users...');
      console.log('API URL:', process.env.REACT_APP_API_URL);
      
      // Fetch users who have performance data (not just advisors)
      const mvpResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/users/with-performance-data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔍 DEBUGGING: Response status:', mvpResponse.status);
      
      // Process MVP users (these have performance data)
      const allUsers: CombinedUser[] = [];
      
      if (mvpResponse.ok) {
        const mvpData = await mvpResponse.json();
        console.log('🔍 DEBUGGING: Received data:', mvpData);
        console.log('🔍 DEBUGGING: Number of users:', Array.isArray(mvpData) ? mvpData.length : 'not array');
        
        const mvpUsers = Array.isArray(mvpData) ? mvpData : mvpData.users || [];
        console.log('🔍 DEBUGGING: Processing users:', mvpUsers.length);
        
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
      } else {
        const errorText = await mvpResponse.text();
        console.log('🔍 DEBUGGING: Error response:', mvpResponse.status, errorText);
        throw new Error(`Failed to fetch users: ${mvpResponse.status} ${errorText}`);
      }
      
      if (allUsers.length === 0) {
        console.log('🔍 DEBUGGING: No users found after processing');
        throw new Error('No employees with performance data found');
      }
      
      console.log('🔍 DEBUGGING: Final user count:', allUsers.length);
      console.log('🔍 DEBUGGING: Sample user:', allUsers[0]);
      
      // Get market-specific service mappings for branded names
      // Use market 694 (Tire South) as the primary market for mappings
      const fetchedServiceMappings = await fetchServiceMappings(694);
      setServiceMappings(fetchedServiceMappings);
      
      // Transform user data to scorecard format and fetch actual performance data
      const advisorScorecards: AdvisorScorecardData[] = [];
      
      // Fetch scorecard data for each advisor
      for (const user of allUsers) {
        try {
          console.log(`🔍 FRONTEND DEBUG: Fetching scorecard for user ${user.user_id} (${user.first_name} ${user.last_name})`);
          const scorecardResponse = await fetch(
            `${process.env.REACT_APP_API_URL}/api/scorecard/advisor/${user.user_id}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log(`🔍 FRONTEND DEBUG: Scorecard response for user ${user.user_id}: status ${scorecardResponse.status}`);
          
          if (scorecardResponse.ok) {
            const scorecardData = await scorecardResponse.json();
            console.log(`🔍 FRONTEND DEBUG: Scorecard data for user ${user.user_id}:`, scorecardData);
            
            // Extract store and market info from user assignments
            const stores = user.store_assignments?.map(s => s.store_name).join(', ') || 'Pending Assignment';
            const markets = user.market_assignments?.map(m => m.market_name).join(', ') || 
                           user.store_assignments?.[0]?.market_name || 'TBD';
            
            // Get numeric market ID for template loading
            const marketId = user.market_assignments?.[0]?.market_id || 
                            user.store_assignments?.[0]?.market_id || 
                            null;
            
            // Fetch goals for this advisor
            const advisorGoals = await fetchAdvisorGoals(user.user_id);
            
            // Map API services to frontend fields using helper function
            const mappedServices = mapServicesToScorecard(scorecardData.services || {});
            
            // Also map metrics to template field keys
            const salesPerVehicle = scorecardData.metrics?.invoices > 0 
              ? (scorecardData.metrics?.sales || 0) / scorecardData.metrics.invoices 
              : 0;
            
            advisorScorecards.push({
              id: user.user_id,
              employee: `${user.first_name} ${user.last_name}`,
              store: stores,
              marketId: marketId, // Now using numeric ID
              marketName: markets, // Keep the name for display
              mappedUserId: user.user_id,
              mappedUserName: user.email,
              
              // Legacy fields for backward compatibility
              totalSales: scorecardData.metrics?.sales || 0,
              salesPerVehicle: salesPerVehicle,
              grossProfit: scorecardData.metrics?.gpSales || 0,
              grossProfitPercent: parseFloat(scorecardData.metrics?.gpPercent || 0),
              grossProfitPerVehicle: scorecardData.metrics?.invoices > 0
                ? (scorecardData.metrics?.gpSales || 0) / scorecardData.metrics.invoices
                : 0,
              customerCount: scorecardData.metrics?.invoices || 0,
              
              // Template field keys for KPIs
              invoices: scorecardData.metrics?.invoices || 0,
              sales: scorecardData.metrics?.sales || 0,
              gpsales: scorecardData.metrics?.gpSales || 0,
              gppercent: parseFloat(scorecardData.metrics?.gpPercent || 0),
              'avg.spend': salesPerVehicle,
              
              // Use mapped services from helper function
              ...mappedServices,
              lastUpdated: scorecardData.lastUpdated || new Date().toISOString(),
              goals: advisorGoals,
              
              // Pass raw API services for branded name lookup
              rawApiServices: scorecardData.services || {}
            });
          } else {
            // If scorecard fetch fails, add empty scorecard but with store/market info
            const errorText = await scorecardResponse.text();
            console.log(`❌ FRONTEND DEBUG: Scorecard fetch failed for user ${user.user_id}: ${scorecardResponse.status} ${errorText}`);
            
            const stores = user.store_assignments?.map(s => s.store_name).join(', ') || 'Pending Assignment';
            const markets = user.market_assignments?.map(m => m.market_name).join(', ') || 
                           user.store_assignments?.[0]?.market_name || 'TBD';
            
            // Get numeric market ID for template loading
            const marketId = user.market_assignments?.[0]?.market_id || 
                            user.store_assignments?.[0]?.market_id || 
                            null;
            
            advisorScorecards.push({
              id: user.user_id,
              employee: `${user.first_name} ${user.last_name}`,
              store: stores,
              marketId: marketId, // Now using numeric ID
              marketName: markets, // Keep the name for display
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
              brakeService: 0,
              transmissionFluidService: 0,
              fuelAdditive: 0,
              fuelSystemService: 0,
              powerSteeringFluidService: 0,
              engineFlush: 0,
              acVentService: 0,
              alignment: 0,
              tireRotation: 0,
              battery: 0,
              differentialService: 0,
              allTires: 0,
              lastUpdated: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error(`❌ FRONTEND DEBUG: Error fetching scorecard for user ${user.user_id}:`, err);
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
        (advisor.marketName && advisor.marketName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by store
    if (selectedStore) {
      filtered = filtered.filter(advisor => advisor.store === selectedStore);
    }

    // Filter by market
    if (selectedMarket) {
      filtered = filtered.filter(advisor => advisor.marketName === selectedMarket);
    }

    setFilteredAdvisors(filtered);
  };

  const getUniqueStores = () => {
    return Array.from(new Set(advisors.map(advisor => advisor.store))).sort();
  };

  const getUniqueMarkets = () => {
    return Array.from(new Set(advisors.map(advisor => advisor.marketName).filter(Boolean))).sort();
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

  const canUserEditProfiles = () => {
    return ['administrator', 'admin'].includes(user?.role || '');
  };

  const handleEditProfile = (advisor: AdvisorScorecardData) => {
    if (!advisor.mappedUserId) {
      alert('This advisor must be mapped to a user account before editing the profile.');
      return;
    }
    setSelectedAdvisorForEdit(advisor);
    setEditModalOpen(true);
  };

  const handleMapAdvisor = (advisor: AdvisorScorecardData) => {
    setSelectedAdvisorForMapping(advisor);
    setMappingModalOpen(true);
  };

  const handleMapUser = async (userId: string, userName: string) => {
    if (!selectedAdvisorForMapping) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/advisor-mappings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          advisor_name: selectedAdvisorForMapping.employee,
          user_id: userId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to map advisor');
      }

      // Refresh advisor data to show updated mapping
      loadAdvisors();
    } catch (err) {
      console.error('Error mapping advisor:', err);
      alert(err instanceof Error ? err.message : 'Failed to map advisor to user');
    }
  };

  const handleCreateUser = async (advisorName: string) => {
    const nameParts = advisorName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
          role: 'advisor',
          status: 'active',
          password: 'temppass123'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      const newUser = await response.json();
      
      // Now map the advisor to the new user
      await handleMapUser(newUser.id, `${newUser.first_name} ${newUser.last_name}`);
    } catch (err) {
      console.error('Error creating user:', err);
      alert(err instanceof Error ? err.message : 'Failed to create user');
    }
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
            Employee Scorecards
          </h2>
          <p className="text-gray-600 mt-1">
            Performance metrics and service data for all employees with sales data
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
              placeholder="Search employees, stores..."
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
                <option key={market} value={market}>{market}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredAdvisors.length} of {advisors.length} employees with performance data
        </div>
      </div>

      {/* Scorecards */}
      {filteredAdvisors.length === 0 ? (
        <div className="text-center py-12">
          <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
          <p className="text-gray-600">
            {advisors.length === 0 
              ? 'No employee performance data available. Upload spreadsheet data to see scorecards.'
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
              onEditProfile={handleEditProfile}
              onMapAdvisor={handleMapAdvisor}
              canSetGoals={canUserSetGoals()}
              canEditProfile={canUserEditProfiles()}
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

      {/* Edit Profile Modal */}
      {selectedAdvisorForEdit && selectedAdvisorForEdit.mappedUserId && (
        <EditAdvisorModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedAdvisorForEdit(null);
          }}
          userId={selectedAdvisorForEdit.mappedUserId}
          onSave={() => {
            loadAdvisors(); // Refresh data after save
          }}
        />
      )}

      {/* Advisor Mapping Modal */}
      {selectedAdvisorForMapping && (
        <AdvisorMappingModal
          isOpen={mappingModalOpen}
          onClose={() => {
            setMappingModalOpen(false);
            setSelectedAdvisorForMapping(null);
          }}
          advisorName={selectedAdvisorForMapping.employee}
          advisorId={selectedAdvisorForMapping.id}
          currentMappedUserId={selectedAdvisorForMapping.mappedUserId}
          currentMappedUserName={selectedAdvisorForMapping.mappedUserName}
          onMapUser={handleMapUser}
          onCreateUser={handleCreateUser}
        />
      )}
    </div>
  );
};

export default AdvisorScorecards;