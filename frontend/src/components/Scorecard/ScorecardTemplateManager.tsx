import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import ScorecardTemplateEditor from './ScorecardTemplateEditor';

interface ScorecardTemplate {
  id: number;
  market_id?: number;
  template_name: string;
  is_default: boolean;
  market_name?: string;
  created_at: string;
  updated_at: string;
}

interface Market {
  id: number;
  name: string;
}

const ScorecardTemplateManager: React.FC = () => {
  const { user, token } = useAuth();
  const [templates, setTemplates] = useState<ScorecardTemplate[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ScorecardTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form state for creating new template
  const [newTemplate, setNewTemplate] = useState({
    market_id: '',
    template_name: '',
    copy_from_template_id: ''
  });

  useEffect(() => {
    loadTemplates();
    loadMarkets();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scorecard-templates`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load scorecard templates');
    }
  };

  const loadMarkets = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/markets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMarkets(data.markets || data || []);
      }
    } catch (err) {
      console.error('Error loading markets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTemplate.market_id || !newTemplate.template_name) {
      alert('Please select a market and enter a template name');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scorecard-templates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          market_id: parseInt(newTemplate.market_id),
          template_name: newTemplate.template_name,
          copy_from_template_id: newTemplate.copy_from_template_id ? parseInt(newTemplate.copy_from_template_id) : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create template');
      }

      setCreateModalOpen(false);
      setNewTemplate({ market_id: '', template_name: '', copy_from_template_id: '' });
      loadTemplates();
    } catch (err) {
      console.error('Error creating template:', err);
      alert(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  const handleDeleteTemplate = async (template: ScorecardTemplate) => {
    if (template.is_default) {
      alert('Cannot delete the default template');
      return;
    }

    if (!confirm(`Are you sure you want to delete the template "${template.template_name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scorecard-templates/${template.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }

      loadTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  const handleEditTemplate = (template: ScorecardTemplate) => {
    setSelectedTemplate(template);
    setEditorOpen(true);
  };

  const getMarketWithoutTemplate = () => {
    const templatedMarketIds = templates
      .filter(t => !t.is_default && t.market_id)
      .map(t => t.market_id);
    
    return markets.filter(m => !templatedMarketIds.includes(m.id));
  };

  const canManageTemplates = () => {
    return ['admin', 'administrator'].includes(user?.role || '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!canManageTemplates()) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        You don't have permission to manage scorecard templates.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Cog6ToothIcon className="h-8 w-8 mr-2 text-blue-600" />
            Scorecard Templates
          </h2>
          <p className="text-gray-600 mt-1">
            Customize advisor scorecards for each market
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="btn btn-primary flex items-center"
          disabled={getMarketWithoutTemplate().length === 0}
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Create Template
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Templates List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Templates</h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`border rounded-lg p-4 ${
                  template.is_default 
                    ? 'border-blue-200 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-lg font-medium text-gray-900">
                        {template.template_name}
                      </h4>
                      {template.is_default && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {template.is_default 
                        ? 'Used when no market-specific template exists'
                        : `Market: ${template.market_name || 'Unknown'}`
                      }
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Updated: {new Date(template.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit template"
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    
                    {!template.is_default && (
                      <button
                        onClick={() => handleDeleteTemplate(template)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete template"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Template Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create New Template</h3>
            </div>
            
            <form onSubmit={handleCreateTemplate} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Market
                  </label>
                  <select
                    value={newTemplate.market_id}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, market_id: e.target.value }))}
                    className="form-select w-full"
                    required
                  >
                    <option value="">Select a market</option>
                    {getMarketWithoutTemplate().map(market => (
                      <option key={market.id} value={market.id}>
                        {market.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={newTemplate.template_name}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, template_name: e.target.value }))}
                    className="form-input w-full"
                    placeholder="Enter template name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Copy From (Optional)
                  </label>
                  <select
                    value={newTemplate.copy_from_template_id}
                    onChange={(e) => setNewTemplate(prev => ({ ...prev, copy_from_template_id: e.target.value }))}
                    className="form-select w-full"
                  >
                    <option value="">Default Template</option>
                    {templates.filter(t => t.id.toString() !== newTemplate.copy_from_template_id).map(template => (
                      <option key={template.id} value={template.id}>
                        {template.template_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Create Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Editor */}
      {editorOpen && selectedTemplate && (
        <ScorecardTemplateEditor
          template={selectedTemplate}
          onClose={() => {
            setEditorOpen(false);
            setSelectedTemplate(null);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
};

export default ScorecardTemplateManager;