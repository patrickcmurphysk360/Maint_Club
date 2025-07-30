import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  BuildingOffice2Icon,
  UserGroupIcon,
  UserIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';

interface Market {
  id: number;
  market_id: string;
  market_name: string;
  name: string;
  description?: string;
  city?: string;
  state?: string;
  zip?: string;
  contact_market_manager_id?: string;
  vendor_tags: string[];
  vendor_tag_details: {
    id: string;
    name: string;
    color?: string;
  }[];
  store_count: number;
  created_at: string;
  contact_market_manager?: {
    first_name: string;
    last_name: string;
  };
}

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
    id: string;
    user_id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  }[];
}

interface MarketManager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
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
    contact_market_manager_id: market.contact_market_manager_id || ''
  });
  
  const [stores, setStores] = useState<StoreWithUsers[]>([]);
  const [availableMarketManagers, setAvailableMarketManagers] = useState<MarketManager[]>([]);
  const [availableVendorTags, setAvailableVendorTags] = useState<{id: string, name: string, color?: string}[]>([]);
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMarketDetails();
  }, []);

  const loadMarketDetails = async () => {
    try {
      setLoading(true);
      
      // Load market managers
      const managersResponse = await api.get('/users?role=market_manager');
      setAvailableMarketManagers(managersResponse.data || []);
      
      // Load vendor tags
      const vendorTagsResponse = await api.get('/vendor/tags');
      setAvailableVendorTags(vendorTagsResponse.data || []);
      
      // Load detailed market info with stores and users
      console.log('Loading market details for ID:', market.id);
      const marketResponse = await api.get(`/markets/${market.id}`);
      const marketData = marketResponse.data;
      
      console.log('Market data received:', marketData);
      console.log('Stores from API:', marketData.stores);
      console.log('Stores count:', marketData.stores?.length || 0);
      
      setStores(marketData.stores || []);
      
    } catch (error) {
      console.error('Error loading market details:', error);
      console.error('Error details:', error.response?.data || error.message);
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
      contact_market_manager_id: formData.contact_market_manager_id || null
    };

    onSave(market.market_id, updates);
  };

  const toggleVendorTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      vendor_tags: prev.vendor_tags.includes(tagId)
        ? prev.vendor_tags.filter(id => id !== tagId)
        : [...prev.vendor_tags, tagId]
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Basic Information</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market Name *</label>
                  <input
                    type="text"
                    value={formData.market_name}
                    onChange={(e) => setFormData({ ...formData, market_name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.market_name ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.market_name && <p className="text-red-500 text-sm mt-1">{errors.market_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Market Manager */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Contact Market Manager</h4>
                <div>
                  <select
                    value={formData.contact_market_manager_id}
                    onChange={(e) => setFormData({ ...formData, contact_market_manager_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a market manager...</option>
                    {availableMarketManagers.map(manager => (
                      <option key={manager.id} value={manager.id}>
                        {manager.firstName} {manager.lastName} - {manager.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vendor Tags */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Vendor Tags</h4>
                <p className="text-sm text-gray-600">Select vendor partnerships for this market</p>
                
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                  {availableVendorTags.length === 0 ? (
                    <p className="text-gray-500 text-sm">No vendor tags available</p>
                  ) : (
                    <div className="space-y-2">
                      {availableVendorTags.map(tag => (
                        <label key={tag.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.vendor_tags.includes(tag.id)}
                            onChange={() => toggleVendorTag(tag.id)}
                            className="mr-3"
                          />
                          <span 
                            className="text-sm px-2 py-1 rounded"
                            style={tag.color ? { backgroundColor: tag.color + '20', color: tag.color } : {}}
                          >
                            {tag.name}
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
                              <span className="text-gray-500 ml-2 flex items-center">
                                <MapPinIcon className="h-4 w-4 mr-1" />
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
                                        {user.firstName} {user.lastName}
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
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarketEditModal;