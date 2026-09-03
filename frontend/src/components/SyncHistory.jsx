import React, { useState, useEffect } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import { API_BASE_URL } from '../services/apiService';
import { useAppContext } from '../context/AppContext';

/**
 * SyncHistory Component
 * Displays recent sync history across all platforms
 */
const COLUMNS = ['Status', 'Plattform', 'Operation', 'Verarbeitet', 'Dauer', 'Zeitpunkt'];

const STATUS = {
  success: { color: 'success.main', icon: '✓' },
  failed: { color: 'error.main', icon: '✗' },
  pending: { color: 'warning.main', icon: '⏳' },
  partial: { color: 'warning.dark', icon: '⚠' }
};

const OPERATIONS = {
  push_availability: 'Verfügbarkeit gesendet',
  push_media: 'Medien hochgeladen',
  push_profile: 'Profil aktualisiert',
  pull_availability: 'Verfügbarkeit abgerufen',
  pull_profile: 'Profil abgerufen'
};

const SyncHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20);
  // The platform names come from the list the app already loaded, which is fed
  // by the connector registry. This file used to carry its own copy of them,
  // and it had gone stale at nine platforms while the registry grew to
  // fourteen - so filmpool, UFA Base and the rest showed as "Platform 10".
  const { platforms } = useAppContext();

  useEffect(() => {
    loadHistory();
  }, [limit]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/sync/history?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data.data || []);
      }
    } catch (err) {
      console.error('Error loading sync history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPlatformName = (platformId) => platforms
    .find((p) => (p.platformId ?? p.id) === platformId)?.name || `Platform ${platformId}`;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <Typography color="text.secondary">Lade Synchronisationsverlauf...</Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={1} sx={{ borderRadius: 2 }}>
      <Stack
        direction="row"
        sx={{alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: 1, borderColor: 'divider'}}
      >
        <Typography variant="h6">Synchronisationsverlauf</Typography>
        <Button size="small" onClick={loadHistory}>Aktualisieren</Button>
      </Stack>

      {history.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography>Noch keine Synchronisationen durchgeführt.</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Verbinden Sie Plattformen und starten Sie eine Synchronisation, um hier Einträge zu sehen.
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                {COLUMNS.map((column) => (
                  <TableCell
                    key={column}
                    sx={{
                      fontSize: 12, fontWeight: 500, color: 'text.secondary',
                      textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((item) => {
                const status = STATUS[item.status] || { color: 'text.secondary', icon: '•' };
                return (
                  <TableRow key={item._id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Box component="span" sx={{ fontSize: '1.125rem', color: status.color }}>
                        {status.icon}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {getPlatformName(item.platform)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {OPERATIONS[item.operation] || item.operation}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {item.itemsProcessed || 0} / {item.itemsTotal || 0}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {item.duration ? `${(item.duration / 1000).toFixed(1)}s` : '-'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDate(item.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {history.length > 0 && history.length >= limit && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
          <Button size="small" onClick={() => setLimit(limit + 20)}>Mehr laden</Button>
        </Box>
      )}
    </Paper>
  );
};

export default SyncHistory;
