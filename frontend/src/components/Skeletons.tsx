import React from 'react';
import { Box, Card, CardContent, Grid, Skeleton, Paper } from '@mui/material';

export const DashboardSkeleton: React.FC = () => (
  <Box sx={{ p: 3 }}>
    <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
    <Grid container spacing={3} sx={{ mb: 4 }}>
      {[1, 2, 3, 4].map((i) => (
        <Grid item xs={12} sm={6} md={3} key={i}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="40%" height={32} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 3 }}>
          <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <Card variant="outlined" sx={{ mb: 2 }} key={i}>
              <CardContent>
                <Skeleton variant="text" width="70%" />
                <Skeleton variant="text" width="40%" />
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Skeleton variant="rounded" width={80} height={24} />
                  <Skeleton variant="rounded" width={60} height={24} />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Skeleton variant="text" width={120} height={32} sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={6}><Skeleton variant="text" width="100%" height={60} /></Grid>
            <Grid item xs={6}><Skeleton variant="text" width="100%" height={60} /></Grid>
          </Grid>
        </Paper>
        <Paper sx={{ p: 3 }}>
          <Skeleton variant="text" width={140} height={32} sx={{ mb: 2 }} />
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Skeleton variant="circular" width={24} height={24} sx={{ mr: 2 }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="40%" />
              </Box>
            </Box>
          ))}
        </Paper>
      </Grid>
    </Grid>
  </Box>
);

export const DocumentListSkeleton: React.FC = () => (
  <Box sx={{ p: 3 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
      <Skeleton variant="text" width={200} height={40} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Skeleton variant="rounded" width={100} height={36} />
        <Skeleton variant="rounded" width={150} height={36} />
      </Box>
    </Box>
    <Paper sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Skeleton variant="rounded" height={40} /></Grid>
        <Grid item xs={6} md={2}><Skeleton variant="rounded" height={40} /></Grid>
        <Grid item xs={6} md={2}><Skeleton variant="rounded" height={40} /></Grid>
      </Grid>
    </Paper>
    <Grid container spacing={3}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Grid item xs={12} sm={6} md={4} key={i}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="80%" height={28} />
              <Skeleton variant="text" width="60%" />
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Skeleton variant="rounded" width={70} height={24} />
                <Skeleton variant="rounded" width={50} height={24} />
              </Box>
              <Skeleton variant="text" width="50%" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  </Box>
);

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: '1px solid #eee' }}>
    {Array.from({ length: columns }).map((_, i) => (
      <Box key={i} sx={{ flex: 1, px: 1 }}>
        <Skeleton variant="text" width={`${60 + Math.random() * 30}%`} />
      </Box>
    ))}
  </Box>
);

export const ProfileSkeleton: React.FC = () => (
  <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
    <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Skeleton variant="circular" width={80} height={80} sx={{ mr: 3 }} />
        <Box>
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="text" width={150} />
        </Box>
      </Box>
      {[1, 2, 3, 4].map((i) => (
        <Box key={i} sx={{ mb: 2 }}>
          <Skeleton variant="text" width={100} />
          <Skeleton variant="rounded" height={40} />
        </Box>
      ))}
    </Paper>
  </Box>
);
