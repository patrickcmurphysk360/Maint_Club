import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdvisorScorecard from './AdvisorScorecard';
import StorePerformanceTabs from './StorePerformanceTabs';
import { AdvisorScorecardData } from '../../types/scorecard';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const PersonalScorecard: React.FC = () => {
  const { user, token } = useAuth();
  const [scorecard, setScorecard] = useState<AdvisorScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serviceMappings, setServiceMappings] = useState<Record<string, string>>({});
  const [isMultiStore, setIsMultiStore] = useState(false);
  const [selectedMtdMonth, setSelectedMtdMonth] = useState(() => {
    // Default to current month
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    if (user && token) {
      loadScorecard();
    }
  }, [user, token, selectedMtdMonth]);

  const fetchServiceMappings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/vendor-mappings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) return {};
      
      const data = await response.json();
      
      // Create a mapping object: service_field -> branded_name
      const mappings: Record<string, string> = {};
      (data.mappings || []).forEach((mapping: any) => {
        mappings[mapping.service_field] = mapping.product_name;
      });
      
      return mappings;
    } catch (err) {
      console.error('Error fetching service mappings:', err);
      return {};
    }
  };

  const loadScorecard = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch service mappings first
      const mappings = await fetchServiceMappings();
      setServiceMappings(mappings);

      // First, check if this advisor works at multiple stores by calling the by-store endpoint
      const [mtdYear, mtdMonth] = selectedMtdMonth.split('-');
      const byStoreResponse = await fetch(
        `${process.env.REACT_APP_API_URL}/api/scorecard/advisor/${user?.id}/by-store?mtdYear=${mtdYear}&mtdMonth=${mtdMonth}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (byStoreResponse.ok) {
        const multiStoreData = await byStoreResponse.json();
        setIsMultiStore(multiStoreData.isMultiStore && multiStoreData.totalStores > 1);
        
        // Convert rollup data to scorecard format for fallback use
        if (multiStoreData.rollupData) {
          const scorecardData: AdvisorScorecardData = {
            id: String(user?.id || ''),
            employee: `${user?.firstName} ${user?.lastName}`,
            store: multiStoreData.storeData?.map((s: any) => s.storeName).join(', ') || 'Pending Assignment',
            marketId: multiStoreData.marketId || 'TBD',
            marketName: multiStoreData.marketName || 'TBD',
            mappedUserId: String(user?.id || ''),
            mappedUserName: user?.email || '',
            totalSales: multiStoreData.rollupData.metrics?.sales || 0,
            salesPerVehicle: multiStoreData.rollupData.metrics?.invoices > 0 
              ? multiStoreData.rollupData.metrics.sales / multiStoreData.rollupData.metrics.invoices 
              : 0,
            grossProfit: multiStoreData.rollupData.metrics?.gpSales || 0,
            grossProfitPercent: parseFloat(multiStoreData.rollupData.metrics?.gpPercent || 0),
            grossProfitPerVehicle: multiStoreData.rollupData.metrics?.invoices > 0
              ? multiStoreData.rollupData.metrics.gpSales / multiStoreData.rollupData.metrics.invoices
              : 0,
            customerCount: multiStoreData.rollupData.metrics?.invoices || 0,
            // Map core KPIs using template keys
            invoices: multiStoreData.rollupData.metrics?.invoices || 0,
            sales: multiStoreData.rollupData.metrics?.sales || 0,
            gpsales: multiStoreData.rollupData.metrics?.gpSales || 0,
            gppercent: parseFloat(multiStoreData.rollupData.metrics?.gpPercent || 0),
            'avg.spend': multiStoreData.rollupData.metrics?.invoices > 0 
              ? multiStoreData.rollupData.metrics.sales / multiStoreData.rollupData.metrics.invoices 
              : 0,
            // Map services from rollup data
            ...Object.fromEntries(
              Object.entries(multiStoreData.rollupData.services || {}).map(([serviceName, value]) => {
                const templateKey = serviceName.toLowerCase().replace(/[^a-z0-9]/g, '');
                return [templateKey, value];
              })
            ),
            // Legacy fields for backward compatibility
            premiumOilChange: multiStoreData.rollupData.services?.['Premium Oil Change'] || 
                             multiStoreData.rollupData.services?.['BG Advanced Formula MOA®'] || 0,
            standardOilChange: multiStoreData.rollupData.services?.['Oil Change'] || 0,
            conventionalOilChange: 0,
            cabinAirFilter: multiStoreData.rollupData.services?.['Cabin Air Filter'] || 0,
            engineAirFilter: multiStoreData.rollupData.services?.['Engine Air Filter'] || 0,
            wiperBlades: multiStoreData.rollupData.services?.['Wiper Blades'] || 0,
            coolantFlush: multiStoreData.rollupData.services?.['Coolant Flush'] || 0,
            brakeFluidFlush: multiStoreData.rollupData.services?.['Brake Flush'] || 0,
            transmissionFluidService: multiStoreData.rollupData.services?.['Transmission Fluid Service'] || 0,
            fuelAdditive: multiStoreData.rollupData.services?.['Fuel Additive'] || 0,
            powerSteeringFluidService: multiStoreData.rollupData.services?.['Power Steering Flush'] || 0,
            engineFlush: multiStoreData.rollupData.services?.['Engine Flush'] || 0,
            acVentService: multiStoreData.rollupData.services?.['AC Service'] || 0,
            alignment: multiStoreData.rollupData.services?.['Alignments'] || 0,
            tireRotation: multiStoreData.rollupData.services?.['Tire Rotation'] || 0,
            battery: multiStoreData.rollupData.services?.['Battery'] || 0,
            lastUpdated: multiStoreData.lastUpdated || new Date().toISOString(),
            goals: multiStoreData.rollupData.goals,
            rawApiServices: multiStoreData.rollupData.services
          };
          
          setScorecard(scorecardData);
          setLoading(false);
          return;
        }
      }

      // Fallback to regular scorecard endpoint if by-store fails
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/scorecard/advisor/${user?.id}?mtdYear=${mtdYear}&mtdMonth=${mtdMonth}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('No performance data available yet. Please contact your manager.');
        } else {
          throw new Error('Failed to load scorecard');
        }
        return;
      }
      
      const data = await response.json();
      
      // Transform API response to AdvisorScorecardData format
      const scorecardData: AdvisorScorecardData = {
        id: String(user?.id || ''),
        employee: `${user?.firstName} ${user?.lastName}`,
        store: 'Pending Assignment', // Will be updated when we have store assignments in User type
        marketId: 694, // Default to Tire South market (694) for template loading
        mappedUserId: String(user?.id || ''),
        mappedUserName: user?.email || '',
        totalSales: data.metrics?.sales || 0,
        salesPerVehicle: data.metrics?.invoices > 0 
          ? (data.metrics?.sales || 0) / data.metrics.invoices 
          : 0,
        grossProfit: data.metrics?.gpSales || 0,
        grossProfitPercent: parseFloat(data.metrics?.gpPercent || 0),
        grossProfitPerVehicle: data.metrics?.invoices > 0
          ? (data.metrics?.gpSales || 0) / data.metrics.invoices
          : 0,
        customerCount: data.metrics?.invoices || 0,
        // Map services from API response
        premiumOilChange: data.services?.['Premium Oil Change'] || 0,
        standardOilChange: data.services?.['Oil Change'] || 0,
        conventionalOilChange: 0, // Not in current service list
        cabinAirFilter: data.services?.['Cabin Air Filter'] || 0,
        engineAirFilter: data.services?.['Engine Air Filter'] || 0,
        wiperBlades: 0, // Not in current service list
        coolantFlush: data.services?.['Coolant Flush'] || 0,
        brakeFluidFlush: data.services?.['Brake Flush'] || 0,
        transmissionFluidService: data.services?.['Transmission Fluid Service'] || 0,
        fuelAdditive: data.services?.['Fuel Additive'] || 0,
        powerSteeringFluidService: data.services?.['Power Steering Flush'] || 0,
        engineFlush: data.services?.['Engine Flush'] || 0,
        acVentService: 0, // Not in current service list
        alignment: data.services?.['Alignments'] || 0,
        tireRotation: 0, // Not in current service list
        battery: data.services?.['Battery'] || 0,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        goals: data.goals
      };
      
      setScorecard(scorecardData);
    } catch (err) {
      console.error('Error loading scorecard:', err);
      setError('Failed to load your scorecard. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadScorecard();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
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

  if (!scorecard) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">No scorecard data available.</p>
        <button
          onClick={handleRefresh}
          className="mt-4 btn btn-secondary flex items-center mx-auto"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">My Performance Scorecard</h2>
        <div className="flex items-center space-x-4">
          {/* MTD Month Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">
              MTD Month:
            </label>
            <select
              value={selectedMtdMonth}
              onChange={(e) => setSelectedMtdMonth(e.target.value)}
              className="form-input text-sm"
            >
              {/* Generate last 12 months */}
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const value = `${year}-${month}`;
                
                // Create data date (last day of the month, representing the "as of" date)
                const dataDate = new Date(year, date.getMonth() + 1, 0); // Last day of the month
                const monthName = date.toLocaleDateString('en-US', { month: 'long' });
                const dataDateString = dataDate.toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                });
                
                const label = `${monthName} Performance - ${dataDateString}`;
                return (
                  <option key={`${value}-${i}`} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            onClick={handleRefresh}
            className="btn btn-secondary flex items-center"
          >
            <ArrowPathIcon className="h-5 w-5 mr-2" />
            Refresh
          </button>
        </div>
      </div>
      
      {isMultiStore ? (
        // Use tabbed interface for multi-store advisors
        <StorePerformanceTabs
          advisor={scorecard}
          selectedMtdMonth={selectedMtdMonth}
          serviceMappings={serviceMappings}
          className="border border-gray-200 rounded-lg p-6 bg-white"
        />
      ) : (
        // Use regular scorecard for single-store advisors
        <AdvisorScorecard
          advisor={scorecard}
          serviceMappings={serviceMappings}
          className="border border-gray-200 rounded-lg p-6 bg-white"
        />
      )}
      
      {scorecard.goals && Object.keys(scorecard.goals).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">🎯 My Performance Goals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(scorecard.goals).map(([metric, goal]: [string, any]) => (
              <div key={metric} className="bg-white rounded-lg p-4 border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-gray-900">{metric}</h4>
                  <span className="text-sm text-gray-500">{goal.periodType}</span>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-blue-600">{goal.target}</span>
                  <span className="text-sm text-gray-600">target</span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Effective: {new Date(goal.effectiveDate).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalScorecard;