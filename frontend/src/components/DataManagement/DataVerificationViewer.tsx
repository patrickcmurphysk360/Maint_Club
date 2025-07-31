import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  BuildingOffice2Icon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface DataVerificationStats {
  performanceData: {
    totalRecords: number;
    recordsWithMarketId: number;
    recordsWithStoreId: number;
    recordsWithAdvisorId: number;
    uniqueMarkets: number;
    uniqueStores: number;
    uniqueAdvisors: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
  markets: {
    totalMarkets: number;
    marketsWithStores: number;
    marketsWithPerformanceData: number;
  };
  stores: {
    totalStores: number;
    storesWithPerformanceData: number;
    storesWithAdvisors: number;
  };
  advisors: {
    totalAdvisors: number;
    advisorsWithMappings: number;
    advisorsWithPerformanceData: number;
    unmappedAdvisorsInData: number;
  };
  dataQuality: {
    orphanedPerformanceRecords: number;
    duplicateAdvisorMappings: number;
    inconsistentMarketNames: number;
    inconsistentStoreNames: number;
  };
}

interface SampleRecord {
  id: number;
  upload_date: string;
  market_id: number | null;
  store_id: number | null;
  advisor_user_id: string | null;
  market_name?: string;
  store_name?: string;
  advisor_name?: string;
  data_preview: any;
}

const DataVerificationViewer: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<DataVerificationStats | null>(null);
  const [sampleRecords, setSampleRecords] = useState<SampleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'overview' | 'performance' | 'markets' | 'stores' | 'advisors' | 'quality'>('overview');

  useEffect(() => {
    loadVerificationData();
  }, []);

  const loadVerificationData = async () => {
    setLoading(true);
    try {
      const [statsResponse, sampleResponse] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/data-management/verification-stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.REACT_APP_API_URL}/api/data-management/sample-performance-data`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
      
      if (sampleResponse.ok) {
        const sampleData = await sampleResponse.json();
        setSampleRecords(sampleData.records || []);
      }
    } catch (error) {
      console.error('Error loading verification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompletionPercentage = (completed: number, total: number) => {
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const getHealthColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const renderOverview = () => {
    if (!stats) return null;

    const marketLinkage = getCompletionPercentage(stats.performanceData.recordsWithMarketId, stats.performanceData.totalRecords);
    const storeLinkage = getCompletionPercentage(stats.performanceData.recordsWithStoreId, stats.performanceData.totalRecords);
    const advisorLinkage = getCompletionPercentage(stats.performanceData.recordsWithAdvisorId, stats.performanceData.totalRecords);

    return (
      <div className="space-y-6">
        {/* Data Linkage Health */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <BuildingOffice2Icon className="h-5 w-5 text-blue-600 mr-2" />
                <span className="font-medium text-gray-900">Market Linkage</span>
              </div>
              <span className={`px-2 py-1 rounded text-sm font-medium ${getHealthColor(marketLinkage)}`}>
                {marketLinkage}%
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {stats.performanceData.recordsWithMarketId} of {stats.performanceData.totalRecords} records
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${marketLinkage}%` }}
              ></div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <BuildingStorefrontIcon className="h-5 w-5 text-green-600 mr-2" />
                <span className="font-medium text-gray-900">Store Linkage</span>
              </div>
              <span className={`px-2 py-1 rounded text-sm font-medium ${getHealthColor(storeLinkage)}`}>
                {storeLinkage}%
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {stats.performanceData.recordsWithStoreId} of {stats.performanceData.totalRecords} records
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${storeLinkage}%` }}
              ></div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <UserGroupIcon className="h-5 w-5 text-purple-600 mr-2" />
                <span className="font-medium text-gray-900">Advisor Linkage</span>
              </div>
              <span className={`px-2 py-1 rounded text-sm font-medium ${getHealthColor(advisorLinkage)}`}>
                {advisorLinkage}%
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {stats.performanceData.recordsWithAdvisorId} of {stats.performanceData.totalRecords} records
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full" 
                style={{ width: `${advisorLinkage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Data Quality Issues */}
        {(stats.dataQuality.orphanedPerformanceRecords > 0 || 
          stats.dataQuality.duplicateAdvisorMappings > 0 || 
          stats.dataQuality.inconsistentMarketNames > 0 || 
          stats.dataQuality.inconsistentStoreNames > 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Data Quality Issues Detected</h4>
                <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                  {stats.dataQuality.orphanedPerformanceRecords > 0 && (
                    <li>• {stats.dataQuality.orphanedPerformanceRecords} performance records without proper linkages</li>
                  )}
                  {stats.dataQuality.duplicateAdvisorMappings > 0 && (
                    <li>• {stats.dataQuality.duplicateAdvisorMappings} duplicate advisor mapping(s)</li>
                  )}
                  {stats.dataQuality.inconsistentMarketNames > 0 && (
                    <li>• {stats.dataQuality.inconsistentMarketNames} inconsistent market name(s)</li>
                  )}
                  {stats.dataQuality.inconsistentStoreNames > 0 && (
                    <li>• {stats.dataQuality.inconsistentStoreNames} inconsistent store name(s)</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.performanceData.totalRecords}</p>
            <p className="text-sm text-gray-600">Performance Records</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.markets.totalMarkets}</p>
            <p className="text-sm text-gray-600">Markets</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.stores.totalStores}</p>
            <p className="text-sm text-gray-600">Stores</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.advisors.totalAdvisors}</p>
            <p className="text-sm text-gray-600">Advisors</p>
          </div>
        </div>
      </div>
    );
  };

  const renderSampleData = () => (
    <div className="card">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Sample Performance Data</h3>
        <p className="text-sm text-gray-600">Recent records showing data linkage</p>
      </div>
      
      {sampleRecords.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Upload Date</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Market</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Store</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Advisor</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Data Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sampleRecords.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-2 text-gray-900">
                    {new Date(record.upload_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    {record.market_id ? (
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-3 w-3 text-green-600 mr-1" />
                        <span className="text-gray-900">{record.market_name || `ID: ${record.market_id}`}</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-3 w-3 text-red-600 mr-1" />
                        <span className="text-red-600">Missing</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {record.store_id ? (
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-3 w-3 text-green-600 mr-1" />
                        <span className="text-gray-900">{record.store_name || `ID: ${record.store_id}`}</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-3 w-3 text-red-600 mr-1" />
                        <span className="text-red-600">Missing</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {record.advisor_user_id ? (
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-3 w-3 text-green-600 mr-1" />
                        <span className="text-gray-900">{record.advisor_name || `ID: ${record.advisor_user_id}`}</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-3 w-3 text-red-600 mr-1" />
                        <span className="text-red-600">Missing</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600 max-w-xs truncate">
                    {record.data_preview?.employeeName || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No performance data found</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Data Verification</h2>
          <p className="text-gray-600">Verify data linkage and quality in the database</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={loadVerificationData}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: ChartBarIcon },
            { id: 'performance', label: 'Performance Data', icon: DocumentTextIcon }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  selectedCategory === tab.id
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

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div>
          {selectedCategory === 'overview' && renderOverview()}
          {selectedCategory === 'performance' && renderSampleData()}
        </div>
      )}

      {/* Data Storage Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">How Data is Stored</h4>
            <div className="text-sm text-blue-700 mt-1 space-y-1">
              <p><strong>performance_data table:</strong> Contains MTD advisor performance with proper market_id, store_id, and advisor_user_id linkages</p>
              <p><strong>Raw spreadsheet data:</strong> Stored in the 'data' JSONB field for complete traceability</p>
              <p><strong>Entity relationships:</strong> Markets → Stores → Advisors with proper foreign key references</p>
              <p><strong>Advisor mappings:</strong> Links spreadsheet advisor names to user accounts for consistent identification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataVerificationViewer;