import platformAgent from './platformAgent.js';

// API Configuration
const API_BASE_URL = 'https://api.darsteller-manager.de/v1';
const API_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer demo-token' // In production, this would come from auth context
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

// API Service with Demo Mode and Agent Integration
export const apiService = {
    // Demo mode flag - set to true to use local data instead of API calls
    demoMode: true,

    // Profile management endpoints
    getProfile: async () => {
        if (apiService.demoMode) {
            const {initialProfile} = await import('../data/initial/platforms.js');
            return Promise.resolve(initialProfile);
        }
        const response = await fetch(`${API_BASE_URL}/profile`, {headers: API_HEADERS});
        if (!response.ok) throw new Error('Failed to fetch profile');
        return response.json();
    },

    updateProfile: async (profileData) => {
        if (apiService.demoMode) {
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
            const {initialBookings} = await import('../data/initial/bookings.js');
            return Promise.resolve(initialBookings);
        }
        const response = await fetch(`${API_BASE_URL}/bookings`, {headers: API_HEADERS});
        if (!response.ok) throw new Error('Failed to fetch bookings');
        return response.json();
    },

    // Availability management endpoints
    getAvailability: async () => {
        if (apiService.demoMode) {
            const {initialAvailability} = await import('../data/initial/availability.js');
            return Promise.resolve(initialAvailability);
        }
        const response = await fetch(`${API_BASE_URL}/availability`, {headers: API_HEADERS});
        if (!response.ok) throw new Error('Failed to fetch availability');
        return response.json();
    },

    updateAvailability: async (availability) => {
        if (apiService.demoMode) {
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

    // Enhanced platform management with agent integration
    getPlatforms: async () => {
        if (apiService.demoMode) {
            const {initialPlatforms} = await import('../data/initial/platforms.js');
            // Enhance platforms with agent capabilities
            const enhancedPlatforms = initialPlatforms.map(platform => ({
                ...platform,
                ...platformCapabilities[platform.id],
                description: apiService.getPlatformDescription(platform.id, platform.name)
            }));
            return Promise.resolve(enhancedPlatforms);
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

            // Test connection using agent system if agent-capable
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
                    throw new Error(`Agent connection failed: ${error.message}`);
                }
            } else {
                // Standard connection for non-agent platforms
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
                    // Use agent to test real connection
                    const result = await platformAgent.testConnection(platformId, credentials);
                    return Promise.resolve({
                        success: result.success,
                        message: result.message,
                        lastTested: new Date().toISOString(),
                        connectionType: capabilities.connectionType
                    });
                } catch (error) {
                    return Promise.resolve({
                        success: false,
                        message: error.message,
                        lastTested: new Date().toISOString(),
                        connectionType: capabilities.connectionType
                    });
                }
            } else {
                // Simulate connection test for non-agent platforms
                const success = Math.random() > 0.2; // 80% success rate
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
                    // Use agent to perform real sync
                    const results = {};

                    if (dataTypes.includes('profile')) {
                        // Get current profile data
                        const profile = await apiService.getProfile();
                        results.profile = await platformAgent.syncProfile(platformId, credentials, profile);
                    }

                    if (dataTypes.includes('availability')) {
                        // Get current availability data
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

    // Read profile data from platform using agent
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
                    throw new Error(`Failed to read profile from platform: ${error.message}`);
                }
            } else {
                // Simulate profile read for non-agent platforms
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

    // Platform agent health check
    checkAgentHealth: async () => {
        if (apiService.demoMode) {
            try {
                // Check if platform agent is initialized and working
                await platformAgent.initialize();

                const agentCapablePlatforms = Object.entries(platformCapabilities)
                    .filter(([id, caps]) => caps.agentCapable)
                    .length;

                return Promise.resolve({
                    success: true,
                    status: 'healthy',
                    message: `Platform agent running - ${agentCapablePlatforms} platforms supported`,
                    timestamp: new Date().toISOString(),
                    supportedPlatforms: agentCapablePlatforms
                });
            } catch (error) {
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

// Cleanup agent on app termination
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', async () => {
        await platformAgent.cleanup();
    });
}

export default apiService;