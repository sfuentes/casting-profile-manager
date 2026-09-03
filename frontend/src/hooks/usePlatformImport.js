import {useState} from 'react';
import {apiService} from '../services/apiService';

/**
 * Reading a profile off a platform, and deciding what to keep.
 *
 * Two steps on purpose. `read` fetches and returns; it writes nothing. `apply`
 * then writes only the fields the user ticked, and takes the values from the
 * import's log on the server rather than from anything this client sends back.
 *
 * An earlier version claimed "Die Daten wurden mit Ihrem lokalen Profil
 * zusammengeführt" against an endpoint that did not exist. Merging scraped
 * values into a profile without showing them first is how an import quietly
 * destroys what somebody typed by hand.
 */
export const usePlatformImport = ({onApplied} = {}) => {
    const [results, setResults] = useState({});
    const [selection, setSelection] = useState([]);
    // The user's answers to values the normaliser could not map, keyed by the
    // question's path (e.g. "eyeColor", "languages.0.level").
    const [resolutions, setResolutions] = useState({});
    const [busy, setBusy] = useState(false);

    const read = async (platform) => {
        if (!platform.connected) {
            throw new Error('Bitte stellen Sie zuerst eine Verbindung zur Plattform her.');
        }

        setBusy(true);
        try {
            const result = await apiService.readProfileFromPlatform(platform.id);
            setResults(prev => ({...prev, [platform.id]: result}));
            // Everything that was found is preselected; the user unticks what
            // they would rather keep as it is.
            setSelection(Object.keys(result.fields || {}));
            setResolutions({});
            return result;
        } finally {
            setBusy(false);
        }
    };

    const toggleField = (key) => setSelection(prev => (
        prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    ));

    const apply = async (platform) => {
        const result = results[platform?.id];
        if (!result || selection.length === 0) return null;

        setBusy(true);
        try {
            const applied = await apiService.applyImportedProfile(
                platform.id, result.syncLogId, selection, resolutions
            );
            // The profile view reads from context, so the caller reloads it
            // rather than leaving the user looking at pre-import values.
            if (onApplied) await onApplied();
            return applied;
        } finally {
            setBusy(false);
        }
    };

    return {results, selection, resolutions, busy, read, apply, toggleField, setResolutions};
};

export default usePlatformImport;
