import React from 'react';
import { AdvisorScorecardData, KPIMetric } from '../../types/scorecard';
import AdvisorInfo from './AdvisorInfo';
import KPIBlock from './KPIBlock';
import { SERVICE_CATEGORIES, getServiceDisplayName } from '../../constants/serviceCategories';

interface AdvisorScorecardProps {
  advisor: AdvisorScorecardData;
  onMessageAdvisor?: (advisor: AdvisorScorecardData) => void;
  onSetGoals?: (advisor: AdvisorScorecardData) => void;
  canSetGoals?: boolean;
  className?: string;
  serviceMappings?: Record<string, string>;
}

const AdvisorScorecard: React.FC<AdvisorScorecardProps> = ({ 
  advisor, 
  onMessageAdvisor,
  onSetGoals,
  canSetGoals,
  className = '',
  serviceMappings = {}
}) => {
  // Get current month/year for display
  const currentDate = new Date();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
  const year = currentDate.getFullYear();

  // Define KPI metrics with tooltips
  const kpiMetrics: KPIMetric[] = [
    {
      label: 'Total Sales',
      value: advisor.totalSales,
      format: 'currency',
      tooltip: `Total revenue generated for ${monthName} ${year}`
    },
    {
      label: 'Sales per Vehicle',
      value: advisor.salesPerVehicle,
      format: 'currency',
      tooltip: 'Average revenue per vehicle serviced'
    },
    {
      label: 'Gross Profit',
      value: advisor.grossProfit,
      format: 'currency',
      tooltip: 'Total gross profit generated'
    },
    {
      label: 'Gross Profit %',
      value: advisor.grossProfitPercent,
      format: 'percentage',
      tooltip: 'Gross profit as percentage of sales'
    },
    {
      label: 'GP per Vehicle',
      value: advisor.grossProfitPerVehicle,
      format: 'currency',
      tooltip: 'Average gross profit per vehicle'
    },
    {
      label: 'Customer Count',
      value: advisor.customerCount,
      format: 'number',
      tooltip: 'Total number of customers served'
    }
  ];

  // Get service value from advisor data (with fallback to 0)
  const getServiceValue = (serviceKey: string): number => {
    return (advisor as any)[serviceKey] || 0;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Advisor Information */}
      <AdvisorInfo 
        advisor={advisor} 
        onMessageAdvisor={onMessageAdvisor}
        onSetGoals={onSetGoals}
        canSetGoals={canSetGoals}
      />
      
      {/* Month-to-Date Performance Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">
              📊 Month-to-Date Performance
            </h3>
            <p className="text-blue-700 text-sm">
              Performance metrics for {monthName} {year} (as of {currentDate.toLocaleDateString()})
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-900">{monthName}</div>
            <div className="text-sm text-blue-600">{year}</div>
          </div>
        </div>
      </div>
      
      {/* Performance KPIs */}
      <KPIBlock
        title="Key Performance Indicators"
        metrics={kpiMetrics}
        className="col-span-full"
      />
      
      {/* Service Categories */}
      {SERVICE_CATEGORIES.map((category) => {
        // Skip Core Metrics as they're displayed above
        if (category.name === 'Core Metrics') return null;
        
        // Filter services that have non-zero values
        const activeServices = category.services.filter(service => getServiceValue(service.key) > 0);
        
        // Only show category if it has active services
        if (activeServices.length === 0) return null;
        
        return (
          <div key={category.name} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <span className="text-2xl mr-3">{category.icon}</span>
              <h3 className={`text-lg font-semibold text-${category.color}-900`}>
                {category.name}
              </h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {category.services.map((service) => {
                const value = getServiceValue(service.key);
                const displayName = getServiceDisplayName(service.key, serviceMappings);
                
                return (
                  <div key={service.key} className={`bg-${category.color}-50 rounded-lg p-3 border border-${category.color}-100`}>
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    <div className="text-sm text-gray-600 leading-tight" title={service.description}>
                      {displayName}
                    </div>
                    {serviceMappings[service.key] && (
                      <div className="text-xs text-blue-600 mt-1">
                        📦 Branded
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdvisorScorecard;