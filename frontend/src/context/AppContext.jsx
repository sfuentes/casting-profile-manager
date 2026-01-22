import React, {useState, createContext, useContext, useEffect} from 'react';
import {apiService} from '../services/apiService';
import {initialProfile, initialBookings, initialOptions, initialAvailability} from '../data/initialData';
import {initialPlatforms} from "../data/initialData.js";

// App Context for State Management
const AppContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
};

// App Provider Component with API Integration
export const AppProvider = ({children}) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [profile, setProfile] = useState(initialProfile);
    const [bookings, setBookings] = useState([]);
    const [options, setOptions] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [platforms, setPlatforms] = useState([]);
    const [syncStatus, setSyncStatus] = useState({syncing: false, lastSync: null});

    // Loading and error states
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [lastSaved, setLastSaved] = useState(null);

    // Check for token on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && token !== 'undefined' && token !== 'null') {
            checkAuth();
        } else {
            localStorage.removeItem('token'); // Clean up garbage values
            setIsAuthenticated(false);
            setLoading(false);
        }
    }, []);

    const checkAuth = async () => {
        setLoading(true);
        try {
            const userData = await apiService.getMe();
            if (userData && (userData.id || userData._id)) {
                setUser(userData);
                setIsAuthenticated(true);
                await loadAllData();
            } else {
                throw new Error('Ungültige Benutzerdaten erhalten.');
            }
        } catch (err) {
            console.error('Auth check failed:', err);
            localStorage.removeItem('token');
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    const loadAllData = async () => {
        setError(null);

        try {
            const [profileData, bookingsData, optionsData, availabilityData, platformsData] = await Promise.all([
                apiService.getProfile(),
                apiService.getBookings(),
                apiService.getOptions(),
                apiService.getAvailability(),
                apiService.getPlatforms()
            ]);

            setProfile(profileData || initialProfile);
            setBookings(bookingsData || initialBookings);
            setOptions(optionsData || initialOptions);
            setAvailability(availabilityData || initialAvailability);
            setPlatforms(platformsData || initialPlatforms);

        } catch (err) {
            console.error('Failed to load data:', err);
            if (!apiService.demoMode && isAuthenticated) {
                setError('Fehler beim Laden der Daten.');
            }
            if (!isAuthenticated) {
                setProfile(initialProfile);
                setBookings(initialBookings);
                setOptions(initialOptions);
                setAvailability(initialAvailability);
                setPlatforms(initialPlatforms);
            }
        }
    };

    const login = async (email, password) => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiService.login(email, password);
            if (data && data.user) {
                setUser(data.user);
                setIsAuthenticated(true);
                await loadAllData();
                return true;
            } else {
                throw new Error('Login erfolgreich, aber keine Benutzerdaten erhalten.');
            }
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const register = async (userData) => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiService.register(userData);
            return data;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        await apiService.logout();
        setUser(null);
        setIsAuthenticated(false);
        setProfile(initialProfile);
        setBookings([]);
        setOptions([]);
        setAvailability([]);
        setPlatforms([]);
    };

    // Profile functions with API integration
    const updateProfile = async (updates) => {
        const oldProfile = profile;
        setProfile(prev => ({...prev, ...updates}));
        setSaving(true);

        try {
            const updatedProfile = await apiService.updateProfile({...profile, ...updates});
            setProfile(updatedProfile);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to update profile:', err);
            if (!apiService.demoMode) {
                setProfile(oldProfile);
                setError('Fehler beim Speichern des Profils');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    // Work history functions
    const addWorkHistory = async (workItem) => {
        setSaving(true);
        try {
            const newWorkItem = await apiService.addWorkHistory(workItem);
            setProfile(prev => ({
                ...prev,
                workHistory: [...(prev.workHistory || []), newWorkItem]
            }));
            setLastSaved(new Date());
            return newWorkItem;
        } catch (err) {
            console.error('Failed to add work history:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Hinzufügen der Berufserfahrung');
            } else {
                const newWorkItem = {...workItem, id: Date.now()};
                setProfile(prev => ({
                    ...prev,
                    workHistory: [...(prev.workHistory || []), newWorkItem]
                }));
                setLastSaved(new Date());
                return newWorkItem;
            }
        } finally {
            setSaving(false);
        }
    };

    const updateWorkHistory = async (id, updates) => {
        const oldProfile = profile;
        setProfile(prev => ({
            ...prev,
            workHistory: prev.workHistory.map(w => w.id === id ? {...w, ...updates} : w)
        }));
        setSaving(true);

        try {
            await apiService.updateWorkHistory(id, updates);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to update work history:', err);
            if (!apiService.demoMode) {
                setProfile(oldProfile);
                setError('Fehler beim Aktualisieren der Berufserfahrung');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteWorkHistory = async (id) => {
        const oldProfile = profile;
        setProfile(prev => ({
            ...prev,
            workHistory: prev.workHistory.filter(w => w.id !== id)
        }));
        setSaving(true);

        try {
            await apiService.deleteWorkHistory(id);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to delete work history:', err);
            if (!apiService.demoMode) {
                setProfile(oldProfile);
                setError('Fehler beim Löschen der Berufserfahrung');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    // Education functions
    const addEducation = async (educationItem) => {
        setSaving(true);
        try {
            const newEducationItem = await apiService.addEducation(educationItem);
            setProfile(prev => ({
                ...prev,
                education: [...(prev.education || []), newEducationItem]
            }));
            setLastSaved(new Date());
            return newEducationItem;
        } catch (err) {
            console.error('Failed to add education:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Hinzufügen der Ausbildung');
            } else {
                const newEducationItem = {...educationItem, id: Date.now()};
                setProfile(prev => ({
                    ...prev,
                    education: [...(prev.education || []), newEducationItem]
                }));
                setLastSaved(new Date());
                return newEducationItem;
            }
        } finally {
            setSaving(false);
        }
    };

    const updateEducation = async (id, updates) => {
        const oldProfile = profile;
        setProfile(prev => ({
            ...prev,
            education: prev.education.map(e => e.id === id ? {...e, ...updates} : e)
        }));
        setSaving(true);

        try {
            await apiService.updateEducation(id, updates);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to update education:', err);
            if (!apiService.demoMode) {
                setProfile(oldProfile);
                setError('Fehler beim Aktualisieren der Ausbildung');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteEducation = async (id) => {
        const oldProfile = profile;
        setProfile(prev => ({
            ...prev,
            education: prev.education.filter(e => e.id !== id)
        }));
        setSaving(true);

        try {
            await apiService.deleteEducation(id);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to delete education:', err);
            if (!apiService.demoMode) {
                setProfile(oldProfile);
                setError('Fehler beim Löschen der Ausbildung');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    // Image upload functions
    const uploadProfilePhoto = async (file) => {
        setUploading(true);
        try {
            const result = await apiService.uploadProfilePhoto(file);
            setProfile(prev => ({...prev, avatar: result.url}));
            setLastSaved(new Date());
            return result;
        } catch (err) {
            console.error('Failed to upload profile photo:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Hochladen des Profilbildes');
            }
            throw err;
        } finally {
            setUploading(false);
        }
    };

    const uploadSetcardPhoto = async (photoId, file) => {
        setUploading(true);
        try {
            const result = await apiService.uploadSetcardPhoto(photoId, file);
            setProfile(prev => ({
                ...prev,
                setcard: {
                    ...prev.setcard,
                    photos: prev.setcard.photos.map(p =>
                        p.id === photoId ? {...p, url: result.url} : p
                    ),
                    lastUpdated: new Date().toISOString()
                }
            }));
            setLastSaved(new Date());
            return result;
        } catch (err) {
            console.error('Failed to upload setcard photo:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Hochladen des Setcard-Bildes');
            }
            throw err;
        } finally {
            setUploading(false);
        }
    };

    const deleteSetcardPhoto = async (photoId) => {
        setUploading(true);
        try {
            await apiService.deleteSetcardPhoto(photoId);
            setProfile(prev => ({
                ...prev,
                setcard: {
                    ...prev.setcard,
                    photos: prev.setcard.photos.map(p =>
                        p.id === photoId ? {...p, url: null} : p
                    ),
                    lastUpdated: new Date().toISOString()
                }
            }));
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to delete setcard photo:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Löschen des Setcard-Bildes');
            }
            throw err;
        } finally {
            setUploading(false);
        }
    };

    // Booking functions with API integration
    const addBooking = async (bookingData) => {
        setSaving(true);
        try {
            const newBooking = await apiService.addBooking(bookingData);
            setBookings(prev => [...prev, newBooking]);
            setLastSaved(new Date());
            return newBooking;
        } catch (err) {
            console.error('Failed to add booking:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Hinzufügen der Buchung');
            } else {
                const newBooking = {...bookingData, id: Date.now()};
                setBookings(prev => [...prev, newBooking]);
                setLastSaved(new Date());
                return newBooking;
            }
        } finally {
            setSaving(false);
        }
    };

    const updateBooking = async (bookingId, updates) => {
        const oldBookings = bookings;
        setBookings(prev => prev.map(b => b.id === bookingId ? {...b, ...updates} : b));
        setSaving(true);

        try {
            const updatedBooking = await apiService.updateBooking(bookingId, updates);
            setBookings(prev => prev.map(b => b.id === bookingId ? updatedBooking : b));
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to update booking:', err);
            if (!apiService.demoMode) {
                setBookings(oldBookings);
                setError('Fehler beim Aktualisieren der Buchung');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteBooking = async (bookingId) => {
        const oldBookings = bookings;
        setBookings(prev => prev.filter(b => b.id !== bookingId));
        setSaving(true);

        try {
            await apiService.deleteBooking(bookingId);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to delete booking:', err);
            if (!apiService.demoMode) {
                setBookings(oldBookings);
                setError('Fehler beim Löschen der Buchung');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    // Option functions with API integration
    const addOption = async (optionData) => {
        setSaving(true);
        try {
            const newOption = await apiService.addOption(optionData);
            setOptions(prev => [...prev, newOption]);
            setLastSaved(new Date());
            return newOption;
        } catch (err) {
            console.error('Failed to add option:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Hinzufügen der Option');
            } else {
                const newOption = {...optionData, id: Date.now()};
                setOptions(prev => [...prev, newOption]);
                setLastSaved(new Date());
                return newOption;
            }
        } finally {
            setSaving(false);
        }
    };

    const updateOption = async (optionId, updates) => {
        const oldOptions = options;
        setOptions(prev => prev.map(o => o.id === optionId ? {...o, ...updates} : o));
        setSaving(true);

        try {
            const updatedOption = await apiService.updateOption(optionId, updates);
            setOptions(prev => prev.map(o => o.id === optionId ? updatedOption : o));
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to update option:', err);
            if (!apiService.demoMode) {
                setOptions(oldOptions);
                setError('Fehler beim Aktualisieren der Option');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteOption = async (optionId) => {
        const oldOptions = options;
        setOptions(prev => prev.filter(o => o.id !== optionId));
        setSaving(true);

        try {
            await apiService.deleteOption(optionId);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to delete option:', err);
            if (!apiService.demoMode) {
                setOptions(oldOptions);
                setError('Fehler beim Löschen der Option');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    // Availability functions with API integration
    const addAvailability = async (availabilityData) => {
        setSaving(true);
        try {
            const newAvailability = await apiService.addAvailability(availabilityData);
            setAvailability(prev => [...prev, newAvailability]);
            setLastSaved(new Date());
            return newAvailability;
        } catch (err) {
            console.error('Failed to add availability:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Hinzufügen der Verfügbarkeit');
            } else {
                const newAvailability = {...availabilityData, id: Date.now()};
                setAvailability(prev => [...prev, newAvailability]);
                setLastSaved(new Date());
                return newAvailability;
            }
        } finally {
            setSaving(false);
        }
    };

    const updateAvailability = async (availabilityId, updates) => {
        const oldAvailability = availability;
        setAvailability(prev => prev.map(a => a.id === availabilityId ? {...a, ...updates} : a));
        setSaving(true);

        try {
            const updatedAvailability = await apiService.updateAvailabilityItem(availabilityId, updates);
            setAvailability(prev => prev.map(a => a.id === availabilityId ? updatedAvailability : a));
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to update availability:', err);
            if (!apiService.demoMode) {
                setAvailability(oldAvailability);
                setError('Fehler beim Aktualisieren der Verfügbarkeit');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteAvailability = async (availabilityId) => {
        const oldAvailability = availability;
        setAvailability(prev => prev.filter(a => a.id !== availabilityId));
        setSaving(true);

        try {
            await apiService.deleteAvailability(availabilityId);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to delete availability:', err);
            if (!apiService.demoMode) {
                setAvailability(oldAvailability);
                setError('Fehler beim Löschen der Verfügbarkeit');
            } else {
                setLastSaved(new Date());
            }
        } finally {
            setSaving(false);
        }
    };

    // Sync profile to platforms
    const syncProfileToPlatforms = async () => {
        setSyncStatus({syncing: true});

        try {
            const result = await apiService.syncProfileToPlatforms();
            setPlatforms(result.platforms);
            setSyncStatus({syncing: false, lastSync: new Date().toISOString()});
            setLastSaved(new Date());
            return result.synced;
        } catch (err) {
            console.error('Failed to sync profile:', err);
            if (!apiService.demoMode) {
                setSyncStatus({syncing: false});
                setError('Fehler bei der Profil-Synchronisation');
            } else {
                const updatedPlatforms = platforms.map(p => ({
                    ...p,
                    lastSync: p.connected ? new Date().toISOString() : p.lastSync
                }));
                setPlatforms(updatedPlatforms);
                setSyncStatus({syncing: false, lastSync: new Date().toISOString()});
                setLastSaved(new Date());
                return updatedPlatforms.filter(p => p.connected).length;
            }
        }
    };

    // Sync availability to platforms
    const syncAvailabilityToPlatforms = async () => {
        setSyncing(true);
        try {
            const result = await apiService.syncAvailabilityToPlatforms();

            // Update platforms with last sync time
            setPlatforms(prev => prev.map(p =>
                p.connected && p.syncSettings?.syncAvailability
                    ? {...p, lastSync: result.timestamp}
                    : p
            ));

            setLastSaved(new Date());
            return result.syncedCount;
        } catch (err) {
            console.error('Failed to sync availability:', err);
            if (!apiService.demoMode) {
                setError('Fehler bei der Verfügbarkeits-Synchronisation');
            }
            throw err;
        } finally {
            setSyncing(false);
        }
    };

    // Platform management functions
    const connectPlatform = async (platformId, authData) => {
        const oldPlatforms = platforms;
        setPlatforms(prev => prev.map(p =>
            p.id === platformId ? {...p, connected: true, authData} : p
        ));
        setSaving(true);

        try {
            const result = await apiService.connectPlatform(platformId, authData);
            setPlatforms(prev => prev.map(p =>
                p.id === platformId ? {...p, ...result.platform} : p
            ));
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to connect platform:', err);
            setPlatforms(oldPlatforms);
            if (!apiService.demoMode) {
                setError('Fehler beim Verbinden der Plattform');
            }
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const disconnectPlatform = async (platformId) => {
        const oldPlatforms = platforms;
        setPlatforms(prev => prev.map(p =>
            p.id === platformId ? {...p, connected: false, authData: {}, lastSync: null} : p
        ));
        setSaving(true);

        try {
            await apiService.disconnectPlatform(platformId);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to disconnect platform:', err);
            setPlatforms(oldPlatforms);
            if (!apiService.demoMode) {
                setError('Fehler beim Trennen der Plattform');
            }
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const updatePlatformSettings = async (platformId, settings) => {
        const oldPlatforms = platforms;
        setPlatforms(prev => prev.map(p =>
            p.id === platformId ? {...p, syncSettings: {...p.syncSettings, ...settings}} : p
        ));
        setSaving(true);

        try {
            await apiService.updatePlatformSettings(platformId, settings);
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to update platform settings:', err);
            setPlatforms(oldPlatforms);
            if (!apiService.demoMode) {
                setError('Fehler beim Aktualisieren der Plattform-Einstellungen');
            }
        } finally {
            setSaving(false);
        }
    };

    const testPlatformConnection = async (platformId) => {
        setSyncing(true);
        try {
            const result = await apiService.testPlatformConnection(platformId);
            setPlatforms(prev => prev.map(p =>
                p.id === platformId ? {...p, lastTested: result.lastTested, testResult: result} : p
            ));
            return result;
        } catch (err) {
            console.error('Failed to test platform connection:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Testen der Plattform-Verbindung');
            }
            throw err;
        } finally {
            setSyncing(false);
        }
    };

    const syncToPlatform = async (platformId, dataTypes = ['profile', 'availability']) => {
        setSyncing(true);
        try {
            const result = await apiService.syncToPlatform(platformId, dataTypes);
            setPlatforms(prev => prev.map(p =>
                p.id === platformId ? {...p, lastSync: result.timestamp} : p
            ));
            return result;
        } catch (err) {
            console.error('Failed to sync to platform:', err);
            if (!apiService.demoMode) {
                setError('Fehler bei der Plattform-Synchronisation');
            }
            throw err;
        } finally {
            setSyncing(false);
        }
    };

    const bulkSyncToPlatforms = async (platformIds, dataTypes = ['profile', 'availability']) => {
        setSyncing(true);
        try {
            const result = await apiService.bulkSyncToPlatforms(platformIds, dataTypes);
            setPlatforms(prev => prev.map(p =>
                platformIds.includes(p.id) ? {...p, lastSync: result.timestamp} : p
            ));
            setSyncStatus({syncing: false, lastSync: result.timestamp});
            return result;
        } catch (err) {
            console.error('Failed to bulk sync platforms:', err);
            if (!apiService.demoMode) {
                setError('Fehler bei der Massen-Synchronisation');
            }
            throw err;
        } finally {
            setSyncing(false);
        }
    };

    const initiateOAuth = async (platformId) => {
        try {
            const result = await apiService.initiateOAuth(platformId);
            // Open OAuth window
            window.open(result.authUrl, '_blank', 'width=500,height=600');
            return result;
        } catch (err) {
            console.error('Failed to initiate OAuth:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Starten der OAuth-Authentifizierung');
            }
            throw err;
        }
    };

    // Context value with all functions and state
    const value = {
        user,
        isAuthenticated,
        login,
        register,
        logout,
        profile,
        bookings,
        options,
        availability,
        platforms,
        syncStatus,

        // Loading states
        loading,
        saving,
        uploading,
        syncing,
        error,
        lastSaved,

        // Utility functions
        loadAllData,

        // Profile functions
        updateProfile,
        addWorkHistory,
        updateWorkHistory,
        deleteWorkHistory,
        addEducation,
        updateEducation,
        deleteEducation,
        uploadProfilePhoto,
        uploadSetcardPhoto,
        deleteSetcardPhoto,
        syncProfileToPlatforms,

        // Booking functions
        addBooking,
        updateBooking,
        deleteBooking,

        // Option functions
        addOption,
        updateOption,
        deleteOption,

        // Availability functions
        addAvailability,
        updateAvailability,
        deleteAvailability,
        syncAvailabilityToPlatforms,

        // Platform functions
        connectPlatform,
        disconnectPlatform,
        updatePlatformSettings,
        testPlatformConnection,
        syncToPlatform,
        bulkSyncToPlatforms,
        initiateOAuth,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};