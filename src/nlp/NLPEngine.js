const { preprocess } = require('./preprocess');
const { classify, score } = require('./classify');

// Pure and synchronous. Must not import Express or the DB so the evaluation
// script can reuse it unchanged.
class NLPEngine {
  preprocess(text) {
    return preprocess(text);
  }

  classify(text) {
    return classify(text);
  }

  analyse(text) {
    const { cleaned, tokens } = preprocess(text);
    const result = score(cleaned);
    return {
      cleaned,
      tokens,
      label: result.label,
      confidence: result.confidence,
      compound: result.compound,
    };
  }
}

module.exports = NLPEngine;
