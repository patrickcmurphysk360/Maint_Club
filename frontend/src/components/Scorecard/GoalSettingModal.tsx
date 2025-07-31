import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { AdvisorScorecardData } from '../../types/scorecard';
import { SERVICE_CATEGORIES } from '../../constants/serviceCategories';

interface GoalSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  advisor: AdvisorScorecardData;
  onSetGoal: (metric: string, target: number, period: string) => Promise<void>;
}

const GoalSettingModal: React.FC<GoalSettingModalProps> = ({ 
  isOpen, 
  onClose, 
  advisor,
  onSetGoal 
}) => {
  const [metric, setMetric] = useState('');
  const [target, setTarget] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Core KPIs
  const coreMetrics = [
    { value: 'totalSales', label: 'Total Sales', current: advisor.totalSales },
    { value: 'salesPerVehicle', label: 'Sales per Vehicle', current: advisor.salesPerVehicle },
    { value: 'grossProfit', label: 'Gross Profit', current: advisor.grossProfit },
    { value: 'grossProfitPercent', label: 'Gross Profit %', current: advisor.grossProfitPercent },
    { value: 'customerCount', label: 'Customer Count', current: advisor.customerCount }
  ];

  // Get service value from advisor data
  const getServiceValue = (serviceKey: string): number => {
    return (advisor as any)[serviceKey] || 0;
  };

  // Service metrics organized by category
  const serviceMetrics = SERVICE_CATEGORIES.map(category => ({
    category: category.name,
    metrics: category.services.map(service => ({
      value: service.key,
      label: service.label,
      current: getServiceValue(service.key)
    }))
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metric || !target) return;

    setLoading(true);
    setError('');

    try {
      await onSetGoal(metric, parseInt(target), period);
      // Reset form
      setMetric('');
      setTarget('');
      setPeriod('monthly');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to set goal');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Set Goal for {advisor.employee}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Metric
              </label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="form-input w-full"
                required
              >
                <option value="">Select a metric</option>
                
                <optgroup label="Core KPIs">
                  {coreMetrics.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} (Current: {m.current.toLocaleString()})
                    </option>
                  ))}
                </optgroup>
                
                {serviceMetrics.map((categoryGroup) => (
                  <optgroup key={categoryGroup.category} label={categoryGroup.category}>
                    {categoryGroup.metrics.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label} (Current: {m.current})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Value
              </label>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="form-input w-full"
                placeholder="Enter target value"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="form-input w-full"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !metric || !target}
              className="btn btn-primary"
            >
              {loading ? 'Setting...' : 'Set Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GoalSettingModal;