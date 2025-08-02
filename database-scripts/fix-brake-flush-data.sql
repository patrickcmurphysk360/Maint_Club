-- Fix Brake Flush Data Script
-- This script corrects brake flush values that were incorrectly stored as percentages instead of counts
-- Author: Claude
-- Date: 2025-08-02

-- First, let's identify records where brake flush appears to be a percentage (has decimal or > 100)
SELECT 
    pd.id,
    pd.advisor_user_id,
    pd.upload_date,
    pd.data->>'employeeName' as employee_name,
    pd.data->>'storeName' as store_name,
    pd.data->>'brakeService' as brake_service,
    pd.data->>'brakeFlush' as brake_flush_current,
    pd.data->>'brakeFlushToServicePercent' as brake_flush_percent,
    -- Calculate what brake flush count should be
    CASE 
        WHEN (pd.data->>'brakeService')::numeric > 0 
        THEN ROUND((pd.data->>'brakeService')::numeric * (pd.data->>'brakeFlushToServicePercent')::numeric / 100)
        ELSE 0
    END as brake_flush_calculated
FROM performance_data pd
WHERE pd.data_type = 'services'
  AND pd.data->>'brakeFlush' IS NOT NULL
  AND (
    -- Check if brake flush value appears to be a percentage
    pd.data->>'brakeFlush' LIKE '%.%' -- Has decimal
    OR (pd.data->>'brakeFlush')::numeric = (pd.data->>'brakeFlushToServicePercent')::numeric -- Same as percentage
  )
ORDER BY pd.upload_date DESC, employee_name;

-- Create a backup table before making changes
CREATE TABLE IF NOT EXISTS performance_data_brake_flush_backup AS
SELECT id, data, upload_date
FROM performance_data
WHERE data_type = 'services'
  AND data->>'brakeFlush' IS NOT NULL
  AND (
    data->>'brakeFlush' LIKE '%.%'
    OR (data->>'brakeFlush')::numeric = (data->>'brakeFlushToServicePercent')::numeric
  );

-- Update the brake flush values to be actual counts instead of percentages
UPDATE performance_data pd
SET data = jsonb_set(
    data,
    '{brakeFlush}',
    to_jsonb(
        CASE 
            WHEN (data->>'brakeService')::numeric > 0 
            THEN ROUND((data->>'brakeService')::numeric * (data->>'brakeFlushToServicePercent')::numeric / 100)
            ELSE 0
        END
    )
)
WHERE data_type = 'services'
  AND data->>'brakeFlush' IS NOT NULL
  AND (
    data->>'brakeFlush' LIKE '%.%'
    OR (data->>'brakeFlush')::numeric = (data->>'brakeFlushToServicePercent')::numeric
  )
  AND data->>'brakeService' IS NOT NULL
  AND (data->>'brakeService')::numeric >= 0;

-- Verify the updates
SELECT 
    pd.id,
    pd.advisor_user_id,
    pd.upload_date,
    pd.data->>'employeeName' as employee_name,
    pd.data->>'storeName' as store_name,
    pd.data->>'brakeService' as brake_service,
    pd.data->>'brakeFlush' as brake_flush_fixed,
    pd.data->>'brakeFlushToServicePercent' as brake_flush_percent
FROM performance_data pd
WHERE pd.id IN (SELECT id FROM performance_data_brake_flush_backup)
ORDER BY pd.upload_date DESC, employee_name;

-- Show count of records fixed
SELECT COUNT(*) as records_fixed
FROM performance_data pd
WHERE pd.id IN (SELECT id FROM performance_data_brake_flush_backup);