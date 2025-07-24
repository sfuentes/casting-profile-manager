import React, {useState, createContext, useContext, useEffect} from 'react';
import {apiService} from '../services/apiService';
import {initialProfile, initialBookings, initialOptions, initialAvailability} from '../data/initialData';
import {initialPlatforms} from "../data/initialData.js";

// App Context for State Management
const AppContext = createContext();

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
};

// App Provider Component with API Integration
export const AppProvider = ({children}) => {
    const [profile, setProfile] = useState(initialProfile);
    const [bookings, setBookings] = useState([]);
    const [options, setOptions] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [platforms, setPlatforms] = useState([]);
    const [syncStatus, setSyncStatus] = useState({syncing: false, lastSync: null});

    // Loading and error states
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false); // NEW

    const [uploading, setUploading] = useState(false); // NEW
    const [error, setError] = useState(null);
    const [lastSaved, setLastSaved] = useState(null);

    // Load initial data from API
    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
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
            if (!apiService.demoMode) {
                setError('Fehler beim Laden der Daten. Offline-Modus aktiv.');
            }
            setProfile(initialProfile);
            setBookings(initialBookings);
            setOptions(initialOptions);
            setAvailability(initialAvailability);
            setPlatforms(initialPlatforms);
        } finally {
            setLoading(false);
        }
    };

    // Profile functions with API integration (enhanced)
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

    // Work history functions (NEW)
    const addWorkHistory = async (workItem) => {
        setSaving(true);
        try {
            const newWorkItem = await apiService.addWorkHistory(workItem);
            setProfile(prev => ({
                ...prev,
                workHistory: [...(prev.workHistory || []), newWorkItem]
            }));
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to add work history:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Hinzufügen der Berufserfahrung');
            } else {
                setProfile(prev => ({
                    ...prev,
                    workHistory: [...(prev.workHistory || []), {...workItem, id: Date.now()}]
                }));
                setLastSaved(new Date());
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

    // Education functions (NEW)
    const addEducation = async (educationItem) => {
        setSaving(true);
        try {
            const newEducationItem = await apiService.addEducation(educationItem);
            setProfile(prev => ({
                ...prev,
                education: [...(prev.education || []), newEducationItem]
            }));
            setLastSaved(new Date());
        } catch (err) {
            console.error('Failed to add education:', err);
            if (!apiService.demoMode) {
                setError('Fehler beim Hinzufügen der Ausbildung');
            } else {
                setProfile(prev => ({
                    ...prev,
                    education: [...(prev.education || []), {...educationItem, id: Date.now()}]
                }));
                setLastSaved(new Date());
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

    // Image upload functions (NEW)
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

    // Sync profile to platforms (NEW)
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
    // Platform management functions (NEW)
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

    // ... rest of existing functions remain the same ...

    const value = {
        // Data
        profile,
        bookings,
        options,
        availability,
        platforms,
        syncStatus,

        // Loading states
        loading,
        saving,
        uploading, // NEW
        syncing, // NEW

        error,
        lastSaved,

        // Platform functions (NEW)
        connectPlatform,
        disconnectPlatform,
        updatePlatformSettings,
        testPlatformConnection,
        syncToPlatform,
        bulkSyncToPlatforms,
        initiateOAuth,

        // Profile functions
        updateProfile,
        addWorkHistory, // NEW
        updateWorkHistory, // NEW
        deleteWorkHistory, // NEW
        addEducation, // NEW
        updateEducation, // NEW
        deleteEducation, // NEW
        uploadProfilePhoto, // NEW
        uploadSetcardPhoto, // NEW
        deleteSetcardPhoto, // NEW
        syncProfileToPlatforms, // NEW

        // ... existing functions remain the same
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};