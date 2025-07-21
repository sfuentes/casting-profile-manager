import React, {useState, useMemo} from 'react';
import {
    Plus,
    Loader,
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    Edit2,
    Trash2,
    RefreshCw,
    X,
    Check,
    AlertCircle,
    Settings
} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import {Button, Modal, Input, Badge, Card, TimeInput} from './ui';

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
    const [viewMode, setViewMode] = useState('month'); // month, week, day
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showAvailabilitySettings, setShowAvailabilitySettings] = useState(false);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader size={48} className="animate-spin text-blue-600"/>
            </div>
        );
    }

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

    const getEventsForDate = (date) => {
        const dateStr = date.toISOString().split('T')[0];
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

    const getEventColor = (eventType, status, availType) => {
        if (eventType === 'booking') return 'bg-green-100 border-green-500 text-green-800';
        if (eventType === 'option') return 'bg-yellow-100 border-yellow-500 text-yellow-800';
        if (eventType === 'availability') {
            if (availType === 'available') return 'bg-blue-100 border-blue-500 text-blue-800';
            if (availType === 'partially_available') return 'bg-orange-100 border-orange-500 text-orange-800';
            return 'bg-red-100 border-red-500 text-red-800';
        }
        return 'bg-gray-100 border-gray-500 text-gray-800';
    };

    const getEventIcon = (eventType, availType) => {
        if (eventType === 'availability' && (availType === 'available' || availType === 'partially_available')) {
            return <Clock size={12} className="inline mr-1"/>;
        }
        return null;
    };

    const formatTimeRange = (startTime, endTime) => {
        if (!startTime || !endTime) return '';
        return `${startTime} - ${endTime}`;
    };

    const syncEnabledPlatforms = platforms.filter(p => p.connected && p.syncSettings.syncAvailability);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    <h1 className="text-3xl font-bold text-gray-900">Kalender</h1>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            onClick={() => navigateMonth(-1)}
                            icon={ChevronLeft}
                            size="sm"
                        />
                        <span className="text-lg font-medium min-w-[180px] text-center">
                            {currentDate.toLocaleDateString('de-DE', {month: 'long', year: 'numeric'})}
                        </span>
                        <Button
                            variant="outline"
                            onClick={() => navigateMonth(1)}
                            icon={ChevronRight}
                            size="sm"
                        />
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={() => setShowAvailabilitySettings(true)}
                        variant="outline"
                        icon={Settings}
                        size="sm"
                    />
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
                </div>
            </div>

            {/* Enhanced Legend */}
            <Card>
                <div className="flex items-center space-x-6 flex-wrap">
                    <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span className="text-sm">Buchungen</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                        <span className="text-sm">Optionen</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span className="text-sm">Verfügbar</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-orange-500 rounded"></div>
                        <span className="text-sm">Teilweise verfügbar</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <span className="text-sm">Nicht verfügbar</span>
                    </div>
                </div>
            </Card>

            {/* Calendar Grid */}
            <Card>
                <div className="grid grid-cols-7 gap-0 border border-gray-200 rounded-lg overflow-hidden">
                    {/* Header row */}
                    {['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'].map(day => (
                        <div key={day} className="bg-gray-50 p-3 text-center font-medium text-gray-700 border-b">
                            {day}
                        </div>
                    ))}

                    {/* Calendar days */}
                    {calendarDays.map((date, index) => {
                        const events = getEventsForDate(date);
                        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                            <div
                                key={index}
                                className={`min-h-[140px] p-2 border-r border-b ${
                                    isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                                } ${isToday ? 'bg-blue-50' : ''} hover:bg-gray-50`}
                            >
                                <div className={`text-sm font-medium mb-1 ${
                                    isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                                } ${isToday ? 'text-blue-600' : ''}`}>
                                    {date.getDate()}
                                </div>

                                <div className="space-y-1">
                                    {events.slice(0, 3).map((event, eventIndex) => (
                                        <div
                                            key={eventIndex}
                                            className={`text-xs p-1 rounded border-l-2 cursor-pointer hover:opacity-75 ${getEventColor(event.eventType, event.status, event.type)}`}
                                            onClick={() => openModal(event.eventType, event)}
                                        >
                                            <div className="font-medium truncate flex items-center">
                                                {getEventIcon(event.eventType, event.type)}
                                                {event.title || event.reason}
                                            </div>
                                            {event.role && (
                                                <div className="truncate opacity-75">
                                                    {event.role}
                                                </div>
                                            )}
                                            {(event.startTime && event.endTime) && (
                                                <div className="truncate opacity-75 text-xs">
                                                    {formatTimeRange(event.startTime, event.endTime)}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {events.length > 3 && (
                                        <div className="text-xs text-gray-500 p-1">
                                            +{events.length - 3} weitere
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Enhanced Event Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={
                    editingItem
                        ? `${modalType === 'booking' ? 'Buchung' : modalType === 'option' ? 'Option' : 'Verfügbarkeit'} bearbeiten`
                        : `${modalType === 'booking' ? 'Neue Buchung' : modalType === 'option' ? 'Neue Option' : 'Verfügbarkeit festlegen'}`
                }
            >
                <div className="space-y-4">
                    {modalType === 'availability' ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Verfügbarkeitstyp</label>
                                <select
                                    value={formData.type || 'available'}
                                    onChange={(e) => handleInputChange('type', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="available">Verfügbar</option>
                                    <option value="partially_available">Teilweise verfügbar</option>
                                    <option value="unavailable">Nicht verfügbar</option>
                                </select>
                            </div>

                            {formData.type !== 'unavailable' ? (
                                <Input
                                    label="Verfügbarkeitsnotiz"
                                    value={formData.reason || ''}
                                    onChange={(e) => handleInputChange('reason', e.target.value)}
                                    placeholder="z.B. Verfügbar für Castings, Flexible Zeiten"
                                />
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Grund der Nichtverfügbarkeit</label>
                                    <select
                                        value={formData.reason || ''}
                                        onChange={(e) => handleInputChange('reason', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Grund auswählen</option>
                                        <option value="Urlaub">Urlaub</option>
                                        <option value="Krankheit">Krankheit</option>
                                        <option value="Andere Verpflichtung">Andere Verpflichtung</option>
                                        <option value="Persönliche Termine">Persönliche Termine</option>
                                        <option value="Sonstiges">Sonstiges</option>
                                    </select>
                                </div>
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

                    <div className="grid grid-cols-2 gap-4">
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
                    </div>

                    {/* Time inputs - show for all types except unavailable availability */}
                    {(modalType !== 'availability' || formData.type !== 'unavailable') && (
                        <div className="grid grid-cols-2 gap-4">
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
                        </div>
                    )}

                    {/* Additional availability options */}
                    {modalType === 'availability' && formData.type !== 'unavailable' && (
                        <Card className="bg-blue-50 border border-blue-200">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">Casting-Plattform Information</h4>
                            <p className="text-xs text-blue-700 mb-3">
                                Diese Zeiten werden an verbundene Casting-Plattformen übertragen, damit Caster wissen, wann Sie verfügbar sind.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-blue-700 mb-1">Bevorzugte Anrufzeit</label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="time"
                                            value={formData.preferredCallStart || '09:00'}
                                            onChange={(e) => handleInputChange('preferredCallStart', e.target.value)}
                                            className="text-xs px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-blue-600 self-center">bis</span>
                                        <input
                                            type="time"
                                            value={formData.preferredCallEnd || '17:00'}
                                            onChange={(e) => handleInputChange('preferredCallEnd', e.target.value)}
                                            className="text-xs px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-blue-700 mb-1">Vorlaufzeit (Stunden)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="168"
                                        value={formData.minimumNotice || '24'}
                                        onChange={(e) => handleInputChange('minimumNotice', e.target.value)}
                                        className="w-full text-xs px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="24"
                                    />
                                </div>
                            </div>
                        </Card>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                        <textarea
                            value={formData.notes || ''}
                            onChange={(e) => handleInputChange('notes', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Zusätzliche Informationen..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader size={16} className="animate-spin"/> : <Check size={16}/>}
                            {editingItem ? 'Aktualisieren' : 'Speichern'}
                        </Button>
                        {editingItem && (
                            <Button
                                variant="danger"
                                onClick={() => handleDelete(editingItem)}
                                icon={Trash2}
                            >
                                Löschen
                            </Button>
                        )}
                        <Button variant="secondary" onClick={() => setShowModal(false)} icon={X}>
                            Abbrechen
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Sync Modal */}
            <Modal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
                title="Verfügbarkeit synchronisieren"
            >
                <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                        <AlertCircle className="text-blue-500 mt-1" size={20}/>
                        <div>
                            <p className="text-sm text-gray-600 mb-2">
                                Ihre aktuellen Buchungen, Optionen, Verfügbarkeitszeiten und Blockierungen werden mit folgenden Plattformen synchronisiert:
                            </p>
                            <div className="bg-blue-50 rounded p-3 text-xs text-blue-700">
                                <strong>Übertragene Daten:</strong>
                                <ul className="mt-1 space-y-1">
                                    <li>• Gebuchte Zeiten (Buchungen & Optionen)</li>
                                    <li>• Verfügbare Zeitfenster mit genauen Uhrzeiten</li>
                                    <li>• Blockierte Zeiten mit Begründung</li>
                                    <li>• Bevorzugte Kontaktzeiten</li>
                                    <li>• Minimale Vorlaufzeiten</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                        {syncEnabledPlatforms.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                Keine Plattformen für Verfügbarkeits-Sync konfiguriert.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {syncEnabledPlatforms.map(platform => (
                                    <div key={platform.id} className="flex items-center justify-between">
                                        <span className="text-sm font-medium">{platform.name}</span>
                                        <Badge color="green">Zeitbasierte Sync aktiv</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
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
                    </div>
                </div>
            </Modal>

            {/* Availability Settings Modal */}
            <Modal
                isOpen={showAvailabilitySettings}
                onClose={() => setShowAvailabilitySettings(false)}
                title="Verfügbarkeits-Einstellungen"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Konfigurieren Sie Ihre Standard-Verfügbarkeitszeiten für Casting-Plattformen.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <TimeInput
                            label="Standard Startzeit"
                            value="08:00"
                            onChange={() => {}}
                        />
                        <TimeInput
                            label="Standard Endzeit"
                            value="18:00"
                            onChange={() => {}}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <TimeInput
                            label="Bevorzugte Anrufzeit (von)"
                            value="09:00"
                            onChange={() => {}}
                        />
                        <TimeInput
                            label="Bevorzugte Anrufzeit (bis)"
                            value="17:00"
                            onChange={() => {}}
                        />
                    </div>

                    <Input
                        label="Standard Vorlaufzeit (Stunden)"
                        type="number"
                        value="24"
                        onChange={() => {}}
                    />

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="weekendBookings"
                            defaultChecked
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="weekendBookings" className="text-sm text-gray-700">
                            Wochenend-Buchungen akzeptieren
                        </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button onClick={() => setShowAvailabilitySettings(false)}>
                            Einstellungen speichern
                        </Button>
                        <Button variant="secondary" onClick={() => setShowAvailabilitySettings(false)}>
                            Abbrechen
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CalendarView;