// Enhanced availability data structure with time-based availability
export const initialAvailability = [
    {
        id: 1,
        startDate: '2025-07-22',
        endDate: '2025-07-24',
        type: 'unavailable',
        reason: 'Urlaub',
        notes: 'Familienzeit'
    },
    {
        id: 2,
        startDate: '2025-08-10',
        endDate: '2025-08-15',
        type: 'unavailable',
        reason: 'Andere Verpflichtung',
        notes: 'Private Termine'
    },
    {
        id: 3,
        startDate: '2025-07-26',
        endDate: '2025-07-28',
        type: 'available',
        startTime: '09:00',
        endTime: '17:00',
        reason: 'Verfügbar',
        notes: 'Flexibel für Castings und Drehs'
    },
    {
        id: 4,
        startDate: '2025-08-01',
        endDate: '2025-08-07',
        type: 'partially_available',
        startTime: '14:00',
        endTime: '18:00',
        reason: 'Teilweise verfügbar',
        notes: 'Nur nachmittags verfügbar'
    }
];

export const defaultAvailabilitySettings = {
    defaultStartTime: '08:00',
    defaultEndTime: '18:00',
    allowWeekendBookings: true,
    minimumNotice: '24', // hours
    maxDailyHours: '12',
    preferredCallTimes: {
        start: '09:00',
        end: '17:00'
    },
    timezone: 'Europe/Berlin'
};