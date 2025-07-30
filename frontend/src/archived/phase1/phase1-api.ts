import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api/phase1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// User types for Phase 1
export interface Phase1User {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile?: string;
  role: 'administrator' | 'market_manager' | 'store_manager' | 'advisor' | 'vendor_partner';
  vendor?: string;
  status: 'active' | 'inactive' | 'pending';
  created_at?: string;
  last_login?: string;
  assigned_markets?: string[];
  assigned_stores?: string[];
  market_assignments?: any[];
  store_assignments?: any[];
}

export interface Market {
  market_id: string;
  market_name: string;
  vendor_tags: string[];
  description?: string;
  city?: string;
  state?: string;
  zip?: string;
  contact_market_manager_id?: string;
  contact_market_manager?: Phase1User;
  store_count?: number;
  stores?: Store[];
  assigned_users?: any[];
}

export interface Store {
  store_id: string;
  store_name: string;
  market_id: string;
  market_name?: string;
  address?: string;
  phone?: string;
  status: 'active' | 'inactive';
  market_vendor_tags?: string[];
}

export interface AdvisorMapping {
  id?: number;
  employee_name: string;
  market_id: string;
  market_name?: string;
  store_name: string;
  user_id?: string;
  mapped_user_name?: string;
  mapped_user_email?: string;
}

// Users API
export const phase1UsersAPI = {
  getUsers: async (filters?: { role?: string; status?: string; vendor?: string }) => {
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.vendor) params.append('vendor', filters.vendor);
    
    const response = await api.get(`/users?${params}`);
    return response.data;
  },
  
  getUser: async (userId: string) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  
  createUser: async (userData: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    mobile?: string;
    password: string;
    role: string;
    vendor?: string;
    markets?: string[];
    stores?: string[];
  }) => {
    const response = await api.post('/users', userData);
    return response.data;
  },
  
  updateUser: async (userId: string, updates: Partial<Phase1User> & { password?: string; markets?: string[]; stores?: string[] }) => {
    const response = await api.put(`/users/${userId}`, updates);
    return response.data;
  },
  
  deleteUser: async (userId: string) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },
  
  getAvailableRoles: async () => {
    const response = await api.get('/users/roles/available');
    return response.data;
  }
};

// Markets API
export const phase1MarketsAPI = {
  getMarkets: async (filters?: { vendor_tag?: string }) => {
    const params = new URLSearchParams();
    if (filters?.vendor_tag) params.append('vendor_tag', filters.vendor_tag);
    
    const response = await api.get(`/markets?${params}`);
    return response.data;
  },
  
  getMarket: async (marketId: string) => {
    const response = await api.get(`/markets/${marketId}`);
    return response.data;
  },
  
  createMarket: async (marketData: {
    market_id?: string;
    market_name: string;
    vendor_tags?: string[];
    description?: string;
  }) => {
    const response = await api.post('/markets', marketData);
    return response.data;
  },
  
  updateMarket: async (marketId: string, updates: {
    market_name?: string;
    vendor_tags?: string[];
    description?: string;
  }) => {
    const response = await api.put(`/markets/${marketId}`, updates);
    return response.data;
  },
  
  deleteMarket: async (marketId: string) => {
    const response = await api.delete(`/markets/${marketId}`);
    return response.data;
  },
  
  assignUser: async (marketId: string, userId: string) => {
    const response = await api.post(`/markets/${marketId}/assign-user`, { user_id: userId });
    return response.data;
  },
  
  unassignUser: async (marketId: string, userId: string) => {
    const response = await api.delete(`/markets/${marketId}/unassign-user/${userId}`);
    return response.data;
  }
};

// Stores API
export const phase1StoresAPI = {
  getStores: async (filters?: { market_id?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.market_id) params.append('market_id', filters.market_id);
    if (filters?.status) params.append('status', filters.status);
    
    const response = await api.get(`/stores?${params}`);
    return response.data;
  },
  
  getStore: async (storeId: string) => {
    const response = await api.get(`/stores/${storeId}`);
    return response.data;
  },
  
  createStore: async (storeData: {
    store_id?: string;
    store_name: string;
    market_id: string;
    address?: string;
    phone?: string;
  }) => {
    const response = await api.post('/stores', storeData);
    return response.data;
  },
  
  updateStore: async (storeId: string, updates: {
    store_name?: string;
    market_id?: string;
    address?: string;
    phone?: string;
    status?: string;
  }) => {
    const response = await api.put(`/stores/${storeId}`, updates);
    return response.data;
  },
  
  deleteStore: async (storeId: string) => {
    const response = await api.delete(`/stores/${storeId}`);
    return response.data;
  }
};

// Advisor Mappings API
export const phase1AdvisorMappingsAPI = {
  getMappings: async (filters?: { market_id?: string; store_name?: string; unmapped_only?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.market_id) params.append('market_id', filters.market_id);
    if (filters?.store_name) params.append('store_name', filters.store_name);
    if (filters?.unmapped_only) params.append('unmapped_only', 'true');
    
    const response = await api.get(`/advisor-mappings?${params}`);
    return response.data;
  },
  
  getUnmapped: async () => {
    const response = await api.get('/advisor-mappings/unmapped');
    return response.data;
  },
  
  assignUser: async (mappingId: number, userId: string) => {
    const response = await api.post(`/advisor-mappings/${mappingId}/assign-user`, { user_id: userId });
    return response.data;
  },
  
  createUser: async (mappingId: number, userData: {
    name: string;
    email: string;
    password: string;
  }) => {
    const response = await api.post(`/advisor-mappings/${mappingId}/create-user`, userData);
    return response.data;
  },
  
  unassignUser: async (mappingId: number) => {
    const response = await api.delete(`/advisor-mappings/${mappingId}/unassign-user`);
    return response.data;
  },
  
  getAvailableUsers: async () => {
    const response = await api.get('/advisor-mappings/available-users');
    return response.data;
  }
};

// Export API
export const phase1ExportAPI = {
  exportUsers: async () => {
    const response = await api.get('/export/users');
    return response.data;
  },
  
  exportMarkets: async () => {
    const response = await api.get('/export/markets');
    return response.data;
  },
  
  exportStores: async () => {
    const response = await api.get('/export/stores');
    return response.data;
  },
  
  exportAdvisorMappings: async () => {
    const response = await api.get('/export/advisor-mappings');
    return response.data;
  },
  
  exportAll: async () => {
    const response = await api.get('/export/all');
    return response.data;
  }
};