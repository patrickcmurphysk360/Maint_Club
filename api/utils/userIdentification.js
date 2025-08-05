/**
 * User Identification Utility for AI Agent
 * 
 * This utility helps the AI agent identify which user is being asked about
 * in natural language queries, rather than defaulting to the current user.
 */

/**
 * Extract potential user names from a query
 * @param {string} query - The natural language query
 * @returns {Array} Array of potential name patterns found
 */
function extractPotentialNames(query) {
  const patterns = [];
  
  // Remove common words and punctuation
  const cleanQuery = query.toLowerCase()
    .replace(/[?.,!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Pattern 1: Look for possessive patterns (e.g., "akeen jackson's", "cody lanier's")
  // Also handle cases without apostrophe (e.g., "akeen jacksons")
  const possessiveMatch = cleanQuery.match(/(\w+\s+\w+)(?:'s|s\s)/g);
  if (possessiveMatch) {
    possessiveMatch.forEach(match => {
      patterns.push(match.replace(/['s\s]+$/, '').trim());
    });
  }
  
  // Pattern 2: Look for "for [name]" patterns
  const forMatch = cleanQuery.match(/for\s+(\w+\s+\w+)/g);
  if (forMatch) {
    forMatch.forEach(match => {
      patterns.push(match.replace('for ', '').trim());
    });
  }
  
  // Pattern 3: Look for "show me [name]" patterns
  const showMeMatch = cleanQuery.match(/show\s+me\s+(\w+\s+\w+)/);
  if (showMeMatch && showMeMatch[1]) {
    patterns.push(showMeMatch[1].trim());
  }
  
  // Pattern 4: Look for capitalized names (original case)
  const capitalizedMatch = query.match(/[A-Z][a-z]+\s+[A-Z][a-z]+/g);
  if (capitalizedMatch) {
    capitalizedMatch.forEach(match => {
      patterns.push(match.toLowerCase());
    });
  }
  
  // Pattern 5: Look for "of [name]" patterns
  const ofMatch = cleanQuery.match(/of\s+(\w+\s+\w+)/g);
  if (ofMatch) {
    ofMatch.forEach(match => {
      patterns.push(match.replace('of ', '').trim());
    });
  }
  
  // Pattern 6: Look for "has [name] sold" patterns
  const hasSoldMatch = cleanQuery.match(/has\s+(\w+\s+\w+)\s+sold/);
  if (hasSoldMatch && hasSoldMatch[1]) {
    patterns.push(hasSoldMatch[1].trim());
  }
  
  // Pattern 6b: Look for "the scorecard for [name]" patterns
  const scoreCardForMatch = cleanQuery.match(/(?:the\s+)?scorecard\s+for\s+(\w+\s+\w+)/);
  if (scoreCardForMatch && scoreCardForMatch[1]) {
    patterns.push(scoreCardForMatch[1].trim());
  }
  
  // Pattern 7: Look for standalone two-word patterns that could be names
  // This helps with queries like "cody lanier retail tire count"
  const words = cleanQuery.split(' ');
  for (let i = 0; i < words.length - 1; i++) {
    // Check if two consecutive words look like a name (both start with letters)
    if (/^[a-z]+$/.test(words[i]) && /^[a-z]+$/.test(words[i + 1])) {
      const potentialName = `${words[i]} ${words[i + 1]}`;
      // Skip common word pairs
      const commonPairs = ['how many', 'has sold', 'in august', 'for august', 'tire sales', 'alignment sales', 
                           'score card', 'retail tire', 'tire count', 'august 2025', 'show me', 'provide me',
                           'with akeen'];
      if (!commonPairs.includes(potentialName)) {
        patterns.push(potentialName);
      }
    }
  }
  
  // Remove duplicates
  return [...new Set(patterns)];
}

/**
 * Look up a user by name patterns
 * @param {Object} poolConnection - Database connection pool
 * @param {Array} namePatterns - Array of potential name patterns
 * @returns {Object|null} User object if found, null otherwise
 */
async function lookupUserByName(poolConnection, namePatterns) {
  if (!namePatterns || namePatterns.length === 0) {
    return null;
  }
  
  try {
    // Build query conditions for each pattern
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    for (const pattern of namePatterns) {
      const parts = pattern.split(' ');
      if (parts.length >= 2) {
        // Try first + last name
        conditions.push(`(LOWER(u.first_name) = $${paramIndex} AND LOWER(u.last_name) = $${paramIndex + 1})`);
        params.push(parts[0], parts[1]);
        paramIndex += 2;
        
        // Also try last + first (in case order is reversed)
        conditions.push(`(LOWER(u.first_name) = $${paramIndex} AND LOWER(u.last_name) = $${paramIndex + 1})`);
        params.push(parts[1], parts[0]);
        paramIndex += 2;
      }
    }
    
    if (conditions.length === 0) {
      return null;
    }
    
    const query = `
      SELECT DISTINCT
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.role,
        am.spreadsheet_name,
        (CASE WHEN u.role = 'advisor' THEN 1 ELSE 0 END) as is_advisor
      FROM users u
      LEFT JOIN advisor_mappings am ON u.id = am.user_id
      WHERE (${conditions.join(' OR ')})
        AND u.status = 'active'
      ORDER BY is_advisor DESC, u.id
      LIMIT 1
    `;
    
    console.log('🔍 User lookup query:', { patterns: namePatterns, paramCount: params.length });
    const result = await poolConnection.query(query, params);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log(`✅ Found user: ${user.first_name} ${user.last_name} (ID: ${user.id})`);
      return user;
    }
    
    console.log('❌ No user found for patterns:', namePatterns);
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
  console.log('🤖 AI User Identification:', { query });
  
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
  
  // Check for "my" or "me" keywords - use current user
  const queryLower = query.toLowerCase();
  if (queryLower.includes(' my ') || queryLower.includes(' me ') || queryLower.startsWith('my ')) {
    console.log('🎯 Query contains "my/me" - using current user');
    return currentUser;
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