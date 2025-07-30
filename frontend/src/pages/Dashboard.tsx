import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { performanceAPI, scorecardAPI } from '../services/api';
import { AdvisorScorecard, FileUpload, User } from '../types';
import ThreadedMessaging from '../components/ThreadedMessaging';
import UserManagement from '../components/UserManagement';
import MarketManagement from '../components/MarketManagement';
import StoreManagement from '../components/StoreManagement';
import VendorManagement from '../components/VendorManagement';
import ServiceManagement from '../components/ServiceManagement';
import AdvisorScorecards from '../components/Scorecard/AdvisorScorecards';
import PersonalScorecard from '../components/Scorecard/PersonalScorecard';
import UploadConfirmation from '../components/UploadConfirmation';
import Sidebar from '../components/Sidebar';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(user?.role === 'advisor' ? 'overview' : 'overview');
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [scorecard, setScorecard] = useState<AdvisorScorecard | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadSession, setUploadSession] = useState<any>(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  

  useEffect(() => {
    loadDashboardData();
  }, []);


  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load recent uploads
      const uploadsData = await performanceAPI.getUploads(10);
      setUploads(uploadsData);

      // Load scorecard if user is advisor
      if (user?.role === 'advisor' && user?.id) {
        try {
          const scorecardData = await scorecardAPI.getAdvisorScorecard(user.id);
          setScorecard(scorecardData);
        } catch (error) {
          console.log('No scorecard data available');
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, type: string) => {
    try {
      setLoading(true);
      const reportDate = new Date().toISOString().split('T')[0];
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('reportDate', reportDate);
      
      const token = localStorage.getItem('token');
      const endpoint = type === 'services' 
        ? 'http://localhost:5002/api/enhanced-upload/upload/services/discover'
        : 'http://localhost:5002/api/enhanced-upload/upload/operations/discover';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }
      
      const result = await response.json();
      setUploadSession(result);
      
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUpload = async (confirmationData: any) => {
    if (!uploadSession) return;
    
    try {
      setConfirmationLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:5002/api/enhanced-upload/upload/confirm/${uploadSession.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(confirmationData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Confirmation failed');
      }
      
      const result = await response.json();
      alert(`Upload processed successfully! Processed ${result.processedCount} records.`);
      setUploadSession(null);
      loadDashboardData();
      
    } catch (error: any) {
      alert(`Confirmation failed: ${error.message}`);
    } finally {
      setConfirmationLoading(false);
    }
  };

  const handleCancelUpload = () => {
    setUploadSession(null);
  };



  const renderAdminTabContent = () => {
    switch (activeTab) {
      case 'phase1':
        return <UserManagement />;
      
      case 'markets':
        return <MarketManagement />;
      
      case 'stores':
        return <StoreManagement />;
      
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">📊 Upload Services Data</h3>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0], 'services');
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <p className="text-xs text-gray-500 mt-2">
                  <strong>New format:</strong> "market_id-YYYY-MM-DD-time-Services-hash.xlsx"<br />
                  <strong>Legacy:</strong> "Market - System - Services - YYYY-MM-DD.xlsx"
                </p>
              </div>
              
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">🏪 Upload Operations Data</h3>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0], 'operations');
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-success-50 file:text-success-700 hover:file:bg-success-100"
                />
                <p className="text-xs text-gray-500 mt-2">
                  <strong>New format:</strong> "market_id-YYYY-MM-DD-time-Operations-hash.xlsx"<br />
                  <strong>Legacy:</strong> "Market - System - Operations - YYYY-MM-DD.xlsx"
                </p>
              </div>
            </div>
          </div>
        );
      
      case 'vendor-partners':
        return <VendorManagement />;
      
      case 'services':
        return <ServiceManagement />;
      
      case 'coaching':
        return (
          <AdvisorScorecards 
            onMessageAdvisor={(advisor) => {
              // TODO: Integrate with ThreadedMessaging component
              console.log('Message advisor:', advisor);
            }}
          />
        );
      
      case 'reports':
        return (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">📈 Reports & Analytics</h3>
              <p className="text-gray-600 mb-4">Export performance data and generate insights.</p>
              
              <div className="bg-indigo-50 border border-indigo-200 rounded p-4">
                <p className="text-indigo-800 text-sm">
                  <strong>Available Exports:</strong> JSON performance data, advisor scorecards
                  <br />
                  <strong>Next Update:</strong> Interactive reporting dashboard coming soon.
                </p>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const renderAdvisorTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <PersonalScorecard />;
        
      case 'goals':
        return (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">🎯 My Goals & Progress</h3>
              {scorecard?.goals && Object.keys(scorecard.goals).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(scorecard.goals).map(([metric, goal]) => (
                    <div key={metric} className="border rounded p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{metric}</h4>
                        <span className="text-sm text-gray-500">{goal.periodType}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl font-bold text-primary-600">{goal.target}</div>
                        <div className="text-sm text-gray-600">target</div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Effective: {new Date(goal.effectiveDate).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No goals set yet. Contact your manager to set performance targets.</p>
              )}
            </div>
          </div>
        );
        
      case 'coaching':
        return (
          <div className="space-y-6">
            <ThreadedMessaging selectedAdvisor={user} />
          </div>
        );
        
      default:
        return null;
    }
  };

  const renderRoleBasedContent = () => {
    switch (user?.role) {
      case 'administrator':
      case 'marketManager':
      case 'storeManager':
      case 'market_manager':
      case 'store_manager':
        return renderAdminTabContent();
        
      case 'advisor':
        return renderAdvisorTabContent();
        
      default:
        return (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">👨‍💼 Manager Dashboard</h3>
            <p className="text-gray-600">
              Welcome, {user?.firstName}! Your role: <span className="font-medium">{user?.role}</span>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Manager features (reports, coaching, goals) are available in the full version.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Main content area with margin for sidebar */}
      <div className={`flex-1 transition-all duration-300 ${activeTab ? 'ml-64 lg:ml-64' : 'ml-16 lg:ml-16'}`}>
        {/* Header - simplified since user info is now in sidebar */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h2 className="text-xl font-semibold text-gray-900 capitalize">
                {activeTab === 'phase1' ? 'User Management' : activeTab.replace(/([A-Z])/g, ' $1').trim()}
              </h2>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {user?.permissions?.canViewScorecard && '📊'}
                  {user?.permissions?.canSetGoals && '🎯'}
                  {user?.permissions?.canSendCoaching && '💬'}
                  {user?.permissions?.canManageVendorMappings && '🏷️'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {renderRoleBasedContent()}
          </>
        )}

        {/* Recent Activity */}
        <div className="mt-8">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">📋 Recent File Uploads</h3>
            {uploads.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {uploads.slice(0, 5).map((upload, index) => (
                      <tr key={upload.id || index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {upload.filename}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {upload.fileType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(upload.uploadDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            upload.status === 'completed' 
                              ? 'bg-success-100 text-success-800'
                              : upload.status === 'failed'
                              ? 'bg-danger-100 text-danger-800'
                              : 'bg-warning-100 text-warning-800'
                          }`}>
                            {upload.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-600">No file uploads yet.</p>
            )}
          </div>
        </div>

        {/* MVP Features Summary */}
        <div className="mt-8">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">✅ MVP Features Implemented</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">🔐 Authentication & Roles</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Role-based login system</li>
                  <li>• Admin, Manager, Advisor roles</li>
                  <li>• Permission-based access</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">📊 Data Processing</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Excel file upload & parsing</li>
                  <li>• Services data (advisor rollup)</li>
                  <li>• Operations data (store KPIs)</li>
                  <li>• Filename-based market detection</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">🏷️ Vendor Integration</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Service → Product mapping</li>
                  <li>• Vendor tag system</li>
                  <li>• Branded scorecard display</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">📈 Performance Tracking</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Advisor scorecards</li>
                  <li>• Goal setting & tracking</li>
                  <li>• Achievement calculation</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">💬 Communication</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• In-app coaching messages</li>
                  <li>• Manager → Advisor threads</li>
                  <li>• Read/unread tracking</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">📦 Data Export</h4>
                <ul className="text-gray-600 space-y-1">
                  <li>• Structured JSON output</li>
                  <li>• Raw data export</li>
                  <li>• API endpoints ready</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        </main>
      </div>
      
      {/* Upload Confirmation Modal */}
      {uploadSession && (
        <UploadConfirmation
          session={uploadSession}
          onConfirm={handleConfirmUpload}
          onCancel={handleCancelUpload}
          loading={confirmationLoading}
        />
      )}
    </div>
  );
};

export default Dashboard;