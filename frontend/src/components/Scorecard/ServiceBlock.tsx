import React from 'react';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { ServiceMetric } from '../../types/scorecard';

interface ServiceBlockProps {
  title: string;
  services: ServiceMetric[];
  className?: string;
}

const ServiceBlock: React.FC<ServiceBlockProps> = ({ title, services, className = '' }) => {
  // Group services by category for better organization
  const serviceCategories = {
    'Oil Changes': ['PREMIUM OIL CHANGE', 'STANDARD OIL CHANGE', 'CONVENTIONAL OIL CHANGE'],
    'Filters': ['CABIN AIR FILTER', 'ENGINE AIR FILTER'],
    'Fluids': ['COOLANT FLUSH', 'BRAKE FLUID FLUSH', 'TRANSMISSION FLUID SERVICE', 'POWER STEERING FLUID SERVICE'],
    'Engine Services': ['FUEL ADDITIVE', 'ENGINE FLUSH', 'AC VENT SERVICE'],
    'Maintenance': ['WIPER BLADES', 'ALIGNMENT', 'TIRE ROTATION', 'BATTERY']
  };

  const getCategoryForService = (serviceLabel: string): string => {
    for (const [category, serviceNames] of Object.entries(serviceCategories)) {
      if (serviceNames.some(name => serviceLabel.toUpperCase().includes(name))) {
        return category;
      }
    }
    return 'Other';
  };

  const groupedServices = services.reduce((acc, service) => {
    const category = getCategoryForService(service.label);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, ServiceMetric[]>);

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'Oil Changes': 'bg-blue-50 border-blue-200',
      'Filters': 'bg-green-50 border-green-200',
      'Fluids': 'bg-purple-50 border-purple-200',
      'Engine Services': 'bg-orange-50 border-orange-200',
      'Maintenance': 'bg-gray-50 border-gray-200',
      'Other': 'bg-gray-50 border-gray-200'
    };
    return colors[category as keyof typeof colors] || colors['Other'];
  };

  const getCategoryIcon = (category: string): string => {
    const iconColors: Record<string, string> = {
      'Oil Changes': 'text-blue-600',
      'Filters': 'text-green-600',
      'Fluids': 'text-purple-600',
      'Engine Services': 'text-orange-600',
      'Maintenance': 'text-gray-600',
      'Other': 'text-gray-600'
    };
    return iconColors[category as keyof typeof iconColors] || iconColors['Other'];
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <WrenchScrewdriverIcon className="h-5 w-5 text-gray-600" />
          <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
        </div>
      </div>
      
      <div className="p-6">
        <div className="space-y-6">
          {Object.entries(groupedServices).map(([category, categoryServices]) => (
            <div key={category} className={`rounded-lg border p-4 ${getCategoryColor(category)}`}>
              <h5 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <WrenchScrewdriverIcon className={`h-4 w-4 mr-2 ${getCategoryIcon(category)}`} />
                {category}
              </h5>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryServices.map((service, index) => (
                  <div key={index} className="bg-white rounded-md p-3 border border-gray-200">
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      {service.label}
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {service.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Service Summary */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-600">Total Services:</span>
            <span className="font-bold text-lg text-gray-900">
              {services.reduce((sum, service) => sum + service.value, 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceBlock;