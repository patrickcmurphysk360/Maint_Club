import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api`,
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

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  
  logout: async () => {
    await api.post('/auth/logout');
  }
};

// Performance API
export const performanceAPI = {
  uploadServices: async (file: File, reportDate: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reportDate', reportDate);
    
    const response = await api.post('/performance/upload/services', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  uploadOperations: async (file: File, reportDate: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reportDate', reportDate);
    
    const response = await api.post('/performance/upload/operations', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  parseAdvisors: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/performance/parse-advisors', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  getAdvisorMappings: async () => {
    const response = await api.get('/performance/advisor-mappings');
    return response.data;
  },
  
  createAdvisorMapping: async (mapping: any) => {
    const response = await api.post('/performance/advisor-mappings', mapping);
    return response.data;
  },
  
  getUploads: async (limit = 20) => {
    const response = await api.get(`/performance/uploads?limit=${limit}`);
    return response.data;
  }
};

// Scorecard API
export const scorecardAPI = {
  getAdvisorScorecard: async (userId: number, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await api.get(`/scorecard/advisor/${userId}?${params}`);
    return response.data;
  },
  
  getComparison: async (filters: any = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value as string);
    });
    
    const response = await api.get(`/scorecard/comparison?${params}`);
    return response.data;
  }
};

// Vendor API
export const vendorAPI = {
  getProductMappings: async () => {
    const response = await api.get('/vendor/product-mappings');
    return response.data;
  },
  
  getServiceFields: async () => {
    const response = await api.get('/vendor/service-fields');
    return response.data;
  },
  
  getVendorTags: async () => {
    const response = await api.get('/vendor/tags');
    return response.data;
  },
  
  createProductMapping: async (mapping: any) => {
    const response = await api.post('/vendor/product-mappings', mapping);
    return response.data;
  },
  
  updateProductMapping: async (id: number, mapping: any) => {
    const response = await api.put(`/vendor/product-mappings/${id}`, mapping);
    return response.data;
  },
  
  deleteProductMapping: async (id: number) => {
    const response = await api.delete(`/vendor/product-mappings/${id}`);
    return response.data;
  }
};

// Goals API
export const goalsAPI = {
  getAvailableMetrics: async () => {
    const response = await api.get('/goals/available-metrics');
    return response.data;
  },
  
  getGoals: async (goalType: string, entityId: string, effectiveDate?: string) => {
    const params = new URLSearchParams();
    if (effectiveDate) params.append('effectiveDate', effectiveDate);
    
    const response = await api.get(`/goals/${goalType}/${entityId}?${params}`);
    return response.data;
  },
  
  saveGoals: async (data: any) => {
    const response = await api.post('/goals', data);
    return response.data;
  },
  
  deleteGoal: async (id: number) => {
    const response = await api.delete(`/goals/${id}`);
    return response.data;
  }
};

// Coaching API (Enhanced with Threading)
export const coachingAPI = {
  // Legacy methods for backward compatibility
  getMessages: async (advisorId: number, limit = 50, offset = 0) => {
    const response = await api.get(`/coaching/advisor/${advisorId}?limit=${limit}&offset=${offset}`);
    return response.data;
  },
  
  sendMessage: async (advisorUserId: number, message: string) => {
    const response = await api.post('/coaching', { advisorUserId, message });
    return response.data;
  },
  
  getUnreadCount: async (advisorId: number) => {
    const response = await api.get(`/coaching/advisor/${advisorId}/unread-count`);
    return response.data;
  },
  
  getSummary: async (filters: any = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value as string);
    });
    
    const response = await api.get(`/coaching/summary?${params}`);
    return response.data;
  },

  // Enhanced threading methods
  getThreads: async (limit = 20, offset = 0) => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const response = await api.get(`/coaching/threads?${params}`);
    return response.data;
  },
  
  getThreadMessages: async (threadId: number, limit = 50, offset = 0) => {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const response = await api.get(`/coaching/threads/${threadId}/messages?${params}`);
    return response.data;
  },
  
  createThread: async (advisorUserId: number, subject: string, message: string) => {
    const response = await api.post('/coaching/threads', {
      advisorUserId,
      subject,
      message
    });
    return response.data;
  },
  
  sendThreadMessage: async (threadId: number, message: string, parentMessageId?: number, attachment?: File) => {
    const formData = new FormData();
    formData.append('message', message);
    if (parentMessageId) {
      formData.append('parentMessageId', parentMessageId.toString());
    }
    if (attachment) {
      formData.append('attachment', attachment);
    }

    const response = await api.post(`/coaching/threads/${threadId}/messages`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  downloadAttachment: async (attachmentId: number) => {
    const response = await api.get(`/coaching/attachments/${attachmentId}`, {
      responseType: 'blob'
    });
    return response.data;
  },
  
  viewAttachment: async (attachmentId: number) => {
    const response = await api.get(`/coaching/attachments/${attachmentId}/view`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

// Users API
export const usersAPI = {
  getAdvisors: async () => {
    const response = await api.get('/users/advisors');
    return response.data;
  },
  
  getAdvisor: async (id: number) => {
    const response = await api.get(`/users/advisors/${id}`);
    return response.data;
  },
  
  getAllUsers: async (role?: string, status?: string) => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (status) params.append('status', status);
    
    const response = await api.get(`/users?${params}`);
    return response.data;
  }
};

// Export API
export const exportAPI = {
  getPerformanceJson: async (marketId: number, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    params.append('marketId', marketId.toString());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await api.get(`/export/performance-json?${params}`);
    return response.data;
  },
  
  getRawData: async (dataType: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    params.append('dataType', dataType);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await api.get(`/export/raw-data?${params}`);
    return response.data;
  }
};

export default api;