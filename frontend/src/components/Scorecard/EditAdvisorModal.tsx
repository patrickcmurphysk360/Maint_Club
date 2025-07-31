import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  UserIcon,
  EnvelopeIcon,
  BuildingStorefrontIcon,
  MapPinIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface Store {
  id: number;
  name: string;
}

interface Market {
  id: number;
  name: string;
}

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  role: string;
  store_assignments?: Array<{
    store_id: number;
    store_name: string;
  }>;
  market_assignments?: Array<{
    market_id: number;
    market_name: string;
  }>;
}

interface EditAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSave: () => void;
}

const EditAdvisorModal: React.FC<EditAdvisorModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSave
}) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [availableStores, setAvailableStores] = useState<Store[]>([]);
  const [availableMarkets, setAvailableMarkets] = useState<Market[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    status: 'active',
    role: 'advisor',
    store_assignments: [] as number[],
    market_assignments: [] as number[]
  });

  useEffect(() => {
    if (isOpen && userId) {
      loadUserProfile();
      loadStoresAndMarkets();
    }
  }, [isOpen, userId]);

  const loadUserProfile = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load user profile');
      }

      const userData = await response.json();
      setUser(userData);
      
      // Set form data
      setFormData({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        status: userData.status || 'active',
        role: userData.role || 'advisor',
        store_assignments: userData.store_assignments?.map((s: any) => s.store_id) || [],
        market_assignments: userData.market_assignments?.map((m: any) => m.market_id) || []
      });
    } catch (err) {
      console.error('Error loading user profile:', err);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const loadStoresAndMarkets = async () => {
    try {
      // Load stores
      const storesResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/stores`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (storesResponse.ok) {
        const storesData = await storesResponse.json();
        setAvailableStores(storesData.stores || storesData || []);
      }

      // Load markets
      const marketsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/markets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (marketsResponse.ok) {
        const marketsData = await marketsResponse.json();
        setAvailableMarkets(marketsData.markets || marketsData || []);
      }
    } catch (err) {
      console.error('Error loading stores and markets:', err);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStoreAssignmentChange = (storeId: number, isAssigned: boolean) => {
    setFormData(prev => ({
      ...prev,
      store_assignments: isAssigned
        ? [...prev.store_assignments, storeId]
        : prev.store_assignments.filter(id => id !== storeId)
    }));
  };

  const handleMarketAssignmentChange = (marketId: number, isAssigned: boolean) => {
    setFormData(prev => ({
      ...prev,
      market_assignments: isAssigned
        ? [...prev.market_assignments, marketId]
        : prev.market_assignments.filter(id => id !== marketId)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user profile');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <UserIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Edit Advisor Profile</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    className="form-input w-full"
                    placeholder="First name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    className="form-input w-full"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <EnvelopeIcon className="h-4 w-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="form-input w-full"
                  placeholder="email@example.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="form-select w-full"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleInputChange('role', e.target.value)}
                    className="form-select w-full"
                  >
                    <option value="advisor">Advisor</option>
                    <option value="store_manager">Store Manager</option>
                    <option value="market_manager">Market Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Store Assignments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <BuildingStorefrontIcon className="h-4 w-4 inline mr-1" />
                  Store Assignments
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {availableStores.map(store => (
                    <label key={store.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.store_assignments.includes(store.id)}
                        onChange={(e) => handleStoreAssignmentChange(store.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{store.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Market Assignments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <MapPinIcon className="h-4 w-4 inline mr-1" />
                  Market Assignments
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {availableMarkets.map(market => (
                    <label key={market.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.market_assignments.includes(market.id)}
                        onChange={(e) => handleMarketAssignmentChange(market.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{market.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="btn btn-primary flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditAdvisorModal;