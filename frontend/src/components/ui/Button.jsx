import React from 'react';
import MuiButton from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';

/**
 * The app's button, drawn by MUI.
 *
 * The prop contract is unchanged on purpose - `variant`, `size`, `icon`,
 * `className`, `disabled` - because every view already calls it this way and a
 * migration that also renames props is two changes tangled into one.
 *
 * `variant` keeps the app's vocabulary rather than MUI's: primary, secondary,
 * danger and outline are what the call sites say, and they map here.
 */
const VARIANTS = {
  primary: { variant: 'contained', color: 'primary' },
  secondary: { variant: 'contained', color: 'secondary' },
  danger: { variant: 'contained', color: 'error' },
  outline: { variant: 'outlined', color: 'inherit' }
};

const SIZES = { sm: 'small', md: 'medium', lg: 'large' };
const ICON_PX = { sm: 16, md: 20, lg: 22 };

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  className = '',
  disabled = false,
  title,
  icon: Icon
}) => {
  const look = VARIANTS[variant] || VARIANTS.primary;
  const muiSize = SIZES[size] || 'medium';
  const glyph = Icon ? <Icon size={ICON_PX[size] || 20} /> : null;

  // Several call sites pass only an icon - the settings, expand and disconnect
  // controls. A Button with a startIcon and no label keeps the label's spacing
  // and renders lopsided, so an icon on its own becomes an IconButton.
  if (!children && glyph) {
    return (
      <IconButton
        onClick={onClick}
        disabled={disabled}
        size={muiSize}
        color={look.color === 'inherit' ? 'default' : look.color}
        className={className}
        title={title}
      >
        {glyph}
      </IconButton>
    );
  }

  return (
    <MuiButton
      onClick={onClick}
      disabled={disabled}
      variant={look.variant}
      color={look.color}
      size={muiSize}
      startIcon={glyph}
      className={className}
      title={title}
    >
      {children}
    </MuiButton>
  );
};

export default Button;
