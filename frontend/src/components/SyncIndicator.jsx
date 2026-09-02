import React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import {CheckCircle, XCircle} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import {apiService} from '../services/apiService';

/** One line of status, in the colour that matches it. */
const Line = ({color, icon, children}) => (
    <Stack direction="row" alignItems="center" gap={1} sx={{color}}>
        {icon}
        <Typography variant="body2">{children}</Typography>
    </Stack>
);

const SyncIndicator = () => {
    const {saving, lastSaved, error} = useAppContext();

    // In demo mode, don't show errors
    if (error && !apiService.demoMode) {
        return <Line color="error.main" icon={<XCircle size={16}/>}>{error}</Line>;
    }

    if (saving) {
        return (
            <Line color="primary.main" icon={<CircularProgress size={16} color="inherit"/>}>
                Speichert...
            </Line>
        );
    }

    if (lastSaved) {
        return (
            <Line color="success.main" icon={<CheckCircle size={16}/>}>
                Gespeichert {new Date(lastSaved).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}
            </Line>
        );
    }

    return null;
};

export default SyncIndicator;
