import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  UsersIcon,
  BuildingStorefrontIcon,
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  TagIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/outline';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const mainNavigation: NavigationItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: HomeIcon,
    },
    {
      id: 'coaching',
      label: 'Coaching',
      icon: ChatBubbleLeftRightIcon,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: ChartBarIcon,
    },
  ];

  const adminTools: NavigationItem[] = [
    {
      id: 'data-management',
      label: 'Data Management',
      icon: ChartBarIcon,
      roles: ['administrator'],
    },
    {
      id: 'phase1',
      label: 'User Management',
      icon: UsersIcon,
      roles: ['administrator'],
    },
    {
      id: 'markets',
      label: 'Market Management',
      icon: BuildingOffice2Icon,
      roles: ['administrator'],
    },
    {
      id: 'stores',
      label: 'Store Management',
      icon: BuildingStorefrontIcon,
      roles: ['administrator'],
    },
    {
      id: 'vendor-partners',
      label: 'Vendor Management',
      icon: BuildingOfficeIcon,
      roles: ['administrator'],
    },
    {
      id: 'services',
      label: 'Service Management',
      icon: WrenchScrewdriverIcon,
      roles: ['administrator'],
    },
    {
      id: 'scorecard-templates',
      label: 'Scorecard Templates',
      icon: Cog6ToothIcon,
      roles: ['administrator'],
    },
  ];

  const isItemVisible = (item: NavigationItem) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role || '');
  };

  const renderNavigationItem = (item: NavigationItem) => {
    if (!isItemVisible(item)) return null;

    const isActive = activeTab === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
          isActive
            ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        } ${isCollapsed ? 'justify-center' : 'justify-start'}`}
        title={isCollapsed ? item.label : undefined}
      >
        <Icon className={`h-5 w-5 ${!isCollapsed ? 'mr-3' : ''} flex-shrink-0`} />
        {!isCollapsed && <span>{item.label}</span>}
      </button>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsCollapsed(true)} />
        </div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          {!isCollapsed && (
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-gray-900">Maintenance Club MVP</h1>
              <p className="text-xs text-gray-500">
                Welcome, {user?.firstName} {user?.lastName} ({user?.role})
              </p>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            {isCollapsed ? (
              <Bars3Icon className="h-5 w-5" />
            ) : (
              <XMarkIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          {/* Main Navigation */}
          <div className="space-y-1">
            {!isCollapsed && (
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Main Navigation
              </h3>
            )}
            {mainNavigation.map(renderNavigationItem)}
          </div>

          {/* Admin Tools */}
          {adminTools.some(isItemVisible) && (
            <div className="mt-8 space-y-1">
              {!isCollapsed && (
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Admin Tools
                </h3>
              )}
              {adminTools.map(renderNavigationItem)}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={logout}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors duration-200 ${
              isCollapsed ? 'justify-center' : 'justify-start'
            }`}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <ArrowLeftOnRectangleIcon className={`h-5 w-5 ${!isCollapsed ? 'mr-3' : ''} flex-shrink-0`} />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Desktop toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`hidden lg:flex fixed top-4 z-50 items-center justify-center w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-all duration-300 ${
          isCollapsed ? 'left-20' : 'left-72'
        }`}
      >
        <Bars3Icon className="h-4 w-4 text-gray-600" />
      </button>
    </>
  );
};

export default Sidebar;