import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  setToken: (token: string) => {
    if (token) {
      apiClient.defaults.headers.Authorization = `Bearer ${token}`;
    } else {
      delete apiClient.defaults.headers.Authorization;
    }
  },
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  register: (userData: any) =>
    apiClient.post('/auth/register', userData),
  getProfile: () =>
    apiClient.get('/auth/me'),
};

export const documentAPI = {
  getDocuments: () =>
    apiClient.get('/documents'),
  getDocument: (id: string) =>
    apiClient.get(`/documents/${id}`),
  uploadDocument: (formData: FormData) =>
    apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  addFields: (documentId: string, fields: any[]) =>
    apiClient.post(`/documents/${documentId}/fields`, { fields }),
  sendDocument: (documentId: string, signers: any[]) =>
    apiClient.post(`/documents/${documentId}/send`, { signers }),
  signDocument: (documentId: string, signatureData: string) =>
    apiClient.post(`/documents/${documentId}/sign`, { signatureData }),
};

export const templateAPI = {
  getTemplates: () =>
    apiClient.get('/templates'),
  createTemplate: (templateData: any) =>
    apiClient.post('/templates', templateData),
  updateTemplate: (id: string, templateData: any) =>
    apiClient.put(`/templates/${id}`, templateData),
  deleteTemplate: (id: string) =>
    apiClient.delete(`/templates/${id}`),
};

export const aiAPI = {
  analyzeDocument: (documentId: string) =>
    apiClient.post(`/ai/analyze/${documentId}`),
  generateContract: (prompt: string, contractType: string) =>
    apiClient.post('/ai/generate-contract', { prompt, contractType }),
  detectFields: (documentId: string) =>
    apiClient.post(`/ai/detect-fields/${documentId}`),
};

export default apiClient;
