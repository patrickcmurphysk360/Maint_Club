const ExcelParser = require('./excelParser');

class UploadProcessor {
  constructor(pool) {
    this.pool = pool;
    this.excelParser = new ExcelParser();
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - matrix[len1][len2]) / maxLen;
  }

  /**
   * Find best matching store from existing stores
   */
  findBestStoreMatch(storeName, existingStores, threshold = 0.7) {
    let bestMatch = null;
    let bestScore = 0;

    const normalizedStoreName = storeName.toLowerCase().trim();

    for (const store of existingStores) {
      const normalizedExisting = store.name.toLowerCase().trim();
      
      // Check for exact match first
      if (normalizedStoreName === normalizedExisting) {
        return { store, score: 1.0 };
      }

      // Check for partial matches
      if (normalizedStoreName.includes(normalizedExisting) || normalizedExisting.includes(normalizedStoreName)) {
        const score = 0.9;
        if (score > bestScore) {
          bestMatch = store;
          bestScore = score;
        }
      }

      // Calculate similarity score
      const similarity = this.calculateSimilarity(normalizedStoreName, normalizedExisting);
      if (similarity > bestScore && similarity >= threshold) {
        bestMatch = store;
        bestScore = similarity;
      }
    }

    return bestMatch ? { store: bestMatch, score: bestScore } : null;
  }

  /**
   * Find best matching advisor from existing users
   */
  findBestAdvisorMatch(advisorName, existingUsers, threshold = 0.7) {
    let bestMatch = null;
    let bestScore = 0;

    const normalizedAdvisorName = advisorName.toLowerCase().trim();
    const advisorParts = normalizedAdvisorName.split(' ').filter(p => p.length > 0);

    for (const user of existingUsers) {
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase().trim();
      const userParts = fullName.split(' ').filter(p => p.length > 0);

      // Check for exact match
      if (normalizedAdvisorName === fullName) {
        return { user, score: 1.0 };
      }

      // Check if all advisor name parts match user name parts
      const matchingParts = advisorParts.filter(part => 
        userParts.some(userPart => userPart.includes(part) || part.includes(userPart))
      );

      if (matchingParts.length === advisorParts.length && advisorParts.length > 0) {
        const score = 0.95;
        if (score > bestScore) {
          bestMatch = user;
          bestScore = score;
        }
      }

      // Calculate similarity score
      const similarity = this.calculateSimilarity(normalizedAdvisorName, fullName);
      if (similarity > bestScore && similarity >= threshold) {
        bestMatch = user;
        bestScore = similarity;
      }
    }

    return bestMatch ? { user: bestMatch, score: bestScore } : null;
  }

  /**
   * Process services file with auto-discovery of markets, stores, and advisors
   */
  async processServicesFile(filePath, originalFilename, reportDate, userId) {
    console.log('📁 ProcessServicesFile called with:', { filePath, originalFilename, reportDate, userId });
    
    const fileInfo = this.excelParser.parseFileName(originalFilename);
    console.log('📝 File info parsed:', fileInfo);
    
    if (!fileInfo.isValid) {
      console.error('❌ File info invalid:', fileInfo.error);
      throw new Error(fileInfo.error);
    }

    // Parse the Excel file
    console.log('📊 Parsing Excel file...');
    const parsedData = this.excelParser.parseServicesFile(filePath);
    console.log('📊 Parsed data summary:', {
      employees: parsedData.employees?.length || 0,
      stores: parsedData.stores?.length || 0,
      markets: parsedData.markets?.length || 0
    });
    
    if (!parsedData.employees.length) {
      throw new Error('No employee data found in services file');
    }

    // Extract unique markets and stores from the data
    const discoveredMarkets = this.extractUniqueMarkets(parsedData);
    const discoveredStores = this.extractUniqueStores(parsedData);
    const discoveredAdvisors = this.extractUniqueAdvisors(parsedData);

    // Create upload session record
    const uploadSession = await this.createUploadSession({
      filename: originalFilename,
      fileType: 'services',
      reportDate,
      userId,
      marketId: fileInfo.marketId,
      discoveredMarkets,
      discoveredStores,
      discoveredAdvisors,
      rawData: parsedData
    });

    return {
      sessionId: uploadSession.id,
      fileInfo,
      discovered: {
        markets: discoveredMarkets,
        stores: discoveredStores,
        advisors: discoveredAdvisors
      },
      summary: {
        employees: parsedData.employees.length,
        marketsFound: discoveredMarkets.length,
        storesFound: discoveredStores.length,
        advisorsFound: discoveredAdvisors.length
      }
    };
  }

  /**
   * Process operations file
   */
  async processOperationsFile(filePath, originalFilename, reportDate, userId) {
    const fileInfo = this.excelParser.parseFileName(originalFilename);
    if (!fileInfo.isValid) {
      throw new Error(fileInfo.error);
    }

    // Parse the Excel file
    const parsedData = this.excelParser.parseOperationsFile(filePath);
    
    if (!parsedData.yesterday.length && !parsedData.yearOverYear.length) {
      throw new Error('No operations data found in file');
    }

    // Extract unique markets and stores from operations data
    const allData = [...parsedData.yesterday, ...parsedData.yearOverYear];
    const discoveredMarkets = this.extractUniqueMarketsFromOperations(allData);
    const discoveredStores = this.extractUniqueStoresFromOperations(allData);

    // Create upload session record
    const uploadSession = await this.createUploadSession({
      filename: originalFilename,
      fileType: 'operations',
      reportDate,
      userId,
      marketId: fileInfo.marketId,
      discoveredMarkets,
      discoveredStores,
      discoveredAdvisors: [],
      rawData: parsedData
    });

    return {
      sessionId: uploadSession.id,
      fileInfo,
      discovered: {
        markets: discoveredMarkets,
        stores: discoveredStores,
        advisors: []
      },
      summary: {
        yesterday: parsedData.yesterday.length,
        yearOverYear: parsedData.yearOverYear.length,
        marketsFound: discoveredMarkets.length,
        storesFound: discoveredStores.length
      }
    };
  }

  /**
   * Create upload session with discovered data
   */
  async createUploadSession(data) {
    // Handle Phase 1 users with string IDs - set uploaded_by to null since table expects integer
    const uploadedBy = (typeof data.userId === 'number') ? data.userId : null;
    
    const result = await this.pool.query(`
      INSERT INTO upload_sessions (
        filename, file_type, report_date, uploaded_by, market_id,
        discovered_markets, discovered_stores, discovered_advisors, 
        raw_data, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_review', CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `, [
      data.filename,
      data.fileType,
      data.reportDate,
      uploadedBy,
      data.marketId,
      JSON.stringify(data.discoveredMarkets),
      JSON.stringify(data.discoveredStores),
      JSON.stringify(data.discoveredAdvisors),
      JSON.stringify(data.rawData)
    ]);

    return result.rows[0];
  }

  /**
   * Extract unique markets from services data
   */
  extractUniqueMarkets(parsedData) {
    const marketSet = new Set();
    const markets = [];

    parsedData.employees.forEach(employee => {
      if (employee.market && !marketSet.has(employee.market)) {
        marketSet.add(employee.market);
        markets.push({
          name: employee.market,
          source: 'services_data',
          spreadsheetMarket: employee.market
        });
      }
    });

    return markets;
  }

  /**
   * Extract unique stores from services data
   */
  extractUniqueStores(parsedData) {
    const storeMap = new Map();

    parsedData.employees.forEach(employee => {
      if (employee.storeName && employee.market) {
        const storeKey = `${employee.market}:${employee.storeName}`;
        if (!storeMap.has(storeKey)) {
          storeMap.set(storeKey, {
            name: employee.storeName,
            market: employee.market,
            source: 'services_data',
            spreadsheetStore: employee.storeName
          });
        }
      }
    });

    return Array.from(storeMap.values());
  }

  /**
   * Extract unique advisors from services data
   */
  extractUniqueAdvisors(parsedData) {
    const advisorMap = new Map();

    parsedData.employees.forEach(employee => {
      if (employee.employeeName) {
        const advisorKey = employee.employeeName;
        if (!advisorMap.has(advisorKey)) {
          advisorMap.set(advisorKey, {
            name: employee.employeeName,
            market: employee.market,
            store: employee.storeName,
            source: 'services_data',
            spreadsheetName: employee.employeeName,
            hasData: true
          });
        }
      }
    });

    return Array.from(advisorMap.values());
  }

  /**
   * Extract unique markets from operations data
   */
  extractUniqueMarketsFromOperations(operationsData) {
    const marketSet = new Set();
    const markets = [];

    operationsData.forEach(record => {
      if (record.market && !marketSet.has(record.market)) {
        marketSet.add(record.market);
        markets.push({
          name: record.market,
          source: 'operations_data',
          spreadsheetMarket: record.market
        });
      }
    });

    return markets;
  }

  /**
   * Extract unique stores from operations data
   */
  extractUniqueStoresFromOperations(operationsData) {
    const storeMap = new Map();

    operationsData.forEach(record => {
      if (record.storeName && record.market) {
        const storeKey = `${record.market}:${record.storeName}`;
        if (!storeMap.has(storeKey)) {
          storeMap.set(storeKey, {
            name: record.storeName,
            market: record.market,
            source: 'operations_data',
            spreadsheetStore: record.storeName
          });
        }
      }
    });

    return Array.from(storeMap.values());
  }

  /**
   * Get upload session with discovered data
   */
  async getUploadSession(sessionId) {
    const result = await this.pool.query(`
      SELECT 
        id, filename, file_type, report_date, uploaded_by, market_id,
        discovered_markets, discovered_stores, discovered_advisors,
        raw_data, status, created_at, confirmed_at, processed_at
      FROM upload_sessions 
      WHERE id = $1
    `, [sessionId]);

    if (result.rows.length === 0) {
      throw new Error('Upload session not found');
    }

    const session = result.rows[0];
    return {
      ...session,
      discovered_markets: session.discovered_markets || [],
      discovered_stores: session.discovered_stores || [],
      discovered_advisors: session.discovered_advisors || [],
      raw_data: session.raw_data || {}
    };
  }

  /**
   * Confirm and process upload session
   */
  async confirmUploadSession(sessionId, confirmationData) {
    const session = await this.getUploadSession(sessionId);
    
    if (session.status !== 'pending_review') {
      throw new Error('Upload session is not pending review');
    }

    console.log('🔍 Confirmation data received:', JSON.stringify(confirmationData, null, 2));

    // Convert frontend object format to array format if needed
    const markets = Array.isArray(confirmationData.markets) 
      ? confirmationData.markets 
      : Object.values(confirmationData.markets);
    
    const stores = Array.isArray(confirmationData.stores) 
      ? confirmationData.stores 
      : Object.values(confirmationData.stores);
    
    const advisors = Array.isArray(confirmationData.advisors) 
      ? confirmationData.advisors 
      : Object.values(confirmationData.advisors);

    console.log('🔄 Converted to arrays - Markets:', markets.length, 'Stores:', stores.length, 'Advisors:', advisors.length);

    // Start transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create/update markets
      const marketMappings = await this.processMarkets(client, markets);
      console.log('🗺️ Market mappings created:', marketMappings);
      
      // Create/update stores
      const storeMappings = await this.processStores(client, stores, marketMappings);
      console.log('🏪 Store mappings created:', storeMappings);
      
      // Process advisors if services file
      let advisorMappings = {};
      if (session.file_type === 'services') {
        advisorMappings = await this.processAdvisors(client, advisors, marketMappings, storeMappings);
      }

      // Process the actual data
      let processedCount = 0;
      if (session.file_type === 'services') {
        processedCount = await this.processServicesData(client, session, marketMappings, storeMappings, advisorMappings);
      } else {
        processedCount = await this.processOperationsData(client, session, marketMappings, storeMappings);
      }

      // Update session status
      await client.query(`
        UPDATE upload_sessions 
        SET status = 'processed', confirmed_at = CURRENT_TIMESTAMP, processed_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [sessionId]);

      await client.query('COMMIT');

      return {
        sessionId,
        processedCount,
        marketMappings,
        storeMappings,
        advisorMappings
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process markets from confirmation data
   */
  async processMarkets(client, markets) {
    const mappings = {};

    for (const market of markets) {
      if (market.action === 'create') {
        // Create new market using proposed_id if available
        let insertQuery, insertParams;
        if (market.proposed_id && !isNaN(market.proposed_id)) {
          // Use specific ID from spreadsheet
          insertQuery = `
            INSERT INTO markets (id, name, description)
            VALUES ($1, $2, $3)
            RETURNING id
          `;
          insertParams = [
            parseInt(market.proposed_id),
            market.name,
            `Auto-created from spreadsheet: ${market.source}`
          ];
        } else {
          // Let database auto-generate ID
          insertQuery = `
            INSERT INTO markets (name, description)
            VALUES ($1, $2)
            RETURNING id
          `;
          insertParams = [
            market.name,
            `Auto-created from spreadsheet: ${market.source}`
          ];
        }
        
        const result = await client.query(insertQuery, insertParams);
        mappings[market.name] = result.rows[0].id;
      } else if (market.action === 'map') {
        // Map to existing market
        mappings[market.name] = market.existing_id;
      }
    }

    return mappings;
  }

  /**
   * Process stores from confirmation data
   */
  async processStores(client, stores, marketMappings) {
    const mappings = {};

    for (const store of stores) {
      const storeKey = `${store.market}:${store.name}`;
      
      if (store.action === 'create') {
        // Create new store
        const marketId = marketMappings[store.market];
        if (!marketId) {
          throw new Error(`Market mapping not found for store: ${store.name}`);
        }

        const result = await client.query(`
          INSERT INTO stores (name, market_id)
          VALUES ($1, $2)
          RETURNING id
        `, [
          store.name,
          marketId
        ]);
        mappings[storeKey] = result.rows[0].id;
      } else if (store.action === 'map') {
        // Map to existing store
        mappings[storeKey] = store.existing_id;
      }
    }

    return mappings;
  }

  /**
   * Process advisors from confirmation data
   */
  async processAdvisors(client, advisors, marketMappings, storeMappings) {
    const mappings = {};

    for (const advisor of advisors) {
      if (advisor.action === 'create_user') {
        // Create new phase1 user for advisor
        const result = await client.query(`
          INSERT INTO users (user_id, first_name, last_name, email, role, status, password)
          VALUES ($1, $2, $3, $4, 'advisor', 'active', 'temporary_password')
          RETURNING id
        `, [
          advisor.proposed_user_id || `advisor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          advisor.proposed_first_name || advisor.name.split(' ')[0],
          advisor.proposed_last_name || advisor.name.split(' ').slice(1).join(' '),
          advisor.proposed_email || `${advisor.name.toLowerCase().replace(/\s+/g, '.')}@example.com`
        ]);
        mappings[advisor.name] = result.rows[0].id;
        
        // Create advisor mapping for the new user
        await client.query(`
          INSERT INTO advisor_mappings (advisor_name, user_id, is_active)
          VALUES ($1, $2, true)
          ON CONFLICT (advisor_name) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            updated_at = CURRENT_TIMESTAMP,
            is_active = true
        `, [advisor.name, result.rows[0].id]);
        
        console.log(`📝 Created advisor mapping for new user: ${advisor.name} -> ${result.rows[0].id}`);
      } else if (advisor.action === 'map_user') {
        // Map to existing user
        mappings[advisor.name] = advisor.existing_user_id;
        
        // Create advisor mapping if it doesn't exist (for fuzzy-matched advisors)
        if (advisor.mappingSource === 'fuzzy_matching') {
          await client.query(`
            INSERT INTO advisor_mappings (advisor_name, user_id, is_active)
            VALUES ($1, $2, true)
            ON CONFLICT (advisor_name) DO UPDATE SET
              user_id = EXCLUDED.user_id,
              updated_at = CURRENT_TIMESTAMP,
              is_active = true
          `, [advisor.name, advisor.existing_user_id]);
          
          console.log(`📝 Created advisor mapping: ${advisor.name} -> ${advisor.existing_user_id}`);
        }
      }
    }

    return mappings;
  }

  /**
   * Process services data with mappings
   */
  async processServicesData(client, session, marketMappings, storeMappings, advisorMappings) {
    const rawData = session.raw_data;
    let processedCount = 0;

    console.log('📊 Processing services data with mappings:', {
      marketMappings,
      storeMappings: Object.keys(storeMappings),
      advisorMappings: Object.keys(advisorMappings)
    });

    for (const employee of rawData.employees) {
      if (employee.employeeName) {
        const marketId = marketMappings[employee.market];
        const storeKey = `${employee.market}:${employee.storeName}`;
        const storeId = storeMappings[storeKey];
        const advisorUserId = advisorMappings[employee.employeeName];

        console.log(`👤 Processing employee: ${employee.employeeName}, market: ${employee.market} -> ID: ${marketId} (type: ${typeof marketId})`);
        console.log(`🏪 Store lookup: key="${storeKey}" -> ID: ${storeId} (type: ${typeof storeId})`);

        // Store performance data with proper market_id, store_id, and advisor_user_id
        // Convert advisor_user_id to integer or null
        const advisorId = (typeof advisorUserId === 'number') ? advisorUserId : null;
        
        await client.query(`
          INSERT INTO performance_data 
          (upload_date, data_type, market_id, store_id, advisor_user_id, data)
          VALUES ($1, 'services', $2, $3, $4, $5)
        `, [
          session.report_date,
          marketId,
          storeId, // Now properly storing store_id
          advisorId,
          JSON.stringify(employee)
        ]);

        // Create user-store assignment if both advisor and store exist
        if (advisorId && storeId) {
          await client.query(`
            INSERT INTO user_store_assignments (user_id, store_id, assigned_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, store_id) DO NOTHING
          `, [advisorUserId, storeId]); // Note: using original advisorUserId (string) for user_store_assignments
          
          console.log(`🔗 Assigned user ${employee.employeeName} (ID: ${advisorUserId}) to store ${employee.storeName} (ID: ${storeId})`);
        }

        // Create user-market assignment if both advisor and market exist
        if (advisorId && marketId) {
          await client.query(`
            INSERT INTO user_market_assignments (user_id, market_id, assigned_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, market_id) DO NOTHING
          `, [advisorUserId, marketId]); // Note: using original advisorUserId (string) for user_market_assignments
          
          console.log(`🔗 Assigned user ${employee.employeeName} (ID: ${advisorUserId}) to market ${employee.market} (ID: ${marketId})`);
        }
        
        processedCount++;
      }
    }

    // Auto-generate store-level aggregated data
    console.log('🏪 Auto-generating store-level aggregated data...');
    const storeAggregationCount = await this.generateStoreLevelData(client, session.report_date, marketMappings, storeMappings);
    console.log(`✅ Generated ${storeAggregationCount} store-level records`);

    // Process store-level data if available in the spreadsheet
    if (rawData.stores && rawData.stores.length > 0) {
      console.log(`📊 Processing ${rawData.stores.length} store-level records`);
      
      for (const store of rawData.stores) {
        const marketId = marketMappings[store.market];
        const storeKey = `${store.market}:${store.storeName}`;
        const storeId = storeMappings[storeKey];
        
        if (!marketId || !storeId) {
          console.warn(`⚠️ Skipping store ${store.storeName} - missing market or store mapping`);
          continue;
        }

        // Store performance data with store_id set (advisor_user_id = NULL for store-level data)
        await client.query(`
          INSERT INTO performance_data 
          (upload_date, data_type, market_id, store_id, advisor_user_id, data)
          VALUES ($1, 'services', $2, $3, NULL, $4)
        `, [
          session.report_date,
          marketId,
          storeId,
          JSON.stringify(store)
        ]);

        console.log(`🏪 Processed store-level data for ${store.storeName} in market ${store.market}`);
        processedCount++;
      }
    }

    // Process market-level data if available in the spreadsheet
    if (rawData.markets && rawData.markets.length > 0) {
      console.log(`📊 Processing ${rawData.markets.length} market-level records`);
      
      for (const market of rawData.markets) {
        const marketId = marketMappings[market.market];
        
        if (!marketId) {
          console.warn(`⚠️ Skipping market ${market.market} - missing market mapping`);
          continue;
        }

        // Market performance data with both store_id and advisor_user_id = NULL for market-level data
        await client.query(`
          INSERT INTO performance_data 
          (upload_date, data_type, market_id, store_id, advisor_user_id, data)
          VALUES ($1, 'services', $2, NULL, NULL, $3)
        `, [
          session.report_date,
          marketId,
          JSON.stringify(market)
        ]);

        console.log(`🏬 Processed market-level data for ${market.market}`);
        processedCount++;
      }
    }

    return processedCount;
  }

  /**
   * Generate store-level aggregated data from advisor-level data
   */
  async generateStoreLevelData(client, reportDate, marketMappings, storeMappings) {
    let generatedCount = 0;
    
    // Get unique stores that have advisor data for this date
    const storesWithData = await client.query(`
      SELECT DISTINCT 
        pd.store_id,
        pd.market_id,
        s.name as store_name,
        m.name as market_name
      FROM performance_data pd
      JOIN stores s ON pd.store_id = s.id
      JOIN markets m ON pd.market_id = m.id
      WHERE pd.upload_date = $1
      AND pd.advisor_user_id IS NOT NULL
      AND pd.store_id IS NOT NULL
      ORDER BY s.name
    `, [reportDate]);
    
    for (const store of storesWithData.rows) {
      // Aggregate all advisor data for this store
      const aggregatedData = await client.query(`
        SELECT 
          SUM(CAST(COALESCE(data->>'allTires', '0') AS INTEGER)) as allTires,
          SUM(CAST(COALESCE(data->>'retailTires', '0') AS INTEGER)) as retailTires,
          SUM(CAST(COALESCE(data->>'tireProtection', '0') AS INTEGER)) as tireProtection,
          SUM(CAST(COALESCE(data->>'acService', '0') AS INTEGER)) as acService,
          SUM(CAST(COALESCE(data->>'wiperBlades', '0') AS INTEGER)) as wiperBlades,
          SUM(CAST(COALESCE(data->>'brakeService', '0') AS INTEGER)) as brakeService,
          SUM(CAST(COALESCE(data->>'brakeFlush', '0') AS INTEGER)) as brakeFlush,
          SUM(CAST(COALESCE(data->>'alignmentCheck', '0') AS INTEGER)) as alignmentCheck,
          SUM(CAST(COALESCE(data->>'alignmentService', '0') AS INTEGER)) as alignmentService,
          SUM(CAST(COALESCE(data->>'potentialAlignments', '0') AS INTEGER)) as potentialAlignments,
          SUM(CAST(COALESCE(data->>'potentialAlignmentsSold', '0') AS INTEGER)) as potentialAlignmentsSold,
          SUM(CAST(COALESCE(data->>'shocksStruts', '0') AS INTEGER)) as shocksStruts,
          SUM(CAST(COALESCE(data->>'sales', '0') AS NUMERIC)) as sales,
          SUM(CAST(COALESCE(data->>'gpSales', '0') AS NUMERIC)) as gpSales,
          SUM(CAST(COALESCE(data->>'invoices', '0') AS INTEGER)) as invoices,
          COUNT(*) as advisor_count
        FROM performance_data 
        WHERE upload_date = $1 
        AND store_id = $2 
        AND advisor_user_id IS NOT NULL
      `, [reportDate, store.store_id]);
      
      const aggregated = aggregatedData.rows[0];
      
      // Calculate percentages
      const tireProtectionPercent = aggregated.retailtires > 0 ? 
        Math.ceil((aggregated.tireprotection / aggregated.retailtires) * 100) : 0;
      
      const brakeFlushToServicePercent = aggregated.brakeservice > 0 ? 
        Math.ceil((aggregated.brakeflush / aggregated.brakeservice) * 100) : 0;
      
      const potentialAlignmentsPercent = aggregated.potentialalignments > 0 ? 
        Math.ceil((aggregated.potentialalignmentssold / aggregated.potentialalignments) * 100) : 0;
      
      const gpPercent = aggregated.sales > 0 ? 
        ((aggregated.gpsales / aggregated.sales) * 100).toFixed(2) : 0;
      
      const avgSpend = aggregated.invoices > 0 ? 
        (aggregated.sales / aggregated.invoices).toFixed(2) : 0;
      
      // Create store-level aggregated record
      const storeData = {
        storeName: store.store_name,
        market: store.market_name,
        allTires: aggregated.alltires,
        retailTires: aggregated.retailtires,
        tireProtection: aggregated.tireprotection,
        tireProtectionPercent: tireProtectionPercent,
        acService: aggregated.acservice,
        wiperBlades: aggregated.wiperblades,
        brakeService: aggregated.brakeservice,
        brakeFlush: aggregated.brakeflush,
        brakeFlushToServicePercent: brakeFlushToServicePercent,
        alignmentCheck: aggregated.alignmentcheck,
        alignmentService: aggregated.alignmentservice,
        potentialAlignments: aggregated.potentialalignments,
        potentialAlignmentsSold: aggregated.potentialalignmentssold,
        potentialAlignmentsPercent: potentialAlignmentsPercent,
        shocksStruts: aggregated.shocksstruts,
        sales: parseFloat(aggregated.sales),
        gpSales: parseFloat(aggregated.gpsales),
        gpPercent: parseFloat(gpPercent),
        avgSpend: parseFloat(avgSpend),
        invoices: aggregated.invoices,
        advisorCount: parseInt(aggregated.advisor_count)
      };
      
      // Check if store-level record already exists for this date
      const existingRecord = await client.query(`
        SELECT id FROM performance_data 
        WHERE upload_date = $1 AND store_id = $2 AND advisor_user_id IS NULL
      `, [reportDate, store.store_id]);
      
      if (existingRecord.rows.length === 0) {
        // Insert the store-level record
        await client.query(`
          INSERT INTO performance_data 
          (upload_date, data_type, market_id, store_id, advisor_user_id, data)
          VALUES ($1, 'services', $2, $3, NULL, $4)
        `, [
          reportDate,
          store.market_id,
          store.store_id,
          JSON.stringify(storeData)
        ]);
        
        console.log(`   ✅ Generated store record for ${store.store_name}: ${aggregated.alltires} tires, ${aggregated.advisor_count} advisors`);
        generatedCount++;
      } else {
        console.log(`   ⏭️  Store record already exists for ${store.store_name}`);
      }
    }
    
    return generatedCount;
  }

  /**
   * Process operations data with mappings
   */
  async processOperationsData(client, session, marketMappings, storeMappings) {
    const rawData = session.raw_data;
    const allData = [...rawData.yesterday, ...rawData.yearOverYear];
    let processedCount = 0;

    for (const record of allData) {
      const marketId = marketMappings[record.market];
      const storeKey = `${record.market}:${record.storeName}`;
      const storeId = storeMappings[storeKey];

      // Store performance data - set store_id to NULL since spreadsheet doesn't contain store IDs
      await client.query(`
        INSERT INTO performance_data 
        (upload_date, data_type, market_id, store_id, data)
        VALUES ($1, 'operations', $2, NULL, $3)
      `, [
        session.report_date,
        marketId,
        JSON.stringify(record)
      ]);
      
      processedCount++;
    }

    return processedCount;
  }
}

module.exports = UploadProcessor;