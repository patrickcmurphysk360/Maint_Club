import React from 'react';
import { 
  UserIcon, 
  BuildingStorefrontIcon, 
  MapPinIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  PencilSquareIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import { AdvisorScorecardData } from '../../types/scorecard';

interface AdvisorInfoProps {
  advisor: AdvisorScorecardData;
  onMessageAdvisor?: (advisor: AdvisorScorecardData) => void;
  onSetGoals?: (advisor: AdvisorScorecardData) => void;
  onEditProfile?: (advisor: AdvisorScorecardData) => void;
  onMapAdvisor?: (advisor: AdvisorScorecardData) => void;
  canSetGoals?: boolean;
  canEditProfile?: boolean;
}

const AdvisorInfo: React.FC<AdvisorInfoProps> = ({ 
  advisor, 
  onMessageAdvisor, 
  onSetGoals, 
  onEditProfile,
  onMapAdvisor,
  canSetGoals,
  canEditProfile = false
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Avatar Placeholder */}
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
            {getInitials(advisor.employee)}
          </div>
          
          {/* Advisor Details */}
          <div>
            <h3 className="text-xl font-bold text-gray-900">{advisor.employee}</h3>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
              <div className="flex items-center">
                <BuildingStorefrontIcon className="h-4 w-4 mr-1" />
                <span>{advisor.store}</span>
              </div>
              <div className="flex items-center">
                <MapPinIcon className="h-4 w-4 mr-1" />
                <span>Market {advisor.marketId}</span>
              </div>
            </div>
            
            {/* Mapped User Info */}
            <div className="mt-2">
              {advisor.mappedUserName ? (
                <div className="flex items-center text-sm text-green-600">
                  <UserIcon className="h-4 w-4 mr-1" />
                  <span>Mapped to: {advisor.mappedUserName}</span>
                </div>
              ) : (
                <div className="flex items-center text-sm text-amber-600">
                  <UserIcon className="h-4 w-4 mr-1" />
                  <span>No user mapping</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col items-end space-y-2">
          <div className="flex flex-wrap gap-2 justify-end">
            {canEditProfile && advisor.mappedUserId && (
              <button
                onClick={() => onEditProfile?.(advisor)}
                className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 text-sm font-medium"
                title="Edit user profile"
              >
                <PencilSquareIcon className="h-4 w-4 mr-1" />
                Edit Profile
              </button>
            )}
            
            <button
              onClick={() => onMapAdvisor?.(advisor)}
              className={`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium ${
                advisor.mappedUserName 
                  ? 'bg-orange-600 text-white hover:bg-orange-700' 
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
              title={advisor.mappedUserName ? 'Change user mapping' : 'Map to user account'}
            >
              <LinkIcon className="h-4 w-4 mr-1" />
              {advisor.mappedUserName ? 'Remap' : 'Map User'}
            </button>
            
            {canSetGoals && (
              <button
                onClick={() => onSetGoals?.(advisor)}
                className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm font-medium"
              >
                <ChartBarIcon className="h-4 w-4 mr-1" />
                Set Goals
              </button>
            )}
            
            <button
              onClick={() => onMessageAdvisor?.(advisor)}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
              Message
            </button>
          </div>
          
          {advisor.lastUpdated && (
            <div className="text-xs text-gray-500">
              Updated: {new Date(advisor.lastUpdated).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvisorInfo;