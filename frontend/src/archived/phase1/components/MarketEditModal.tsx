import React, { useState, useEffect } from 'react';
import { Market, phase1MarketsAPI, phase1UsersAPI, phase1StoresAPI, Phase1User } from '../../services/phase1-api';
import { 
  BuildingOffice2Icon,
  UserGroupIcon,
  UserIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

interface MarketEditModalProps {
  market: Market;
  onSave: (marketId: string, updates: any) => void;
  onClose: () => void;
}

interface StoreWithUsers {
  store_id: string;
  store_name: string;
  city?: string;
  state?: string;
  users: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  }[];
}

const MarketEditModal: React.FC<MarketEditModalProps> = ({ market, onSave, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    market_name: market.market_name,
    description: market.description || '',
    city: market.city || '',
    state: market.state || '',
    zip: market.zip || '',
    vendor_tags: market.vendor_tags || [],
    market_managers: [] as string[]
  });
  
  const [stores, setStores] = useState<StoreWithUsers[]>([]);
  const [availableMarketManagers, setAvailableMarketManagers] = useState<Phase1User[]>([]);
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMarketDetails();
  }, []);

  const loadMarketDetails = async () => {
    try {
      setLoading(true);
      
      // Load market managers
      const managersResponse = await phase1UsersAPI.getUsers({ role: 'market_manager' });
      setAvailableMarketManagers(managersResponse.users || []);
      
      // Load stores for this market
      const storesResponse = await phase1StoresAPI.getStores({ market_id: market.market_id });
      const marketStores = storesResponse.stores || [];
      
      // Load users for each store
      const storesWithUsers: StoreWithUsers[] = [];
      for (const store of marketStores) {
        // Get users assigned to this store
        const usersResponse = await phase1UsersAPI.getUsers();
        const allUsers = usersResponse.users || [];
        
        // Filter users who are assigned to this store
        const storeUsers: Phase1User[] = allUsers.filter((user: Phase1User) => 
          user.assigned_stores?.some((s: any) => s.store_id === store.store_id)
        );
        
        storesWithUsers.push({
          store_id: store.store_id,
          store_name: store.store_name,
          city: store.city,
          state: store.state,
          users: storeUsers.map((u: Phase1User) => ({
            user_id: u.user_id,
            first_name: u.first_name,
            last_name: u.last_name,
            email: u.email,
            role: u.role
          }))
        });
      }
      
      setStores(storesWithUsers);
      
      // Get current market managers
      const currentManagers = managersResponse.users
        .filter((u: Phase1User) => u.assigned_markets?.some((m: any) => m.market_id === market.market_id))
        .map((u: Phase1User) => u.user_id);
      
      setFormData(prev => ({
        ...prev,
        market_managers: currentManagers
      }));
      
    } catch (error) {
      console.error('Error loading market details:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStore = (storeId: string) => {
    setExpandedStores(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storeId)) {
        newSet.delete(storeId);
      } else {
        newSet.add(storeId);
      }
      return newSet;
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.market_name) newErrors.market_name = 'Market name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const updates = {
      market_name: formData.market_name,
      description: formData.description,
      city: formData.city,
      state: formData.state,
      zip: formData.zip,
      vendor_tags: formData.vendor_tags,
      market_managers: formData.market_managers
    };

    onSave(market.market_id, updates);
  };

  const toggleMarketManager = (managerId: string) => {
    setFormData(prev => ({
      ...prev,
      market_managers: prev.market_managers.includes(managerId)
        ? prev.market_managers.filter(id => id !== managerId)
        : [...prev.market_managers, managerId]
    }));
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'administrator': return 'bg-red-100 text-red-800';
      case 'market_manager': return 'bg-blue-100 text-blue-800';
      case 'store_manager': return 'bg-green-100 text-green-800';
      case 'advisor': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRole = (role: string) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Edit Market: {market.market_name}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Basic Information</h4>
                
                <div>
                  <label className="form-label">Market Name</label>
                  <input
                    type="text"
                    value={formData.market_name}
                    onChange={(e) => setFormData({ ...formData, market_name: e.target.value })}
                    className={`form-input ${errors.market_name ? 'border-red-500' : ''}`}
                  />
                  {errors.market_name && <p className="text-red-500 text-sm mt-1">{errors.market_name}</p>}
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="form-input"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      className="form-input"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="form-label">ZIP Code</label>
                    <input
                      type="text"
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              {/* Market Managers */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Market Managers</h4>
                <p className="text-sm text-gray-600">Select all managers responsible for this market</p>
                
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                  {availableMarketManagers.length === 0 ? (
                    <p className="text-gray-500 text-sm">No market managers available</p>
                  ) : (
                    <div className="space-y-2">
                      {availableMarketManagers.map(manager => (
                        <label key={manager.user_id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.market_managers.includes(manager.user_id)}
                            onChange={() => toggleMarketManager(manager.user_id)}
                            className="mr-3"
                          />
                          <span className="text-sm">
                            {manager.first_name} {manager.last_name}
                            <span className="text-gray-500 ml-2">({manager.email})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Stores and Users */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900 flex items-center">
                  <BuildingOffice2Icon className="h-5 w-5 mr-2" />
                  Stores & Users ({stores.length} stores)
                </h4>
                
                <div className="space-y-2">
                  {stores.length === 0 ? (
                    <p className="text-gray-500 text-sm">No stores in this market</p>
                  ) : (
                    stores.map(store => (
                      <div key={store.store_id} className="border rounded-lg">
                        <button
                          type="button"
                          onClick={() => toggleStore(store.store_id)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                        >
                          <div className="flex items-center">
                            {expandedStores.has(store.store_id) ? (
                              <ChevronDownIcon className="h-5 w-5 mr-2 text-gray-400" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5 mr-2 text-gray-400" />
                            )}
                            <BuildingOffice2Icon className="h-5 w-5 mr-2 text-gray-500" />
                            <span className="font-medium">{store.store_name}</span>
                            {(store.city || store.state) && (
                              <span className="text-gray-500 ml-2">
                                ({[store.city, store.state].filter(Boolean).join(', ')})
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">
                            {store.users.length} users
                          </span>
                        </button>
                        
                        {expandedStores.has(store.store_id) && (
                          <div className="px-4 pb-3 border-t">
                            {store.users.length === 0 ? (
                              <p className="text-gray-500 text-sm py-2">No users assigned to this store</p>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {store.users.map(user => (
                                  <div key={user.user_id} className="flex items-center py-2">
                                    <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
                                    <div className="flex-1">
                                      <span className="text-sm font-medium">
                                        {user.first_name} {user.last_name}
                                      </span>
                                      <span className="text-gray-500 text-sm ml-2">
                                        {user.email}
                                      </span>
                                    </div>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                      {formatRole(user.role)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarketEditModal;