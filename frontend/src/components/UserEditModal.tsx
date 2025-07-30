import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  mobile?: string;
  vendor?: string;
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

interface UserEditModalProps {
  user: User;
  onSave: (userId: number, updates: any) => void;
  onClose: () => void;
}

interface Market {
  id: number;
  market_id: string;
  market_name: string;
  name: string;
}

interface Store {
  id: number;
  name: string;
  market_id: number;
  market_name: string;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile || '',
    role: user.role,
    vendor: user.vendor || '',
    status: user.status,
    password: '',
    markets: [] as string[],
    stores: [] as string[]
  });
  
  const [availableMarkets, setAvailableMarkets] = useState<Market[]>([]);
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadUserDetails();
  }, []);

  const loadUserDetails = async () => {
    try {
      setLoading(true);
      
      // Load available markets and stores
      const [marketsResponse, storesResponse] = await Promise.all([
        api.get('/markets'),
        api.get('/stores')
      ]);
      
      setAvailableMarkets(marketsResponse.data.markets || []);
      setAvailableStores(storesResponse.data || []);
      
      // Set current assignments
      const assignedMarkets = user.market_assignments?.map(a => a.market_id.toString()) || [];
      const assignedStores = user.store_assignments?.map(a => a.store_id.toString()) || [];
      
      // For advisors and store managers, derive markets from their store assignments
      if ((user.role === 'advisor' || user.role === 'store_manager') && assignedStores.length > 0) {
        const storeMarkets = new Set<string>();
        assignedStores.forEach(storeId => {
          const store = storesResponse.data?.find((s: Store) => s.id.toString() === storeId);
          if (store && store.market_id) {
            storeMarkets.add(store.market_id.toString());
          }
        });
        setFormData(prev => ({
          ...prev,
          markets: Array.from(storeMarkets),
          stores: assignedStores
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          markets: assignedMarkets,
          stores: assignedStores
        }));
      }
      
    } catch (error) {
      console.error('Error loading user details:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (formData.role === 'vendor_partner' && !formData.vendor) newErrors.vendor = 'Vendor is required for vendor partners';
    if (formData.password && formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const updates: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        mobile: formData.mobile,
        role: formData.role,
        status: formData.status,
        markets: formData.markets.map(id => parseInt(id)),
        stores: formData.stores.map(id => parseInt(id))
      };

      if (formData.role === 'vendor_partner') {
        updates.vendor = formData.vendor;
      }

      if (formData.password) {
        updates.password = formData.password;
      }

      onSave(user.id, updates);
    }
  };

  const toggleMarket = (marketId: string) => {
    setFormData(prev => ({
      ...prev,
      markets: prev.markets.includes(marketId)
        ? prev.markets.filter(id => id !== marketId)
        : [...prev.markets, marketId]
    }));
  };

  const toggleStore = (storeId: string) => {
    setFormData(prev => {
      const newStores = prev.stores.includes(storeId)
        ? prev.stores.filter(id => id !== storeId)
        : [...prev.stores, storeId];
      
      // For advisors and store managers, update markets based on selected stores
      if (formData.role === 'advisor' || formData.role === 'store_manager') {
        const storeMarkets = new Set<string>();
        newStores.forEach(sId => {
          const store = availableStores.find(s => s.id.toString() === sId);
          if (store && store.market_id) {
            storeMarkets.add(store.market_id.toString());
          }
        });
        
        return {
          ...prev,
          stores: newStores,
          markets: Array.from(storeMarkets)
        };
      }
      
      return {
        ...prev,
        stores: newStores
      };
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Edit User</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* User ID (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <input
                  type="text"
                  value={user.id}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 focus:outline-none"
                />
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
                </div>
              </div>

              {/* Email and Mobile */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+1-555-123-4567"
                  />
                </div>
              </div>

              {/* Password (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="••••••••"
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="administrator">Administrator</option>
                  <option value="market_manager">Market Manager</option>
                  <option value="store_manager">Store Manager</option>
                  <option value="advisor">Advisor</option>
                  <option value="vendor_partner">Vendor Partner</option>
                </select>
              </div>

              {/* Vendor (for vendor partners) */}
              {formData.role === 'vendor_partner' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.vendor ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="e.g., BG, NAPA, VALVOLINE"
                  />
                  {errors.vendor && <p className="text-red-500 text-sm mt-1">{errors.vendor}</p>}
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Market Assignments */}
              {(formData.role === 'market_manager' || formData.role === 'store_manager' || formData.role === 'advisor') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Markets</label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                    {availableMarkets.length === 0 ? (
                      <p className="text-gray-500 text-sm">No markets available</p>
                    ) : (
                      <div className="space-y-2">
                        {availableMarkets.map(market => (
                          <label key={market.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.markets.includes(market.id.toString())}
                              onChange={() => toggleMarket(market.id.toString())}
                              className="mr-2"
                              disabled={formData.role === 'advisor' || formData.role === 'store_manager'}
                            />
                            <span className="text-sm">{market.market_name || market.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {(formData.role === 'store_manager' || formData.role === 'advisor') && (
                    <p className="text-xs text-gray-500 mt-1">Markets are automatically assigned based on store selection</p>
                  )}
                </div>
              )}

              {/* Store Assignments */}
              {(formData.role === 'store_manager' || formData.role === 'advisor') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Stores</label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                    {availableStores.length === 0 ? (
                      <p className="text-gray-500 text-sm">No stores available</p>
                    ) : (
                      <div className="space-y-2">
                        {availableStores.map(store => (
                          <label key={store.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.stores.includes(store.id.toString())}
                              onChange={() => toggleStore(store.id.toString())}
                              className="mr-2"
                            />
                            <span className="text-sm">
                              {store.name} ({store.market_name})
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserEditModal;