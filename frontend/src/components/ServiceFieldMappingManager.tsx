import React, { useState, useEffect } from 'react';
import { 
  CloudArrowUpIcon as Upload,
  DocumentArrowDownIcon as Download,
  EyeIcon as Eye,
  DocumentIcon as Save,
  ArrowPathIcon as RefreshCw,
  ExclamationTriangleIcon as AlertCircle,
  CheckCircleIcon as CheckCircle,
  ArrowRightIcon as ArrowRight
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface FieldMapping {
  id?: number;
  spreadsheet_header: string;
  scorecard_field_key: string;
  field_type: 'direct' | 'nested' | 'calculated' | 'percentage';
  data_field_name: string;
  display_label: string;
  is_percentage: boolean;
  is_active: boolean;
}

interface DiscoveredHeader {
  header_name: string;
  column_position: number;
  sample_values: string[];
  is_mapped: boolean;
}

interface ServiceFieldMappingManagerProps {
  marketId?: number;
}

const ServiceFieldMappingManager: React.FC<ServiceFieldMappingManagerProps> = ({ marketId }) => {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [discoveredHeaders, setDiscoveredHeaders] = useState<DiscoveredHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'mappings' | 'discover' | 'preview'>('mappings');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingMapping, setEditingMapping] = useState<FieldMapping | null>(null);
  const [showNewMapping, setShowNewMapping] = useState(false);

  // Field type options
  const fieldTypes = [
    { value: 'direct', label: 'Direct Mapping' },
    { value: 'nested', label: 'Nested (Other Services)' },
    { value: 'calculated', label: 'Calculated Field' },
    { value: 'percentage', label: 'Percentage Field' }
  ];

  // Common scorecard field options
  const scorecardFields = [
    'sales', 'oilchange', 'premiumoilchange', 'brakeflush', 'brakeservice',
    'transmission', 'differentialservice', 'coolantflush', 'powersteering',
    'batterytest', 'beltsandhoses', 'airfilter', 'cabinfilter', 'sparkplugs',
    'fuelinjection', 'alignment', 'tirerotation', 'oilchangerevenue',
    'brakeflushrevenue', 'transmissionrevenue', 'coolantflushrevenue'
  ];

  useEffect(() => {
    loadMappings();
  }, [marketId]);

  const loadMappings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/field-mappings/${marketId || 'default'}`);
      setMappings(response.data.mappings || response.data);
    } catch (error) {
      console.error('Error loading field mappings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/field-mappings/discover-headers', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Extract headers from all sheets
      const allHeaders = [];
      if (response.data.sheets) {
        for (const [sheetName, headers] of Object.entries(response.data.sheets)) {
          allHeaders.push(...(headers as any[]));
        }
      }
      setDiscoveredHeaders(allHeaders);
      setActiveTab('discover');
    } catch (error) {
      console.error('Error discovering headers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMapping = async (mapping: FieldMapping) => {
    try {
      const mappingData = {
        ...mapping,
        data_field_name: mapping.data_field_name || mapping.scorecard_field_key
      };

      if (mapping.id) {
        // Check if we're editing a default mapping or creating a market override
        if (!marketId || marketId === 'default') {
          // Update default mapping directly
          await api.put(`/field-mappings/default/${mapping.id}`, mappingData);
        } else {
          // Create market-specific override
          await api.post(`/field-mappings/${marketId}`, {
            mappings: [mappingData],
            action: 'insert'
          });
        }
      } else {
        // Create new mapping
        if (!marketId || marketId === 'default') {
          // This would require a new endpoint for creating default mappings
          console.warn('Creating new default mappings not yet supported');
          return;
        } else {
          await api.post(`/field-mappings/${marketId}`, {
            mappings: [mappingData],
            action: 'insert'
          });
        }
      }
      
      await loadMappings();
      setEditingMapping(null);
      setShowNewMapping(false);
    } catch (error) {
      console.error('Error saving mapping:', error);
      alert('Failed to save mapping. Please check the console for details.');
    }
  };

  const handlePreviewMapping = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('mappings', JSON.stringify(mappings));
      
      const response = await api.post('/field-mappings/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setPreviewData(response.data);
      setActiveTab('preview');
    } catch (error) {
      console.error('Error previewing mappings:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderMappingForm = (mapping: FieldMapping, onSave: (mapping: FieldMapping) => void, onCancel: () => void) => {
    // Use editingMapping state for the form values instead of the parameter
    const currentMapping = editingMapping || mapping;
    
    return (
      <div className="bg-gray-50 p-4 rounded-lg border">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spreadsheet Header
            </label>
            <input
              type="text"
              value={currentMapping.spreadsheet_header}
              onChange={(e) => setEditingMapping({ ...currentMapping, spreadsheet_header: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scorecard Field
            </label>
            <select
              value={currentMapping.scorecard_field_key}
              onChange={(e) => setEditingMapping({ ...currentMapping, scorecard_field_key: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select field...</option>
              {scorecardFields.map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Type
            </label>
            <select
              value={currentMapping.field_type}
              onChange={(e) => setEditingMapping({ ...currentMapping, field_type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {fieldTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Label
            </label>
            <input
              type="text"
              value={currentMapping.display_label}
              onChange={(e) => setEditingMapping({ ...currentMapping, display_label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="col-span-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={currentMapping.is_percentage}
                onChange={(e) => setEditingMapping({ ...currentMapping, is_percentage: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">This field contains percentage values</span>
            </label>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(currentMapping)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Mapping
          </button>
        </div>
      </div>
    );
  };

  const renderMappingsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Current Field Mappings</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowNewMapping(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
          >
            <Upload className="w-4 h-4 mr-2" />
            Add Mapping
          </button>
          <button
            onClick={loadMappings}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {showNewMapping && renderMappingForm(
        {
          spreadsheet_header: '',
          scorecard_field_key: '',
          field_type: 'direct',
          data_field_name: '',
          display_label: '',
          is_percentage: false,
          is_active: true
        },
        handleSaveMapping,
        () => setShowNewMapping(false)
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Spreadsheet Header</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Scorecard Field</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Display Label</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mappings.map((mapping) => (
              <tr key={mapping.id || `${mapping.spreadsheet_header}-${mapping.scorecard_field_key}`}>
                <td className="px-4 py-3 text-sm text-gray-900">{mapping.spreadsheet_header}</td>
                <td className="px-4 py-3 text-sm text-gray-900 font-mono">{mapping.scorecard_field_key}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    mapping.field_type === 'direct' ? 'bg-green-100 text-green-800' :
                    mapping.field_type === 'nested' ? 'bg-blue-100 text-blue-800' :
                    mapping.field_type === 'calculated' ? 'bg-purple-100 text-purple-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {mapping.field_type}
                  </span>
                  {mapping.is_percentage && (
                    <span className="ml-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">%</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{mapping.display_label}</td>
                <td className="px-4 py-3 text-sm">
                  <button
                    onClick={() => setEditingMapping(mapping)}
                    className="text-blue-600 hover:text-blue-800 mr-3"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingMapping && renderMappingForm(
        editingMapping,
        handleSaveMapping,
        () => setEditingMapping(null)
      )}
    </div>
  );

  const renderDiscoverTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Discover Spreadsheet Headers</h3>
        <label className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center cursor-pointer">
          <Upload className="w-4 h-4 mr-2" />
          Upload Spreadsheet
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {selectedFile && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
            <span className="text-blue-800">File: {selectedFile.name}</span>
          </div>
        </div>
      )}

      {discoveredHeaders.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h4 className="text-md font-medium text-gray-900">Discovered Headers</h4>
            <p className="text-sm text-gray-600">Headers found in your spreadsheet with sample values</p>
          </div>
          <div className="divide-y divide-gray-200">
            {discoveredHeaders.map((header, index) => (
              <div key={index} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900 mr-3">
                      {header.header_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      Column {header.column_position}
                    </span>
                    {header.is_mapped && (
                      <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                        Mapped
                      </span>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
                <div className="mt-2">
                  <span className="text-xs text-gray-500">Sample values: </span>
                  <span className="text-xs text-gray-700">
                    {header.sample_values.slice(0, 3).join(', ')}
                    {header.sample_values.length > 3 && '...'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {discoveredHeaders.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handlePreviewMapping}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview Mapping
          </button>
        </div>
      )}
    </div>
  );

  const renderPreviewTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Mapping Preview</h3>
        <button
          onClick={handlePreviewMapping}
          disabled={!selectedFile}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Preview
        </button>
      </div>

      {previewData.length > 0 ? (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h4 className="text-md font-medium text-gray-900">
              Preview Results ({previewData.length} records)
            </h4>
            <p className="text-sm text-gray-600">First 5 records showing how data would be mapped</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(previewData[0] || {}).map(key => (
                    <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewData.slice(0, 5).map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value: any, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-2 text-gray-900">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No preview data available. Upload a file and click "Preview Mapping" to see results.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {[
            { key: 'mappings', label: 'Field Mappings', icon: Save },
            { key: 'discover', label: 'Discover Headers', icon: Upload },
            { key: 'preview', label: 'Preview Results', icon: Eye }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Loading...</span>
          </div>
        )}

        {!loading && (
          <>
            {activeTab === 'mappings' && renderMappingsTab()}
            {activeTab === 'discover' && renderDiscoverTab()}
            {activeTab === 'preview' && renderPreviewTab()}
          </>
        )}
      </div>
    </div>
  );
};

export default ServiceFieldMappingManager;