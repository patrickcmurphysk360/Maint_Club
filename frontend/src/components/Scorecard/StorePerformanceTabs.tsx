import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AdvisorScorecardData } from '../../types/scorecard';
import AdvisorScorecard from './AdvisorScorecard';
import {
  BuildingStorefrontIcon,
  ChartBarIcon,
  ArrowPathIcon,
  ScaleIcon
} from '@heroicons/react/24/outline';

interface StorePerformanceData {
  storeId: number | string;
  storeName: string;
  marketId?: number;
  marketName?: string;
  metrics: {
    invoices: number;
    sales: number;
    gpSales: number;
    gpPercent: string;
  };
  services: Record<string, number>;
  recordCount: number;
}

interface MultiStoreScorecard {
  userId: number;
  isMultiStore: boolean;
  totalStores: number;
  marketId?: number;
  marketName?: string;
  rollupData: {
    metrics: {
      invoices: number;
      sales: number;
      gpSales: number;
      gpPercent: string;
    };
    services: Record<string, number>;
    goals: Record<string, any>;
  };
  storeData: StorePerformanceData[];
  lastUpdated: string;
}

interface StorePerformanceTabsProps {
  advisor: AdvisorScorecardData;
  serviceMappings?: Record<string, string>;
  selectedMtdMonth?: string;
  onMessageAdvisor?: (advisor: AdvisorScorecardData) => void;
  onSetGoals?: (advisor: AdvisorScorecardData) => void;
  onEditProfile?: (advisor: AdvisorScorecardData) => void;
  onMapAdvisor?: (advisor: AdvisorScorecardData) => void;
  canSetGoals?: boolean;
  canEditProfile?: boolean;
  className?: string;
}

const StorePerformanceTabs: React.FC<StorePerformanceTabsProps> = ({
  advisor,
  serviceMappings = {},
  selectedMtdMonth,
  onMessageAdvisor,
  onSetGoals,
  onEditProfile,
  onMapAdvisor,
  canSetGoals,
  canEditProfile,
  className = ''
}) => {
  const { token } = useAuth();
  const [multiStoreData, setMultiStoreData] = useState<MultiStoreScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'rollup' | 'compare' | string>('rollup');

  useEffect(() => {
    loadStorePerformanceData();
  }, [advisor.id, selectedMtdMonth]);

  const loadStorePerformanceData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Parse MTD month to year and month
      let mtdYear, mtdMonth;
      if (selectedMtdMonth) {
        [mtdYear, mtdMonth] = selectedMtdMonth.split('-');
      } else {
        const now = new Date();
        mtdYear = now.getFullYear().toString();
        mtdMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      }
      
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/scorecard/advisor/${advisor.id}/by-store?mtdYear=${mtdYear}&mtdMonth=${mtdMonth}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to load store performance data');
      }
      
      const data = await response.json();
      setMultiStoreData(data);
      
      // If this advisor works at multiple stores, show tabs
      if (data.isMultiStore && data.storeData.length > 1) {
        // Keep rollup as default for multi-store advisors
        setActiveTab('rollup');
      } else {
        // Single store advisor - just show the data
        setActiveTab('rollup');
      }
      
    } catch (err) {
      console.error('Error loading store performance data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load store performance data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadStorePerformanceData();
  };

  // Convert store data to AdvisorScorecardData format
  const convertStoreDataToScorecard = (storeData: StorePerformanceData, goals: Record<string, any> = {}): AdvisorScorecardData => {
    return {
      ...advisor,
      id: `${advisor.id}-store-${storeData.storeId}`,
      store: storeData.storeName,
      marketId: (storeData as any).marketId || advisor.marketId, // Use store's market ID if available
      totalSales: storeData.metrics.sales,
      salesPerVehicle: storeData.metrics.invoices > 0 ? storeData.metrics.sales / storeData.metrics.invoices : 0,
      grossProfit: storeData.metrics.gpSales,
      grossProfitPercent: parseFloat(storeData.metrics.gpPercent),
      grossProfitPerVehicle: storeData.metrics.invoices > 0 ? storeData.metrics.gpSales / storeData.metrics.invoices : 0,
      customerCount: storeData.metrics.invoices,
      // Map services using template keys (lowercase)
      invoices: storeData.metrics.invoices,
      sales: storeData.metrics.sales,
      gpsales: storeData.metrics.gpSales,
      gppercent: parseFloat(storeData.metrics.gpPercent),
      'avg.spend': storeData.metrics.invoices > 0 ? storeData.metrics.sales / storeData.metrics.invoices : 0,
      // Add all service values using the services object
      ...Object.fromEntries(
        Object.entries(storeData.services).map(([serviceName, value]) => {
          // Convert service name to template key format (lowercase, keep % for percentages)
          const templateKey = serviceName.toLowerCase().replace(/[^a-z0-9%]/g, '');
          // Debug percentage fields
          if (serviceName.includes('%') || serviceName.includes('brake') || serviceName.includes('potential')) {
            console.log(`🔧 STORE TAB: "${serviceName}" -> "${templateKey}" = ${value}`);
          }
          return [templateKey, value];
        })
      ),
      goals: goals,
      rawApiServices: storeData.services,
      lastUpdated: new Date().toISOString()
    };
  };

  // Convert rollup data to AdvisorScorecardData format
  const convertRollupDataToScorecard = (rollupData: MultiStoreScorecard['rollupData'], marketId?: number): AdvisorScorecardData => {
    return {
      ...advisor,
      marketId: marketId || advisor.marketId, // Use provided market ID if available
      totalSales: rollupData.metrics.sales,
      salesPerVehicle: rollupData.metrics.invoices > 0 ? rollupData.metrics.sales / rollupData.metrics.invoices : 0,
      grossProfit: rollupData.metrics.gpSales,
      grossProfitPercent: parseFloat(rollupData.metrics.gpPercent),
      grossProfitPerVehicle: rollupData.metrics.invoices > 0 ? rollupData.metrics.gpSales / rollupData.metrics.invoices : 0,
      customerCount: rollupData.metrics.invoices,
      // Map services using template keys
      invoices: rollupData.metrics.invoices,
      sales: rollupData.metrics.sales,
      gpsales: rollupData.metrics.gpSales,
      gppercent: parseFloat(rollupData.metrics.gpPercent),
      'avg.spend': rollupData.metrics.invoices > 0 ? rollupData.metrics.sales / rollupData.metrics.invoices : 0,
      // Add all service values
      ...Object.fromEntries(
        Object.entries(rollupData.services).map(([serviceName, value]) => {
          const templateKey = serviceName.toLowerCase().replace(/[^a-z0-9%]/g, '');
          return [templateKey, value];
        })
      ),
      goals: rollupData.goals,
      rawApiServices: rollupData.services,
      lastUpdated: new Date().toISOString()
    };
  };

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
        <button
          onClick={handleRefresh}
          className="btn btn-secondary flex items-center"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  if (!multiStoreData) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">No performance data available.</p>
        </div>
      </div>
    );
  }

  // Single store advisor - just show the scorecard
  if (!multiStoreData.isMultiStore || multiStoreData.storeData.length <= 1) {
    const scorecardData = convertRollupDataToScorecard(multiStoreData.rollupData, multiStoreData.marketId);
    return (
      <div className={className}>
        <AdvisorScorecard
          advisor={scorecardData}
          onMessageAdvisor={onMessageAdvisor}
          onSetGoals={onSetGoals}
          onEditProfile={onEditProfile}
          onMapAdvisor={onMapAdvisor}
          canSetGoals={canSetGoals}
          canEditProfile={canEditProfile}
          serviceMappings={serviceMappings}
        />
      </div>
    );
  }

  // Multi-store advisor - show tabs
  const storeCount = multiStoreData.storeData.length;
  const rollupScorecard = convertRollupDataToScorecard(multiStoreData.rollupData, multiStoreData.marketId);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Multi-Store Indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BuildingStorefrontIcon className="h-6 w-6 text-blue-600 mr-2" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900">
                Multi-Store Advisor Performance
              </h3>
              <p className="text-blue-700 text-sm">
                {advisor.employee} works at {storeCount} locations. View rollup or individual store performance below.
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="btn btn-secondary flex items-center text-sm"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {/* Rollup Tab */}
          <button
            onClick={() => setActiveTab('rollup')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'rollup'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ChartBarIcon className="h-5 w-5 inline mr-2" />
            📊 Combined Performance ({storeCount} stores)
          </button>

          {/* Individual Store Tabs */}
          {multiStoreData.storeData.map((store) => (
            <button
              key={store.storeId}
              onClick={() => setActiveTab(`store-${store.storeId}`)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === `store-${store.storeId}`
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BuildingStorefrontIcon className="h-5 w-5 inline mr-2" />
              🏪 {store.storeName}
            </button>
          ))}

          {/* Compare Tab */}
          <button
            onClick={() => setActiveTab('compare')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'compare'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ScaleIcon className="h-5 w-5 inline mr-2" />
            📊 Compare Stores
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Rollup Performance */}
        {activeTab === 'rollup' && (
          <div>
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                <strong>Combined Performance:</strong> This shows {advisor.employee}'s total performance across all {storeCount} store locations.
              </p>
            </div>
            <AdvisorScorecard
              advisor={rollupScorecard}
              onMessageAdvisor={onMessageAdvisor}
              onSetGoals={onSetGoals}
              onEditProfile={onEditProfile}
              onMapAdvisor={onMapAdvisor}
              canSetGoals={canSetGoals}
              canEditProfile={canEditProfile}
              serviceMappings={serviceMappings}
            />
          </div>
        )}

        {/* Individual Store Performance */}
        {multiStoreData.storeData.map((store) => (
          activeTab === `store-${store.storeId}` && (
            <div key={store.storeId}>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>{store.storeName} Performance:</strong> This shows {advisor.employee}'s performance at this specific location only.
                  {store.recordCount > 1 && (
                    <span className="ml-2 text-blue-600">
                      (Based on {store.recordCount} data uploads)
                    </span>
                  )}
                </p>
              </div>
              <AdvisorScorecard
                advisor={convertStoreDataToScorecard(store, multiStoreData.rollupData.goals)}
                onMessageAdvisor={onMessageAdvisor}
                onSetGoals={onSetGoals}
                onEditProfile={onEditProfile}
                onMapAdvisor={onMapAdvisor}
                canSetGoals={canSetGoals}
                canEditProfile={canEditProfile}
                serviceMappings={serviceMappings}
              />
            </div>
          )
        ))}

        {/* Store Comparison */}
        {activeTab === 'compare' && (
          <div>
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-purple-800 text-sm">
                <strong>Store Comparison:</strong> Compare {advisor.employee}'s performance across all {storeCount} locations.
              </p>
            </div>
            
            {/* Comparison Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rollup Card */}
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-green-900">
                    📊 Combined Total
                  </h3>
                  <span className="text-xs bg-green-100 px-2 py-1 rounded text-green-800">
                    {storeCount} Stores
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-green-900">
                      {multiStoreData.rollupData.metrics.invoices}
                    </div>
                    <div className="text-sm text-green-700">Invoices</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">
                      ${multiStoreData.rollupData.metrics.sales.toLocaleString()}
                    </div>
                    <div className="text-sm text-green-700">Sales</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">
                      ${multiStoreData.rollupData.metrics.gpSales.toLocaleString()}
                    </div>
                    <div className="text-sm text-green-700">GP Sales</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">
                      {multiStoreData.rollupData.metrics.gpPercent}%
                    </div>
                    <div className="text-sm text-green-700">GP %</div>
                  </div>
                </div>
              </div>

              {/* Individual Store Cards */}
              {multiStoreData.storeData.map((store) => (
                <div key={store.storeId} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-blue-900">
                      🏪 {store.storeName}
                    </h3>
                    {store.recordCount > 1 && (
                      <span className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-800">
                        {store.recordCount} uploads
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-blue-900">
                        {store.metrics.invoices}
                      </div>
                      <div className="text-sm text-blue-700">Invoices</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-900">
                        ${store.metrics.sales.toLocaleString()}
                      </div>
                      <div className="text-sm text-blue-700">Sales</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-900">
                        ${store.metrics.gpSales.toLocaleString()}
                      </div>
                      <div className="text-sm text-blue-700">GP Sales</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-900">
                        {store.metrics.gpPercent}%
                      </div>
                      <div className="text-sm text-blue-700">GP %</div>
                    </div>
                  </div>
                  
                  {/* Store Performance Percentage */}
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="text-xs text-blue-600">
                      Store contribution: {((store.metrics.sales / multiStoreData.rollupData.metrics.sales) * 100).toFixed(1)}% of total sales
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorePerformanceTabs;