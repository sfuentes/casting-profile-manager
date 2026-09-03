import React, {useState, useMemo} from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import {
    Plus,
    Loader,
    ChevronLeft,
    ChevronRight,
    Clock,
    Trash2,
    RefreshCw,
    X,
    Check,
    Settings
} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import {Button, Modal, Input, Badge, Card, TimeInput} from './ui';

/**
 * What each kind of entry looks like in a day cell. The palette is the same one
 * the Tailwind classes drew: bookings green, options yellow, availability blue,
 * partial orange, blocked red.
 */
const EVENT_STYLES = {
    booking: {bg: '#dcfce7', border: '#22c55e', text: '#166534'},
    option: {bg: '#fef9c3', border: '#eab308', text: '#854d0e'},
    available: {bg: '#dbeafe', border: '#3b82f6', text: '#1e40af'},
    partially_available: {bg: '#ffedd5', border: '#f97316', text: '#9a3412'},
    unavailable: {bg: '#fee2e2', border: '#ef4444', text: '#991b1b'},
    other: {bg: '#f3f4f6', border: '#6b7280', text: '#1f2937'}
};

const LEGEND = [
    {color: '#22c55e', label: 'Buchungen'},
    {color: '#eab308', label: 'Optionen'},
    {color: '#3b82f6', label: 'Verfügbar'},
    {color: '#f97316', label: 'Teilweise verfügbar'},
    {color: '#ef4444', label: 'Nicht verfügbar'}
];

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const UNAVAILABLE_REASONS = ['Urlaub', 'Krankheit', 'Andere Verpflichtung', 'Persönliche Termine', 'Sonstiges'];

/** Two fields side by side - the shape this dialog uses over and over. */
const Pair = ({children}) => (
    <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2}}>
        {children}
    </Box>
);

const CalendarView = () => {
    const {
        bookings,
        options,
        availability,
        loading,
        saving,
        addBooking,
        addOption,
        addAvailability,
        updateBooking,
        updateOption,
        updateAvailability,
        deleteBooking,
        deleteOption,
        deleteAvailability,
        syncAvailabilityToPlatforms,
        platforms
    } = useAppContext();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('booking');
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showAvailabilitySettings, setShowAvailabilitySettings] = useState(false);

    // Calendar logic
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startOfCalendar = new Date(startOfMonth);
    startOfCalendar.setDate(startOfCalendar.getDate() - startOfCalendar.getDay());
    const endOfCalendar = new Date(endOfMonth);
    endOfCalendar.setDate(endOfCalendar.getDate() + (6 - endOfCalendar.getDay()));

    const calendarDays = useMemo(() => {
        const days = [];
        const current = new Date(startOfCalendar);

        while (current <= endOfCalendar) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return days;
    }, [startOfCalendar, endOfCalendar]);

    if (loading) {
        return (
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256}}>
                <CircularProgress size={48}/>
            </Box>
        );
    }

    const getEventsForDate = (date) => {
        const events = [];

        // Add bookings
        bookings.forEach(booking => {
            const startDate = new Date(booking.startDate);
            const endDate = new Date(booking.endDate);
            if (date >= startDate && date <= endDate) {
                events.push({...booking, eventType: 'booking'});
            }
        });

        // Add options
        options.forEach(option => {
            const startDate = new Date(option.startDate);
            const endDate = new Date(option.endDate);
            if (date >= startDate && date <= endDate) {
                events.push({...option, eventType: 'option'});
            }
        });

        // Add availability
        availability.forEach(avail => {
            const startDate = new Date(avail.startDate);
            const endDate = new Date(avail.endDate);
            if (date >= startDate && date <= endDate) {
                events.push({...avail, eventType: 'availability'});
            }
        });

        return events;
    };

    const openModal = (type, item = null) => {
        setModalType(type);
        setEditingItem(item);

        // Set default times based on type
        let defaultData = item || {};
        if (!item && type === 'availability' && !defaultData.startTime) {
            defaultData = {
                ...defaultData,
                startTime: '09:00',
                endTime: '17:00',
                type: 'available'
            };
        } else if (!item && (type === 'booking' || type === 'option') && !defaultData.startTime) {
            defaultData = {
                ...defaultData,
                startTime: '08:00',
                endTime: '18:00'
            };
        }

        setFormData(defaultData);
        setShowModal(true);
    };

    const handleSave = async () => {
        try {
            if (editingItem) {
                // Update existing item
                if (modalType === 'booking') {
                    await updateBooking(editingItem.id, formData);
                } else if (modalType === 'option') {
                    await updateOption(editingItem.id, formData);
                } else if (modalType === 'availability') {
                    await updateAvailability(editingItem.id, formData);
                }
            } else {
                // Create new item
                if (modalType === 'booking') {
                    await addBooking({...formData, status: 'confirmed'});
                } else if (modalType === 'option') {
                    await addOption({...formData, status: 'pending'});
                } else if (modalType === 'availability') {
                    await addAvailability({...formData, type: formData.type || 'available'});
                }
            }
            setShowModal(false);
            setFormData({});
            setEditingItem(null);
        } catch (err) {
            console.error('Failed to save:', err);
        }
    };

    const handleDelete = async (item) => {
        if (!confirm('Möchten Sie diesen Eintrag wirklich löschen?')) return;

        try {
            if (item.eventType === 'booking') {
                await deleteBooking(item.id);
            } else if (item.eventType === 'option') {
                await deleteOption(item.id);
            } else if (item.eventType === 'availability') {
                await deleteAvailability(item.id);
            }
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({...prev, [field]: value}));
    };

    const navigateMonth = (direction) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + direction);
            return newDate;
        });
    };

    const handleSyncAvailability = async () => {
        try {
            const syncedCount = await syncAvailabilityToPlatforms();
            setShowSyncModal(false);
            alert(`Verfügbarkeit erfolgreich mit ${syncedCount} Plattformen synchronisiert!`);
        } catch (err) {
            console.error('Sync failed:', err);
        }
    };

    const eventStyle = (event) => (event.eventType === 'availability'
        ? EVENT_STYLES[event.type] || EVENT_STYLES.other
        : EVENT_STYLES[event.eventType] || EVENT_STYLES.other);

    const formatTimeRange = (startTime, endTime) => {
        if (!startTime || !endTime) return '';
        return `${startTime} - ${endTime}`;
    };

    const syncEnabledPlatforms = platforms.filter(p => p.connected && p.syncSettings.syncAvailability);

    return (
        <Stack spacing={3}>
            {/* Header */}
            <Stack direction="row" spacing={2} sx={{alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                <Stack direction="row" spacing={2} sx={{alignItems: 'center'}}>
                    <Typography variant="h4" component="h1" fontWeight={700}>Kalender</Typography>
                    <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
                        <Button variant="outline" onClick={() => navigateMonth(-1)} icon={ChevronLeft} size="sm"/>
                        <Typography sx={{minWidth: 180, textAlign: 'center', fontWeight: 500}}>
                            {currentDate.toLocaleDateString('de-DE', {month: 'long', year: 'numeric'})}
                        </Typography>
                        <Button variant="outline" onClick={() => navigateMonth(1)} icon={ChevronRight} size="sm"/>
                    </Stack>
                </Stack>
                <Stack direction="row" spacing={1.5} sx={{flexWrap: 'wrap'}}>
                    <Button onClick={() => setShowAvailabilitySettings(true)} variant="outline" icon={Settings} size="sm"/>
                    <Button
                        onClick={() => setShowSyncModal(true)}
                        variant="outline"
                        icon={RefreshCw}
                        disabled={syncEnabledPlatforms.length === 0}
                    >
                        Verfügbarkeit sync ({syncEnabledPlatforms.length})
                    </Button>
                    <Button onClick={() => openModal('availability')} variant="outline" icon={Plus}>
                        Verfügbarkeit
                    </Button>
                    <Button onClick={() => openModal('option')} variant="secondary" icon={Plus}>
                        Option
                    </Button>
                    <Button onClick={() => openModal('booking')} icon={Plus}>
                        Buchung
                    </Button>
                </Stack>
            </Stack>

            {/* Legend */}
            <Card>
                <Stack direction="row" spacing={3} sx={{alignItems: 'center', flexWrap: 'wrap'}}>
                    {LEGEND.map(({color, label}) => (
                        <Stack key={label} direction="row" spacing={1} sx={{alignItems: 'center'}}>
                            <Box sx={{width: 16, height: 16, bgcolor: color, borderRadius: 0.5}}/>
                            <Typography variant="body2">{label}</Typography>
                        </Stack>
                    ))}
                </Stack>
            </Card>

            {/* Calendar grid */}
            <Card>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2,
                        overflow: 'hidden'
                    }}
                >
                    {WEEKDAYS.map(day => (
                        <Box
                            key={day}
                            sx={{
                                bgcolor: 'grey.50', p: 1.5, textAlign: 'center',
                                fontWeight: 500, color: 'text.secondary',
                                borderBottom: 1, borderColor: 'divider'
                            }}
                        >
                            {day}
                        </Box>
                    ))}

                    {calendarDays.map((date, index) => {
                        const events = getEventsForDate(date);
                        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                            <Box
                                key={index}
                                sx={{
                                    minHeight: 140,
                                    p: 1,
                                    borderRight: 1,
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    bgcolor: isToday ? 'primary.50' : (isCurrentMonth ? 'background.paper' : 'grey.50'),
                                    '&:hover': {bgcolor: 'grey.100'}
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 500,
                                        mb: 0.5,
                                        color: isToday
                                            ? 'primary.main'
                                            : (isCurrentMonth ? 'text.primary' : 'text.disabled')
                                    }}
                                >
                                    {date.getDate()}
                                </Typography>

                                <Stack spacing={0.5}>
                                    {events.slice(0, 3).map((event, eventIndex) => {
                                        const style = eventStyle(event);
                                        return (
                                            <Box
                                                key={eventIndex}
                                                onClick={() => openModal(event.eventType, event)}
                                                sx={{
                                                    fontSize: 12,
                                                    p: 0.5,
                                                    borderRadius: 1,
                                                    borderLeft: '2px solid',
                                                    borderLeftColor: style.border,
                                                    bgcolor: style.bg,
                                                    color: style.text,
                                                    cursor: 'pointer',
                                                    '&:hover': {opacity: 0.75}
                                                }}
                                            >
                                                <Box sx={{fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                    {event.eventType === 'availability'
                                                        && (event.type === 'available' || event.type === 'partially_available')
                                                        && <Clock size={12} style={{display: 'inline', marginRight: 4}}/>}
                                                    {event.title || event.reason}
                                                </Box>
                                                {event.role && (
                                                    <Box sx={{opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                        {event.role}
                                                    </Box>
                                                )}
                                                {(event.startTime && event.endTime) && (
                                                    <Box sx={{opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                        {formatTimeRange(event.startTime, event.endTime)}
                                                    </Box>
                                                )}
                                            </Box>
                                        );
                                    })}
                                    {events.length > 3 && (
                                        <Typography variant="caption" color="text.secondary" sx={{p: 0.5}}>
                                            +{events.length - 3} weitere
                                        </Typography>
                                    )}
                                </Stack>
                            </Box>
                        );
                    })}
                </Box>
            </Card>

            {/* Event modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={
                    editingItem
                        ? `${modalType === 'booking' ? 'Buchung' : modalType === 'option' ? 'Option' : 'Verfügbarkeit'} bearbeiten`
                        : `${modalType === 'booking' ? 'Neue Buchung' : modalType === 'option' ? 'Neue Option' : 'Verfügbarkeit festlegen'}`
                }
            >
                <Stack spacing={2}>
                    {modalType === 'availability' ? (
                        <>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                label="Verfügbarkeitstyp"
                                value={formData.type || 'available'}
                                onChange={(e) => handleInputChange('type', e.target.value)}
                            >
                                <MenuItem value="available">Verfügbar</MenuItem>
                                <MenuItem value="partially_available">Teilweise verfügbar</MenuItem>
                                <MenuItem value="unavailable">Nicht verfügbar</MenuItem>
                            </TextField>

                            {formData.type !== 'unavailable' ? (
                                <Input
                                    label="Verfügbarkeitsnotiz"
                                    value={formData.reason || ''}
                                    onChange={(e) => handleInputChange('reason', e.target.value)}
                                    placeholder="z.B. Verfügbar für Castings, Flexible Zeiten"
                                />
                            ) : (
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Grund der Nichtverfügbarkeit"
                                    value={formData.reason || ''}
                                    onChange={(e) => handleInputChange('reason', e.target.value)}
                                    helperText="Bleibt in dieser App - an Plattformen geht nur, dass der Zeitraum blockiert ist."
                                >
                                    <MenuItem value="">Grund auswählen</MenuItem>
                                    {UNAVAILABLE_REASONS.map((reason) => (
                                        <MenuItem key={reason} value={reason}>{reason}</MenuItem>
                                    ))}
                                </TextField>
                            )}
                        </>
                    ) : (
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
                            <Input
                                label="Ort"
                                value={formData.location || ''}
                                onChange={(e) => handleInputChange('location', e.target.value)}
                            />
                            <Input
                                label="Honorar"
                                value={formData.fee || ''}
                                onChange={(e) => handleInputChange('fee', e.target.value)}
                            />
                        </>
                    )}

                    <Pair>
                        <Input
                            label="Startdatum"
                            type="date"
                            value={formData.startDate || ''}
                            onChange={(e) => handleInputChange('startDate', e.target.value)}
                        />
                        <Input
                            label="Enddatum"
                            type="date"
                            value={formData.endDate || ''}
                            onChange={(e) => handleInputChange('endDate', e.target.value)}
                        />
                    </Pair>

                    {/* Time inputs - show for all types except unavailable availability */}
                    {(modalType !== 'availability' || formData.type !== 'unavailable') && (
                        <Pair>
                            <TimeInput
                                label="Startzeit"
                                value={formData.startTime || ''}
                                onChange={(e) => handleInputChange('startTime', e.target.value)}
                            />
                            <TimeInput
                                label="Endzeit"
                                value={formData.endTime || ''}
                                onChange={(e) => handleInputChange('endTime', e.target.value)}
                            />
                        </Pair>
                    )}

                    {/* Additional availability options */}
                    {modalType === 'availability' && formData.type !== 'unavailable' && (
                        <Alert severity="info" icon={false}>
                            <AlertTitle sx={{fontSize: 14}}>Kontaktzeiten</AlertTitle>
                            <Typography variant="caption" display="block" sx={{mb: 1.5}}>
                                Diese Angaben bleiben in dieser App. An die Casting-Plattformen geht
                                ausschließlich, welche Zeiträume blockiert sind.
                            </Typography>
                            <Pair>
                                <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
                                    <TimeInput
                                        label="Anruf ab"
                                        value={formData.preferredCallStart || '09:00'}
                                        onChange={(e) => handleInputChange('preferredCallStart', e.target.value)}
                                    />
                                    <TimeInput
                                        label="bis"
                                        value={formData.preferredCallEnd || '17:00'}
                                        onChange={(e) => handleInputChange('preferredCallEnd', e.target.value)}
                                    />
                                </Stack>
                                <Input
                                    label="Vorlaufzeit (Stunden)"
                                    type="number"
                                    value={formData.minimumNotice || '24'}
                                    onChange={(e) => handleInputChange('minimumNotice', e.target.value)}
                                />
                            </Pair>
                        </Alert>
                    )}

                    <TextField
                        label="Notizen"
                        value={formData.notes || ''}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        multiline
                        rows={3}
                        fullWidth
                        size="small"
                        placeholder="Zusätzliche Informationen..."
                    />

                    <Stack direction="row" spacing={1.5} sx={{pt: 2}}>
                        <Button onClick={handleSave} disabled={saving} icon={saving ? Loader : Check}>
                            {editingItem ? 'Aktualisieren' : 'Speichern'}
                        </Button>
                        {editingItem && (
                            <Button variant="danger" onClick={() => handleDelete(editingItem)} icon={Trash2}>
                                Löschen
                            </Button>
                        )}
                        <Button variant="secondary" onClick={() => setShowModal(false)} icon={X}>
                            Abbrechen
                        </Button>
                    </Stack>
                </Stack>
            </Modal>

            {/* Sync modal */}
            <Modal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                title="Verfügbarkeit synchronisieren"
            >
                <Stack spacing={2}>
                    {/*
                      This list used to promise the platforms were sent blocked times
                      "mit Begründung", the preferred call hours and the minimum notice.
                      None of that leaves the app: ConnectorService reduces the calendar
                      to start/end pairs before any connector sees it, and merges them,
                      so a platform learns that a period is not bookable and nothing
                      else. Saying otherwise here told the user their reasons were
                      being published.
                    */}
                    <Alert severity="info">
                        <AlertTitle>Übertragen wird nur, wann Sie blockiert sind</AlertTitle>
                        <Typography variant="body2" component="div">
                            Aus Buchungen, Optionen und Nichtverfügbarkeiten werden zusammenhängende
                            Zeiträume gebildet und als reine Von-Bis-Angaben übertragen.
                            <Box component="ul" sx={{mt: 1, mb: 0, pl: 2.5}}>
                                <li>Nicht übertragen: Titel, Produktion, Rolle und Honorar</li>
                                <li>Nicht übertragen: der Grund einer Nichtverfügbarkeit und Ihre Notizen</li>
                                <li>Nicht übertragen: ob es eine feste Buchung oder eine Option ist</li>
                            </Box>
                        </Typography>
                    </Alert>

                    <Box sx={{bgcolor: 'grey.50', borderRadius: 2, p: 2}}>
                        {syncEnabledPlatforms.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                Keine Plattformen für Verfügbarkeits-Sync konfiguriert.
                            </Typography>
                        ) : (
                            <Stack spacing={1}>
                                {syncEnabledPlatforms.map(platform => (
                                    <Stack
                                        key={platform.id}
                                        direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                                        <Typography variant="body2" fontWeight={500}>{platform.name}</Typography>
                                        <Badge color="green">Blockzeiten-Sync aktiv</Badge>
                                    </Stack>
                                ))}
                            </Stack>
                        )}
                    </Box>

                    <Stack direction="row" spacing={1.5} sx={{pt: 2}}>
                        <Button
                            onClick={handleSyncAvailability}
                            disabled={syncEnabledPlatforms.length === 0 || saving}
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

            {/* Availability settings modal */}
            <Modal
                isOpen={showAvailabilitySettings}
                onClose={() => setShowAvailabilitySettings(false)}
                title="Verfügbarkeits-Einstellungen"
            >
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        Konfigurieren Sie Ihre Standard-Verfügbarkeitszeiten für Casting-Plattformen.
                    </Typography>

                    <Pair>
                        <TimeInput label="Standard Startzeit" value="08:00" onChange={() => {}}/>
                        <TimeInput label="Standard Endzeit" value="18:00" onChange={() => {}}/>
                    </Pair>

                    <Pair>
                        <TimeInput label="Bevorzugte Anrufzeit (von)" value="09:00" onChange={() => {}}/>
                        <TimeInput label="Bevorzugte Anrufzeit (bis)" value="17:00" onChange={() => {}}/>
                    </Pair>

                    <Input label="Standard Vorlaufzeit (Stunden)" type="number" value="24" onChange={() => {}}/>

                    <FormControlLabel
                        control={<Checkbox defaultChecked id="weekendBookings"/>}
                        label={<Typography variant="body2">Wochenend-Buchungen akzeptieren</Typography>}
                    />

                    <Stack direction="row" spacing={1.5} sx={{pt: 2}}>
                        <Button onClick={() => setShowAvailabilitySettings(false)}>
                            Einstellungen speichern
                        </Button>
                        <Button variant="secondary" onClick={() => setShowAvailabilitySettings(false)}>
                            Abbrechen
                        </Button>
                    </Stack>
                </Stack>
            </Modal>
        </Stack>
    );
};

export default CalendarView;
