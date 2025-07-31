import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface Service {
  id: number;
  service_name: string;
  service_category: string;
  display_order: number;
  description: string;
  active: boolean;
  is_calculated: boolean;
  calculation_type?: string;
  calculation_formula?: string;
  dependent_services?: string[];
  unit_type: string;
  created_at: string;
  mapping_count: number;
}

interface ServiceCategory {
  service_category: string;
  service_count: string;
}

const ServiceManagement: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCalculatedOnly, setShowCalculatedOnly] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryOperation, setCategoryOperation] = useState<'rename' | 'merge' | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    oldCategory: '',
    newCategory: '',
    targetCategory: ''
  });
  
  // Form states
  const [formData, setFormData] = useState({
    service_name: '',
    service_category: '',
    display_order: 999,
    description: '',
    active: true,
    is_calculated: false,
    calculation_type: 'percentage',
    calculation_formula: '',
    dependent_services: [] as string[],
    unit_type: 'count'
  });

  const calculationTypes = [
    { value: 'percentage', label: 'Percentage (%)' },
    { value: 'ratio', label: 'Ratio (÷)' },
    { value: 'sum', label: 'Sum (+)' },
    { value: 'difference', label: 'Difference (−)' },
    { value: 'average', label: 'Average' },
    { value: 'custom', label: 'Custom Formula' }
  ];

  const unitTypes = [
    { value: 'count', label: 'Count' },
    { value: 'currency', label: 'Currency ($)' },
    { value: 'percentage', label: 'Percentage (%)' },
    { value: 'hours', label: 'Hours' },
    { value: 'units', label: 'Units' }
  ];

  useEffect(() => {
    loadData();
  }, [selectedCategory, showCalculatedOnly]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (showCalculatedOnly) params.append('is_calculated', 'true');
      
      // Load services
      const servicesResponse = await api.get(`/services-management?${params}`);
      setServices(servicesResponse.data);
      
      // Load categories
      const categoriesResponse = await api.get('/services-management/categories');
      setCategories(categoriesResponse.data);
      
      // Load available services for calculations
      const availableResponse = await api.get('/services-management/available-for-calculation');
      setAvailableServices(availableResponse.data);
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      service_name: service.service_name,
      service_category: service.service_category,
      display_order: service.display_order,
      description: service.description || '',
      active: service.active,
      is_calculated: service.is_calculated,
      calculation_type: service.calculation_type || 'percentage',
      calculation_formula: service.calculation_formula || '',
      dependent_services: service.dependent_services || [],
      unit_type: service.unit_type || 'count'
    });
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingService(null);
    setFormData({
      service_name: '',
      service_category: '',
      display_order: 999,
      description: '',
      active: true,
      is_calculated: false,
      calculation_type: 'percentage',
      calculation_formula: '',
      dependent_services: [],
      unit_type: 'count'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingService) {
        await api.put(`/services-management/${editingService.id}`, formData);
      } else {
        await api.post('/services-management', formData);
      }
      
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save service');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    
    try {
      await api.delete(`/services-management/${id}`);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete service');
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      await api.put(`/services-management/${service.id}`, {
        active: !service.active
      });
      loadData();
    } catch (err) {
      setError('Failed to update service status');
    }
  };

  const generateFormula = () => {
    if (!formData.is_calculated || formData.dependent_services.length === 0) return;
    
    let formula = '';
    const services = formData.dependent_services;
    
    switch (formData.calculation_type) {
      case 'percentage':
        if (services.length >= 2) {
          formula = `(${services.slice(0, -1).join(' + ')}) / ${services[services.length - 1]} * 100`;
        }
        break;
      case 'ratio':
        if (services.length >= 2) {
          formula = `${services[0]} / ${services[1]}`;
        }
        break;
      case 'sum':
        formula = services.join(' + ');
        break;
      case 'difference':
        if (services.length >= 2) {
          formula = `${services[0]} - ${services.slice(1).join(' - ')}`;
        }
        break;
      case 'average':
        formula = `(${services.join(' + ')}) / ${services.length}`;
        break;
    }
    
    setFormData({ ...formData, calculation_formula: formula });
  };

  const validateFormula = async () => {
    if (!formData.calculation_formula || !formData.dependent_services.length) {
      setError('Please enter a formula and select dependent services');
      return;
    }
    
    try {
      const response = await api.post('/services-management/validate-formula', {
        formula: formData.calculation_formula,
        dependent_services: formData.dependent_services
      });
      
      if (response.data.valid) {
        alert('Formula is valid!');
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError('Failed to validate formula');
    }
  };

  const handleCategoryRename = async () => {
    if (!categoryForm.oldCategory || !categoryForm.newCategory) {
      setError('Please select a category to rename and enter a new name');
      return;
    }

    try {
      await api.put('/services-management/categories/rename', {
        oldCategory: categoryForm.oldCategory,
        newCategory: categoryForm.newCategory
      });
      
      alert(`Successfully renamed "${categoryForm.oldCategory}" to "${categoryForm.newCategory}"`);
      setCategoryForm({ oldCategory: '', newCategory: '', targetCategory: '' });
      setCategoryOperation(null);
      loadData();
    } catch (err) {
      setError('Failed to rename category');
    }
  };

  const handleCategoryMerge = async () => {
    if (!categoryForm.oldCategory || !categoryForm.targetCategory) {
      setError('Please select categories to merge');
      return;
    }

    if (categoryForm.oldCategory === categoryForm.targetCategory) {
      setError('Cannot merge a category with itself');
      return;
    }

    try {
      await api.put('/services-management/categories/merge', {
        sourceCategory: categoryForm.oldCategory,
        targetCategory: categoryForm.targetCategory
      });
      
      alert(`Successfully merged "${categoryForm.oldCategory}" into "${categoryForm.targetCategory}"`);
      setCategoryForm({ oldCategory: '', newCategory: '', targetCategory: '' });
      setCategoryOperation(null);
      loadData();
    } catch (err) {
      setError('Failed to merge categories');
    }
  };

  if (loading) {
    return <div className="p-4">Loading services...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Service Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCategoryManager(!showCategoryManager)}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Manage Categories
          </button>
          <button
            onClick={handleCreate}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Add New Service
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Category Manager */}
      {showCategoryManager && (
        <div className="bg-white p-4 rounded shadow mb-6">
          <h3 className="text-lg font-bold mb-4">Category Management</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Operation</label>
            <div className="flex gap-4">
              <button
                onClick={() => setCategoryOperation('rename')}
                className={`px-4 py-2 rounded ${
                  categoryOperation === 'rename'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Rename Category
              </button>
              <button
                onClick={() => setCategoryOperation('merge')}
                className={`px-4 py-2 rounded ${
                  categoryOperation === 'merge'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Merge Categories
              </button>
            </div>
          </div>

          {categoryOperation === 'rename' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category to Rename</label>
                <select
                  value={categoryForm.oldCategory}
                  onChange={(e) => setCategoryForm({ ...categoryForm, oldCategory: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.service_category} value={cat.service_category}>
                      {cat.service_category} ({cat.service_count} services)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Name</label>
                <input
                  type="text"
                  value={categoryForm.newCategory}
                  onChange={(e) => setCategoryForm({ ...categoryForm, newCategory: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Enter new category name"
                />
              </div>
              <div className="col-span-2">
                <button
                  onClick={handleCategoryRename}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Rename Category
                </button>
              </div>
            </div>
          )}

          {categoryOperation === 'merge' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category to Merge From</label>
                <select
                  value={categoryForm.oldCategory}
                  onChange={(e) => setCategoryForm({ ...categoryForm, oldCategory: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select source category</option>
                  {categories.map((cat) => (
                    <option key={cat.service_category} value={cat.service_category}>
                      {cat.service_category} ({cat.service_count} services)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Merge Into Category</label>
                <select
                  value={categoryForm.targetCategory}
                  onChange={(e) => setCategoryForm({ ...categoryForm, targetCategory: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select target category</option>
                  {categories
                    .filter(cat => cat.service_category !== categoryForm.oldCategory)
                    .map((cat) => (
                      <option key={cat.service_category} value={cat.service_category}>
                        {cat.service_category} ({cat.service_count} services)
                      </option>
                    ))}
                </select>
              </div>
              <div className="col-span-2">
                <button
                  onClick={handleCategoryMerge}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Merge Categories
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  This will move all services from "{categoryForm.oldCategory}" to "{categoryForm.targetCategory}"
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="flex gap-4 items-center">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.service_category} value={cat.service_category}>
                  {cat.service_category} ({cat.service_count})
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="calculated"
              checked={showCalculatedOnly}
              onChange={(e) => setShowCalculatedOnly(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="calculated">Show Calculated Services Only</label>
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mappings
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {services.map((service) => (
              <tr key={service.id} className={!service.active ? 'bg-gray-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {service.service_name}
                    </div>
                    {service.description && (
                      <div className="text-sm text-gray-500">{service.description}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {service.service_category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {service.is_calculated ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                      Calculated ({service.calculation_type})
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      Standard
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {service.unit_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {service.mapping_count || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleActive(service)}
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      service.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {service.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(service)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    Edit
                  </button>
                  {service.mapping_count === 0 && (
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold mb-4">
              {editingService ? 'Edit Service' : 'Create New Service'}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Service Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.service_name}
                    onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.service_category}
                    onChange={(e) => setFormData({ ...formData, service_category: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map((cat) => (
                      <option key={cat.service_category} value={cat.service_category} />
                    ))}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Display Order</label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Unit Type</label>
                  <select
                    value={formData.unit_type}
                    onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    {unitTypes.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    rows={2}
                  />
                </div>
                
                <div className="col-span-2 flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                      className="rounded"
                    />
                    Active
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_calculated}
                      onChange={(e) => setFormData({ ...formData, is_calculated: e.target.checked })}
                      className="rounded"
                    />
                    Calculated Service/KPI
                  </label>
                </div>
                
                {/* Calculated Service Fields */}
                {formData.is_calculated && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Calculation Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.calculation_type}
                        onChange={(e) => setFormData({ ...formData, calculation_type: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        required
                      >
                        {calculationTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Dependent Services <span className="text-red-500">*</span>
                      </label>
                      <select
                        multiple
                        value={formData.dependent_services}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          setFormData({ ...formData, dependent_services: selected });
                        }}
                        className="w-full border rounded px-3 py-2"
                        size={5}
                        required
                      >
                        {availableServices.map((service) => (
                          <option key={service.id} value={service.service_name}>
                            {service.service_name} ({service.service_category})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Hold Ctrl/Cmd to select multiple services
                      </p>
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">
                        Calculation Formula <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.calculation_formula}
                          onChange={(e) => setFormData({ ...formData, calculation_formula: e.target.value })}
                          className="flex-1 border rounded px-3 py-2"
                          placeholder="e.g., (Service A + Service B) / Service C * 100"
                          required
                        />
                        <button
                          type="button"
                          onClick={generateFormula}
                          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                        >
                          Generate
                        </button>
                        <button
                          type="button"
                          onClick={validateFormula}
                          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                        >
                          Validate
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Use service names exactly as shown. Supported operators: + - * / ( )
                      </p>
                    </div>
                    
                    {formData.dependent_services.length > 0 && (
                      <div className="col-span-2 bg-gray-50 p-3 rounded">
                        <p className="text-sm font-medium mb-2">Selected Services:</p>
                        <div className="flex flex-wrap gap-2">
                          {formData.dependent_services.map((service) => (
                            <span
                              key={service}
                              className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                            >
                              {service}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  {editingService ? 'Update' : 'Create'} Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceManagement;