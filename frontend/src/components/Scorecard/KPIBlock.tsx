import React from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { KPIMetric } from '../../types/scorecard';

interface KPIBlockProps {
  title: string;
  metrics: KPIMetric[];
  className?: string;
}

const KPIBlock: React.FC<KPIBlockProps> = ({ title, metrics, className = '' }) => {
  const formatValue = (value: number | string, format: 'currency' | 'percentage' | 'number') => {
    if (typeof value === 'string') return value;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      <div className="px-6 py-4 border-b border-gray-100">
        <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.map((metric, index) => (
            <div key={index} className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-600">
                    {metric.label}
                  </span>
                  {metric.tooltip && (
                    <div className="group relative">
                      <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                        {metric.tooltip}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-1">
                <span className="text-2xl font-bold text-gray-900">
                  {formatValue(metric.value, metric.format)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KPIBlock;