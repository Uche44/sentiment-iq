# Milestones — Web-Based Sentiment Analysis System

Derived from `agents.md` (BUILD_SPEC). Five milestones map to the five sprints in
spec section 15. **Each milestone ends with a test gate**: implementation is not
considered done until its "Test gate" commands pass. Do not start the next
milestone until the current gate is green.

Project root: this repository (`/home/uche44/code/chelsea`). The spec's
`sentiment-system/` folder is the repo root here, because `agents.md` already
lives at the top level.

> **Environment note.** Prefer a per-project Python venv for Python tooling, and
> keep Node deps local to this project (`npm install` in the repo root).
> Requires Node 20+, npm, and MySQL 8 running locally.

> **Data note.** The dataset was supplied as `Womens Clothing E-Commerce Reviews.csv`
> at the repo root. Milestone 1 moves it to `data/Womens_Clothing_E-Commerce_Reviews.csv`
> (no spaces) to match `CSV_PATH` in `.env.example`. It is gitignored.

---

## Milestone 1 — Setup and architecture

**Goal:** a runnable skeleton with a database that has the exact four tables.

### Tasks
- [ ] `package.json` with all scripts: `start`, `dev`, `db:init`, `seed`, `import`,
      `engine:once`, `test`, `evaluate`.
- [ ] Install deps: `express`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`,
      `dotenv`, `vader-sentiment`, `stopword`, `csv-parse`; dev: `jest`, `supertest`, `nodemon`.
- [ ] `.env.example` exactly as spec section 4 (plus `DB_NAME_TEST`, `ENGINE_ENABLED`).
- [ ] `.gitignore`: `node_modules`, `.env`, `data/*.csv`, `evaluation/results/`.
- [ ] `src/config.js` — reads env, exports typed config object (fails loudly on missing secrets).
- [ ] `src/db.js` — `mysql2` promise pool.
- [ ] `db/schema.sql` — `CREATE DATABASE IF NOT EXISTS`, the four tables with **exact**
      fields/constraints (Users, Products, Reviews, SentimentResults) + indexes + CHECK.
- [ ] `scripts/db-init.js` (`npm run db:init`) — runs `schema.sql`.
- [ ] Move CSV to `data/Womens_Clothing_E-Commerce_Reviews.csv`.
- [ ] Create empty `README.md` with a "Decisions" section started.

### Test gate
```bash
npm install
cp .env.example .env          # fill DB creds; no manual schema edits
npm run db:init
mysql -u "$DB_USER" -p -e "USE sentiment_db; SHOW TABLES; DESCRIBE SentimentResults;"
```
**Pass when:** `Users`, `Products`, `Reviews`, `SentimentResults` exist with exactly the
spec's columns, the `UNIQUE(reviewID)` and `chk_label` CHECK are present, and re-running
`npm run db:init` is a no-op (idempotent).

---

## Milestone 2 — Backend, database and auth

**Goal:** the API serves, auth works, and the DB can be seeded/imported.

### Tasks
- [ ] `src/server.js` — app bootstrap, JSON + `cookie-parser`, static files from
      `frontend/`, page routes, `errorHandler`, 404 handler, `npm start`/`npm run dev`.
- [ ] `src/middleware/errorHandler.js` — `{ error }` shape, no stack traces to client.
- [ ] `src/middleware/requireAuth.js` — 401 JSON for `/api/*`, redirect to `/login` for pages.
- [ ] `src/routes/auth.js` — `POST /login` (400 missing, 401 generic msg, signs JWT into
      httpOnly `token` cookie), `POST /logout`, `GET /me` (`{username, role, companyName}`).
- [ ] Login rate limiting (in-memory: 10 attempts / IP / 15 min).
- [ ] `db/seed.js` (`npm run seed`) — bcrypt cost 10 manager account, idempotent.
- [ ] `scripts/import-reviews.js` (`npm run import`) — csv-parse, drop empty reviews,
      seeded sample (`IMPORT_SAMPLE_SIZE`), Products + Reviews only (**no SentimentResults**),
      synthetic names/dates, batched tx inserts (500), `--reset` truncation, summary print.
- [ ] `src/services/reviewService.js`, `src/services/statsService.js` (data access only).
- [ ] `src/routes/products.js` — `GET /api/products` (`?q=` filter, caps).
- [ ] `src/routes/reviews.js` — `GET /api/reviews` (INNER JOIN, limit/offset/filters),
      `POST /api/reviews` insert path **without** classification yet.
- [ ] `src/nlp/preprocess.js` helper stubs only if needed for import (no classification).

### Test gate
```bash
npm run seed && npm run import
mysql ... -e "SELECT COUNT(*) FROM Reviews; SELECT COUNT(*) FROM SentimentResults;"
curl -i -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"manager","password":"ChangeMe123!"}'      # 200 + Set-Cookie
curl -i localhost:3000/api/stats/summary                     # 401 without cookie
npm test -- tests/auth.test.js
```
**Pass when:** ~5,000 reviews imported with **0** sentiment results; login sets a cookie;
wrong/missing creds behave per spec; protected route 401s without a cookie; `/dashboard`
without a cookie redirects to `/login`; auth tests green.

---

## Milestone 3 — NLP module and engine

**Goal:** classification works end-to-end and the engine drains the backlog.

### Tasks
- [ ] `src/nlp/nlpConfig.js` — thresholds `{0.05, -0.05}`, stop-word extras incl. contractions.
- [ ] `src/nlp/preprocess.js` — `cleaned` (keep punctuation/caps/emoji) + `tokens`
      (lowercase, strip URLs/punct/digits, len<3, stop words).
- [ ] `src/nlp/classify.js` — VADER compound → label + confidence per spec 8.3 (empty → Neutral 0).
- [ ] `src/nlp/keywords.js` — `topKeywords(texts, n)` document-frequency counting.
- [ ] `src/nlp/NLPEngine.js` — `preprocess`/`classify`/`analyse`, pure & synchronous, **no DB/Express imports**.
- [ ] `src/engine/processor.js` — unprocessed-review query, batch transaction with
      `INSERT ... ON DUPLICATE KEY UPDATE`, `setTimeout` chaining, `isRunning` guard,
      error resilience, `runOnce()`, `ENGINE_ENABLED` toggle, auto-start from `server.js`.
- [ ] `scripts/run-engine-once.js` (`npm run engine:once`).
- [ ] Wire classification into `POST /api/reviews` (201 response with label+confidence).
- [ ] `src/routes/stats.js` — `summary`, `distribution`, `trend` (interval, zero-fill),
      `keywords` (Angry, cap 5000, limit); `POST /api/engine/run`.

### Test gate
```bash
npm test -- tests/nlp.test.js
npm run engine:once                       # classifies whole backlog
mysql ... -e "SELECT sentimentLabel, COUNT(*) FROM SentimentResults GROUP BY 1;"
curl -s -b cookie.txt localhost:3000/api/stats/summary
curl -s -b cookie.txt "localhost:3000/api/stats/trend?interval=week"
curl -s -b cookie.txt localhost:3000/api/stats/keywords
```
**Pass when:** `SentimentResults` count == `Reviews` count; NLP tests pass
(positive→Happy, negative→Angry, neutral→Neutral, emoticons, ALL-CAPS/`!!!` raise
intensity, empty doesn't throw, tokens have no stop words, confidence ∈ [0,1]);
stats endpoints return correct, zero-filled data; `runOnce()` is idempotent.

---

## Milestone 4 — Frontend

**Goal:** the full dashboard works in a browser, desktop and 360px.

### Tasks
- [ ] `frontend/css/styles.css` — CSS custom properties, palette (Happy `#2e9e5b`,
      Angry `#d64545`, Neutral `#d9a21b`), responsive down to 360px.
- [ ] `frontend/vendor/` Chart.js (pinned CDN or vendored).
- [ ] `frontend/js/api.js` — fetch helpers with error handling.
- [ ] `frontend/login.html` + `frontend/js/login.js` — validation, inline errors,
      disable-while-pending, redirect on success.
- [ ] `frontend/dashboard.html` + `frontend/js/dashboard.js` + `frontend/js/charts.js`:
      company/user header + Logout; summary cards; distribution doughnut; trend line with
      date-range + interval controls (no reload); negative-keywords chart; scrollable
      recent reviews with badge+confidence, "Read more", filter dropdown, "Load more";
      submit-feedback form with datalist autocomplete and inline result.
- [ ] Per-widget loading/error isolation; 30s auto-refresh of summary/distribution/recent.
- [ ] `textContent`-only DOM insertion (clean text escaped).
- [ ] `docs/TESTING.md` — manual usability checklist.

### Test gate
Manual, following `docs/TESTING.md`:
- Log in → dashboard loads with live data.
- Submit a clearly positive review → shows "Happy 😊" inline; charts/summary refresh.
- Submit a clearly negative review → "Angry 😠".
- Change trend date range and interval → line re-renders without page reload.
- Filter reviews by sentiment; "Load more" appends older items.
- Resize to 360px → layout usable, no horizontal scroll.
- Kill the API mid-session → each widget shows a friendly error, others still render.
- Log out → back to `/login`.
```bash
npx --yes serve frontend   # optional static sanity check; real check via npm start
```
**Pass when:** every checklist item passes at desktop and 360px; no unescaped text in DOM.

---

## Milestone 5 — Testing, evaluation and documentation

**Goal:** green test suite, evaluation report, diagrams, and a README that works from a clean clone.

### Tasks
- [ ] `tests/nlp.test.js`, `tests/auth.test.js`, `tests/reviews.test.js`,
      `tests/stats.test.js` (plus engine test) — jest + supertest against
      `DB_NAME_TEST`, `ENGINE_ENABLED=false`.
- [ ] Test setup creates/cleans the test DB; SQL-injection-looking input stored as plain text.
- [ ] `evaluation/evaluate.js` (`npm run evaluate`) — no DB access; imports the app's
      `NLPEngine`; star→sentiment ground truth; seeded 80/20 split; dev-set threshold
      grid-search (macro-F1); test-set metrics (accuracy, per-class P/R/F1, macro/weighted
      F1, 3×3 confusion matrix, majority baseline); timing (avg, p95, reviews/sec);
      writes `results/report.json` + `results/report.md`; console summary.
- [ ] `docs/uml/{use-case,class,sequence,activity}.puml` per spec 13.
- [ ] `README.md` — overview, prerequisites, setup + exact command sequence, tests,
      evaluation, folder structure, **Decisions**, known limitations; consistency pass so
      docs/copy match the code.
- [ ] ESLint + Prettier config (SHOULD).

### Test gate
```bash
npm test                                   # all suites green
npm run evaluate                           # writes report.md + report.json
ls evaluation/results/
# clean-clone rehearsal:
git clone <repo> /tmp/clean && cd /tmp/clean
npm install && cp .env.example .env && npm run db:init && npm run seed \
  && npm run import && npm run engine:once && npm test && npm run evaluate
```
**Pass when:** `npm test` is green; `npm run evaluate` produces both report files with
headline accuracy + macro-F1 + baseline; all four `.puml` files exist; README commands
work from a clean clone; "Decisions" and "Known limitations" sections are filled in.

---

## Cross-cutting rules (apply in every milestone)
- Validate all input server-side; all SQL parameterised; pooled connections.
- Routes → services → db separation; NLP module imports no Express/DB.
- Never commit `.env` or `data/*.csv`; never log passwords/tokens.
- Async/await throughout; no unhandled rejections; no stack traces to clients.
- Commit to Git at the end of each milestone (do not push without asking).
