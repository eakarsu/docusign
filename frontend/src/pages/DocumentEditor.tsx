import React from 'react';
import { Typography, Box } from '@mui/material';

const DocumentEditor: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Document Editor
      </Typography>
      <Typography>
        Document editing interface with drag-and-drop field placement will be implemented here.
      </Typography>
    </Box>
  );
};

export default DocumentEditor;
