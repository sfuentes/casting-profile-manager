import React from 'react';
import {Loader, CheckCircle, XCircle} from 'lucide-react';
import {useAppContext} from '../context/AppContext';
import {apiService} from '../services/apiService';

const SyncIndicator = () => {
    const {saving, lastSaved, error} = useAppContext();

    // In demo mode, don't show errors
    if (error && !apiService.demoMode) {
        return (
            <div className="flex items-center gap-2 text-red-600">
                <XCircle size={16}/>
                <span className="text-sm">{error}</span>
            </div>
        );
    }

    if (saving) {
        return (
            <div className="flex items-center gap-2 text-blue-600">
                <Loader size={16} className="animate-spin"/>
                <span className="text-sm">Speichert...</span>
            </div>
        );
    }

    if (lastSaved) {
        return (
            <div className="flex items-center gap-2 text-green-600">
                <CheckCircle size={16}/>
                <span className="text-sm">
                    Gespeichert {new Date(lastSaved).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}
                </span>
            </div>
        );
    }

    return null;
};

export default SyncIndicator;