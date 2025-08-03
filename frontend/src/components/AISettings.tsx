import React, { useState, useEffect } from 'react';
import { aiSettingsAPI } from '../services/api';

interface AISettings {
  database_settings: any;
  default_config: any;
}

interface CoachingTip {
  id: number;
  category: string;
  title: string;
  content: string;
  trigger_conditions: any;
  is_active: boolean;
  created_by: number;
  created_by_email: string;
  created_at: string;
  updated_at: string;
}

interface AvailableModel {
  name: string;
  size: string;
  modified_at: string | null;
}

const AISettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'prompts' | 'config' | 'coaching' | 'testing'>('prompts');
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [coachingTips, setCoachingTips] = useState<CoachingTip[]>([]);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // System Prompts State
  const [systemPrompts, setSystemPrompts] = useState({
    base: '',
    advisor: '',
    manager: '',
    admin: ''
  });

  // Agent Config State
  const [agentConfig, setAgentConfig] = useState({
    temperature: 0.1,
    top_k: 10,
    top_p: 0.3,
    num_predict: 2048,
    defaultModel: 'llama3.2:latest',
    timeout: 120000,
    maxContextTokens: 8000,
    maxResponseTokens: 1000
  });

  // Coaching Tip Form State
  const [newTip, setNewTip] = useState({
    category: '',
    title: '',
    content: '',
    trigger_conditions: '',
    is_active: true
  });

  // Testing State
  const [testPrompt, setTestPrompt] = useState({
    type: 'general',
    customPrompt: '',
    testUserId: '',
    result: ''
  });

  useEffect(() => {
    loadSettings();
    loadCoachingTips();
    loadAvailableModels();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await aiSettingsAPI.getConfig();
      setSettings(data);
      
      // Load system prompts
      if (data.database_settings.system_prompts) {
        setSystemPrompts(data.database_settings.system_prompts.value);
      } else if (data.default_config.system_prompts) {
        setSystemPrompts(data.default_config.system_prompts);
      }

      // Load agent config
      if (data.database_settings.agent_config) {
        setAgentConfig(prev => ({
          ...prev,
          ...data.database_settings.agent_config.value.generation,
          defaultModel: data.database_settings.agent_config.value.models.default,
          ...data.database_settings.agent_config.value.limits
        }));
      } else if (data.default_config.agent_config) {
        setAgentConfig(prev => ({
          ...prev,
          ...data.default_config.agent_config.generation,
          defaultModel: data.default_config.agent_config.models.default
        }));
      }

    } catch (error) {
      showMessage('error', 'Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  };

  const loadCoachingTips = async () => {
    try {
      const data = await aiSettingsAPI.getCoachingTips();
      setCoachingTips(data.tips || []);
    } catch (error) {
      showMessage('error', 'Failed to load coaching tips');
    }
  };

  const loadAvailableModels = async () => {
    try {
      const data = await aiSettingsAPI.getModels();
      setAvailableModels(data.models || []);
    } catch (error) {
      console.error('Failed to load available models:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const saveSystemPrompts = async () => {
    setSaving(true);
    try {
      await aiSettingsAPI.updateSystemPrompts(systemPrompts);
      showMessage('success', 'System prompts updated successfully');
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Failed to save system prompts');
    } finally {
      setSaving(false);
    }
  };

  const saveAgentConfig = async () => {
    setSaving(true);
    try {
      await aiSettingsAPI.updateAgentConfig(agentConfig);
      showMessage('success', 'AI agent configuration updated successfully');
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Failed to save agent configuration');
    } finally {
      setSaving(false);
    }
  };

  const saveCoachingTip = async () => {
    if (!newTip.category || !newTip.title || !newTip.content) {
      showMessage('error', 'Category, title, and content are required');
      return;
    }

    setSaving(true);
    try {
      const tipData = {
        ...newTip,
        trigger_conditions: newTip.trigger_conditions ? JSON.parse(newTip.trigger_conditions) : null
      };
      
      await aiSettingsAPI.createCoachingTip(tipData);
      showMessage('success', 'Coaching tip created successfully');
      setNewTip({ category: '', title: '', content: '', trigger_conditions: '', is_active: true });
      loadCoachingTips();
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Failed to save coaching tip');
    } finally {
      setSaving(false);
    }
  };

  const deleteCoachingTip = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      await aiSettingsAPI.deleteCoachingTip(id);
      showMessage('success', 'Coaching tip deleted successfully');
      loadCoachingTips();
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Failed to delete coaching tip');
    }
  };

  const testAIPrompt = async () => {
    if (!testPrompt.type && !testPrompt.customPrompt) {
      showMessage('error', 'Please select a prompt type or enter a custom prompt');
      return;
    }

    try {
      const result = await aiSettingsAPI.testPrompt({
        promptType: testPrompt.type,
        customPrompt: testPrompt.customPrompt,
        testUserId: testPrompt.testUserId ? parseInt(testPrompt.testUserId) : undefined
      });
      
      setTestPrompt(prev => ({ ...prev, result: result.generatedPrompt }));
      showMessage('success', 'Prompt generated successfully');
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || 'Failed to test prompt');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-lg">
        <h2 className="text-2xl font-bold">🤖 AI Agent Settings</h2>
        <p className="text-blue-100 mt-2">Configure AI behavior, prompts, and coaching tips</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 border-l-4 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-400 text-green-700' 
            : 'bg-red-50 border-red-400 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {[
            { id: 'prompts', label: '📝 System Prompts', icon: '📝' },
            { id: 'config', label: '⚙️ AI Configuration', icon: '⚙️' },
            { id: 'coaching', label: '💡 Coaching Tips', icon: '💡' },
            { id: 'testing', label: '🧪 Testing', icon: '🧪' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {/* System Prompts Tab */}
        {activeTab === 'prompts' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Prompts Configuration</h3>
              <p className="text-gray-600 mb-6">
                These prompts define how the AI agent behaves and responds. The base prompt is used for all interactions,
                while role-specific prompts customize behavior for different user types.
              </p>
            </div>

            <div className="space-y-6">
              {/* Base System Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base System Prompt *
                </label>
                <textarea
                  value={systemPrompts.base}
                  onChange={(e) => setSystemPrompts(prev => ({ ...prev, base: e.target.value }))}
                  rows={8}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Core AI personality and behavior instructions..."
                />
                <p className="text-sm text-gray-500 mt-1">
                  This defines the AI's core identity, capabilities, and response style.
                </p>
              </div>

              {/* Role-Specific Prompts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Advisor Prompt
                  </label>
                  <textarea
                    value={systemPrompts.advisor}
                    onChange={(e) => setSystemPrompts(prev => ({ ...prev, advisor: e.target.value }))}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Specific behavior when talking to advisors..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manager Prompt
                  </label>
                  <textarea
                    value={systemPrompts.manager}
                    onChange={(e) => setSystemPrompts(prev => ({ ...prev, manager: e.target.value }))}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Specific behavior when talking to managers..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Prompt
                  </label>
                  <textarea
                    value={systemPrompts.admin}
                    onChange={(e) => setSystemPrompts(prev => ({ ...prev, admin: e.target.value }))}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Specific behavior when talking to admins..."
                  />
                </div>
              </div>

              <button
                onClick={saveSystemPrompts}
                disabled={saving || !systemPrompts.base}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium"
              >
                {saving ? 'Saving...' : 'Save System Prompts'}
              </button>
            </div>
          </div>
        )}

        {/* AI Configuration Tab */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Agent Configuration</h3>
              <p className="text-gray-600 mb-6">
                Fine-tune the AI's response generation parameters and behavior settings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Generation Parameters */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Generation Parameters</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature ({agentConfig.temperature})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={agentConfig.temperature}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">0.1 = focused, 1.0 = creative</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Top K ({agentConfig.top_k})
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={agentConfig.top_k}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, top_k: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">Vocabulary limitation</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Top P ({agentConfig.top_p})
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={agentConfig.top_p}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, top_p: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">Response variety</p>
                </div>
              </div>

              {/* Model Configuration */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Model Configuration</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Model
                  </label>
                  <select
                    value={agentConfig.defaultModel}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, defaultModel: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableModels.map(model => (
                      <option key={model.name} value={model.name}>
                        {model.name} {model.size && `(${model.size})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    value={agentConfig.num_predict}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, num_predict: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">Maximum response length</p>
                </div>
              </div>

              {/* Limits & Timeouts */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Limits & Timeouts</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={agentConfig.timeout}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Context Tokens
                  </label>
                  <input
                    type="number"
                    value={agentConfig.maxContextTokens}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, maxContextTokens: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Response Tokens
                  </label>
                  <input
                    type="number"
                    value={agentConfig.maxResponseTokens}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, maxResponseTokens: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={saveAgentConfig}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        )}

        {/* Coaching Tips Tab */}
        {activeTab === 'coaching' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Coaching Tips Management</h3>
              <p className="text-gray-600 mb-6">
                Create and manage coaching tips that the AI can reference when providing advice.
              </p>
            </div>

            {/* Add New Tip Form */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h4 className="font-medium text-gray-900">Add New Coaching Tip</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={newTip.category}
                    onChange={(e) => setNewTip(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category...</option>
                    <option value="sales">Sales</option>
                    <option value="service">Service</option>
                    <option value="customer">Customer Relations</option>
                    <option value="upselling">Upselling</option>
                    <option value="efficiency">Efficiency</option>
                    <option value="quality">Quality</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={newTip.title}
                    onChange={(e) => setNewTip(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Coaching tip title..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={newTip.content}
                  onChange={(e) => setNewTip(prev => ({ ...prev, content: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Detailed coaching advice..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Conditions (JSON, optional)
                </label>
                <textarea
                  value={newTip.trigger_conditions}
                  onChange={(e) => setNewTip(prev => ({ ...prev, trigger_conditions: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder='{"sales_below": 1000, "service_count_below": 20}'
                />
                <p className="text-xs text-gray-500">
                  Optional: JSON conditions for when this tip should be suggested
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newTip.is_active}
                    onChange={(e) => setNewTip(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>

                <button
                  onClick={saveCoachingTip}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium"
                >
                  {saving ? 'Adding...' : 'Add Tip'}
                </button>
              </div>
            </div>

            {/* Existing Tips */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Existing Coaching Tips ({coachingTips.length})</h4>
              
              {coachingTips.length === 0 ? (
                <p className="text-gray-500">No coaching tips created yet.</p>
              ) : (
                <div className="space-y-4">
                  {coachingTips.map(tip => (
                    <div key={tip.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                              {tip.category}
                            </span>
                            {!tip.is_active && (
                              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <h5 className="font-medium text-gray-900 mt-2">{tip.title}</h5>
                          <p className="text-gray-600 mt-1">{tip.content}</p>
                          {tip.trigger_conditions && (
                            <p className="text-xs text-gray-500 mt-2">
                              Triggers: {JSON.stringify(tip.trigger_conditions)}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            Created by {tip.created_by_email} on {new Date(tip.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteCoachingTip(tip.id, tip.title)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium ml-4"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Testing Tab */}
        {activeTab === 'testing' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Prompt Testing</h3>
              <p className="text-gray-600 mb-6">
                Test your AI prompts and configurations before deploying them.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Test Configuration */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Test Configuration</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Type</label>
                  <select
                    value={testPrompt.type}
                    onChange={(e) => setTestPrompt(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="general">General Insights</option>
                    <option value="goals">Goal Analysis</option>
                    <option value="trends">Trend Analysis</option>
                    <option value="coaching">Coaching Tips</option>
                    <option value="chat">Chat Response</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test User ID (optional)
                  </label>
                  <input
                    type="number"
                    value={testPrompt.testUserId}
                    onChange={(e) => setTestPrompt(prev => ({ ...prev, testUserId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave empty for mock data"
                  />
                  <p className="text-xs text-gray-500">
                    Use real user data for testing (admin access required)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Prompt (optional)
                  </label>
                  <textarea
                    value={testPrompt.customPrompt}
                    onChange={(e) => setTestPrompt(prev => ({ ...prev, customPrompt: e.target.value }))}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Override with custom prompt..."
                  />
                </div>

                <button
                  onClick={testAIPrompt}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium"
                >
                  🧪 Generate Test Prompt
                </button>
              </div>

              {/* Test Results */}
              <div>
                <h4 className="font-medium text-gray-900 mb-4">Generated Prompt</h4>
                
                {testPrompt.result ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800">
                      {testPrompt.result}
                    </pre>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
                    Click "Generate Test Prompt" to see the results
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AISettings;