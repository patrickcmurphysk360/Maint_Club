import React, { useState, useEffect } from 'react';
import {
  DocumentIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  FunnelIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface UploadRecord {
  id: string;
  filename: string;
  fileType: 'services';
  uploadDate: string;
  processedAt?: string;
  status: 'completed' | 'failed' | 'processing' | 'pending_review' | 'cancelled';
  errorMessage?: string;
  uploadedBy: string;
  processedCount?: number;
  marketId?: number;
  sessionId?: string;
}

interface UploadSession {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  created_at: string;
  markets_count: number;
  stores_count: number;
  advisors_count: number;
}

const UploadHistory: React.FC = () => {
  const { token } = useAuth();
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [sessions, setSessions] = useState<UploadSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{
    status: string;
    type: string;
    dateRange: string;
    search: string;
  }>({
    status: 'all',
    type: 'all',
    dateRange: '30days',
    search: ''
  });
  const [viewMode, setViewMode] = useState<'uploads' | 'sessions'>('uploads');

  useEffect(() => {
    loadHistory();
  }, [filter, viewMode]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      if (viewMode === 'uploads') {
        // Load completed uploads
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/performance/uploads?limit=100`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          setUploads(data);
        }
      } else {
        // Load all sessions (including pending)
        const pendingResponse = await fetch(
          `${process.env.REACT_APP_API_URL}/api/enhanced-upload/upload/sessions/pending`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        if (pendingResponse.ok) {
          const pendingData = await pendingResponse.json();
          setSessions(pendingData.pendingSessions || []);
        }
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'pending_review':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'processing':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'cancelled':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'pending_review':
        return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <ArrowPathIcon className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleSessionAction = async (sessionId: string, action: 'cancel' | 'retry') => {
    try {
      if (action === 'cancel') {
        await fetch(
          `${process.env.REACT_APP_API_URL}/api/enhanced-upload/upload/session/${sessionId}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        loadHistory();
      }
    } catch (error) {
      console.error(`Error ${action}ing session:`, error);
    }
  };

  const filteredUploads = uploads.filter(upload => {
    // Apply filters
    if (filter.status !== 'all' && upload.status !== filter.status) return false;
    if (filter.type !== 'all' && upload.fileType !== filter.type) return false;
    if (filter.search && !upload.filename.toLowerCase().includes(filter.search.toLowerCase())) return false;
    
    // Date range filter
    const uploadDate = new Date(upload.uploadDate);
    const now = new Date();
    const daysAgo = {
      '7days': 7,
      '30days': 30,
      '90days': 90,
      'all': Infinity
    }[filter.dateRange] || 30;
    
    if (daysAgo !== Infinity) {
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      if (uploadDate < cutoffDate) return false;
    }
    
    return true;
  });

  const filteredSessions = sessions.filter(session => {
    if (filter.search && !session.filename.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Services Upload History</h2>
          <p className="text-gray-600">View and manage MTD advisor performance data uploads</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('uploads')}
              className={`px-4 py-2 text-sm font-medium ${
                viewMode === 'uploads'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Completed Uploads
            </button>
            <button
              onClick={() => setViewMode('sessions')}
              className={`px-4 py-2 text-sm font-medium ${
                viewMode === 'sessions'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Pending Sessions
            </button>
          </div>
          
          <button
            onClick={loadHistory}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          {viewMode === 'uploads' && (
            <>
              <select
                value={filter.status}
                onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
                className="form-select text-sm"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="processing">Processing</option>
              </select>

              <div className="text-sm text-gray-500 px-3 py-2 bg-gray-50 rounded border">
                Services Only
              </div>

              <select
                value={filter.dateRange}
                onChange={(e) => setFilter(prev => ({ ...prev, dateRange: e.target.value }))}
                className="form-select text-sm"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </>
          )}

          <div className="flex-1 max-w-sm">
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search filenames..."
                value={filter.search}
                onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                className="form-input pl-10 text-sm w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : viewMode === 'uploads' ? (
          /* Uploads Table */
          filteredUploads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Upload Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Records
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUploads.map((upload) => (
                    <tr key={upload.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <DocumentIcon className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{upload.filename}</div>
                            {upload.errorMessage && (
                              <div className="text-xs text-red-600 truncate max-w-xs" title={upload.errorMessage}>
                                {upload.errorMessage}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 capitalize">{upload.fileType}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(upload.uploadDate).toLocaleDateString()}
                        <div className="text-xs text-gray-500">
                          {new Date(upload.uploadDate).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(upload.status)}
                          <span className={`ml-2 ${getStatusBadge(upload.status)}`}>
                            {upload.status.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {upload.processedCount || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <DocumentIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No uploads found matching your criteria</p>
            </div>
          )
        ) : (
          /* Sessions Table */
          filteredSessions.length > 0 ? (
            <div className="space-y-4">
              {filteredSessions.map((session) => (
                <div key={session.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(session.status)}
                      <div>
                        <h4 className="font-medium text-gray-900">{session.filename}</h4>
                        <p className="text-sm text-gray-600">
                          {session.file_type} • {new Date(session.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={getStatusBadge(session.status)}>
                        {session.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="text-sm text-gray-600">
                        {session.markets_count}M • {session.stores_count}S • {session.advisors_count}A
                      </div>
                      <button
                        className="text-blue-600 hover:text-blue-900 mr-2"
                        title="View Session"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      {session.status === 'pending_review' && (
                        <button
                          onClick={() => handleSessionAction(session.id, 'cancel')}
                          className="text-red-600 hover:text-red-900"
                          title="Cancel Session"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No pending sessions found</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default UploadHistory;