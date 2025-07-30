import React, { useState, useEffect } from 'react';
import api from '../services/api';
import MarketEditModal from './MarketEditModal';
import { 
  MapPinIcon,
  UserIcon,
  BuildingOffice2Icon
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

const MarketManagement: React.FC = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [availableVendorTags, setAvailableVendorTags] = useState<{id: string, name: string, color?: string}[]>([]);
  const [marketManagers, setMarketManagers] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state for adding markets
  const [formData, setFormData] = useState({
    market_name: '',
    description: '',
    city: '',
    state: '',
    zip: '',
    contact_market_manager_id: '',
    vendor_tags: [] as string[],
    new_vendor_tag: ''
  });

  useEffect(() => {
    loadMarkets();
    loadMarketManagers();
    loadVendorTags();
  }, [vendorFilter]);

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (vendorFilter) params.append('vendor_tag', vendorFilter);
      
      const response = await api.get(`/markets?${params}`);
      setMarkets(response.data.markets || []);
    } catch (error) {
      console.error('Error loading markets:', error);
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMarketManagers = async () => {
    try {
      const response = await api.get('/users?role=market_manager');
      setMarketManagers(response.data || []);
    } catch (error) {
      console.error('Error loading market managers:', error);
    }
  };

  const loadVendorTags = async () => {
    try {
      const response = await api.get('/vendor/tags');
      setAvailableVendorTags(response.data || []);
    } catch (error) {
      console.error('Error loading vendor tags:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      market_name: '',
      description: '',
      city: '',
      state: '',
      zip: '',
      contact_market_manager_id: '',
      vendor_tags: [],
      new_vendor_tag: ''
    });
    setErrors({});
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

    try {
      const marketData = {
        market_name: formData.market_name,
        description: formData.description,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        contact_market_manager_id: formData.contact_market_manager_id || null,
        vendor_tags: formData.vendor_tags
      };

      await api.post('/markets', marketData);
      setShowAddForm(false);
      resetForm();
      loadMarkets();
    } catch (error: any) {
      alert(`Error creating market: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleEdit = (market: Market) => {
    setEditingMarket(market);
    setShowEditModal(true);
  };

  const handleDelete = async (marketId: string) => {
    if (!window.confirm('Are you sure you want to delete this market? This will also delete all associated stores.')) return;
    
    try {
      await api.delete(`/markets/${marketId}`);
      loadMarkets();
    } catch (error: any) {
      alert(`Error deleting market: ${error.response?.data?.message || error.message}`);
    }
  };

  const addVendorTag = () => {
    if (formData.new_vendor_tag.trim() && !formData.vendor_tags.includes(formData.new_vendor_tag.trim().toUpperCase())) {
      setFormData(prev => ({
        ...prev,
        vendor_tags: [...prev.vendor_tags, prev.new_vendor_tag.trim().toUpperCase()],
        new_vendor_tag: ''
      }));
    }
  };

  const removeVendorTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      vendor_tags: prev.vendor_tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const filteredMarkets = markets.filter(market => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        market.market_name.toLowerCase().includes(term) ||
        market.market_id.toLowerCase().includes(term) ||
        market.description?.toLowerCase().includes(term) ||
        market.vendor_tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const uniqueVendorTags = Array.from(new Set(markets.flatMap(m => m.vendor_tags || [])));

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Market Management</h2>
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            + Add New Market
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search markets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Vendors</option>
              {uniqueVendorTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
          
          <div>
            <button
              onClick={loadMarkets}
              className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Markets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No markets found
          </div>
        ) : (
          filteredMarkets.map((market) => (
            <div key={market.market_id} className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{market.market_name}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(market)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(market.market_id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div><strong>ID:</strong> {market.market_id}</div>
                {market.description && (
                  <div><strong>Description:</strong> {market.description}</div>
                )}
                {(market.city || market.state || market.zip) && (
                  <div className="flex items-center">
                    <MapPinIcon className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{[market.city, market.state, market.zip].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {market.contact_market_manager && (
                  <div className="flex items-center">
                    <UserIcon className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{market.contact_market_manager.first_name} {market.contact_market_manager.last_name}</span>
                  </div>
                )}
                <div className="flex items-center">
                  <BuildingOffice2Icon className="h-4 w-4 mr-1 text-gray-500" />
                  <span><strong>Stores:</strong> {market.store_count || 0}</span>
                </div>
                
                {market.vendor_tag_details && market.vendor_tag_details.length > 0 && (
                  <div>
                    <strong>Vendor Tags:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {market.vendor_tag_details.map(tag => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                          style={tag.color ? { backgroundColor: tag.color + '20', color: tag.color } : {}}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Market Modal */}
      {showEditModal && editingMarket && (
        <MarketEditModal
          market={editingMarket}
          onSave={async (marketId: string, updates: any) => {
            try {
              await api.put(`/markets/${editingMarket.id}`, updates);
              setShowEditModal(false);
              setEditingMarket(null);
              loadMarkets();
            } catch (error: any) {
              alert(`Error updating market: ${error.response?.data?.message || error.message}`);
            }
          }}
          onClose={() => {
            setShowEditModal(false);
            setEditingMarket(null);
          }}
        />
      )}

      {/* Add Market Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Add New Market
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Market Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Market Name *</label>
                  <input
                    type="text"
                    value={formData.market_name}
                    onChange={(e) => setFormData({ ...formData, market_name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.market_name ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Tire South - Tekmetric"
                  />
                  {errors.market_name && <p className="text-red-500 text-sm mt-1">{errors.market_name}</p>}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Market description..."
                  />
                </div>

                {/* Location Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Atlanta"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="GA"
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
                      placeholder="30301"
                    />
                  </div>
                </div>

                {/* Contact Market Manager */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Market Manager</label>
                  <select
                    value={formData.contact_market_manager_id}
                    onChange={(e) => setFormData({ ...formData, contact_market_manager_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a market manager...</option>
                    {marketManagers.map(manager => (
                      <option key={manager.id} value={manager.id}>
                        {manager.firstName} {manager.lastName} - {manager.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vendor Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Tags</label>
                  <div className="space-y-3">
                    {/* Available Vendor Tags */}
                    {availableVendorTags.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Select from registered vendor partners:</p>
                        <div className="flex flex-wrap gap-2">
                          {availableVendorTags.map(tag => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                if (!formData.vendor_tags.includes(tag.id)) {
                                  setFormData(prev => ({
                                    ...prev,
                                    vendor_tags: [...prev.vendor_tags, tag.id]
                                  }));
                                }
                              }}
                              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                formData.vendor_tags.includes(tag.id)
                                  ? 'bg-purple-600 text-white cursor-not-allowed'
                                  : 'bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-800 cursor-pointer'
                              }`}
                              disabled={formData.vendor_tags.includes(tag.id)}
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {formData.vendor_tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.vendor_tags.map(tagId => {
                          const tag = availableVendorTags.find(t => t.id === tagId);
                          return tag ? (
                            <span
                              key={tagId}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                            >
                              {tag.name}
                              <button
                                type="button"
                                onClick={() => removeVendorTag(tagId)}
                                className="ml-2 text-purple-600 hover:text-purple-800"
                              >
                                ×
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Vendor tags determine which vendor partners can access this market's data
                  </p>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      resetForm();
                    }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Create Market
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketManagement;