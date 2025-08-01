import React, { useState, useEffect } from 'react';
import { AdvisorScorecardData, KPIMetric } from '../../types/scorecard';
import AdvisorInfo from './AdvisorInfo';
import KPIBlock from './KPIBlock';
import GoalIndicator from './GoalIndicator';
import { getServiceDisplayName } from '../../constants/serviceCategories';
import { useAuth } from '../../contexts/AuthContext';

interface TemplateField {
  id: number;
  field_key: string;
  field_label: string;
  field_type: 'kpi' | 'service';
  field_format: 'currency' | 'percentage' | 'number';
  display_order: number;
  is_enabled: boolean;
  show_goal: boolean;
}

interface TemplateCategory {
  id: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  display_order: number;
  is_enabled: boolean;
  fields: TemplateField[];
}

interface ScorecardTemplate {
  id: number;
  market_id?: number;
  template_name: string;
  is_default: boolean;
  market_name?: string;
  categories: TemplateCategory[];
}

interface AdvisorScorecardProps {
  advisor: AdvisorScorecardData;
  onMessageAdvisor?: (advisor: AdvisorScorecardData) => void;
  onSetGoals?: (advisor: AdvisorScorecardData) => void;
  onEditProfile?: (advisor: AdvisorScorecardData) => void;
  onMapAdvisor?: (advisor: AdvisorScorecardData) => void;
  canSetGoals?: boolean;
  canEditProfile?: boolean;
  className?: string;
  serviceMappings?: Record<string, string>;
}

const AdvisorScorecard: React.FC<AdvisorScorecardProps> = ({ 
  advisor, 
  onMessageAdvisor,
  onSetGoals,
  onEditProfile,
  onMapAdvisor,
  canSetGoals,
  canEditProfile,
  className = '',
  serviceMappings = {}
}) => {
  const { token } = useAuth();
  const [template, setTemplate] = useState<ScorecardTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  // Get current month/year for display
  const currentDate = new Date();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' });
  const year = currentDate.getFullYear();
  
  // Calculate data date (typically file date - 1 day)
  // For now, we'll show "as of" the day before the current date
  // TODO: Get actual upload date from API and subtract 1 day
  const dataDate = new Date(currentDate);
  dataDate.setDate(dataDate.getDate() - 1);
  const dataDateString = dataDate.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  useEffect(() => {
    loadTemplate();
  }, [advisor.marketId]);

  const loadTemplate = async () => {
    try {
      if (!advisor.marketId) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/scorecard-templates/market/${advisor.marketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplate(data);
      }
    } catch (error) {
      console.error('Error loading scorecard template:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get service value from advisor data (with fallback to 0)
  const getServiceValue = (serviceKey: string): number => {
    return (advisor as any)[serviceKey] || 0;
  };

  // Get KPI metrics from template or fallback to default
  const getKPIMetrics = () => {
    if (!template) {
      // Fallback to default KPIs
      return [
        {
          label: 'Total Sales',
          value: advisor.totalSales,
          format: 'currency' as const,
          tooltip: `Total revenue generated for ${monthName} ${year}`,
          goal: advisor.goals?.totalSales
        },
        {
          label: 'Sales per Vehicle',
          value: advisor.salesPerVehicle,
          format: 'currency' as const,
          tooltip: 'Average revenue per vehicle serviced',
          goal: advisor.goals?.salesPerVehicle
        },
        {
          label: 'Gross Profit',
          value: advisor.grossProfit,
          format: 'currency' as const,
          tooltip: 'Total gross profit generated',
          goal: advisor.goals?.grossProfit
        },
        {
          label: 'Gross Profit %',
          value: advisor.grossProfitPercent,
          format: 'percentage' as const,
          tooltip: 'Gross profit as percentage of sales',
          goal: advisor.goals?.grossProfitPercent
        },
        {
          label: 'Customer Count',
          value: advisor.customerCount,
          format: 'number' as const,
          tooltip: 'Total number of customers served',
          goal: advisor.goals?.customerCount
        }
      ];
    }

    // Find Core KPIs category
    const coreCategory = template.categories.find(cat => 
      cat.category_name.toLowerCase().includes('kpi') || 
      cat.category_name.toLowerCase().includes('core')
    );

    if (!coreCategory) return [];

    return coreCategory.fields
      .filter(field => field.is_enabled && field.field_type === 'kpi')
      .sort((a, b) => a.display_order - b.display_order)
      .map(field => ({
        label: field.field_label,
        value: getServiceValue(field.field_key),
        format: field.field_format,
        tooltip: `${field.field_label} for ${monthName} ${year}`,
        goal: advisor.goals?.[field.field_key]
      }));
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

  const kpiMetrics = getKPIMetrics();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Advisor Information */}
      <AdvisorInfo 
        advisor={advisor} 
        onMessageAdvisor={onMessageAdvisor}
        onSetGoals={onSetGoals}
        onEditProfile={onEditProfile}
        onMapAdvisor={onMapAdvisor}
        canSetGoals={canSetGoals}
        canEditProfile={canEditProfile}
      />
      
      {/* Month-to-Date Performance Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">
              📊 Month-to-Date Performance
            </h3>
            <p className="text-blue-700 text-sm">
              Performance metrics for {monthName} {year} (as of {dataDateString})
              {template && template.template_name && (
                <span className="ml-2 text-xs bg-blue-100 px-2 py-1 rounded">
                  {template.template_name}
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-900">{monthName}</div>
            <div className="text-sm text-blue-600">{year}</div>
          </div>
        </div>
      </div>
      
      {/* Performance KPIs */}
      {kpiMetrics.length > 0 && (
        <KPIBlock
          title="Key Performance Indicators"
          metrics={kpiMetrics}
          className="col-span-full"
        />
      )}
      
      {/* Template Categories */}
      {template?.categories
        .filter(category => category.is_enabled && category.fields.some(f => f.field_type === 'service' && f.is_enabled))
        .sort((a, b) => a.display_order - b.display_order)
        .map((category) => {
          // Filter enabled service fields that have non-zero values
          const activeFields = category.fields
            .filter(field => field.is_enabled && field.field_type === 'service')
            .filter(field => getServiceValue(field.field_key) > 0 || field.show_goal);
          
          // Only show category if it has active fields
          if (activeFields.length === 0) return null;
          
          return (
            <div key={category.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">{category.category_icon}</span>
                <h3 className={`text-lg font-semibold text-${category.category_color}-900`}>
                  {category.category_name}
                </h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {category.fields
                  .filter(field => field.is_enabled && field.field_type === 'service')
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((field) => {
                    const value = getServiceValue(field.field_key);
                    // Start with template field_label as default
                    let displayName = field.field_label || '';
                    
                    // Check if there's a branded service name in the raw API services data
                    if (advisor.rawApiServices) {
                      const brandedService = Object.keys(advisor.rawApiServices).find(serviceName => {
                        // Check if this service name corresponds to our field by looking for branded versions
                        if (field.field_key === 'premiumoilchange' && serviceName.includes('MOA®')) return true;
                        if (field.field_key === 'engineperformanceservice' && serviceName.includes('EPR®')) return true;
                        return false;
                      });
                      
                      if (brandedService) {
                        displayName = brandedService;
                        console.log(`🎯 Found branded service: ${field.field_key} -> ${brandedService}`);
                      }
                    }
                    
                    // If display name is still empty or same as field key, try other methods
                    if (!displayName || displayName === field.field_key) {
                      // Try service mappings
                      const mappedName = getServiceDisplayName(field.field_key, serviceMappings);
                      if (mappedName && mappedName !== field.field_key) {
                        displayName = mappedName;
                      } else {
                        // Last resort: convert field_key to readable format
                        displayName = field.field_key
                          .replace(/([a-z])([A-Z])/g, '$1 $2')
                          .replace(/&/g, ' & ')
                          .split(/[\s_-]+/)
                          .map(word => {
                            // Special cases
                            if (word.toLowerCase() === 'gp') return 'GP';
                            if (word.toLowerCase() === 'ac') return 'AC';
                            if (word.toLowerCase() === 'tpms') return 'TPMS';
                            if (word.toLowerCase() === 'hvac') return 'HVAC';
                            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                          })
                          .join(' ');
                      }
                    }
                    const goal = advisor.goals?.[field.field_key];
                    
                    return (
                      <div key={field.id} className={`bg-${category.category_color}-50 rounded-lg p-3 border border-${category.category_color}-100`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-2xl font-bold text-gray-900">{value}</div>
                          {goal && field.show_goal && (
                            <GoalIndicator 
                              actual={value} 
                              goal={goal.target} 
                              format={field.field_format}
                              showValue={false}
                              size="sm"
                            />
                          )}
                        </div>
                        <div className="text-sm text-gray-600 leading-tight">
                          {displayName}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          {serviceMappings[field.field_key] && (
                            <div className="text-xs text-blue-600">
                              📦 Branded
                            </div>
                          )}
                          {goal && field.show_goal && (
                            <div className="text-xs text-gray-500">
                              Goal: {goal.target}
                            </div>
                          )}
                        </div>
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