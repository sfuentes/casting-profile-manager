
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
    importFieldLabel,
    capabilityLabels
} from '../domain/platforms';
import {useAgentHealth} from '../hooks/useAgentHealth';
import {usePlatformImport} from '../hooks/usePlatformImport';
import {usePlatformCredits} from '../hooks/usePlatformCredits';

/** A "label: value" row in the expanded platform panel. */
const DetailRow = (props) => (
    <Stack direction="row" spacing={1} sx={{alignItems: 'center', justifyContent: 'space-between'}}>
        <Box component="span" sx={{color: 'text.secondary'}}>{props.label}</Box>
        <Box component="span">{props.children}</Box>
    </Stack>
);

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
        <Stack spacing={3}>
            {/* Header */}
            <Stack direction="row" spacing={2} sx={{alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                <Stack direction="row" spacing={2} sx={{alignItems: 'center', flexWrap: 'wrap'}}>
                    <Typography variant="h4" component="h1" fontWeight={700}>Plattformen</Typography>
                    <Badge color="blue">
                        {connectedPlatforms.length} von {platforms.length} verbunden
                    </Badge>
                    <Badge color={agentStatus?.success ? 'green' : 'red'} icon={Bot}>
                        {/* `status` is the backend's own word - "healthy". Next to
                            "4 von 14 verbunden" in German it read as a leftover. */}
                        Agent: {agentStatus?.success ? 'bereit' : 'nicht erreichbar'}
                    </Badge>
                </Stack>
                <Stack direction="row" spacing={1.5}>
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
                <Card>
                    <Stack
                        direction="row"
                        sx={{alignItems: 'center', justifyContent: 'space-between', borderLeft: 4,
                            borderColor: agentStatus.success ? 'success.main' : 'error.main',
                            bgcolor: agentStatus.success ? 'success.50' : 'error.50',
                            borderRadius: 1,
                            p: 2}}
                    >
                        <Stack direction="row" spacing={2} sx={{alignItems: 'center'}}>
                            <Box sx={{color: agentStatus.success ? 'success.main' : 'error.main', display: 'flex'}}>
                                <Bot size={32}/>
                            </Box>
                            <Box>
                                <Typography fontWeight={600}>Status des Sync-Agenten</Typography>
                                {/* The backend writes this message in English. It is the
                                    only sentence on the screen that is not German, so it
                                    is shown only when it says something the four counts
                                    below do not already say. */}
                                <Typography variant="body2" color="text.secondary">
                                    {agentStatus.success
                                        ? 'Der Agent läuft und kann Plattformen ansteuern.'
                                        : agentStatus.message}
                                </Typography>
                                <Stack
                                    direction="row" spacing={2}
                                    sx={{mt: 0.5, flexWrap: 'wrap', fontSize: 12, color: 'text.secondary'}}
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
                        <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
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

            {/* Connected platforms */}
            {connectedPlatforms.length > 0 && (
                <Stack spacing={2}>
                    <Typography variant="h6" fontWeight={600}>Verbundene Plattformen</Typography>
                    <Stack spacing={1.5}>
                        {connectedPlatforms.map(platform => {
                            const ConnectionTypeIcon = getConnectionTypeIcon(platform);
                            const capabilities = capabilityLabels(platform);
                            const statusColor = platformStatusColor(platform);
                            const isExpanded = expandedPlatform === platform.id;
                            const testResult = testResults[platform.id];
                            const importResult = importResults[platform.id];

                            return (
                                <Card key={platform.id}>
                                    <Stack
                                        direction="row"
                                        spacing={2} sx={{alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', p: 2}}
                                    >
                                        <Stack direction="row" spacing={2} sx={{alignItems: 'center'}}>
                                            <Checkbox
                                                checked={bulkSyncSelected.includes(platform.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setBulkSyncSelected([...bulkSyncSelected, platform.id]);
                                                    } else {
                                                        setBulkSyncSelected(bulkSyncSelected.filter(id => id !== platform.id));
                                                    }
                                                }}
                                            />
                                            <Stack direction="row" spacing={1.5} sx={{alignItems: 'center'}}>
                                                <Box sx={{color: 'text.secondary', display: 'flex'}}>
                                                    <ConnectionTypeIcon size={32}/>
                                                </Box>
                                                <Box>
                                                    <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
                                                        <Typography fontWeight={600}>{platform.name}</Typography>
                                                        <Badge color="blue" size="sm">
                                                            {connectionTypeText(platform)}
                                                        </Badge>
                                                    </Stack>
                                                    <Stack
                                                        direction="row" spacing={1}
                                                        sx={{alignItems: 'center', flexWrap: 'wrap', fontSize: 14, color: 'text.secondary'}}
                                                    >
                                                        {/*
                                                          The badge used to read "Verbunden"
                                                          in green or in yellow, and only the
                                                          colour said which - yellow meaning
                                                          the last sync is more than a week
                                                          old. It says so now. The `: 'Getrennt'`
                                                          half was unreachable: this list is
                                                          the connected platforms.
                                                        */}
                                                        <Badge color={statusColor}>
                                                            {statusColor === 'yellow' ? 'Sync veraltet' : 'Verbunden'}
                                                        </Badge>
                                                        <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
                                                            <Clock size={12}/>
                                                            <span>
                                                                {platform.lastSync
                                                                    ? `Sync: ${new Date(platform.lastSync).toLocaleString('de-DE')}`
                                                                    : 'Noch nie synchronisiert'}
                                                            </span>
                                                        </Stack>
                                                    </Stack>
                                                </Box>
                                            </Stack>
                                        </Stack>

                                        <Stack direction="row" spacing={1} sx={{alignItems: 'center', flexWrap: 'wrap'}}>
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
                                                <Badge color="green" size="sm" icon={Download}>Importiert</Badge>
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
                                                size="sm" variant="outline"
                                                onClick={() => handleTestConnection(platform)}
                                                disabled={syncing}
                                                icon={syncing ? Loader : Activity}
                                            >
                                                Test
                                            </Button>
                                            <Button
                                                size="sm" variant="outline"
                                                onClick={() => handleSyncToPlatform(platform)}
                                                disabled={syncing}
                                                icon={syncing ? Loader : Upload}
                                            >
                                                Sync
                                            </Button>
                                            <Button
                                                size="sm" variant="outline"
                                                onClick={() => openModal('settings', platform)}
                                                icon={Settings}
                                                title="Einstellungen"
                                            />
                                            <Button
                                                size="sm" variant="outline"
                                                onClick={() => setExpandedPlatform(isExpanded ? null : platform.id)}
                                                icon={isExpanded ? ChevronDown : ChevronRight}
                                                title={isExpanded ? 'Zuklappen' : 'Aufklappen'}
                                            />
                                            <Button
                                                size="sm" variant="danger"
                                                onClick={() => handleDisconnect(platform)}
                                                icon={X}
                                                title="Verbindung trennen"
                                            />
                                        </Stack>
                                    </Stack>

                                    {isExpanded && (
                                        <Stack spacing={2} sx={{borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50', p: 3}}>
                                            <Box sx={columns({xs: 1, md: 3})}>
                                                <Box>
                                                    <Stack direction="row" spacing={1} sx={{mb: 1.5, alignItems: 'center'}}>
                                                        <Settings size={16}/>
                                                        <Typography fontWeight={500}>Konfiguration</Typography>
                                                    </Stack>
                                                    <Stack spacing={1} sx={{fontSize: 14}}>
                                                        <DetailRow label="Verbindungstyp:">
                                                            <Badge color="blue" size="sm">{connectionTypeText(platform)}</Badge>
                                                        </DetailRow>
                                                        <DetailRow label="Auto-Sync:">
                                                            <Box
                                                                component="span"
                                                                sx={{color: platform.syncSettings?.autoSync ? 'success.main' : 'error.main'}}
                                                            >
                                                                {platform.syncSettings?.autoSync ? 'An' : 'Aus'}
                                                            </Box>
                                                        </DetailRow>
                                                        <DetailRow label="Intervall:">
                                                            {syncIntervalText(platform.syncSettings?.syncInterval)}
                                                        </DetailRow>
                                                    </Stack>
                                                </Box>

                                                <Box>
                                                    <Stack direction="row" spacing={1} sx={{mb: 1.5, alignItems: 'center'}}>
                                                        <Zap size={16}/>
                                                        <Typography fontWeight={500}>Fähigkeiten</Typography>
                                                    </Stack>
                                                    <Stack spacing={1}>
                                                        {capabilities.length > 0 ? capabilities.map((label) => (
                                                            <Stack key={label} direction="row" spacing={1} sx={{alignItems: 'center', fontSize: 14}}>
                                                                <Box sx={{color: 'success.main', display: 'flex'}}>
                                                                    <Check size={14}/>
                                                                </Box>
                                                                <Box component="span" sx={{fontWeight: 500}}>{label}</Box>
                                                            </Stack>
                                                        )) : (
                                                            <Typography variant="body2" color="text.secondary">
                                                                Für diese Plattform ist noch nichts automatisiert.
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </Box>

                                                <Box>
                                                    <Stack direction="row" spacing={1} sx={{mb: 1.5, alignItems: 'center'}}>
                                                        <Activity size={16}/>
                                                        <Typography fontWeight={500}>Status</Typography>
                                                    </Stack>
                                                    <Stack spacing={1} sx={{fontSize: 14}}>
                                                        <DetailRow label="Verbunden seit:">
                                                            {platform.lastSync
                                                                ? new Date(platform.lastSync).toLocaleDateString('de-DE') : 'Unbekannt'}
                                                        </DetailRow>
                                                        <DetailRow label="Letzte Sync:">
                                                            {platform.lastSync
                                                                ? new Date(platform.lastSync).toLocaleString('de-DE') : 'Nie'}
                                                        </DetailRow>
                                                        <DetailRow label="Letzter Test:">
                                                            {(testResult?.lastTested || platform.lastTested)
                                                                ? new Date(testResult?.lastTested || platform.lastTested).toLocaleString('de-DE')
                                                                : 'Nie'}
                                                        </DetailRow>
                                                    </Stack>
                                                </Box>
                                            </Box>

                                            {platform.description && (
                                                <Box sx={{pt: 2, borderTop: 1, borderColor: 'divider'}}>
                                                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                                        {platform.description}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Stack>
                                    )}
                                </Card>
                            );
                        })}
                    </Stack>
                </Stack>
            )}

            {/* Available platforms */}
            {disconnectedPlatforms.length > 0 && (
                <Stack spacing={2}>
                    <Typography variant="h6" fontWeight={600}>Verfügbare Plattformen</Typography>
                    <Box sx={columns({xs: 1, md: 2, lg: 3})}>
                        {disconnectedPlatforms.map(platform => {
                            const ConnectionTypeIcon = getConnectionTypeIcon(platform);
                            // A platform whose credentials were rejected still has those
                            // credentials stored. Showing why it failed, and letting it be
                            // retried without retyping the password, is the whole point of a
                            // test - the connected list is the one place it is not needed.
                            const failed = testResults[platform.id] || (platform.testResult?.success === false
                                ? {
                                    success: false,
                                    message: platform.testResult.message,
                                    finalUrl: platform.testResult.url,
                                    errorType: platform.testResult.errorType
                                }
                                : null);

                            // `height: 100%` and a column layout with the button pushed
                            // down by `mt: 'auto'`: the cards sit in a grid, and one name
                            // that wraps to two lines ("Casting Networks (international)")
                            // used to make its whole row ragged, with every Verbinden
                            // button at a different height. The icon aligns to the top of
                            // the text rather than to the middle of it, so a one-line and
                            // a two-line card still start on the same line.
                            return (
                                <Card
                                    key={platform.id}
                                    sx={{
                                        height: '100%', transition: 'box-shadow 200ms',
                                        '&:hover': {boxShadow: 6}
                                    }}
                                >
                                    <Box sx={{p: 2, height: '100%', display: 'flex', flexDirection: 'column'}}>
                                        <Stack direction="row" spacing={1.5} sx={{mb: 2, alignItems: 'flex-start'}}>
                                            <Box sx={{color: 'text.secondary', display: 'flex', mt: 0.25}}>
                                                <ConnectionTypeIcon size={32}/>
                                            </Box>
                                            <Box sx={{minWidth: 0}}>
                                                <Typography fontWeight={600}>{platform.name}</Typography>
                                                <Stack
                                                    direction="row" spacing={1}
                                                    sx={{mt: 0.75, alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75}}
                                                >
                                                    <Badge color={isApiBased(platform) ? 'purple' : 'blue'} size="sm">
                                                        {connectionTypeText(platform)}
                                                    </Badge>
                                                    {hasStoredCredentials(platform) && (
                                                        <Badge variant="outline" color="gray" size="sm">
                                                            Zugangsdaten gespeichert
                                                        </Badge>
                                                    )}
                                                </Stack>
                                            </Box>
                                        </Stack>

                                        {/*
                                          Three lines used to sit here and all three were
                                          invented. The API sends a platform as id, name,
                                          authType, connected and syncSettings - there is no
                                          `description`, no `regions`, no `features`. So
                                          `platform.description || 'Professionelle
                                          Casting-Plattform'` printed that fallback on every
                                          card, `regions?.length ? ... : 'Global verfügbar'`
                                          printed the fallback on every card, and the
                                          capability badges came out as "Automatisierung" on
                                          every browser-driven platform - which is all of
                                          them. Ten cards, identical, asserting things nobody
                                          established. What is actually known about an
                                          unconnected platform is its name and how it logs
                                          in, and that is what the header above shows.
                                        */}
                                        {failed && !failed.success && (
                                            <Alert severity="error" sx={{mb: 1.5, py: 0.5}}>
                                                <Typography variant="caption" sx={{wordBreak: 'break-word'}}>
                                                    {failed.message}
                                                </Typography>
                                                {failed.finalUrl && (
                                                    <Typography
                                                        variant="caption"
                                                        display="block"
                                                        sx={{mt: 0.5, wordBreak: 'break-all', opacity: 0.8}}
                                                    >
                                                        Endete auf: {failed.finalUrl}
                                                    </Typography>
                                                )}
                                            </Alert>
                                        )}

                                        <Stack direction="row" spacing={1} sx={{mt: 'auto', pt: 1}}>
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
                                        </Stack>
                                    </Box>
                                </Card>
                            );
                        })}
                    </Box>
                </Stack>
            )}

            {/* Connection dialog */}
            <Modal
                isOpen={showModal && modalType === 'connect'}
                onClose={() => setShowModal(false)}
                title={`Verbindung zu ${selectedPlatform?.name}`}
            >
                <Stack spacing={2}>
                    {/* The reason the platform refused, kept on the dialog. The
                        credentials are stored either way, so this is a retry, not
                        a fresh start - and a rejected password usually just needs
                        correcting in the field below. */}
                    {connectError && (
                        <Alert severity="error" sx={{whiteSpace: 'pre-line', wordBreak: 'break-word'}}>
                            {connectError}
                        </Alert>
                    )}

                    {isAutomated(selectedPlatform) && (
                        <Alert severity="info" icon={<Bot size={20}/>}>
                            <AlertTitle>Agent-basierte Verbindung</AlertTitle>
                            Diese Plattform verwendet einen automatisierten Agent für die Synchronisation.
                            Ihre Anmeldedaten werden sicher verschlüsselt gespeichert und nur für die
                            Synchronisation verwendet.
                        </Alert>
                    )}

                    {selectedPlatform?.authType === 'manual' ? (
                        <Box sx={{textAlign: 'center', bgcolor: 'grey.50', borderRadius: 2, p: 2}}>
                            <Box sx={{color: 'text.secondary', display: 'flex', justifyContent: 'center', mb: 1}}>
                                <Shield size={48}/>
                            </Box>
                            <Typography fontWeight={600} sx={{mb: 0.5}}>Manuelle Verwaltung</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Für {selectedPlatform.name} gibt es keine automatische Anbindung.
                                Die Pflege erfolgt direkt bei der Agentur.
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {/* Rendered from the connector manifest, so the form always
                                matches what the platform actually asks for. */}
                            {(selectedPlatform?.credentialFields || []).map((field) => (
                                <Box sx={{position: 'relative'}} key={field.name}>
                                    <Input
                                        label={field.label || field.name}
                                        type={field.type === 'password' && !showPassword[field.name]
                                            ? 'password'
                                            : (field.type === 'email' ? 'email' : 'text')}
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                                    />
                                    {field.type === 'password' && (
                                        <IconButton
                                            type="button"
                                            onClick={() => togglePasswordVisibility(field.name)}
                                            size="small"
                                            aria-label="Passwort anzeigen"
                                            sx={{position: 'absolute', right: 4, top: 4, color: 'text.disabled'}}
                                        >
                                            {showPassword[field.name] ? <EyeOff size={16}/> : <Eye size={16}/>}
                                        </IconButton>
                                    )}
                                </Box>
                            ))}
                            <Alert severity="info" icon={<Shield size={16}/>} sx={{py: 0.5}}>
                                <Typography variant="caption">
                                    Ihre Anmeldedaten werden verschlüsselt gespeichert und nur für die
                                    Synchronisation verwendet.
                                </Typography>
                            </Alert>
                        </>
                    )}

                    <Stack direction="row" spacing={1.5} sx={{pt: 2}}>
                        <Button onClick={handleConnect} disabled={saving} icon={saving ? Loader : Check}>
                            {saving ? 'Verbinde...' : 'Verbinden'}
                        </Button>
                        <Button variant="secondary" onClick={() => setShowModal(false)} icon={X}>
                            Abbrechen
                        </Button>
                    </Stack>
                </Stack>
            </Modal>

            {/* Settings dialog */}
            <Modal
                isOpen={showModal && modalType === 'settings'}
                onClose={() => setShowModal(false)}
                title={`Einstellungen für ${selectedPlatform?.name}`}
            >
                <Stack spacing={2}>
                    {isAutomated(selectedPlatform) && (
                        <Alert severity="info" icon={<Bot size={16}/>} sx={{py: 0.5}}>
                            <Typography variant="body2">
                                Agent-basierte Plattform mit erweiterten Synchronisationsoptionen
                            </Typography>
                        </Alert>
                    )}

                    <FormControlLabel
                        control={
                            <Switch
                                checked={formData.autoSync || false}
                                onChange={(e) => handleInputChange('autoSync', e.target.checked)}
                            />
                        }
                        label={<Typography variant="body2" fontWeight={500}>Automatische Synchronisation</Typography>}
                    />

                    <TextField
                        select
                        fullWidth
                        size="small"
                        label="Sync-Intervall"
                        value={formData.syncInterval || 'daily'}
                        onChange={(e) => handleInputChange('syncInterval', e.target.value)}
                    >
                        {isAutomated(selectedPlatform) && <MenuItem value="realtime">Echtzeit (Agent)</MenuItem>}
                        <MenuItem value="hourly">Stündlich</MenuItem>
                        <MenuItem value="daily">Täglich</MenuItem>
                        <MenuItem value="weekly">Wöchentlich</MenuItem>
                        <MenuItem value="manual">Manuell</MenuItem>
                    </TextField>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={formData.syncAvailability !== false}
                                onChange={(e) => handleInputChange('syncAvailability', e.target.checked)}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight={500}>Verfügbarkeit synchronisieren</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Überträgt nur, welche Zeiträume blockiert sind - keine Gründe, keine Notizen.
                                </Typography>
                            </Box>
                        }
                    />

                    <Stack direction="row" spacing={1.5} sx={{pt: 2}}>
                        <Button onClick={handleUpdateSettings} disabled={saving} icon={saving ? Loader : Check}>
                            {saving ? 'Speichere...' : 'Speichern'}
                        </Button>
                        <Button variant="secondary" onClick={() => setShowModal(false)} icon={X}>
                            Abbrechen
                        </Button>
                    </Stack>
                </Stack>
            </Modal>

            {/* Credits the platform could not be told apart from its own. */}
            <Modal
                isOpen={showModal && modalType === 'credits'}
                onClose={() => setShowModal(false)}
                title={`Vita-Abgleich mit ${selectedPlatform?.name}`}
            >
                <Stack spacing={2}>
                    {creditSummary && <Alert severity="info">{creditSummary}</Alert>}

                    <Alert severity="warning">
                        <AlertTitle>Gleicher Job oder zwei?</AlertTitle>
                        <Typography variant="body2">
                            Diese Einträge ähneln Credits, die {selectedPlatform?.name} bereits hat.
                            Ob es derselbe Job ist, kann nur entschieden werden - eine Folgennummer
                            kann der Unterschied zwischen zwei Engagements sein. Ohne Auswahl wird
                            nichts übertragen und nichts gelöscht.
                        </Typography>

                        <Stack spacing={2} sx={{mt: 2}}>
                            {creditQuestions.map((question) => (
                                <Box key={question.path} sx={{borderTop: 1, borderColor: 'warning.light', pt: 1.5}}>
                                    <Typography variant="body2" sx={{mb: 1}}>
                                        <strong>
                                            {question.from ? `Aus ${question.from}:` : 'Ihr Eintrag:'}
                                        </strong> {question.credit}
                                    </Typography>
                                    <TextField
                                        select
                                        fullWidth
                                        size="small"
                                        value={creditAnswers[question.path] || ''}
                                        onChange={(e) => setCreditAnswers(prev => ({
                                            ...prev, [question.path]: e.target.value
                                        }))}
                                    >
                                        <MenuItem value="">nichts tun</MenuItem>
                                        {question.options.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.value === '__add__'
                                                    ? option.label
                                                    : `Derselbe Credit wie${option.onPlatform ? ` auf ${option.onPlatform}` : ''}: ${option.label}`}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Box>
                            ))}
                        </Stack>
                    </Alert>

                    <Stack direction="row" spacing={1} sx={{justifyContent: 'flex-end'}}>
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
                    </Stack>
                </Stack>
            </Modal>

            {/* Import dialog: what the platform returned, and what to keep. */}
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
                            <Typography variant="body2" color="text.secondary">
                                Es konnten keine Felder gelesen werden.
                            </Typography>
                        );
                    }

                    return (
                        <Stack spacing={2}>
                            <Alert severity="info">
                                Ausgewählte Felder überschreiben die entsprechenden Werte in Ihrem
                                Profil. Nicht ausgewählte Felder bleiben unverändert.
                            </Alert>

                            {result.unmapped?.length > 0 && (
                                <Alert severity="warning">
                                    <AlertTitle>Nicht zuzuordnen</AlertTitle>
                                    <Typography variant="body2" sx={{mb: 1.5}}>
                                        Diese Werte von {selectedPlatform?.name} lassen sich keinem Wert
                                        dieser App zuordnen. Bitte auswählen - ohne Auswahl werden sie
                                        nicht übernommen.
                                    </Typography>
                                    <Stack spacing={1.5}>
                                        {result.unmapped.map((question) => (
                                            <Box key={question.path}>
                                                <Typography variant="caption" display="block" sx={{mb: 0.5}}>
                                                    <strong>{importFieldLabel(question.field)}</strong>
                                                    {question.context ? ` (${question.context})` : ''}
                                                    : „{String(question.value)}"
                                                </Typography>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    size="small"
                                                    value={importResolutions[question.path] || ''}
                                                    onChange={(e) => setImportResolutions(prev => ({
                                                        ...prev, [question.path]: e.target.value
                                                    }))}
                                                >
                                                    <MenuItem value="">nicht übernehmen</MenuItem>
                                                    {question.options.map((option) => (
                                                        <MenuItem key={option} value={option}>{option}</MenuItem>
                                                    ))}
                                                    <MenuItem value="__keep__">Original übernehmen</MenuItem>
                                                </TextField>
                                            </Box>
                                        ))}
                                    </Stack>
                                </Alert>
                            )}

                            <Box sx={{'& > *': {borderTop: 1, borderColor: 'divider'}, '& > *:first-of-type': {borderTop: 0}}}>
                                {keys.map((key) => (
                                    <FormControlLabel
                                        key={key}
                                        sx={{display: 'flex', alignItems: 'flex-start', m: 0, py: 1}}
                                        control={
                                            <Checkbox
                                                checked={importSelection.includes(key)}
                                                onChange={() => toggleImportField(key)}
                                                sx={{pt: 0.5}}
                                            />
                                        }
                                        label={
                                            <Box sx={{minWidth: 0}}>
                                                <Typography variant="body2" fontWeight={500}>
                                                    {importFieldLabel(key)}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    display="block"
                                                    sx={{wordBreak: 'break-word'}}
                                                >
                                                    {previewImported(fields[key])}
                                                </Typography>
                                                {result.sources?.[key] && (
                                                    <Typography variant="caption" color="text.disabled" display="block">
                                                        {/* The connector reports where on its own site a
                                                            value sat; the platform name is stamped on by
                                                            the server, because a locator like
                                                            "graphql:profileExperienceRepeater" does not
                                                            say which site it belongs to. */}
                                                        Quelle: {sourceLabel(result.sources[key])}
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                    />
                                ))}
                            </Box>

                            {result.missing?.length > 0 && (
                                <Typography variant="caption" color="text.secondary">
                                    Auf der Plattform leer oder nicht gefunden: {result.missing.join(', ')}
                                </Typography>
                            )}

                            <Stack direction="row" spacing={1.5} sx={{pt: 1}}>
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
                            </Stack>
                        </Stack>
                    );
                })()}
            </Modal>
        </Stack>
    );
};

export default PlatformsView;
