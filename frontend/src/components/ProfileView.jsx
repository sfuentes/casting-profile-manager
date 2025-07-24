import React, {useState, useRef} from 'react';
import {
    User,
    Camera,
    Upload,
    Edit2,
    Save,
    X,
    Plus,
    Trash2,
    RefreshCw,
    Calendar,
    MapPin,
    Phone,
    Mail,
    Globe,
    Award,
    Briefcase,
    GraduationCap,
    Star,
    Image as ImageIcon,
    Loader,
    Check,
    AlertCircle
} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import {Button, Modal, Input, Card, Badge} from './ui';

const ProfileView = () => {
    const {
        profile,
        platforms,
        loading,
        saving,
        uploading,
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
        syncProfileToPlatforms
    } = useAppContext();

    const [activeTab, setActiveTab] = useState('personal');
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('work');
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [showSyncModal, setShowSyncModal] = useState(false);

    const profilePhotoRef = useRef();
    const setcardPhotoRefs = useRef({});

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader size={48} className="animate-spin text-blue-600"/>
            </div>
        );
    }

    const handleProfilePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('Datei zu groß. Maximale Größe: 5MB');
            return;
        }

        try {
            await uploadProfilePhoto(file);
        } catch (err) {
            alert('Fehler beim Hochladen des Bildes');
        }
    };

    const handleSetcardPhotoUpload = async (photoId, file) => {
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert('Datei zu groß. Maximale Größe: 10MB');
            return;
        }

        try {
            await uploadSetcardPhoto(photoId, file);
        } catch (err) {
            alert('Fehler beim Hochladen des Setcard-Bildes');
        }
    };

    const handleSetcardPhotoDelete = async (photoId) => {
        if (!confirm('Möchten Sie dieses Bild wirklich löschen?')) return;

        try {
            await deleteSetcardPhoto(photoId);
        } catch (err) {
            alert('Fehler beim Löschen des Bildes');
        }
    };

    const openModal = (type, item = null) => {
        setModalType(type);
        setEditingItem(item);
        setFormData(item || {});
        setShowModal(true);
    };

    const handleSave = async () => {
        try {
            if (editingItem) {
                if (modalType === 'work') {
                    await updateWorkHistory(editingItem.id, formData);
                } else if (modalType === 'education') {
                    await updateEducation(editingItem.id, formData);
                }
            } else {
                if (modalType === 'work') {
                    await addWorkHistory(formData);
                } else if (modalType === 'education') {
                    await addEducation(formData);
                }
            }
            setShowModal(false);
            setFormData({});
            setEditingItem(null);
        } catch (err) {
            console.error('Failed to save:', err);
        }
    };

    const handleDelete = async (type, id) => {
        if (!confirm('Möchten Sie diesen Eintrag wirklich löschen?')) return;

        try {
            if (type === 'work') {
                await deleteWorkHistory(id);
            } else if (type === 'education') {
                await deleteEducation(id);
            }
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
    };

    const handleProfileUpdate = async (field, value) => {
        await updateProfile({[field]: value});
    };

    const handleSyncProfile = async () => {
        try {
            const syncedCount = await syncProfileToPlatforms();
            setShowSyncModal(false);
            alert(`Profil erfolgreich mit ${syncedCount} Plattformen synchronisiert!`);
        } catch (err) {
            console.error('Sync failed:', err);
        }
    };

    const connectedPlatforms = platforms.filter(p => p.connected);

    const tabs = [
        {id: 'personal', label: 'Persönliche Daten', icon: User},
        {id: 'photos', label: 'Fotos & Setcard', icon: Camera},
        {id: 'work', label: 'Berufserfahrung', icon: Briefcase},
        {id: 'education', label: 'Ausbildung', icon: GraduationCap},
        {id: 'skills', label: 'Fähigkeiten', icon: Star}
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    <h1 className="text-3xl font-bold text-gray-900">Profil</h1>
                    <Badge color={profile.avatar && profile.setcard.photos.some(p => p.url) ? 'green' : 'yellow'}>
                        {profile.avatar && profile.setcard.photos.some(p => p.url) ? 'Vollständig' : 'Unvollständig'}
                    </Badge>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={() => setShowSyncModal(true)}
                        variant="outline"
                        icon={RefreshCw}
                        disabled={connectedPlatforms.length === 0}
                    >
                        Profil sync ({connectedPlatforms.length})
                    </Button>
                </div>
            </div>

            {/* Profile Header Card */}
            <Card>
                <div className="flex items-start space-x-6">
                    <div className="relative">
                        <div className="w-32 h-32 rounded-full bg-gray-200 overflow-hidden">
                            {profile.avatar ? (
                                <img
                                    src={profile.avatar}
                                    alt="Profilbild"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <User size={48} className="text-gray-400"/>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => profilePhotoRef.current?.click()}
                            disabled={uploading}
                            className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg"
                        >
                            {uploading ? <Loader size={16} className="animate-spin"/> : <Camera size={16}/>}
                        </button>
                        <input
                            ref={profilePhotoRef}
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoUpload}
                            className="hidden"
                        />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
                        <p className="text-gray-600 mt-1">{profile.age} • {profile.location}</p>
                        <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                                <Mail size={16}/>
                                <span>{profile.email}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <Phone size={16}/>
                                <span>{profile.phone}</span>
                            </div>
                        </div>
                        {profile.biography && (
                            <p className="mt-3 text-gray-700">{profile.biography}</p>
                        )}
                    </div>
                </div>
            </Card>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <tab.icon size={16}/>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {/* Personal Information Tab */}
                {activeTab === 'personal' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <h3 className="text-lg font-semibold mb-4">Grunddaten</h3>
                            <div className="space-y-4">
                                <Input
                                    label="Name"
                                    value={profile.name}
                                    onChange={(e) => handleProfileUpdate('name', e.target.value)}
                                />
                                <Input
                                    label="E-Mail"
                                    type="email"
                                    value={profile.email}
                                    onChange={(e) => handleProfileUpdate('email', e.target.value)}
                                />
                                <Input
                                    label="Telefon"
                                    value={profile.phone}
                                    onChange={(e) => handleProfileUpdate('phone', e.target.value)}
                                />
                                <Input
                                    label="Wohnort"
                                    value={profile.residence || ''}
                                    onChange={(e) => handleProfileUpdate('residence', e.target.value)}
                                />
                                <Input
                                    label="Staatsangehörigkeit"
                                    value={profile.nationality || ''}
                                    onChange={(e) => handleProfileUpdate('nationality', e.target.value)}
                                />
                                <Input
                                    label="Geburtsdatum"
                                    type="date"
                                    value={profile.birthDate || ''}
                                    onChange={(e) => handleProfileUpdate('birthDate', e.target.value)}
                                />
                            </div>
                        </Card>

                        <Card>
                            <h3 className="text-lg font-semibold mb-4">Erscheinung</h3>
                            <div className="space-y-4">
                                <Input
                                    label="Körpergröße"
                                    value={profile.height || ''}
                                    onChange={(e) => handleProfileUpdate('height', e.target.value)}
                                    placeholder="z.B. 175 cm"
                                />
                                <Input
                                    label="Gewicht"
                                    value={profile.weight || ''}
                                    onChange={(e) => handleProfileUpdate('weight', e.target.value)}
                                    placeholder="z.B. 70 kg"
                                />
                                <Input
                                    label="Augenfarbe"
                                    value={profile.eyeColor || ''}
                                    onChange={(e) => handleProfileUpdate('eyeColor', e.target.value)}
                                />
                                <Input
                                    label="Haarfarbe"
                                    value={profile.hairColor || ''}
                                    onChange={(e) => handleProfileUpdate('hairColor', e.target.value)}
                                />
                                <Input
                                    label="Spielalter"
                                    value={profile.age || ''}
                                    onChange={(e) => handleProfileUpdate('age', e.target.value)}
                                    placeholder="z.B. 25-35"
                                />
                            </div>
                        </Card>

                        <Card>
                            <h3 className="text-lg font-semibold mb-4">Kontakt & Vertretung</h3>
                            <div className="space-y-4">
                                <Input
                                    label="Agentur Name"
                                    value={profile.agentName || ''}
                                    onChange={(e) => handleProfileUpdate('agentName', e.target.value)}
                                />
                                <Input
                                    label="Agentur E-Mail"
                                    type="email"
                                    value={profile.agentEmail || ''}
                                    onChange={(e) => handleProfileUpdate('agentEmail', e.target.value)}
                                />
                                <Input
                                    label="Agentur Telefon"
                                    value={profile.agentPhone || ''}
                                    onChange={(e) => handleProfileUpdate('agentPhone', e.target.value)}
                                />
                                <Input
                                    label="Website"
                                    value={profile.website || ''}
                                    onChange={(e) => handleProfileUpdate('website', e.target.value)}
                                />
                            </div>
                        </Card>

                        <Card>
                            <h3 className="text-lg font-semibold mb-4">Biografie</h3>
                            <textarea
                                value={profile.biography || ''}
                                onChange={(e) => handleProfileUpdate('biography', e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Beschreiben Sie Ihre Erfahrungen, Ihren Stil und Ihre Leidenschaft für die Schauspielerei..."
                            />
                        </Card>
                    </div>
                )}

                {/* Photos & Setcard Tab */}
                {activeTab === 'photos' && (
                    <div className="space-y-6">
                        <Card>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold">Setcard</h3>
                                <span className="text-sm text-gray-500">
                                    {profile.setcard.lastUpdated &&
                                        `Zuletzt aktualisiert: ${new Date(profile.setcard.lastUpdated).toLocaleDateString('de-DE')}`
                                    }
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {profile.setcard.photos.map(photo => (
                                    <div key={photo.id} className="relative group">
                                        <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                                            {photo.url ? (
                                                <img
                                                    src={photo.url}
                                                    alt={photo.description}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                                    <ImageIcon size={32}/>
                                                    <span className="text-xs mt-2 text-center px-2">
                                                        {photo.description}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                                            <button
                                                onClick={() => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.accept = 'image/*';
                                                    input.onchange = (e) => handleSetcardPhotoUpload(photo.id, e.target.files[0]);
                                                    input.click();
                                                }}
                                                disabled={uploading}
                                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2"
                                            >
                                                {uploading ? <Loader size={16} className="animate-spin"/> : <Upload size={16}/>}
                                            </button>
                                            {photo.url && (
                                                <button
                                                    onClick={() => handleSetcardPhotoDelete(photo.id)}
                                                    disabled={uploading}
                                                    className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <p className="text-sm font-medium text-gray-900">{photo.type}</p>
                                            <p className="text-xs text-gray-500">{photo.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                )}

                {/* Work History Tab */}
                {activeTab === 'work' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Berufserfahrung</h3>
                            <Button onClick={() => openModal('work')} icon={Plus}>
                                Projekt hinzufügen
                            </Button>
                        </div>
                        <div className="space-y-4">
                            {profile.workHistory?.map(work => (
                                <Card key={work.id}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h4 className="text-lg font-semibold text-gray-900">{work.title}</h4>
                                            <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                                <span>{work.production}</span>
                                                <span>•</span>
                                                <span>{work.role}</span>
                                                <span>•</span>
                                                <Badge>{work.type}</Badge>
                                                <span>•</span>
                                                <span>{work.year}</span>
                                            </div>
                                            {work.director && (
                                                <p className="text-sm text-gray-600 mt-1">
                                                    Regie: {work.director}
                                                </p>
                                            )}
                                            {work.description && (
                                                <p className="text-sm text-gray-700 mt-2">{work.description}</p>
                                            )}
                                            <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                                                {work.location && (
                                                    <div className="flex items-center space-x-1">
                                                        <MapPin size={12}/>
                                                        <span>{work.location}</span>
                                                    </div>
                                                )}
                                                {work.duration && (
                                                    <div className="flex items-center space-x-1">
                                                        <Calendar size={12}/>
                                                        <span>{work.duration}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex space-x-2 ml-4">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openModal('work', work)}
                                                icon={Edit2}
                                            />
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => handleDelete('work', work.id)}
                                                icon={Trash2}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                            {!profile.workHistory?.length && (
                                <Card>
                                    <div className="text-center py-8 text-gray-500">
                                        <Briefcase size={48} className="mx-auto mb-4 text-gray-300"/>
                                        <p>Noch keine Berufserfahrung hinzugefügt.</p>
                                        <Button
                                            onClick={() => openModal('work')}
                                            className="mt-4"
                                            icon={Plus}
                                        >
                                            Erstes Projekt hinzufügen
                                        </Button>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                )}

                {/* Education Tab */}
                {activeTab === 'education' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Ausbildung</h3>
                            <Button onClick={() => openModal('education')} icon={Plus}>
                                Ausbildung hinzufügen
                            </Button>
                        </div>
                        <div className="space-y-4">
                            {profile.education?.map(edu => (
                                <Card key={edu.id}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h4 className="text-lg font-semibold text-gray-900">{edu.degree}</h4>
                                            <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                                <span>{edu.institution}</span>
                                                <span>•</span>
                                                <span>{edu.field}</span>
                                                <span>•</span>
                                                <span>{edu.startYear} - {edu.endYear}</span>
                                            </div>
                                            {edu.description && (
                                                <p className="text-sm text-gray-700 mt-2">{edu.description}</p>
                                            )}
                                            <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                                                {edu.location && (
                                                    <div className="flex items-center space-x-1">
                                                        <MapPin size={12}/>
                                                        <span>{edu.location}</span>
                                                    </div>
                                                )}
                                                {edu.grade && (
                                                    <div className="flex items-center space-x-1">
                                                        <Award size={12}/>
                                                        <span>{edu.grade}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex space-x-2 ml-4">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openModal('education', edu)}
                                                icon={Edit2}
                                            />
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => handleDelete('education', edu.id)}
                                                icon={Trash2}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                            {!profile.education?.length && (
                                <Card>
                                    <div className="text-center py-8 text-gray-500">
                                        <GraduationCap size={48} className="mx-auto mb-4 text-gray-300"/>
                                        <p>Noch keine Ausbildung hinzugefügt.</p>
                                        <Button
                                            onClick={() => openModal('education')}
                                            className="mt-4"
                                            icon={Plus}
                                        >
                                            Erste Ausbildung hinzufügen
                                        </Button>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                )}

                {/* Skills Tab */}
                {activeTab === 'skills' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <h3 className="text-lg font-semibold mb-4">Fähigkeiten</h3>
                            <div className="space-y-3">
                                {profile.skills?.map(skill => (
                                    <div key={skill.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                        <div>
                                            <span className="font-medium text-gray-900">{skill.name}</span>
                                            <span className="text-sm text-gray-500 ml-2">({skill.years} Jahre)</span>
                                        </div>
                                        <Badge color={
                                            skill.level === 'Profi' ? 'green' :
                                                skill.level === 'Fortgeschritten' ? 'blue' : 'gray'
                                        }>
                                            {skill.level}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card>
                            <h3 className="text-lg font-semibold mb-4">Besondere Fähigkeiten</h3>
                            <div className="flex flex-wrap gap-2">
                                {profile.specialSkills?.map((skill, index) => (
                                    <Badge key={index} variant="outline">{skill}</Badge>
                                ))}
                            </div>
                        </Card>

                        <Card className="lg:col-span-2">
                            <h3 className="text-lg font-semibold mb-4">Sprachen</h3>
                            <div className="flex flex-wrap gap-2">
                                {profile.languages?.map((language, index) => (
                                    <Badge key={index} color="blue">{language}</Badge>
                                ))}
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* Work/Education Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={
                    editingItem
                        ? `${modalType === 'work' ? 'Projekt' : 'Ausbildung'} bearbeiten`
                        : `${modalType === 'work' ? 'Neues Projekt' : 'Neue Ausbildung'} hinzufügen`
                }
            >
                <div className="space-y-4">
                    {modalType === 'work' ? (
                        <>
                            <Input
                                label="Titel"
                                value={formData.title || ''}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                            />
                            <Input
                                label="Produktion"
                                value={formData.production || ''}
                                onChange={(e) => handleInputChange('production', e.target.value)}
                            />
                            <Input
                                label="Rolle"
                                value={formData.role || ''}
                                onChange={(e) => handleInputChange('role', e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                                    <select
                                        value={formData.type || ''}
                                        onChange={(e) => handleInputChange('type', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Typ auswählen</option>
                                        <option value="Film">Film</option>
                                        <option value="TV-Serie">TV-Serie</option>
                                        <option value="TV-Film">TV-Film</option>
                                        <option value="Theater">Theater</option>
                                        <option value="Werbung">Werbung</option>
                                        <option value="Kurzfilm">Kurzfilm</option>
                                        <option value="Synchronisation">Synchronisation</option>
                                    </select>
                                </div>
                                <Input
                                    label="Jahr"
                                    value={formData.year || ''}
                                    onChange={(e) => handleInputChange('year', e.target.value)}
                                />
                            </div>
                            <Input
                                label="Regisseur"
                                value={formData.director || ''}
                                onChange={(e) => handleInputChange('director', e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Ort"
                                    value={formData.location || ''}
                                    onChange={(e) => handleInputChange('location', e.target.value)}
                                />
                                <Input
                                    label="Dauer"
                                    value={formData.duration || ''}
                                    onChange={(e) => handleInputChange('duration', e.target.value)}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <Input
                                label="Institution"
                                value={formData.institution || ''}
                                onChange={(e) => handleInputChange('institution', e.target.value)}
                            />
                            <Input
                                label="Abschluss"
                                value={formData.degree || ''}
                                onChange={(e) => handleInputChange('degree', e.target.value)}
                            />
                            <Input
                                label="Fachrichtung"
                                value={formData.field || ''}
                                onChange={(e) => handleInputChange('field', e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Von (Jahr)"
                                    value={formData.startYear || ''}
                                    onChange={(e) => handleInputChange('startYear', e.target.value)}
                                />
                                <Input
                                    label="Bis (Jahr)"
                                    value={formData.endYear || ''}
                                    onChange={(e) => handleInputChange('endYear', e.target.value)}
                                />
                            </div>
                            <Input
                                label="Ort"
                                value={formData.location || ''}
                                onChange={(e) => handleInputChange('location', e.target.value)}
                            />
                            <Input
                                label="Note"
                                value={formData.grade || ''}
                                onChange={(e) => handleInputChange('grade', e.target.value)}
                            />
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                        <textarea
                            value={formData.description || ''}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Zusätzliche Details..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader size={16} className="animate-spin"/> : <Check size={16}/>}
                            {editingItem ? 'Aktualisieren' : 'Hinzufügen'}
                        </Button>
                        <Button variant="secondary" onClick={() => setShowModal(false)} icon={X}>
                            Abbrechen
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Profile Sync Modal */}
            <Modal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                title="Profil synchronisieren"
            >
                <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                        <AlertCircle className="text-blue-500 mt-1" size={20}/>
                        <div>
                            <p className="text-sm text-gray-600 mb-2">
                                Ihr vollständiges Profil wird mit folgenden Plattformen synchronisiert:
                            </p>
                            <div className="bg-blue-50 rounded p-3 text-xs text-blue-700">
                                <strong>Übertragene Daten:</strong>
                                <ul className="mt-1 space-y-1">
                                    <li>• Persönliche Informationen & Kontaktdaten</li>
                                    <li>• Profilbild und Setcard-Fotos</li>
                                    <li>• Berufserfahrung & Filmografie</li>
                                    <li>• Ausbildung & Qualifikationen</li>
                                    <li>• Fähigkeiten & Sprachen</li>
                                    <li>• Biografie & Beschreibung</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                        {connectedPlatforms.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                Keine Plattformen verbunden.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {connectedPlatforms.map(platform => (
                                    <div key={platform.id} className="flex items-center justify-between">
                                        <span className="text-sm font-medium">{platform.name}</span>
                                        <Badge color="green">Verbunden</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            onClick={handleSyncProfile}
                            disabled={connectedPlatforms.length === 0 || saving}
                            icon={saving ? Loader : RefreshCw}
                        >
                            {saving ? 'Synchronisiere...' : 'Jetzt synchronisieren'}
                        </Button>
                        <Button variant="secondary" onClick={() => setShowSyncModal(false)}>
                            Abbrechen
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ProfileView;