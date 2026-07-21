import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string, mfaCode?: string) =>
    apiClient.post('/auth/login', { email, password, ...(mfaCode && { mfaCode }) }),
  register: (userData: any) =>
    apiClient.post('/auth/register', userData),
  getProfile: () =>
    apiClient.get('/auth/me'),
  updateProfile: (data: { firstName?: string; lastName?: string; email?: string }) =>
    apiClient.put('/auth/profile', data),
  logout: () =>
    apiClient.post('/auth/logout'),
  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { token, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
  verifyEmail: (token: string) =>
    apiClient.get(`/auth/verify-email/${token}`),
  resendVerification: () =>
    apiClient.post('/auth/resend-verification'),
  enrollMfa: () => apiClient.post('/auth/mfa/enroll'),
  confirmMfa: (code: string) => apiClient.post('/auth/mfa/confirm', { code }),
  stepUpMfa: (code: string) => apiClient.post('/auth/mfa/step-up', { code }),
  disableMfa: (password: string, code: string) => apiClient.post('/auth/mfa/disable', { password, code }),
};

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
}

export const documentAPI = {
  getDocuments: (params?: PaginationParams) =>
    apiClient.get('/documents', { params }),
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
  reviewDocument: (documentId: string, data: { decision: 'APPROVED' | 'REJECTED'; jurisdiction: string; effectiveDate: string; rationale: string }) =>
    apiClient.post(`/documents/${documentId}/legal-review`, data),
  signDocument: (documentId: string, signatureData: string, consent: { agreed: boolean; text: string; timestamp: string }) =>
    apiClient.post(`/documents/${documentId}/sign`, { signatureData, consent }),
  downloadDocument: (documentId: string) =>
    apiClient.get(`/documents/${documentId}/download`),
  deleteDocument: (documentId: string) =>
    apiClient.delete(`/documents/${documentId}`),
  bulkDelete: (ids: string[]) =>
    apiClient.post('/documents/bulk/delete', { ids }),
  bulkUpdate: (ids: string[], updates: any) =>
    apiClient.post('/documents/bulk/update', { ids, updates }),
  exportCSV: (params?: { status?: string }) =>
    apiClient.get('/documents/export/csv', { params, responseType: 'blob' }),
  exportPDF: (params?: { status?: string }) =>
    apiClient.get('/documents/export/pdf', { params }),
};

export const templateAPI = {
  getTemplates: (params?: PaginationParams) =>
    apiClient.get('/templates', { params }),
  createTemplate: (templateData: any) =>
    apiClient.post('/templates', templateData),
  updateTemplate: (id: string, templateData: any) =>
    apiClient.put(`/templates/${id}`, templateData),
  deleteTemplate: (id: string) =>
    apiClient.delete(`/templates/${id}`),
  exportCSV: () =>
    apiClient.get('/templates/export/csv', { responseType: 'blob' }),
};

export const matterAPI = {
  list: () => apiClient.get('/matters'),
  invite: (matterId: string, email: string, role: string) => apiClient.post(`/matters/${matterId}/invitations`, { email, role }),
  addMember: (matterId: string, userId: string, role: string) => apiClient.post(`/matters/${matterId}/members`, { userId, role }),
  revokeMember: (matterId: string, userId: string) => apiClient.delete(`/matters/${matterId}/members/${userId}`),
};

export const userAPI = {
  getUsers: (params?: PaginationParams) =>
    apiClient.get('/users', { params }),
  getUser: (id: string) =>
    apiClient.get(`/users/${id}`),
  exportCSV: () =>
    apiClient.get('/users/export/csv', { responseType: 'blob' }),
};

export const aiAPI = {
  analyzeDocument: (documentId: string) =>
    apiClient.post(`/ai/analyze/${documentId}`),
  generateContract: (prompt: string, contractType: string) =>
    apiClient.post('/ai/generate-contract', { prompt, contractType }),
  detectFields: (documentId: string) =>
    apiClient.post(`/ai/detect-fields/${documentId}`),
  generateOverlay: (documentId: string, pageNumber: number, pdfImageBase64: string) =>
    apiClient.post(`/ai/generate-overlay/${documentId}/${pageNumber}`, {
      pdfImageBase64
    }),
  compareVersions: (documentId: string, fromVersion: number, toVersion: number) =>
    apiClient.post('/ai/compare-versions', { documentId, fromVersion, toVersion }),
  suggestTemplate: (description: string) =>
    apiClient.post('/ai/suggest-template', { description }),
};

export default apiClient;
