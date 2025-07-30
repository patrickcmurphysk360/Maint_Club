// Type definitions for Maintenance Club MVP

export interface User {
  id: number; // Now using only numeric IDs
  firstName: string;
  lastName: string;
  email: string;
  role: 'administrator' | 'marketManager' | 'storeManager' | 'advisor' | 'market_manager' | 'store_manager';
  permissions?: {
    canViewScorecard?: boolean;
    canSetGoals?: boolean;
    canSendCoaching?: boolean;
    canManageVendorMappings?: boolean;
  };
}

export interface ScorecardMetrics {
  invoices: number;
  sales: number;
  gpPercent: number;
  gpSales: number;
}

export interface ScorecardServices {
  [serviceName: string]: number;
}

export interface ScorecardGoal {
  target: number;
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  effectiveDate: string;
}

export interface ScorecardGoals {
  [metricName: string]: ScorecardGoal;
}

export interface AdvisorScorecard {
  metrics: ScorecardMetrics;
  services: ScorecardServices;
  goals?: ScorecardGoals;
  advisorName?: string;
  period?: string;
  lastUpdated?: string;
}

export interface FileUpload {
  id?: number;
  filename: string;
  fileType: 'services' | 'operations';
  uploadDate: string;
  status: 'processing' | 'completed' | 'failed';
  uploadedBy?: string;
  recordsProcessed?: number;
}

export interface VendorProductMapping {
  id: number;
  vendorId: string;
  serviceField: string;
  productName: string;
  description?: string;
}

export interface Goal {
  id: number;
  goalType: 'advisor' | 'store' | 'market';
  advisorUserId?: number;
  storeId?: number;
  marketId?: number;
  metricName: string;
  targetValue: number;
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  effectiveDate: string;
  createdBy: number;
}

export interface CoachingMessage {
  id: number;
  advisorUserId: number;
  authorUserId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
  authorName?: string;
}

// Re-export scorecard types for convenience
export type { AdvisorScorecardData, KPIMetric, ServiceMetric } from './types/scorecard';