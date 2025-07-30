// Service Categories for Advisor Scorecards
// Generic names that can be overridden by vendor mappings

export interface ServiceField {
  key: string;
  label: string;
  description?: string;
}

export interface ServiceCategory {
  name: string;
  icon: string;
  color: string;
  services: ServiceField[];
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    name: "Core Metrics",
    icon: "📊",
    color: "blue",
    services: [
      { key: "invoices", label: "Invoices", description: "Total number of invoices" },
      { key: "sales", label: "Sales", description: "Total sales revenue" },
      { key: "avgSpend", label: "Avg. Spend", description: "Average customer spend per visit" },
      { key: "gpSales", label: "GP Sales", description: "Gross profit sales" },
      { key: "gpPercent", label: "GP Percent", description: "Gross profit percentage" }
    ]
  },
  {
    name: "Tires & Alignment",
    icon: "🛞",
    color: "indigo",
    services: [
      { key: "allTires", label: "All Tires", description: "Total tire sales" },
      { key: "retailTires", label: "Retail Tires", description: "Retail tire sales" },
      { key: "tireProtection", label: "Tire Protection", description: "Tire protection plans sold" },
      { key: "tireProtectionPercent", label: "Tire Protection %", description: "Tire protection attachment rate" },
      { key: "potentialAlignments", label: "Potential Alignments", description: "Alignment opportunities identified" },
      { key: "potentialAlignmentsSold", label: "Potential Alignments Sold", description: "Alignment opportunities converted" },
      { key: "potentialAlignmentsPercent", label: "Potential Alignments %", description: "Alignment conversion rate" },
      { key: "alignments", label: "Alignments", description: "Standard alignments performed" },
      { key: "premiumAlignments", label: "Premium Alignments", description: "Premium alignment services" },
      { key: "tireBalance", label: "Tire Balance", description: "Tire balancing services" },
      { key: "tireRotation", label: "Tire Rotation", description: "Tire rotation services" },
      { key: "tpms", label: "TPMS", description: "Tire pressure monitoring system services" },
      { key: "nitrogen", label: "Nitrogen", description: "Nitrogen tire inflation" }
    ]
  },
  {
    name: "Oil & Fluid Services",
    icon: "🛢️",
    color: "amber",
    services: [
      { key: "oilChange", label: "Oil Change", description: "Standard oil changes" },
      { key: "premiumOilChange", label: "Premium Oil Change", description: "Premium oil change services" },
      { key: "syntheticBlendOilChange", label: "Synthetic Blend Oil Change", description: "Synthetic blend oil services" },
      { key: "syntheticOilChange", label: "Synthetic Oil Change", description: "Full synthetic oil services" },
      { key: "coolantFlush", label: "Coolant Flush", description: "Cooling system flush" },
      { key: "brakeFlush", label: "Brake Flush", description: "Brake fluid flush" },
      { key: "brakeFlushToServicePercent", label: "Brake Flush to Service %", description: "Brake flush attachment to brake service" },
      { key: "differentialService", label: "Differential Service", description: "Differential fluid service" },
      { key: "fuelSystemService", label: "Fuel System Service", description: "Fuel system cleaning" },
      { key: "powerSteeringFlush", label: "Power Steering Flush", description: "Power steering fluid service" },
      { key: "transmissionFluidService", label: "Transmission Fluid Service", description: "Transmission fluid change" },
      { key: "transferCaseService", label: "Transfer Case Service", description: "Transfer case fluid service" }
    ]
  },
  {
    name: "Brake & Suspension",
    icon: "🔧",
    color: "red",
    services: [
      { key: "brakeService", label: "Brake Service", description: "Brake repair and maintenance" },
      { key: "shocksStruts", label: "Shocks & Struts", description: "Suspension component replacement" }
    ]
  },
  {
    name: "Engine & Performance",
    icon: "⚙️",
    color: "green",
    services: [
      { key: "engineAirFilter", label: "Engine Air Filter", description: "Engine air filter replacement" },
      { key: "fuelAdditive", label: "Fuel Additive", description: "Fuel system additives" },
      { key: "fuelFilter", label: "Fuel Filter", description: "Fuel filter replacement" },
      { key: "sparkPlugReplacement", label: "Spark Plug Replacement", description: "Spark plug service" },
      { key: "timingBelt", label: "Timing Belt", description: "Timing belt replacement" },
      { key: "enginePerformanceService", label: "Engine Performance Service", description: "Engine diagnostic and tune-up" },
      { key: "beltsReplacement", label: "Belts Replacement", description: "Drive belt replacement" },
      { key: "hoseReplacement", label: "Hose Replacement", description: "Radiator and system hose replacement" }
    ]
  },
  {
    name: "Climate & Electrical",
    icon: "🔋",
    color: "purple",
    services: [
      { key: "acService", label: "AC Service", description: "Air conditioning service" },
      { key: "climateControlService", label: "Climate Control Service", description: "HVAC system service" },
      { key: "battery", label: "Battery", description: "Battery replacement" },
      { key: "batteryService", label: "Battery Service", description: "Battery testing and service" },
      { key: "cabinAirFilter", label: "Cabin Air Filter", description: "Cabin air filter replacement" }
    ]
  },
  {
    name: "Maintenance & Inspection",
    icon: "🔍",
    color: "gray",
    services: [
      { key: "completeVehicleInspection", label: "Complete Vehicle Inspection", description: "Comprehensive vehicle inspection" },
      { key: "wiperBlades", label: "Wiper Blades", description: "Windshield wiper replacement" },
      { key: "headlightRestorationService", label: "Headlight Restoration Service", description: "Headlight lens restoration" }
    ]
  }
];

// Helper function to get all services as a flat array
export const getAllServices = (): ServiceField[] => {
  return SERVICE_CATEGORIES.flatMap(category => category.services);
};

// Helper function to find service by key
export const findServiceByKey = (key: string): ServiceField | undefined => {
  return getAllServices().find(service => service.key === key);
};

// Helper function to get branded service name or fallback to generic
export const getServiceDisplayName = (
  serviceKey: string, 
  serviceMappings: Record<string, string>
): string => {
  const service = findServiceByKey(serviceKey);
  const genericName = service?.label || serviceKey;
  const mappedName = serviceMappings[serviceKey];
  
  // TODO: Remove debug logging once service mapping is verified working
  console.log(`Service display name - Key: ${serviceKey}, Generic: ${genericName}, Mapped: ${mappedName}, Available mappings:`, Object.keys(serviceMappings));
  
  return mappedName || genericName;
};