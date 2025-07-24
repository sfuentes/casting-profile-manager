
import React, {useState, useEffect} from 'react';
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
import {apiService} from '../services/apiService';

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
        initiateOAuth
    } = useAppContext();

    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('connect');
    const [selectedPlatform, setSelectedPlatform] = useState(null);
    const [formData, setFormData] = useState({});
    const [showPassword, setShowPassword] = useState({});
    const [expandedPlatform, setExpandedPlatform] = useState(null);
    const [bulkSyncSelected, setBulkSyncSelected] = useState([]);
    const [testResults, setTestResults] = useState({});
    const [agentStatus, setAgentStatus] = useState(null);
    const [importResults, setImportResults] = useState({});

    // Check agent health on component mount
    useEffect(() => {
        checkAgentHealth();
    }, []);

    const checkAgentHealth = async () => {
        try {
            const health = await apiService.checkAgentHealth();
            setAgentStatus(health);
        } catch (error) {
            setAgentStatus({
                success: false,
                status: 'error',
                message: error.message
            });
        }
    };

    const openModal = (type, platform) => {
        setModalType(type);
        setSelectedPlatform(platform);

        if (type === 'connect') {
            setFormData({});
        } else if (type === 'settings') {
            setFormData(platform.syncSettings || {});
        }

        setShowModal(true);
    };

    const handleConnect = async () => {
        try {
            if (selectedPlatform.authType === 'oauth') {
                await initiateOAuth(selectedPlatform.id);
                // In a real app, OAuth callback would handle the connection
                // For demo, we'll simulate successful connection
                setTimeout(async () => {
                    await connectPlatform(selectedPlatform.id, {token: 'oauth_token_demo'});
                    setShowModal(false);
                }, 2000);
            } else {
                await connectPlatform(selectedPlatform.id, formData);
                setShowModal(false);
            }
        } catch (err) {
            console.error('Connection failed:', err);
            alert(`Verbindung fehlgeschlagen: ${err.message}`);
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

    const handleTestConnection = async (platform) => {
        try {
            const result = await apiService.testPlatformConnection(platform.id, platform.authData);
            setTestResults(prev => ({...prev, [platform.id]: result}));
        } catch (err) {
            console.error('Connection test failed:', err);
        }
    };

    const handleSyncToPlatform = async (platform) => {
        try {
            const result = await apiService.syncToPlatform(platform.id, ['profile', 'availability'], platform.authData);
            alert(`Synchronisation zu ${platform.name} erfolgreich!`);
        } catch (err) {
            console.error('Sync failed:', err);
            alert(`Synchronisation fehlgeschlagen: ${err.message}`);
        }
    };

    const handleBulkSync = async () => {
        if (bulkSyncSelected.length === 0) {
            alert('Bitte wählen Sie mindestens eine Plattform aus.');
            return;
        }

        try {
            const credentialsMap = {};
            bulkSyncSelected.forEach(platformId => {
                const platform = platforms.find(p => p.id === platformId);
                if (platform && platform.authData) {
                    credentialsMap[platformId] = platform.authData;
                }
            });

            const result = await apiService.bulkSyncToPlatforms(bulkSyncSelected, ['profile', 'availability'], credentialsMap);
            alert(`${result.synced} Plattformen erfolgreich synchronisiert!`);
            setBulkSyncSelected([]);
        } catch (err) {
            console.error('Bulk sync failed:', err);
            alert(`Massen-Synchronisation fehlgeschlagen: ${err.message}`);
        }
    };

    const handleImportProfile = async (platform) => {
        if (!platform.authData || Object.keys(platform.authData).length === 0) {
            alert('Bitte stellen Sie zuerst eine Verbindung zur Plattform her.');
            return;
        }

        try {
            const result = await apiService.readProfileFromPlatform(platform.id, platform.authData);
            setImportResults(prev => ({...prev, [platform.id]: result}));
            alert('Profil erfolgreich importiert! Die Daten wurden mit Ihrem lokalen Profil zusammengeführt.');
        } catch (error) {
            console.error('Import failed:', error);
            alert(`Import fehlgeschlagen: ${error.message}`);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
    };

    const togglePasswordVisibility = (field) => {
        setShowPassword(prev => ({...prev, [field]: !prev[field]}));
    };

    const getConnectionTypeIcon = (platform) => {
        if (platform.connectionType === 'agent') return Bot;
        if (platform.connectionType === 'api') return Cpu;
        if (platform.authType === 'oauth') return Link;
        if (platform.authType === 'api') return Cpu;
        return Key;
    };

    const getConnectionTypeText = (platform) => {
        if (platform.connectionType === 'agent') return 'Agent-basiert';
        if (platform.connectionType === 'api') return 'API-Integration';
        if (platform.authType === 'oauth') return 'OAuth';
        if (platform.authType === 'api') return 'API';
        return 'Standard';
    };

    const getPlatformStatusColor = (platform) => {
        if (!platform.connected) return 'gray';
        if (platform.lastSync) {
            const lastSync = new Date(platform.lastSync);
            const daysSinceSync = (new Date() - lastSync) / (1000 * 60 * 60 * 24);
            if (daysSinceSync > 7) return 'yellow';
        }
        return 'green';
    };

    const getSyncIntervalText = (interval) => {
        const intervals = {
            'realtime': 'Echtzeit',
            'hourly': 'Stündlich',
            'daily': 'Täglich',
            'weekly': 'Wöchentlich',
            'manual': 'Manuell'
        };
        return intervals[interval] || interval;
    };

    const getPlatformCapabilities = (platform) => {
        const capabilities = [];

        if (platform.agentCapable) {
            capabilities.push({
                icon: Bot,
                label: 'Automatisierung',
                description: 'Vollautomatische Profil-Synchronisation'
            });
        }

        if (platform.hasAPI) {
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
            <div className="flex items-center justify-center h-64">
                <Loader size={48} className="animate-spin text-blue-600"/>
            </div>
        );
    }

    const connectedPlatforms = platforms.filter(p => p.connected);
    const disconnectedPlatforms = platforms.filter(p => !p.connected);
    const agentPlatforms = platforms.filter(p => p.agentCapable);
    const apiPlatforms = platforms.filter(p => p.hasAPI);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    <h1 className="text-3xl font-bold text-gray-900">Plattformen</h1>
                    <Badge color="blue">
                        {connectedPlatforms.length} von {platforms.length} verbunden
                    </Badge>
                    <Badge color={agentStatus?.success ? 'green' : 'red'} icon={Bot}>
                        Agent: {agentStatus?.status || 'Unbekannt'}
                    </Badge>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={checkAgentHealth}
                        variant="outline"
                        icon={Activity}
                        size="sm"
                    >
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
                </div>
            </div>

            {/* Agent Status Card */}
            {agentStatus && (
                <Card className={`border-l-4 ${
                    agentStatus.success ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'
                }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Bot className={`w-8 h-8 ${agentStatus.success ? 'text-green-600' : 'text-red-600'}`}/>
                            <div>
                                <h3 className="font-semibold text-gray-900">Platform Agent Status</h3>
                                <p className="text-sm text-gray-600">{agentStatus.message}</p>
                                <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                                    <span>Agent-fähige Plattformen: {agentPlatforms.length}</span>
                                    <span>API-Plattformen: {apiPlatforms.length}</span>
                                    <span>Letzte Prüfung: {new Date(agentStatus.timestamp).toLocaleString('de-DE')}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {agentStatus.success ? (
                                <CheckCircle className="w-6 h-6 text-green-600"/>
                            ) : (
                                <XCircle className="w-6 h-6 text-red-600"/>
                            )}
                        </div>
                    </div>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-green-600">{connectedPlatforms.length}</p>
                            <p className="text-sm text-gray-600">Verbunden</p>
                        </div>
                        <Wifi className="w-8 h-8 text-green-600"/>
                    </div>
                </Card>
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-blue-600">{agentPlatforms.length}</p>
                            <p className="text-sm text-gray-600">Agent-fähig</p>
                        </div>
                        <Bot className="w-8 h-8 text-blue-600"/>
                    </div>
                </Card>
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-purple-600">{apiPlatforms.length}</p>
                            <p className="text-sm text-gray-600">API verfügbar</p>
                        </div>
                        <Cpu className="w-8 h-8 text-purple-600"/>
                    </div>
                </Card>
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-orange-600">
                                {connectedPlatforms.filter(p => p.syncSettings?.autoSync).length}
                            </p>
                            <p className="text-sm text-gray-600">Auto-Sync</p>
                        </div>
                        <Zap className="w-8 h-8 text-orange-600"/>
                    </div>
                </Card>
                <Card>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl font-bold text-indigo-600">
                                {connectedPlatforms.filter(p => p.lastSync &&
                                    new Date() - new Date(p.lastSync) < 24 * 60 * 60 * 1000).length}
                            </p>
                            <p className="text-sm text-gray-600">Heute sync</p>
                        </div>
                        <Activity className="w-8 h-8 text-indigo-600"/>
                    </div>
                </Card>
            </div>

            {/* Connected Platforms */}
            {connectedPlatforms.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900">Verbundene Plattformen</h2>
                    <div className="space-y-3">
                        {connectedPlatforms.map(platform => {
                            const ConnectionTypeIcon = getConnectionTypeIcon(platform);
                            const statusColor = getPlatformStatusColor(platform);
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
                                                            {getConnectionTypeText(platform)}
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
                                                <Badge color={testResult.success ? 'green' : 'red'} size="sm">
                                                    {testResult.success ? 'Test OK' : 'Test fehlgeschlagen'}
                                                </Badge>
                                            )}
                                            {importResult && (
                                                <Badge color="green" size="sm" icon={Download}>
                                                    Importiert
                                                </Badge>
                                            )}
                                            {platform.agentCapable && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleImportProfile(platform)}
                                                    disabled={syncing}
                                                    icon={syncing ? Loader : Download}
                                                    title="Profil von Plattform importieren"
                                                >
                                                    Import
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
                                                                {getConnectionTypeText(platform)}
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
                                                            <span>{getSyncIntervalText(platform.syncSettings?.syncInterval)}</span>
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
                                                            <span>{testResult?.lastTested ?
                                                                new Date(testResult.lastTested).toLocaleString('de-DE') : 'Nie'}</span>
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
                                                    <Badge color={platform.agentCapable ? 'blue' : 'purple'} size="sm">
                                                        {getConnectionTypeText(platform)}
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

                                        <div className="flex space-x-2">
                                            <Button
                                                size="sm"
                                                onClick={() => openModal('connect', platform)}
                                                disabled={saving}
                                                icon={saving ? Loader : Plus}
                                            >
                                                Verbinden
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                icon={ExternalLink}
                                                onClick={() => window.open('#', '_blank')}
                                            >
                                                Info
                                            </Button>
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
                    {selectedPlatform?.agentCapable && (
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

                    {selectedPlatform?.authType === 'oauth' ? (
                        <div className="text-center space-y-4">
                            <div className="p-4 bg-green-50 rounded-lg">
                                <Shield className="w-12 h-12 text-green-600 mx-auto mb-2"/>
                                <h3 className="font-semibold text-gray-900 mb-1">OAuth-Authentifizierung</h3>
                                <p className="text-sm text-gray-600">
                                    Sie werden zu {selectedPlatform.name} weitergeleitet, um die Verbindung zu autorisieren.
                                </p>
                            </div>
                        </div>
                    ) : selectedPlatform?.authType === 'credentials' ? (
                        <>
                            <Input
                                label="Benutzername/E-Mail"
                                value={formData.username || ''}
                                onChange={(e) => handleInputChange('username', e.target.value)}
                                placeholder="Ihr Benutzername oder E-Mail-Adresse"
                            />
                            <div className="relative">
                                <Input
                                    label="Passwort"
                                    type={showPassword.password ? 'text' : 'password'}
                                    value={formData.password || ''}
                                    onChange={(e) => handleInputChange('password', e.target.value)}
                                    placeholder="Ihr Passwort"
                                />
                                <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility('password')}
                                    className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword.password ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                            </div>
                            <div className="p-3 bg-gray-50 rounded text-xs text-gray-600">
                                <Shield size={14} className="inline mr-1"/>
                                Ihre Anmeldedaten werden verschlüsselt gespeichert und nur für die Synchronisation verwendet.
                            </div>
                        </>
                    ) : (
                        <div className="relative">
                            <Input
                                label="API-Schlüssel"
                                type={showPassword.apiKey ? 'text' : 'password'}
                                value={formData.apiKey || ''}
                                onChange={(e) => handleInputChange('apiKey', e.target.value)}
                                placeholder="Ihr API-Schlüssel"
                            />
                            <button
                                type="button"
                                onClick={() => togglePasswordVisibility('apiKey')}
                                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword.apiKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                            </button>
                        </div>
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
                    {selectedPlatform?.agentCapable && (
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
                            {selectedPlatform?.agentCapable && <option value="realtime">Echtzeit (Agent)</option>}
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
        </div>
    );
};

export default PlatformsView;