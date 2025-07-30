import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdvisorScorecard from './AdvisorScorecard';
import { AdvisorScorecardData } from '../../types/scorecard';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const PersonalScorecard: React.FC = () => {
  const { user, token } = useAuth();
  const [scorecard, setScorecard] = useState<AdvisorScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serviceMappings, setServiceMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && token) {
      loadScorecard();
    }
  }, [user, token]);

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

      // Fetch scorecard data
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/scorecard/advisor/${user?.id}`,
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
        marketId: 'TBD', // Will be updated when we have market assignments in User type
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
        <button
          onClick={handleRefresh}
          className="btn btn-secondary flex items-center"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          Refresh
        </button>
      </div>
      
      <AdvisorScorecard
        advisor={scorecard}
        serviceMappings={serviceMappings}
        className="border border-gray-200 rounded-lg p-6 bg-white"
      />
      
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