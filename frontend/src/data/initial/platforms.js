export const initialPlatforms = [
    {
        id: 1,
        name: 'Filmmakers',
        connected: true,
        lastSync: new Date().toISOString(),
        authType: 'oauth',
        authData: {token: 'xxx-xxx-xxx'},
        syncSettings: {autoSync: true, syncInterval: 'daily', syncAvailability: true}
    },
    {
        id: 2,
        name: 'Casting Network',
        connected: true,
        lastSync: new Date().toISOString(),
        authType: 'credentials',
        authData: {username: 'max@example.com', password: '••••••••'},
        syncSettings: {autoSync: true, syncInterval: 'hourly', syncAvailability: true}
    },
    {
        id: 3,
        name: 'Schauspielervideos',
        connected: false,
        lastSync: null,
        authType: 'api',
        authData: {},
        syncSettings: {autoSync: false, syncInterval: 'weekly', syncAvailability: false}
    },
    {
        id: 4,
        name: 'e-TALENTA',
        connected: true,
        lastSync: new Date().toISOString(),
        authType: 'api',
        authData: {apiKey: 'sk-xxx-xxx'},
        syncSettings: {autoSync: true, syncInterval: 'daily', syncAvailability: true}
    },
    {
        id: 5,
        name: 'JobWork',
        connected: true,
        lastSync: new Date().toISOString(),
        authType: 'oauth',
        authData: {token: 'xxx-xxx-xxx'},
        syncSettings: {autoSync: false, syncInterval: 'daily', syncAvailability: false}
    },
    {
        id: 6,
        name: 'Agentur Iris Müller',
        connected: false,
        lastSync: null,
        authType: 'credentials',
        authData: {},
        syncSettings: {autoSync: false, syncInterval: 'weekly', syncAvailability: false}
    },
    {
        id: 7,
        name: 'Agentur Connection',
        connected: true,
        lastSync: new Date().toISOString(),
        authType: 'api',
        authData: {apiKey: 'conn-xxx-xxx'},
        syncSettings: {autoSync: true, syncInterval: 'daily', syncAvailability: true}
    },
    {
        id: 8,
        name: 'Agentur Sarah Weiss',
        connected: false,
        lastSync: null,
        authType: 'credentials',
        authData: {},
        syncSettings: {autoSync: false, syncInterval: 'weekly', syncAvailability: false}
    },
    {
        id: 9,
        name: 'Wanted',
        connected: true,
        lastSync: new Date().toISOString(),
        authType: 'oauth',
        authData: {token: 'xxx-xxx-xxx'},
        syncSettings: {autoSync: true, syncInterval: 'hourly', syncAvailability: true}
    }
];