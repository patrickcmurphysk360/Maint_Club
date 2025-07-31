import React, { useState, useEffect } from 'react';
import {
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  PlayIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  BugAntIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface TroubleshootingIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  solution: string;
  autoFixable: boolean;
  count: number;
  examples?: string[];
  lastOccurred: string;
}

interface SystemHealth {
  overallStatus: 'healthy' | 'warning' | 'critical';
  issues: TroubleshootingIssue[];
  recommendations: string[];
  systemChecks: Array<{
    name: string;
    status: 'pass' | 'warning' | 'fail';
    message: string;
  }>;
}

const DataTroubleshooter: React.FC = () => {
  const { token } = useAuth();
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningFixes, setRunningFixes] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadSystemHealth();
  }, []);

  const loadSystemHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/data-management/health-check`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSystemHealth(data);
      } else {
        // Mock data for development
        setSystemHealth({
          overallStatus: 'warning',
          issues: [
            {
              id: '1',
              type: 'error',
              category: 'file_format',
              title: 'Invalid Filename Formats',
              description: '5 recent uploads failed due to incorrect filename format',
              solution: 'Ensure filenames follow the pattern: "marketId-YYYY-MM-DD-time-Type-hash.xlsx"',
              autoFixable: false,
              count: 5,
              examples: ['data.xlsx', 'services-file.xlsx', 'invalid-name.xlsx'],
              lastOccurred: '2024-01-15T14:30:00Z'
            },
            {
              id: '2',
              type: 'warning',
              category: 'advisor_mapping',
              title: 'Unmapped Advisors',
              description: '8 advisor names found in uploads without user mappings',
              solution: 'Create advisor mappings for these names in the Data Mappings section',
              autoFixable: true,
              count: 8,
              examples: ['John Smith', 'Jane Doe', 'Mike Johnson'],
              lastOccurred: '2024-01-15T12:15:00Z'
            },
            {
              id: '3',
              type: 'warning',
              category: 'data_quality',
              title: 'Duplicate Advisor Names',
              description: '3 advisor names have multiple mappings',
              solution: 'Review and consolidate duplicate advisor mappings',
              autoFixable: false,
              count: 3,
              examples: ['John Smith', 'Sarah Wilson'],
              lastOccurred: '2024-01-14T16:45:00Z'
            },
            {
              id: '4',
              type: 'info',
              category: 'performance',
              title: 'Slow Processing Times',
              description: 'Some uploads are taking longer than usual to process',
              solution: 'Consider optimizing large spreadsheets or contact system administrator',
              autoFixable: false,
              count: 2,
              lastOccurred: '2024-01-14T10:20:00Z'
            }
          ],
          recommendations: [
            'Standardize filename formats across all uploads',
            'Create advisor mappings proactively before bulk uploads',
            'Validate spreadsheet data before uploading',
            'Set up automated data quality checks'
          ],
          systemChecks: [
            {
              name: 'Database Connection',
              status: 'pass',
              message: 'Database is responding normally'
            },
            {
              name: 'Upload Directory',
              status: 'pass',
              message: 'Upload directory is writable'
            },
            {
              name: 'File Processing',
              status: 'warning',
              message: 'Processing queue has 2 pending items'
            },
            {
              name: 'Advisor Mappings',
              status: 'warning',
              message: '8 unmapped advisors detected'
            },
            {
              name: 'Data Integrity',
              status: 'pass',
              message: 'No data corruption detected'
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error loading system health:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAutoFix = async (issueId: string) => {
    setRunningFixes(prev => new Set(prev).add(issueId));
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/data-management/autofix/${issueId}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        // Reload system health after fix
        await loadSystemHealth();
      }
    } catch (error) {
      console.error('Error running auto-fix:', error);
    } finally {
      setRunningFixes(prev => {
        const newSet = new Set(prev);
        newSet.delete(issueId);
        return newSet;
      });
    }
  };

  const getStatusIcon = (status: 'pass' | 'warning' | 'fail') => {
    switch (status) {
      case 'pass':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
      case 'fail':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />;
    }
  };

  const getIssueIcon = (type: 'error' | 'warning' | 'info') => {
    switch (type) {
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />;
      case 'info':
        return <InformationCircleIcon className="h-5 w-5 text-blue-600" />;
    }
  };

  const getOverallStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'critical':
        return 'text-red-600 bg-red-100';
    }
  };

  if (!systemHealth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const categories = ['all', ...new Set(systemHealth.issues.map(issue => issue.category))];
  const filteredIssues = selectedCategory === 'all' 
    ? systemHealth.issues 
    : systemHealth.issues.filter(issue => issue.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Data Troubleshooter</h2>
          <p className="text-gray-600">Identify and resolve data upload issues</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={loadSystemHealth}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <WrenchScrewdriverIcon className="h-5 w-5 mr-2" />
            System Health Overview
          </h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getOverallStatusColor(systemHealth.overallStatus)}`}>
            {systemHealth.overallStatus.toUpperCase()}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {systemHealth.systemChecks.map((check, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              {getStatusIcon(check.status)}
              <div>
                <p className="text-sm font-medium text-gray-900">{check.name}</p>
                <p className="text-xs text-gray-600">{check.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issues Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-red-100 text-red-600 mr-3">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Errors</p>
              <p className="text-2xl font-bold text-gray-900">
                {systemHealth.issues.filter(i => i.type === 'error').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600 mr-3">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Warnings</p>
              <p className="text-2xl font-bold text-gray-900">
                {systemHealth.issues.filter(i => i.type === 'warning').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100 text-green-600 mr-3">
              <BugAntIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-Fixable</p>
              <p className="text-2xl font-bold text-gray-900">
                {systemHealth.issues.filter(i => i.autoFixable).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Filter */}
      <div className="card p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Filter by category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="form-select text-sm"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Issues List */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Identified Issues</h3>
        </div>
        
        {filteredIssues.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredIssues.map((issue) => (
              <div key={issue.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getIssueIcon(issue.type)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{issue.title}</h4>
                        <span className="text-sm bg-gray-100 text-gray-800 px-2 py-1 rounded">
                          {issue.count} occurrences
                        </span>
                        <span className="text-xs text-gray-500">
                          Last: {new Date(issue.lastOccurred).toLocaleString()}
                        </span>
                      </div>
                      
                      <p className="text-gray-700 mb-3">{issue.description}</p>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <p className="text-sm font-medium text-blue-800 mb-1">Solution:</p>
                        <p className="text-sm text-blue-700">{issue.solution}</p>
                      </div>
                      
                      {issue.examples && issue.examples.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-gray-800 mb-1">Examples:</p>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {issue.examples.map((example, idx) => (
                              <li key={idx} className="flex items-center">
                                <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                                {example}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    {issue.autoFixable && (
                      <button
                        onClick={() => runAutoFix(issue.id)}
                        disabled={runningFixes.has(issue.id)}
                        className="btn btn-primary flex items-center"
                      >
                        {runningFixes.has(issue.id) ? (
                          <>
                            <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                            Fixing...
                          </>
                        ) : (
                          <>
                            <PlayIcon className="h-4 w-4 mr-2" />
                            Auto Fix
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <p className="text-gray-500">No issues found in this category</p>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <ClipboardDocumentListIcon className="h-5 w-5 mr-2" />
          System Recommendations
        </h3>
        
        <div className="space-y-3">
          {systemHealth.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="btn btn-secondary flex items-center justify-center">
            <DocumentTextIcon className="h-4 w-4 mr-2" />
            Export Logs
          </button>
          
          <button className="btn btn-secondary flex items-center justify-center">
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Clear Cache
          </button>
          
          <button className="btn btn-secondary flex items-center justify-center">
            <CheckCircleIcon className="h-4 w-4 mr-2" />
            Validate Data
          </button>
          
          <button className="btn btn-secondary flex items-center justify-center">
            <WrenchScrewdriverIcon className="h-4 w-4 mr-2" />
            System Repair
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTroubleshooter;