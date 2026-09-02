import React from 'react';
import Paper from '@mui/material/Paper';

/**
 * A white panel. Kept at the same padding and corner radius the Tailwind
 * version had, so the migration does not silently reflow every screen - several
 * views add their own inner padding and were laid out against this one.
 *
 * `sx` is passed through for the cases a view needs one thing more, such as the
 * lift on hover the available-platform cards have.
 */
const Card = ({ children, className = '', sx }) => (
  <Paper elevation={2} className={className} sx={{ p: 2, borderRadius: 2, ...sx }}>
    {children}
  </Paper>
);

export default Card;
