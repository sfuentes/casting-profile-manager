import React from 'react';
import TextField from '@mui/material/TextField';

/** A time field. Same shape as Input, fixed to type="time". */
const TimeInput = ({ label, value, onChange, disabled = false, className = '' }) => (
  <TextField
    label={label}
    type="time"
    value={value || ''}
    onChange={onChange}
    disabled={disabled}
    className={className}
    fullWidth
    size="small"
    slotProps={{ inputLabel: { shrink: true } }}
  />
);

export default TimeInput;
