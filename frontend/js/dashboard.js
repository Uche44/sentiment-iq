(function () {
  'use strict';

  const REFRESH_MS = 30000;
  const REVIEW_LIMIT = 20;
  const EXCERPT_LENGTH = 220;
  const VIEWS = ['overview', 'reviews', 'complaints', 'products', 'feedback'];
  const DEFAULT_VIEW = 'overview';

  const state = {
    interval: 'week',
    view: null,
    loaded: Object.create(null),
    angryCount: 0,
  };

  let reviewsFeed = null;
  let angryFeed = null;
  let booted = false;

  const FIELD_INPUTS = {
    productName: 'product-name',
    customerName: 'customer-name',
    reviewText: 'review-text',
  };

  function el(id) {
    return document.getElementById(id);
  }

  function showError(id, message) {
    const node = el(id);
    if (!node) return;
    if (message) {
      node.textContent = message;
      node.hidden = false;
    } else {
      node.textContent = '';
      node.hidden = true;
    }
  }

  function setBusy(id, busy) {
    const node = el(id);
    if (node) node.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function friendly(error) {
    if (error.status === 401) {
      window.location.assign('/login');
      return 'Session expired';
    }
    return error.message || 'Something went wrong';
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function percent(part, total) {
    return total > 0 ? (part / total) * 100 : 0;
  }

  function formatPercent(value) {
    return value.toFixed(1) + '%';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function emojiFor(label) {
    if (label === 'Happy') return '😊';
    if (label === 'Angry') return '😠';
    return '😐';
  }

  function isoDate(date) {
    const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return copy.toISOString().slice(0, 10);
  }

  function markRefreshed() {
    const note = el('refresh-note');
    if (!note) return;
    const time = new Date().toLocaleTimeString();
    note.textContent = 'Last refreshed ' + time + ' • auto-updates every 30 seconds';
  }

  function invalidateViews(names) {
    names.forEach(function (name) {
      delete state.loaded[name];
    });
  }

  /* ---------- summary ---------- */

  function updateNavCounts(summary) {
    const reviews = document.querySelector('[data-nav-count="reviews"]');
    const complaints = document.querySelector('[data-nav-count="complaints"]');
    if (reviews) reviews.textContent = formatNumber(summary.total);
    if (complaints) complaints.textContent = formatNumber(summary.angry);
  }

  async function loadSummary() {
    setBusy('summary-panel', true);
    showError('summary-error', '');
    try {
      const summary = await window.API.get('/api/stats/summary');
      const total = summary.total || 0;
      state.angryCount = summary.angry || 0;

      el('total-reviews').textContent = formatNumber(total);
      el('total-sub').textContent =
        formatNumber(summary.processed) +
        ' analysed • ' +
        formatNumber(summary.pending) +
        ' pending';

      el('happy-count').textContent = formatNumber(summary.happy);
      el('angry-count').textContent = formatNumber(summary.angry);
      el('neutral-count').textContent = formatNumber(summary.neutral);
      el('pending-count').textContent = formatNumber(summary.pending);

      el('happy-pct').textContent = formatPercent(percent(summary.happy, total));
      el('angry-pct').textContent = formatPercent(percent(summary.angry, total));
      el('neutral-pct').textContent = formatPercent(percent(summary.neutral, total));
      el('pending-state').textContent = (summary.pending || 0) > 0 ? 'Working' : 'Idle';

      updateNavCounts(summary);
      markRefreshed();
    } catch (error) {
      showError('summary-error', friendly(error));
    } finally {
      setBusy('summary-panel', false);
    }
  }

  /* ---------- distribution ---------- */

  const SPLIT_ROWS = [
    { key: 'Happy', label: 'Happy customers' },
    { key: 'Neutral', label: 'Neutral feedback' },
    { key: 'Angry', label: 'Angry & returned' },
  ];

  function renderSplitLegend(distribution) {
    const list = el('split-legend');
    list.textContent = '';

    SPLIT_ROWS.forEach(function (row) {
      const item = document.createElement('li');
      item.className = 'split-legend__row';

      const face = document.createElement('span');
      face.className = 'face face--' + row.key.toLowerCase();
      face.textContent = emojiFor(row.key);
      face.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'split-legend__label';
      label.textContent = row.label;

      const count = document.createElement('span');
      count.className = 'split-legend__count';
      count.textContent = formatNumber(distribution[row.key]);

      const pct = document.createElement('span');
      pct.className = 'split-legend__pct';
      pct.textContent = formatPercent(percent(distribution[row.key], distribution.total));

      item.append(face, label, count, pct);
      list.append(item);
    });
  }

  async function loadDistribution() {
    setBusy('distribution-panel', true);
    showError('distribution-error', '');
    try {
      const distribution = await window.API.get('/api/stats/distribution');
      window.Charts.renderDistribution(el('distribution-chart'), distribution);
      el('dist-total').textContent = formatNumber(distribution.total);
      el('dist-center-total').textContent = formatNumber(distribution.total);
      renderSplitLegend(distribution);
    } catch (error) {
      showError('distribution-error', friendly(error));
    } finally {
      setBusy('distribution-panel', false);
    }
  }

  /* ---------- trend ---------- */

  async function loadTrend() {
    setBusy('trend-panel', true);
    showError('trend-error', '');

    const from = el('trend-from').value;
    const to = el('trend-to').value;

    if (from && to && from > to) {
      showError('trend-error', 'The “from” date must be before the “to” date.');
      setBusy('trend-panel', false);
      return;
    }

    const params = new URLSearchParams({ interval: state.interval });
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
      const data = await window.API.get('/api/stats/trend?' + params.toString());
      window.Charts.renderTrend(el('trend-chart'), data.points, data.interval);
    } catch (error) {
      showError('trend-error', friendly(error));
    } finally {
      setBusy('trend-panel', false);
    }
  }

  /* ---------- keywords ---------- */

  function renderKeywords(items) {
    const list = el('keyword-list');
    list.textContent = '';

    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'review-empty';
      empty.textContent = 'No angry reviews yet — the shop floor is calm.';
      list.append(empty);
      return;
    }

    const max = items[0].count || 1;
    items.forEach(function (item, index) {
      const row = document.createElement('li');
      row.className = 'keyword-row';

      const bar = document.createElement('span');
      bar.className = 'keyword-row__bar';
      bar.style.width = Math.max(6, (item.count / max) * 100).toFixed(1) + '%';
      bar.setAttribute('aria-hidden', 'true');

      const rank = document.createElement('span');
      rank.className = 'keyword-row__rank';
      rank.textContent = String(index + 1).padStart(2, '0');

      const word = document.createElement('span');
      word.className = 'keyword-row__word';
      word.textContent = item.word;

      const count = document.createElement('span');
      count.className = 'keyword-row__count';
      count.textContent = formatNumber(item.count);

      row.append(bar, rank, word, count);
      list.append(row);
    });
  }

  async function loadKeywords() {
    setBusy('keywords-panel', true);
    showError('keywords-error', '');
    try {
      const items = await window.API.get('/api/stats/keywords?limit=8');
      renderKeywords(items);
      const note = el('keywords-note');
      note.textContent =
        state.angryCount > 0
          ? 'Matching ' + formatNumber(state.angryCount) + ' angry reviews'
          : 'Top complaint keywords from angry reviews';
    } catch (error) {
      showError('keywords-error', friendly(error));
    } finally {
      setBusy('keywords-panel', false);
    }
  }

  /* ---------- product leaderboard ---------- */

  function renderShareBar(share) {
    const wrap = document.createElement('span');
    wrap.className = 'share-bar';

    const track = document.createElement('span');
    track.className = 'share-bar__track';
    track.setAttribute('aria-hidden', 'true');

    const fill = document.createElement('span');
    fill.className = 'share-bar__fill';
    fill.style.width = (share * 100).toFixed(1) + '%';
    track.append(fill);

    const value = document.createElement('span');
    value.className = 'share-bar__value';
    value.textContent = (share * 100).toFixed(1) + '%';

    wrap.append(track, value);
    return wrap;
  }

  function renderProductRows(items) {
    const body = el('product-rows');
    body.textContent = '';

    if (!items.length) {
      const row = document.createElement('tr');
      row.className = 'leaderboard__empty';
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = 'No product has five classified reviews yet.';
      row.append(cell);
      body.append(row);
      return;
    }

    items.forEach(function (item, index) {
      const row = document.createElement('tr');

      const rank = document.createElement('td');
      rank.className = 'leaderboard__rank';
      rank.textContent = String(index + 1).padStart(2, '0');

      const productCell = document.createElement('td');
      const product = document.createElement('div');
      product.className = 'leaderboard__product';

      const name = document.createElement('span');
      name.className = 'leaderboard__name';
      name.textContent = item.productName;

      const category = document.createElement('span');
      category.className = 'leaderboard__category';
      category.textContent =
        (item.category || 'Uncategorised') + ' · ' + formatNumber(item.total) + ' verdicts';

      product.append(name, category);
      productCell.append(product);

      const shareCell = document.createElement('td');
      shareCell.append(renderShareBar(item.angryShare));

      const angry = document.createElement('td');
      angry.className = 'leaderboard__angry';
      angry.textContent = formatNumber(item.angry);

      row.append(rank, productCell, shareCell, angry);
      body.append(row);
    });
  }

  async function loadProducts() {
    setBusy('products-panel', true);
    showError('products-error', '');
    try {
      const items = await window.API.get('/api/stats/products?limit=10');
      renderProductRows(items);

      const status = el('products-status');
      status.textContent = items.length
        ? 'Top ' + items.length + ' products by angry share'
        : 'No products meet the minimum sample';
    } catch (error) {
      showError('products-error', friendly(error));
    } finally {
      setBusy('products-panel', false);
    }
  }

  /* ---------- reviews ---------- */

  function renderReview(item) {
    const template = el('review-template');
    const node = template.content.firstElementChild.cloneNode(true);
    const label = item.sentimentLabel || 'Neutral';

    const badge = node.querySelector('.badge');
    badge.classList.add('badge--' + label);
    badge.textContent =
      emojiFor(label) + ' ' + label + ' · ' + Math.round((item.confidenceScore || 0) * 100) + '%';

    node.querySelector('.review__date').textContent = formatDate(item.dateSubmitted);

    const meta = node.querySelector('.review__meta');
    const product = document.createElement('strong');
    product.textContent = item.productName;
    meta.append(product);
    meta.append(
      document.createTextNode(
        ' · ' + (item.category || 'Uncategorised') + ' · ' + (item.customerName || 'Anonymous')
      )
    );

    const textNode = node.querySelector('.review__text');
    const fullText = item.reviewText || '';
    const toggle = node.querySelector('.review__toggle');

    if (fullText.length > EXCERPT_LENGTH) {
      const excerpt = fullText.slice(0, EXCERPT_LENGTH).trimEnd() + '…';
      textNode.textContent = excerpt;
      toggle.hidden = false;
      let expanded = false;
      toggle.addEventListener('click', function () {
        expanded = !expanded;
        textNode.textContent = expanded ? fullText : excerpt;
        toggle.textContent = expanded ? 'Show less' : 'Read more';
      });
    } else {
      textNode.textContent = fullText;
    }

    return node;
  }

  function updateFeedStatus(id, shown, total) {
    const node = el(id);
    if (!node) return;
    if (total === 0) {
      node.textContent = 'No verdicts yet';
      return;
    }
    node.textContent =
      'Showing ' + formatNumber(shown) + ' of ' + formatNumber(total) + ' verdicts';
  }

  function createReviewFeed(config) {
    const listNode = el(config.listId);
    const moreButton = el(config.moreId);
    const feed = { offset: 0, total: 0, filter: config.filter || '' };

    async function load(reset) {
      if (!listNode) return;
      if (reset) feed.offset = 0;

      showError(config.errorId, '');
      if (moreButton) moreButton.disabled = true;

      if (reset) {
        listNode.textContent = '';
        const loading = document.createElement('p');
        loading.className = 'loading-text';
        loading.textContent = 'Loading reviews…';
        listNode.append(loading);
      }

      const params = new URLSearchParams({
        limit: String(REVIEW_LIMIT),
        offset: String(feed.offset),
      });
      const sentiment = config.fixedFilter || feed.filter;
      if (sentiment) params.set('sentiment', sentiment);

      try {
        const data = await window.API.get('/api/reviews?' + params.toString());
        if (reset) listNode.textContent = '';

        const loading = listNode.querySelector('.loading-text');
        if (loading) loading.remove();

        feed.total = data.total;

        if (reset && data.items.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'review-empty';
          empty.textContent = config.emptyText || 'No reviews match this filter yet.';
          listNode.append(empty);
        }

        data.items.forEach(function (item) {
          listNode.append(renderReview(item));
        });

        feed.offset += data.items.length;
        if (moreButton) moreButton.hidden = feed.offset >= data.total;
        updateFeedStatus(config.statusId, feed.offset, data.total);
      } catch (error) {
        if (reset) listNode.textContent = '';
        showError(config.errorId, friendly(error));
        if (moreButton) moreButton.hidden = true;
      } finally {
        if (moreButton) moreButton.disabled = false;
      }
    }

    if (moreButton) {
      moreButton.addEventListener('click', function () {
        load(false);
      });
    }

    return {
      load: load,
      setFilter: function (value) {
        feed.filter = value;
        return load(true);
      },
      get offset() {
        return feed.offset;
      },
    };
  }

  /* ---------- product autocomplete ---------- */

  let productSearchTimer = null;
  let lastProductQuery = null;

  async function loadProductOptions(query) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    const suffix = params.toString() ? '?' + params.toString() : '';

    try {
      const products = await window.API.get('/api/products' + suffix);
      const list = el('product-options');
      list.textContent = '';
      products.forEach(function (product) {
        const option = document.createElement('option');
        option.value = product.productName;
        list.append(option);
      });
    } catch (error) {
      /* autocomplete is best-effort; ignore failures */
    }
  }

  function wireProductAutocomplete() {
    const input = el('product-name');
    if (!input) return;

    input.addEventListener('focus', function () {
      if (lastProductQuery === null) {
        lastProductQuery = '';
        loadProductOptions('');
      }
    });

    input.addEventListener('input', function () {
      const query = input.value.trim();
      if (query === lastProductQuery) return;
      lastProductQuery = query;
      clearTimeout(productSearchTimer);
      productSearchTimer = setTimeout(function () {
        loadProductOptions(query);
      }, 220);
    });
  }

  /* ---------- submit feedback form ---------- */

  function applyFieldErrors(fields) {
    Object.keys(FIELD_INPUTS).forEach(function (name) {
      const message = (fields && fields[name]) || '';
      const input = el(FIELD_INPUTS[name]);
      const errorNode = el(name + '-error');
      if (errorNode) errorNode.textContent = message;
      const field = input ? input.closest('.field') : null;
      if (field) field.classList.toggle('has-error', Boolean(message));
    });
  }

  function validateReview(payload) {
    const fields = {};
    if (!payload.productName) fields.productName = 'Product name is required';
    else if (payload.productName.length > 100)
      fields.productName = 'Product name must be 100 characters or fewer';

    if (!payload.customerName) fields.customerName = 'Customer name is required';
    else if (payload.customerName.length > 100)
      fields.customerName = 'Customer name must be 100 characters or fewer';

    if (!payload.reviewText) fields.reviewText = 'Review text is required';
    else if (payload.reviewText.length < 3)
      fields.reviewText = 'Review text must be at least 3 characters';
    else if (payload.reviewText.length > 5000)
      fields.reviewText = 'Review text must be 5000 characters or fewer';

    return fields;
  }

  function wireReviewForm() {
    const form = el('review-form');
    if (!form) return;

    const submitButton = el('review-submit');
    const pending = el('review-pending');
    const resultNode = el('review-result');
    const formError = el('review-form-error');

    Object.keys(FIELD_INPUTS).forEach(function (name) {
      const input = el(FIELD_INPUTS[name]);
      if (!input) return;
      input.addEventListener('input', function () {
        applyFieldErrors({});
      });
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      applyFieldErrors({});
      resultNode.textContent = '';
      formError.textContent = '';

      const payload = {
        productName: el('product-name').value.trim(),
        customerName: el('customer-name').value.trim(),
        reviewText: el('review-text').value.trim(),
      };

      const fields = validateReview(payload);
      applyFieldErrors(fields);
      if (Object.keys(fields).length > 0) return;

      submitButton.disabled = true;
      pending.hidden = false;

      try {
        const result = await window.API.post('/api/reviews', payload);
        const label = result.sentimentLabel || 'Neutral';
        const confidence = (result.confidenceScore || 0).toFixed(2);
        resultNode.textContent =
          'Classified as ' + label + ' ' + emojiFor(label) + ' (confidence ' + confidence + ')';

        form.reset();
        lastProductQuery = null;

        invalidateViews(['overview', 'reviews', 'complaints', 'products']);
        loadSummary();
      } catch (error) {
        if (error.body && error.body.fields) applyFieldErrors(error.body.fields);
        formError.textContent = (error.body && error.body.error) || friendly(error);
      } finally {
        submitButton.disabled = false;
        pending.hidden = true;
      }
    });
  }

  /* ---------- routing ---------- */

  function currentView() {
    const raw = window.location.hash.split('?')[0].replace(/^#\//, '');
    return VIEWS.indexOf(raw) === -1 ? null : raw;
  }

  function ensureViewData(view) {
    if (state.loaded[view]) return;
    state.loaded[view] = true;

    loadSummary();

    if (view === 'overview') {
      loadDistribution();
      loadTrend();
    } else if (view === 'reviews') {
      reviewsFeed.load(true);
    } else if (view === 'complaints') {
      loadKeywords();
      angryFeed.load(true);
    } else if (view === 'products') {
      loadProducts();
    }
  }

  function renderView(view) {
    const changed = state.view !== null && state.view !== view;
    state.view = view;

    document.querySelectorAll('[data-view]').forEach(function (section) {
      section.hidden = section.getAttribute('data-view') !== view;
    });

    document.querySelectorAll('[data-nav]').forEach(function (link) {
      if (link.getAttribute('data-nav') === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (view === 'overview') {
      window.requestAnimationFrame(function () {
        if (window.Charts) window.Charts.resizeAll();
      });
    }

    ensureViewData(view);

    if (booted && changed) {
      const heading = document.querySelector('[data-view="' + view + '"] .view-head__title');
      if (heading) heading.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  /* ---------- wiring ---------- */

  function initDateRange() {
    const to = new Date();
    const from = new Date(to.getTime() - 89 * 24 * 60 * 60 * 1000);
    el('trend-to').value = isoDate(to);
    el('trend-from').value = isoDate(from);
  }

  function wireEvents() {
    el('logout-button').addEventListener('click', async function () {
      try {
        await window.API.post('/api/auth/logout', {});
      } catch (error) {
        /* logging out locally is still correct */
      }
      window.location.assign('/login');
    });

    el('trend-from').addEventListener('change', loadTrend);
    el('trend-to').addEventListener('change', loadTrend);

    el('trend-interval').addEventListener('click', function (event) {
      const button = event.target.closest('button[data-interval]');
      if (!button) return;
      const interval = button.getAttribute('data-interval');
      if (interval === state.interval) return;
      state.interval = interval;
      el('trend-interval')
        .querySelectorAll('button')
        .forEach(function (candidate) {
          candidate.classList.toggle('is-active', candidate === button);
        });
      loadTrend();
    });

    el('review-filter').addEventListener('change', function (event) {
      reviewsFeed.setFilter(event.target.value);
    });

    wireProductAutocomplete();
    wireReviewForm();
  }

  function autoRefresh() {
    if (document.visibilityState === 'hidden') return;

    loadSummary();

    if (state.view === 'overview') {
      loadDistribution();
      loadTrend();
    } else if (state.view === 'reviews') {
      if (reviewsFeed.offset <= REVIEW_LIMIT) reviewsFeed.load(true);
    } else if (state.view === 'complaints') {
      loadKeywords();
      if (angryFeed.offset <= REVIEW_LIMIT) angryFeed.load(true);
    } else if (state.view === 'products') {
      loadProducts();
    }
  }

  async function boot() {
    let me;
    try {
      me = await window.API.get('/api/auth/me');
    } catch (error) {
      if (error.status === 401) {
        window.location.assign('/login');
        return;
      }
      showError('summary-error', friendly(error));
      return;
    }

    el('company-name').textContent = me.companyName;
    el('user-name').textContent = me.username;
    document.title = me.companyName + ' — Dashboard';

    const brandPill = el('brand-pill');
    if (brandPill && brandPill.textContent.trim() === me.companyName.trim()) {
      brandPill.hidden = true;
    }

    reviewsFeed = createReviewFeed({
      listId: 'review-list',
      moreId: 'load-more',
      statusId: 'reviews-status',
      errorId: 'reviews-error',
      emptyText: 'No reviews match this filter yet.',
    });

    angryFeed = createReviewFeed({
      listId: 'angry-list',
      moreId: 'angry-more',
      statusId: 'angry-status',
      errorId: 'angry-error',
      fixedFilter: 'Angry',
      emptyText: 'No angry reviews right now — the shop floor is calm.',
    });

    initDateRange();
    wireEvents();

    window.addEventListener('hashchange', function () {
      const view = currentView();
      if (view) renderView(view);
    });

    const initial = currentView() || DEFAULT_VIEW;
    if (window.location.hash !== '#/' + initial) {
      window.history.replaceState(null, '', '#/' + initial);
    }

    renderView(initial);
    booted = true;

    window.setInterval(autoRefresh, REFRESH_MS);
  }

  boot();
})();
