// Tunable NLP constants. Thresholds are separate so they can be tuned
// asymmetrically by the evaluation script (see evaluation/evaluate.js).

module.exports = {
  // VADER compound score bands.
  positiveThreshold: 0.05,
  negativeThreshold: -0.05,

  // Keyword tokenisation: drop tokens shorter than this.
  minTokenLength: 3,

  // Stop words beyond the standard English list. Contraction fragments matter
  // here because the tokeniser strips apostrophes ("didn't" -> "didn" + "t").
  stopWordExtras: [
    'don',
    'didn',
    'isn',
    'wasn',
    'aren',
    'weren',
    'hasn',
    'haven',
    'hadn',
    'doesn',
    'couldn',
    'wouldn',
    'shouldn',
    'mustn',
    'needn',
    'shan',
    'mightn',
    'won',
    'ain',
    've',
    'll',
    're',
    's',
    't',
    'd',
    'm',
    'o',
    'y',
  ],
};
