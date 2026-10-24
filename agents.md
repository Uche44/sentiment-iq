# BUILD SPEC: Web-Based Sentiment Analysis System for E-Commerce Customer Feedback

> You are a coding agent. Build the project described below end to end. This spec is the single source of truth. Where it says **MUST**, do it exactly. Where it says **SHOULD**, use judgement. If something is ambiguous, pick the simplest option that satisfies the text and note the decision in `README.md` under "Decisions".

---

## 1. What you are building

A web application for one fictional women's fashion retailer. A **Business Manager** logs in and sees a dashboard showing what customers feel about the company's products. Customer reviews live in a MySQL database. An **NLP engine** automatically classifies every review as **Happy**, **Angry** or **Neutral**, stores the result, and the dashboard visualises it.

This is an undergraduate project (B.Sc. Computer Science) whose written report already exists. The implementation MUST match the report's design: four database tables, Node.js backend, HTML/CSS/JavaScript frontend, Fetch API for async calls, Agile Scrum sprint structure.

### Actors
1. **Business Manager**: logs in, views the dashboard and analytics, submits sample feedback for test analysis.
2. **Sentiment Analysis Engine** (system actor): automatically retrieves unprocessed reviews, preprocesses text, classifies sentiment, stores results, with no human intervention.

### Core features (all MUST be implemented)
1. Authentication (login form, hashed passwords, roles, protected dashboard).
2. MySQL database with exactly the four tables in section 5.
3. Import of a real review dataset (section 6) into those tables.
4. NLP module: preprocessing + classification into Happy / Angry / Neutral with a confidence score.
5. Automated engine loop that classifies all unprocessed reviews.
6. Feedback submission form (product name, customer name, review text) classified immediately via Fetch.
7. Interactive dashboard: sentiment distribution chart, trend line over a selectable period, scrollable recent reviews with colour-coded labels, frequent keywords from negative reviews.
8. A standalone evaluation script that measures accuracy against the benchmark dataset, plus response time.
9. Automated tests and a README.
10. UML diagram sources (use-case, class, sequence, activity).

### Scope limits (do NOT go beyond these)
- English text only. Text only (no images, audio, video).
- Three classes only: Happy, Angry, Neutral.
- Local development environment only. No deployment config, Docker is optional.
- **Do NOT train a machine-learning model.** Use an existing lexicon-based classifier.
- No scraping of live e-commerce sites.
- Single company. No multi-tenancy, no company switcher.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20+ and npm |
| Backend framework | Express |
| Database | MySQL 8 via `mysql2` (promise API) |
| Auth | `bcryptjs` for password hashing, `jsonwebtoken` for sessions, `cookie-parser` |
| Config | `dotenv` |
| NLP | `vader-sentiment` (lexicon-based). Fallback if it misbehaves: the `sentiment` (AFINN) package |
| Stop words | `stopword` package (or a hardcoded English list) |
| CSV parsing | `csv-parse` |
| Frontend | Plain HTML5, CSS3, vanilla JavaScript (no React/Vue/frameworks) |
| Charts | Chart.js (vendored locally under `frontend/vendor/` or from a pinned CDN URL) |
| Tests | `jest` + `supertest` |
| Dev | `nodemon` |

The Express server MUST also serve the frontend as static files from the same origin (no CORS setup needed).

---

## 3. Project structure

```
sentiment-system/
├── README.md
├── BUILD_SPEC.md              (this file)
├── .env.example
├── .gitignore                 (node_modules, .env, data/*.csv, evaluation/results/)
├── package.json
├── data/
│   └── Womens_Clothing_E-Commerce_Reviews.csv     (provided by the user; never committed)
├── db/
│   ├── schema.sql
│   └── seed.js                (creates the manager account)
├── scripts/
│   ├── import-reviews.js      (CSV → MySQL, section 6)
│   └── run-engine-once.js     (processes the backlog and exits)
├── src/
│   ├── server.js              (app bootstrap, static files, engine start)
│   ├── config.js              (reads .env, exports typed config)
│   ├── db.js                  (mysql2 pool)
│   ├── middleware/
│   │   ├── requireAuth.js
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── reviews.js
│   │   ├── stats.js
│   │   └── products.js
│   ├── services/
│   │   ├── reviewService.js
│   │   └── statsService.js
│   ├── nlp/
│   │   ├── NLPEngine.js       (class: preprocess + classify)
│   │   ├── preprocess.js
│   │   ├── classify.js
│   │   ├── keywords.js
│   │   └── nlpConfig.js       (thresholds, stop-word extras)
│   └── engine/
│       └── processor.js       (polling worker, section 8)
├── frontend/
│   ├── login.html
│   ├── dashboard.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── api.js             (fetch helpers)
│   │   ├── login.js
│   │   ├── dashboard.js
│   │   └── charts.js
│   └── vendor/                (chart.js)
├── evaluation/
│   ├── evaluate.js
│   └── results/               (generated reports, gitignored)
├── docs/
│   └── uml/
│       ├── use-case.puml
│       ├── class.puml
│       ├── sequence.puml
│       └── activity.puml
└── tests/
    ├── nlp.test.js
    ├── auth.test.js
    ├── reviews.test.js
    └── stats.test.js
```

---

## 4. Configuration (`.env.example`)

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=sentiment_db
JWT_SECRET=change-me
JWT_EXPIRES_IN=8h
COOKIE_SECURE=false

COMPANY_NAME=StyleHouse
MANAGER_USERNAME=manager
MANAGER_PASSWORD=ChangeMe123!

ENGINE_POLL_INTERVAL_MS=10000
ENGINE_BATCH_SIZE=200

IMPORT_SAMPLE_SIZE=5000
IMPORT_RANDOM_SEED=42
IMPORT_DATE_RANGE_DAYS=180
CSV_PATH=./data/Womens_Clothing_E-Commerce_Reviews.csv
```

`COMPANY_NAME` is a placeholder the user will change. It MUST appear in the dashboard header and page titles, read from the API (`GET /api/auth/me` or `GET /api/config`), never hardcoded in HTML.

---

## 5. Database design (MUST match exactly)

Database name from `DB_NAME`. Create it in `db/schema.sql` (`CREATE DATABASE IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).

```sql
CREATE TABLE IF NOT EXISTS Users (
  userID    INT AUTO_INCREMENT PRIMARY KEY,
  username  VARCHAR(50)  NOT NULL UNIQUE,
  password  VARCHAR(255) NOT NULL,              -- bcrypt hash, never plaintext
  role      VARCHAR(20)  NOT NULL DEFAULT 'manager'   -- 'manager' or 'admin'
);

CREATE TABLE IF NOT EXISTS Products (
  productID   INT AUTO_INCREMENT PRIMARY KEY,
  productName VARCHAR(100) NOT NULL,
  category    VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS Reviews (
  reviewID      INT AUTO_INCREMENT PRIMARY KEY,
  productID     INT NOT NULL,
  customerName  VARCHAR(100),
  reviewText    TEXT NOT NULL,
  dateSubmitted DATETIME NOT NULL,
  FOREIGN KEY (productID) REFERENCES Products(productID),
  INDEX idx_reviews_date (dateSubmitted)
);

CREATE TABLE IF NOT EXISTS SentimentResults (
  resultID       INT AUTO_INCREMENT PRIMARY KEY,
  reviewID       INT NOT NULL UNIQUE,            -- one result per review
  sentimentLabel VARCHAR(10) NOT NULL,           -- 'Happy' | 'Angry' | 'Neutral'
  confidenceScore FLOAT NOT NULL,
  dateProcessed  DATETIME NOT NULL,
  FOREIGN KEY (reviewID) REFERENCES Reviews(reviewID) ON DELETE CASCADE,
  CONSTRAINT chk_label CHECK (sentimentLabel IN ('Happy','Angry','Neutral'))
);
```

Rules:
- Do NOT add columns to these tables (no `rating` column). The `UNIQUE` on `reviewID` and the indexes are the only additions beyond the report and are allowed.
- All SQL MUST use parameterised queries (`?` placeholders). No string concatenation of user input.
- Use a connection pool.

---

## 6. Dataset import

**Source:** Kaggle "Women's E-Commerce Clothing Reviews", already at `data/Womens_Clothing_E-Commerce_Reviews.csv`.

Facts about the file (verified): 23,486 rows, 11 columns, UTF-8.

Columns: `Unnamed: 0` (index), `Clothing ID`, `Age`, `Title`, `Review Text`, `Rating` (1-5), `Recommended IND`, `Positive Feedback Count`, `Division Name`, `Department Name`, `Class Name`.

Known data issues: `Review Text` is empty in 845 rows; `Title` is empty in 3,810 rows; `Division Name`/`Department Name`/`Class Name` are empty in 14 rows; there is **no date column and no customer name column**.

### Import script: `scripts/import-reviews.js`

Run with `npm run import`. It MUST:

1. Read the CSV with `csv-parse` (header row, handle quoted multi-line fields).
2. **Drop** rows where `Review Text` is empty/whitespace. Expected remaining: 22,641.
3. **Take a random sample** of `IMPORT_SAMPLE_SIZE` rows (default 5000) using a **seeded** PRNG (`IMPORT_RANDOM_SEED`) so imports are reproducible. Do not stratify; keep the natural distribution. If `IMPORT_SAMPLE_SIZE=0`, import all rows.
4. **Products:** for every distinct `Clothing ID` in the sample, insert one product with:
   - `productID` = the Clothing ID (explicit value; AUTO_INCREMENT will continue above the max afterwards)
   - `productName` = `` `${Class Name} #${Clothing ID}` `` (if Class Name is empty: `` `Item #${Clothing ID}` ``), truncated to 100 chars
   - `category` = `Department Name` (if empty: `Uncategorised`)
5. **Reviews:** insert one row per sampled review with:
   - `productID` = Clothing ID
   - `reviewText` = `Title` + `". "` + `Review Text` when Title is non-empty, otherwise just `Review Text`. Trim whitespace.
   - `customerName` = a generated name picked from hardcoded first-name and last-name lists (mix of Nigerian and international names, 40+ of each, deterministic from the seed). The dataset is anonymous so these are synthetic. Do not use real people's names.
   - `dateSubmitted` = a pseudo-random datetime within the last `IMPORT_DATE_RANGE_DAYS` days (deterministic from the seed). Also synthetic because the dataset has no dates.
6. **Do NOT import `Rating` or any other dropped column.** The engine MUST classify blind. The star rating is used only by the evaluation script (section 10).
7. **Do NOT insert any SentimentResults.** The engine fills these.
8. Use batched multi-row inserts (500 rows per batch), inside a transaction. Make the script idempotent: if `--reset` is passed, truncate `SentimentResults`, `Reviews`, `Products` (disable FK checks temporarily) before importing; without it, abort with a clear message if `Reviews` is non-empty.
9. Print a summary: rows read, rows dropped, rows imported, products created, date range used.

---

## 7. Authentication

- `db/seed.js` (`npm run seed`) creates one user from `MANAGER_USERNAME` / `MANAGER_PASSWORD` with role `manager`, bcrypt-hashed (cost 10). Idempotent (skip if the username exists).
- `POST /api/auth/login` body `{ username, password }`:
  - 400 if either field missing/blank.
  - 401 with a generic message (`"Invalid username or password"`) on any failure. Do not reveal which part was wrong.
  - On success: sign a JWT `{ userID, username, role }` with `JWT_SECRET`, `JWT_EXPIRES_IN`; set it as an **httpOnly, sameSite=lax** cookie named `token` (`secure` from `COOKIE_SECURE`). Respond `{ username, role }`.
- `POST /api/auth/logout`: clears the cookie.
- `GET /api/auth/me`: returns `{ username, role, companyName }` or 401.
- `requireAuth` middleware: verifies the cookie; for `/api/*` returns 401 JSON; for page routes redirects to `/login`.
- Route protection:
  - Public: `/login` (serves `login.html`), `POST /api/auth/login`, static assets under `/css`, `/js`, `/vendor`.
  - Protected: `/dashboard` (serves `dashboard.html`), **every other `/api/*` route**.
  - `/` redirects to `/dashboard` (which redirects to `/login` if unauthenticated).
- Add basic login rate limiting (simple in-memory counter: max 10 attempts per IP per 15 min) SHOULD.
- Never log passwords or tokens.

---

## 8. NLP module and engine

### 8.1 `NLPEngine` class (`src/nlp/NLPEngine.js`)

```js
class NLPEngine {
  preprocess(text)            // → { cleaned: string, tokens: string[] }
  classify(text)              // → { label: 'Happy'|'Angry'|'Neutral', confidence: number, compound: number }
  analyse(text)               // → preprocess + classify combined
}
```

### 8.2 Preprocessing (MUST implement and document)

Two outputs from the same input:

1. **`cleaned`** (used for scoring): trim, collapse whitespace, decode HTML entities, normalise curly quotes to straight quotes. **Keep** punctuation, capitalisation, emoticons and emoji, because VADER uses ALL-CAPS, `!`, and emoticons as signal. Do NOT strip them.
2. **`tokens`** (used for keyword extraction): lowercase → remove URLs → strip punctuation/digits → split on whitespace → drop tokens of length < 3 → remove stop words (standard English list + extras in `nlpConfig.js`, which MUST include contractions fragments like `don`, `didn`, `isn`, `wasn`, `ve`, `ll`).

Explain in the README why scoring and keyword tokenisation use different forms.

### 8.3 Classification

- Use `vader-sentiment`'s `SentimentIntensityAnalyzer.polarity_scores(cleaned)` and read `compound` ∈ [-1, 1].
- Thresholds live in `nlpConfig.js` as `{ positiveThreshold: 0.05, negativeThreshold: -0.05 }` (separate values so they can be tuned asymmetrically):
  - `compound >= positiveThreshold` → **Happy**
  - `compound <= negativeThreshold` → **Angry**
  - otherwise → **Neutral**
- **Confidence score** (0..1, stored to `confidenceScore`, rounded to 4 d.p.):
  - Happy/Angry: `min(1, |compound|)`
  - Neutral: `1 - |compound| / bandWidth`, where `bandWidth = max(positiveThreshold, |negativeThreshold|)`, clamped to [0, 1]
- Empty/whitespace-only text MUST NOT crash; classify as Neutral with confidence 0 (but the API layer rejects empty reviews before this, see section 9).
- The module MUST be pure and synchronous, with no DB access, so the evaluation script can reuse it unchanged.

### 8.4 Keyword extraction (`keywords.js`)

`topKeywords(textsArray, n)` → `[{ word, count }]`, using the `tokens` output of `preprocess`. Count each word at most once per review (document frequency) so one repetitive review cannot dominate. Used for negative-review keywords on the dashboard.

### 8.5 Automated engine (`src/engine/processor.js`)

The system actor from the use-case diagram. It MUST:

1. Query unprocessed reviews:
   ```sql
   SELECT r.reviewID, r.reviewText
   FROM Reviews r
   LEFT JOIN SentimentResults s ON s.reviewID = r.reviewID
   WHERE s.reviewID IS NULL
   ORDER BY r.reviewID
   LIMIT ?
   ```
   with `ENGINE_BATCH_SIZE`.
2. For each review: `analyse()` → insert into `SentimentResults` (`reviewID`, `sentimentLabel`, `confidenceScore`, `dateProcessed = NOW()`), using `INSERT ... ON DUPLICATE KEY UPDATE` or `INSERT IGNORE` so concurrent runs cannot double-process. Insert each batch in one transaction using a multi-row insert.
3. Loop until a query returns zero rows, then wait `ENGINE_POLL_INTERVAL_MS` and poll again (use `setTimeout` chaining, not overlapping `setInterval`).
4. Guard against overlapping runs with an in-process `isRunning` flag.
5. Start automatically when `server.js` boots (log "Engine started"). Log a one-line summary per cycle that processed >0 reviews.
6. Catch and log errors; one bad review or DB hiccup MUST NOT kill the loop.
7. Export `runOnce()` which processes the whole backlog and resolves with a count. `scripts/run-engine-once.js` calls it (`npm run engine:once`).
8. Support `ENGINE_ENABLED=false` in `.env` to disable the background loop (useful in tests).

---

## 9. REST API

All JSON. All routes except login require auth. Errors use `{ "error": "message" }` with proper status codes (400 validation, 401 unauth, 404, 500). No stack traces to clients.

| Method & path | Purpose |
|---|---|
| `POST /api/auth/login` | see section 7 |
| `POST /api/auth/logout` | |
| `GET /api/auth/me` | `{ username, role, companyName }` |
| `GET /api/products` | `[{ productID, productName, category }]` (for the form's autocomplete datalist; cap 2000, support `?q=` prefix/contains filter, limit 20 when `q` given) |
| `POST /api/reviews` | submit feedback (below) |
| `GET /api/reviews` | recent classified reviews (below) |
| `GET /api/stats/summary` | totals: `{ total, processed, pending, happy, angry, neutral }` |
| `GET /api/stats/distribution` | `{ Happy: n, Angry: n, Neutral: n, total: n }` |
| `GET /api/stats/trend` | sentiment counts over time (below) |
| `GET /api/stats/keywords` | top keywords from Angry reviews (below) |
| `POST /api/engine/run` | manually trigger `runOnce()`, returns `{ processed }` |

### `POST /api/reviews`
Body: `{ productName, customerName, reviewText }`.
- Validation (server-side, mirrors the client): all three required; trimmed; `productName` ≤ 100 chars; `customerName` ≤ 100 chars; `reviewText` 3 to 5000 chars. Return 400 with a `fields` object: `{ error: "Validation failed", fields: { reviewText: "Review text is required" } }`.
- Find the product by case-insensitive exact `productName`; if not found, create it with category `Uncategorised`.
- Insert the review with `dateSubmitted = NOW()`.
- Classify immediately with `NLPEngine.analyse` and insert the `SentimentResults` row (same insert-safe logic as the engine, so the engine will skip it).
- Respond 201: `{ reviewID, productName, customerName, reviewText, sentimentLabel, confidenceScore, dateSubmitted }`.

### `GET /api/reviews`
Query: `limit` (default 20, max 100), `offset` (default 0), `sentiment` (optional: Happy|Angry|Neutral), `productID` (optional).
Returns `{ total, items: [{ reviewID, productName, category, customerName, reviewText, dateSubmitted, sentimentLabel, confidenceScore }] }`, newest `dateSubmitted` first. Only reviews that have a result (INNER JOIN).

### `GET /api/stats/trend`
Query: `from` (YYYY-MM-DD), `to` (YYYY-MM-DD), `interval` (`day` | `week` | `month`, default `week`). Defaults: last 90 days. Validate dates and `from <= to`.
Group by `Reviews.dateSubmitted`. Return:
```json
{ "interval": "week", "points": [ { "period": "2026-08-03", "Happy": 120, "Angry": 14, "Neutral": 22 } ] }
```
Include periods with zero reviews as zeros so the line is continuous.

### `GET /api/stats/keywords`
Query: `limit` (default 15, max 50), optional `from`/`to`. Takes the review texts of **Angry** reviews (cap the scan at the 5000 most recent for performance), runs `topKeywords`, returns `[{ word, count }]`.

---

## 10. Frontend

Plain HTML/CSS/JS. Clean, professional, **responsive** (usable at 360px wide and on desktop). CSS custom properties for the palette. Sentiment colours: Happy `#2e9e5b` (green), Angry `#d64545` (red), Neutral `#d9a21b` (amber). Do not rely on colour alone: also show the label text and an icon/emoji next to it (😊 😠 😐).

### 10.1 `login.html`
- Company name heading (fetched, or generic "Sentiment Dashboard" before login), username + password fields, "Sign in" button.
- Client-side validation: both fields required, inline error messages under the field.
- On submit: `fetch('/api/auth/login')`, show server error inline ("Invalid username or password"), redirect to `/dashboard` on success.
- Disable the button while the request is in flight.

### 10.2 `dashboard.html`
On load: call `/api/auth/me`; on 401 redirect to `/login`. Header shows company name, logged-in username, **Logout** button.

Layout (single page, sections in this order):

1. **Summary cards**: Total reviews, Happy, Angry, Neutral (with percentages), and a small "Pending analysis" indicator from `/api/stats/summary`.
2. **Distribution chart**: doughnut or bar chart of the three categories (Chart.js).
3. **Trend chart**: line chart, one line per sentiment, x-axis = period. Controls: date range (`from`/`to` date inputs, default last 90 days) and interval selector (Day/Week/Month). Re-fetches and re-renders on change **without reloading the page**.
4. **Negative keywords**: horizontal bar chart or tag cloud of top keywords from Angry reviews, with counts.
5. **Recent reviews**: scrollable list (fixed-height container with `overflow-y: auto`), each item showing product name, customer, date, review text (truncate long text with expand/"Read more"), and a **colour-coded sentiment badge** with confidence %. A filter dropdown (All/Happy/Angry/Neutral) and a "Load more" button using `offset`.
6. **Submit feedback form** (for testing/demo): fields Product name (with `<datalist>` autocomplete from `/api/products?q=`), Customer name, Review text (textarea). Client-side validation, inline error messages beside each field, a submit button that disables while pending. On 201: show the result inline ("Classified as Happy 😊 (confidence 0.82)"), clear the form, and refresh summary, charts and recent list. Map server `fields` errors to the inline messages.

All data loading uses `fetch` + `async/await`. Show a loading state and a friendly error state per widget; one failing widget MUST NOT break the others. Auto-refresh the summary, distribution and recent list every 30 seconds SHOULD (so engine progress is visible).

Escape all user-generated text before inserting into the DOM (use `textContent`, never `innerHTML` with review text).

---

## 11. Evaluation (`evaluation/evaluate.js`, `npm run evaluate`)

This produces the numbers for Chapter 4 / the accuracy objective. It MUST NOT touch the database. It reads the CSV directly and imports the **same** `NLPEngine` used by the app.

Steps:
1. Load the CSV; drop rows with empty `Review Text`; build text exactly as in the importer (`Title. Review Text`).
2. **Ground-truth mapping from stars:** Rating 4-5 → Happy, 3 → Neutral, 1-2 → Angry.
3. **Split** with a seeded shuffle (seed 42): 20% **dev set**, 80% **test set**.
4. **Tuning (dev set only):** grid-search `positiveThreshold` over [0.05 … 0.5] and `negativeThreshold` over [-0.5 … -0.05] (step 0.05) to maximise **macro-F1** on the dev set. Print the best pair. Do NOT overwrite `nlpConfig.js` automatically; print the recommended values and let the user copy them. Report tuned and default-threshold results.
5. **Final metrics on the test set only**, with default thresholds and with tuned thresholds:
   - overall accuracy
   - per-class precision, recall, F1 and support
   - macro-F1 and weighted-F1
   - 3×3 confusion matrix (rows = actual, columns = predicted)
   - **majority-class baseline accuracy** (always predict Happy) for comparison
6. **Responsiveness:** time `analyse()` over the whole test set; report average ms per review, p95 ms, and reviews per second. Also, if the server is running (`--api http://localhost:3000` flag with login), measure the average round-trip of `POST /api/reviews` over 50 submissions. This is optional.
7. Write `evaluation/results/report.json` and a human-readable `evaluation/results/report.md` (tables in markdown) containing all of the above plus dataset counts and the class distribution.
8. Print a short console summary.

Do not implement any ML training. No external API calls.

---

## 12. Testing

Use `jest` + `supertest` against a **separate test database** (`DB_NAME_TEST` or `${DB_NAME}_test`; create/clean it in test setup). Set `ENGINE_ENABLED=false` in tests.

Minimum tests:
- **NLP:** clearly positive text → Happy; clearly negative → Angry; flat factual text → Neutral; text with emoticons; ALL-CAPS and "!!!" raise intensity; empty string does not throw; `tokens` contain no stop words; confidence in [0, 1].
- **Auth:** login success sets a cookie; wrong password → 401 with the generic message; missing fields → 400; protected API without cookie → 401; `/dashboard` without cookie redirects to `/login`.
- **Reviews:** `POST /api/reviews` valid → 201 with a label, and a `SentimentResults` row exists; invalid → 400 with `fields`; new product is created, existing product reused (case-insensitive); SQL-injection-looking input is stored as plain text and does not break anything.
- **Engine:** insert 3 unprocessed reviews, call `runOnce()`, assert 3 results exist; calling it again processes 0 (idempotent).
- **Stats:** distribution counts match inserted data; trend returns zero-filled periods; invalid date range → 400.

Also add `docs/TESTING.md` with a short **manual usability checklist** (log in, submit a good and a bad review, see charts update, resize to phone width, log out) for the usability evaluation.

---

## 13. UML diagrams (`docs/uml/*.puml`, PlantUML source)

Write these four files so the author can render images for Figures 3.1 to 3.4.

1. **`use-case.puml`**: actors *Business Manager* and *Sentiment Analysis Engine* (system actor). Business Manager use cases: Log in, View sentiment dashboard, View analytics reports (distribution, trend, keywords), Submit sample feedback, Log out. Engine use cases: Retrieve new reviews, Preprocess text, Classify sentiment, Store results, Update dashboard data. Show `<<include>>` from Submit sample feedback to Classify sentiment.
2. **`class.puml`**: classes `User`(userID, username, password, role; login(), logout()), `Product`(productID, productName, category), `Review`(reviewID, customerName, reviewText, dateSubmitted), `SentimentResult`(resultID, sentimentLabel, confidenceScore, dateProcessed), `NLPEngine`(preprocess(), classify(), analyse()), `Dashboard`(getDistribution(), getTrend(), getKeywords(), getRecentReviews()). Relations: Product 1—* Review, Review 1—0..1 SentimentResult, NLPEngine produces SentimentResult, Dashboard aggregates SentimentResult, User uses Dashboard.
3. **`sequence.puml`**: Business Manager logs in → Browser → Node.js server → verifies credentials → dashboard request → server retrieves new reviews → NLP engine classifies → results stored in MySQL → server returns chart data → browser renders.
4. **`activity.puml`**: start → retrieve unprocessed review from DB → preprocess text → classify sentiment → decision (Happy / Angry / Neutral) → store result → update dashboard data → more unprocessed reviews? (loop) → end.

---

## 14. Documentation (`README.md`)

MUST include: project overview; prerequisites (Node 20+, MySQL 8); setup steps; the exact command sequence below; how to run tests and evaluation; folder structure; the "Decisions" section; known limitations.

### Command sequence (package.json scripts)

```
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

Known limitations to state in the README (the author needs these in the report):
- `customerName` and `dateSubmitted` for imported reviews are **synthetic** because the Kaggle dataset has neither.
- Product names are derived from class + ID because the dataset has no product names.
- Star-rating-to-sentiment mapping is a proxy ground truth; 3-star reviews are often mildly positive in text, so Neutral is the hardest class.
- The classes are imbalanced (about 56% of reviews are 5-star, about 12% are 3-star), so accuracy alone is misleading; use per-class and macro metrics.
- Lexicon-based classification struggles with sarcasm and aspect-level sentiment (e.g. loves the fabric, hates the fit).
- English only; local environment only; no concurrency/load testing.

---

## 15. Build order (follow the sprints; commit to Git at the end of each)

### Sprint 1: Setup and architecture
Scaffold the folder structure, `package.json` with scripts, `.env.example`, `.gitignore`, `config.js`, `db.js`, `db/schema.sql`, `npm run db:init`.
**Done when:** `npm run db:init` creates the four tables with the exact fields.

### Sprint 2: Backend, database and auth
Express server, error handler, auth routes + middleware, `db/seed.js`, `scripts/import-reviews.js`, products/reviews routes (without classification yet).
**Done when:** `npm run seed && npm run import` populates the DB (about 5,000 reviews, no sentiment results yet); login works; protected routes return 401 without a cookie; auth tests pass.

### Sprint 3: NLP module and engine
`NLPEngine`, preprocessing, classification, keywords, `processor.js`, `run-engine-once.js`, wire classification into `POST /api/reviews`, stats routes.
**Done when:** `npm run engine:once` classifies the whole backlog; `/api/stats/*` return correct data; NLP, engine and review tests pass.

### Sprint 4: Frontend
`login.html`, `dashboard.html`, styles, JS modules, charts, form with validation, filters, auto-refresh.
**Done when:** the full manual checklist in `docs/TESTING.md` passes on desktop and a 360px-wide viewport.

### Sprint 5: Testing, evaluation and documentation
Complete the test suite, `evaluate.js` and its report, UML `.puml` files, README.
**Done when:** `npm test` is green, `npm run evaluate` writes `report.md` and `report.json`, and README instructions work from a clean clone.

---

## 16. Quality bar

- Clear separation: routes → services → db; NLP module has no Express or DB imports.
- Async/await throughout; no unhandled promise rejections.
- Validate all input on the server even though the client validates too.
- No secrets in the repo. Never commit `.env` or the CSV.
- Consistent code style (add ESLint + Prettier config SHOULD).
- Meaningful comments only where logic isn't obvious. Keep functions small.
- When finished, give the user a short summary: what was built, how to run it, evaluation headline numbers, and anything you could not complete or decided differently.