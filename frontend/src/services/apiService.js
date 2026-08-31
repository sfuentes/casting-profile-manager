
// API Configuration
// Use VITE_API_URL env var for production (set in Railway dashboard).
// Falls back to localhost for local development.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

/**
 * Unwraps the API's { success, data } envelope by default.
 *
 * Pass unwrap: false for endpoints whose payload lives on the envelope itself -
 * /agent/health carries status, message and timestamp next to `data`, and
 * unwrapping threw all three away: the UI read `undefined` and rendered a
 * permanent red "Agent: Unbekannt" with "Letzte Prüfung: Invalid Date" while
 * the backend was reporting healthy.
 */
const handleResponse = async (response, {unwrap = true} = {}) => {
    const data = await response.json();
    if (!response.ok) {
        const errorMsg = data.error?.message || data.message || 'API request failed';
        throw new Error(errorMsg);
    }
    if (!unwrap) return data;
    return data.data !== undefined ? data.data : data;
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
            3: 'German actor video database - API key required',
            4: 'European casting network - browser-based sync',
            5: 'German job platform - browser-based sync',
            6: 'Traditional talent agency - manual coordination required',
            7: 'Professional talent agency - manual coordination required',
            8: 'Boutique talent agency - personal management',
            9: 'Entertainment job portal - automated sync available'
        };
        return descriptions[id] || `${name} platform integration`;
    },

    // What integrations exist and how each connects. Replaces the hard-coded
    // list the client used to ship, which disagreed with the backend.
    getPlatformCatalog: async () => {
        const response = await fetch(`${API_BASE_URL}/platforms/catalog`, {headers: getHeaders()});
        return handleResponse(response);
    },

    connectPlatform: async (platformId, authData) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/connect`, {
            method: 'POST',
            headers: getHeaders(),
            // The credentials go under `authData`, which is where the controller
            // reads them (`const { authData } = req.body`). Posting the bare
            // credential object put email and password at the top level, so the
            // backend saw no credentials at all and rejected every connect with
            // "Missing credentials" - before it ever opened a browser. Connecting
            // a platform through the UI could not work.
            body: JSON.stringify({authData})
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

    /**
     * Test a platform's stored credentials with a real login attempt.
     *
     * Read the unwrapping carefully before changing this. The endpoint answers
     * `{ success, verified, message, data: { platform, testResult } }` - and
     * `handleResponse` returns `data` when there is one, which dropped exactly
     * the three fields every caller reads. `result.success` was always
     * undefined, so a login that actually succeeded was shown to the user as
     * "Test fehlgeschlagen", and `result.lastTested` was undefined, so the
     * panel said "Letzter Test: Nie" straight after a test. The envelope is
     * kept here and flattened into what the callers ask for.
     *
     * Nothing is sent in the body. The server tests the credentials it has
     * stored; the browser is never given them, so it has nothing to send back.
     */
    testPlatformConnection: async (platformId) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/test`, {
            method: 'POST',
            headers: getHeaders()
        });
        const body = await handleResponse(response, {unwrap: false});
        return {
            success: body.success === true,
            verified: body.verified === true,
            message: body.message,
            lastTested: body.data?.testResult?.timestamp || body.data?.platform?.lastTested || null,
            platform: body.data?.platform
        };
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

    /**
     * Read the profile from a platform. The server logs in with the credentials
     * it already holds - the browser has none to send: the API strips secrets
     * from every platform response, so the old X-Platform-Credentials header
     * could only ever have carried `undefined`.
     */
    readProfileFromPlatform: async (platformId) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/profile`, {
            method: 'GET',
            headers: getHeaders()
        });
        return handleResponse(response);
    },

    /** Write the fields the user picked from an earlier import into the profile. */
    applyImportedProfile: async (platformId, syncLogId, keys, resolutions = {}) => {
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/profile/apply`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({syncLogId, keys, resolutions})
        });
        return handleResponse(response);
    },

    /**
     * Add the credits a platform is missing.
     *
     * The envelope is kept: `questions` sits beside `data`, and the default
     * unwrapping would drop it - which is exactly how the connection test came
     * to report successful logins as failures. `resolutions` carries the user's
     * answers to questions from an earlier call, keyed by the question's path.
     */
    syncWorkHistory: async (platformId, resolutions = {}) => {
        const response = await fetch(`${API_BASE_URL}/sync/work-history/${platformId}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({resolutions})
        });
        const body = await handleResponse(response, {unwrap: false});
        return {
            success: body.success === true,
            message: body.message,
            questions: body.questions || [],
            added: body.data?.itemsProcessed ?? 0
        };
    },

    checkAgentHealth: async () => {
        const response = await fetch(`${API_BASE_URL}/agent/health`, {headers: getHeaders()});
        // Keep the envelope: status, message and timestamp are on it.
        return handleResponse(response, {unwrap: false});
    }
};

export default apiService;
