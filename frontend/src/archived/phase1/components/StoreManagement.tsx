import React, { useState, useEffect } from 'react';
import { phase1StoresAPI, phase1MarketsAPI, Store, Market } from '../../services/phase1-api';

const StoreManagement: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form state for adding/editing stores
  const [formData, setFormData] = useState({
    store_id: '',
    store_name: '',
    market_id: '',
    address: '',
    phone: '',
    status: 'active' as 'active' | 'inactive'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadStores();
    loadMarkets();
  }, [marketFilter, statusFilter]);

  const loadStores = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (marketFilter) filters.market_id = marketFilter;
      if (statusFilter) filters.status = statusFilter;
      
      const response = await phase1StoresAPI.getStores(filters);
      setStores(response.stores || []);
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMarkets = async () => {
    try {
      const response = await phase1MarketsAPI.getMarkets();
      setMarkets(response.markets || []);
    } catch (error) {
      console.error('Error loading markets:', error);
    }
  };

  const generateStoreId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 999);
    return `STORE_${timestamp}_${random}`;
  };

  const resetForm = () => {
    setFormData({
      store_id: generateStoreId(),
      store_name: '',
      market_id: '',
      address: '',
      phone: '',
      status: 'active'
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.store_id) newErrors.store_id = 'Store ID is required';
    if (!formData.store_name) newErrors.store_name = 'Store name is required';
    if (!formData.market_id) newErrors.market_id = 'Market is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const storeData = {
        store_id: formData.store_id,
        store_name: formData.store_name,
        market_id: formData.market_id,
        address: formData.address,
        phone: formData.phone,
        status: formData.status
      };

      if (editingStore) {
        await phase1StoresAPI.updateStore(editingStore.store_id, storeData);
        setEditingStore(null);
      } else {
        await phase1StoresAPI.createStore(storeData);
      }

      setShowAddForm(false);
      resetForm();
      loadStores();
    } catch (error: any) {
      alert(`Error ${editingStore ? 'updating' : 'creating'} store: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleEdit = (store: Store) => {
    setFormData({
      store_id: store.store_id,
      store_name: store.store_name,
      market_id: store.market_id,
      address: store.address || '',
      phone: store.phone || '',
      status: store.status
    });
    setEditingStore(store);
    setShowAddForm(true);
  };

  const handleDelete = async (storeId: string) => {
    if (!window.confirm('Are you sure you want to delete this store?')) return;
    
    try {
      await phase1StoresAPI.deleteStore(storeId);
      loadStores();
    } catch (error: any) {
      alert(`Error deleting store: ${error.response?.data?.message || error.message}`);
    }
  };

  const filteredStores = stores.filter(store => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        store.store_name.toLowerCase().includes(term) ||
        store.store_id.toLowerCase().includes(term) ||
        store.market_name?.toLowerCase().includes(term) ||
        store.address?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const getMarketName = (marketId: string) => {
    const market = markets.find(m => m.market_id === marketId);
    return market?.market_name || marketId;
  };

  const getMarketVendorTags = (marketId: string) => {
    const market = markets.find(m => m.market_id === marketId);
    return market?.vendor_tags || [];
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Store Management</h2>
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            className="btn btn-primary"
          >
            + Add New Store
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search stores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>
          
          <div>
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="form-input"
            >
              <option value="">All Markets</option>
              {markets.map(market => (
                <option key={market.market_id} value={market.market_id}>
                  {market.market_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          
          <div>
            <button
              onClick={loadStores}
              className="btn btn-secondary w-full"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Stores Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Store
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Market
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact Info
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                </td>
              </tr>
            ) : filteredStores.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No stores found
                </td>
              </tr>
            ) : (
              filteredStores.map((store) => (
                <tr key={store.store_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{store.store_name}</div>
                      <div className="text-xs text-gray-400">ID: {store.store_id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-gray-900">{store.market_name || getMarketName(store.market_id)}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getMarketVendorTags(store.market_id).map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      {store.address && <div>{store.address}</div>}
                      {store.phone && <div>{store.phone}</div>}
                      {!store.address && !store.phone && <span className="text-gray-400">No contact info</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      store.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {store.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(store)}
                      className="text-primary-600 hover:text-primary-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(store.store_id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Store Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingStore ? 'Edit Store' : 'Add New Store'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Store ID */}
                <div>
                  <label className="form-label">Store ID</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.store_id}
                      onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                      className={`form-input flex-1 ${errors.store_id ? 'border-red-500' : ''}`}
                      placeholder="STORE_12345"
                      readOnly={!!editingStore}
                    />
                    {!editingStore && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, store_id: generateStoreId() })}
                        className="btn btn-secondary"
                      >
                        Generate
                      </button>
                    )}
                  </div>
                  {errors.store_id && <p className="text-red-500 text-sm mt-1">{errors.store_id}</p>}
                </div>

                {/* Store Name */}
                <div>
                  <label className="form-label">Store Name</label>
                  <input
                    type="text"
                    value={formData.store_name}
                    onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                    className={`form-input ${errors.store_name ? 'border-red-500' : ''}`}
                    placeholder="Mcdonough"
                  />
                  {errors.store_name && <p className="text-red-500 text-sm mt-1">{errors.store_name}</p>}
                </div>

                {/* Market */}
                <div>
                  <label className="form-label">Market</label>
                  <select
                    value={formData.market_id}
                    onChange={(e) => setFormData({ ...formData, market_id: e.target.value })}
                    className={`form-input ${errors.market_id ? 'border-red-500' : ''}`}
                  >
                    <option value="">Select a market</option>
                    {markets.map(market => (
                      <option key={market.market_id} value={market.market_id}>
                        {market.market_name}
                        {market.vendor_tags && market.vendor_tags.length > 0 && 
                          ` (${market.vendor_tags.join(', ')})`
                        }
                      </option>
                    ))}
                  </select>
                  {errors.market_id && <p className="text-red-500 text-sm mt-1">{errors.market_id}</p>}
                </div>

                {/* Address */}
                <div>
                  <label className="form-label">Address (Optional)</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="form-input"
                    rows={2}
                    placeholder="123 Main St, City, State 12345"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="form-label">Phone (Optional)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="form-input"
                    placeholder="(555) 123-4567"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="form-label">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="form-input"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingStore(null);
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
                    {editingStore ? 'Update Store' : 'Create Store'}
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

export default StoreManagement;