import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  UserIcon
} from '@heroicons/react/24/outline';

interface DiscoveredMarket {
  name: string;
  source: string;
  spreadsheetMarket: string;
  // Intelligent matching fields
  action?: string;
  existing_id?: number;
  proposed_id?: string;
  suggestedMatch?: any;
  matchScore?: number;
}

interface DiscoveredStore {
  name: string;
  market: string;
  source: string;
  spreadsheetStore: string;
  // Intelligent matching fields
  action?: string;
  existing_id?: number;
  proposed_id?: string;
  suggestedMatch?: any;
  matchScore?: number;
}

interface DiscoveredAdvisor {
  name: string;
  market: string;
  store: string;
  source: string;
  spreadsheetName: string;
  hasData: boolean;
  // Intelligent matching fields
  action?: string;
  existing_user_id?: number;
  proposed_user_id?: string;
  proposed_first_name?: string;
  proposed_last_name?: string;
  proposed_email?: string;
  suggestedMatch?: any;
  matchScore?: number;
}

interface ExistingMarket {
  id: string;
  name: string;
}

interface ExistingStore {
  store_id: string;
  name: string;
  market_id: string;
}

interface ExistingUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface UploadSession {
  sessionId: string;
  fileInfo: {
    format: string;
    marketId: string;
    market: string;
    type: string;
  };
  discovered: {
    markets: DiscoveredMarket[];
    stores: DiscoveredStore[];
    advisors: DiscoveredAdvisor[];
  };
  existing: {
    markets: ExistingMarket[];
    stores: ExistingStore[];
    users?: ExistingUser[];
  };
  summary: {
    employees?: number;
    marketsFound: number;
    storesFound: number;
    advisorsFound?: number;
  };
}

interface UploadConfirmationProps {
  session: UploadSession | null;
  onConfirm: (confirmationData: any) => void;
  onCancel: () => void;
  loading: boolean;
}

const UploadConfirmation: React.FC<UploadConfirmationProps> = ({ 
  session, 
  onConfirm, 
  onCancel, 
  loading 
}) => {
  const [marketMappings, setMarketMappings] = useState<Record<string, any>>({});
  const [storeMappings, setStoreMappings] = useState<Record<string, any>>({});
  const [advisorMappings, setAdvisorMappings] = useState<Record<string, any>>({});

  useEffect(() => {
    if (session) {
      // Initialize mappings with default actions
      const initialMarketMappings: Record<string, any> = {};
      session.discovered.markets.forEach(market => {
        // Use backend's intelligent matching suggestions
        initialMarketMappings[market.name] = {
          action: market.action || 'create',
          existing_id: market.existing_id,
          proposed_id: market.proposed_id || market.name.toLowerCase().replace(/\s+/g, '_'),
          name: market.name
        };
      });
      setMarketMappings(initialMarketMappings);

      const initialStoreMappings: Record<string, any> = {};
      session.discovered.stores.forEach(store => {
        const storeKey = `${store.market}:${store.name}`;
        
        // Use backend's intelligent matching suggestions
        initialStoreMappings[storeKey] = {
          action: store.action || 'create',
          existing_id: store.existing_id,
          proposed_id: store.proposed_id || store.name.toLowerCase().replace(/\s+/g, '_'),
          name: store.name,
          market: store.market
        };
      });
      setStoreMappings(initialStoreMappings);

      if (session.discovered.advisors) {
        const initialAdvisorMappings: Record<string, any> = {};
        session.discovered.advisors.forEach(advisor => {
          const nameParts = advisor.name.split(' ');
          
          // Use backend's intelligent matching suggestions
          initialAdvisorMappings[advisor.name] = {
            action: advisor.action || 'create_user',
            existing_user_id: advisor.existing_user_id,
            proposed_user_id: advisor.proposed_user_id || `advisor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            proposed_first_name: advisor.proposed_first_name || nameParts[0] || '',
            proposed_last_name: advisor.proposed_last_name || nameParts.slice(1).join(' ') || '',
            proposed_email: advisor.proposed_email || `${advisor.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            name: advisor.name,
            market: advisor.market,
            store: advisor.store
          };
        });
        setAdvisorMappings(initialAdvisorMappings);
      }
    }
  }, [session]);

  const handleMarketMappingChange = (marketName: string, field: string, value: any) => {
    setMarketMappings(prev => ({
      ...prev,
      [marketName]: {
        ...prev[marketName],
        [field]: value
      }
    }));
  };

  const handleStoreMappingChange = (storeKey: string, field: string, value: any) => {
    setStoreMappings(prev => ({
      ...prev,
      [storeKey]: {
        ...prev[storeKey],
        [field]: value
      }
    }));
  };

  const handleAdvisorMappingChange = (advisorName: string, field: string, value: any) => {
    setAdvisorMappings(prev => ({
      ...prev,
      [advisorName]: {
        ...prev[advisorName],
        [field]: value
      }
    }));
  };

  const autoAcceptHighConfidenceMatches = () => {
    // Count auto-matched items
    const marketMatches = Object.values(marketMappings).filter(m => m.action === 'map').length;
    const storeMatches = Object.values(storeMappings).filter(s => s.action === 'map').length;
    const advisorMatches = Object.values(advisorMappings).filter(a => a.action === 'map_user').length;
    
    console.log(`🎯 Auto-matched: ${marketMatches} markets, ${storeMatches} stores, ${advisorMatches} advisors`);
    
    // If most items are auto-matched, proceed directly
    if (marketMatches + storeMatches + advisorMatches > 0) {
      handleConfirm();
    }
  };

  const handleConfirm = () => {
    const confirmationData = {
      markets: Object.values(marketMappings),
      stores: Object.values(storeMappings),
      advisors: session?.discovered.advisors ? Object.values(advisorMappings) : []
    };
    
    onConfirm(confirmationData);
  };

  if (!session) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                <DocumentArrowUpIcon className="h-6 w-6 mr-2 text-blue-600" />
                Confirm Upload Processing
              </h3>
              <p className="text-gray-600 mt-1">
                Review and confirm how to handle discovered markets, stores, and advisors
              </p>
            </div>
            <div className="text-sm text-gray-500">
              <div><strong>File:</strong> {session.fileInfo.type}</div>
              <div><strong>Market:</strong> {session.fileInfo.market}</div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <BuildingOffice2Icon className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <div className="text-2xl font-bold text-blue-900">{session.summary.marketsFound}</div>
                  <div className="text-sm text-blue-600">Markets Found</div>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <BuildingStorefrontIcon className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <div className="text-2xl font-bold text-green-900">{session.summary.storesFound}</div>
                  <div className="text-sm text-green-600">Stores Found</div>
                </div>
              </div>
            </div>
            
            {session.summary.advisorsFound !== undefined && (
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center">
                  <UserIcon className="h-8 w-8 text-purple-600" />
                  <div className="ml-3">
                    <div className="text-2xl font-bold text-purple-900">{session.summary.advisorsFound}</div>
                    <div className="text-sm text-purple-600">Advisors Found</div>
                  </div>
                </div>
              </div>
            )}
            
            {session.summary.employees !== undefined && (
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex items-center">
                  <DocumentArrowUpIcon className="h-8 w-8 text-orange-600" />
                  <div className="ml-3">
                    <div className="text-2xl font-bold text-orange-900">{session.summary.employees}</div>
                    <div className="text-sm text-orange-600">Data Records</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8">
            {/* Markets Section */}
            {session.discovered.markets.length > 0 && (
              <div className="border rounded-lg p-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center">
                  <BuildingOffice2Icon className="h-5 w-5 mr-2 text-blue-600" />
                  Markets ({session.discovered.markets.length})
                </h4>
                <div className="space-y-4">
                  {session.discovered.markets.map((market, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium">{market.name}</div>
                          <div className="text-sm text-gray-500">Source: {market.source}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                          <select
                            value={marketMappings[market.name]?.action || 'create'}
                            onChange={(e) => handleMarketMappingChange(market.name, 'action', e.target.value)}
                            className="form-input w-full"
                          >
                            <option value="create">Create New Market</option>
                            <option value="map">Map to Existing Market</option>
                            <option value="ignore">Ignore</option>
                          </select>
                        </div>
                        
                        {marketMappings[market.name]?.action === 'map' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Existing Market</label>
                            <select
                              value={marketMappings[market.name]?.existing_id || ''}
                              onChange={(e) => handleMarketMappingChange(market.name, 'existing_id', e.target.value)}
                              className="form-input w-full"
                            >
                              <option value="">Select existing market...</option>
                              {session.existing.markets.map(existing => (
                                <option key={existing.id} value={existing.id}>
                                  {existing.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        {marketMappings[market.name]?.action === 'create' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Market ID</label>
                            <input
                              type="text"
                              value={marketMappings[market.name]?.proposed_id || ''}
                              onChange={(e) => handleMarketMappingChange(market.name, 'proposed_id', e.target.value)}
                              className="form-input w-full"
                              placeholder="market_id"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stores Section */}
            {session.discovered.stores.length > 0 && (
              <div className="border rounded-lg p-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center">
                  <BuildingStorefrontIcon className="h-5 w-5 mr-2 text-green-600" />
                  Stores ({session.discovered.stores.length})
                </h4>
                <div className="space-y-4">
                  {session.discovered.stores.map((store, index) => {
                    const storeKey = `${store.market}:${store.name}`;
                    return (
                      <div key={index} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-medium">{store.name}</div>
                            <div className="text-sm text-gray-500">Market: {store.market} | Source: {store.source}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                            <select
                              value={storeMappings[storeKey]?.action || 'create'}
                              onChange={(e) => handleStoreMappingChange(storeKey, 'action', e.target.value)}
                              className="form-input w-full"
                            >
                              <option value="create">Create New Store</option>
                              <option value="map">Map to Existing Store</option>
                              <option value="ignore">Ignore</option>
                            </select>
                          </div>
                          
                          {storeMappings[storeKey]?.action === 'map' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Existing Store</label>
                              <select
                                value={storeMappings[storeKey]?.existing_id || ''}
                                onChange={(e) => handleStoreMappingChange(storeKey, 'existing_id', e.target.value)}
                                className="form-input w-full"
                              >
                                <option value="">Select existing store...</option>
                                {session.existing.stores.map(existing => (
                                  <option key={existing.store_id} value={existing.store_id}>
                                    {existing.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          {storeMappings[storeKey]?.action === 'create' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">New Store ID</label>
                              <input
                                type="text"
                                value={storeMappings[storeKey]?.proposed_id || ''}
                                onChange={(e) => handleStoreMappingChange(storeKey, 'proposed_id', e.target.value)}
                                className="form-input w-full"
                                placeholder="store_id"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Advisors Section - Only for services files */}
            {session.discovered.advisors && session.discovered.advisors.length > 0 && (
              <div className="border rounded-lg p-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center">
                  <UserIcon className="h-5 w-5 mr-2 text-purple-600" />
                  Advisors ({session.discovered.advisors.length})
                </h4>
                <div className="space-y-4">
                  {session.discovered.advisors.map((advisor, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium">{advisor.name}</div>
                          <div className="text-sm text-gray-500">
                            {advisor.store} ({advisor.market})
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                          <select
                            value={advisorMappings[advisor.name]?.action || 'create_user'}
                            onChange={(e) => handleAdvisorMappingChange(advisor.name, 'action', e.target.value)}
                            className="form-input w-full"
                          >
                            <option value="create_user">Create New User</option>
                            <option value="map_user">Map to Existing User</option>
                            <option value="ignore">Ignore</option>
                          </select>
                        </div>
                        
                        {advisorMappings[advisor.name]?.action === 'map_user' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Existing User</label>
                            <select
                              value={advisorMappings[advisor.name]?.existing_user_id || ''}
                              onChange={(e) => handleAdvisorMappingChange(advisor.name, 'existing_user_id', e.target.value)}
                              className="form-input w-full"
                            >
                              <option value="">Select existing user...</option>
                              {session.existing.users?.map(existing => (
                                <option key={existing.user_id} value={existing.user_id}>
                                  {existing.first_name} {existing.last_name} ({existing.email})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        {advisorMappings[advisor.name]?.action === 'create_user' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                              <input
                                type="text"
                                value={advisorMappings[advisor.name]?.proposed_first_name || ''}
                                onChange={(e) => handleAdvisorMappingChange(advisor.name, 'proposed_first_name', e.target.value)}
                                className="form-input w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                              <input
                                type="text"
                                value={advisorMappings[advisor.name]?.proposed_last_name || ''}
                                onChange={(e) => handleAdvisorMappingChange(advisor.name, 'proposed_last_name', e.target.value)}
                                className="form-input w-full"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                              <input
                                type="email"
                                value={advisorMappings[advisor.name]?.proposed_email || ''}
                                onChange={(e) => handleAdvisorMappingChange(advisor.name, 'proposed_email', e.target.value)}
                                className="form-input w-full"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              onClick={autoAcceptHighConfidenceMatches}
              className="btn bg-green-600 hover:bg-green-700 text-white"
              disabled={loading}
            >
              🎯 Auto-Accept Matches
            </button>
            <button
              onClick={onCancel}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Confirm & Process'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadConfirmation;