/**
 * Guide entries hidden in the DOM (features/hide-guide-entries.js) against the
 * built bundle. The response filter (adblock/nav-filters.js) only reaches a
 * guide fetched as JSON; on webOS 25 the rail arrives already rendered, so the
 * module marks the named entries with data-ytaf-guide-hidden, which
 * ui/styles/global.css turns into display:none, and keeps marking them as the
 * rail re-renders. Nothing is removed: the rail is a virtualised list, and a
 * removed entry comes back as a different one on the next render.
 *
 * The legacy build is the reason this suite exists. It runs on Chromium 38,
 * where a NodeList has no Symbol.iterator, so a for-of over `addedNodes` in the
 * MutationObserver callback threw `TypeError: Invalid attempt to iterate
 * non-iterable instance` on every mutation of every page - which only the
 * shared "no console.error or jsdomError" check caught, and only as a failure
 * of unrelated suites.
 *
 * Run: node tests/behaviour/guide-hide-test.cjs [bundle] [legacy|modern]
 */
const { createPage } = require('../harness/page.cjs');
const { createReport } = require('../harness/report.cjs');
const { wait, waitFor } = require('../harness/fixtures.cjs');

const report = createReport();
const t = report.check;

const ENTRY = 'ytlr-guide-entry-renderer';
const HIDDEN = 'data-ytaf-guide-hidden';
const CONFIG = {
  enableAdBlock: true,
  hideGuideEntries: true,
  hideGuideTitles: 'News, Sport, Movies & TV'
};

/** A browse page whose <ytlr-app> holds `inner`. */
const html = (inner) =>
  '<!doctype html><html><body class="WEB_PAGE_TYPE_BROWSE">' +
  `<ytlr-app>${inner}</ytlr-app></body></html>`;

/** A rail holding one entry per label, as document markup. */
const guideMarkup = (labels) =>
  '<ytlr-guide-renderer>' +
  labels
    .map((label) => `<ytlr-guide-entry-renderer aria-label="${label}"></ytlr-guide-entry-renderer>`)
    .join('') +
  '</ytlr-guide-renderer>';

/** The entries in the document, in order, as their labels. */
function labels(win) {
  const nodes = win.document.querySelectorAll(ENTRY);
  const out = [];
  for (let i = 0; i < nodes.length; i++) out.push(nodes[i].getAttribute('aria-label'));
  return out.join(',');
}

/** The entry labelled `label`, or null. */
function find(win, label) {
  const nodes = win.document.querySelectorAll(ENTRY);
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].getAttribute('aria-label') === label) return nodes[i];
  }
  return null;
}

/** Whether the entry labelled `label` carries the hide mark. */
function hidden(win, label) {
  const el = find(win, label);
  return !!el && el.hasAttribute(HIDDEN);
}

/** Every stylesheet the bundle put in the page, as one text with no spaces. */
const css = (win) =>
  Array.from(win.document.querySelectorAll('style'))
    .map((s) => s.textContent)
    .join('\n')
    .replace(/\s+/g, '');

(async () => {
  // ---- the entries already in the rail when the bundle starts ----
  {
    const { win } = createPage({
      html: html(guideMarkup(['Home', 'News', 'Sport', 'Movies & TV', 'Library'])),
      config: CONFIG
    });
    // The first prune runs on a timer, once the bundle has initialised.
    const marked = await waitFor(
      () => hidden(win, 'News') && hidden(win, 'Sport') && hidden(win, 'Movies & TV')
    );
    t('the named entries are marked on load', marked, labels(win));
    t(
      'the entries not named are left alone',
      !hidden(win, 'Home') && !hidden(win, 'Library'),
      labels(win)
    );
    t(
      'nothing is taken out of the rail',
      labels(win) === 'Home,News,Sport,Movies & TV,Library',
      labels(win)
    );
    t(
      'the stylesheet hides the mark, !important',
      /ytlr-guide-entry-renderer\[data-ytaf-guide-hidden\]\{display:none!important\}/.test(css(win))
    );
  }

  // ---- an entry rendered into a rail already on the page ----
  {
    const { win } = createPage({ html: html(guideMarkup(['Home'])), config: CONFIG });
    await wait(10);
    const sport = win.document.createElement(ENTRY);
    sport.setAttribute('aria-label', 'Sport');
    win.document.querySelector('ytlr-guide-renderer').appendChild(sport);
    t('an entry rendered in later is marked', await waitFor(() => hidden(win, 'Sport')));
    t('and the entries beside it are untouched', !hidden(win, 'Home'));
  }

  // ---- a whole rail rendered in, its entries built before it was attached ----
  {
    const { win } = createPage({ html: html(''), config: CONFIG });
    await wait(10);
    const fresh = win.document.createElement('ytlr-guide-renderer');
    for (const label of ['Home', 'News']) {
      const el = win.document.createElement(ENTRY);
      el.setAttribute('aria-label', label);
      fresh.appendChild(el);
    }
    win.document.querySelector('ytlr-app').appendChild(fresh);
    t(
      'a rail rendered in with its entries already inside is marked',
      await waitFor(() => hidden(win, 'News')),
      labels(win)
    );
    t('the entries it keeps are left alone', !hidden(win, 'Home'));
  }

  report.finish();
})();
