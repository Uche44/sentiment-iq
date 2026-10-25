const { SentimentIntensityAnalyzer } = require('vader-sentiment');
const { positiveThreshold, negativeThreshold } = require('./nlpConfig');
const { clean } = require('./preprocess');

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

// Single source of truth for the compound → label mapping. The evaluation
// script reuses this with candidate thresholds during its grid search.
function labelForCompound(compound, positive, negative) {
  const positiveBoundary = typeof positive === 'number' ? positive : positiveThreshold;
  const negativeBoundary = typeof negative === 'number' ? negative : negativeThreshold;

  if (compound >= positiveBoundary) return 'Happy';
  if (compound <= negativeBoundary) return 'Angry';
  return 'Neutral';
}

// Pure and synchronous: scores an already-cleaned string, no DB or Express.
function score(cleaned) {
  const text = String(cleaned ?? '').trim();
  if (!text) return { label: 'Neutral', confidence: 0, compound: 0 };

  const { compound } = SentimentIntensityAnalyzer.polarity_scores(text);
  const label = labelForCompound(compound);

  let confidence;
  if (label === 'Neutral') {
    const bandWidth = Math.max(positiveThreshold, Math.abs(negativeThreshold));
    confidence = bandWidth > 0 ? 1 - Math.abs(compound) / bandWidth : 1;
    confidence = Math.min(1, Math.max(0, confidence));
  } else {
    confidence = Math.min(1, Math.abs(compound));
  }

  return { label, confidence: round4(confidence), compound };
}

function classify(text) {
  return score(clean(text));
}

module.exports = { classify, score, labelForCompound };
