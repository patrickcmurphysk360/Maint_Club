import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  UserIcon,
  MagnifyingGlassIcon,
  LinkIcon,
  CheckIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface AvailableUser {
  id: string;
  first_name?: string;
  last_name?: string;
  firstName?: string;  // Handle both naming conventions
  lastName?: string;   // Handle both naming conventions
  email: string;
  status: string;
  role: string;
  store_assignments?: Array<{
    store_id: number;
    store_name: string;
  }>;
  market_assignments?: Array<{
    market_id: number;
    market_name: string;
  }>;
}

interface AdvisorMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  advisorName: string;
  advisorId: string;
  currentMappedUserId?: string;
  currentMappedUserName?: string;
  onMapUser: (userId: string, userName: string) => void;
  onCreateUser: (advisorName: string) => void;
}

const AdvisorMappingModal: React.FC<AdvisorMappingModalProps> = ({
  isOpen,
  onClose,
  advisorName,
  advisorId,
  currentMappedUserId,
  currentMappedUserName,
  onMapUser,
  onCreateUser
}) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AvailableUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>(currentMappedUserId || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAvailableUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    filterUsers();
  }, [availableUsers, searchTerm]);

  const loadAvailableUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users?role=advisor`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      const users = Array.isArray(data) ? data : data.users || [];
      setAvailableUsers(users);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load available users');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchTerm.trim()) {
      setFilteredUsers(availableUsers);
      return;
    }

    const filtered = availableUsers.filter(user => {
      const firstName = user.first_name || user.firstName || '';
      const lastName = user.last_name || user.lastName || '';
      const fullName = `${firstName} ${lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      const search = searchTerm.toLowerCase();
      
      return fullName.includes(search) || email.includes(search);
    });

    setFilteredUsers(filtered);
  };

  const handleMapUser = () => {
    const selectedUser = availableUsers.find(u => u.id === selectedUserId);
    if (selectedUser) {
      const firstName = selectedUser.first_name || selectedUser.firstName || '';
      const lastName = selectedUser.last_name || selectedUser.lastName || '';
      const userName = `${firstName} ${lastName}`.trim();
      onMapUser(selectedUserId, userName);
      onClose();
    }
  };

  const handleCreateUser = () => {
    onCreateUser(advisorName);
    onClose();
  };

  const getInitials = (firstName: string | undefined, lastName: string | undefined) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || '??';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <LinkIcon className="h-6 w-6 text-blue-600 mr-2" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Map Advisor to User</h3>
              <p className="text-sm text-gray-600">Map "{advisorName}" to a system user</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Current Mapping */}
          {currentMappedUserName && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <CheckIcon className="h-5 w-5 text-green-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-green-900">Currently Mapped</p>
                  <p className="text-sm text-green-700">{currentMappedUserName}</p>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Users
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10 w-full"
              />
            </div>
          </div>

          {/* Create New User Option */}
          <div className="mb-6">
            <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <PlusIcon className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Create New User</p>
                    <p className="text-sm text-blue-700">Create a new user account for "{advisorName}"</p>
                  </div>
                </div>
                <button
                  onClick={handleCreateUser}
                  className="btn btn-primary text-sm"
                >
                  Create User
                </button>
              </div>
            </div>
          </div>

          {/* User List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Existing User ({filteredUsers.length} available)
            </label>
            
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <UserIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No users found matching your search</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredUsers.map((user) => (
                  <label
                    key={user.id}
                    className={`flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                      selectedUserId === user.id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="selectedUser"
                      value={user.id}
                      checked={selectedUserId === user.id}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3 flex items-center flex-1">
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-medium text-sm mr-3">
                        {getInitials(
                          user.first_name || user.firstName,
                          user.last_name || user.lastName
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {(user.first_name || user.firstName || '')} {(user.last_name || user.lastName || '')}
                          </p>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            user.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{user.email}</p>
                        {user.store_assignments && user.store_assignments.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Stores: {user.store_assignments.map(s => s.store_name).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleMapUser}
            disabled={!selectedUserId}
            className="btn btn-primary flex items-center"
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            Map User
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvisorMappingModal;