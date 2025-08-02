import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  DocumentChartBarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface MonitoringData {
  uploadStats: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    successRate: number;
  };
  recentActivity: Array<{
    date: string;
    uploads: number;
    success: number;
    failed: number;
  }>;
  fileTypeBreakdown: {
    services: number;
    operations: number;
  };
  processingTimes: {
    average: number;
    fastest: number;
    slowest: number;
  };
  errorCategories: Array<{
    category: string;
    count: number;
    examples: string[];
  }>;
  advisorMappingStats: {
    totalMappings: number;
    autoMapped: number;
    manualMapped: number;
    unmappedDiscovered: number;
  };
}

const UploadMonitoring: React.FC = () => {
  const { token } = useAuth();
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadMonitoringData();
    
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(loadMonitoringData, 60000); // Refresh every minute
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, autoRefresh]);

  const loadMonitoringData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/data-management/monitoring?range=${timeRange}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMonitoringData(data);
      } else {
        console.error('Failed to load monitoring data:', response.status);
        setMonitoringData(null);
      }
    } catch (error) {
      console.error('Error loading monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!monitoringData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600 bg-green-100';
    if (rate >= 90) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Upload Monitoring</h2>
          <p className="text-gray-600">Real-time monitoring and analytics for data uploads</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="form-select text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 mr-2"
            />
            Auto-refresh
          </label>
          
          <button
            onClick={loadMonitoringData}
            disabled={loading}
            className="btn btn-secondary text-sm"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600 mr-3">
              <DocumentChartBarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Total Uploads</p>
              <p className="text-2xl font-bold text-gray-900">{monitoringData.uploadStats.total}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${getSuccessRateColor(monitoringData.uploadStats.successRate)} mr-3`}>
              <ArrowTrendingUpIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {monitoringData.uploadStats.successRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100 text-green-600 mr-3">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Successful</p>
              <p className="text-2xl font-bold text-gray-900">{monitoringData.uploadStats.successful}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-red-100 text-red-600 mr-3">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Failed</p>
              <p className="text-2xl font-bold text-gray-900">{monitoringData.uploadStats.failed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <ChartBarIcon className="h-5 w-5 mr-2" />
            Recent Upload Activity
          </h3>
          
          <div className="space-y-3">
            {monitoringData.recentActivity.map((day, index) => (
              <div key={day.date} className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {new Date(day.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(day.uploads / 10) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-900 w-6">{day.uploads}</span>
                  </div>
                  <div className="text-xs text-green-600">{day.success}✓</div>
                  {day.failed > 0 && <div className="text-xs text-red-600">{day.failed}✗</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* File Type Breakdown */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">File Type Breakdown</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Services Files</span>
                <span className="text-sm text-gray-900">{monitoringData.fileTypeBreakdown.services}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ 
                    width: `${(monitoringData.fileTypeBreakdown.services / monitoringData.uploadStats.total) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Operations Files</span>
                <span className="text-sm text-gray-900">{monitoringData.fileTypeBreakdown.operations}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ 
                    width: `${(monitoringData.fileTypeBreakdown.operations / monitoringData.uploadStats.total) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Performance */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <ClockIcon className="h-5 w-5 mr-2" />
          Processing Performance
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{monitoringData.processingTimes.average}s</p>
            <p className="text-sm text-gray-600">Average Time</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{monitoringData.processingTimes.fastest}s</p>
            <p className="text-sm text-gray-600">Fastest Time</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">{monitoringData.processingTimes.slowest}s</p>
            <p className="text-sm text-gray-600">Slowest Time</p>
          </div>
        </div>
      </div>

      {/* Error Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
            Common Error Categories
          </h3>
          
          <div className="space-y-4">
            {monitoringData.errorCategories.map((category, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-gray-900">{category.category}</h4>
                  <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                    {category.count}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <p className="mb-1">Recent examples:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    {category.examples.map((example, idx) => (
                      <li key={idx}>• {example}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advisor Mapping Stats */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <UserGroupIcon className="h-5 w-5 mr-2" />
            Advisor Mapping Performance
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Total Mappings</span>
              <span className="text-lg font-semibold text-gray-900">
                {monitoringData.advisorMappingStats.totalMappings}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Auto-mapped</span>
              <span className="text-lg font-semibold text-green-600">
                {monitoringData.advisorMappingStats.autoMapped}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Manual mappings</span>
              <span className="text-lg font-semibold text-blue-600">
                {monitoringData.advisorMappingStats.manualMapped}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Unmapped discovered</span>
              <span className="text-lg font-semibold text-red-600">
                {monitoringData.advisorMappingStats.unmappedDiscovered}
              </span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600">
                  {((monitoringData.advisorMappingStats.autoMapped / monitoringData.advisorMappingStats.totalMappings) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">Automation Rate</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadMonitoring;