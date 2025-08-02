import React, { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowRightIcon,
  EyeIcon,
  ArrowPathIcon,
  ChartBarIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface SpreadsheetFile {
  id: string;
  filename: string;
  uploadDate: string;
  market: string;
  advisorCount: number;
  status: string;
}

interface AdvisorAuditData {
  advisorId: number;
  advisorName: string;
  stores: string[];
  spreadsheetFile: SpreadsheetFile;
  rawSpreadsheetData: Record<string, any>[];
  processedData: Record<string, any>;
  scorecardData: Record<string, any>;
  discrepancies: DiscrepancyItem[];
  lastUpdate: string;
}

interface DiscrepancyItem {
  field: string;
  spreadsheetValue: any;
  scorecardValue: any;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

interface AuditSummary {
  totalAdvisors: number;
  advisorsWithDiscrepancies: number;
  criticalDiscrepancies: number;
  lastAuditRun: string;
  dataIntegrityScore: number;
  recentFiles: SpreadsheetFile[];
}

const DataAuditViewer: React.FC = () => {
  const { token } = useAuth();
  const [auditData, setAuditData] = useState<AdvisorAuditData[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [selectedAdvisor, setSelectedAdvisor] = useState<AdvisorAuditData | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    loadAuditData();
  }, [selectedFileId]);

  const loadAuditData = async () => {
    setLoading(true);
    try {
      // Get audit summary and available files
      const summaryResponse = await fetch(
        `${process.env.REACT_APP_API_URL}/api/data-audit/summary`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (summaryResponse.ok) {
        const summary = await summaryResponse.json();
        setAuditSummary(summary);
        
        // Set first file as default if none selected
        if (!selectedFileId && summary.recentFiles && summary.recentFiles.length > 0) {
          setSelectedFileId(summary.recentFiles[0].id);
        }
      }

      // Get detailed audit data for selected file
      if (selectedFileId) {
        const dataResponse = await fetch(
          `${process.env.REACT_APP_API_URL}/api/data-audit/details/${selectedFileId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        if (dataResponse.ok) {
          const data = await dataResponse.json();
          setAuditData(data.advisors || []);
        }
      }
      
    } catch (error) {
      console.error('Error loading audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runDataAudit = async () => {
    if (!selectedFileId) {
      alert('Please select a file to audit');
      return;
    }
    
    setRunningAudit(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/data-audit/run/${selectedFileId}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('Audit completed:', result);
        loadAuditData();
      } else {
        throw new Error('Audit failed');
      }
      
    } catch (error) {
      console.error('Error running audit:', error);
      alert('Failed to run data audit');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleFileChange = (fileId: string) => {
    setSelectedFileId(fileId);
    setSelectedAdvisor(null); // Clear selected advisor when changing files
    // Reload audit data for the new file
    setTimeout(loadAuditData, 100);
  };

  const getSeverityBadge = (severity: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (severity) {
      case 'high':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'medium':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'low':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircleIcon className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircleIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      return value % 1 === 0 ? value.toString() : value.toFixed(2);
    }
    return value.toString();
  };

  const filteredAuditData = auditData.filter(advisor => {
    const matchesSearch = advisor.advisorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === 'all' || 
      advisor.discrepancies.some(d => d.severity === filterSeverity);
    
    return matchesSearch && matchesSeverity;
  });

  const renderAuditSummary = () => {
    if (!auditSummary) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600 mr-3">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Total Advisors</p>
              <p className="text-2xl font-bold text-gray-900">{auditSummary.totalAdvisors}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600 mr-3">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">With Discrepancies</p>
              <p className="text-2xl font-bold text-gray-900">{auditSummary.advisorsWithDiscrepancies}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-red-100 text-red-600 mr-3">
              <XCircleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Critical Issues</p>
              <p className="text-2xl font-bold text-gray-900">{auditSummary.criticalDiscrepancies}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100 text-green-600 mr-3">
              <ChartBarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Integrity Score</p>
              <p className="text-2xl font-bold text-gray-900">{auditSummary.dataIntegrityScore}%</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdvisorList = () => {
    return (
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Advisor Data Audit Results</h3>
            <button
              onClick={runDataAudit}
              disabled={runningAudit}
              className="btn btn-primary flex items-center"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${runningAudit ? 'animate-spin' : ''}`} />
              {runningAudit ? 'Running Audit...' : 'Run New Audit'}
            </button>
          </div>
          
          {/* Filters */}
          <div className="flex space-x-4 mt-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search advisors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredAuditData.map((advisor) => (
            <div key={advisor.advisorId} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900">{advisor.advisorName}</h4>
                    <span className="text-sm text-gray-500">
                      {advisor.stores.length} store{advisor.stores.length > 1 ? 's' : ''}
                    </span>
                    {advisor.discrepancies.length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {advisor.discrepancies.length} issue{advisor.discrepancies.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    <span>Stores: {advisor.stores.join(', ')}</span>
                    <span>Last Update: {new Date(advisor.lastUpdate).toLocaleString()}</span>
                  </div>

                  {advisor.discrepancies.length > 0 && (
                    <div className="mt-2 flex space-x-2">
                      {advisor.discrepancies.slice(0, 3).map((discrepancy, index) => (
                        <div key={index} className="flex items-center space-x-1">
                          {getSeverityIcon(discrepancy.severity)}
                          <span className="text-xs text-gray-600">{discrepancy.field}</span>
                        </div>
                      ))}
                      {advisor.discrepancies.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{advisor.discrepancies.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedAdvisor(advisor)}
                  className="btn btn-secondary flex items-center"
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredAuditData.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No advisors found matching your criteria</p>
          </div>
        )}
      </div>
    );
  };

  const renderAdvisorDetail = () => {
    if (!selectedAdvisor) return null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{selectedAdvisor.advisorName} - Data Audit Details</h3>
            <p className="text-gray-600">Spreadsheet to Scorecard Data Flow Analysis</p>
            {selectedAdvisor.spreadsheetFile && (
              <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                <span>📄 {selectedAdvisor.spreadsheetFile.filename}</span>
                <span>📅 {new Date(selectedAdvisor.spreadsheetFile.uploadDate).toLocaleDateString()}</span>
                <span>🏪 {selectedAdvisor.stores.length} store{selectedAdvisor.stores.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSelectedAdvisor(null)}
            className="btn btn-secondary"
          >
            ← Back to List
          </button>
        </div>

        {/* Discrepancies */}
        {selectedAdvisor.discrepancies.length > 0 && (
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h4 className="font-medium text-red-900">Data Discrepancies Found</h4>
            </div>
            <div className="divide-y divide-gray-200">
              {selectedAdvisor.discrepancies.map((discrepancy, index) => (
                <div key={index} className="p-4">
                  <div className="flex items-start space-x-3">
                    {getSeverityIcon(discrepancy.severity)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h5 className="font-medium text-gray-900">{discrepancy.field}</h5>
                        <span className={getSeverityBadge(discrepancy.severity)}>
                          {discrepancy.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{discrepancy.description}</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Spreadsheet Value:</p>
                          <p className="font-medium">{formatValue(discrepancy.spreadsheetValue)}</p>
                        </div>
                        <div className="text-center">
                          <ArrowRightIcon className="h-4 w-4 mx-auto text-gray-400" />
                        </div>
                        <div>
                          <p className="text-gray-500">Scorecard Value:</p>
                          <p className="font-medium">{formatValue(discrepancy.scorecardValue)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Flow Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Raw Spreadsheet Data */}
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h4 className="font-medium text-gray-900 flex items-center">
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Raw Spreadsheet Data
              </h4>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {selectedAdvisor.rawSpreadsheetData.length > 0 ? (
                <div className="space-y-3">
                  {selectedAdvisor.rawSpreadsheetData.map((storeData, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded text-xs">
                      <h5 className="font-medium mb-2">Store: {storeData.storeName || 'Unknown'}</h5>
                      <div className="space-y-1">
                        {Object.entries(storeData).slice(0, 8).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-600">{key}:</span>
                            <span className="font-medium">{formatValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No raw data available</p>
              )}
            </div>
          </div>

          {/* Processed/Aggregated Data */}
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h4 className="font-medium text-gray-900 flex items-center">
                <ArrowRightIcon className="h-4 w-4 mr-2" />
                Processed Data
              </h4>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2 text-xs">
                {Object.entries(selectedAdvisor.processedData).slice(0, 12).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600">{key}:</span>
                    <span className="font-medium">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Final Scorecard Data */}
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h4 className="font-medium text-gray-900 flex items-center">
                <ChartBarIcon className="h-4 w-4 mr-2" />
                Scorecard Display
              </h4>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2 text-xs">
                {Object.entries(selectedAdvisor.scorecardData).slice(0, 12).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600">{key}:</span>
                    <span className="font-medium">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Spreadsheet to Scorecard Data Audit</h2>
        <p className="text-gray-600">Verify data integrity from upload to display</p>
      </div>

      {/* File Selection */}
      {auditSummary && auditSummary.recentFiles && auditSummary.recentFiles.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Select Spreadsheet File to Audit</h3>
            {selectedFileId && (
              <div className="text-sm text-gray-600">
                Currently auditing: <span className="font-medium">
                  {auditSummary.recentFiles.find(f => f.id === selectedFileId)?.filename || 'Unknown File'}
                </span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {auditSummary.recentFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => handleFileChange(file.id)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedFileId === file.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 truncate">{file.filename}</h4>
                    <p className="text-sm text-gray-600 mt-1">{file.market}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(file.uploadDate).toLocaleDateString()} • {file.advisorCount} advisors
                    </p>
                  </div>
                  <div className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    file.status === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {file.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedAdvisor ? (
        <>
          {renderAuditSummary()}
          {selectedFileId ? renderAdvisorList() : (
            <div className="card p-8 text-center">
              <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Spreadsheet File</h3>
              <p className="text-gray-600">Choose a spreadsheet file above to audit its data integrity</p>
            </div>
          )}
        </>
      ) : (
        renderAdvisorDetail()
      )}
    </div>
  );
};

export default DataAuditViewer;