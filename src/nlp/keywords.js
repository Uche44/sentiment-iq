const { tokenise } = require('./preprocess');

// Document frequency: each word counts at most once per review, so a single
// repetitive review cannot dominate the ranking.
function topKeywords(texts, n) {
  const counts = new Map();

  for (const text of texts) {
    const seen = new Set(tokenise(text));
    for (const word of seen) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, n || 0))
    .map(([word, count]) => ({ word, count }));
}

module.exports = { topKeywords };
