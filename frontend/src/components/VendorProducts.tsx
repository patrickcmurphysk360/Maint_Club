import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

interface VendorProduct {
  id?: number;
  vendor_id: number;
  branded_product_name: string;
  product_category: string;
  product_sku: string;
  description: string;
  price: number | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ProductCategory {
  id: number;
  category_name: string;
  display_order: number;
}

interface VendorPartner {
  id?: number;
  vendor_name: string;
  vendor_tag: string;
}

interface VendorProductsProps {
  vendor: VendorPartner;
}

const VendorProducts: React.FC<VendorProductsProps> = ({ vendor }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<VendorProduct>({
    vendor_id: vendor.id || 0,
    branded_product_name: '',
    product_category: '',
    product_sku: '',
    description: '',
    price: null,
    active: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    if (vendor.id) {
      loadData();
    }
  }, [vendor.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadProducts(),
        loadCategories()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5002/api/vendor-partners/${vendor.id}/products`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch products');
      
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      throw error;
    }
  };

  const loadCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5002/api/vendor-partners/categories/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch categories');
      
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
      throw error;
    }
  };

  const handleAdd = () => {
    setFormData({
      vendor_id: vendor.id || 0,
      branded_product_name: '',
      product_category: '',
      product_sku: '',
      description: '',
      price: null,
      active: true
    });
    setEditingId(null);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleEdit = (product: VendorProduct) => {
    setFormData(product);
    setEditingId(product.id || null);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5002/api/vendor-partners/${vendor.id}/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete product');
      }

      setSuccess('Product deleted successfully');
      await loadProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      setError(error.message || 'Failed to delete product');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.branded_product_name || !formData.product_category) {
      setError('Product name and category are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingId 
        ? `http://localhost:5002/api/vendor-partners/${vendor.id}/products/${editingId}`
        : `http://localhost:5002/api/vendor-partners/${vendor.id}/products`;
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save product');
      }

      setSuccess(editingId ? 'Product updated successfully' : 'Product created successfully');
      setShowForm(false);
      await loadProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      setError(error.message || 'Failed to save product');
    }
  };

  const handleChange = (field: keyof VendorProduct, value: string | number | boolean | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.branded_product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.product_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || product.product_category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const productsByCategory = categories.reduce((acc, category) => {
    acc[category.category_name] = filteredProducts.filter(p => p.product_category === category.category_name);
    return acc;
  }, {} as Record<string, VendorProduct[]>);

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
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <ShoppingBagIcon className="h-6 w-6 mr-2 text-blue-600" />
            Products ({products.length})
          </h3>
          <p className="text-gray-600 mt-1">
            Manage branded products for {vendor.vendor_name}
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Product
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search products by name, SKU, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input w-full"
          />
        </div>
        <div className="md:w-64">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="form-input w-full"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.category_name}>
                {category.category_name}
              </option>
            ))}
          </select>
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
          <h4 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Product' : 'New Product'}
          </h4>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  value={formData.branded_product_name}
                  onChange={(e) => handleChange('branded_product_name', e.target.value)}
                  className="form-input"
                  placeholder="e.g., BG MOA, Valvoline MaxLife"
                  required
                />
              </div>
              
              <div>
                <label className="form-label">Category *</label>
                <select
                  value={formData.product_category}
                  onChange={(e) => handleChange('product_category', e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.category_name}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Product SKU</label>
              <input
                type="text"
                value={formData.product_sku}
                onChange={(e) => handleChange('product_sku', e.target.value)}
                className="form-input"
                placeholder="e.g., BG-MOA-001, VAL-ML-5W30"
              />
              <p className="text-xs text-gray-500 mt-1">
                Stock Keeping Unit for inventory tracking
              </p>
            </div>

            <div>
              <label className="form-label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="form-input"
                rows={3}
                placeholder="Product description, benefits, usage notes..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Price (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price || ''}
                    onChange={(e) => handleChange('price', e.target.value ? parseFloat(e.target.value) : null)}
                    className="form-input pl-10"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex items-center pt-6">
                <input
                  type="checkbox"
                  id="productActive"
                  checked={formData.active}
                  onChange={(e) => handleChange('active', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="productActive" className="ml-2 block text-sm text-gray-900">
                  Active product
                </label>
              </div>
            </div>

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
                {editingId ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Products List */}
      <div className="space-y-6">
        {filteredProducts.length === 0 ? (
          <div className="card">
            <p className="text-gray-600 text-center py-8">
              {searchTerm || filterCategory ? 'No products found matching your criteria.' : 'No products found. Click "Add Product" to create one.'}
            </p>
          </div>
        ) : (
          categories.map(category => {
            const categoryProducts = productsByCategory[category.category_name];
            if (!categoryProducts || categoryProducts.length === 0) return null;

            return (
              <div key={category.id} className="card">
                <h4 className="text-lg font-semibold mb-4 text-gray-900">
                  {category.category_name} ({categoryProducts.length})
                </h4>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
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
                      {categoryProducts.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {product.branded_product_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {product.product_sku || '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate">
                              {product.description || '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {product.price ? `$${product.price.toFixed(2)}` : '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              product.active 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {product.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => handleEdit(product)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                title="Edit product"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => product.id && handleDelete(product.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Delete product"
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default VendorProducts;