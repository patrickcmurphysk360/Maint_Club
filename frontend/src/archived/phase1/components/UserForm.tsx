import React, { useState, useEffect } from 'react';
import { phase1MarketsAPI, phase1StoresAPI } from '../../services/phase1-api';

interface UserFormProps {
  onSubmit: (userData: any) => void;
  onCancel: () => void;
}

// Auto-generate unique user ID
const generateUserID = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `user_${timestamp}_${random}`;
};

const UserForm: React.FC<UserFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    user_id: generateUserID(), // Auto-generated
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    role: '',
    vendor: '',
    markets: [] as string[],
    stores: [] as string[]
  });
  
  const [availableMarkets, setAvailableMarkets] = useState<any[]>([]);
  const [availableStores, setAvailableStores] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMarkets();
    loadStores();
  }, []);

  const loadMarkets = async () => {
    try {
      const response = await phase1MarketsAPI.getMarkets();
      setAvailableMarkets(response.markets || []);
    } catch (error) {
      console.error('Error loading markets:', error);
    }
  };

  const loadStores = async () => {
    try {
      const response = await phase1StoresAPI.getStores();
      setAvailableStores(response.stores || []);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const regenerateUserId = () => {
    setFormData(prev => ({ ...prev, user_id: generateUserID() }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.user_id) newErrors.user_id = 'User ID is required';
    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!formData.role) newErrors.role = 'Role is required';
    if (formData.role === 'vendor_partner' && !formData.vendor) newErrors.vendor = 'Vendor is required for vendor partners';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const { confirmPassword, ...userData } = formData;
      onSubmit(userData);
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
    setFormData(prev => ({
      ...prev,
      stores: prev.stores.includes(storeId)
        ? prev.stores.filter(id => id !== storeId)
        : [...prev.stores, storeId]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* User ID - Auto-generated, read-only */}
      <div>
        <label className="form-label">User ID (Auto-generated)</label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={formData.user_id}
            readOnly
            className="form-input flex-1 bg-gray-100"
            placeholder="Auto-generated user ID"
          />
          <button
            type="button"
            onClick={regenerateUserId}
            className="btn btn-secondary"
          >
            Regenerate
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          User ID is automatically generated and used for internal linking
        </p>
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
            placeholder="John"
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
            placeholder="Doe"
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
            placeholder="john@example.com"
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>
        <div>
          <label className="form-label">Mobile (for SMS)</label>
          <input
            type="tel"
            value={formData.mobile}
            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            className="form-input"
            placeholder="+1-555-123-4567"
          />
          <p className="text-xs text-gray-500 mt-1">Used for SMS delivery</p>
        </div>
      </div>

      {/* Password */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Password</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className={`form-input ${errors.password ? 'border-red-500' : ''}`}
            placeholder="••••••••"
          />
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
        </div>
        
        <div>
          <label className="form-label">Confirm Password</label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className={`form-input ${errors.confirmPassword ? 'border-red-500' : ''}`}
            placeholder="••••••••"
          />
          {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
        </div>
      </div>

      {/* Role */}
      <div>
        <label className="form-label">Role</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className={`form-input ${errors.role ? 'border-red-500' : ''}`}
        >
          <option value="">Select a role</option>
          <option value="administrator">Administrator</option>
          <option value="market_manager">Market Manager</option>
          <option value="store_manager">Store Manager</option>
          <option value="advisor">Advisor</option>
          <option value="vendor_partner">Vendor Partner</option>
        </select>
        {errors.role && <p className="text-red-500 text-sm mt-1">{errors.role}</p>}
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
          <p className="text-sm text-gray-500 mt-1">
            Vendor partners automatically get access to markets tagged with their vendor
          </p>
        </div>
      )}

      {/* Market Assignments (for market managers only) */}
      {formData.role === 'market_manager' && (
        <div>
          <label className="form-label">Assign Markets</label>
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
        </div>
      )}

      {/* Store Assignments (for store managers and advisors) */}
      {(formData.role === 'store_manager' || formData.role === 'advisor') && (
        <div>
          <label className="form-label">Assign Stores</label>
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
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
        >
          Create User
        </button>
      </div>
    </form>
  );
};

export default UserForm;