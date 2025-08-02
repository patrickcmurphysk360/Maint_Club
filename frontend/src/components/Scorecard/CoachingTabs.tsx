import React, { useState } from 'react';
import AdvisorScorecards from './AdvisorScorecards';
import StoreScorecards from './StoreScorecards';
import MarketScorecards from './MarketScorecards';
import { 
  UserGroupIcon,
  BuildingStorefrontIcon,
  BuildingOffice2Icon
} from '@heroicons/react/24/outline';

interface CoachingTabsProps {
  onMessageAdvisor?: (advisor: any) => void;
}

const CoachingTabs: React.FC<CoachingTabsProps> = ({ onMessageAdvisor }) => {
  const [activeTab, setActiveTab] = useState<'advisors' | 'stores' | 'markets'>('advisors');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 Performance Coaching</h1>
            <p className="text-gray-600">
              Review performance scorecards and provide coaching feedback
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {/* Advisors Tab */}
            <button
              onClick={() => setActiveTab('advisors')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === 'advisors'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UserGroupIcon className="h-5 w-5 mr-2" />
              👨‍💼 Advisors
            </button>

            {/* Stores Tab */}
            <button
              onClick={() => setActiveTab('stores')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === 'stores'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BuildingStorefrontIcon className="h-5 w-5 mr-2" />
              🏪 Stores
            </button>

            {/* Markets Tab */}
            <button
              onClick={() => setActiveTab('markets')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === 'markets'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BuildingOffice2Icon className="h-5 w-5 mr-2" />
              🏢 Markets
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Advisors Tab Content */}
          {activeTab === 'advisors' && (
            <div>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Advisor Performance:</strong> Individual advisor scorecards with coaching and messaging capabilities.
                </p>
              </div>
              <AdvisorScorecards onMessageAdvisor={onMessageAdvisor} />
            </div>
          )}

          {/* Stores Tab Content */}
          {activeTab === 'stores' && (
            <div>
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">
                  <strong>Store Performance:</strong> Store-level aggregated performance metrics from the "Stores" tab data.
                </p>
              </div>
              <StoreScorecards />
            </div>
          )}

          {/* Markets Tab Content */}
          {activeTab === 'markets' && (
            <div>
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-purple-800 text-sm">
                  <strong>Market Performance:</strong> Market-level performance metrics from the "Markets" tab data.
                </p>
              </div>
              <MarketScorecards />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachingTabs;