import React, { useState, useEffect } from 'react';
import {
  CircleStackIcon,
  TableCellsIcon,
  KeyIcon,
  LinkIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  EyeIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface DatabaseField {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_table?: string;
  foreign_column?: string;
  description?: string;
}

interface DatabaseTable {
  table_name: string;
  table_type: string;
  row_count: number;
  table_size: string;
  description?: string;
  fields: DatabaseField[];
}

interface TableGroup {
  name: string;
  description: string;
  tables: DatabaseTable[];
  color: string;
}

const DatabaseSchemaViewer: React.FC = () => {
  const { token } = useAuth();
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['performance']));
  const [sampleData, setSampleData] = useState<Record<string, any[]>>({});

  useEffect(() => {
    loadDatabaseSchema();
  }, []);

  const loadDatabaseSchema = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/data-management/database-schema`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('Error loading database schema:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSampleData = async (tableName: string) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/data-management/sample-data/${tableName}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSampleData(prev => ({
          ...prev,
          [tableName]: data.rows || []
        }));
      }
    } catch (error) {
      console.error('Error loading sample data:', error);
    }
  };

  const tableGroups: TableGroup[] = [
    {
      name: 'performance',
      description: 'Performance & Upload Data',
      color: 'text-blue-600 bg-blue-100',
      tables: tables.filter(t => 
        ['performance_data', 'file_uploads', 'upload_sessions', 'advisor_mappings'].includes(t.table_name)
      )
    },
    {
      name: 'core',
      description: 'Core Business Entities',
      color: 'text-green-600 bg-green-100',
      tables: tables.filter(t => 
        ['markets', 'stores', 'users', 'service_catalog', 'vendor_mappings'].includes(t.table_name)
      )
    },
    {
      name: 'scorecard',
      description: 'Scorecard & Goals',
      color: 'text-purple-600 bg-purple-100',
      tables: tables.filter(t => 
        ['scorecard_templates', 'scorecard_categories', 'advisor_goals', 'coaching_messages'].includes(t.table_name)
      )
    },
    {
      name: 'system',
      description: 'System & Configuration',
      color: 'text-gray-600 bg-gray-100',
      tables: tables.filter(t => 
        !['performance_data', 'file_uploads', 'upload_sessions', 'advisor_mappings',
          'markets', 'stores', 'users', 'service_catalog', 'vendor_mappings',
          'scorecard_templates', 'scorecard_categories', 'advisor_goals', 'coaching_messages'].includes(t.table_name)
      )
    }
  ];

  const filteredTables = tables.filter(table =>
    table.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    table.fields.some(field => 
      field.column_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  const getFieldTypeColor = (dataType: string) => {
    switch (dataType.toLowerCase()) {
      case 'integer':
      case 'bigint':
      case 'numeric':
        return 'text-blue-600 bg-blue-100';
      case 'character varying':
      case 'text':
        return 'text-green-600 bg-green-100';
      case 'boolean':
        return 'text-purple-600 bg-purple-100';
      case 'timestamp without time zone':
      case 'timestamp with time zone':
      case 'date':
        return 'text-orange-600 bg-orange-100';
      case 'jsonb':
      case 'json':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const renderTableCard = (table: DatabaseTable) => (
    <div key={table.table_name} className="border border-gray-200 rounded-lg">
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => {
          setSelectedTable(selectedTable === table.table_name ? null : table.table_name);
          if (selectedTable !== table.table_name && !sampleData[table.table_name]) {
            loadSampleData(table.table_name);
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TableCellsIcon className="h-5 w-5 text-gray-600" />
            <div>
              <h4 className="font-medium text-gray-900">{table.table_name}</h4>
              <p className="text-sm text-gray-600">
                {table.fields.length} fields • {table.row_count} rows • {table.table_size}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {selectedTable === table.table_name ? (
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            )}
          </div>
        </div>
      </div>

      {selectedTable === table.table_name && (
        <div className="border-t border-gray-200">
          {/* Table Fields */}
          <div className="p-4">
            <h5 className="font-medium text-gray-900 mb-3">Fields ({table.fields.length})</h5>
            <div className="space-y-2">
              {table.fields.map((field) => (
                <div key={field.column_name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {field.is_primary_key && <KeyIcon className="h-3 w-3 text-yellow-600" title="Primary Key" />}
                      {field.is_foreign_key && <LinkIcon className="h-3 w-3 text-blue-600" title="Foreign Key" />}
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {field.column_name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getFieldTypeColor(field.data_type)}`}>
                      {field.data_type}
                      {field.character_maximum_length && `(${field.character_maximum_length})`}
                    </span>
                    {field.is_nullable === 'NO' && (
                      <span className="text-xs text-red-600 font-medium">NOT NULL</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sample Data */}
          {sampleData[table.table_name] && (
            <div className="border-t border-gray-200 p-4">
              <h5 className="font-medium text-gray-900 mb-3">Sample Data</h5>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      {table.fields.slice(0, 6).map((field) => (
                        <th key={field.column_name} className="px-2 py-1 text-left font-medium text-gray-700">
                          {field.column_name}
                        </th>
                      ))}
                      {table.fields.length > 6 && (
                        <th className="px-2 py-1 text-left font-medium text-gray-500">...</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sampleData[table.table_name].slice(0, 3).map((row, idx) => (
                      <tr key={idx}>
                        {table.fields.slice(0, 6).map((field) => (
                          <td key={field.column_name} className="px-2 py-1 text-gray-900">
                            {typeof row[field.column_name] === 'object' 
                              ? JSON.stringify(row[field.column_name]).substring(0, 30) + '...'
                              : String(row[field.column_name] || '').substring(0, 30)
                            }
                          </td>
                        ))}
                        {table.fields.length > 6 && (
                          <td className="px-2 py-1 text-gray-500">...</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Database Schema</h2>
          <p className="text-gray-600">View database tables, fields, and sample data</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={loadDatabaseSchema}
            disabled={loading}
            className="btn btn-secondary flex items-center"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600 mr-3">
              <CircleStackIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Total Tables</p>
              <p className="text-2xl font-bold text-gray-900">{tables.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-green-100 text-green-600 mr-3">
              <TableCellsIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Total Fields</p>
              <p className="text-2xl font-bold text-gray-900">
                {tables.reduce((sum, table) => sum + table.fields.length, 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600 mr-3">
              <KeyIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Primary Keys</p>
              <p className="text-2xl font-bold text-gray-900">
                {tables.reduce((sum, table) => 
                  sum + table.fields.filter(f => f.is_primary_key).length, 0
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-orange-100 text-orange-600 mr-3">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Foreign Keys</p>
              <p className="text-2xl font-bold text-gray-900">
                {tables.reduce((sum, table) => 
                  sum + table.fields.filter(f => f.is_foreign_key).length, 0
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tables and fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input pl-10 w-full"
          />
        </div>
      </div>

      {/* Performance Data Reminder */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Key Tables for Services Data</h4>
            <div className="text-sm text-blue-700 mt-1">
              <p><strong>performance_data:</strong> Raw MTD advisor performance from spreadsheets</p>
              <p><strong>markets:</strong> Market definitions and metadata</p>
              <p><strong>stores:</strong> Store information linked to markets</p>
              <p><strong>users:</strong> Advisor/employee user accounts</p>
              <p><strong>advisor_mappings:</strong> Links spreadsheet names to user accounts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Database Tables by Group */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {tableGroups.map((group) => (
            <div key={group.name} className="card">
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-200"
                onClick={() => toggleGroup(group.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${group.color}`}>
                      <CircleStackIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{group.description}</h3>
                      <p className="text-sm text-gray-600">{group.tables.length} tables</p>
                    </div>
                  </div>
                  {expandedGroups.has(group.name) ? (
                    <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              </div>

              {expandedGroups.has(group.name) && (
                <div className="p-4 space-y-4">
                  {group.tables.length > 0 ? (
                    group.tables.map(renderTableCard)
                  ) : (
                    <p className="text-gray-500 text-center py-4">No tables in this group</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search Results */}
      {searchTerm && (
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Search Results</h3>
            <p className="text-sm text-gray-600">{filteredTables.length} tables found</p>
          </div>
          <div className="p-4 space-y-4">
            {filteredTables.map(renderTableCard)}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseSchemaViewer;