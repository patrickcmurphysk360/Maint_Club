/**
 * User Identification Utility for AI Agent - Version 2
 * 
 * Improved version with better pattern matching and fewer false positives
 */

/**
 * Extract potential user names from a query using refined patterns
 * @param {string} query - The natural language query
 * @returns {Array} Array of potential name patterns found
 */
function extractPotentialNames(query) {
  const patterns = [];
  
  // Preserve original case for better name detection
  const originalQuery = query;
  const cleanQuery = query.toLowerCase()
    .replace(/[?.,!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Pattern 1: Possessive with apostrophe (highest confidence)
  // e.g., "Cody Lanier's", "Akeen Jackson's"
  const possessiveApostropheMatch = originalQuery.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)'s/g);
  if (possessiveApostropheMatch) {
    possessiveApostropheMatch.forEach(match => {
      patterns.push({
        name: match.replace("'s", '').trim(),
        confidence: 'high',
        pattern: 'possessive_apostrophe'
      });
    });
  }
  
  // Pattern 2: Possessive without apostrophe but followed by a noun
  // e.g., "akeen jacksons scorecard", "cody laniers sales"
  const possessiveNoApostropheMatch = cleanQuery.match(/(\w+\s+\w+)s\s+(scorecard|sales|performance|tire|alignment|metric)/g);
  if (possessiveNoApostropheMatch) {
    possessiveNoApostropheMatch.forEach(match => {
      const name = match.replace(/s\s+\w+$/, '').trim();
      patterns.push({
        name: name,
        confidence: 'high',
        pattern: 'possessive_no_apostrophe'
      });
    });
  }
  
  // Pattern 3: "has [Name] sold" pattern (high confidence)
  const hasSoldMatch = originalQuery.match(/has\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+sold/);
  if (hasSoldMatch && hasSoldMatch[1]) {
    patterns.push({
      name: hasSoldMatch[1].trim(),
      confidence: 'high',
      pattern: 'has_name_sold'
    });
  }
  
  // Pattern 4: "for [Name]" when followed by date/month (medium confidence)
  const forNameDateMatch = cleanQuery.match(/for\s+(\w+\s+\w+)\s+(?:in\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{4})/);
  if (forNameDateMatch && forNameDateMatch[1]) {
    patterns.push({
      name: forNameDateMatch[1],
      confidence: 'medium',
      pattern: 'for_name_date'
    });
  }
  
  // Pattern 4b: "for [Name] for [date]" - extract the name before the second "for"
  const forNameForDateMatch = cleanQuery.match(/for\s+(\w+\s+\w+)\s+for\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{4})/);
  if (forNameForDateMatch && forNameForDateMatch[1]) {
    patterns.push({
      name: forNameForDateMatch[1],
      confidence: 'high',
      pattern: 'for_name_for_date'
    });
  }
  
  // Pattern 4c: "for [Name]" at end of query (medium confidence)
  const forNameEndMatch = cleanQuery.match(/for\s+(\w+\s+\w+)$/);
  if (forNameEndMatch && forNameEndMatch[1]) {
    // Skip if it looks like a date
    const isDate = /(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{4})/.test(forNameEndMatch[1]);
    if (!isDate) {
      patterns.push({
        name: forNameEndMatch[1],
        confidence: 'medium',
        pattern: 'for_name_end'
      });
    }
  }
  
  // Pattern 4c: "with [Name] scorecard" pattern (high confidence)
  const withNameScorecardMatch = cleanQuery.match(/with\s+(\w+\s+\w+)\s+scorecard/);
  if (withNameScorecardMatch && withNameScorecardMatch[1]) {
    patterns.push({
      name: withNameScorecardMatch[1],
      confidence: 'high',
      pattern: 'with_name_scorecard'
    });
  }
  
  // Pattern 4d: "with [Name]'s scorecard" pattern (high confidence)  
  const withNamePossessiveMatch = cleanQuery.match(/with\s+(\w+\s+\w+)'?s?\s+scorecard/);
  if (withNamePossessiveMatch && withNamePossessiveMatch[1]) {
    patterns.push({
      name: withNamePossessiveMatch[1],
      confidence: 'high',
      pattern: 'with_name_possessive_scorecard'
    });
  }
  
  // Pattern 5: Capitalized names at the beginning of query
  const startNameMatch = originalQuery.match(/^(?:show\s+me\s+|get\s+|what\s+(?:is|are)\s+)?([A-Z][a-z]+\s+[A-Z][a-z]+)/);
  if (startNameMatch && startNameMatch[1]) {
    // Skip if it's a common phrase
    const skipPhrases = ['How Many', 'Show Me', 'Get Me', 'What Are'];
    if (!skipPhrases.includes(startNameMatch[1])) {
      patterns.push({
        name: startNameMatch[1].trim(),
        confidence: 'medium',
        pattern: 'start_capitalized'
      });
    }
  }
  
  // Pattern 6: "did [Name] sell" pattern
  const didSellMatch = originalQuery.match(/did\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+sell/);
  if (didSellMatch && didSellMatch[1]) {
    patterns.push({
      name: didSellMatch[1].trim(),
      confidence: 'high',
      pattern: 'did_name_sell'
    });
  }
  
  // Remove duplicates and return only unique names with highest confidence
  const uniqueNames = {};
  patterns.forEach(pattern => {
    const nameLower = pattern.name.toLowerCase();
    if (!uniqueNames[nameLower] || pattern.confidence === 'high') {
      uniqueNames[nameLower] = pattern;
    }
  });
  
  return Object.values(uniqueNames);
}

/**
 * Look up a user by name patterns
 * @param {Object} poolConnection - Database connection pool
 * @param {Array} namePatterns - Array of name pattern objects
 * @returns {Object|null} User object if found, null otherwise
 */
async function lookupUserByName(poolConnection, namePatterns) {
  if (!namePatterns || namePatterns.length === 0) {
    return null;
  }
  
  try {
    // Sort by confidence - try high confidence patterns first
    const sortedPatterns = namePatterns.sort((a, b) => {
      return a.confidence === 'high' ? -1 : 1;
    });
    
    // Try each pattern individually, starting with highest confidence
    for (const pattern of sortedPatterns) {
      const parts = pattern.name.toLowerCase().split(' ');
      if (parts.length >= 2) {
        // First try exact match
        let query = `
          SELECT 
            u.id, 
            u.first_name, 
            u.last_name, 
            u.email, 
            u.role,
            am.spreadsheet_name
          FROM users u
          LEFT JOIN advisor_mappings am ON u.id = am.user_id
          WHERE (
            (LOWER(u.first_name) = $1 AND LOWER(u.last_name) = $2) OR
            (LOWER(u.first_name) = $2 AND LOWER(u.last_name) = $1)
          )
          AND u.status = 'active'
          ORDER BY CASE WHEN u.role = 'advisor' THEN 0 ELSE 1 END, u.id
          LIMIT 1
        `;
        
        console.log(`🔍 Looking up user: "${pattern.name}" (${pattern.confidence} confidence, ${pattern.pattern})`);
        let result = await poolConnection.query(query, [parts[0], parts[1]]);
        
        // If no exact match, try fuzzy matching for common misspellings
        if (result.rows.length === 0) {
          console.log(`🔍 Trying fuzzy match for: "${pattern.name}"`);
          
          // Simple LIKE matching for common misspellings
          query = `
            SELECT 
              u.id, 
              u.first_name, 
              u.last_name, 
              u.email, 
              u.role,
              am.spreadsheet_name
            FROM users u
            LEFT JOIN advisor_mappings am ON u.id = am.user_id
            WHERE (
              (LOWER(u.first_name) LIKE $1 AND LOWER(u.last_name) = $2) OR
              (LOWER(u.first_name) LIKE $3 AND LOWER(u.last_name) = $2)
            )
            AND u.status = 'active'
            ORDER BY CASE WHEN u.role = 'advisor' THEN 0 ELSE 1 END, u.id
            LIMIT 1
          `;
          
          // Create fuzzy patterns for common misspellings
          // Handle common patterns: akeem -> akeen, etc.
          const fuzzyFirst = parts[0].substring(0, 3) + '%'; // First 3 chars + wildcard (ake%)
          result = await poolConnection.query(query, [parts[0] + '%', parts[1], fuzzyFirst]);
        }
        
        if (result.rows.length > 0) {
          const user = result.rows[0];
          console.log(`✅ Found user: ${user.first_name} ${user.last_name} (ID: ${user.id})`);
          return user;
        }
      }
    }
    
    console.log('❌ No user found for patterns:', namePatterns.map(p => p.name));
    return null;
  } catch (error) {
    console.error('Error looking up user by name:', error);
    return null;
  }
}

/**
 * Main function to identify a user from a natural language query
 * @param {Object} poolConnection - Database connection pool
 * @param {string} query - The natural language query
 * @param {Object} currentUser - The current authenticated user (fallback)
 * @returns {Object} The identified user or current user as fallback
 */
async function identifyUserFromQuery(poolConnection, query, currentUser) {
  console.log('🤖 AI User Identification V2:', { query });
  
  // Check for "my" or "me" keywords first - use current user
  // But be careful not to match "provide me with [name]" patterns
  const queryLower = query.toLowerCase();
  const hasMyKeywords = queryLower.includes(' my ') || queryLower.startsWith('my ') || 
                       queryLower === 'my scorecard' || queryLower === 'show my scorecard';
  const hasMeKeywords = queryLower.includes(' me ') && !queryLower.includes('provide me with') && 
                       !queryLower.includes('show me') && !queryLower.includes('get me');
  
  if (hasMyKeywords || hasMeKeywords) {
    console.log('🎯 Query contains "my/me" - using current user');
    return currentUser;
  }
  
  // Extract potential names from the query
  const namePatterns = extractPotentialNames(query);
  console.log('📝 Extracted name patterns:', namePatterns);
  
  // If we found potential names, try to look them up
  if (namePatterns.length > 0) {
    const identifiedUser = await lookupUserByName(poolConnection, namePatterns);
    if (identifiedUser) {
      console.log(`🎯 Identified user from query: ${identifiedUser.first_name} ${identifiedUser.last_name} (ID: ${identifiedUser.id})`);
      return identifiedUser;
    }
  }
  
  // No specific user identified - return current user as fallback
  console.log('⚠️ No specific user identified - using current user as fallback');
  return currentUser;
}

module.exports = {
  extractPotentialNames,
  lookupUserByName,
  identifyUserFromQuery
};