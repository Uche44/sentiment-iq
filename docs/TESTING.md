# Manual Usability Checklist

Use this after `npm start` for the usability evaluation (Chapter 4). Run on a
desktop viewport and at **360 px** wide.

## Setup

1. `npm start` and open http://localhost:3000 — you should be redirected to `/login`.
2. Sign in with the manager account from `.env` (`manager` / `ChangeMe123!` by default).

## Checklist

- [ ] **Login validation** — submitting with both fields empty shows inline errors under
      each field; the button is disabled while the request is in flight.
- [ ] **Bad credentials** — a wrong password shows "Invalid username or password"
      inline; the page does not navigate.
- [ ] **Successful login** — lands on `/dashboard`; the header shows the company name
      from `COMPANY_NAME` and the logged-in username.
- [ ] **Protected pages** — visiting `/dashboard` in a private window redirects to `/login`.
- [ ] **Section navigation** — the dashboard opens on Overview with the sidebar;
      Overview, Reviews, Complaints, Products and Feedback switch without a page reload,
      the URL carries the section (`#/reviews`), and reloading keeps it.
- [ ] **Summary cards** — total, Happy, Angry, Neutral show counts and percentages;
      the queue card shows idle vs working.
- [ ] **Distribution** — doughnut renders three segments with the legend rows and
      percentages; totals match the summary.
- [ ] **Trend chart** — default range is the last 90 days; changing `From`/`To` or the
      Day/Week/Month control re-renders the line **without a page reload**.
- [ ] **Trend validation** — a `From` date after `To` shows a friendly inline message.
- [ ] **Product leaderboard** — ranked by angry share, not raw count; each row shows the
      product, category with its verdict count, a share bar and the angry count; products
      with fewer than five classified reviews are excluded.
- [ ] **Negative keywords** — ranked list of words from Angry reviews with counts.
- [ ] **Angry review feed** — Complaints lists the newest Angry reviews; **Load more**
      appends older ones and disappears when exhausted.
- [ ] **Recent reviews** — long reviews are truncated with **Read more**; badges show
      label text, emoji and confidence %.
- [ ] **Filter** — choosing Happy / Angry / Neutral reloads only matching reviews.
- [ ] **Load more** — appends older reviews; the button disappears when exhausted.
- [ ] **Submit a positive review** — e.g. "I absolutely love this dress, it is beautiful!"
      shows "Classified as Happy 😊" inline and clears the form.
- [ ] **Submit a negative review** — e.g. "Terrible quality, complete waste of money."
      shows "Classified as Angry 😠"; Overview, Reviews, Complaints and Products pick up
      the new review the next time they are opened.
- [ ] **Form validation** — empty or too-short review text shows inline field errors;
      server field errors map to the same messages.
- [ ] **Product autocomplete** — typing in Product name suggests existing products from
      the database.
- [ ] **Auto-refresh** — the "Last refreshed" time advances every 30 seconds and only the
      visible section refetches.
- [ ] **Widget isolation** — stop the API (Ctrl-C) while the page is open; each widget
      shows its own friendly error and the others keep their last data.
- [ ] **360 px width** — no horizontal scrolling; the nav becomes a two-column grid; the
      leaderboard drops its rank column; cards stack; controls remain usable.
- [ ] **Logout** — returns to `/login`; back-button does not reveal the dashboard data.
