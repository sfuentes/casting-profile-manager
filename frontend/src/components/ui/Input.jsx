import React from 'react';

/**
 * `placeholder` was being passed by callers and silently dropped - ProfileView
 * asks for "z.B. 175 cm" on several fields and none of them ever showed one.
 *
 * `hint` is a small line under the field. It carries where a value came from:
 * a field imported from a casting platform is not the same as one the actor
 * typed, and the difference is worth seeing without having to remember it.
 */
const Input = ({
    label, value, onChange, type = 'text', disabled = false, className = '',
    placeholder, hint
}) => (
    <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        {hint && <span className="block mt-1 text-[10px] text-gray-400">{hint}</span>}
    </div>
);

export default Input;
