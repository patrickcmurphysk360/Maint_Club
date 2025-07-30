import React, { useState, useEffect } from 'react';
import { phase1MarketsAPI, phase1UsersAPI, Market, Phase1User } from '../../services/phase1-api';
import MarketEditModal from './MarketEditModal';
import { 
  MapPinIcon,
  UserIcon,
  BuildingOffice2Icon
} from '@heroicons/react/24/outline';

const MarketManagement: React.FC = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');

  // Form state for adding/editing markets
  const [formData, setFormData] = useState({
    market_id: '',
    market_name: '',
    description: '',
    city: '',
    state: '',
    zip: '',
    contact_market_manager_id: '',
    vendor_tags: [] as string[],
    new_vendor_tag: ''
  });
  
  const [marketManagers, setMarketManagers] = useState<Phase1User[]>([]);
  const [availableVendorTags, setAvailableVendorTags] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMarkets();
    loadMarketManagers();
    loadVendorTags();
  }, [vendorFilter]);

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (vendorFilter) filters.vendor_tag = vendorFilter;
      
      const response = await phase1MarketsAPI.getMarkets(filters);
      setMarkets(response.markets || []);
    } catch (error) {
      console.error('Error loading markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMarketManagers = async () => {
    try {
      const response = await phase1UsersAPI.getUsers({ role: 'market_manager' });
      setMarketManagers(response.users || []);
    } catch (error) {
      console.error('Error loading market managers:', error);
    }
  };

  const loadVendorTags = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5002/api/vendor-partners', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const vendors = await response.json();
        const tags = vendors.map((v: any) => v.vendor_tag.toUpperCase());
        setAvailableVendorTags(Array.from(new Set(tags)));
      }
    } catch (error) {
      console.error('Error loading vendor tags:', error);
    }
  };

  const generateMarketId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 999);
    return `MKT_${timestamp}_${random}`;
  };

  const resetForm = () => {
    setFormData({
      market_id: generateMarketId(),
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

    if (!formData.market_id) newErrors.market_id = 'Market ID is required';
    if (!formData.market_name) newErrors.market_name = 'Market name is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const marketData = {
        market_id: formData.market_id,
        market_name: formData.market_name,
        description: formData.description,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        contact_market_manager_id: formData.contact_market_manager_id || null,
        vendor_tags: formData.vendor_tags
      };

      await phase1MarketsAPI.createMarket(marketData);

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

  const handleEditSave = async (marketId: string, updates: any) => {
    try {
      await phase1MarketsAPI.updateMarket(marketId, updates);
      setShowEditModal(false);
      setEditingMarket(null);
      loadMarkets();
    } catch (error: any) {
      alert(`Error updating market: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleDelete = async (marketId: string) => {
    if (!window.confirm('Are you sure you want to delete this market? This will also delete all associated stores.')) return;
    
    try {
      await phase1MarketsAPI.deleteMarket(marketId);
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
            className="btn btn-primary"
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
              className="form-input"
            />
          </div>
          
          <div>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="form-input"
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
              className="btn btn-secondary w-full"
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
                    className="text-primary-600 hover:text-primary-900"
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
                <div><strong>Stores:</strong> {market.store_count || 0}</div>
                
                {market.vendor_tags && market.vendor_tags.length > 0 && (
                  <div>
                    <strong>Vendor Tags:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {market.vendor_tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                        >
                          {tag}
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
          onSave={handleEditSave}
          onClose={() => {
            setShowEditModal(false);
            setEditingMarket(null);
          }}
        />
      )}

      {/* Add/Edit Market Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Add New Market
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Market ID */}
                <div>
                  <label className="form-label">Market ID</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.market_id}
                      onChange={(e) => setFormData({ ...formData, market_id: e.target.value })}
                      className={`form-input flex-1 ${errors.market_id ? 'border-red-500' : ''}`}
                      placeholder="MKT_12345"
                      readOnly={!!editingMarket}
                    />
                    {!editingMarket && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, market_id: generateMarketId() })}
                        className="btn btn-secondary"
                      >
                        Generate
                      </button>
                    )}
                  </div>
                  {errors.market_id && <p className="text-red-500 text-sm mt-1">{errors.market_id}</p>}
                </div>

                {/* Market Name */}
                <div>
                  <label className="form-label">Market Name</label>
                  <input
                    type="text"
                    value={formData.market_name}
                    onChange={(e) => setFormData({ ...formData, market_name: e.target.value })}
                    className={`form-input ${errors.market_name ? 'border-red-500' : ''}`}
                    placeholder="Tire South - Tekmetric"
                  />
                  {errors.market_name && <p className="text-red-500 text-sm mt-1">{errors.market_name}</p>}
                </div>

                {/* Description */}
                <div>
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="form-input"
                    rows={3}
                    placeholder="Market description..."
                  />
                </div>

                {/* Location Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="form-input"
                      placeholder="Atlanta"
                    />
                  </div>
                  
                  <div>
                    <label className="form-label">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                      className="form-input"
                      placeholder="GA"
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
                      placeholder="30301"
                    />
                  </div>
                </div>

                {/* Contact Market Manager */}
                <div>
                  <label className="form-label">Contact Market Manager (Corp Office)</label>
                  <select
                    value={formData.contact_market_manager_id}
                    onChange={(e) => setFormData({ ...formData, contact_market_manager_id: e.target.value })}
                    className="form-input"
                  >
                    <option value="">Select a market manager...</option>
                    {marketManagers.map(manager => (
                      <option key={manager.user_id} value={manager.user_id}>
                        {manager.first_name} {manager.last_name} - {manager.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vendor Tags */}
                <div>
                  <label className="form-label">Vendor Tags</label>
                  <div className="space-y-3">
                    {/* Available Vendor Tags from Vendor Partners */}
                    {availableVendorTags.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Select from registered vendor partners:</p>
                        <div className="flex flex-wrap gap-2">
                          {availableVendorTags.map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                if (!formData.vendor_tags.includes(tag)) {
                                  setFormData(prev => ({
                                    ...prev,
                                    vendor_tags: [...prev.vendor_tags, tag]
                                  }));
                                }
                              }}
                              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                formData.vendor_tags.includes(tag)
                                  ? 'bg-purple-600 text-white cursor-not-allowed'
                                  : 'bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-800 cursor-pointer'
                              }`}
                              disabled={formData.vendor_tags.includes(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={formData.new_vendor_tag}
                        onChange={(e) => setFormData({ ...formData, new_vendor_tag: e.target.value })}
                        className="form-input flex-1"
                        placeholder="Or enter custom tag"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addVendorTag())}
                      />
                      <button
                        type="button"
                        onClick={addVendorTag}
                        className="btn btn-secondary"
                      >
                        Add Tag
                      </button>
                    </div>
                    
                    {formData.vendor_tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.vendor_tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeVendorTag(tag)}
                              className="ml-2 text-purple-600 hover:text-purple-800"
                            >
                              ×
                            </button>
                          </span>
                        ))}
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
                      setEditingMarket(null);
                      resetForm();
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    {editingMarket ? 'Update Market' : 'Create Market'}
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