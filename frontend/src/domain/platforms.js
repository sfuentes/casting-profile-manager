/**
 * What the app knows about a platform, without any React in it.
 *
 * These were inline helpers in PlatformsView. They are pure functions of a
 * platform record or an imported value, they are the things most likely to be
 * wrong in a way nobody notices, and none of them need a component to be
 * checked - which is the whole reason they live here now.
 */

/**
 * Whether a platform has an automated integration, and whether that integration
 * talks to an API rather than driving a browser.
 *
 * Both were previously read as `platform.agentCapable` / `platform.hasAPI`,
 * which are not fields on what the API returns - the stored record carries them
 * under `meta`, and the connector manifests (the source of truth since the
 * catalogue endpoint landed) do not carry them at all. Every check was
 * therefore permanently false: the summary tiles reported 0 agent-capable
 * platforms while six connectors were registered and healthy.
 */
export const isAutomated = (platform) => Boolean(platform?.authType) && platform.authType !== 'manual';
export const isApiBased = (platform) => platform?.authType === 'apiKey';

/**
 * What a platform's connector can do, straight from its manifest.
 *
 * Filling a form is a different job from parsing one, and a capability the
 * connector does not declare would be a button in the UI that can only fail.
 */
export const canImportProfile = (platform) => Boolean(platform?.capabilities?.includes('pullProfile'));
export const canSyncCredits = (platform) => Boolean(platform?.capabilities?.includes('pushWorkHistory'));

/**
 * Whether the app already holds credentials for a platform.
 *
 * `toJSON` never sends the secrets themselves, only these flags - which is
 * exactly enough to know that a login can be retried without asking the user to
 * type their password again.
 */
export const hasStoredCredentials = (platform) => Boolean(
    platform?.authData?.hasPassword || platform?.authData?.hasApiKey || platform?.authData?.hasToken
);

/** How stale a connected platform's last sync is, as a badge colour. */
export const platformStatusColor = (platform) => {
    if (!platform?.connected) return 'gray';
    if (platform.lastSync) {
        const daysSinceSync = (new Date() - new Date(platform.lastSync)) / (1000 * 60 * 60 * 24);
        if (daysSinceSync > 7) return 'yellow';
    }
    return 'green';
};

export const connectionTypeText = (platform) => {
    if (platform?.authType === 'manual') return 'Manuell';
    if (platform?.authType === 'apiKey') return 'API-Integration';
    if (platform?.authType === 'credentials') return 'Agent-basiert';
    // Backstage. The registry has said `oauth` since it was added; the list did
    // not, so the one platform whose sign-in is precisely known was labelled
    // "Unbekannt". It is not automated and deliberately so - see CLAUDE.md.
    if (platform?.authType === 'oauth') return 'Google-Login';
    return 'Unbekannt';
};

const SYNC_INTERVALS = {
    realtime: 'Echtzeit',
    hourly: 'Stündlich',
    daily: 'Täglich',
    weekly: 'Wöchentlich',
    manual: 'Manuell'
};

export const syncIntervalText = (interval) => SYNC_INTERVALS[interval] || interval;

/** German labels for the profile fields an import can return. */
export const IMPORT_FIELD_LABELS = {
    name: 'Name',
    firstName: 'Vorname',
    lastName: 'Nachname',
    gender: 'Geschlecht',
    dateOfBirth: 'Geburtsdatum',
    biography: 'Biografie',
    height: 'Körpergröße (cm)',
    weight: 'Gewicht',
    eyeColor: 'Augenfarbe',
    hairColor: 'Haarfarbe',
    location: 'Wohnort',
    citizenship: 'Staatsangehörigkeit',
    languages: 'Sprachen',
    skills: 'Fähigkeiten',
    socialMedia: 'Social Media',
    contact: 'Kontakt',
    workHistory: 'Vita / Engagements',
    education: 'Ausbildung',
    languageLevel: 'Sprachniveau'
};

export const importFieldLabel = (key) => IMPORT_FIELD_LABELS[key] || key;

/**
 * Where an imported value came from, in one line.
 *
 * The server sends { platform, platformName, location }. Older imports stored a
 * bare locator string, so both shapes are read - a profile imported before this
 * existed should still say what it can rather than render "[object Object]".
 */
export const sourceLabel = (source) => {
    if (!source) return '';
    if (typeof source === 'string') return source;
    const where = source.location ? ` · ${source.location}` : '';
    return `${source.platformName || source.platform || 'Plattform'}${where}`;
};

/**
 * A short, readable preview of an imported value.
 *
 * Every branch here exists because a shape actually turned up: languages are
 * {language, level} objects, education entries carry an institution, and
 * rendering either of them directly threw "Objects are not valid as a React
 * child" and took the dialog down with it.
 */
export const previewImported = (value) => {
    if (Array.isArray(value)) {
        if (value.length === 0) return '-';
        if (typeof value[0] === 'string') return value.join(', ');
        if (value[0].language) return value.map(l => `${l.language} (${l.level})`).join(', ');
        if (value[0].institution) return value.map(e => e.institution).join(' · ');
        return `${value.length} Einträge`;
    }
    if (value && typeof value === 'object') {
        return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ');
    }
    return String(value);
};

/**
 * What a connector can actually do, in words, from the registry's own answer.
 *
 * The platform list used to work this out from `platform.features`, which the
 * API does not send - so "Foto-Upload" and "Verfügbarkeit" were never shown for
 * anything, and the two that were left came out of `isAutomated` and
 * `isApiBased`, which is one badge repeated on every browser-driven platform.
 *
 * `capabilities` is different: AppContext merges it in from `/platforms/catalog`,
 * it is the manifest's own list, and it differs per platform because it was
 * written down per platform - a connector declares a capability only once
 * somebody has read the page it needs. So this is the one place in the UI that
 * can say "Filmmakers can import a profile but cannot push a calendar" and be
 * right about it.
 */
export const CAPABILITY_LABELS = {
    verify: 'Login prüfen',
    pullProfile: 'Profil importieren',
    pushProfile: 'Profil übertragen',
    pushMedia: 'Bilder & Videos übertragen',
    pushAvailability: 'Blockzeiten übertragen',
    pushWorkHistory: 'Vita abgleichen'
};

export const capabilityLabels = (platform) => (platform?.capabilities || [])
    .map((name) => CAPABILITY_LABELS[name])
    .filter(Boolean);
