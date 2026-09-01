import React from 'react';
import TextField from '@mui/material/TextField';

/**
 * A labelled text field.
 *
 * `placeholder` was being passed by ProfileView and silently dropped by the old
 * component, so none of its "z.B. 175 cm" hints ever appeared. `hint` is the
 * line underneath that says where an imported value came from.
 *
 * Date and time fields get a shrunk label: MUI floats the label over the input
 * until it has a value, and a native date control always shows its placeholder
 * text, so the two would sit on top of each other.
 */
const ALWAYS_FILLED = ['date', 'time', 'datetime-local', 'month', 'week'];

const Input = ({
  label, value, onChange, type = 'text', disabled = false, className = '',
  placeholder, hint
}) => (
  <TextField
    label={label}
    value={value ?? ''}
    onChange={onChange}
    type={type}
    disabled={disabled}
    placeholder={placeholder}
    helperText={hint || undefined}
    className={className}
    fullWidth
    size="small"
    slotProps={{
      inputLabel: ALWAYS_FILLED.includes(type) ? { shrink: true } : undefined
    }}
  />
);

export default Input;
