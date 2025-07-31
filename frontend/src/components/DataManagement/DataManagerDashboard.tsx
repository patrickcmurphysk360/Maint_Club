import React, { useState, useEffect } from 'react';
import {
  CloudArrowUpIcon,
  DocumentChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  FolderOpenIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
  EyeIcon,
  TrashIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import UnifiedUploader from './UnifiedUploader';
import UploadHistory from './UploadHistory';
import DataMappingManager from './DataMappingManager';
import UploadMonitoring from './UploadMonitoring';
import DataTroubleshooter from './DataTroubleshooter';
import DatabaseSchemaViewer from './DatabaseSchemaViewer';
import DataVerificationViewer from './DataVerificationViewer';

interface UploadSession {
  id: string;
  filename: string;
  file_type: string;
  status: 'pending_review' | 'processing' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  markets_count: number;
  stores_count: number;
  advisors_count: number;
}

interface DataStats {
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  pendingReview: number;
  advisorMappings: number;
  unmappedAdvisors: number;
}

const DataManagerDashboard: React.FC = () => {
  const { token } = useAuth();
  const [activeView, setActiveView] = useState<'upload' | 'history' | 'mappings' | 'monitoring' | 'troubleshoot' | 'schema' | 'verification'>('upload');
  const [pendingSessions, setPendingSessions] = useState<UploadSession[]>([]);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load pending sessions
      const sessionsResponse = await fetch(
        `${process.env.REACT_APP_API_URL}/api/enhanced-upload/upload/sessions/pending`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        setPendingSessions(sessionsData.pendingSessions || []);
      }

      // Load data statistics
      const statsResponse = await fetch(
        `${process.env.REACT_APP_API_URL}/api/data-management/stats`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setDataStats(stats);
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
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

  const handleSessionAction = async (sessionId: string, action: 'view' | 'cancel') => {
    if (action === 'cancel') {
      try {
        await fetch(
          `${process.env.REACT_APP_API_URL}/api/enhanced-upload/upload/session/${sessionId}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        loadDashboardData();
      } catch (error) {
        console.error('Error cancelling session:', error);
      }
    } else if (action === 'view') {
      // Handle view session details
      console.log('View session:', sessionId);
    }
  };

  const renderStatsCards = () => {
    if (!dataStats) return null;

    const stats = [
      {
        label: 'Total Uploads',
        value: dataStats.totalUploads,
        icon: DocumentChartBarIcon,
        color: 'text-blue-600 bg-blue-100'
      },
      {
        label: 'Success Rate',
        value: dataStats.totalUploads > 0 
          ? `${Math.round((dataStats.successfulUploads / dataStats.totalUploads) * 100)}%`
          : '0%',
        icon: CheckCircleIcon,
        color: 'text-green-600 bg-green-100'
      },
      {
        label: 'Pending Review',
        value: dataStats.pendingReview,
        icon: ClockIcon,
        color: 'text-yellow-600 bg-yellow-100',
        alert: dataStats.pendingReview > 0
      },
      {
        label: 'Failed Uploads',
        value: dataStats.failedUploads,
        icon: ExclamationTriangleIcon,
        color: 'text-red-600 bg-red-100',
        alert: dataStats.failedUploads > 0
      },
      {
        label: 'Advisor Mappings',
        value: dataStats.advisorMappings,
        icon: UserGroupIcon,
        color: 'text-purple-600 bg-purple-100'
      },
      {
        label: 'Unmapped Advisors',
        value: dataStats.unmappedAdvisors,
        icon: ExclamationTriangleIcon,
        color: 'text-orange-600 bg-orange-100',
        alert: dataStats.unmappedAdvisors > 0
      }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className={`card p-4 ${stat.alert ? 'ring-2 ring-yellow-200 bg-yellow-50' : ''}`}>
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${stat.color} mr-3`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'upload':
        return <UnifiedUploader onUploadComplete={loadDashboardData} />;
      case 'history':
        return <UploadHistory />;
      case 'mappings':
        return <DataMappingManager onMappingUpdate={loadDashboardData} />;
      case 'monitoring':
        return <UploadMonitoring />;
      case 'troubleshoot':
        return <DataTroubleshooter />;
      case 'schema':
        return <DatabaseSchemaViewer />;
      case 'verification':
        return <DataVerificationViewer />;
      default:
        return <UnifiedUploader onUploadComplete={loadDashboardData} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services Data Management</h1>
          <p className="text-gray-600">MTD advisor performance data upload, processing, and troubleshooting</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {renderStatsCards()}

      {/* Pending Sessions Alert */}
      {pendingSessions.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2" />
            <h3 className="text-sm font-medium text-yellow-800">
              {pendingSessions.length} Upload{pendingSessions.length > 1 ? 's' : ''} Pending Review
            </h3>
          </div>
          <div className="space-y-2">
            {pendingSessions.slice(0, 3).map((session) => (
              <div key={session.id} className="flex items-center justify-between bg-white rounded p-3 text-sm">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(session.status)}
                  <div>
                    <span className="font-medium">{session.filename}</span>
                    <span className="text-gray-500 ml-2">
                      ({session.markets_count}M, {session.stores_count}S, {session.advisors_count}A)
                    </span>
                  </div>
                  <span className={getStatusBadge(session.status)}>
                    {session.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSessionAction(session.id, 'view')}
                    className="text-blue-600 hover:text-blue-800"
                    title="View Details"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleSessionAction(session.id, 'cancel')}
                    className="text-red-600 hover:text-red-800"
                    title="Cancel Upload"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {pendingSessions.length > 3 && (
              <p className="text-sm text-yellow-700">
                ...and {pendingSessions.length - 3} more pending uploads
              </p>
            )}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'upload', label: 'Upload Services', icon: CloudArrowUpIcon },
            { id: 'history', label: 'Upload History', icon: FolderOpenIcon },
            { id: 'mappings', label: 'Advisor Mappings', icon: UserGroupIcon },
            { id: 'verification', label: 'Data Verification', icon: CheckCircleIcon },
            { id: 'monitoring', label: 'Monitoring', icon: ChartBarIcon },
            { id: 'troubleshoot', label: 'Troubleshoot', icon: Cog6ToothIcon },
            { id: 'schema', label: 'Database Schema', icon: DocumentChartBarIcon }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeView === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active View Content */}
      <div className="min-h-96">
        {renderActiveView()}
      </div>
    </div>
  );
};

export default DataManagerDashboard;