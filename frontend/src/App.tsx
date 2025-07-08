import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Typography, Button } from '@mui/material';

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

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          p: 3,
        }}
      >
        <Typography variant="h2" component="h1" gutterBottom>
          DocuSign AI Clone
        </Typography>
        <Typography variant="h5" component="h2" gutterBottom color="text.secondary">
          AI-powered electronic signature platform
        </Typography>
        <Button variant="contained" size="large" sx={{ mt: 3 }}>
          Get Started
        </Button>
      </Box>
    </ThemeProvider>
  );
};

export default App;
