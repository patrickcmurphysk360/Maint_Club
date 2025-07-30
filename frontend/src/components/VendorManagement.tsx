import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import VendorProducts from './VendorProducts';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  MapPinIcon,
  TagIcon,
  ShoppingBagIcon,
  ArrowLeftIcon,
  CogIcon
} from '@heroicons/react/24/outline';

interface VendorPartner {
  id?: number;
  vendor_name: string;
  vendor_tag: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  notes: string;
  active: boolean;
  product_count?: number;
  mapping_count?: number;
  created_at?: string;
  updated_at?: string;
}

interface ServiceMapping {
  id: number;
  vendor_id: string;
  service_field: string;
  product_name: string;
  vendor_product_id?: number;
  market_id?: number;
  description: string;
}

interface ServiceCatalogItem {
  id: number;
  service_name: string;
  service_category: string;
  display_order: number;
}

interface VendorProduct {
  id?: number;
  vendor_id: number;
  branded_product_name: string;
  product_category: string;
  product_sku: string;
  description: string;
  price: number | null;
  active: boolean;
}

const VendorManagement: React.FC = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<VendorPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorPartner | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'mappings'>('products');
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([]);
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);
  const [formData, setFormData] = useState<VendorPartner>({
    vendor_name: '',
    vendor_tag: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    website: '',
    notes: '',
    active: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Service mapping form state
  const [showMappingForm, setShowMappingForm] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<number | null>(null);
  const [mappingFormData, setMappingFormData] = useState({
    service_field: '',
    product_name: '',
    vendor_product_id: null as number | null,
    description: ''
  });

  useEffect(() => {
    loadVendors();
    loadServiceCatalog();
  }, []);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5002/api/vendor-partners', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch vendors');
      
      const data = await response.json();
      setVendors(data);
    } catch (error) {
      console.error('Error loading vendors:', error);
      setError('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const loadServiceCatalog = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5002/api/service-catalog', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch service catalog');
      
      const data = await response.json();
      setServiceCatalog(data.services);
    } catch (error) {
      console.error('Error loading service catalog:', error);
    }
  };

  const loadServiceMappings = async (vendorTag: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5002/api/vendor-mappings?vendor_id=${vendorTag}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch service mappings');
      
      const data = await response.json();
      setServiceMappings(data.mappings || []);
    } catch (error) {
      console.error('Error loading service mappings:', error);
    }
  };

  const loadVendorProducts = async (vendorId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5002/api/vendor-partners/${vendorId}/products`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch vendor products');
      
      const products = await response.json();
      setVendorProducts(products.filter((p: VendorProduct) => p.active));
    } catch (error) {
      console.error('Error loading vendor products:', error);
      setVendorProducts([]);
    }
  };

  const handleAdd = () => {
    setFormData({
      vendor_name: '',
      vendor_tag: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      email: '',
      website: '',
      notes: '',
      active: true
    });
    setEditingId(null);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleEdit = (vendor: VendorPartner) => {
    setFormData(vendor);
    setEditingId(vendor.id || null);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this vendor? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5002/api/vendor-partners/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete vendor');
      }

      setSuccess('Vendor deleted successfully');
      await loadVendors();
    } catch (error: any) {
      console.error('Error deleting vendor:', error);
      setError(error.message || 'Failed to delete vendor');
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5002/api/vendor-partners/${id}/toggle-active`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to toggle vendor status');

      setSuccess('Vendor status updated successfully');
      await loadVendors();
    } catch (error) {
      console.error('Error toggling vendor status:', error);
      setError('Failed to update vendor status');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.vendor_name || !formData.vendor_tag) {
      setError('Vendor name and tag are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingId 
        ? `http://localhost:5002/api/vendor-partners/${editingId}`
        : 'http://localhost:5002/api/vendor-partners';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          created_by: user?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save vendor');
      }

      setSuccess(editingId ? 'Vendor updated successfully' : 'Vendor created successfully');
      setShowForm(false);
      await loadVendors();
    } catch (error: any) {
      console.error('Error saving vendor:', error);
      setError(error.message || 'Failed to save vendor');
    }
  };

  const handleViewProducts = async (vendor: VendorPartner) => {
    setSelectedVendor(vendor);
    await Promise.all([
      loadServiceMappings(vendor.vendor_tag),
      vendor.id ? loadVendorProducts(vendor.id) : Promise.resolve()
    ]);
  };

  // Service mapping handlers
  const handleAddMapping = () => {
    setMappingFormData({
      service_field: '',
      product_name: '',
      vendor_product_id: null,
      description: ''
    });
    setEditingMappingId(null);
    setShowMappingForm(true);
    setError('');
    setSuccess('');
  };

  const handleEditMapping = (mapping: ServiceMapping) => {
    // Find the product ID from the product name if not already set
    let productId: number | null = mapping.vendor_product_id || null;
    if (!productId && mapping.product_name) {
      const product = vendorProducts.find(p => p.branded_product_name === mapping.product_name);
      if (product && product.id !== undefined) {
        productId = product.id;
      }
    }
    
    setMappingFormData({
      service_field: mapping.service_field,
      product_name: mapping.product_name,
      vendor_product_id: productId,
      description: mapping.description
    });
    setEditingMappingId(mapping.id);
    setShowMappingForm(true);
    setError('');
    setSuccess('');
  };

  const handleDeleteMapping = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this service mapping?')) {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete mapping');
      }

      setSuccess('Service mapping deleted successfully');
      if (selectedVendor) {
        await loadServiceMappings(selectedVendor.vendor_tag);
      }
    } catch (error: any) {
      console.error('Error deleting mapping:', error);
      setError(error.message || 'Failed to delete mapping');
    }
  };

  const handleMappingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!mappingFormData.service_field || !mappingFormData.vendor_product_id) {
      setError('Service field and vendor product are required');
      return;
    }

    if (!selectedVendor) {
      setError('No vendor selected');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingMappingId 
        ? `http://localhost:5002/api/vendor-mappings/${editingMappingId}`
        : 'http://localhost:5002/api/vendor-mappings';
      
      const method = editingMappingId ? 'PUT' : 'POST';

      const requestBody = {
        ...mappingFormData,
        vendor_id: selectedVendor.vendor_tag
      };
      
      console.log('Submitting mapping:', requestBody);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save mapping');
      }

      setSuccess(editingMappingId ? 'Service mapping updated successfully' : 'Service mapping created successfully');
      setShowMappingForm(false);
      await loadServiceMappings(selectedVendor.vendor_tag);
    } catch (error: any) {
      console.error('Error saving mapping:', error);
      setError(error.message || 'Failed to save mapping');
    }
  };

  const handleMappingChange = (field: keyof typeof mappingFormData, value: string | number | null) => {
    setMappingFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleChange = (field: keyof VendorPartner, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateTag = (vendorName: string) => {
    return vendorName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.vendor_tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedVendor) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSelectedVendor(null)}
            className="btn btn-secondary flex items-center"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Vendors
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedVendor.vendor_name}
            </h2>
            <p className="text-gray-600">
              Manage products and service mappings for {selectedVendor.vendor_name}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('products')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'products'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ShoppingBagIcon className="h-4 w-4 mr-2 inline" />
                Product Catalog
              </button>
              <button
                onClick={() => setActiveTab('mappings')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'mappings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CogIcon className="h-4 w-4 mr-2 inline" />
                Service Mappings
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'products' && (
              <VendorProducts vendor={selectedVendor} />
            )}
            
            {activeTab === 'mappings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Service Mappings</h3>
                    <p className="text-sm text-gray-600">
                      Map generic service names to {selectedVendor.vendor_name} branded products
                    </p>
                  </div>
                  <button 
                    onClick={handleAddMapping}
                    className="btn btn-primary btn-sm"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Mapping
                  </button>
                </div>

                {serviceMappings.length === 0 ? (
                  <div className="text-center py-12">
                    <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No service mappings</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Create mappings to show branded product names in advisor scorecards.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {serviceMappings.map((mapping) => (
                      <div key={mapping.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                              {mapping.service_field}
                            </div>
                            <span className="text-gray-400">→</span>
                            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                              {mapping.product_name}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => handleEditMapping(mapping)}
                              className="btn btn-sm btn-secondary"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteMapping(mapping.id)}
                              className="btn btn-sm btn-danger"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {mapping.description && (
                          <p className="text-sm text-gray-600 mt-2 ml-2">
                            {mapping.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Service Mapping Form */}
                {showMappingForm && (
                  <div className="card mt-6">
                    <h4 className="text-lg font-semibold mb-4">
                      {editingMappingId ? 'Edit Service Mapping' : 'New Service Mapping'}
                    </h4>
                    
                    <form onSubmit={handleMappingSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">Generic Service *</label>
                          <select
                            value={mappingFormData.service_field}
                            onChange={(e) => handleMappingChange('service_field', e.target.value)}
                            className="form-input"
                            required
                          >
                            <option value="">Select a service</option>
                            {serviceCatalog.map(service => (
                              <option key={service.id} value={service.service_name.replace(/\s+(.)/g, (_, letter) => letter.toUpperCase()).replace(/^\w/, (c) => c.toLowerCase())}>
                                {service.service_name}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            The generic service name from the standard catalog
                          </p>
                        </div>
                        
                        <div>
                          <label className="form-label">Vendor Product *</label>
                          <select
                            value={mappingFormData.vendor_product_id || ''}
                            onChange={(e) => {
                              const productId = e.target.value ? parseInt(e.target.value) : null;
                              const product = vendorProducts.find(p => p.id === productId);
                              handleMappingChange('vendor_product_id', productId);
                              if (product) {
                                handleMappingChange('product_name', product.branded_product_name);
                              }
                            }}
                            className="form-input"
                            required
                          >
                            <option value="">Select a vendor product</option>
                            {vendorProducts.length === 0 ? (
                              <option value="" disabled>No products available - add products first</option>
                            ) : (
                              vendorProducts.map(product => (
                                <option key={product.id} value={product.id}>
                                  {product.branded_product_name} {product.product_sku ? `(${product.product_sku})` : ''}
                                </option>
                              ))
                            )}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            Select from the vendor's product catalog
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="form-label">Description</label>
                        <textarea
                          value={mappingFormData.description}
                          onChange={(e) => handleMappingChange('description', e.target.value)}
                          className="form-input"
                          rows={3}
                          placeholder="Additional notes about this mapping..."
                        />
                      </div>

                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => setShowMappingForm(false)}
                          className="btn btn-secondary"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                        >
                          {editingMappingId ? 'Update Mapping' : 'Create Mapping'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <BuildingOfficeIcon className="h-8 w-8 mr-2 text-blue-600" />
            Vendor Partner Management
          </h2>
          <p className="text-gray-600 mt-1">
            Manage vendor partners and their branded products
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Vendor
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search vendors by name or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input w-full"
          />
        </div>
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
            {editingId ? 'Edit Vendor Partner' : 'New Vendor Partner'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Vendor Name *</label>
                <input
                  type="text"
                  value={formData.vendor_name}
                  onChange={(e) => {
                    handleChange('vendor_name', e.target.value);
                    if (!editingId) {
                      handleChange('vendor_tag', generateTag(e.target.value));
                    }
                  }}
                  className="form-input"
                  placeholder="e.g., BG Products"
                  required
                />
              </div>
              
              <div>
                <label className="form-label">Vendor Tag *</label>
                <input
                  type="text"
                  value={formData.vendor_tag}
                  onChange={(e) => handleChange('vendor_tag', e.target.value.toLowerCase())}
                  className="form-input"
                  placeholder="e.g., bg_products"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used for system identification (lowercase, underscores only)
                </p>
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="form-input"
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="form-input"
                  placeholder="contact@vendor.com"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="form-label">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="form-input"
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="form-input"
                  placeholder="Anytown"
                />
              </div>
              
              <div>
                <label className="form-label">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className="form-input"
                  placeholder="CA"
                />
              </div>
              
              <div>
                <label className="form-label">ZIP Code</label>
                <input
                  type="text"
                  value={formData.zip}
                  onChange={(e) => handleChange('zip', e.target.value)}
                  className="form-input"
                  placeholder="12345"
                />
              </div>
            </div>

            {/* Website and Notes */}
            <div>
              <label className="form-label">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => handleChange('website', e.target.value)}
                className="form-input"
                placeholder="https://www.vendor.com"
              />
            </div>

            <div>
              <label className="form-label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="form-input"
                rows={3}
                placeholder="Additional notes about this vendor..."
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => handleChange('active', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                Active vendor
              </label>
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
                {editingId ? 'Update Vendor' : 'Create Vendor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vendors List */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Vendor Partners</h3>
        
        {filteredVendors.length === 0 ? (
          <p className="text-gray-600 text-center py-8">
            {searchTerm ? 'No vendors found matching your search.' : 'No vendors found. Click "Add Vendor" to create one.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Products
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mappings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {vendor.vendor_name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <TagIcon className="h-4 w-4 mr-1" />
                          {vendor.vendor_tag}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {vendor.phone && (
                          <div className="flex items-center">
                            <PhoneIcon className="h-4 w-4 mr-1 text-gray-400" />
                            {vendor.phone}
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center">
                            <EnvelopeIcon className="h-4 w-4 mr-1 text-gray-400" />
                            {vendor.email}
                          </div>
                        )}
                        {vendor.city && vendor.state && (
                          <div className="flex items-center text-gray-500">
                            <MapPinIcon className="h-4 w-4 mr-1 text-gray-400" />
                            {vendor.city}, {vendor.state}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleViewProducts(vendor)}
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <ShoppingBagIcon className="h-4 w-4 mr-1" />
                        {vendor.product_count || 0} products
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vendor.mapping_count || 0} mappings
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        vendor.active 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {vendor.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(vendor)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit vendor"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => vendor.id && handleToggleActive(vendor.id)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                          title={vendor.active ? 'Deactivate' : 'Activate'}
                        >
                          {vendor.active ? (
                            <EyeSlashIcon className="h-5 w-5" />
                          ) : (
                            <EyeIcon className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => vendor.id && handleDelete(vendor.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete vendor"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorManagement;