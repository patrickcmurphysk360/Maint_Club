// Builds a JSON-only prompt for the AI
module.exports.build = ({ advisor, period, metrics }) => `
Output only the JSON below. No code, no markdown, no explanations:

{
  "advisor": "${advisor}",
  "period": "${period}",
  "invoices": ${parseInt(metrics.invoices) || 0},
  "sales": ${parseInt(metrics.sales) || 0},
  "gpSales": ${parseInt(metrics.gpSales) || 0},
  "gpPercent": ${parseInt(metrics.gpPercent) || 0},
  "retailTires": ${parseInt(metrics.retailTires) || 0},
  "allTires": ${parseInt(metrics.allTires) || 0}
}
`;