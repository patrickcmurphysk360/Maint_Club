import React from 'react';
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface GoalIndicatorProps {
  actual: number;
  goal?: number;
  format?: 'currency' | 'percentage' | 'number';
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const GoalIndicator: React.FC<GoalIndicatorProps> = ({ 
  actual, 
  goal, 
  format = 'number',
  showValue = true,
  size = 'sm'
}) => {
  if (!goal || goal === 0) return null;

  const variance = actual - goal;
  const variancePercent = ((actual - goal) / goal) * 100;
  const isPositive = variance >= 0;
  const isAtGoal = actual >= goal;

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
      default:
        return Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <div className={`flex items-center space-x-1 ${sizeClasses[size]}`}>
      {/* Goal Status Icon */}
      {isAtGoal ? (
        <CheckCircleIcon className={`${iconSizes[size]} text-green-600`} />
      ) : (
        <XCircleIcon className={`${iconSizes[size]} text-red-600`} />
      )}
      
      {/* Goal Value */}
      <span className="text-gray-600">
        Goal: {formatValue(goal)}
      </span>
      
      {/* Variance */}
      <div className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? (
          <ArrowUpIcon className={`${iconSizes[size]} mr-0.5`} />
        ) : (
          <ArrowDownIcon className={`${iconSizes[size]} mr-0.5`} />
        )}
        
        {showValue && (
          <span className="font-medium">
            {isPositive ? '+' : '-'}{formatValue(variance)}
            <span className="text-gray-500 ml-0.5">
              ({Math.abs(variancePercent).toFixed(0)}%)
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

export default GoalIndicator;