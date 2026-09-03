import {useState, useEffect} from 'react';
import {apiService} from '../services/apiService';

/**
 * Whether the platform agent is reachable.
 *
 * The endpoint carries status, message and timestamp on the envelope rather
 * than inside `data`, which is why apiService reads it with `unwrap: false` -
 * unwrapping threw all three away and the UI showed a permanent red
 * "Agent: Unbekannt" with "Letzte Prüfung: Invalid Date" while the backend was
 * reporting healthy.
 */
export const useAgentHealth = () => {
    const [status, setStatus] = useState(null);

    const check = async () => {
        try {
            setStatus(await apiService.checkAgentHealth());
        } catch (error) {
            setStatus({success: false, status: 'error', message: error.message});
        }
    };

    useEffect(() => {
        check();
    }, []);

    return {status, check};
};

export default useAgentHealth;
