import React, { useState, useEffect } from 'react';
import {
  UserGroupIcon,
  LinkIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface AdvisorMapping {
  id: string;
  advisor_name: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_status?: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  role: string;
}

interface DataMappingManagerProps {
  onMappingUpdate: () => void;
}

const DataMappingManager: React.FC<DataMappingManagerProps> = ({ onMappingUpdate }) => {
  const { token } = useAuth();
  const [mappings, setMappings] = useState<AdvisorMapping[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMapping, setEditingMapping] = useState<AdvisorMapping | null>(null);
  const [newMapping, setNewMapping] = useState({ advisor_name: '', user_id: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadMappings();
    loadUsers();
  }, []);

  const loadMappings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/advisor-mappings`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMappings(data);
      }
    } catch (error) {
      console.error('Error loading mappings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/users?role=advisor`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleCreateMapping = async () => {
    if (!newMapping.advisor_name || !newMapping.user_id) return;

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/advisor-mappings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newMapping)
        }
      );

      if (response.ok) {
        setNewMapping({ advisor_name: '', user_id: '' });
        setShowAddForm(false);
        loadMappings();
        onMappingUpdate();
      } else {
        const error = await response.json();
        alert(`Error creating mapping: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating mapping:', error);
      alert('Error creating mapping');
    }
  };

  const handleUpdateMapping = async (mapping: AdvisorMapping) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/advisor-mappings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            advisor_name: mapping.advisor_name,
            user_id: mapping.user_id
          })
        }
      );

      if (response.ok) {
        setEditingMapping(null);
        loadMappings();
        onMappingUpdate();
      } else {
        const error = await response.json();
        alert(`Error updating mapping: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating mapping:', error);
      alert('Error updating mapping');
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/advisor-mappings/${mappingId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        loadMappings();
        onMappingUpdate();
      } else {
        const error = await response.json();
        alert(`Error deleting mapping: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
      alert('Error deleting mapping');
    }
  };

  const filteredMappings = mappings.filter(mapping =>
    mapping.advisor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mapping.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mapping.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const unmappedUsers = users.filter(user => 
    !mappings.some(mapping => mapping.user_id === user.id)
  );

  const duplicateMappings = mappings.filter((mapping, index, arr) =>
    arr.findIndex(m => m.advisor_name === mapping.advisor_name) !== index
  );

  const brokenMappings = mappings.filter(mapping => !mapping.user_name);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Data Mappings</h2>
          <p className="text-gray-600">Manage advisor name to user account mappings</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="btn btn-primary flex items-center"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Mapping
          </button>
          
          <button
            onClick={() => { loadMappings(); loadUsers(); }}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600 mr-3">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Total Mappings</p>
              <p className="text-2xl font-bold text-gray-900">{mappings.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100 text-green-600 mr-3">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Active Mappings</p>
              <p className="text-2xl font-bold text-gray-900">
                {mappings.filter(m => m.user_status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600 mr-3">
              <UserGroupIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Unmapped Users</p>
              <p className="text-2xl font-bold text-gray-900">{unmappedUsers.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-red-100 text-red-600 mr-3">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Issues</p>
              <p className="text-2xl font-bold text-gray-900">
                {duplicateMappings.length + brokenMappings.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts for Issues */}
      {(duplicateMappings.length > 0 || brokenMappings.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Mapping Issues Detected</h3>
              <div className="text-sm text-red-700 mt-1">
                {duplicateMappings.length > 0 && (
                  <p>• {duplicateMappings.length} duplicate advisor name(s) found</p>
                )}
                {brokenMappings.length > 0 && (
                  <p>• {brokenMappings.length} mapping(s) point to non-existent users</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search mappings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input pl-10 w-full"
          />
        </div>
      </div>

      {/* Add Mapping Form */}
      {showAddForm && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Mapping</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Advisor Name (from spreadsheet)
              </label>
              <input
                type="text"
                value={newMapping.advisor_name}
                onChange={(e) => setNewMapping(prev => ({ ...prev, advisor_name: e.target.value }))}
                className="form-input w-full"
                placeholder="e.g., John Smith"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Account
              </label>
              <select
                value={newMapping.user_id}
                onChange={(e) => setNewMapping(prev => ({ ...prev, user_id: e.target.value }))}
                className="form-select w-full"
              >
                <option value="">Select a user...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateMapping}
              disabled={!newMapping.advisor_name || !newMapping.user_id}
              className="btn btn-primary"
            >
              Create Mapping
            </button>
          </div>
        </div>
      )}

      {/* Mappings Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredMappings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Advisor Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mapped User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <UserGroupIcon className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {mapping.advisor_name}
                          </div>
                          {duplicateMappings.some(d => d.advisor_name === mapping.advisor_name) && (
                            <div className="text-xs text-red-600">⚠️ Duplicate name</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {mapping.user_name ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {mapping.user_name}
                          </div>
                          <div className="text-sm text-gray-500">{mapping.user_email}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-red-600">⚠️ User not found</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(mapping.user_status)}`}>
                        {mapping.user_status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(mapping.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingMapping(mapping)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit Mapping"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMapping(mapping.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Mapping"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <UserGroupIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No mappings found</p>
          </div>
        )}
      </div>

      {/* Edit Mapping Modal */}
      {editingMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Mapping</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Advisor Name
                  </label>
                  <input
                    type="text"
                    value={editingMapping.advisor_name}
                    onChange={(e) => setEditingMapping(prev => prev ? { ...prev, advisor_name: e.target.value } : null)}
                    className="form-input w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    User Account
                  </label>
                  <select
                    value={editingMapping.user_id}
                    onChange={(e) => setEditingMapping(prev => prev ? { ...prev, user_id: e.target.value } : null)}
                    className="form-select w-full"
                  >
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setEditingMapping(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateMapping(editingMapping)}
                  className="btn btn-primary"
                >
                  Update Mapping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataMappingManager;