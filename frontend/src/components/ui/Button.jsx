import React from 'react';

const Button = ({
                    children,
                    variant = 'primary',
                    size = 'md',
                    onClick,
                    className = '',
                    disabled = false,
                    icon: Icon
                }) => {
    const baseClasses = 'font-medium rounded-lg transition-colors flex items-center gap-2 justify-center';
    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-lg'
    };
    const variantClasses = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
            {Icon && <Icon size={size === 'sm' ? 16 : 20}/>}
            {children}
        </button>
    );
};

export default Button;