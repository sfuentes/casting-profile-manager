import React, { useState, useEffect } from 'react';
import { apiService, API_BASE_URL } from '../services/apiService';

/**
 * SyncStatus Component
 * Displays sync status and history for platforms
 */
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

  const handleSyncAvailability = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/sync/availability/${platformId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Erfolgreich! ${data.data.itemsProcessed} Verfügbarkeiten synchronisiert.`);
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

  const handleSyncProfile = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/sync/profile/${platformId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert('Profil erfolgreich synchronisiert!');
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

  const getStatusBadge = (status) => {
    const statusStyles = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-orange-100 text-orange-800'
    };

    const statusLabels = {
      success: 'Erfolgreich',
      failed: 'Fehlgeschlagen',
      pending: 'Ausstehend',
      partial: 'Teilweise'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500">Lade Sync-Status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync Actions */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-3">
          Synchronisation für {platformName}
        </h3>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSyncAvailability}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? 'Synchronisiere...' : 'Verfügbarkeit synchronisieren'}
          </button>

          <button
            onClick={handleSyncProfile}
            disabled={syncing}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? 'Synchronisiere...' : 'Profil synchronisieren'}
          </button>
        </div>
      </div>

      {/* Last Sync Status */}
      {syncStatus && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="font-medium mb-2">Letzte Synchronisation</h4>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Operation:</span>
              <span className="ml-2 font-medium">
                {syncStatus.operation?.replace('push_', '').replace('_', ' ')}
              </span>
            </div>

            <div>
              <span className="text-gray-600">Status:</span>
              <span className="ml-2">{getStatusBadge(syncStatus.status)}</span>
            </div>

            <div>
              <span className="text-gray-600">Zeitpunkt:</span>
              <span className="ml-2 font-medium">
                {formatDate(syncStatus.createdAt)}
              </span>
            </div>

            <div>
              <span className="text-gray-600">Verarbeitet:</span>
              <span className="ml-2 font-medium">
                {syncStatus.itemsProcessed || 0} / {syncStatus.itemsTotal || 0}
              </span>
            </div>

            {syncStatus.duration && (
              <div>
                <span className="text-gray-600">Dauer:</span>
                <span className="ml-2 font-medium">
                  {(syncStatus.duration / 1000).toFixed(1)}s
                </span>
              </div>
            )}

            {syncStatus.error && (
              <div className="col-span-2">
                <span className="text-gray-600">Fehler:</span>
                <p className="mt-1 text-red-600 text-xs">
                  {syncStatus.error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>Hinweis:</strong> Die Synchronisation sendet Ihre Daten an die Plattform.
          Stellen Sie sicher, dass die Plattform verbunden und Ihre Zugangsdaten aktuell sind.
        </p>
      </div>
    </div>
  );
};

export default SyncStatus;
