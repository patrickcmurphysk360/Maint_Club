import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SERVICE_CATEGORIES } from '../constants/serviceCategories';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  TagIcon,
  BuildingOffice2Icon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface VendorMapping {
  id?: number;
  market_id: string;
  vendor: string;
  vendor_id?: number;
  vendor_name?: string;
  mappings: MappingDetail[];
  created_at?: string;
  updated_at?: string;
}

interface MappingDetail {
  id?: number;
  generic_service: string;
  branded_service: string;
}

interface Market {
  market_id: string;
  market_name: string;
}

interface VendorPartner {
  id: number;
  vendor_name: string;
  vendor_tag: string;
  active: boolean;
}

interface VendorProduct {
  id: number;
  branded_product_name: string;
  product_category: string;
  product_sku: string;
}

const VendorMappings: React.FC = () => {
  const { user } = useAuth();
  const [vendorMappings, setVendorMappings] = useState<VendorMapping[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [vendorPartners, setVendorPartners] = useState<VendorPartner[]>([]);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);
  const [genericServices, setGenericServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<VendorMapping>({
    market_id: '',
    vendor: '',
    vendor_id: undefined,
    mappings: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadVendorMappings(),
        loadMarkets(),
        loadVendorPartners(),
        loadGenericServices()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadVendorMappings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5002/api/vendor-mappings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch vendor mappings');
      
      const data = await response.json();
      setVendorMappings(data);
    } catch (error) {
      console.error('Error loading vendor mappings:', error);
      throw error;
    }
  };

  const loadMarkets = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5002/api/phase1/markets', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch markets');
      
      const data = await response.json();
      setMarkets(data.markets || []);
    } catch (error) {
      console.error('Error loading markets:', error);
      throw error;
    }
  };

  const loadVendorPartners = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5002/api/vendor-partners?active=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch vendor partners');
      
      const data = await response.json();
      setVendorPartners(data);
    } catch (error) {
      console.error('Error loading vendor partners:', error);
      throw error;
    }
  };

  const loadVendorProducts = async (vendorId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5002/api/vendor-mappings/vendor-products/${vendorId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch vendor products');
      
      const data = await response.json();
      setVendorProducts(data);
    } catch (error) {
      console.error('Error loading vendor products:', error);
      setVendorProducts([]);
    }
  };

  const loadGenericServices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5002/api/vendor-mappings/services/generic', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch generic services');
      
      const data = await response.json();
      setGenericServices(data);
    } catch (error) {
      console.error('Error loading generic services:', error);
      throw error;
    }
  };

  const handleAddMapping = () => {
    setFormData({
      market_id: '',
      vendor: '',
      vendor_id: undefined,
      mappings: genericServices.map(service => ({
        generic_service: service,
        branded_service: ''
      }))
    });
    setEditingId(null);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleEdit = async (mapping: VendorMapping) => {
    // Ensure all generic services are included
    const existingMappings = new Map(
      mapping.mappings.map(m => [m.generic_service, m.branded_service])
    );

    const allMappings = genericServices.map(service => ({
      generic_service: service,
      branded_service: existingMappings.get(service) || ''
    }));

    setFormData({
      ...mapping,
      mappings: allMappings
    });
    
    // Load vendor products if vendor_id exists
    if (mapping.vendor_id) {
      await loadVendorProducts(mapping.vendor_id);
    }
    
    setEditingId(mapping.id || null);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this vendor mapping?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5002/api/vendor-mappings/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete vendor mapping');

      setSuccess('Vendor mapping deleted successfully');
      await loadVendorMappings();
    } catch (error) {
      console.error('Error deleting vendor mapping:', error);
      setError('Failed to delete vendor mapping');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Filter out empty mappings
    const filteredMappings = formData.mappings.filter(
      m => m.generic_service && m.branded_service
    );

    if (!formData.market_id || !formData.vendor_id) {
      setError('Market and vendor are required');
      return;
    }

    if (filteredMappings.length === 0) {
      setError('At least one product mapping is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingId 
        ? `http://localhost:5002/api/vendor-mappings/${editingId}`
        : 'http://localhost:5002/api/vendor-mappings';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          mappings: filteredMappings,
          created_by: user?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save vendor mapping');
      }

      setSuccess(editingId ? 'Vendor mapping updated successfully' : 'Vendor mapping created successfully');
      setShowForm(false);
      await loadVendorMappings();
    } catch (error: any) {
      console.error('Error saving vendor mapping:', error);
      setError(error.message || 'Failed to save vendor mapping');
    }
  };

  const handleMappingChange = (index: number, field: 'branded_service', value: string) => {
    const updatedMappings = [...formData.mappings];
    updatedMappings[index] = {
      ...updatedMappings[index],
      [field]: value
    };
    setFormData({ ...formData, mappings: updatedMappings });
  };

  const getMarketName = (marketId: string) => {
    const market = markets.find(m => m.market_id === marketId);
    return market?.market_name || marketId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <TagIcon className="h-8 w-8 mr-2 text-blue-600" />
            Vendor Product Mappings
          </h2>
          <p className="text-gray-600 mt-1">
            Map generic service names to vendor-branded products for each market
          </p>
        </div>
        <button
          onClick={handleAddMapping}
          className="btn btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Mapping
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Vendor Mapping' : 'New Vendor Mapping'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Market and Vendor Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Market</label>
                <select
                  value={formData.market_id}
                  onChange={(e) => setFormData({ ...formData, market_id: e.target.value })}
                  className="form-input"
                  required
                >
                  <option value="">Select a market</option>
                  {markets.map((market) => (
                    <option key={market.market_id} value={market.market_id}>
                      {market.market_name} ({market.market_id})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="form-label">Vendor</label>
                <select
                  value={formData.vendor_id || ''}
                  onChange={async (e) => {
                    const vendorId = e.target.value ? parseInt(e.target.value) : undefined;
                    const selectedVendor = vendorPartners.find(v => v.id === vendorId);
                    // Create mappings from service categories instead of generic services
                    const allServices = SERVICE_CATEGORIES.flatMap(category => 
                      category.services.map(service => service.key)
                    );
                    
                    setFormData({ 
                      ...formData, 
                      vendor_id: vendorId,
                      vendor: selectedVendor?.vendor_name || '',
                      mappings: allServices.map(serviceKey => ({
                        generic_service: serviceKey,
                        branded_service: ''
                      }))
                    });
                    
                    // Load vendor products when vendor is selected
                    if (vendorId) {
                      await loadVendorProducts(vendorId);
                    } else {
                      setVendorProducts([]);
                    }
                  }}
                  className="form-input"
                  required
                >
                  <option value="">Select a vendor</option>
                  {vendorPartners.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendor_name} ({vendor.vendor_tag})
                    </option>
                  ))}
                </select>
                {vendorPartners.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    No active vendors found. Please add vendors first in Vendor Partner Management.
                  </p>
                )}
              </div>
            </div>

            {/* Product Mappings - Organized by Category */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Service to Product Mappings</h4>
              <div className="space-y-6 max-h-96 overflow-y-auto">
                {SERVICE_CATEGORIES.map((category) => {
                  // Skip Core Metrics as they don't need product mappings
                  if (category.name === 'Core Metrics') return null;
                  
                  // Find mappings for this category
                  const categoryMappings = formData.mappings.filter(mapping => 
                    category.services.some(service => service.key === mapping.generic_service)
                  );
                  
                  if (categoryMappings.length === 0) return null;
                  
                  return (
                    <div key={category.name} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <span className="text-lg mr-2">{category.icon}</span>
                        <h5 className={`font-medium text-${category.color}-900`}>
                          {category.name}
                        </h5>
                      </div>
                      
                      <div className="space-y-3">
                        {categoryMappings.map((mapping, index) => {
                          const globalIndex = formData.mappings.findIndex(m => m === mapping);
                          const serviceInfo = category.services.find(s => s.key === mapping.generic_service);
                          
                          return (
                            <div key={globalIndex} className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-${category.color}-50 rounded border border-${category.color}-100`}>
                              <div>
                                <label className="text-sm font-medium text-gray-700">
                                  Generic Service
                                </label>
                                <div className="mt-1">
                                  <div className="text-sm font-medium text-gray-900">
                                    {serviceInfo?.label || mapping.generic_service}
                                  </div>
                                  {serviceInfo?.description && (
                                    <div className="text-xs text-gray-500">
                                      {serviceInfo.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-gray-700">
                                  Branded Product Name
                                </label>
                                <select
                                  value={mapping.branded_service}
                                  onChange={(e) => handleMappingChange(globalIndex, 'branded_service', e.target.value)}
                                  className="form-input mt-1"
                                >
                                  <option value="">Select a product (optional)</option>
                                  {/* Group vendor products by category if available */}
                                  {vendorProducts
                                    .filter(product => 
                                      !product.product_category || 
                                      product.product_category.toLowerCase().includes(category.name.toLowerCase().split(' ')[0]) ||
                                      category.name.toLowerCase().includes(product.product_category.toLowerCase())
                                    )
                                    .map((product) => (
                                      <option key={product.id} value={product.branded_product_name}>
                                        {product.branded_product_name}
                                        {product.product_sku && ` (${product.product_sku})`}
                                        {product.product_category && ` - ${product.product_category}`}
                                      </option>
                                    ))
                                  }
                                  {/* Show all products if no category match */}
                                  {vendorProducts
                                    .filter(product => 
                                      product.product_category && 
                                      !product.product_category.toLowerCase().includes(category.name.toLowerCase().split(' ')[0]) &&
                                      !category.name.toLowerCase().includes(product.product_category.toLowerCase())
                                    )
                                    .map((product) => (
                                      <option key={`other-${product.id}`} value={product.branded_product_name}>
                                        {product.branded_product_name}
                                        {product.product_sku && ` (${product.product_sku})`}
                                        {product.product_category && ` - ${product.product_category}`}
                                      </option>
                                    ))
                                  }
                                </select>
                                {vendorProducts.length === 0 && formData.vendor_id && (
                                  <p className="text-xs text-red-500 mt-1">
                                    No products found for this vendor.
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Select products from the vendor's catalog, or leave empty for services not offered by this vendor.
                {!formData.vendor_id && " Select a vendor first to see available products."}
              </p>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                {editingId ? 'Update Mapping' : 'Create Mapping'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mappings List */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Existing Mappings</h3>
        
        {vendorMappings.length === 0 ? (
          <p className="text-gray-600 text-center py-8">
            No vendor mappings found. Click "Add Mapping" to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {vendorMappings.map((mapping) => (
              <div key={mapping.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-2">
                      <h4 className="font-semibold text-lg">{mapping.vendor_name || mapping.vendor}</h4>
                      <span className="text-sm text-gray-600 flex items-center">
                        <BuildingOffice2Icon className="h-4 w-4 mr-1" />
                        {getMarketName(mapping.market_id)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                      {mapping.mappings
                        .filter(m => m.branded_service)
                        .map((detail, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium text-gray-700">
                              {detail.generic_service}:
                            </span>{' '}
                            <span className="text-blue-600">{detail.branded_service}</span>
                          </div>
                        ))}
                    </div>
                    
                    {mapping.updated_at && (
                      <p className="text-xs text-gray-500 mt-3">
                        Last updated: {new Date(mapping.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleEdit(mapping)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Edit mapping"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => mapping.id && handleDelete(mapping.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete mapping"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorMappings;