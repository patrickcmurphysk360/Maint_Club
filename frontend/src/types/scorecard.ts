export interface AdvisorScorecardData {
  id: string;
  employee: string;
  store: string;
  marketId: number | null; // Changed to numeric for template loading
  marketName?: string; // Added for display purposes
  mappedUserId?: string;
  mappedUserName?: string;
  
  // Performance KPIs
  totalSales: number;
  salesPerVehicle: number;
  grossProfit: number;
  grossProfitPercent: number;
  grossProfitPerVehicle: number;
  customerCount: number;
  
  // Service Metrics
  premiumOilChange: number;
  standardOilChange: number;
  conventionalOilChange: number;
  cabinAirFilter: number;
  engineAirFilter: number;
  wiperBlades: number;
  coolantFlush: number;
  brakeFluidFlush: number;
  brakeService: number;
  transmissionFluidService: number;
  fuelAdditive: number;
  fuelSystemService: number;
  powerSteeringFluidService: number;
  engineFlush: number;
  acVentService: number;
  alignment: number;
  tireRotation: number;
  battery: number;
  differentialService: number;
  allTires: number;
  
  // Metadata
  uploadDate?: string;
  lastUpdated: string;
  
  // Goals
  goals?: Record<string, {
    target: number;
    periodType: string;
    effectiveDate: string;
  }>;
  
  // Raw API service data for branded name lookup
  rawApiServices?: Record<string, number>;
}

export interface KPIMetric {
  label: string;
  value: number | string;
  format: 'currency' | 'percentage' | 'number';
  tooltip?: string;
  goal?: {
    target: number;
    periodType: string;
    effectiveDate: string;
  };
}

export interface ServiceMetric {
  label: string;
  value: number;
  category?: string;
}