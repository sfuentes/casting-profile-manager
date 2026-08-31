import React from 'react';

// `title` is forwarded so a badge can carry the reason behind it - a failed
// connection test says why on hover instead of only that it failed.
const Badge = ({children, color = 'blue', title}) => {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-800',
        green: 'bg-green-100 text-green-800',
        yellow: 'bg-yellow-100 text-yellow-800',
        red: 'bg-red-100 text-red-800',
        gray: 'bg-gray-100 text-gray-800'
    };

    return (
        <span title={title} className={`px-2 py-1 text-xs font-medium rounded-full ${colorClasses[color]}`}>
            {children}
        </span>
    );
};

export default Badge;