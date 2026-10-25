const { removeStopwords, eng } = require('stopword');
const { stopWordExtras, minTokenLength } = require('./nlpConfig');

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

const extraStopWords = new Set(stopWordExtras);

function decodeEntities(text) {
  return text.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => ENTITIES[match]);
}

function normaliseQuotes(text) {
  return text
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/\u2026/g, '...');
}

// `cleaned` keeps punctuation, capitalisation, emoticons and emoji on purpose:
// VADER uses ALL-CAPS, "!" and emoticons as sentiment signal.
function clean(text) {
  return decodeEntities(normaliseQuotes(String(text ?? '')))
    .replace(/\s+/g, ' ')
    .trim();
}

// `tokens` is the aggressive form used only for keyword extraction.
function tokenise(text) {
  const lowered = String(text ?? '').toLowerCase();
  const withoutUrls = lowered.replace(/https?:\/\/\S+|www\.\S+/g, ' ');
  const wordsOnly = withoutUrls.replace(/[^a-z\s]/g, ' ');

  const candidates = wordsOnly.split(/\s+/).filter((word) => word.length >= minTokenLength);
  const withoutStopWords = removeStopwords(candidates, eng);
  return withoutStopWords.filter((word) => !extraStopWords.has(word));
}

function preprocess(text) {
  return { cleaned: clean(text), tokens: tokenise(text) };
}

module.exports = { preprocess, clean, tokenise };
