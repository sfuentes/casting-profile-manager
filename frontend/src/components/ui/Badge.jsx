import React from 'react';
import Chip from '@mui/material/Chip';

/**
 * A small status pill.
 *
 * The colours are the app's own words - the call sites compute them, e.g.
 * `color={testResult.success ? 'green' : 'red'}` - so they are mapped here
 * rather than changed at forty call sites.
 *
 * `icon`, `size` and `variant` were being passed by several views and silently
 * dropped by the old component, which is the same family of bug as the `title`
 * that never reached a failed connection test. They work now.
 */
const COLORS = {
  blue: 'primary',
  green: 'success',
  yellow: 'warning',
  red: 'error',
  purple: 'secondary',
  gray: 'default'
};

const Badge = ({ children, color = 'blue', title, icon: Icon, size = 'sm', variant }) => (
  <Chip
    label={children}
    title={title}
    size={size === 'sm' ? 'small' : 'medium'}
    color={COLORS[color] || 'default'}
    variant={variant === 'outline' ? 'outlined' : 'filled'}
    icon={Icon ? <Icon size={14} /> : undefined}
    sx={{ fontWeight: 500 }}
  />
);

export default Badge;
