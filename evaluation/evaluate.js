// Standalone evaluation for the sentiment module.
//
// Reads the CSV directly (no database), uses the same NLPEngine as the app, and
// treats the star rating as proxy ground truth:
//   4–5 stars -> Happy, 3 stars -> Neutral, 1–2 stars -> Angry
//
// Run with: npm run evaluate

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const config = require('../src/config');
const NLPEngine = require('../src/nlp/NLPEngine');
const nlpConfig = require('../src/nlp/nlpConfig');
const { labelForCompound } = require('../src/nlp/classify');

const engine = new NLPEngine();
const CLASSES = ['Happy', 'Angry', 'Neutral'];
const SPLIT_SEED = 42;
const DEV_FRACTION = 0.2;
const RESULTS_DIR = path.join(__dirname, 'results');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(items, rng) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ratingToLabel(rating) {
  if (rating >= 4) return 'Happy';
  if (rating === 3) return 'Neutral';
  if (rating >= 1) return 'Angry';
  return null;
}

function buildText(record) {
  const title = String(record['Title'] || '').trim();
  const body = String(record['Review Text'] || '').trim();
  return title ? `${title}. ${body}` : body;
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function computeMetrics(pairs) {
  const matrix = {};
  for (const actual of CLASSES) {
    matrix[actual] = {};
    for (const predicted of CLASSES) matrix[actual][predicted] = 0;
  }

  let correct = 0;
  for (const pair of pairs) {
    matrix[pair.actual][pair.predicted] += 1;
    if (pair.actual === pair.predicted) correct += 1;
  }

  const total = pairs.length;
  const perClass = {};

  for (const label of CLASSES) {
    const tp = matrix[label][label];
    const fp = CLASSES.filter((other) => other !== label).reduce(
      (sum, other) => sum + matrix[other][label],
      0
    );
    const fn = CLASSES.filter((other) => other !== label).reduce(
      (sum, other) => sum + matrix[label][other],
      0
    );
    const support = CLASSES.reduce((sum, other) => sum + matrix[label][other], 0);

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    perClass[label] = {
      precision: round4(precision),
      recall: round4(recall),
      f1: round4(f1),
      support,
    };
  }

  const macroF1 = CLASSES.reduce((sum, label) => sum + perClass[label].f1, 0) / CLASSES.length;
  const weightedF1 =
    CLASSES.reduce((sum, label) => sum + perClass[label].f1 * perClass[label].support, 0) / total;

  return {
    accuracy: round4(correct / total),
    perClass,
    macroF1: round4(macroF1),
    weightedF1: round4(weightedF1),
    majorityBaseline: round4(perClass.Happy.support / total),
    confusion: CLASSES.map((actual) => ({ actual, ...matrix[actual] })),
  };
}

function predictionsFor(scored, positive, negative) {
  return scored.map((row) => ({
    actual: row.actual,
    predicted: labelForCompound(row.compound, positive, negative),
  }));
}

function scoreRows(rows) {
  return rows.map((row) => ({ ...row, compound: engine.classify(row.text).compound }));
}

function loadDataset() {
  const csvPath = path.resolve(process.cwd(), config.import.csvPath);
  const records = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  let droppedEmptyText = 0;
  let droppedBadRating = 0;
  const rows = [];

  for (const record of records) {
    const body = String(record['Review Text'] || '').trim();
    if (!body) {
      droppedEmptyText += 1;
      continue;
    }

    const rating = Number.parseInt(record['Rating'], 10);
    const actual = ratingToLabel(rating);
    if (!actual) {
      droppedBadRating += 1;
      continue;
    }

    rows.push({ text: buildText(record), actual });
  }

  return { csvPath, rowsRead: records.length, droppedEmptyText, droppedBadRating, rows };
}

function classDistribution(rows) {
  const counts = { Happy: 0, Angry: 0, Neutral: 0 };
  for (const row of rows) counts[row.actual] += 1;
  return counts;
}

function gridSearch(devScored) {
  let best = {
    positive: nlpConfig.positiveThreshold,
    negative: nlpConfig.negativeThreshold,
    macroF1: -1,
  };

  for (let p = 0.05; p <= 0.5 + 1e-9; p += 0.05) {
    for (let n = -0.05; n >= -0.5 - 1e-9; n -= 0.05) {
      const positive = Number(p.toFixed(2));
      const negative = Number(n.toFixed(2));
      const macroF1 = computeMetrics(predictionsFor(devScored, positive, negative)).macroF1;
      if (macroF1 > best.macroF1) best = { positive, negative, macroF1 };
    }
  }

  return best;
}

function timeAnalysis(rows) {
  const durations = [];
  const start = process.hrtime.bigint();

  for (const row of rows) {
    const before = process.hrtime.bigint();
    engine.analyse(row.text);
    const after = process.hrtime.bigint();
    durations.push(Number(after - before) / 1e6);
  }

  const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
  durations.sort((a, b) => a - b);

  const p95Index = Math.min(durations.length - 1, Math.floor(0.95 * durations.length));

  return {
    reviews: rows.length,
    totalMs: round4(totalMs),
    avgMs: round4(totalMs / rows.length),
    p95Ms: round4(durations[p95Index]),
    reviewsPerSecond: round4(rows.length / (totalMs / 1000)),
  };
}

function metricsTableMarkdown(title, metrics) {
  const lines = [];
  lines.push(`### ${title}`);
  lines.push('');
  lines.push('| Class | Precision | Recall | F1 | Support |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const label of CLASSES) {
    const row = metrics.perClass[label];
    lines.push(
      `| ${label} | ${row.precision.toFixed(4)} | ${row.recall.toFixed(4)} | ${row.f1.toFixed(4)} | ${row.support} |`
    );
  }
  lines.push('');
  lines.push(`- Accuracy: **${metrics.accuracy.toFixed(4)}**`);
  lines.push(`- Macro-F1: **${metrics.macroF1.toFixed(4)}**`);
  lines.push(`- Weighted-F1: **${metrics.weightedF1.toFixed(4)}**`);
  lines.push(
    `- Majority-class baseline (always Happy): **${metrics.majorityBaseline.toFixed(4)}**`
  );
  lines.push('');
  lines.push('Confusion matrix (rows = actual, columns = predicted):');
  lines.push('');
  lines.push('| Actual \\ Predicted | Happy | Angry | Neutral |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const row of metrics.confusion) {
    lines.push(`| ${row.actual} | ${row.Happy} | ${row.Angry} | ${row.Neutral} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function buildReportMarkdown(report) {
  const lines = [];
  lines.push('# Sentiment Evaluation Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Dataset');
  lines.push('');
  lines.push(`Source: \`${report.dataset.csvPath}\``);
  lines.push('');
  lines.push('| Measure | Value |');
  lines.push('| --- | ---: |');
  lines.push(`| Rows read | ${report.dataset.rowsRead} |`);
  lines.push(`| Dropped (empty review text) | ${report.dataset.droppedEmptyText} |`);
  lines.push(`| Dropped (missing/invalid rating) | ${report.dataset.droppedBadRating} |`);
  lines.push(`| Rows used | ${report.dataset.rowsUsed} |`);
  lines.push(`| Dev set (20%) | ${report.dataset.devSize} |`);
  lines.push(`| Test set (80%) | ${report.dataset.testSize} |`);
  lines.push('');
  lines.push('Class distribution (ground truth from star ratings):');
  lines.push('');
  lines.push('| Class | Count | Share |');
  lines.push('| --- | ---: | ---: |');
  for (const label of CLASSES) {
    const count = report.dataset.classDistribution[label];
    const share = ((count / report.dataset.rowsUsed) * 100).toFixed(2);
    lines.push(`| ${label} | ${count} | ${share}% |`);
  }
  lines.push('');
  lines.push('## Thresholds');
  lines.push('');
  lines.push('| | Positive | Negative |');
  lines.push('| --- | ---: | ---: |');
  lines.push(
    `| Default | ${report.thresholds.default.positive} | ${report.thresholds.default.negative} |`
  );
  lines.push(
    `| Tuned (dev-set grid search) | ${report.thresholds.tuned.positive} | ${report.thresholds.tuned.negative} |`
  );
  lines.push('');
  lines.push(
    `Best dev-set macro-F1 during the grid search: **${report.thresholds.tunedDevMacroF1.toFixed(4)}**.`
  );
  lines.push(
    'These tuned values are a recommendation only; `src/nlp/nlpConfig.js` is not modified automatically.'
  );
  lines.push('');
  lines.push(`## Results on the test set (n = ${report.dataset.testSize})`);
  lines.push('');
  lines.push(metricsTableMarkdown('Default thresholds', report.default));
  lines.push(metricsTableMarkdown('Tuned thresholds', report.tuned));
  lines.push('## Responsiveness');
  lines.push('');
  lines.push('| Measure | Value |');
  lines.push('| --- | ---: |');
  lines.push(`| Reviews timed (\`analyse()\`) | ${report.timing.reviews} |`);
  lines.push(`| Average per review | ${report.timing.avgMs.toFixed(3)} ms |`);
  lines.push(`| p95 per review | ${report.timing.p95Ms.toFixed(3)} ms |`);
  lines.push(`| Throughput | ${report.timing.reviewsPerSecond.toFixed(1)} reviews/sec |`);
  lines.push('');
  return lines.join('\n');
}

function printSummary(report) {
  console.log('');
  console.log('Sentiment evaluation summary');
  console.log('----------------------------');
  console.log(
    `Rows used:        ${report.dataset.rowsUsed} (dev ${report.dataset.devSize} / test ${report.dataset.testSize})`
  );
  console.log(
    `Class counts:     Happy ${report.dataset.classDistribution.Happy}, Angry ${report.dataset.classDistribution.Angry}, Neutral ${report.dataset.classDistribution.Neutral}`
  );
  console.log(
    `Default:          accuracy ${report.default.accuracy.toFixed(4)}, macro-F1 ${report.default.macroF1.toFixed(4)}`
  );
  console.log(
    `Tuned:            accuracy ${report.tuned.accuracy.toFixed(4)}, macro-F1 ${report.tuned.macroF1.toFixed(4)}`
  );
  console.log(
    `Recommended:      positiveThreshold=${report.thresholds.tuned.positive}, negativeThreshold=${report.thresholds.tuned.negative}`
  );
  console.log(`Majority baseline: ${report.default.majorityBaseline.toFixed(4)}`);
  console.log(
    `Timing:           ${report.timing.avgMs.toFixed(3)} ms avg, ${report.timing.p95Ms.toFixed(3)} ms p95, ${report.timing.reviewsPerSecond.toFixed(1)} reviews/sec`
  );
  console.log(`Reports:          ${path.join(RESULTS_DIR, 'report.md')}, report.json`);
  console.log('');
}

function main() {
  const dataset = loadDataset();
  if (dataset.rows.length === 0) {
    throw new Error('No usable rows found in the dataset.');
  }

  const rng = mulberry32(SPLIT_SEED);
  const shuffled = seededShuffle(dataset.rows, rng);

  const devSize = Math.floor(shuffled.length * DEV_FRACTION);
  const dev = shuffled.slice(0, devSize);
  const test = shuffled.slice(devSize);

  const devScored = scoreRows(dev);
  const testScored = scoreRows(test);

  const best = gridSearch(devScored);

  const defaultMetrics = computeMetrics(
    predictionsFor(testScored, nlpConfig.positiveThreshold, nlpConfig.negativeThreshold)
  );
  const tunedMetrics = computeMetrics(predictionsFor(testScored, best.positive, best.negative));

  const timing = timeAnalysis(test);

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: {
      csvPath: dataset.csvPath,
      rowsRead: dataset.rowsRead,
      droppedEmptyText: dataset.droppedEmptyText,
      droppedBadRating: dataset.droppedBadRating,
      rowsUsed: dataset.rows.length,
      devSize: dev.length,
      testSize: test.length,
      classDistribution: classDistribution(dataset.rows),
    },
    thresholds: {
      default: {
        positive: nlpConfig.positiveThreshold,
        negative: nlpConfig.negativeThreshold,
      },
      tuned: { positive: best.positive, negative: best.negative },
      tunedDevMacroF1: best.macroF1,
    },
    default: defaultMetrics,
    tuned: tunedMetrics,
    timing,
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(path.join(RESULTS_DIR, 'report.md'), buildReportMarkdown(report), 'utf8');

  printSummary(report);
}

try {
  main();
} catch (error) {
  console.error(`evaluation failed: ${error.message}`);
  process.exit(1);
}
