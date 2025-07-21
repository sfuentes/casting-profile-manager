// Initial Data (used as fallback)
export const initialProfile = {
    name: 'Max Mustermann',
    email: 'max@example.com',
    phone: '+49 123 456789',
    location: 'Berlin',
    languages: ['Deutsch', 'Englisch', 'Französisch'],
    height: '180 cm',
    weight: '75 kg',
    eyeColor: 'Braun',
    hairColor: 'Dunkelbraun',
    age: '25-35',
    birthDate: '1990-05-15',
    nationality: 'Deutsch',
    residence: 'Berlin, Deutschland',
    agentName: '',
    agentEmail: '',
    agentPhone: '',
    website: '',
    socialMedia: {
        instagram: '',
        imdb: '',
        facebook: '',
        linkedin: ''
    },
    biography: 'Erfahrener Schauspieler mit Leidenschaft für Theater und Film. Spezialisiert auf charakterstarke Rollen und vielseitige Darstellungen.',
    avatar: null,
    setcard: {
        mainPhoto: null,
        photos: [
            {id: 1, url: null, type: 'Portrait', description: 'Hauptbild', category: 'headshot'},
            {id: 2, url: null, type: 'Ganzkörper', description: 'Business Look', category: 'body'},
            {id: 3, url: null, type: 'Profil', description: 'Seitenprofil', category: 'profile'},
            {id: 4, url: null, type: 'Charakter', description: 'Casual Look', category: 'character'},
            {id: 5, url: null, type: 'Action', description: 'Bewegung/Sport', category: 'action'},
            {id: 6, url: null, type: 'Close-Up', description: 'Nahaufnahme', category: 'closeup'}
        ],
        lastUpdated: null
    },
    workHistory: [
        {
            id: 1,
            title: 'Tatort: Berliner Weisse',
            production: 'ARD',
            role: 'Kommissar Weber',
            type: 'TV-Serie',
            year: '2024',
            director: 'Anna Schmidt',
            description: 'Hauptrolle als Ermittler in der beliebten Krimi-Serie',
            location: 'Berlin',
            duration: '6 Monate'
        },
        {
            id: 2,
            title: 'Der Besuch der alten Dame',
            production: 'Deutsches Theater Berlin',
            role: 'Alfred Ill',
            type: 'Theater',
            year: '2023',
            director: 'Thomas Müller',
            description: 'Hauptrolle in der Dürrenmatt-Inszenierung',
            location: 'Berlin',
            duration: '4 Monate'
        }
    ],
    education: [
        {
            id: 1,
            institution: 'Hochschule für Schauspielkunst Ernst Busch',
            degree: 'Diplom Schauspiel',
            field: 'Schauspiel',
            startYear: '2010',
            endYear: '2014',
            location: 'Berlin',
            description: 'Studium der Schauspielkunst mit Schwerpunkt Theater und Film',
            grade: 'Sehr gut (1,2)'
        },
        {
            id: 2,
            institution: 'Schauspielstudio München',
            degree: 'Zertifikat',
            field: 'Kamera-Schauspiel',
            startYear: '2009',
            endYear: '2010',
            location: 'München',
            description: 'Intensivkurs für Film- und TV-Schauspiel',
            grade: 'Ausgezeichnet'
        }
    ],
    skills: [
        {id: 1, name: 'Theater', level: 'Profi', years: 10},
        {id: 2, name: 'Film/TV', level: 'Profi', years: 8},
        {id: 3, name: 'Synchronisation', level: 'Fortgeschritten', years: 5},
        {id: 4, name: 'Tanz', level: 'Grundkenntnisse', years: 3},
        {id: 5, name: 'Gesang', level: 'Fortgeschritten', years: 6}
    ],
    specialSkills: [
        'Akrobatik',
        'Motorradfahren',
        'Kampfsport',
        'Reiten',
        'Klavier',
        'Französisch (fließend)',
        'Englisch (verhandlungssicher)'
    ]
};