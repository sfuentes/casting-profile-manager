import React from 'react';
import MuiCircularProgress from '@mui/material/CircularProgress';

/**
 * A spinner. `color` stayed a plain CSS colour here rather than becoming a
 * palette name: the old component took one and callers may pass anything.
 */
const CircularProgress = ({ size = 20, color = 'currentColor' }) => (
  <MuiCircularProgress size={size} sx={{ color }} />
);

export default CircularProgress;
