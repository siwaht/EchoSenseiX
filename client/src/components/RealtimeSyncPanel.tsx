/**
 * Real-Time Sync Panel Component
 * 
 * This component provides a comprehensive interface for managing
 * real-time synchronization of ElevenLabs data.
 */

import React, { useState, useEffect } from 'react';

interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
  duration?: number;
  timestamp: string;
}

interface SyncStatus {
  isConfigured: boolean;
  apiKeyValid: boolean;
  lastSync?: string;
  status?: string;
  error?: string;
}

const RealtimeSyncPanel: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Load initial status
  useEffect(() => {
    checkSyncStatus();
  }, []);

  const checkSyncStatus = async () => {
    try {
      const response = await fetch('/api/realtime-sync/status');
      const data = await response.json();
      setSyncStatus(data.data);
      
      if (!data.data.isConfigured || !data.data.apiKeyValid) {
        setShowApiKeyInput(true);
      }
    } catch (error) {
      console.error('Failed to check sync status:', error);
    }
  };

  const setupIntegration = async () => {
    if (!apiKey.trim()) {
      alert('Please enter a valid API key');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/realtime-sync/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json();
      
      if (data.success) {
        setApiKey('');
        setShowApiKeyInput(false);
        await checkSyncStatus();
        alert('Integration setup successfully!');
      } else {
        alert(`Setup failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Setup error:', error);
      alert('Failed to setup integration');
    } finally {
      setIsLoading(false);
    }
  };

  const performSync = async (syncType: string) => {
    setIsLoading(true);
    try {
      let endpoint = '';
      switch (syncType) {
        case 'credits':
          endpoint = '/api/realtime-sync/credits';
          break;
        case 'dashboard':
          endpoint = '/api/realtime-sync/dashboard';
          break;
        case 'calls':
          endpoint = '/api/realtime-sync/calls';
          break;
        case 'analytics':
          endpoint = '/api/realtime-sync/analytics';
          break;
        case 'all':
          endpoint = '/api/realtime-sync/all';
          break;
        default:
          throw new Error('Invalid sync type');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: syncType === 'calls' ? JSON.stringify({
          includeTranscripts: true,
          includeRecordings: true,
          limit: 100
        }) : undefined,
      });

      const data = await response.json();
      setLastSyncResult(data);
      
      if (data.success) {
        await checkSyncStatus();
        alert(`${syncType.charAt(0).toUpperCase() + syncType.slice(1)} sync completed successfully!`);
      } else {
        alert(`Sync failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Failed to perform sync');
    } finally {
      setIsLoading(false);
    }
  };

  const testAPI = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/realtime-sync/test-api');
      const data = await response.json();
      
      if (data.success) {
        alert('API connectivity test successful!');
      } else {
        alert(`API test failed: ${data.message}`);
      }
    } catch (error) {
      console.error('API test error:', error);
      alert('Failed to test API connectivity');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="realtime-sync-panel">
      <div className="sync-header">
        <h2>Real-Time Sync Panel</h2>
        <p>Comprehensive ElevenLabs data synchronization</p>
      </div>

      {/* Status Section */}
      <div className="sync-status-section">
        <h3>Sync Status</h3>
        {syncStatus ? (
          <div className={`status-card ${syncStatus.isConfigured && syncStatus.apiKeyValid ? 'success' : 'error'}`}>
            <div className="status-item">
              <span className="label">Configuration:</span>
              <span className={`value ${syncStatus.isConfigured ? 'success' : 'error'}`}>
                {syncStatus.isConfigured ? '✅ Configured' : '❌ Not Configured'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">API Key:</span>
              <span className={`value ${syncStatus.apiKeyValid ? 'success' : 'error'}`}>
                {syncStatus.apiKeyValid ? '✅ Valid' : '❌ Invalid'}
              </span>
            </div>
            {syncStatus.lastSync && (
              <div className="status-item">
                <span className="label">Last Sync:</span>
                <span className="value">{new Date(syncStatus.lastSync).toLocaleString()}</span>
              </div>
            )}
            {syncStatus.error && (
              <div className="status-item">
                <span className="label">Error:</span>
                <span className="value error">{syncStatus.error}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="status-card loading">Loading status...</div>
        )}
      </div>

      {/* API Key Setup */}
      {showApiKeyInput && (
        <div className="api-key-section">
          <h3>Setup ElevenLabs Integration</h3>
          <div className="api-key-input">
            <input
              type="password"
              placeholder="Enter your ElevenLabs API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="api-key-field"
            />
            <button
              onClick={setupIntegration}
              disabled={isLoading || !apiKey.trim()}
              className="setup-btn"
            >
              {isLoading ? 'Setting up...' : 'Setup Integration'}
            </button>
          </div>
        </div>
      )}

      {/* Sync Actions */}
      {syncStatus?.isConfigured && syncStatus.apiKeyValid && (
        <div className="sync-actions-section">
          <h3>Sync Actions</h3>
          
          <div className="sync-buttons">
            <button
              onClick={() => testAPI()}
              disabled={isLoading}
              className="sync-btn test-btn"
            >
              {isLoading ? 'Testing...' : 'Test API Connectivity'}
            </button>
            
            <button
              onClick={() => performSync('credits')}
              disabled={isLoading}
              className="sync-btn credits-btn"
            >
              {isLoading ? 'Syncing...' : 'Sync Credits'}
            </button>
            
            <button
              onClick={() => performSync('dashboard')}
              disabled={isLoading}
              className="sync-btn dashboard-btn"
            >
              {isLoading ? 'Syncing...' : 'Sync Dashboard'}
            </button>
            
            <button
              onClick={() => performSync('calls')}
              disabled={isLoading}
              className="sync-btn calls-btn"
            >
              {isLoading ? 'Syncing...' : 'Sync Calls'}
            </button>
            
            <button
              onClick={() => performSync('analytics')}
              disabled={isLoading}
              className="sync-btn analytics-btn"
            >
              {isLoading ? 'Syncing...' : 'Sync Analytics'}
            </button>
            
            <button
              onClick={() => performSync('all')}
              disabled={isLoading}
              className="sync-btn all-btn primary"
            >
              {isLoading ? 'Syncing All...' : 'Sync Everything'}
            </button>
          </div>
        </div>
      )}

      {/* Last Sync Result */}
      {lastSyncResult && (
        <div className="sync-result-section">
          <h3>Last Sync Result</h3>
          <div className={`result-card ${lastSyncResult.success ? 'success' : 'error'}`}>
            <div className="result-header">
              <span className={`status ${lastSyncResult.success ? 'success' : 'error'}`}>
                {lastSyncResult.success ? '✅ Success' : '❌ Failed'}
              </span>
              <span className="duration">
                {lastSyncResult.duration ? `${lastSyncResult.duration}ms` : 'N/A'}
              </span>
              <span className="timestamp">
                {new Date(lastSyncResult.timestamp).toLocaleString()}
              </span>
            </div>
            
            <div className="result-message">
              {lastSyncResult.message}
            </div>
            
            {lastSyncResult.errors && lastSyncResult.errors.length > 0 && (
              <div className="result-errors">
                <h4>Errors:</h4>
                <ul>
                  {lastSyncResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {lastSyncResult.data && (
              <div className="result-data">
                <h4>Data Summary:</h4>
                <pre>{JSON.stringify(lastSyncResult.data, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .realtime-sync-panel {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .sync-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .sync-header h2 {
          color: #2d3748;
          margin-bottom: 10px;
        }

        .sync-header p {
          color: #718096;
          font-size: 16px;
        }

        .sync-status-section,
        .api-key-section,
        .sync-actions-section,
        .sync-result-section {
          margin-bottom: 30px;
          padding: 20px;
          background: #f7fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .sync-status-section h3,
        .api-key-section h3,
        .sync-actions-section h3,
        .sync-result-section h3 {
          color: #2d3748;
          margin-bottom: 15px;
          font-size: 18px;
        }

        .status-card {
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .status-card.success {
          background: #f0fff4;
          border-color: #9ae6b4;
        }

        .status-card.error {
          background: #fed7d7;
          border-color: #feb2b2;
        }

        .status-card.loading {
          background: #edf2f7;
          border-color: #cbd5e0;
        }

        .status-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .status-item:last-child {
          margin-bottom: 0;
        }

        .label {
          font-weight: 600;
          color: #4a5568;
        }

        .value {
          font-weight: 500;
        }

        .value.success {
          color: #38a169;
        }

        .value.error {
          color: #e53e3e;
        }

        .api-key-input {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .api-key-field {
          flex: 1;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 14px;
        }

        .setup-btn {
          padding: 10px 20px;
          background: #3182ce;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        }

        .setup-btn:disabled {
          background: #a0aec0;
          cursor: not-allowed;
        }

        .sync-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }

        .sync-btn {
          padding: 12px 20px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .sync-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .sync-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .sync-btn.primary {
          background: #3182ce;
          color: white;
          border-color: #3182ce;
        }

        .test-btn {
          border-color: #38a169;
          color: #38a169;
        }

        .credits-btn {
          border-color: #d69e2e;
          color: #d69e2e;
        }

        .dashboard-btn {
          border-color: #805ad5;
          color: #805ad5;
        }

        .calls-btn {
          border-color: #e53e3e;
          color: #e53e3e;
        }

        .analytics-btn {
          border-color: #319795;
          color: #319795;
        }

        .result-card {
          padding: 20px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .result-card.success {
          background: #f0fff4;
          border-color: #9ae6b4;
        }

        .result-card.error {
          background: #fed7d7;
          border-color: #feb2b2;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .status {
          font-weight: 600;
        }

        .duration,
        .timestamp {
          font-size: 14px;
          color: #718096;
        }

        .result-message {
          margin-bottom: 15px;
          font-weight: 500;
        }

        .result-errors {
          margin-bottom: 15px;
        }

        .result-errors h4 {
          color: #e53e3e;
          margin-bottom: 8px;
        }

        .result-errors ul {
          margin: 0;
          padding-left: 20px;
        }

        .result-errors li {
          color: #e53e3e;
          margin-bottom: 4px;
        }

        .result-data {
          margin-top: 15px;
        }

        .result-data h4 {
          color: #2d3748;
          margin-bottom: 8px;
        }

        .result-data pre {
          background: #f7fafc;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
          font-size: 12px;
          border: 1px solid #e2e8f0;
        }

        @media (max-width: 768px) {
          .sync-buttons {
            grid-template-columns: 1fr;
          }
          
          .api-key-input {
            flex-direction: column;
          }
          
          .result-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default RealtimeSyncPanel;
