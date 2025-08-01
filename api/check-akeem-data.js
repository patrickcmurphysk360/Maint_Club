#!/usr/bin/env node

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'maintenance_club_mvp',
  user: 'postgres',
  password: 'yourpassword'
});

async function checkAkeemData() {
  try {
    console.log('🔍 Checking Akeem Jackson\'s data...\n');
    
    // 1. First, find Akeem in advisor_mappings
    console.log('1. Looking for Akeem Jackson in advisor_mappings...');
    const mappingResult = await pool.query(`
      SELECT 
        id, 
        spreadsheet_name, 
        user_id, 
        market_id, 
        store_id,
        is_active
      FROM advisor_mappings 
      WHERE LOWER(spreadsheet_name) LIKE '%akeem%' 
         OR LOWER(spreadsheet_name) LIKE '%jackson%'
      ORDER BY spreadsheet_name
    `);
    
    console.log(`Found ${mappingResult.rows.length} mappings:`);
    mappingResult.rows.forEach(row => {
      console.log(`  - ${row.spreadsheet_name} → User ID: ${row.user_id}, Store: ${row.store_id}, Active: ${row.is_active}`);
    });
    
    if (mappingResult.rows.length === 0) {
      console.log('❌ No Akeem Jackson found in advisor_mappings');
      
      // Check all advisor names to see variations
      console.log('\n📋 All advisor names in system:');
      const allAdvisors = await pool.query(`
        SELECT DISTINCT spreadsheet_name 
        FROM advisor_mappings 
        WHERE is_active = true 
        ORDER BY spreadsheet_name
      `);
      allAdvisors.rows.forEach(row => {
        console.log(`  - ${row.spreadsheet_name}`);
      });
      return;
    }
    
    // 2. Get the user_id for Akeem
    const akeemUserId = mappingResult.rows[0].user_id;
    console.log(`\n2. Using User ID: ${akeemUserId} for Akeem Jackson`);
    
    // 3. Check performance data for Akeem from July 31, 2025 (July 30 data)
    console.log('\n3. Checking performance data for July 31, 2025 upload (July 30 data)...');
    const performanceResult = await pool.query(`
      SELECT 
        pd.upload_date,
        pd.store_id,
        s.name as store_name,
        m.name as market_name,
        pd.data
      FROM performance_data pd
      LEFT JOIN stores s ON pd.store_id::text = s.id::text
      LEFT JOIN markets m ON s.market_id = m.id
      WHERE pd.advisor_user_id = $1
        AND pd.data_type = 'services'
        AND pd.upload_date >= '2025-07-31'
        AND pd.upload_date < '2025-08-01'
      ORDER BY pd.upload_date DESC, s.name
    `, [akeemUserId]);
    
    console.log(`Found ${performanceResult.rows.length} performance records for July 31:`);
    
    performanceResult.rows.forEach((row, index) => {
      const data = row.data;
      console.log(`\n📊 Record ${index + 1}: ${row.store_name} (Store ID: ${row.store_id})`);
      console.log(`   Upload Date: ${row.upload_date}`);
      console.log(`   Market: ${row.market_name}`);
      console.log(`   Core Metrics:`);
      console.log(`     - Invoices: ${data.invoices || 0}`);
      console.log(`     - Sales: $${data.sales || 0}`);
      console.log(`     - GP Sales: $${data.gpSales || 0}`);
      console.log(`     - GP Percent: ${data.gpPercent || 0}%`);
      console.log(`     - Avg Spend: $${data.invoices > 0 ? (data.sales / data.invoices).toFixed(2) : 0}`);
      
      // Check for All Tires
      if (data.allTires !== undefined) {
        console.log(`     - All Tires: ${data.allTires}`);
      } else if (data.otherServices && data.otherServices['All Tires']) {
        console.log(`     - All Tires (from otherServices): ${data.otherServices['All Tires']}`);
      } else {
        console.log(`     - All Tires: Not found in data`);
      }
      
      // Show first few service fields for debugging
      console.log(`   Sample Services:`);
      const serviceKeys = Object.keys(data).filter(key => 
        !['invoices', 'sales', 'gpSales', 'gpPercent', 'otherServices'].includes(key)
      ).slice(0, 5);
      serviceKeys.forEach(key => {
        console.log(`     - ${key}: ${data[key]}`);
      });
      
      if (data.otherServices) {
        console.log(`   Other Services (first 5):`);
        const otherKeys = Object.keys(data.otherServices).slice(0, 5);
        otherKeys.forEach(key => {
          console.log(`     - ${key}: ${data.otherServices[key]}`);
        });
      }
    });
    
    // 4. Focus on Atlanta store specifically
    console.log('\n4. Looking specifically for Atlanta store data...');
    const atlantaData = performanceResult.rows.find(row => 
      row.store_name && row.store_name.toLowerCase().includes('atlanta')
    );
    
    if (atlantaData) {
      console.log(`\n🎯 ATLANTA STORE ANALYSIS:`);
      console.log(`Store: ${atlantaData.store_name}`);
      console.log(`Store ID: ${atlantaData.store_id}`);
      const data = atlantaData.data;
      
      console.log(`\n📊 Expected vs Actual Comparison:`);
      console.log(`Invoices:   Expected: 216,    Actual: ${data.invoices || 0}`);
      console.log(`Sales:      Expected: $64,779, Actual: $${data.sales || 0}`);
      console.log(`GP Sales:   Expected: $27,656, Actual: $${data.gpSales || 0}`);
      console.log(`GP Percent: Expected: 42.7%,   Actual: ${data.gpPercent || 0}%`);
      
      const actualAvgSpend = data.invoices > 0 ? (data.sales / data.invoices) : 0;
      console.log(`Avg Spend:  Expected: $300,    Actual: $${actualAvgSpend.toFixed(2)}`);
      
      // Look for All Tires in various locations
      let allTires = 0;
      if (data.allTires !== undefined) {
        allTires = data.allTires;
        console.log(`All Tires:  Expected: 191,     Actual: ${allTires} (from data.allTires)`);
      } else if (data.otherServices && data.otherServices['All Tires']) {
        allTires = data.otherServices['All Tires'];
        console.log(`All Tires:  Expected: 191,     Actual: ${allTires} (from otherServices)`);
      } else {
        // Search through all fields for tire-related data
        console.log(`All Tires:  Expected: 191,     Actual: NOT FOUND - searching...`);
        Object.keys(data).forEach(key => {
          if (key.toLowerCase().includes('tire')) {
            console.log(`  Found tire field: ${key} = ${data[key]}`);
          }
        });
        if (data.otherServices) {
          Object.keys(data.otherServices).forEach(key => {
            if (key.toLowerCase().includes('tire')) {
              console.log(`  Found tire field in otherServices: ${key} = ${data.otherServices[key]}`);
            }
          });
        }
      }
      
      // Check if data matches expectations
      const matches = {
        invoices: Math.abs((data.invoices || 0) - 216) <= 1,
        sales: Math.abs((data.sales || 0) - 64779) <= 100,
        gpSales: Math.abs((data.gpSales || 0) - 27656) <= 100,
        gpPercent: Math.abs((data.gpPercent || 0) - 42.7) <= 0.5,
        avgSpend: Math.abs(actualAvgSpend - 300) <= 5,
        allTires: Math.abs(allTires - 191) <= 1
      };
      
      console.log(`\n✅ Data Accuracy Check:`);
      console.log(`Invoices:   ${matches.invoices ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log(`Sales:      ${matches.sales ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log(`GP Sales:   ${matches.gpSales ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log(`GP Percent: ${matches.gpPercent ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log(`Avg Spend:  ${matches.avgSpend ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log(`All Tires:  ${matches.allTires ? '✅ MATCH' : '❌ MISMATCH'}`);
      
    } else {
      console.log(`❌ No Atlanta store data found for Akeem Jackson`);
      console.log(`Available stores: ${performanceResult.rows.map(r => r.store_name).join(', ')}`);
    }
    
    // 5. Check store mapping
    console.log('\n5. Checking store information...');
    const storeResult = await pool.query(`
      SELECT id, name, market_id 
      FROM stores 
      WHERE LOWER(name) LIKE '%atlanta%'
      ORDER BY name
    `);
    
    console.log(`Atlanta stores in system:`);
    storeResult.rows.forEach(store => {
      console.log(`  - ID: ${store.id}, Name: ${store.name}, Market: ${store.market_id}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking Akeem data:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkAkeemData();