# StyleHouse — Web-Based Sentiment Analysis System

A web application for a fictional women's fashion retailer. A Business Manager logs
in to a dashboard showing what customers feel about the company's products. Customer
reviews live in MySQL; an NLP engine classifies every review as **Happy**, **Angry**
or **Neutral** and the dashboard visualises the results.

Built to `agents.md` (BUILD_SPEC). See `MILESTONES.md` for the five-milestone plan.

> Status: Milestone 1 complete (setup and architecture). Remaining sections are
> filled in as later milestones land.

## Prerequisites

- Node.js 20+ and npm
- MySQL 8 (this repo is developed against MySQL 8.4 in Docker — see Development DB)

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

## Folder structure

```
db/            schema.sql, seed.js
scripts/       db-init.js, import-reviews.js, run-engine-once.js
src/           server.js, config.js, db.js, middleware/, routes/, services/, nlp/, engine/
frontend/      login.html, dashboard.html, css/, js/, vendor/
evaluation/    evaluate.js, results/
docs/          uml/, TESTING.md
tests/         jest + supertest suites
data/          Womens_Clothing_E-Commerce_Reviews.csv (gitignored)
```

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

## Known limitations

Filled in at Milestone 5.
