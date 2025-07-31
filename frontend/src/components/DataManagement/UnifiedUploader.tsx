import React, { useState, useCallback } from 'react';
import {
  CloudArrowUpIcon,
  DocumentIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
  CalendarIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface FileInfo {
  marketId: string | number;
  market: string;
  date: string;
  time: string;
  type: 'services';
  format: 'new' | 'legacy';
  hash?: string;
  isValid: boolean;
  error?: string;
}

interface UnifiedUploaderProps {
  onUploadComplete: () => void;
}

const UnifiedUploader: React.FC<UnifiedUploaderProps> = ({ onUploadComplete }) => {
  const { token } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  const [reportDate, setReportDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [autoDetectDate, setAutoDetectDate] = useState(true);

  // Parse filename to extract metadata
  const parseFilename = (filename: string): FileInfo => {
    // New format: "market_id-YYYY-MM-DD-time-Services-hash.xlsx"
    // More flexible parsing to match backend
    const base = filename.replace(/\.xlsx?$/i, '');
    const tokens = base.split('-');
    
    // Check if it's the new format (starts with numeric market_id and has at least 6 segments)
    if (/^\d+-.+/.test(base) && tokens.length >= 6) {
      const marketId = tokens[0];
      const year = tokens[1];
      const month = tokens[2];
      const day = tokens[3];
      const time = tokens[4];
      const type = tokens[5];
      const hash = tokens.length > 6 ? tokens.slice(6).join('-') : '';
      
      // Validate date components
      if (year.length === 4 && month.length === 2 && day.length === 2) {
        const dateStr = `${year}-${month}-${day}`;
        const dateObj = new Date(dateStr);
        
        // Validate the date is valid and type is Services
        if (!isNaN(dateObj.getTime()) && type.toLowerCase() === 'services') {
          return {
            marketId: parseInt(marketId),
            market: `Market ${marketId}`,
            date: dateStr,
            time,
            type: 'services',
            format: 'new',
            hash,
            isValid: true
          };
        }
      }
    }

    // Legacy format: "Market Name - System - Services - YYYY-MM-DD.xlsx"
    const legacyFormatMatch = filename.match(/^(.+?)\s*-\s*(.+?)\s*-\s*Services\s*-\s*(\d{4}-\d{2}-\d{2})\.xlsx?$/i);
    
    if (legacyFormatMatch) {
      const [, market, system, date] = legacyFormatMatch;
      return {
        marketId: market.trim(),
        market: market.trim(),
        date,
        time: '0000',
        type: 'services',
        format: 'legacy',
        isValid: true
      };
    }

    return {
      marketId: '',
      market: '',
      date: '',
      time: '',
      type: 'services',
      format: 'new',
      isValid: false,
      error: 'Filename does not match expected Services format'
    };
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files?.[0]) {
      handleFileSelection(files[0]);
    }
  }, []);

  const handleFileSelection = (file: File) => {
    setSelectedFile(file);
    setUploadResult(null);
    
    // Auto-detect file info
    const info = parseFilename(file.name);
    setFileInfo(info);
    
    // Auto-set report date if detected and auto-detect is enabled
    if (autoDetectDate && info.isValid && info.date) {
      setReportDate(info.date);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !fileInfo?.isValid) return;

    setUploading(true);
    setUploadResult(null);

    const endpoint = `${process.env.REACT_APP_API_URL}/api/enhanced-upload/upload/services/discover`;

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('reportDate', reportDate);

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
      setUploadResult(result);
      onUploadComplete();

    } catch (error: any) {
      console.error('Upload error:', error);
      console.error('Upload error details:', {
        message: error.message,
        endpoint: endpoint,
        fileInfo: fileInfo,
        reportDate: reportDate
      });
      
      setUploadResult({
        error: error.message || 'Upload failed',
        success: false,
        details: {
          endpoint: endpoint,
          status: error.status,
          statusText: error.statusText
        }
      });
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setFileInfo(null);
    setUploadResult(null);
  };

  const renderFileInfo = () => {
    if (!fileInfo) return null;

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
          <DocumentTextIcon className="h-5 w-5 mr-2" />
          File Analysis
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Market:</span>
            <span className="ml-2 text-gray-900">{fileInfo.market || 'Unknown'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Type:</span>
            <span className="ml-2 text-gray-900 capitalize">{fileInfo.type}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Date:</span>
            <span className="ml-2 text-gray-900">{fileInfo.date || 'Not detected'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Format:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
              fileInfo.format === 'new' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {fileInfo.format}
            </span>
          </div>
        </div>

        {fileInfo.error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded flex items-start">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Invalid Filename Format</p>
              <p className="text-red-700 text-sm mt-1">{fileInfo.error}</p>
              <div className="mt-2 text-xs text-red-600">
                <p><strong>Expected Services formats:</strong></p>
                <p>• New: "123-2024-01-15-1200-Services-abc123.xlsx"</p>
                <p>• Legacy: "Market Name - System - Services - 2024-01-15.xlsx"</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUploadResult = () => {
    if (!uploadResult) return null;

    if (uploadResult.error) {
      return (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="w-full">
              <h4 className="font-medium text-red-800">Upload Failed</h4>
              <p className="text-red-700 text-sm mt-1">{uploadResult.error}</p>
              
              {uploadResult.details && (
                <div className="mt-3 text-xs text-red-600 bg-red-100 p-3 rounded">
                  <p><strong>Endpoint:</strong> {uploadResult.details.endpoint}</p>
                  {uploadResult.details.status && (
                    <p><strong>Status:</strong> {uploadResult.details.status} {uploadResult.details.statusText}</p>
                  )}
                  <p className="mt-2 font-medium">Troubleshooting:</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Check browser console for detailed error</li>
                    <li>Verify API server is running on port 5000</li>
                    <li>Ensure you're logged in with admin privileges</li>
                    <li>Check file format matches requirements</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start">
          <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-green-800">Upload Successful</h4>
            <p className="text-green-700 text-sm mt-1">{uploadResult.message}</p>
            
            {uploadResult.summary && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {uploadResult.summary.marketsFound && (
                  <div>
                    <span className="font-medium">Markets:</span>
                    <span className="ml-1">{uploadResult.summary.marketsFound}</span>
                  </div>
                )}
                {uploadResult.summary.storesFound && (
                  <div>
                    <span className="font-medium">Stores:</span>
                    <span className="ml-1">{uploadResult.summary.storesFound}</span>
                  </div>
                )}
                {uploadResult.summary.advisorsFound && (
                  <div>
                    <span className="font-medium">Advisors:</span>
                    <span className="ml-1">{uploadResult.summary.advisorsFound}</span>
                  </div>
                )}
                {uploadResult.summary.employees && (
                  <div>
                    <span className="font-medium">Records:</span>
                    <span className="ml-1">{uploadResult.summary.employees}</span>
                  </div>
                )}
              </div>
            )}

            {uploadResult.summary?.autoMatched && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <h5 className="font-medium text-blue-800">Auto-Matched Entities</h5>
                <div className="text-sm text-blue-700 mt-1 grid grid-cols-3 gap-4">
                  <div>Markets: {uploadResult.summary.autoMatched.markets}</div>
                  <div>Stores: {uploadResult.summary.autoMatched.stores}</div>
                  <div>Advisors: {uploadResult.summary.autoMatched.advisors}</div>
                </div>
                {uploadResult.summary.autoMatched.advisorsFromMappings > 0 && (
                  <p className="text-xs text-blue-600 mt-2">
                    ✅ {uploadResult.summary.autoMatched.advisorsFromMappings} advisors auto-mapped from previous uploads
                  </p>
                )}
              </div>
            )}

            {uploadResult.sessionId && (
              <div className="mt-3 flex items-center justify-between p-3 bg-white border rounded">
                <div>
                  <span className="text-sm font-medium">Session ID:</span>
                  <span className="ml-2 font-mono text-sm text-gray-600">{uploadResult.sessionId}</span>
                </div>
                <button className="btn btn-sm btn-secondary flex items-center">
                  <EyeIcon className="h-4 w-4 mr-1" />
                  Review
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Upload Data Files</h3>
          {selectedFile && (
            <button
              onClick={resetUpload}
              className="text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {!selectedFile ? (
          <>
            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop your Services spreadsheet here, or click to browse
              </p>
              <p className="text-gray-600 mb-4">
                Month-to-Date (MTD) advisor performance data
              </p>
              
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInputChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="btn btn-primary cursor-pointer inline-flex items-center"
              >
                <DocumentIcon className="h-4 w-4 mr-2" />
                Choose File
              </label>
            </div>

            {/* Format Information */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-800">Supported File Formats</h4>
                  <div className="text-sm text-blue-700 mt-2 space-y-1">
                    <p><strong>New Format:</strong> "marketId-YYYY-MM-DD-time-Services-hash.xlsx"</p>
                    <p><strong>Legacy Format:</strong> "Market Name - System - Services - YYYY-MM-DD.xlsx"</p>
                    <p><strong>Content:</strong> Month-to-Date advisor performance rollups</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Selected File Info */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <DocumentIcon className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {Math.round(selectedFile.size / 1024)} KB • {selectedFile.type || 'Excel file'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {fileInfo?.isValid ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                ) : (
                  <ExclamationCircleIcon className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>

            {/* File Analysis */}
            {renderFileInfo()}

            {/* Report Date Configuration */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2" />
                Report Date
              </h4>
              
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={autoDetectDate}
                    onChange={(e) => setAutoDetectDate(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Auto-detect from filename</span>
                </label>
                
                <div className="flex items-center">
                  <label className="text-sm font-medium text-gray-700 mr-2">Date:</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    disabled={autoDetectDate && fileInfo?.isValid && !!fileInfo.date}
                    className="form-input text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Upload Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleUpload}
                disabled={uploading || !fileInfo?.isValid}
                className="btn btn-primary flex items-center"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                    Upload & Process
                  </>
                )}
              </button>
            </div>

            {/* Upload Result */}
            {renderUploadResult()}
          </>
        )}
      </div>
    </div>
  );
};

export default UnifiedUploader;