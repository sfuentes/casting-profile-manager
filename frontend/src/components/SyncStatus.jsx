import React, { useState, useEffect } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { API_BASE_URL } from '../services/apiService';

/**
 * SyncStatus Component
 * Displays sync status and history for platforms
 */
const STATUS = {
  success: { color: 'success', label: 'Erfolgreich' },
  failed: { color: 'error', label: 'Fehlgeschlagen' },
  pending: { color: 'warning', label: 'Ausstehend' },
  partial: { color: 'warning', label: 'Teilweise' }
};

/** One "label: value" pair from the last sync. */
const Detail = ({ label, children, span }) => (
  <Box sx={span ? { gridColumn: 'span 2' } : undefined}>
    <Typography component="span" variant="body2" color="text.secondary">{label}:</Typography>{' '}
    <Typography component="span" variant="body2" fontWeight={500}>{children}</Typography>
  </Box>
);

const SyncStatus = ({ platformId, platformName }) => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSyncStatus();
  }, [platformId]);

  const loadSyncStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/sync/status/${platformId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data.data);
      }
    } catch (err) {
      console.error('Error loading sync status:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Both sync buttons do the same thing against different routes. */
  const runSync = async (route, done) => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/sync/${route}/${platformId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert(done(data));
        loadSyncStatus();
      } else {
        setError(data.error?.message || 'Sync fehlgeschlagen');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAvailability = () => runSync(
    'availability',
    (data) => `Erfolgreich! ${data.data.itemsProcessed} Verfügbarkeiten synchronisiert.`
  );

  const handleSyncProfile = () => runSync('profile', () => 'Profil erfolgreich synchronisiert!');

  const formatDate = (dateString) => {
    if (!dateString) return 'Nie';
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">Lade Sync-Status...</Typography>
      </Box>
    );
  }

  const status = STATUS[syncStatus?.status];

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{mb: 1.5}}>Synchronisation für {platformName}</Typography>

        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

        <Stack direction="row" spacing={1} sx={{flexWrap: 'wrap'}}>
          <Button variant="contained" onClick={handleSyncAvailability} disabled={syncing}>
            {syncing ? 'Synchronisiere...' : 'Verfügbarkeit synchronisieren'}
          </Button>
          <Button variant="contained" color="success" onClick={handleSyncProfile} disabled={syncing}>
            {syncing ? 'Synchronisiere...' : 'Profil synchronisieren'}
          </Button>
        </Stack>
      </Paper>

      {syncStatus && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography fontWeight={500} sx={{mb: 1}}>Letzte Synchronisation</Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
            <Detail label="Operation">
              {syncStatus.operation?.replace('push_', '').replace('_', ' ')}
            </Detail>

            <Box>
              <Typography component="span" variant="body2" color="text.secondary">Status:</Typography>{' '}
              <Chip
                size="small"
                color={status?.color || 'default'}
                label={status?.label || syncStatus.status}
              />
            </Box>

            <Detail label="Zeitpunkt">{formatDate(syncStatus.createdAt)}</Detail>
            <Detail label="Verarbeitet">
              {syncStatus.itemsProcessed || 0} / {syncStatus.itemsTotal || 0}
            </Detail>

            {syncStatus.duration && (
              <Detail label="Dauer">{(syncStatus.duration / 1000).toFixed(1)}s</Detail>
            )}

            {syncStatus.error && (
              <Box sx={{ gridColumn: 'span 2' }}>
                <Typography variant="body2" color="text.secondary">Fehler:</Typography>
                <Typography variant="caption" color="error.main">
                  {syncStatus.error.message}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      <Alert severity="info">
        <strong>Hinweis:</strong> Die Synchronisation sendet Ihre Daten an die Plattform.
        Stellen Sie sicher, dass die Plattform verbunden und Ihre Zugangsdaten aktuell sind.
      </Alert>
    </Stack>
  );
};

export default SyncStatus;
