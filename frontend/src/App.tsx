import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentEditor from './pages/DocumentEditor';
import SignDocument from './pages/SignDocument';
import Templates from './pages/Templates';
import AIAssistant from './pages/AIAssistant';
import AITools from './pages/AITools';
import Profile from './pages/Profile';
import CustomViewsPage from './pages/CustomViewsPage';
import WitnessRouting from './pages/WitnessRouting';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import './index.css';

import CodexCustomVizFeature from './pages/CodexCustomVizFeature';
import CodexOperationsFeature from './pages/CodexOperationsFeature';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
        <Route path="/codex/custom-viz" element={<ProtectedRoute><CodexCustomVizFeature /></ProtectedRoute>} />
        <Route path="/codex/operations" element={<ProtectedRoute><CodexOperationsFeature /></ProtectedRoute>} />

      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/sign/:documentId" element={<SignDocument />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="documents" element={<ErrorBoundary><Documents /></ErrorBoundary>} />
        <Route path="documents/new/edit" element={<ErrorBoundary><DocumentEditor /></ErrorBoundary>} />
        <Route path="documents/:id/edit" element={<ErrorBoundary><DocumentEditor /></ErrorBoundary>} />
        <Route path="templates" element={<ErrorBoundary><Templates /></ErrorBoundary>} />
        <Route path="ai-assistant" element={<ErrorBoundary><AIAssistant /></ErrorBoundary>} />
        <Route path="ai-tools" element={<ErrorBoundary><AITools /></ErrorBoundary>} />
        <Route path="profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
        <Route path="custom-views" element={<ErrorBoundary><CustomViewsPage /></ErrorBoundary>} />
        <Route path="witness-routing" element={<ErrorBoundary><WitnessRouting /></ErrorBoundary>} />
      </Route>
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ToastProvider>
            <ErrorBoundary>
              <Router>
                <AppRoutes />
              </Router>
            </ErrorBoundary>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
