import React, {useState, useRef} from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import {
    User,
    Camera,
    Upload,
    Edit2,
    X,
    Plus,
    Trash2,
    RefreshCw,
    Calendar,
    MapPin,
    Phone,
    Mail,
    Award,
    Briefcase,
    GraduationCap,
    Star,
    Image as ImageIcon,
    Loader,
    Check
} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import {Button, Modal, Input, Card, Badge} from './ui';

/**
 * Where a profile field came from, if it was not typed here.
 *
 * `profile.provenance` is written when an import is applied and keyed by field
 * name. A field with no entry was the actor's own, which is why the absence
 * renders nothing rather than "unbekannt": silence means "yours".
 */
const importedFrom = (profile, field) => {
    const source = profile?.provenance?.[field];
    if (!source) return '';
    const name = source.platformName || source.platform;
    if (!name) return '';
    const when = source.importedAt ? new Date(source.importedAt) : null;
    const date = when && !Number.isNaN(when.getTime())
        ? ` am ${when.toLocaleDateString('de-DE')}` : '';
    return `Übernommen von ${name}${date}`;
};

/**
 * A date for <input type="date">, which needs exactly YYYY-MM-DD and renders
 * nothing at all for the full ISO timestamp Mongo returns.
 */
const toDateInputValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const WORK_TYPES = ['Film', 'TV-Serie', 'TV-Film', 'Theater', 'Werbung', 'Kurzfilm', 'Synchronisation'];

/** Responsive columns, as a container prop rather than a wrapper per child. */
const columns = (breakpoints) => ({
    display: 'grid',
    gap: 3,
    gridTemplateColumns: Object.fromEntries(
        Object.entries(breakpoints).map(([at, count]) => [at, `repeat(${count}, minmax(0, 1fr))`])
    )
});

/** Two fields side by side. */
const Pair = ({children}) => (
    <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2}}>
        {children}
    </Box>
);

/**
 * A small icon + text detail under a list entry.
 *
 * Takes `props` whole rather than destructuring the icon: eslint here runs
 * without eslint-plugin-react, so it does not count a JSX tag as a use, and its
 * uppercase exemption covers variables but not parameters - a destructured
 * `{icon: Icon}` is reported as unused even though the JSX below renders it.
 */
// Nothing to show means nothing is shown. Without this, a profile with no
// contact details rendered an envelope and a telephone receiver on their own
// under the name, labelling two blanks.
const Detail = (props) => (props.children ? (
    <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
        <props.icon size={12}/>
        <span>{props.children}</span>
    </Stack>
) : null);

/** The empty state each list tab shows before anything has been added. */
const Empty = (props) => (
    <Card>
        <Box sx={{textAlign: 'center', py: 4, color: 'text.secondary'}}>
            <Box sx={{color: 'grey.300', display: 'flex', justifyContent: 'center', mb: 2}}>
                <props.icon size={48}/>
            </Box>
            <Typography>{props.text}</Typography>
            <Box sx={{mt: 2}}>
                <Button onClick={props.onAdd} icon={Plus}>{props.action}</Button>
            </Box>
        </Box>
    </Card>
);

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

    if (loading) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256}}>
                <CircularProgress size={48}/>
            </Box>
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
            alert(`Fehler beim Hochladen des Bildes: ${err.message}`);
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
            alert(`Fehler beim Hochladen des Setcard-Bildes: ${err.message}`);
        }
    };

    const handleSetcardPhotoDelete = async (photoId) => {
        if (!confirm('Möchten Sie dieses Bild wirklich löschen?')) return;

        try {
            await deleteSetcardPhoto(photoId);
        } catch (err) {
            alert(`Fehler beim Löschen des Bildes: ${err.message}`);
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

    /**
     * Save one field. A dotted path like "contact.email" is sent as a nested
     * object, never as a dotted key: express-mongo-sanitize strips any key
     * containing a dot, so `{'contact.email': x}` would be silently dropped on
     * the way in and the field would appear not to save at all.
     */
    const handleProfileUpdate = async (field, value) => {
        const [head, ...rest] = field.split('.');
        const payload = rest.length === 0
            ? {[head]: value}
            : {[head]: rest.reduceRight((acc, key) => ({[key]: acc}), value)};
        await updateProfile(payload);
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
    const complete = profile.avatar && profile.setcard.photos.some(p => p.url);

    const tabs = [
        {id: 'personal', label: 'Persönliche Daten', icon: User},
        {id: 'photos', label: 'Fotos & Setcard', icon: Camera},
        {id: 'work', label: 'Berufserfahrung', icon: Briefcase},
        {id: 'education', label: 'Ausbildung', icon: GraduationCap},
        {id: 'skills', label: 'Fähigkeiten', icon: Star}
    ];

    return (
        <Stack spacing={3}>
            {/* Header */}
            <Stack direction="row" spacing={2} sx={{alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                <Stack direction="row" spacing={2} sx={{alignItems: 'center'}}>
                    <Typography variant="h4" component="h1" fontWeight={700}>Profil</Typography>
                    <Badge color={complete ? 'green' : 'yellow'}>
                        {complete ? 'Vollständig' : 'Unvollständig'}
                    </Badge>
                </Stack>
                <Button
                    onClick={() => setShowSyncModal(true)}
                    variant="outline"
                    icon={RefreshCw}
                    disabled={connectedPlatforms.length === 0}
                >
                    Profil sync ({connectedPlatforms.length})
                </Button>
            </Stack>

            {/* Profile header card */}
            <Card>
                <Stack direction="row" spacing={3} sx={{alignItems: 'flex-start', flexWrap: 'wrap'}}>
                    <Box sx={{position: 'relative'}}>
                        <Avatar src={profile.avatar || undefined} sx={{width: 128, height: 128}}>
                            <User size={48}/>
                        </Avatar>
                        <IconButton
                            onClick={() => profilePhotoRef.current?.click()}
                            disabled={uploading}
                            sx={{
                                position: 'absolute', bottom: 0, right: 0,
                                bgcolor: 'primary.main', color: 'common.white', boxShadow: 3,
                                '&:hover': {bgcolor: 'primary.dark'}
                            }}
                            size="small"
                        >
                            {uploading ? <CircularProgress size={16} color="inherit"/> : <Camera size={16}/>}
                        </IconButton>
                        <Box
                            component="input"
                            ref={profilePhotoRef}
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoUpload}
                            sx={{display: 'none'}}
                        />
                    </Box>
                    <Box sx={{flex: 1, minWidth: 240}}>
                        <Typography variant="h5" fontWeight={700}>{profile.name}</Typography>
                        <Typography color="text.secondary" sx={{mt: 0.5}}>
                            {profile.actingAge} • {profile.location}
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{mt: 1.5, color: 'text.secondary', fontSize: 14}}>
                            <Detail icon={Mail}>{profile.contact?.email}</Detail>
                            <Detail icon={Phone}>{profile.contact?.phone}</Detail>
                        </Stack>
                        {profile.biography && (
                            <Typography sx={{mt: 1.5}}>{profile.biography}</Typography>
                        )}
                    </Box>
                </Stack>
            </Card>

            {/* Tabs */}
            <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                <Tabs
                    value={activeTab}
                    onChange={(_event, value) => setActiveTab(value)}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    {tabs.map(tab => (
                        <Tab
                            key={tab.id}
                            value={tab.id}
                            label={tab.label}
                            icon={<tab.icon size={16}/>}
                            iconPosition="start"
                            sx={{minHeight: 48, textTransform: 'none'}}
                        />
                    ))}
                </Tabs>
            </Box>

            {/* Tab content */}
            <Box>
                {/* Personal information */}
                {activeTab === 'personal' && (
                    <Box sx={columns({xs: 1, lg: 2})}>
                        <Card>
                            <Typography variant="h6" sx={{mb: 2}}>Grunddaten</Typography>
                            <Stack spacing={2}>
                                <Input
                                    label="Name"
                                    hint={importedFrom(profile, 'name')}
                                    value={profile.name}
                                    onChange={(e) => handleProfileUpdate('name', e.target.value)}
                                />
                                <Input
                                    label="E-Mail"
                                    type="email"
                                    value={profile.contact?.email || ''}
                                    onChange={(e) => handleProfileUpdate('contact.email', e.target.value)}
                                />
                                <Input
                                    label="Telefon"
                                    value={profile.contact?.phone || ''}
                                    onChange={(e) => handleProfileUpdate('contact.phone', e.target.value)}
                                />
                                <Input
                                    label="Wohnort"
                                    hint={importedFrom(profile, 'location')}
                                    value={profile.location || ''}
                                    onChange={(e) => handleProfileUpdate('location', e.target.value)}
                                />
                                <Input
                                    label="Staatsangehörigkeit"
                                    value={profile.citizenship || ''}
                                    onChange={(e) => handleProfileUpdate('citizenship', e.target.value)}
                                />
                                <Input
                                    label="Geburtsdatum"
                                    hint={importedFrom(profile, 'dateOfBirth')}
                                    type="date"
                                    value={toDateInputValue(profile.dateOfBirth)}
                                    onChange={(e) => handleProfileUpdate('dateOfBirth', e.target.value)}
                                />
                            </Stack>
                        </Card>

                        <Card>
                            <Typography variant="h6" sx={{mb: 2}}>Erscheinung</Typography>
                            <Stack spacing={2}>
                                <Input
                                    label="Körpergröße"
                                    hint={importedFrom(profile, 'height')}
                                    value={profile.height || ''}
                                    onChange={(e) => handleProfileUpdate('height', e.target.value)}
                                    placeholder="z.B. 175 cm"
                                />
                                <Input
                                    label="Gewicht"
                                    hint={importedFrom(profile, 'weight')}
                                    value={profile.weight || ''}
                                    onChange={(e) => handleProfileUpdate('weight', e.target.value)}
                                    placeholder="z.B. 70 kg"
                                />
                                <Input
                                    label="Augenfarbe"
                                    hint={importedFrom(profile, 'eyeColor')}
                                    value={profile.eyeColor || ''}
                                    onChange={(e) => handleProfileUpdate('eyeColor', e.target.value)}
                                />
                                <Input
                                    label="Haarfarbe"
                                    hint={importedFrom(profile, 'hairColor')}
                                    value={profile.hairColor || ''}
                                    onChange={(e) => handleProfileUpdate('hairColor', e.target.value)}
                                />
                                <Input
                                    label="Spielalter"
                                    hint={importedFrom(profile, 'actingAge')}
                                    value={profile.actingAge || ''}
                                    onChange={(e) => handleProfileUpdate('actingAge', e.target.value)}
                                    placeholder="z.B. 25-35"
                                />
                            </Stack>
                        </Card>

                        <Card>
                            <Typography variant="h6" sx={{mb: 2}}>Kontakt & Vertretung</Typography>
                            <Stack spacing={2}>
                                <Input
                                    label="Agentur Name"
                                    value={profile.agent?.name || ''}
                                    onChange={(e) => handleProfileUpdate('agent.name', e.target.value)}
                                />
                                <Input
                                    label="Agentur E-Mail"
                                    type="email"
                                    value={profile.agent?.email || ''}
                                    onChange={(e) => handleProfileUpdate('agent.email', e.target.value)}
                                />
                                <Input
                                    label="Agentur Telefon"
                                    value={profile.agent?.phone || ''}
                                    onChange={(e) => handleProfileUpdate('agent.phone', e.target.value)}
                                />
                                <Input
                                    label="Website"
                                    value={profile.socialMedia?.website || ''}
                                    onChange={(e) => handleProfileUpdate('socialMedia.website', e.target.value)}
                                />
                            </Stack>
                        </Card>

                        <Card>
                            <Typography variant="h6" sx={{mb: 2}}>Biografie</Typography>
                            <TextField
                                value={profile.biography || ''}
                                onChange={(e) => handleProfileUpdate('biography', e.target.value)}
                                multiline
                                rows={6}
                                fullWidth
                                size="small"
                                placeholder="Beschreiben Sie Ihre Erfahrungen, Ihren Stil und Ihre Leidenschaft für die Schauspielerei..."
                            />
                        </Card>
                    </Box>
                )}

                {/* Photos & setcard */}
                {activeTab === 'photos' && (
                    <Card>
                        <Stack direction="row" sx={{mb: 2, alignItems: 'center', justifyContent: 'space-between'}}>
                            <Typography variant="h6">Setcard</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {profile.setcard.lastUpdated
                                    && `Zuletzt aktualisiert: ${new Date(profile.setcard.lastUpdated).toLocaleDateString('de-DE')}`}
                            </Typography>
                        </Stack>
                        <Box sx={columns({xs: 2, md: 3})}>
                            {profile.setcard.photos.map(photo => (
                                <Box key={photo.id} sx={{'&:hover .photo-actions': {opacity: 1}}}>
                                    <Box sx={{position: 'relative'}}>
                                        <Box
                                            sx={{
                                                aspectRatio: '1 / 1', bgcolor: 'grey.200',
                                                borderRadius: 2, overflow: 'hidden',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                        >
                                            {photo.url ? (
                                                <Box
                                                    component="img"
                                                    src={photo.url}
                                                    alt={photo.description}
                                                    sx={{width: '100%', height: '100%', objectFit: 'cover'}}
                                                />
                                            ) : (
                                                <Stack sx={{alignItems: 'center', color: 'text.disabled'}}>
                                                    <ImageIcon size={32}/>
                                                    <Typography variant="caption" sx={{mt: 1, px: 1, textAlign: 'center'}}>
                                                        {photo.description}
                                                    </Typography>
                                                </Stack>
                                            )}
                                        </Box>
                                        <Stack
                                            className="photo-actions"
                                            direction="row"
                                            spacing={1}
                                            sx={{alignItems: 'center', justifyContent: 'center', position: 'absolute', inset: 0, borderRadius: 2,
                                                bgcolor: 'rgba(0,0,0,0.5)', opacity: 0,
                                                transition: 'opacity 200ms'}}
                                        >
                                            <IconButton
                                                onClick={() => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.accept = 'image/*';
                                                    input.onchange = (e) => handleSetcardPhotoUpload(photo.id, e.target.files[0]);
                                                    input.click();
                                                }}
                                                disabled={uploading}
                                                sx={{bgcolor: 'primary.main', color: 'common.white', '&:hover': {bgcolor: 'primary.dark'}}}
                                                size="small"
                                            >
                                                {uploading ? <CircularProgress size={16} color="inherit"/> : <Upload size={16}/>}
                                            </IconButton>
                                            {photo.url && (
                                                <IconButton
                                                    onClick={() => handleSetcardPhotoDelete(photo.id)}
                                                    disabled={uploading}
                                                    sx={{bgcolor: 'error.main', color: 'common.white', '&:hover': {bgcolor: 'error.dark'}}}
                                                    size="small"
                                                >
                                                    <Trash2 size={16}/>
                                                </IconButton>
                                            )}
                                        </Stack>
                                    </Box>
                                    <Box sx={{mt: 1}}>
                                        <Typography variant="body2" fontWeight={500}>{photo.type}</Typography>
                                        <Typography variant="caption" color="text.secondary">{photo.description}</Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Card>
                )}

                {/* Work history */}
                {activeTab === 'work' && (
                    <Stack spacing={2}>
                        <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                            <Typography variant="h6">Berufserfahrung</Typography>
                            <Button onClick={() => openModal('work')} icon={Plus}>
                                Projekt hinzufügen
                            </Button>
                        </Stack>
                        {profile.workHistory?.map(work => (
                            <Card key={work.id}>
                                <Stack direction="row" spacing={2} sx={{alignItems: 'flex-start', justifyContent: 'space-between'}}>
                                    <Box sx={{flex: 1}}>
                                        <Typography variant="h6">{work.title}</Typography>
                                        <Stack
                                            direction="row" spacing={1}
                                            sx={{mt: 0.5, alignItems: 'center', flexWrap: 'wrap', color: 'text.secondary', fontSize: 14}}
                                        >
                                            <span>{work.production}</span>
                                            <span>•</span>
                                            <span>{work.role}</span>
                                            <span>•</span>
                                            <Badge>{work.type}</Badge>
                                            <span>•</span>
                                            <span>{work.year}</span>
                                        </Stack>
                                        {work.director && (
                                            <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
                                                Regie: {work.director}
                                            </Typography>
                                        )}
                                        {work.description && (
                                            <Typography variant="body2" sx={{mt: 1}}>{work.description}</Typography>
                                        )}
                                        <Stack
                                            direction="row" spacing={2}
                                            sx={{mt: 1, color: 'text.secondary', fontSize: 12}}
                                        >
                                            {work.location && <Detail icon={MapPin}>{work.location}</Detail>}
                                            {work.duration && <Detail icon={Calendar}>{work.duration}</Detail>}
                                        </Stack>
                                    </Box>
                                    <Stack direction="row" spacing={1}>
                                        <Button size="sm" variant="outline" onClick={() => openModal('work', work)} icon={Edit2}/>
                                        <Button size="sm" variant="danger" onClick={() => handleDelete('work', work.id)} icon={Trash2}/>
                                    </Stack>
                                </Stack>
                            </Card>
                        ))}
                        {!profile.workHistory?.length && (
                            <Empty
                                icon={Briefcase}
                                text="Noch keine Berufserfahrung hinzugefügt."
                                action="Erstes Projekt hinzufügen"
                                onAdd={() => openModal('work')}
                            />
                        )}
                    </Stack>
                )}

                {/* Education */}
                {activeTab === 'education' && (
                    <Stack spacing={2}>
                        <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                            <Typography variant="h6">Ausbildung</Typography>
                            <Button onClick={() => openModal('education')} icon={Plus}>
                                Ausbildung hinzufügen
                            </Button>
                        </Stack>
                        {profile.education?.map(edu => (
                            <Card key={edu.id}>
                                <Stack direction="row" spacing={2} sx={{alignItems: 'flex-start', justifyContent: 'space-between'}}>
                                    <Box sx={{flex: 1}}>
                                        <Typography variant="h6">{edu.degree}</Typography>
                                        <Stack
                                            direction="row" spacing={1}
                                            sx={{mt: 0.5, flexWrap: 'wrap', color: 'text.secondary', fontSize: 14}}
                                        >
                                            <span>{edu.institution}</span>
                                            <span>•</span>
                                            <span>{edu.field}</span>
                                            <span>•</span>
                                            <span>{edu.startYear} - {edu.endYear}</span>
                                        </Stack>
                                        {edu.description && (
                                            <Typography variant="body2" sx={{mt: 1}}>{edu.description}</Typography>
                                        )}
                                        <Stack
                                            direction="row" spacing={2}
                                            sx={{mt: 1, color: 'text.secondary', fontSize: 12}}
                                        >
                                            {edu.location && <Detail icon={MapPin}>{edu.location}</Detail>}
                                            {edu.grade && <Detail icon={Award}>{edu.grade}</Detail>}
                                        </Stack>
                                    </Box>
                                    <Stack direction="row" spacing={1}>
                                        <Button size="sm" variant="outline" onClick={() => openModal('education', edu)} icon={Edit2}/>
                                        <Button size="sm" variant="danger" onClick={() => handleDelete('education', edu.id)} icon={Trash2}/>
                                    </Stack>
                                </Stack>
                            </Card>
                        ))}
                        {!profile.education?.length && (
                            <Empty
                                icon={GraduationCap}
                                text="Noch keine Ausbildung hinzugefügt."
                                action="Erste Ausbildung hinzufügen"
                                onAdd={() => openModal('education')}
                            />
                        )}
                    </Stack>
                )}

                {/* Skills */}
                {activeTab === 'skills' && (
                    <Box sx={columns({xs: 1, lg: 2})}>
                        <Card>
                            <Typography variant="h6" sx={{mb: 2}}>Fähigkeiten</Typography>
                            <Stack spacing={1.5}>
                                {/* Skills are plain strings in the profile schema. This block
                                    used to read skill.name / skill.years / skill.level off them,
                                    so every imported skill rendered as an empty row. */}
                                {profile.skills?.length ? profile.skills.map((skill, index) => (
                                    <Box key={index} sx={{p: 1.5, bgcolor: 'grey.50', borderRadius: 2}}>
                                        <Typography fontWeight={500}>{skill}</Typography>
                                    </Box>
                                )) : (
                                    <Typography variant="body2" color="text.secondary">
                                        Noch keine Fähigkeiten hinterlegt.
                                    </Typography>
                                )}
                            </Stack>
                        </Card>

                        <Card>
                            <Typography variant="h6" sx={{mb: 2}}>Besondere Fähigkeiten</Typography>
                            <Stack direction="row" spacing={1} sx={{flexWrap: 'wrap'}}>
                                {profile.specialSkills?.map((skill, index) => (
                                    <Badge key={index} variant="outline">{skill}</Badge>
                                ))}
                            </Stack>
                        </Card>

                        <Box sx={{gridColumn: {lg: 'span 2'}}}>
                            <Card>
                                <Typography variant="h6" sx={{mb: 2}}>Sprachen</Typography>
                                <Stack direction="row" spacing={1} sx={{flexWrap: 'wrap'}}>
                                    {/* {language, level} objects. Rendering the object itself
                                        threw "Objects are not valid as a React child" and took
                                        the whole tab down with it. */}
                                    {profile.languages?.length ? profile.languages.map((entry, index) => (
                                        <Badge key={index} color="blue">
                                            {entry.level ? `${entry.language} (${entry.level})` : entry.language}
                                        </Badge>
                                    )) : (
                                        <Typography variant="body2" color="text.secondary">
                                            Noch keine Sprachen hinterlegt.
                                        </Typography>
                                    )}
                                </Stack>
                            </Card>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Work / education modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={
                    editingItem
                        ? `${modalType === 'work' ? 'Projekt' : 'Ausbildung'} bearbeiten`
                        : `${modalType === 'work' ? 'Neues Projekt' : 'Neue Ausbildung'} hinzufügen`
                }
            >
                <Stack spacing={2}>
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
                            <Pair>
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Typ"
                                    value={formData.type || ''}
                                    onChange={(e) => handleInputChange('type', e.target.value)}
                                >
                                    <MenuItem value="">Typ auswählen</MenuItem>
                                    {WORK_TYPES.map((type) => (
                                        <MenuItem key={type} value={type}>{type}</MenuItem>
                                    ))}
                                </TextField>
                                <Input
                                    label="Jahr"
                                    value={formData.year || ''}
                                    onChange={(e) => handleInputChange('year', e.target.value)}
                                />
                            </Pair>
                            <Input
                                label="Regisseur"
                                value={formData.director || ''}
                                onChange={(e) => handleInputChange('director', e.target.value)}
                            />
                            <Pair>
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
                            </Pair>
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
                            <Pair>
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
                            </Pair>
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

                    <TextField
                        label="Beschreibung"
                        value={formData.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        multiline
                        rows={3}
                        fullWidth
                        size="small"
                        placeholder="Zusätzliche Details..."
                    />

                    <Stack direction="row" spacing={1.5} sx={{pt: 2}}>
                        <Button onClick={handleSave} disabled={saving} icon={saving ? Loader : Check}>
                            {editingItem ? 'Aktualisieren' : 'Hinzufügen'}
                        </Button>
                        <Button variant="secondary" onClick={() => setShowModal(false)} icon={X}>
                            Abbrechen
                        </Button>
                    </Stack>
                </Stack>
            </Modal>

            {/* Profile sync modal */}
            <Modal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                title="Profil synchronisieren"
            >
                <Stack spacing={2}>
                    {/*
                      This list used to promise that the profile photo, the setcard, the
                      filmography and the languages all go out. They do not. A profile
                      push writes the fields the platform's own descriptor declares -
                      for most platforms a handful - pictures are a separate step that
                      only works where an upload control has actually been read, and
                      credits go through the Vita comparison on the platforms page.
                    */}
                    <Alert severity="info">
                        <AlertTitle>Übertragen werden die Profilfelder</AlertTitle>
                        <Typography variant="body2" component="div">
                            Jede Plattform nimmt nur die Felder, die für sie eingerichtet sind -
                            meist Körpergröße, Augen- und Haarfarbe und Ähnliches.
                            <Box component="ul" sx={{mt: 1, mb: 0, pl: 2.5}}>
                                <li>Fotos laufen getrennt und nur dort, wo der Upload bekannt ist</li>
                                <li>Credits laufen über den Vita-Abgleich auf der Plattform-Seite</li>
                            </Box>
                        </Typography>
                    </Alert>

                    <Box sx={{bgcolor: 'grey.50', borderRadius: 2, p: 2}}>
                        {connectedPlatforms.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                Keine Plattformen verbunden.
                            </Typography>
                        ) : (
                            <Stack spacing={1}>
                                {connectedPlatforms.map(platform => (
                                    <Stack
                                        key={platform.id}
                                        direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                                        <Typography variant="body2" fontWeight={500}>{platform.name}</Typography>
                                        <Badge color="green">Verbunden</Badge>
                                    </Stack>
                                ))}
                            </Stack>
                        )}
                    </Box>

                    <Stack direction="row" spacing={1.5} sx={{pt: 2}}>
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
                    </Stack>
                </Stack>
            </Modal>
        </Stack>
    );
};

export default ProfileView;
