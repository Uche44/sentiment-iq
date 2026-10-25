# SentimentIQ — Web-Based Sentiment Analysis System

A web application for a fictional women's fashion retailer. A Business Manager logs
in to a dashboard showing what customers feel about the company's products. Customer
reviews live in MySQL; an NLP engine classifies every review as **Happy**, **Angry**
or **Neutral** and the dashboard visualises the results.

Built to `agents.md` (BUILD_SPEC). See `MILESTONES.md` for the five-milestone plan.

## Prerequisites

- Node.js 20+ and npm
- MySQL 8 (this repo is developed against MySQL 8.4 in Docker — see below)
- The review dataset at `data/Womens_Clothing_E-Commerce_Reviews.csv` (supplied by
  the user; never committed)

## Development database (Docker)

MySQL is not installed on the host, so the project uses a local container:

```bash
docker run -d --name sentiment-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=sentiment_db \
  -p 3306:3306 \
  -v sentiment-mysql-data:/var/lib/mysql \
  mysql:8
```

Set `DB_HOST=127.0.0.1` in `.env` to connect over TCP.

## Setup and command sequence

```bash
npm install
cp .env.example .env            # then edit DB credentials, JWT_SECRET, COMPANY_NAME
npm run db:init                 # runs db/schema.sql
npm run seed                    # creates the manager account
npm run import                  # imports the CSV sample (use -- --reset to redo)
npm run engine:once             # (optional) classify the backlog now
npm start                       # server + background engine on http://localhost:3000
npm run dev                     # nodemon
npm test
npm run evaluate
```

Open http://localhost:3000 and sign in with `MANAGER_USERNAME` / `MANAGER_PASSWORD`
(defaults: `manager` / `ChangeMe123!`).

`npm run import -- --reset` truncates `SentimentResults`, `Reviews` and `Products`
before re-importing. Without `--reset`, the importer aborts if `Reviews` is not empty.

## Folder structure

```
db/            schema.sql, seed.js
scripts/       db-init.js, import-reviews.js, run-engine-once.js
src/           server.js, config.js, db.js
  middleware/  requireAuth.js, errorHandler.js
  routes/      auth.js, reviews.js, stats.js, products.js
  services/    reviewService.js, statsService.js
  nlp/         NLPEngine.js, preprocess.js, classify.js, keywords.js, nlpConfig.js
  engine/      processor.js
frontend/      login.html, dashboard.html, css/, js/, vendor/
evaluation/    evaluate.js, results/ (generated, gitignored)
docs/          uml/*.puml, TESTING.md
tests/         jest + supertest suites and helpers
data/          Womens_Clothing_E-Commerce_Reviews.csv (gitignored)
```

## How the system works

1. The CSV is imported into `Products` and `Reviews` only. The star `Rating` is
   **never** imported, so the engine classifies blind.
2. `NLPEngine` clean the text for scoring (keeping capitals, punctuation, emoticons)
   and tokenises a separate copy for keyword extraction.
3. VADER produces a compound score; thresholds map it to Happy / Angry / Neutral
   plus a confidence value.
4. The background engine polls for reviews without a `SentimentResults` row,
   classifies them in batches and stores the result. New feedback submitted from
   the dashboard is classified immediately by the same engine.
5. The dashboard is a set of hash-routed views behind one sidebar: **Overview**
   (summary, mood split, trend), **Reviews** (paginated, filterable feedback),
   **Complaints** (angry keywords plus the reviews behind them), **Products**
   (leaderboard ranked by angry share) and **Feedback** (the sample-review form).
   It reads aggregates from `/api/stats/*` and renders charts with Chart.js.

## Testing

```bash
npm test
```

Jest + Supertest run against a separate database (`DB_NAME_TEST`, default
`sentiment_db_test`). The global setup drops and recreates it from `db/schema.sql`,
and `ENGINE_ENABLED=false` keeps the polling loop out of the way.

Suites: `nlp.test.js` (classification, preprocessing, keywords), `auth.test.js`
(login, cookies, route protection), `reviews.test.js` (submission, validation,
product reuse, SQL-injection safety, listing), `stats.test.js` (summary,
distribution, zero-filled trends, keywords, product leaderboard) and `engine.test.js` (backlog
processing and idempotency).

Manual usability checklist: `docs/TESTING.md`.

## Evaluation

```bash
npm run evaluate
```

The evaluator does not touch the database. It reads the CSV, imports the same
`NLPEngine`, treats the star rating as proxy ground truth (4–5 → Happy, 3 →
Neutral, 1–2 → Angry), splits 20% dev / 80% test with a seeded shuffle, grid-searches
the thresholds on the dev set to maximise macro-F1, then reports test-set metrics
(accuracy, per-class precision/recall/F1, macro- and weighted-F1, a 3×3 confusion
matrix, majority baseline) and response-time numbers.

Outputs: `evaluation/results/report.md` and `report.json` (both gitignored).
Tuned thresholds are printed as a recommendation only; `nlpConfig.js` is never
overwritten automatically.

## UML diagrams

PlantUML sources for Figures 3.1–3.4 are in `docs/uml/`:
`use-case.puml`, `class.puml`, `sequence.puml`, `activity.puml`.

## Decisions

- **Project root is the repository root**, not a nested `sentiment-system/`
  directory, because `agents.md` already lives at the top level.
- **MySQL 8 runs in Docker** (image `mysql:8`, currently 8.4) rather than on the
  host, since no MySQL/MariaDB server is installed locally and installing one
  needs elevated privileges. The container uses the named volume
  `sentiment-mysql-data`. `DB_HOST=127.0.0.1` over TCP.
- **`default-authentication-plugin=mysql_native_password` is not passed** to the
  container: MySQL 8.4 removed that flag. `mysql2` handles the default
  `caching_sha2_password` plugin.
- **`db/schema.sql` uses a `__DB_NAME__` placeholder** substituted with `DB_NAME`
  by `scripts/db-init.js`, so the database name stays configurable while the file
  still contains `CREATE DATABASE`/`CREATE TABLE` as the spec requires.
- The supplied dataset was renamed from `Womens Clothing E-Commerce Reviews.csv`
  to `data/Womens_Clothing_E-Commerce_Reviews.csv` to match `CSV_PATH`.
- **A project `.npmrc` sets `include=dev`** because this machine's global npm
  config has `omit=dev`. Without the override a plain `npm install` skips dev
  dependencies (jest, supertest, nodemon) and `npm test` cannot run.
- **UI follows the supplied references** (`screens/login.png`, `screens/dashb.png`):
  neo-brutalist editorial styling with heavy black outlines, hard offset shadows,
  cobalt blue, pastel sentiment cards and a serif/monospace pairing. Fonts
  (Fraunces, Space Mono, Inter) load from Google Fonts with system fallbacks.
- **Chart.js 4.4.1 is vendored** at `frontend/vendor/chart.umd.js` so the app has
  no runtime CDN dependency.
- **The login page shows a generic product brand** ("SentimentIQ") before
  authentication. The company name comes from `GET /api/auth/me`, which is
  protected, and the spec's public route list has no public config endpoint; spec
  10.1 allows a generic heading pre-login. The dashboard header and page title use
  the real `COMPANY_NAME`.
- **Threshold logic lives in one place** (`classify.js`). The evaluator imports
  `labelForCompound()` so its grid search uses exactly the same mapping as the app.

## Known limitations

- `customerName` and `dateSubmitted` on imported reviews are **synthetic**: the
  Kaggle dataset contains neither, so names are generated deterministically from
  the seed and dates are placed randomly within `IMPORT_DATE_RANGE_DAYS`.
- Product names are derived from the dataset's class + Clothing ID because the
  dataset has no product names.
- The star-rating→sentiment mapping is a proxy ground truth. Three-star reviews are
  often mildly positive in their text, so **Neutral is the hardest class**.
- The classes are imbalanced (about 77% of reviews are 4–5 stars, about 12% are
  3-star), so accuracy alone is misleading; use per-class and macro metrics.
- Lexicon-based classification struggles with sarcasm and aspect-level sentiment
  (for example, loving the fabric but hating the fit).
- English only; local environment only; no concurrency or load testing.
