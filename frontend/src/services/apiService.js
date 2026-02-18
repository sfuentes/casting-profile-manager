import platformAgent from './platformAgent';

// API Configuration — set VITE_API_URL at build time for production deployments
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

const handleResponse = async (response) => {
    const data = await response.json();
    if (!response.ok) {
        const errorMsg = data.error?.message || data.message || 'API request failed';
        throw new Error(errorMsg);
    }
    return data.data !== undefined ? data.data : data;
};

// Platform capabilities mapping based on existing platforms.js structure
const platformCapabilities = {
    1: { // Filmmakers
        hasAPI: false,
        agentCapable: true,
        connectionType: 'agent',
        features: ['profile', 'photos', 'networking'],
        regions: ['EU', 'Global']
    },
    2: { // Casting Network
        hasAPI: false,
        agentCapable: true,
        connectionType: 'agent',
        features: ['profile', 'photos', 'submissions', 'availability'],
        regions: ['US', 'CA', 'UK']
    },
    3: { // Schauspielervideos
        hasAPI: true,
        agentCapable: true,
        connectionType: 'api',
        features: ['profile', 'videos', 'photos', 'showreel'],
        regions: ['DE', 'AT', 'CH']
    },
    4: { // e-TALENTA
        hasAPI: true,
        agentCapable: true,
        connectionType: 'api',
        features: ['profile', 'photos', 'availability', 'castings'],
        regions: ['EU', 'DE', 'AT', 'CH']
    },
    5: { // JobWork
        hasAPI: false,
        agentCapable: true,
        connectionType: 'agent',
        features: ['profile', 'jobs', 'networking'],
        regions: ['DE', 'AT', 'CH']
    },
    6: { // Agentur Iris Müller
        hasAPI: false,
        agentCapable: false,
        connectionType: 'manual',
        features: ['profile', 'representation'],
        regions: ['DE']
    },
    7: { // Agentur Connection
        hasAPI: true,
        agentCapable: false,
        connectionType: 'api',
        features: ['profile', 'representation', 'bookings'],
        regions: ['DE', 'AT']
    },
    8: { // Agentur Sarah Weiss
        hasAPI: false,
        agentCapable: false,
        connectionType: 'manual',
        features: ['profile', 'representation'],
        regions: ['DE']
    },
    9: { // Wanted
        hasAPI: false,
        agentCapable: true,
        connectionType: 'agent',
        features: ['profile', 'jobs', 'availability'],
        regions: ['DE', 'AT', 'CH']
    }
};

// API Service with improved error handling
export const apiService = {
    // Auth endpoints
    login: async (email, password) => {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            const errorMsg = data.error?.message || data.message || 'Login failed';
            throw new Error(errorMsg);
        }
        if (data.token) {
            localStorage.setItem('token', data.token);
        }
        return data;
    },

    register: async (userData) => {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (!response.ok) {
            const errorMsg = data.error?.message || data.message || 'Registration failed';
            throw new Error(errorMsg);
        }
        return data;
    },

    logout: async () => {
        localStorage.removeItem('token');
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: getHeaders()
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
        return { success: true };
    },

    getMe: async () => {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: getHeaders()
        });
        const data = await response.json();
        if (!response.ok) {
            const errorMsg = data.error?.message || data.message || 'Failed to fetch user';
            throw new Error(errorMsg);
        }
        return data.data;
    },

    // Profile management endpoints
    getProfile: async () => {
        const response = await fetch(`${API_BASE_URL}/profile`, {headers: getHeaders()});
        const data = await response.json();
        if (!response.ok) {
            const errorMsg = data.error?.message || data.message || 'Failed to fetch profile';
            throw new Error(errorMsg);
        }
        return data.data;
    },

    updateProfile: async (profileData) => {
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(profileData)
        });
        return handleResponse(response);
    },

    addWorkHistory: async (workItem) => {
        const response = await fetch(`${API_BASE_URL}/profile/work-history`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(workItem)
        });
        return handleResponse(response);
    },

    updateWorkHistory: async (id, updates) => {
        const response = await fetch(`${API_BASE_URL}/profile/work-history/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(response);
    },

    deleteWorkHistory: async (id) => {
        const response = await fetch(`${API_BASE_URL}/profile/work-history/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    addEducation: async (educationItem) => {
        const response = await fetch(`${API_BASE_URL}/profile/education`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(educationItem)
        });
        return handleResponse(response);
    },

    updateEducation: async (id, updates) => {
        const response = await fetch(`${API_BASE_URL}/profile/education/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(response);
    },

    deleteEducation: async (id) => {
        const response = await fetch(`${API_BASE_URL}/profile/education/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    uploadProfilePhoto: async (file) => {
        const formData = new FormData();
        formData.append('photo', file);

        const response = await fetch(`${API_BASE_URL}/upload/profile-photo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        return handleResponse(response);
    },

    uploadSetcardPhoto: async (photoId, file) => {
        const formData = new FormData();
        formData.append('photo', file);

        const response = await fetch(`${API_BASE_URL}/upload/setcard-photo/${photoId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        return handleResponse(response);
    },

    deleteSetcardPhoto: async (photoId) => {
        const response = await fetch(`${API_BASE_URL}/upload/setcard-photo/${photoId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    syncProfileToPlatforms: async () => {
        const response = await fetch(`${API_BASE_URL}/profile/sync`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    // Booking management endpoints
    getBookings: async () => {
        const response = await fetch(`${API_BASE_URL}/bookings`, {headers: getHeaders()});
        return handleResponse(response);
    },
    getOptions: async () => {
        const response = await fetch(`${API_BASE_URL}/options`, {headers: getHeaders()});
        return handleResponse(response);
    },

    addOption: async (optionData) => {
        const response = await fetch(`${API_BASE_URL}/options`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(optionData)
        });
        return handleResponse(response);
    },

    updateOption: async (optionId, updates) => {
        const response = await fetch(`${API_BASE_URL}/options/${optionId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(response);
    },

    deleteOption: async (optionId) => {
        const response = await fetch(`${API_BASE_URL}/options/${optionId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

// Also add booking methods if they're not already implemented
    addBooking: async (bookingData) => {
        const response = await fetch(`${API_BASE_URL}/bookings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(bookingData)
        });
        return handleResponse(response);
    },

    updateBooking: async (bookingId, updates) => {
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(response);
    },

    deleteBooking: async (bookingId) => {
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

// Add availability methods
    addAvailability: async (availabilityData) => {
        const response = await fetch(`${API_BASE_URL}/availability`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(availabilityData)
        });
        return handleResponse(response);
    },

    updateAvailabilityItem: async (availabilityId, updates) => {
        const response = await fetch(`${API_BASE_URL}/availability/${availabilityId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(response);
    },

    deleteAvailability: async (availabilityId) => {
        const response = await fetch(`${API_BASE_URL}/availability/${availabilityId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

// Sync availability to platforms
    syncAvailabilityToPlatforms: async () => {
        const response = await fetch(`${API_BASE_URL}/availability/sync`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    // Availability management endpoints
    getAvailability: async () => {
        const response = await fetch(`${API_BASE_URL}/availability`, {headers: getHeaders()});
        return handleResponse(response);
    },

    updateAvailability: async (availability) => {
        const response = await fetch(`${API_BASE_URL}/availability`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(availability)
        });
        if (!response.ok) throw new Error('Failed to update availability');
        return response.json();
    },

    // Enhanced platform management with proper error handling
    getPlatforms: async () => {
        const response = await fetch(`${API_BASE_URL}/platforms`, {headers: getHeaders()});
        return handleResponse(response);
    },

    getPlatformDescription: (id, name) => {
        const descriptions = {
            1: 'European film industry network - agent-based profile sync',
            2: 'Global casting platform - automated profile management',
            3: 'German actor video database - API integration available',
            4: 'European casting network - full API access',
            5: 'German job platform - OAuth integration',
            6: 'Traditional talent agency - manual coordination required',
            7: 'Professional talent agency - API integration',
            8: 'Boutique talent agency - personal management',
            9: 'Entertainment job portal - automated sync available'
        };
        return descriptions[id] || `${name} platform integration`;
    },

    connectPlatform: async (platformId, authData) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/connect`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(authData)
        });
        return handleResponse(response);
    },

    disconnectPlatform: async (platformId) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/disconnect`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    updatePlatformSettings: async (platformId, settings) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/settings`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(settings)
        });
        return handleResponse(response);
    },

    testPlatformConnection: async (platformId, credentials) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/test`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(credentials)
        });
        return handleResponse(response);
    },

    syncToPlatform: async (platformId, dataTypes = ['profile', 'availability'], credentials) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/sync`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({dataTypes, credentials})
        });
        return handleResponse(response);
    },

    bulkSyncToPlatforms: async (platformIds, dataTypes = ['profile', 'availability'], credentialsMap) => {
        const response = await fetch(`${API_BASE_URL}/platforms/bulk-sync`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({platformIds, dataTypes, credentialsMap})
        });
        return handleResponse(response);
    },

    readProfileFromPlatform: async (platformId, credentials) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/profile`, {
            method: 'GET',
            headers: {...getHeaders(), 'X-Platform-Credentials': btoa(JSON.stringify(credentials))}
        });
        return handleResponse(response);
    },

    checkAgentHealth: async () => {
        const response = await fetch(`${API_BASE_URL}/agent/health`, {headers: getHeaders()});
        return handleResponse(response);
    },

    // OAuth flow endpoints
    initiateOAuth: async (platformId) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/oauth/initiate`, {
            headers: getHeaders()
        });
        const data = await handleResponse(response);
        return {
            authUrl: data.redirectUrl,
            ...data
        };
    },

    completeOAuth: async (platformId, authCode, state) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/oauth/callback?code=${authCode}&state=${state}`, {
            headers: getHeaders()
        });
        return handleResponse(response);
    }
};

export default apiService;
