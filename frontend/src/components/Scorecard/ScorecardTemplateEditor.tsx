import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
  EyeSlashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface TemplateField {
  id?: number;
  field_key: string;
  field_label: string;
  field_type: 'kpi' | 'service';
  field_format: 'currency' | 'percentage' | 'number';
  display_order: number;
  is_enabled: boolean;
  show_goal: boolean;
}

interface TemplateCategory {
  id?: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  display_order: number;
  is_enabled: boolean;
  fields: TemplateField[];
  isExpanded?: boolean;
}

interface Template {
  id: number;
  market_id?: number;
  template_name: string;
  is_default: boolean;
  market_name?: string;
  categories: TemplateCategory[];
}

interface AvailableField {
  key: string;
  label: string;
  format?: string;
  category?: string;
  description?: string;
  is_calculated?: boolean;
  calculation_formula?: string;
  unit_type?: string;
}

interface ServiceCategory {
  service_category: string;
  service_count: string;
}

interface AvailableFields {
  kpis: AvailableField[];
  services: AvailableField[];
  categories?: ServiceCategory[];
}

interface ScorecardTemplateEditorProps {
  template: Template;
  onClose: () => void;
}

const CATEGORY_ICONS = [
  '📊', '🛢️', '🔧', '⚙️', '🔋', '🔍', '💰', '🎯', '📈', '🚗', '⚡', '🔥', '💎', '🏆', '⭐'
];

const CATEGORY_COLORS = [
  'blue', 'amber', 'red', 'green', 'purple', 'gray', 'indigo', 'pink', 'yellow', 'teal', 'orange', 'emerald'
];

const ScorecardTemplateEditor: React.FC<ScorecardTemplateEditorProps> = ({ template, onClose }) => {
  const { token } = useAuth();
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [templateName, setTemplateName] = useState(template.template_name);
  const [availableFields, setAvailableFields] = useState<AvailableFields>({ kpis: [], services: [], categories: [] });
  const [availableServiceCategories, setAvailableServiceCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTemplateData();
    loadAvailableFields();
  }, []);

  const loadTemplateData = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scorecard-templates/${template.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const categoriesWithExpanded = data.categories.map((cat: TemplateCategory) => ({
          ...cat,
          isExpanded: true
        }));
        setCategories(categoriesWithExpanded);
      }
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load template data');
    }
  };

  const loadAvailableFields = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scorecard-templates/available-fields`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableFields(data);
        
        // Extract unique service categories for the dropdown
        if (data.categories) {
          const categoryNames = data.categories.map((cat: ServiceCategory) => cat.service_category);
          setAvailableServiceCategories(categoryNames);
        }
      } else {
        const errorText = await response.text();
        console.error('Available fields API error:', response.status, errorText);
        setError(`Failed to load available fields: ${response.status} ${errorText}`);
      }
    } catch (err) {
      console.error('Error loading available fields:', err);
      setError(`Network error loading available fields: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scorecard-templates/${template.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          template_name: templateName,
          categories: categories.map(cat => ({
            ...cat,
            fields: cat.fields?.map(field => ({
              ...field,
              display_order: field.display_order
            })) || []
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save template');
      }

      onClose();
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    // Find a category name that hasn't been used yet
    const usedCategories = categories.map(c => c.category_name);
    const availableCategory = availableServiceCategories.find(cat => !usedCategories.includes(cat));
    
    const newCategory: TemplateCategory = {
      category_name: availableCategory || 'New Category',
      category_icon: '📊',
      category_color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
      display_order: categories.length + 1,
      is_enabled: true,
      fields: [],
      isExpanded: true
    };
    setCategories([...categories, newCategory]);
  };

  const updateCategory = (index: number, updates: Partial<TemplateCategory>) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], ...updates };
    setCategories(updated);
  };

  const deleteCategory = (index: number) => {
    if (confirm('Are you sure you want to delete this category?')) {
      setCategories(categories.filter((_, i) => i !== index));
    }
  };

  const moveCategoryUp = (index: number) => {
    if (index > 0) {
      const updated = [...categories];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      setCategories(updated);
    }
  };

  const moveCategoryDown = (index: number) => {
    if (index < categories.length - 1) {
      const updated = [...categories];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      setCategories(updated);
    }
  };

  const toggleCategoryExpanded = (index: number) => {
    updateCategory(index, { isExpanded: !categories[index].isExpanded });
  };

  const addFieldToCategory = (categoryIndex: number, field: AvailableField) => {
    const category = categories[categoryIndex];
    const existingField = category.fields?.find(f => f.field_key === field.key);
    
    if (existingField) {
      alert('This field is already added to this category');
      return;
    }

    const newField: TemplateField = {
      field_key: field.key,
      field_label: field.label,
      field_type: availableFields.kpis.some(k => k.key === field.key) ? 'kpi' : 'service',
      field_format: field.format as 'currency' | 'percentage' | 'number' || 'number',
      display_order: (category.fields?.length || 0) + 1,
      is_enabled: true,
      show_goal: true
    };

    const updatedFields = [...(category.fields || []), newField];
    updateCategory(categoryIndex, { fields: updatedFields });
  };

  const addAllServicesFromCategory = (categoryIndex: number, serviceCategoryName: string) => {
    const category = categories[categoryIndex];
    const categoryServices = availableFields.services.filter(service => service.category === serviceCategoryName);
    const categoryKpis = availableFields.kpis.filter(kpi => kpi.category === serviceCategoryName);
    const allFields = [...categoryServices, ...categoryKpis];
    
    if (allFields.length === 0) {
      alert(`No services found for category: ${serviceCategoryName}`);
      return;
    }

    // Filter out fields that are already added
    const existingFieldKeys = new Set((category.fields || []).map(f => f.field_key));
    const newFields = allFields.filter(field => !existingFieldKeys.has(field.key));
    
    if (newFields.length === 0) {
      alert('All services from this category are already added');
      return;
    }

    // Create template fields for all new services
    const templateFields: TemplateField[] = newFields.map((field, index) => ({
      field_key: field.key,
      field_label: field.label,
      field_type: availableFields.kpis.some(k => k.key === field.key) ? 'kpi' : 'service',
      field_format: field.format as 'currency' | 'percentage' | 'number' || 'number',
      display_order: (category.fields?.length || 0) + index + 1,
      is_enabled: true,
      show_goal: true
    }));

    const updatedFields = [...(category.fields || []), ...templateFields];
    updateCategory(categoryIndex, { fields: updatedFields });
    
    alert(`Added ${newFields.length} services from ${serviceCategoryName} category`);
  };

  const getServicesForCategory = (categoryName: string) => {
    const categoryServices = availableFields.services.filter(service => service.category === categoryName);
    const categoryKpis = availableFields.kpis.filter(kpi => kpi.category === categoryName);
    return [...categoryServices, ...categoryKpis];
  };

  const updateField = (categoryIndex: number, fieldIndex: number, updates: Partial<TemplateField>) => {
    const category = categories[categoryIndex];
    const updatedFields = [...(category.fields || [])];
    updatedFields[fieldIndex] = { ...updatedFields[fieldIndex], ...updates };
    updateCategory(categoryIndex, { fields: updatedFields });
  };

  const deleteField = (categoryIndex: number, fieldIndex: number) => {
    const category = categories[categoryIndex];
    const updatedFields = (category.fields || []).filter((_, i) => i !== fieldIndex);
    updateCategory(categoryIndex, { fields: updatedFields });
  };

  const moveFieldUp = (categoryIndex: number, fieldIndex: number) => {
    if (fieldIndex > 0) {
      const category = categories[categoryIndex];
      const updatedFields = [...(category.fields || [])];
      [updatedFields[fieldIndex - 1], updatedFields[fieldIndex]] = [updatedFields[fieldIndex], updatedFields[fieldIndex - 1]];
      updateCategory(categoryIndex, { fields: updatedFields });
    }
  };

  const moveFieldDown = (categoryIndex: number, fieldIndex: number) => {
    const category = categories[categoryIndex];
    if (fieldIndex < (category.fields?.length || 0) - 1) {
      const updatedFields = [...(category.fields || [])];
      [updatedFields[fieldIndex], updatedFields[fieldIndex + 1]] = [updatedFields[fieldIndex + 1], updatedFields[fieldIndex]];
      updateCategory(categoryIndex, { fields: updatedFields });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Scorecard Template</h2>
            <p className="text-sm text-gray-600 mt-1">
              {template.is_default ? 'Default Template' : `${template.market_name} Template`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Main Editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Template Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="form-input w-full max-w-md"
                placeholder="Enter template name"
              />
            </div>

            {/* Categories */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-500">
                    {categories.length} of {availableServiceCategories.length} available
                  </div>
                  <button
                    onClick={addCategory}
                    className="btn btn-secondary text-sm flex items-center"
                    disabled={categories.length >= availableServiceCategories.length}
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Category
                  </button>
                </div>
              </div>

              {categories.map((category, categoryIndex) => (
                <div key={categoryIndex} className="border border-gray-200 rounded-lg">
                  {/* Category Header */}
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <button
                        onClick={() => toggleCategoryExpanded(categoryIndex)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        {category.isExpanded ? (
                          <ChevronUpIcon className="h-4 w-4" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4" />
                        )}
                      </button>

                      <select
                        value={category.category_icon}
                        onChange={(e) => updateCategory(categoryIndex, { category_icon: e.target.value })}
                        className="text-lg"
                      >
                        {CATEGORY_ICONS.map(icon => (
                          <option key={icon} value={icon}>{icon}</option>
                        ))}
                      </select>

                      <div className="flex items-center space-x-2 flex-1 max-w-md">
                        <select
                          value={category.category_name}
                          onChange={(e) => updateCategory(categoryIndex, { category_name: e.target.value })}
                          className="form-select flex-1"
                        >
                          <option value={category.category_name}>{category.category_name}</option>
                          {availableServiceCategories
                            .filter(cat => !categories.some((c, idx) => idx !== categoryIndex && c.category_name === cat))
                            .map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        
                        {/* Bulk add button for services in this category */}
                        <button
                          onClick={() => addAllServicesFromCategory(categoryIndex, category.category_name)}
                          className="btn btn-sm bg-green-100 text-green-700 hover:bg-green-200 border-green-300 flex items-center"
                          title={`Add all services from ${category.category_name} category`}
                        >
                          <PlusCircleIcon className="h-3 w-3 mr-1" />
                          <span className="text-xs">Add All</span>
                        </button>
                      </div>

                      <select
                        value={category.category_color}
                        onChange={(e) => updateCategory(categoryIndex, { category_color: e.target.value })}
                        className="form-select"
                      >
                        {CATEGORY_COLORS.map(color => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </select>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={category.is_enabled}
                          onChange={(e) => updateCategory(categoryIndex, { is_enabled: e.target.checked })}
                          className="form-checkbox"
                        />
                        <span className="ml-2 text-sm text-gray-700">Enabled</span>
                      </label>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => moveCategoryUp(categoryIndex)}
                        disabled={categoryIndex === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        title="Move up"
                      >
                        <ArrowUpIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveCategoryDown(categoryIndex)}
                        disabled={categoryIndex === categories.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        title="Move down"
                      >
                        <ArrowDownIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteCategory(categoryIndex)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete category"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Category Fields */}
                  {category.isExpanded && (
                    <div className="p-4">
                      <div className="space-y-2">
                        {(category.fields || []).map((field, fieldIndex) => (
                          <div key={fieldIndex} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                            <span className="text-xs text-gray-500 w-8">{fieldIndex + 1}</span>
                            
                            <input
                              type="text"
                              value={field.field_label}
                              onChange={(e) => updateField(categoryIndex, fieldIndex, { field_label: e.target.value })}
                              className="form-input flex-1"
                              placeholder="Field label"
                            />

                            <select
                              value={field.field_format}
                              onChange={(e) => updateField(categoryIndex, fieldIndex, { field_format: e.target.value as any })}
                              className="form-select w-24"
                            >
                              <option value="number">Number</option>
                              <option value="currency">Currency</option>
                              <option value="percentage">Percentage</option>
                            </select>

                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={field.is_enabled}
                                onChange={(e) => updateField(categoryIndex, fieldIndex, { is_enabled: e.target.checked })}
                                className="form-checkbox"
                              />
                              <span className="ml-1 text-xs text-gray-700">Show</span>
                            </label>

                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={field.show_goal}
                                onChange={(e) => updateField(categoryIndex, fieldIndex, { show_goal: e.target.checked })}
                                className="form-checkbox"
                              />
                              <span className="ml-1 text-xs text-gray-700">Goal</span>
                            </label>

                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => moveFieldUp(categoryIndex, fieldIndex)}
                                disabled={fieldIndex === 0}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                title="Move up"
                              >
                                <ArrowUpIcon className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => moveFieldDown(categoryIndex, fieldIndex)}
                                disabled={fieldIndex === (category.fields?.length || 0) - 1}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                title="Move down"
                              >
                                <ArrowDownIcon className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => deleteField(categoryIndex, fieldIndex)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Delete field"
                              >
                                <TrashIcon className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {(category.fields?.length || 0) === 0 && (
                          <div className="text-center py-4">
                            <p className="text-sm text-gray-500 mb-2">
                              No fields added. Select fields from the panel on the right.
                            </p>
                            {/* Show available services count for this category */}
                            {(() => {
                              const availableServices = getServicesForCategory(category.category_name);
                              if (availableServices.length > 0) {
                                return (
                                  <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 inline-block">
                                    {availableServices.length} service{availableServices.length !== 1 ? 's' : ''} available in {category.category_name}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Available Fields Panel */}
          <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Available Fields</h3>
              
              {/* KPIs */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">📊 KPIs</h4>
                <div className="space-y-1">
                  {availableFields.kpis?.length > 0 ? availableFields.kpis.map((kpi) => (
                    <div key={kpi.key} className="flex items-center justify-between p-2 bg-white rounded border text-sm hover:border-gray-300">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span>{kpi.label}</span>
                          {kpi.is_calculated && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded" title={kpi.calculation_formula}>calc</span>
                          )}
                        </div>
                        {kpi.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{kpi.description}</div>
                        )}
                      </div>
                      <select
                        onChange={(e) => {
                          const categoryIndex = parseInt(e.target.value);
                          if (categoryIndex >= 0) {
                            addFieldToCategory(categoryIndex, kpi);
                            e.target.value = '';
                          }
                        }}
                        value=""
                        className="form-select text-xs w-20"
                      >
                        <option value="">Add to...</option>
                        {categories.map((cat, index) => (
                          <option key={index} value={index}>{cat.category_name}</option>
                        ))}
                      </select>
                    </div>
                  )) : (
                    <div className="text-sm text-gray-500 italic">No KPIs available</div>
                  )}
                </div>
              </div>

              {/* Services by Category */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">🔧 Services by Category</h4>
                {availableServiceCategories
                  .filter(categoryName => categoryName !== 'Core Metrics' && categoryName !== 'Calculated KPIs')
                  .map((categoryName) => {
                    const categoryServices = getServicesForCategory(categoryName);
                    if (categoryServices.length === 0) return null;
                    
                    return (
                      <div key={categoryName} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-medium text-gray-600">{categoryName}</h5>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500">({categoryServices.length})</span>
                            <select
                              onChange={(e) => {
                                const categoryIndex = parseInt(e.target.value);
                                if (categoryIndex >= 0) {
                                  addAllServicesFromCategory(categoryIndex, categoryName);
                                  e.target.value = '';
                                }
                              }}
                              value=""
                              className="form-select text-xs w-16"
                              title={`Add all ${categoryName} services to category`}
                            >
                              <option value="">+ All</option>
                              {categories.map((cat, index) => (
                                <option key={index} value={index}>{cat.category_name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1 pl-2 border-l-2 border-gray-200">
                          {categoryServices.map((service) => (
                            <div key={service.key} className="flex items-center justify-between p-2 bg-white rounded border text-sm hover:border-gray-300">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span>{service.label}</span>
                                  {service.is_calculated && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded" title={service.calculation_formula}>calc</span>
                                  )}
                                </div>
                                {service.description && (
                                  <div className="text-xs text-gray-400 mt-0.5">{service.description}</div>
                                )}
                              </div>
                              <select
                                onChange={(e) => {
                                  const categoryIndex = parseInt(e.target.value);
                                  if (categoryIndex >= 0) {
                                    addFieldToCategory(categoryIndex, service);
                                    e.target.value = '';
                                  }
                                }}
                                value=""
                                className="form-select text-xs w-16"
                              >
                                <option value="">+</option>
                                {categories.map((cat, index) => (
                                  <option key={index} value={index}>{cat.category_name}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                
                {/* Show ungrouped services if any */}
                {availableFields.services?.filter(service => !service.category || service.category === '').length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-600 mb-2">Other Services</h5>
                    <div className="space-y-1">
                      {availableFields.services
                        .filter(service => !service.category || service.category === '')
                        .map((service) => (
                          <div key={service.key} className="flex items-center justify-between p-2 bg-white rounded border text-sm hover:border-gray-300">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span>{service.label}</span>
                                {service.is_calculated && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded" title={service.calculation_formula}>calc</span>
                                )}
                              </div>
                              {service.description && (
                                <div className="text-xs text-gray-400 mt-0.5">{service.description}</div>
                              )}
                            </div>
                            <select
                              onChange={(e) => {
                                const categoryIndex = parseInt(e.target.value);
                                if (categoryIndex >= 0) {
                                  addFieldToCategory(categoryIndex, service);
                                  e.target.value = '';
                                }
                              }}
                              value=""
                              className="form-select text-xs w-16"
                            >
                              <option value="">+</option>
                              {categories.map((cat, index) => (
                                <option key={index} value={index}>{cat.category_name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              'Save Template'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScorecardTemplateEditor;