import platformAgent from './platformAgent';

// API Configuration
const API_BASE_URL = 'https://api.darsteller-manager.de/v1';
const API_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer demo-token'
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
    demoMode: true,

    // Profile management endpoints
    getProfile: async () => {
        if (apiService.demoMode) {
            try {
                const {initialProfile} = await import('../data/initialData');
                return Promise.resolve(initialProfile);
            } catch (error) {
                console.error('Failed to load initial profile:', error);
                return Promise.resolve({
                    name: 'Demo User',
                    biography: 'Demo biography',
                    height: '175 cm',
                    eyeColor: 'Brown'
                });
            }
        }
        const response = await fetch(`${API_BASE_URL}/profile`, {headers: API_HEADERS});
        if (!response.ok) throw new Error('Failed to fetch profile');
        return response.json();
    },

    updateProfile: async (profileData) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return Promise.resolve({success: true, profile: profileData});
        }
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: API_HEADERS,
            body: JSON.stringify(profileData)
        });
        if (!response.ok) throw new Error('Failed to update profile');
        return response.json();
    },

    // Booking management endpoints
    getBookings: async () => {
        if (apiService.demoMode) {
            try {
                const {initialBookings} = await import('../data/initialData');
                return Promise.resolve(initialBookings);
            } catch (error) {
                console.error('Failed to load initial bookings:', error);
                return Promise.resolve([]);
            }
        }
        const response = await fetch(`${API_BASE_URL}/bookings`, {headers: API_HEADERS});
        if (!response.ok) throw new Error('Failed to fetch bookings');
        return response.json();
    },
    getOptions: async () => {
        if (apiService.demoMode) {
            try {
                const {initialOptions} = await import('../data/initialData');
                return Promise.resolve(initialOptions);
            } catch (error) {
                console.error('Failed to load initial options:', error);
                return Promise.resolve([]);
            }
        }
        const response = await fetch(`${API_BASE_URL}/options`, {headers: API_HEADERS});
        if (!response.ok) throw new Error('Failed to fetch options');
        return response.json();
    },

    addOption: async (optionData) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const newOption = {
                ...optionData,
                id: Date.now(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            return Promise.resolve(newOption);
        }
        const response = await fetch(`${API_BASE_URL}/options`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify(optionData)
        });
        if (!response.ok) throw new Error('Failed to add option');
        return response.json();
    },

    updateOption: async (optionId, updates) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 400));
            const updatedOption = {
                ...updates,
                id: optionId,
                updatedAt: new Date().toISOString()
            };
            return Promise.resolve(updatedOption);
        }
        const response = await fetch(`${API_BASE_URL}/options/${optionId}`, {
            method: 'PUT',
            headers: API_HEADERS,
            body: JSON.stringify(updates)
        });
        if (!response.ok) throw new Error('Failed to update option');
        return response.json();
    },

    deleteOption: async (optionId) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 300));
            return Promise.resolve({success: true, deletedId: optionId});
        }
        const response = await fetch(`${API_BASE_URL}/options/${optionId}`, {
            method: 'DELETE',
            headers: API_HEADERS
        });
        if (!response.ok) throw new Error('Failed to delete option');
        return response.json();
    },

// Also add booking methods if they're not already implemented
    addBooking: async (bookingData) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 600));
            const newBooking = {
                ...bookingData,
                id: Date.now(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            return Promise.resolve(newBooking);
        }
        const response = await fetch(`${API_BASE_URL}/bookings`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify(bookingData)
        });
        if (!response.ok) throw new Error('Failed to add booking');
        return response.json();
    },

    updateBooking: async (bookingId, updates) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const updatedBooking = {
                ...updates,
                id: bookingId,
                updatedAt: new Date().toISOString()
            };
            return Promise.resolve(updatedBooking);
        }
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
            method: 'PUT',
            headers: API_HEADERS,
            body: JSON.stringify(updates)
        });
        if (!response.ok) throw new Error('Failed to update booking');
        return response.json();
    },

    deleteBooking: async (bookingId) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 400));
            return Promise.resolve({success: true, deletedId: bookingId});
        }
        const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: API_HEADERS
        });
        if (!response.ok) throw new Error('Failed to delete booking');
        return response.json();
    },

// Add availability methods
    addAvailability: async (availabilityData) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 400));
            const newAvailability = {
                ...availabilityData,
                id: Date.now(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            return Promise.resolve(newAvailability);
        }
        const response = await fetch(`${API_BASE_URL}/availability`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify(availabilityData)
        });
        if (!response.ok) throw new Error('Failed to add availability');
        return response.json();
    },

    updateAvailabilityItem: async (availabilityId, updates) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 350));
            const updatedAvailability = {
                ...updates,
                id: availabilityId,
                updatedAt: new Date().toISOString()
            };
            return Promise.resolve(updatedAvailability);
        }
        const response = await fetch(`${API_BASE_URL}/availability/${availabilityId}`, {
            method: 'PUT',
            headers: API_HEADERS,
            body: JSON.stringify(updates)
        });
        if (!response.ok) throw new Error('Failed to update availability');
        return response.json();
    },

    deleteAvailability: async (availabilityId) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 300));
            return Promise.resolve({success: true, deletedId: availabilityId});
        }
        const response = await fetch(`${API_BASE_URL}/availability/${availabilityId}`, {
            method: 'DELETE',
            headers: API_HEADERS
        });
        if (!response.ok) throw new Error('Failed to delete availability');
        return response.json();
    },

// Sync availability to platforms
    syncAvailabilityToPlatforms: async () => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Simulate syncing to connected platforms
            return Promise.resolve({
                success: true,
                syncedCount: 3,
                message: 'Availability synced to 3 platforms',
                timestamp: new Date().toISOString()
            });
        }
        const response = await fetch(`${API_BASE_URL}/availability/sync`, {
            method: 'POST',
            headers: API_HEADERS
        });
        if (!response.ok) throw new Error('Failed to sync availability');
        return response.json();
    },

    // Availability management endpoints
    getAvailability: async () => {
        if (apiService.demoMode) {
            try {
                const {initialAvailability} = await import('../data/initialData');
                return Promise.resolve(initialAvailability);
            } catch (error) {
                console.error('Failed to load initial availability:', error);
                return Promise.resolve([]);
            }
        }
        const response = await fetch(`${API_BASE_URL}/availability`, {headers: API_HEADERS});
        if (!response.ok) throw new Error('Failed to fetch availability');
        return response.json();
    },

    updateAvailability: async (availability) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return Promise.resolve({success: true, availability});
        }
        const response = await fetch(`${API_BASE_URL}/availability`, {
            method: 'PUT',
            headers: API_HEADERS,
            body: JSON.stringify(availability)
        });
        if (!response.ok) throw new Error('Failed to update availability');
        return response.json();
    },

    // Enhanced platform management with proper error handling
    getPlatforms: async () => {
        if (apiService.demoMode) {
            try {
                const {initialPlatforms} = await import('../data/initial/platforms');
                const enhancedPlatforms = initialPlatforms.map(platform => ({
                    ...platform,
                    ...platformCapabilities[platform.id],
                    description: apiService.getPlatformDescription(platform.id, platform.name)
                }));
                return Promise.resolve(enhancedPlatforms);
            } catch (error) {
                console.error('Failed to load platforms:', error);
                return Promise.resolve([]);
            }
        }
        const response = await fetch(`${API_BASE_URL}/platforms`, {headers: API_HEADERS});
        if (!response.ok) throw new Error('Failed to fetch platforms');
        return response.json();
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
        if (apiService.demoMode) {
            const capabilities = platformCapabilities[platformId];

            if (capabilities?.agentCapable) {
                try {
                    const testResult = await platformAgent.testConnection(platformId, authData);

                    if (testResult.success) {
                        return Promise.resolve({
                            success: true,
                            platform: {
                                id: platformId,
                                connected: true,
                                lastSync: new Date().toISOString(),
                                authData: authData,
                                connectionType: capabilities.connectionType,
                                testResult: testResult
                            }
                        });
                    } else {
                        throw new Error(testResult.message);
                    }
                } catch (error) {
                    console.error(`Agent connection failed for platform ${platformId}:`, error);
                    throw new Error(`Agent connection failed: ${error.message}`);
                }
            } else {
                // Standard connection for non-agent platforms
                await new Promise(resolve => setTimeout(resolve, 1000));
                return Promise.resolve({
                    success: true,
                    platform: {
                        id: platformId,
                        connected: true,
                        lastSync: new Date().toISOString(),
                        authData: authData,
                        connectionType: capabilities?.connectionType || 'standard'
                    }
                });
            }
        }

        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/connect`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify(authData)
        });
        if (!response.ok) throw new Error('Failed to connect platform');
        return response.json();
    },

    disconnectPlatform: async (platformId) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return Promise.resolve({
                success: true,
                platform: {
                    id: platformId,
                    connected: false,
                    lastSync: null,
                    authData: {}
                }
            });
        }
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/disconnect`, {
            method: 'POST',
            headers: API_HEADERS
        });
        if (!response.ok) throw new Error('Failed to disconnect platform');
        return response.json();
    },

    updatePlatformSettings: async (platformId, settings) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 300));
            return Promise.resolve({
                success: true,
                settings: settings
            });
        }
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/settings`, {
            method: 'PUT',
            headers: API_HEADERS,
            body: JSON.stringify(settings)
        });
        if (!response.ok) throw new Error('Failed to update platform settings');
        return response.json();
    },

    testPlatformConnection: async (platformId, credentials) => {
        if (apiService.demoMode) {
            const capabilities = platformCapabilities[platformId];

            if (capabilities?.agentCapable) {
                try {
                    const result = await platformAgent.testConnection(platformId, credentials);
                    return Promise.resolve({
                        success: result.success,
                        message: result.message,
                        lastTested: new Date().toISOString(),
                        connectionType: capabilities.connectionType
                    });
                } catch (error) {
                    console.error(`Test connection failed for platform ${platformId}:`, error);
                    return Promise.resolve({
                        success: false,
                        message: error.message,
                        lastTested: new Date().toISOString(),
                        connectionType: capabilities.connectionType
                    });
                }
            } else {
                // Simulate connection test for non-agent platforms
                await new Promise(resolve => setTimeout(resolve, 1000));
                const success = Math.random() > 0.2;
                return Promise.resolve({
                    success: success,
                    message: success ? 'Verbindung erfolgreich' : 'Verbindung fehlgeschlagen',
                    lastTested: new Date().toISOString(),
                    connectionType: capabilities?.connectionType || 'standard'
                });
            }
        }

        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/test`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify(credentials)
        });
        if (!response.ok) throw new Error('Failed to test platform connection');
        return response.json();
    },

    syncToPlatform: async (platformId, dataTypes = ['profile', 'availability'], credentials) => {
        if (apiService.demoMode) {
            const capabilities = platformCapabilities[platformId];

            if (capabilities?.agentCapable) {
                try {
                    const results = {};

                    if (dataTypes.includes('profile')) {
                        const profile = await apiService.getProfile();
                        results.profile = await platformAgent.syncProfile(platformId, credentials, profile);
                    }

                    if (dataTypes.includes('availability')) {
                        const availability = await apiService.getAvailability();
                        results.availability = await platformAgent.updateAvailability(platformId, credentials, availability);
                    }

                    return Promise.resolve({
                        success: true,
                        synced: dataTypes,
                        results: results,
                        timestamp: new Date().toISOString(),
                        connectionType: capabilities.connectionType
                    });

                } catch (error) {
                    console.error(`Sync failed for platform ${platformId}:`, error);
                    throw new Error(`Agent sync failed: ${error.message}`);
                }
            } else {
                // Simulate sync for non-agent platforms
                await new Promise(resolve => setTimeout(resolve, 2000));
                return Promise.resolve({
                    success: true,
                    synced: dataTypes,
                    timestamp: new Date().toISOString(),
                    connectionType: capabilities?.connectionType || 'standard'
                });
            }
        }

        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/sync`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({dataTypes, credentials})
        });
        if (!response.ok) throw new Error('Failed to sync to platform');
        return response.json();
    },

    bulkSyncToPlatforms: async (platformIds, dataTypes = ['profile', 'availability'], credentialsMap) => {
        if (apiService.demoMode) {
            try {
                const results = [];
                let successCount = 0;
                let failureCount = 0;

                for (const platformId of platformIds) {
                    try {
                        const credentials = credentialsMap[platformId];
                        if (!credentials) {
                            throw new Error('No credentials provided for platform');
                        }

                        const result = await apiService.syncToPlatform(platformId, dataTypes, credentials);
                        results.push({platformId, success: true, result});
                        successCount++;
                    } catch (error) {
                        console.error(`Bulk sync failed for platform ${platformId}:`, error);
                        results.push({platformId, success: false, error: error.message});
                        failureCount++;
                    }
                }

                return Promise.resolve({
                    success: true,
                    synced: successCount,
                    failed: failureCount,
                    results: results,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Bulk sync failed:', error);
                throw new Error(`Bulk sync failed: ${error.message}`);
            }
        }

        const response = await fetch(`${API_BASE_URL}/platforms/bulk-sync`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({platformIds, dataTypes, credentialsMap})
        });
        if (!response.ok) throw new Error('Failed to bulk sync platforms');
        return response.json();
    },

    readProfileFromPlatform: async (platformId, credentials) => {
        if (apiService.demoMode) {
            const capabilities = platformCapabilities[platformId];

            if (capabilities?.agentCapable) {
                try {
                    const profileData = await platformAgent.readProfile(platformId, credentials);
                    return Promise.resolve({
                        success: true,
                        data: profileData,
                        timestamp: new Date().toISOString(),
                        connectionType: capabilities.connectionType
                    });
                } catch (error) {
                    console.error(`Read profile failed for platform ${platformId}:`, error);
                    throw new Error(`Failed to read profile from platform: ${error.message}`);
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 1500));
                const mockProfile = {
                    name: 'Imported Name',
                    biography: 'Imported biography from platform',
                    height: '175 cm',
                    eyeColor: 'Brown'
                };
                return Promise.resolve({
                    success: true,
                    data: mockProfile,
                    timestamp: new Date().toISOString(),
                    connectionType: capabilities?.connectionType || 'standard'
                });
            }
        }

        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/profile`, {
            method: 'GET',
            headers: {...API_HEADERS, 'X-Platform-Credentials': btoa(JSON.stringify(credentials))}
        });
        if (!response.ok) throw new Error('Failed to read profile from platform');
        return response.json();
    },

    checkAgentHealth: async () => {
        if (apiService.demoMode) {
            try {
                await platformAgent.initialize();

                const agentCapablePlatforms = Object.entries(platformCapabilities)
                    .filter(([id, caps]) => caps.agentCapable)
                    .length;

                return Promise.resolve({
                    success: true,
                    status: 'healthy',
                    message: `Platform agent running in simulation mode - ${agentCapablePlatforms} platforms supported`,
                    timestamp: new Date().toISOString(),
                    supportedPlatforms: agentCapablePlatforms,
                    mode: 'simulation'
                });
            } catch (error) {
                console.error('Agent health check failed:', error);
                return Promise.resolve({
                    success: false,
                    status: 'error',
                    message: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

        const response = await fetch(`${API_BASE_URL}/agent/health`, {headers: API_HEADERS});
        if (!response.ok) throw new Error('Failed to check agent health');
        return response.json();
    },

    // OAuth flow endpoints
    initiateOAuth: async (platformId) => {
        if (apiService.demoMode) {
            const platformNames = {
                1: 'filmmakers',
                5: 'jobwork',
                9: 'wanted'
            };
            const platformName = platformNames[platformId] || 'platform';

            await new Promise(resolve => setTimeout(resolve, 500));
            return Promise.resolve({
                authUrl: `https://demo-oauth.com/${platformName}?client_id=demo&redirect_uri=http://localhost:3000/oauth/callback`,
                state: `${platformId}_${Date.now()}`
            });
        }
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/oauth/init`, {
            method: 'POST',
            headers: API_HEADERS
        });
        if (!response.ok) throw new Error('Failed to initiate OAuth');
        return response.json();
    },

    completeOAuth: async (platformId, authCode, state) => {
        if (apiService.demoMode) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return Promise.resolve({
                success: true,
                accessToken: `demo_token_${platformId}`,
                expiresIn: 3600
            });
        }
        const response = await fetch(`${API_BASE_URL}/platforms/${platformId}/oauth/complete`, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({code: authCode, state})
        });
        if (!response.ok) throw new Error('Failed to complete OAuth');
        return response.json();
    }
};

export default apiService;