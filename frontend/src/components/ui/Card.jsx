import React from 'react';
import Paper from '@mui/material/Paper';

/**
 * A white panel. Kept at the same padding and corner radius the Tailwind
 * version had, so the migration does not silently reflow every screen - several
 * views add their own inner padding and were laid out against this one.
 */
const Card = ({ children, className = '' }) => (
  <Paper elevation={2} className={className} sx={{ p: 2, borderRadius: 2 }}>
    {children}
  </Paper>
);

export default Card;
