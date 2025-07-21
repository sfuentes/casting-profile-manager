// API Configuration
const API_BASE_URL = 'https://api.darsteller-manager.de/v1';
const API_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer demo-token' // In production, this would come from auth context
};

// API Service with Demo Mode
export const apiService = {
    // Demo mode flag - set to true to use local data instead of API calls
    // In production, set this to false and configure your API endpoint
    demoMode: true,

    // Profile endpoints
    getProfile: async () => {
        if (apiService.demoMode) {
            return Promise.resolve(null); // Will use initialProfile as fallback
        }
        const response = await fetch(`${API_BASE_URL}/profile`, {headers: API_HEADERS});
        if (!response.ok) throw new Error('Failed to fetch profile');
        return response.json();
    },

    updateProfile: async (profileData) => {
        if (apiService.demoMode) {
            return Promise.resolve(profileData);
        }
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: API_HEADERS,
            body: JSON.stringify(profileData)
        });
        if (!response.ok) throw new Error('Failed to update profile');
        return response.json();
    },

    // Work history endpoints (NEW)
    addWorkHistory: async (workItem) => {
        if (apiService.demoMode) {
            return Promise.resolve({...workItem, id: Date.now()});
        }
        const response = await fetch(`${API_BASE_URL}/profile/work-history`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify(workItem)
        });
        if (!response.ok) throw new Error('Failed to add work history');
        return response.json();
    },

    updateWorkHistory: async (id, workItem) => {
        if (apiService.demoMode) {
            return Promise.resolve({...workItem, id});
        }
        const response = await fetch(`${API_BASE_URL}/profile/work-history/${id}`, {
            method: 'PUT',
            headers: API_HEADERS,
            body: JSON.stringify(workItem)
        });
        if (!response.ok) throw new Error('Failed to update work history');
        return response.json();
    },

    deleteWorkHistory: async (id) => {
        if (apiService.demoMode) {
            return Promise.resolve({success: true});
        }
        const response = await fetch(`${API_BASE_URL}/profile/work-history/${id}`, {
            method: 'DELETE',
            headers: API_HEADERS
        });
        if (!response.ok) throw new Error('Failed to delete work history');
        return response.json();
    },

    // Education endpoints (NEW)
    addEducation: async (educationItem) => {
        if (apiService.demoMode) {
            return Promise.resolve({...educationItem, id: Date.now()});
        }
        const response = await fetch(`${API_BASE_URL}/profile/education`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify(educationItem)
        });
        if (!response.ok) throw new Error('Failed to add education');
        return response.json();
    },

    updateEducation: async (id, educationItem) => {
        if (apiService.demoMode) {
            return Promise.resolve({...educationItem, id});
        }
        const response = await fetch(`${API_BASE_URL}/profile/education/${id}`, {
            method: 'PUT',
            headers: API_HEADERS,
            body: JSON.stringify(educationItem)
        });
        if (!response.ok) throw new Error('Failed to update education');
        return response.json();
    },

    deleteEducation: async (id) => {
        if (apiService.demoMode) {
            return Promise.resolve({success: true});
        }
        const response = await fetch(`${API_BASE_URL}/profile/education/${id}`, {
            method: 'DELETE',
            headers: API_HEADERS
        });
        if (!response.ok) throw new Error('Failed to delete education');
        return response.json();
    },

    // ... existing booking/option/availability endpoints remain the same ...

    // Upload endpoints (enhanced)
    uploadProfilePhoto: async (file) => {
        if (apiService.demoMode) {
            return Promise.resolve({url: URL.createObjectURL(file)});
        }
        const formData = new FormData();
        formData.append('photo', file);

        const response = await fetch(`${API_BASE_URL}/upload/profile-photo`, {
            method: 'POST',
            headers: {'Authorization': API_HEADERS.Authorization},
            body: formData
        });
        if (!response.ok) throw new Error('Failed to upload photo');
        return response.json();
    },

    uploadSetcardPhoto: async (photoId, file) => {
        if (apiService.demoMode) {
            return Promise.resolve({url: URL.createObjectURL(file), photoId});
        }
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('photoId', photoId);

        const response = await fetch(`${API_BASE_URL}/upload/setcard-photo`, {
            method: 'POST',
            headers: {'Authorization': API_HEADERS.Authorization},
            body: formData
        });
        if (!response.ok) throw new Error('Failed to upload setcard photo');
        return response.json();
    },

    deleteSetcardPhoto: async (photoId) => {
        if (apiService.demoMode) {
            return Promise.resolve({success: true});
        }
        const response = await fetch(`${API_BASE_URL}/upload/setcard-photo/${photoId}`, {
            method: 'DELETE',
            headers: API_HEADERS
        });
        if (!response.ok) throw new Error('Failed to delete setcard photo');
        return response.json();
    },

    // Profile sync to platforms (NEW)
    syncProfileToPlatforms: async (platformIds = []) => {
        if (apiService.demoMode) {
            // Simulate profile sync
            const {initialPlatforms} = await import('../data/initialData');
            const platforms = initialPlatforms.map(p => ({
                ...p,
                lastSync: p.connected ? new Date().toISOString() : p.lastSync
            }));
            return Promise.resolve({platforms, synced: platforms.filter(p => p.connected).length});
        }

        const response = await fetch(`${API_BASE_URL}/sync/profile`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({platformIds})
        });
        if (!response.ok) throw new Error('Failed to sync profile');
        return response.json();
    },

    // ... rest of existing endpoints remain the same
};