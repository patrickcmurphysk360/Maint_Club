import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface EntityConfirmationProps {
  sessionId: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface DiscoveredEntity {
  name: string;
  action: 'map' | 'create' | 'ignore';
  mappedTo?: number;
  mappedName?: string;
  details?: any;
}

interface SessionData {
  session: {
    id: string;
    filename: string;
    status: string;
    created_at: string;
  };
  discovered: {
    markets: any[];
    stores: any[];
    advisors: any[];
  };
  enhanced?: {
    markets: any[];
    stores: any[];
    advisors: any[];
  };
}

const EntityConfirmation: React.FC<EntityConfirmationProps> = ({ sessionId, onComplete, onCancel }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [confirmationData, setConfirmationData] = useState<{
    markets: { [key: string]: DiscoveredEntity };
    stores: { [key: string]: DiscoveredEntity };
    advisors: { [key: string]: DiscoveredEntity };
  }>({
    markets: {},
    stores: {},
    advisors: {}
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/enhanced-upload/upload/session/${sessionId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load session data');
      }

      const data = await response.json();
      setSessionData(data);

      // Initialize confirmation data based on discovered entities
      const markets: { [key: string]: DiscoveredEntity } = {};
      const stores: { [key: string]: DiscoveredEntity } = {};
      const advisors: { [key: string]: DiscoveredEntity } = {};

      // Use enhanced data if available (from server matching), otherwise use raw discovered data
      const marketsData = data.enhanced?.markets || data.discovered.markets || [];
      const storesData = data.enhanced?.stores || data.discovered.stores || [];
      const advisorsData = data.enhanced?.advisors || data.discovered.advisors || [];

      // Process markets - only include unmatched ones
      marketsData.forEach((market: any) => {
        // Skip if already matched
        if (market.action === 'map' && market.existing_id) return;
        
        markets[market.name] = {
          name: market.name,
          action: market.suggestedMatch ? 'map' : 'create',
          mappedTo: market.suggestedMatch?.id || market.existing_id,
          mappedName: market.suggestedMatch?.name
        };
      });

      // Process stores - only include unmatched ones
      storesData.forEach((store: any) => {
        // Skip if already matched
        if (store.action === 'map' && store.existing_id) return;
        
        stores[store.name] = {
          name: store.name,
          action: store.suggestedMatch ? 'map' : 'create',
          mappedTo: store.suggestedMatch?.id || store.existing_id,
          mappedName: store.suggestedMatch?.name,
          details: { market: store.market }
        };
      });

      // Process advisors - only include unmatched ones
      advisorsData.forEach((advisor: any) => {
        // Skip if already matched
        if (advisor.action === 'map_user' && advisor.existing_user_id) return;
        
        advisors[advisor.name] = {
          name: advisor.name,
          action: advisor.suggestedMatch ? 'map' : 'create',
          mappedTo: advisor.suggestedMatch?.id || advisor.existing_user_id,
          mappedName: advisor.suggestedMatch?.name || advisor.mappedUserName,
          details: { 
            store: advisor.store,
            market: advisor.market,
            hasData: advisor.hasData
          }
        };
      });

      setConfirmationData({ markets, stores, advisors });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setProcessing(true);
      setError(null);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/enhanced-upload/upload/confirm/${sessionId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(confirmationData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to confirm upload');
      }

      const result = await response.json();
      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const updateEntityAction = (
    type: 'markets' | 'stores' | 'advisors',
    name: string,
    action: 'map' | 'create' | 'ignore',
    mappedTo?: number
  ) => {
    setConfirmationData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [name]: {
          ...prev[type][name],
          action,
          mappedTo
        }
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <ArrowPathIcon className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error && !sessionData) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
          <div>
            <h4 className="text-red-800 font-medium">Error Loading Session</h4>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if there are any unmatched entities
  const hasUnmatchedEntities = 
    Object.keys(confirmationData.markets).length > 0 ||
    Object.keys(confirmationData.stores).length > 0 ||
    Object.keys(confirmationData.advisors).length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Review Upload Data</h2>
            <p className="text-gray-600 text-sm mt-1">
              Session ID: {sessionId}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
            disabled={processing}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {sessionData && (
          <div className="text-sm text-gray-600">
            <p>File: {sessionData.session.filename}</p>
            <p>Uploaded: {new Date(sessionData.session.created_at).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* No unmatched entities message */}
      {!hasUnmatchedEntities && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-green-800 font-medium text-lg">All Entities Already Matched!</h3>
              <p className="text-green-700 mt-2">
                This upload appears to have been auto-processed because all markets, stores, and advisors 
                were successfully matched to existing entities in the system.
              </p>
              <p className="text-green-700 mt-2">
                If you're seeing this screen, it may be due to a processing error. You can safely cancel 
                this review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Markets */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <BuildingOfficeIcon className="h-6 w-6 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold">Markets ({Object.keys(confirmationData.markets).length})</h3>
        </div>
        
        <div className="space-y-3">
          {Object.entries(confirmationData.markets).map(([name, entity]) => (
            <div key={name} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{name}</p>
                  {entity.action === 'map' && entity.mappedName && (
                    <p className="text-sm text-gray-600">→ {entity.mappedName}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={entity.action}
                    onChange={(e) => updateEntityAction('markets', name, e.target.value as any)}
                    className="form-select text-sm"
                    disabled={processing}
                  >
                    <option value="map">Map to Existing</option>
                    <option value="create">Create New</option>
                    <option value="ignore">Ignore</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stores */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <BuildingStorefrontIcon className="h-6 w-6 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold">Stores ({Object.keys(confirmationData.stores).length})</h3>
        </div>
        
        <div className="space-y-3">
          {Object.entries(confirmationData.stores).map(([name, entity]) => (
            <div key={name} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-gray-600">Market: {entity.details?.market}</p>
                  {entity.action === 'map' && entity.mappedName && (
                    <p className="text-sm text-gray-600">→ {entity.mappedName}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={entity.action}
                    onChange={(e) => updateEntityAction('stores', name, e.target.value as any)}
                    className="form-select text-sm"
                    disabled={processing}
                  >
                    <option value="map">Map to Existing</option>
                    <option value="create">Create New</option>
                    <option value="ignore">Ignore</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advisors */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <UserGroupIcon className="h-6 w-6 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold">Advisors ({Object.keys(confirmationData.advisors).length})</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(confirmationData.advisors).map(([name, entity]) => (
            <div key={name} className="border rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-sm">{name}</p>
                  <p className="text-xs text-gray-600">
                    {entity.details?.store} | {entity.details?.market}
                  </p>
                  {entity.action === 'map' && entity.mappedName && (
                    <p className="text-xs text-gray-600">→ {entity.mappedName}</p>
                  )}
                </div>
                <select
                  value={entity.action}
                  onChange={(e) => updateEntityAction('advisors', name, e.target.value as any)}
                  className="form-select text-xs ml-2"
                  disabled={processing}
                >
                  <option value="map">Map</option>
                  <option value="create">Create</option>
                  <option value="ignore">Ignore</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
            <div>
              <h4 className="text-red-800 font-medium">Error</h4>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          disabled={processing}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={processing}
          className="btn btn-primary flex items-center"
        >
          {processing ? (
            <>
              <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Confirm & Process
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default EntityConfirmation;