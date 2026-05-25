import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Paper, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';

const DEFAULT_EMAIL = 'admin@docusign.com';
const DEFAULT_PASSWORD = 'password123';

const BridgeLogin: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const bridge = async () => {
      const redirect = searchParams.get('redirect') || '/dashboard';
      const existingToken = localStorage.getItem('token');

      if (existingToken) {
        authAPI.setToken(existingToken);
        window.location.replace(redirect);
        return;
      }

      try {
        const response = await authAPI.login(DEFAULT_EMAIL, DEFAULT_PASSWORD);

        if (cancelled) return;

        const { user, token } = response.data;
        localStorage.setItem('token', token);
        authAPI.setToken(token);
        localStorage.setItem('docusignUser', JSON.stringify(user));
        window.location.replace(redirect);
      } catch (err: any) {
        if (cancelled) return;
        setError(err.response?.data?.error || 'DocuSign bridge login failed');
      }
    };

    bridge();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <Paper elevation={3} sx={{ p: 5, width: '100%' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Connecting DocuSign
          </Typography>
          <Typography color="text.secondary" align="center">
            Loading the preserved DocuSign workspace inside the unified application.
          </Typography>
          {error ? <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert> : null}
        </Box>
      </Paper>
    </Container>
  );
};

export default BridgeLogin;
