import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface DataBreakdownItem {
  dataType: string;
  dataLevel: 'advisor_level' | 'store_level';
  recordCount: number;
  uniqueMarkets: number;
  uniqueStores: number;
  uniqueAdvisors: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
}

interface RecentUpload {
  filename: string;
  status: string;
  createdAt: string;
  marketName: string;
  marketsCount: number;
  storesCount: number;
  advisorsCount: number;
  hasStoreData: boolean;
  hasAdvisorData: boolean;
}

interface DataBreakdown {
  performanceData: DataBreakdownItem[];
  recentUploads: RecentUpload[];
}

const DataLevelBreakdown: React.FC = () => {
  const { token } = useAuth();
  const [breakdown, setBreakdown] = useState<DataBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBreakdown();
  }, []);

  const loadBreakdown = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/data-management/data-breakdown`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to load data breakdown: ${response.status} - ${errorData.error || errorData.message || response.statusText}`);
      }

      const data = await response.json();
      setBreakdown(data);
      console.log('📊 Data breakdown loaded:', data);
    } catch (err: any) {
      console.error('Error loading data breakdown:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'pending_review': return 'text-yellow-600 bg-yellow-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!breakdown) return null;

  const advisorData = breakdown.performanceData.find(d => d.dataLevel === 'advisor_level');
  const storeData = breakdown.performanceData.find(d => d.dataLevel === 'store_level');

  return (
    <div className="space-y-6">
      {/* Data Level Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <ChartBarIcon className="h-5 w-5 mr-2" />
            Data Level Breakdown
          </h3>
          <button 
            onClick={loadBreakdown}
            className="btn btn-sm btn-secondary flex items-center"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Advisor-Level Data */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <UserGroupIcon className="h-6 w-6 text-blue-600 mr-2" />
              <h4 className="font-medium text-blue-900">Advisor-Level Data</h4>
            </div>
            {advisorData ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Records:</span>
                  <span className="font-medium">{advisorData.recordCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Markets:</span>
                  <span className="font-medium">{advisorData.uniqueMarkets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Stores:</span>
                  <span className="font-medium">{advisorData.uniqueStores}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Advisors:</span>
                  <span className="font-medium">{advisorData.uniqueAdvisors}</span>
                </div>
                {advisorData.dateRange.earliest && (
                  <div className="text-xs text-blue-600 mt-2">
                    {new Date(advisorData.dateRange.earliest).toLocaleDateString()} - {new Date(advisorData.dateRange.latest).toLocaleDateString()}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-blue-600 text-sm">No advisor-level data found</p>
            )}
          </div>

          {/* Store-Level Data */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <BuildingStorefrontIcon className="h-6 w-6 text-green-600 mr-2" />
              <h4 className="font-medium text-green-900">Store-Level Data</h4>
            </div>
            {storeData ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Records:</span>
                  <span className="font-medium">{storeData.recordCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Markets:</span>
                  <span className="font-medium">{storeData.uniqueMarkets}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Stores:</span>
                  <span className="font-medium">{storeData.uniqueStores}</span>
                </div>
                {storeData.dateRange.earliest && (
                  <div className="text-xs text-green-600 mt-2">
                    {new Date(storeData.dateRange.earliest).toLocaleDateString()} - {new Date(storeData.dateRange.latest).toLocaleDateString()}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-green-600 text-sm">No store-level data found</p>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <p className="text-sm text-gray-700">
            <strong>Total Performance Records:</strong> {breakdown.performanceData.reduce((sum, d) => sum + d.recordCount, 0).toLocaleString()}
            {storeData && advisorData && (
              <span className="ml-4">
                <strong>Store Data:</strong> {Math.round((storeData.recordCount / (storeData.recordCount + advisorData.recordCount)) * 100)}% • 
                <strong className="ml-1">Advisor Data:</strong> {Math.round((advisorData.recordCount / (storeData.recordCount + advisorData.recordCount)) * 100)}%
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Recent Uploads */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <DocumentTextIcon className="h-5 w-5 mr-2" />
          Recent Uploads (Last 7 Days)
        </h3>

        {breakdown.recentUploads.length === 0 ? (
          <p className="text-gray-500 text-sm">No recent uploads found</p>
        ) : (
          <div className="space-y-3">
            {breakdown.recentUploads.map((upload, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <span className="font-medium text-sm truncate mr-2">{upload.filename}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(upload.status)}`}>
                      {upload.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {upload.marketName} • {new Date(upload.createdAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center">
                    <BuildingOffice2Icon className="h-3 w-3 mr-1" />
                    <span>{upload.marketsCount}M</span>
                  </div>
                  <div className="flex items-center">
                    <BuildingStorefrontIcon className="h-3 w-3 mr-1" />
                    <span>{upload.storesCount}S</span>
                  </div>
                  <div className="flex items-center">
                    <UserGroupIcon className="h-3 w-3 mr-1" />
                    <span>{upload.advisorsCount}A</span>
                  </div>
                  <div className="flex space-x-1">
                    {upload.hasStoreData && (
                      <span className="px-1 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                        Store
                      </span>
                    )}
                    {upload.hasAdvisorData && (
                      <span className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                        Advisor
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataLevelBreakdown;