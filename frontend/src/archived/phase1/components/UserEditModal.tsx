import React, { useState, useEffect } from 'react';
import { Phase1User, phase1MarketsAPI, phase1StoresAPI, phase1UsersAPI } from '../../services/phase1-api';

interface UserEditModalProps {
  user: Phase1User;
  onSave: (userId: string, updates: any) => void;
  onClose: () => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    mobile: user.mobile || '',
    role: user.role,
    vendor: user.vendor || '',
    status: user.status,
    password: '',
    markets: [] as string[],
    stores: [] as string[]
  });
  
  const [availableMarkets, setAvailableMarkets] = useState<any[]>([]);
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadUserDetails();
  }, []);

  const loadUserDetails = async () => {
    try {
      setLoading(true);
      
      // Load user details with assignments
      const userDetails = await phase1UsersAPI.getUser(user.user_id);
      
      // Load available markets and stores
      const [marketsResponse, storesResponse] = await Promise.all([
        phase1MarketsAPI.getMarkets(),
        phase1StoresAPI.getStores()
      ]);
      
      setAvailableMarkets(marketsResponse.markets || []);
      setAvailableStores(storesResponse.stores || []);
      
      // Set assigned markets and stores
      const assignedMarkets = userDetails.market_assignments?.map((a: any) => a.id.toString()) || [];
      const assignedStores = userDetails.store_assignments?.map((a: any) => a.store_id) || [];
      
      // For advisors and store managers, derive markets from their store assignments
      if ((user.role === 'advisor' || user.role === 'store_manager') && assignedStores.length > 0) {
        const storeMarkets = new Set<string>();
        assignedStores.forEach((storeId: any) => {
          const store = storesResponse.stores?.find((s: any) => s.store_id === storeId);
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

    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';
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
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        mobile: formData.mobile,
        role: formData.role,
        status: formData.status,
        markets: formData.markets,
        stores: formData.stores
      };

      if (formData.role === 'vendor_partner') {
        updates.vendor = formData.vendor;
      }

      if (formData.password) {
        updates.password = formData.password;
      }

      onSave(user.user_id, updates);
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
          const store = availableStores.find((s: any) => s.store_id === sId);
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
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* User ID (read-only) */}
              <div>
                <label className="form-label">User ID</label>
                <input
                  type="text"
                  value={user.user_id}
                  disabled
                  className="form-input bg-gray-100"
                />
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">First Name</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className={`form-input ${errors.first_name ? 'border-red-500' : ''}`}
                  />
                  {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name}</p>}
                </div>
                <div>
                  <label className="form-label">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className={`form-input ${errors.last_name ? 'border-red-500' : ''}`}
                  />
                  {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name}</p>}
                </div>
              </div>

              {/* Email and Mobile */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`form-input ${errors.email ? 'border-red-500' : ''}`}
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="form-label">Mobile</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="form-input"
                    placeholder="+1-555-123-4567"
                  />
                </div>
              </div>

              {/* Password (optional) */}
              <div>
                <label className="form-label">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`form-input ${errors.password ? 'border-red-500' : ''}`}
                  placeholder="••••••••"
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="form-label">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="form-input"
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
                  <label className="form-label">Vendor</label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className={`form-input ${errors.vendor ? 'border-red-500' : ''}`}
                    placeholder="e.g., BG, NAPA, VALVOLINE"
                  />
                  {errors.vendor && <p className="text-red-500 text-sm mt-1">{errors.vendor}</p>}
                </div>
              )}

              {/* Status */}
              <div>
                <label className="form-label">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="form-input"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Market Assignments */}
              {(formData.role === 'market_manager' || formData.role === 'store_manager' || formData.role === 'advisor') && (
                <div>
                  <label className="form-label">Assigned Markets</label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                    {availableMarkets.length === 0 ? (
                      <p className="text-gray-500 text-sm">No markets available</p>
                    ) : (
                      <div className="space-y-2">
                        {availableMarkets.map(market => (
                          <label key={market.market_id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.markets.includes(market.market_id)}
                              onChange={() => toggleMarket(market.market_id)}
                              className="mr-2"
                              disabled={formData.role === 'advisor' || formData.role === 'store_manager'}
                            />
                            <span className="text-sm">{market.market_name}</span>
                            {market.vendor_tags && market.vendor_tags.length > 0 && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({market.vendor_tags.join(', ')})
                              </span>
                            )}
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
                  <label className="form-label">Assigned Stores</label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                    {availableStores.length === 0 ? (
                      <p className="text-gray-500 text-sm">No stores available</p>
                    ) : (
                      <div className="space-y-2">
                        {availableStores.map(store => (
                          <label key={store.store_id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.stores.includes(store.store_id)}
                              onChange={() => toggleStore(store.store_id)}
                              className="mr-2"
                            />
                            <span className="text-sm">
                              {store.store_name} ({store.market_name})
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
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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