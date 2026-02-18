import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../services/apiService';

/**
 * SyncHistory Component
 * Displays recent sync history across all platforms
 */
const SyncHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20);

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

  const getStatusColor = (status) => {
    const colors = {
      success: 'text-green-600',
      failed: 'text-red-600',
      pending: 'text-yellow-600',
      partial: 'text-orange-600'
    };
    return colors[status] || 'text-gray-600';
  };

  const getStatusIcon = (status) => {
    const icons = {
      success: '✓',
      failed: '✗',
      pending: '⏳',
      partial: '⚠'
    };
    return icons[status] || '•';
  };

  const getPlatformName = (platformId) => {
    const platforms = {
      1: 'Filmmakers',
      2: 'Casting Network',
      3: 'Schauspielervideos',
      4: 'e-TALENTA',
      5: 'JobWork',
      6: 'Agentur Iris Müller',
      7: 'Agentur Connection',
      8: 'Agentur Sarah Weiss',
      9: 'Wanted'
    };
    return platforms[platformId] || `Platform ${platformId}`;
  };

  const getOperationLabel = (operation) => {
    const labels = {
      'push_availability': 'Verfügbarkeit gesendet',
      'push_media': 'Medien hochgeladen',
      'push_profile': 'Profil aktualisiert',
      'pull_availability': 'Verfügbarkeit abgerufen',
      'pull_profile': 'Profil abgerufen'
    };
    return labels[operation] || operation;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-gray-500">Lade Synchronisationsverlauf...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Synchronisationsverlauf</h2>
        <button
          onClick={loadHistory}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Aktualisieren
        </button>
      </div>

      {history.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>Noch keine Synchronisationen durchgeführt.</p>
          <p className="text-sm mt-2">
            Verbinden Sie Plattformen und starten Sie eine Synchronisation, um hier Einträge zu sehen.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plattform
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operation
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verarbeitet
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dauer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zeitpunkt
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {history.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-lg ${getStatusColor(item.status)}`}>
                      {getStatusIcon(item.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {getPlatformName(item.platform)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {getOperationLabel(item.operation)}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {item.itemsProcessed || 0} / {item.itemsTotal || 0}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {item.duration ? `${(item.duration / 1000).toFixed(1)}s` : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(item.createdAt)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && history.length >= limit && (
        <div className="p-4 border-t border-gray-200 text-center">
          <button
            onClick={() => setLimit(limit + 20)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Mehr laden
          </button>
        </div>
      )}
    </div>
  );
};

export default SyncHistory;
