
import React, {useState} from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import {
    Cloud,
    Plus,
    Settings,
    RefreshCw,
    Check,
    X,
    AlertCircle,
    Loader,
    ExternalLink,
    Key,
    Link,
    Shield,
    Clock,
    Activity,
    Users,
    Zap,
    Globe,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronRight,
    Wifi,
    WifiOff,
    Calendar,
    User,
    Image,
    Bot,
    Cpu,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Download,
    Upload
} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import {Button, Modal, Input, Card, Badge} from './ui';
import {
    isAutomated,
    isApiBased,
    canImportProfile,
    canSyncCredits,
    hasStoredCredentials,
    platformStatusColor,
    connectionTypeText,
    syncIntervalText,
    sourceLabel,
    previewImported,
    IMPORT_FIELD_LABELS
} from '../domain/platforms';
import {useAgentHealth} from '../hooks/useAgentHealth';
import {usePlatformImport} from '../hooks/usePlatformImport';
import {usePlatformCredits} from '../hooks/usePlatformCredits';

/** Responsive columns, as one prop on the container. */
const columns = (breakpoints) => ({
    display: 'grid',
    gap: 2,
    gridTemplateColumns: Object.fromEntries(
        Object.entries(breakpoints).map(([at, count]) => [at, `repeat(${count}, minmax(0, 1fr))`])
    )
});

const PlatformsView = () => {
    const {
        platforms,
        loading,
        saving,
        syncing,
        connectPlatform,
        disconnectPlatform,
        updatePlatformSettings,
        testPlatformConnection,
        syncToPlatform,
        bulkSyncToPlatforms,
        loadAllData
    } = useAppContext();

    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('connect');
    const [selectedPlatform, setSelectedPlatform] = useState(null);
    const [formData, setFormData] = useState({});
    const [showPassword, setShowPassword] = useState({});
    const [expandedPlatform, setExpandedPlatform] = useState(null);
    const [bulkSyncSelected, setBulkSyncSelected] = useState([]);
    const [testResults, setTestResults] = useState({});
    // Why the last connect attempt was refused, shown on the dialog itself.
    const [connectError, setConnectError] = useState('');

    // Everything below this line is the platform work itself - reading a
    // profile, reconciling credits, asking whether the agent is up. It lives in
    // hooks so this file is the screen and not the machinery; the names are
    // aliased to what the markup already calls them.
    const {status: agentStatus, check: checkAgentHealth} = useAgentHealth();

    const {
        results: importResults,
        selection: importSelection,
        resolutions: importResolutions,
        busy: importing,
        read: readProfile,
        apply: applyImport,
        toggleField: toggleImportField,
        setResolutions: setImportResolutions
    } = usePlatformImport({onApplied: loadAllData});

    const {
        questions: creditQuestions,
        answers: creditAnswers,
        summary: creditSummary,
        busy: creditBusy,
        sync: syncCredits,
        setAnswers: setCreditAnswers
    } = usePlatformCredits();

    const openModal = (type, platform) => {
        setModalType(type);
        setSelectedPlatform(platform);

        if (type === 'connect') {
            setFormData({});
            setConnectError('');
        } else if (type === 'settings') {
            setFormData(platform.syncSettings || {});
        }

        setShowModal(true);
    };

    const handleConnect = async () => {
        try {
            // Connecting verifies the credentials against the platform, so it
            // takes a few seconds and can legitimately fail. A rejected login is
            // no longer thrown - it comes back as an outcome, because the
            // credentials are saved either way and the platform can be retried
            // from its card without typing the password again.
            const result = await connectPlatform(selectedPlatform.id, formData);

            if (result?.success) {
                setShowModal(false);
                return;
            }

            // Stay on the dialog with the reason: the password may simply have a
            // typo in it, and closing would hide both the message and the field.
            setConnectError([result?.message, result?.finalUrl && `Endete auf: ${result.finalUrl}`]
                .filter(Boolean).join(String.fromCharCode(10)));
        } catch (err) {
            console.error('Connection failed:', err);
            setConnectError(err.message);
        }
    };

    const handleDisconnect = async (platform) => {
        if (!confirm(`Möchten Sie die Verbindung zu ${platform.name} wirklich trennen?`)) {
            return;
        }

        try {
            await disconnectPlatform(platform.id);
        } catch (err) {
            console.error('Disconnect failed:', err);
        }
    };

    const handleUpdateSettings = async () => {
        try {
            await updatePlatformSettings(selectedPlatform.id, formData);
            setShowModal(false);
        } catch (err) {
            console.error('Settings update failed:', err);
        }
    };

    /**
     * Test one platform's stored credentials.
     *
     * Goes through the context rather than calling apiService directly: the
     * context owns `syncing`, which is what disables the buttons and puts the
     * spinner on this one, and it surfaces the error. Calling the service
     * straight from here meant a test ran with no sign that anything was
     * happening, and a request that never arrived was logged to the console and
     * shown to the user as nothing at all - the previous badge just stayed up.
     */
    const handleTestConnection = async (platform) => {
        try {
            const result = await testPlatformConnection(platform.id);
            setTestResults(prev => ({...prev, [platform.id]: result}));
        } catch (err) {
            // A test that could not be run is a failed test as far as the user
            // is concerned, and the reason belongs on the badge.
            setTestResults(prev => ({...prev, [platform.id]: {
                success: false,
                message: err.message,
                lastTested: new Date().toISOString()
            }}));
        }
    };

    // Both go through the context, which owns `syncing` - the flag these very
    // buttons read for their spinner and disabled state - and reports the error.
    // Calling apiService straight from here meant a sync ran with no sign that
    // anything was happening, exactly as the connection test did.
    //
    // The credentials they used to pass along went nowhere: toJSON never gives
    // the browser a password, so `platform.authData` holds presence flags only,
    // and the server uses the credentials it has stored regardless.
    const handleSyncToPlatform = async (platform) => {
        try {
            await syncToPlatform(platform.id);
            alert(`Synchronisation zu ${platform.name} erfolgreich!`);
        } catch (err) {
            alert(`Synchronisation fehlgeschlagen: ${err.message}`);
        }
    };

    const handleBulkSync = async () => {
        if (bulkSyncSelected.length === 0) {
            alert('Bitte wählen Sie mindestens eine Plattform aus.');
            return;
        }

        try {
            const result = await bulkSyncToPlatforms(bulkSyncSelected);
            alert(`${result.synced} Plattformen erfolgreich synchronisiert!`);
            setBulkSyncSelected([]);
        } catch (err) {
            alert(`Massen-Synchronisation fehlgeschlagen: ${err.message}`);
        }
    };

    /**
     * Push the credits this platform is missing, and ask about the rest.
     *
     * The reconciliation lives in the hook; what stays here is what to do with
     * the answer - open the dialog when there are questions, say so when there
     * are none.
     */
    const handleSyncCredits = async (platform, answers = {}) => {
        try {
            const result = await syncCredits(platform, answers);
            setSelectedPlatform(platform);

            if (result.questions.length > 0) {
                setModalType('credits');
                setShowModal(true);
            } else {
                setShowModal(false);
                alert(result.message || `${result.added} Credits übertragen.`);
            }
        } catch (error) {
            alert(`Vita-Abgleich fehlgeschlagen: ${error.message}`);
        }
    };

    /**
     * Read the profile off the platform and show what came back.
     *
     * Nothing is written to the local profile here - `applyImport` does that,
     * and only for the fields the user ticked.
     */
    const handleImportProfile = async (platform) => {
        try {
            await readProfile(platform);
            setSelectedPlatform(platform);
            setModalType('import');
            setShowModal(true);
        } catch (error) {
            alert(error.message);
        }
    };

    const handleApplyImport = async () => {
        try {
            const applied = await applyImport(selectedPlatform);
            if (!applied) return;
            setShowModal(false);
            alert(`${applied.applied.length} Feld(er) ins Profil übernommen.`);
        } catch (error) {
            alert(`Übernehmen fehlgeschlagen: ${error.message}`);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
    };

    const togglePasswordVisibility = (field) => {
        setShowPassword(prev => ({...prev, [field]: !prev[field]}));
    };

    const getConnectionTypeIcon = (platform) => {
        if (platform.authType === 'manual') return Link;
        if (platform.authType === 'apiKey') return Cpu;
        return Bot;
    };

    const getPlatformCapabilities = (platform) => {
        const capabilities = [];

        if (isAutomated(platform)) {
            capabilities.push({
                icon: Bot,
                label: 'Automatisierung',
                description: 'Vollautomatische Profil-Synchronisation'
            });
        }

        if (isApiBased(platform)) {
            capabilities.push({
                icon: Cpu,
                label: 'API-Zugriff',
                description: 'Direkte Plattform-Integration'
            });
        }

        if (platform.features?.includes('photos')) {
            capabilities.push({
                icon: Image,
                label: 'Foto-Upload',
                description: 'Automatischer Setcard-Upload'
            });
        }

        if (platform.features?.includes('availability')) {
            capabilities.push({
                icon: Calendar,
                label: 'Verfügbarkeit',
                description: 'Kalender-Synchronisation'
            });
        }

        return capabilities;
    };

    if (loading) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256}}>
                <CircularProgress size={48}/>
            </Box>
        );
    }

    const connectedPlatforms = platforms.filter(p => p.connected);
    const disconnectedPlatforms = platforms.filter(p => !p.connected);
    const agentPlatforms = platforms.filter(isAutomated);
    const apiPlatforms = platforms.filter(isApiBased);

    return (
        <Stack gap={3}>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
                    <Typography variant="h4" component="h1" fontWeight={700}>Plattformen</Typography>
                    <Badge color="blue">
                        {connectedPlatforms.length} von {platforms.length} verbunden
                    </Badge>
                    <Badge color={agentStatus?.success ? 'green' : 'red'} icon={Bot}>
                        Agent: {agentStatus?.status || 'Unbekannt'}
                    </Badge>
                </Stack>
                <Stack direction="row" gap={1.5}>
                    <Button onClick={checkAgentHealth} variant="outline" icon={Activity} size="sm">
                        Agent prüfen
                    </Button>
                    {bulkSyncSelected.length > 0 && (
                        <Button
                            onClick={handleBulkSync}
                            disabled={syncing}
                            icon={syncing ? Loader : RefreshCw}
                            variant="outline"
                        >
                            {syncing ? 'Synchronisiere...' : `${bulkSyncSelected.length} Plattformen sync`}
                        </Button>
                    )}
                </Stack>
            </Stack>

            {/* Agent status */}
            {agentStatus && (
                <Card className={agentStatus.success ? undefined : undefined}>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                            borderLeft: 4,
                            borderColor: agentStatus.success ? 'success.main' : 'error.main',
                            bgcolor: agentStatus.success ? 'success.50' : 'error.50',
                            borderRadius: 1,
                            p: 2
                        }}
                    >
                        <Stack direction="row" alignItems="center" gap={2}>
                            <Box sx={{color: agentStatus.success ? 'success.main' : 'error.main', display: 'flex'}}>
                                <Bot size={32}/>
                            </Box>
                            <Box>
                                <Typography fontWeight={600}>Platform Agent Status</Typography>
                                <Typography variant="body2" color="text.secondary">{agentStatus.message}</Typography>
                                <Stack
                                    direction="row" gap={2} mt={0.5} flexWrap="wrap"
                                    sx={{fontSize: 12, color: 'text.secondary'}}
                                >
                                    <span>Agent-fähige Plattformen: {agentStatus.data?.automatedPlatforms ?? agentPlatforms.length}</span>
                                    <span>API-Plattformen: {apiPlatforms.length}</span>
                                    {/* The one thing this endpoint can actually
                                        verify: that the browser binary exists.
                                        It says nothing about a sync succeeding. */}
                                    <span>Browser: {agentStatus.data?.browserAvailable ? 'verfügbar' : 'nicht verfügbar'}</span>
                                    <span>Letzte Prüfung: {agentStatus.timestamp
                                        ? new Date(agentStatus.timestamp).toLocaleString('de-DE')
                                        : 'unbekannt'}</span>
                                </Stack>
                            </Box>
                        </Stack>
                        <Box sx={{color: agentStatus.success ? 'success.main' : 'error.main', display: 'flex'}}>
                            {agentStatus.success ? <CheckCircle size={24}/> : <XCircle size={24}/>}
                        </Box>
                    </Stack>
                </Card>
            )}

            {/* Summary tiles */}
            <Box sx={columns({xs: 1, md: 5})}>
                {[
                    {value: connectedPlatforms.length, label: 'Verbunden', icon: Wifi, color: 'success.main'},
                    {value: agentPlatforms.length, label: 'Agent-fähig', icon: Bot, color: 'primary.main'},
                    {value: apiPlatforms.length, label: 'API verfügbar', icon: Cpu, color: 'secondary.main'},
                    {
                        value: connectedPlatforms.filter(p => p.syncSettings?.autoSync).length,
                        label: 'Auto-Sync', icon: Zap, color: 'warning.main'
                    },
                    {
                        value: connectedPlatforms.filter(p => p.lastSync
                            && new Date() - new Date(p.lastSync) < 24 * 60 * 60 * 1000).length,
                        label: 'Heute sync', icon: Activity, color: 'info.main'
                    }
                ].map((tile) => (
                    <Card key={tile.label}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Typography variant="h5" fontWeight={700} sx={{color: tile.color}}>
                                    {tile.value}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">{tile.label}</Typography>
                            </Box>
                            <Box sx={{color: tile.color, display: 'flex'}}>
                                <tile.icon size={32}/>
                            </Box>
                        </Stack>
                    </Card>
                ))}
            </Box>

            {/* Connected Platforms */}
            {connectedPlatforms.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900">Verbundene Plattformen</h2>
                    <div className="space-y-3">
                        {connectedPlatforms.map(platform => {
                            const ConnectionTypeIcon = getConnectionTypeIcon(platform);
                            const statusColor = platformStatusColor(platform);
                            const isExpanded = expandedPlatform === platform.id;
                            const testResult = testResults[platform.id];
                            const importResult = importResults[platform.id];
                            const capabilities = getPlatformCapabilities(platform);

                            return (
                                <Card key={platform.id} className="overflow-hidden">
                                    <div className="flex items-center justify-between p-6">
                                        <div className="flex items-center space-x-4">
                                            <input
                                                type="checkbox"
                                                checked={bulkSyncSelected.includes(platform.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setBulkSyncSelected([...bulkSyncSelected, platform.id]);
                                                    } else {
                                                        setBulkSyncSelected(bulkSyncSelected.filter(id => id !== platform.id));
                                                    }
                                                }}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="flex items-center space-x-3">
                                                <ConnectionTypeIcon className="w-8 h-8 text-gray-600"/>
                                                <div>
                                                    <div className="flex items-center space-x-2">
                                                        <h3 className="font-semibold text-gray-900">{platform.name}</h3>
                                                        <Badge color="blue" size="sm">
                                                            {connectionTypeText(platform)}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                                                        <Badge color={statusColor}>
                                                            {platform.connected ? 'Verbunden' : 'Getrennt'}
                                                        </Badge>
                                                        {platform.lastSync && (
                                                            <span className="flex items-center space-x-1">
                                                                <Clock size={12}/>
                                                                <span>
                                                                    Sync: {new Date(platform.lastSync).toLocaleString('de-DE')}
                                                                </span>
                                                            </span>
                                                        )}
                                                        <div className="flex space-x-1">
                                                            {capabilities.slice(0, 3).map((cap, idx) => (
                                                                <cap.icon key={idx} size={12} className="text-gray-400" title={cap.description}/>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            {testResult && (
                                                /* Three outcomes, not two. A platform the app does not
                                                   log into - the agencies, and Backstage with its Google
                                                   sign-in - answers ok without anything having been
                                                   verified, and a green "Test OK" there would claim a
                                                   login that never happened. */
                                                <Badge
                                                    color={!testResult.success ? 'red'
                                                        : (testResult.verified ? 'green' : 'gray')}
                                                    size="sm"
                                                    title={[testResult.message,
                                                        testResult.finalUrl && `Endete auf: ${testResult.finalUrl}`,
                                                        testResult.errorType]
                                                        .filter(Boolean).join(String.fromCharCode(10))}
                                                >
                                                    {!testResult.success ? 'Test fehlgeschlagen'
                                                        : (testResult.verified ? 'Test OK' : 'Nicht prüfbar')}
                                                </Badge>
                                            )}
                                            {importResult && (
                                                <Badge color="green" size="sm" icon={Download}>
                                                    Importiert
                                                </Badge>
                                            )}
                                            {canImportProfile(platform) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleImportProfile(platform)}
                                                    disabled={syncing || importing}
                                                    icon={importing ? Loader : Download}
                                                    title="Profil von Plattform importieren"
                                                >
                                                    {importing ? 'Lese...' : 'Import'}
                                                </Button>
                                            )}
                                            {canSyncCredits(platform) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleSyncCredits(platform)}
                                                    disabled={syncing || importing || creditBusy}
                                                    icon={creditBusy ? Loader : Upload}
                                                    title="Fehlende Credits auf die Plattform übertragen"
                                                >
                                                    {creditBusy ? 'Gleicht ab...' : 'Vita'}
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleTestConnection(platform)}
                                                disabled={syncing}
                                                icon={syncing ? Loader : Activity}
                                            >
                                                Test
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleSyncToPlatform(platform)}
                                                disabled={syncing}
                                                icon={syncing ? Loader : Upload}
                                            >
                                                Sync
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openModal('settings', platform)}
                                                icon={Settings}
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setExpandedPlatform(isExpanded ? null : platform.id)}
                                                icon={isExpanded ? ChevronDown : ChevronRight}
                                            />
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => handleDisconnect(platform)}
                                                icon={X}
                                            />
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t bg-gray-50 p-6 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                                                        <Settings size={16}/>
                                                        <span>Konfiguration</span>
                                                    </h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Verbindungstyp:</span>
                                                            <Badge color="blue" size="sm">
                                                                {connectionTypeText(platform)}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Auto-Sync:</span>
                                                            <span className={platform.syncSettings?.autoSync ? 'text-green-600' : 'text-red-600'}>
                                                                {platform.syncSettings?.autoSync ? 'An' : 'Aus'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Intervall:</span>
                                                            <span>{syncIntervalText(platform.syncSettings?.syncInterval)}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Regionen:</span>
                                                            <span>{platform.regions?.join(', ') || 'Global'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                                                        <Zap size={16}/>
                                                        <span>Fähigkeiten</span>
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {capabilities.length > 0 ? capabilities.map((cap, idx) => (
                                                            <div key={idx} className="flex items-center space-x-2 text-sm">
                                                                <cap.icon size={14} className="text-blue-600"/>
                                                                <span className="font-medium">{cap.label}</span>
                                                            </div>
                                                        )) : (
                                                            <span className="text-sm text-gray-500">Standard-Features</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                                                        <Activity size={16}/>
                                                        <span>Status</span>
                                                    </h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Verbunden seit:</span>
                                                            <span>{platform.lastSync ?
                                                                new Date(platform.lastSync).toLocaleDateString('de-DE') : 'Unbekannt'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Letzte Sync:</span>
                                                            <span>{platform.lastSync ?
                                                                new Date(platform.lastSync).toLocaleString('de-DE') : 'Nie'}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Letzter Test:</span>
                                                            <span>{(testResult?.lastTested || platform.lastTested) ?
                                                                new Date(testResult?.lastTested || platform.lastTested).toLocaleString('de-DE') : 'Nie'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {platform.description && (
                                                <div className="pt-4 border-t">
                                                    <p className="text-sm text-gray-600 italic">
                                                        {platform.description}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Available Platforms */}
            {disconnectedPlatforms.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900">Verfügbare Plattformen</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {disconnectedPlatforms.map(platform => {
                            const ConnectionTypeIcon = getConnectionTypeIcon(platform);
                            const capabilities = getPlatformCapabilities(platform);

                            return (
                                <Card key={platform.id} className="hover:shadow-lg transition-shadow">
                                    <div className="p-6">
                                        <div className="flex items-center space-x-3 mb-4">
                                            <ConnectionTypeIcon className="w-10 h-10 text-gray-600"/>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{platform.name}</h3>
                                                <div className="flex items-center space-x-2">
                                                    <Badge variant="outline" color="gray">Nicht verbunden</Badge>
                                                    <Badge color={isApiBased(platform) ? 'purple' : 'blue'} size="sm">
                                                        {connectionTypeText(platform)}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {capabilities.slice(0, 4).map((cap, idx) => (
                                                    <Badge key={idx} size="sm" variant="outline" icon={cap.icon}>
                                                        {cap.label}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                {platform.regions?.length ? `Regionen: ${platform.regions.join(', ')}` : 'Global verfügbar'}
                                            </p>
                                        </div>

                                        <p className="text-sm text-gray-600 mb-4">
                                            {platform.description || 'Professionelle Casting-Plattform'}
                                        </p>

                                        {/* A platform whose credentials were rejected still has
                                            those credentials stored. Showing why it failed, and
                                            letting it be retried without retyping the password, is
                                            the whole point of a test - the connected list is the
                                            one place it is not needed. */}
                                        {(() => {
                                            const failed = testResults[platform.id] || (platform.testResult?.success === false
                                                ? {
                                                    success: false,
                                                    message: platform.testResult.message,
                                                    finalUrl: platform.testResult.url,
                                                    errorType: platform.testResult.errorType
                                                }
                                                : null);
                                            if (!failed || failed.success) return null;
                                            return (
                                                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
                                                    <p className="text-xs text-red-900 break-words">
                                                        <AlertTriangle size={12} className="inline mr-1"/>
                                                        {failed.message}
                                                    </p>
                                                    {failed.finalUrl && (
                                                        <p className="text-[10px] text-red-700 mt-1 break-all">
                                                            Endete auf: {failed.finalUrl}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        <div className="flex space-x-2">
                                            <Button
                                                size="sm"
                                                onClick={() => openModal('connect', platform)}
                                                disabled={saving}
                                                icon={saving ? Loader : Plus}
                                            >
                                                {hasStoredCredentials(platform) ? 'Zugangsdaten ändern' : 'Verbinden'}
                                            </Button>
                                            {hasStoredCredentials(platform) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleTestConnection(platform)}
                                                    disabled={syncing}
                                                    icon={syncing ? Loader : Activity}
                                                    title="Die gespeicherten Zugangsdaten erneut versuchen"
                                                >
                                                    Test
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Connection Modal */}
            <Modal
                isOpen={showModal && modalType === 'connect'}
                onClose={() => setShowModal(false)}
                title={`Verbindung zu ${selectedPlatform?.name}`}
            >
                <div className="space-y-4">
                    {/* The reason the platform refused, kept on the dialog. The
                        credentials are stored either way, so this is a retry, not
                        a fresh start - and a rejected password usually just needs
                        correcting in the field below. */}
                    {connectError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-900 whitespace-pre-line break-words">
                                <AlertTriangle size={14} className="inline mr-1"/>
                                {connectError}
                            </p>
                        </div>
                    )}
                    {isAutomated(selectedPlatform) && (
                        <div className="p-4 bg-blue-50 rounded-lg flex items-start space-x-3">
                            <Bot className="w-6 h-6 text-blue-600 mt-1"/>
                            <div>
                                <h3 className="font-semibold text-blue-900 mb-1">Agent-basierte Verbindung</h3>
                                <p className="text-sm text-blue-700">
                                    Diese Plattform verwendet einen automatisierten Agent für die Synchronisation.
                                    Ihre Anmeldedaten werden sicher verschlüsselt gespeichert und nur für die
                                    Synchronisation verwendet.
                                </p>
                            </div>
                        </div>
                    )}

                    {selectedPlatform?.authType === 'manual' ? (
                        <div className="text-center space-y-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <Shield className="w-12 h-12 text-gray-500 mx-auto mb-2"/>
                                <h3 className="font-semibold text-gray-900 mb-1">Manuelle Verwaltung</h3>
                                <p className="text-sm text-gray-600">
                                    Für {selectedPlatform.name} gibt es keine automatische Anbindung.
                                    Die Pflege erfolgt direkt bei der Agentur.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Rendered from the connector manifest, so the form always
                                matches what the platform actually asks for. */}
                            {(selectedPlatform?.credentialFields || []).map((field) => (
                                <div className="relative" key={field.name}>
                                    <Input
                                        label={field.label || field.name}
                                        type={field.type === 'password' && !showPassword[field.name] ? 'password' : (field.type === 'email' ? 'email' : 'text')}
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                                        placeholder={field.label || field.name}
                                    />
                                    {field.type === 'password' && (
                                        <button
                                            type="button"
                                            onClick={() => togglePasswordVisibility(field.name)}
                                            className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword[field.name] ? <EyeOff size={16}/> : <Eye size={16}/>}
                                        </button>
                                    )}
                                </div>
                            ))}
                            <div className="p-3 bg-gray-50 rounded text-xs text-gray-600">
                                <Shield size={14} className="inline mr-1"/>
                                Ihre Anmeldedaten werden verschlüsselt gespeichert und nur für die Synchronisation verwendet.
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={handleConnect}
                            disabled={saving}
                            icon={saving ? Loader : Check}
                        >
                            {saving ? 'Verbinde...' : 'Verbinden'}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => setShowModal(false)}
                            icon={X}
                        >
                            Abbrechen
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Settings Modal */}
            <Modal
                isOpen={showModal && modalType === 'settings'}
                onClose={() => setShowModal(false)}
                title={`Einstellungen für ${selectedPlatform?.name}`}
            >
                <div className="space-y-4">
                    {isAutomated(selectedPlatform) && (
                        <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                            <Bot size={16} className="inline mr-2"/>
                            Agent-basierte Plattform mit erweiterten Synchronisationsoptionen
                        </div>
                    )}

                    <div>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={formData.autoSync || false}
                                onChange={(e) => handleInputChange('autoSync', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Automatische Synchronisation</span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sync-Intervall</label>
                        <select
                            value={formData.syncInterval || 'daily'}
                            onChange={(e) => handleInputChange('syncInterval', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {isAutomated(selectedPlatform) && <option value="realtime">Echtzeit (Agent)</option>}
                            <option value="hourly">Stündlich</option>
                            <option value="daily">Täglich</option>
                            <option value="weekly">Wöchentlich</option>
                            <option value="manual">Manuell</option>
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={formData.syncAvailability !== false}
                                onChange={(e) => handleInputChange('syncAvailability', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Verfügbarkeit synchronisieren</span>
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={handleUpdateSettings}
                            disabled={saving}
                            icon={saving ? Loader : Check}
                        >
                            {saving ? 'Speichere...' : 'Speichern'}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => setShowModal(false)}
                            icon={X}
                        >
                            Abbrechen
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Credits the platform could not be told apart from its own. */}
            <Modal
                isOpen={showModal && modalType === 'credits'}
                onClose={() => setShowModal(false)}
                title={`Vita-Abgleich mit ${selectedPlatform?.name}`}
            >
                <div className="space-y-4">
                    {creditSummary && (
                        <div className="p-3 bg-blue-50 rounded text-xs text-blue-900">
                            <AlertCircle size={14} className="inline mr-1"/>
                            {creditSummary}
                        </div>
                    )}

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-3">
                        <p className="text-xs text-amber-900">
                            <AlertTriangle size={14} className="inline mr-1"/>
                            Diese Einträge ähneln Credits, die {selectedPlatform?.name} bereits
                            hat. Ob es derselbe Job ist, kann nur entschieden werden - eine
                            Folgennummer kann der Unterschied zwischen zwei Engagements sein.
                            Ohne Auswahl wird nichts übertragen und nichts gelöscht.
                        </p>

                        {creditQuestions.map((question) => (
                            <div key={question.path} className="space-y-1 border-t border-amber-200 pt-2">
                                <p className="text-xs text-gray-900">
                                    <strong>
                                        {question.from ? `Aus ${question.from}:` : 'Ihr Eintrag:'}
                                    </strong> {question.credit}
                                </p>
                                <select
                                    className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                                    value={creditAnswers[question.path] || ''}
                                    onChange={(e) => setCreditAnswers(prev => ({
                                        ...prev, [question.path]: e.target.value
                                    }))}
                                >
                                    <option value="">nichts tun</option>
                                    {question.options.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.value === '__add__'
                                                ? option.label
                                                : `Derselbe Credit wie${option.onPlatform ? ` auf ${option.onPlatform}` : ''}: ${option.label}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowModal(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={() => handleSyncCredits(selectedPlatform, creditAnswers)}
                            disabled={creditBusy || Object.values(creditAnswers).every((a) => !a)}
                            icon={creditBusy ? Loader : Upload}
                        >
                            {creditBusy ? 'Überträgt...' : 'Auswahl übertragen'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Import Modal: what the platform returned, and what to keep. */}
            <Modal
                isOpen={showModal && modalType === 'import'}
                onClose={() => setShowModal(false)}
                title={`Import von ${selectedPlatform?.name}`}
            >
                {(() => {
                    const result = importResults[selectedPlatform?.id];
                    const fields = result?.fields || {};
                    const keys = Object.keys(fields);

                    if (keys.length === 0) {
                        return (
                            <p className="text-sm text-gray-600">
                                Es konnten keine Felder gelesen werden.
                            </p>
                        );
                    }

                    return (
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-50 rounded text-xs text-blue-900">
                                <AlertCircle size={14} className="inline mr-1"/>
                                Ausgewählte Felder überschreiben die entsprechenden Werte in Ihrem
                                Profil. Nicht ausgewählte Felder bleiben unverändert.
                            </div>

                            {result.unmapped?.length > 0 && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-3">
                                    <p className="text-xs text-amber-900">
                                        <AlertTriangle size={14} className="inline mr-1"/>
                                        Diese Werte von {selectedPlatform?.name} lassen sich keinem
                                        Wert dieser App zuordnen. Bitte auswählen - ohne Auswahl
                                        werden sie nicht übernommen.
                                    </p>
                                    {result.unmapped.map((question) => (
                                        <div key={question.path} className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs text-gray-700 min-w-0">
                                                <strong>{IMPORT_FIELD_LABELS[question.field] || question.field}</strong>
                                                {question.context ? ` (${question.context})` : ''}: „{String(question.value)}"
                                            </span>
                                            <select
                                                className="text-xs border border-gray-300 rounded px-2 py-1"
                                                value={importResolutions[question.path] || ''}
                                                onChange={(e) => setImportResolutions(prev => ({
                                                    ...prev, [question.path]: e.target.value
                                                }))}
                                            >
                                                <option value="">nicht übernehmen</option>
                                                {question.options.map((option) => (
                                                    <option key={option} value={option}>{option}</option>
                                                ))}
                                                <option value="__keep__">Original übernehmen</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="divide-y divide-gray-100">
                                {keys.map((key) => (
                                    <label key={key} className="flex items-start gap-3 py-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="mt-1"
                                            checked={importSelection.includes(key)}
                                            onChange={() => toggleImportField(key)}
                                        />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium text-gray-900">
                                                {IMPORT_FIELD_LABELS[key] || key}
                                            </span>
                                            <span className="block text-xs text-gray-600 break-words">
                                                {previewImported(fields[key])}
                                            </span>
                                            {result.sources?.[key] && (
                                                <span className="block text-[10px] text-gray-400">
                                                    {/* The connector reports where on its own site a
                                                        value sat; the platform name is stamped on by
                                                        the server, because a locator like
                                                        "graphql:profileExperienceRepeater" does not
                                                        say which site it belongs to. */}
                                                    Quelle: {sourceLabel(result.sources[key])}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {result.missing?.length > 0 && (
                                <p className="text-xs text-gray-500">
                                    Auf der Plattform leer oder nicht gefunden: {result.missing.join(', ')}
                                </p>
                            )}

                            <div className="flex space-x-3 pt-2">
                                <Button
                                    onClick={handleApplyImport}
                                    disabled={importing || importSelection.length === 0}
                                    icon={importing ? Loader : Check}
                                >
                                    {importing ? 'Übernehme...' : `${importSelection.length} Feld(er) übernehmen`}
                                </Button>
                                <Button variant="secondary" onClick={() => setShowModal(false)} icon={X}>
                                    Abbrechen
                                </Button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>
        </Stack>
    );
};

export default PlatformsView;