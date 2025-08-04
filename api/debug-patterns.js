const query = 'what are the top five advisors for alignment sales';
const lowerQuery = query.toLowerCase();

console.log('Testing query:', query);
console.log('Lower query:', lowerQuery);

// Test top performer patterns
const topPattern1 = lowerQuery.match(/top\s+(\w+\s+)?(advisor|employee|performer|people)/i);
const topPattern2 = lowerQuery.match(/(best|highest|leading)\s+(advisor|employee|performer)/i);
const topPattern3 = lowerQuery.match(/who\s+(are\s+the\s+)?(top|best|highest)/i);

console.log('Top pattern 1 (top X advisor):', topPattern1);
console.log('Top pattern 2 (best advisor):', topPattern2);
console.log('Top pattern 3 (who are top):', topPattern3);

// Test role-based pattern
const rolePattern = lowerQuery.match(/(managers?|advisors?|admins?|administrators?)/);
console.log('Role pattern (advisors):', rolePattern);

console.log('Should be top performer query:', !!(topPattern1 || topPattern2 || topPattern3));