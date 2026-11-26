// The left-hand guide's entries, hidden in the DOM rather than in the response.
//
// The response filter (features/adblock/nav-filters.js) only reaches the guide
// when YouTube hands it over as JSON this script can intercept; on webOS 25 the
// guide arrives already rendered, so Shorts, News, Sport and Movies & TV stay in
// the rail. This walks the rendered entries and takes the named ones out, and
// keeps doing so while the guide re-renders (a launch, a sign-in, a tab change).
import { configRead, configAddChangeListener } from '../core/config.js';
import { createLogger } from '../core/log.js';

const log = createLogger('Guide');

const ENTRY_SELECTOR = 'ytlr-guide-entry-renderer';
const SHORTS_TITLE = 'shorts';

/** The lower-cased titles the user asked to hide: the list, plus Shorts while that is hidden. */
function hiddenTitles() {
  const titles = new Set();
  if (configRead('removeGlobalShorts')) titles.add(SHORTS_TITLE);
  if (configRead('hideGuideEntries')) {
    const list = configRead('hideGuideTitles');
    if (typeof list === 'string') {
      for (const title of list.split(',')) {
        const trimmed = title.trim().toLowerCase();
        if (trimmed) titles.add(trimmed);
      }
    }
  }
  return titles;
}

/**
 * Takes the named guide entries out of the rail. The label is the entry's
 * aria-label: the rail is icon-only, so that is where its name lives.
 */
function prune() {
  // The whole group is a cosmetic filter: it does nothing while Ad Blocking is off.
  if (!configRead('enableAdBlock')) return;
  const titles = hiddenTitles();
  if (titles.size === 0) return;

  let removed = 0;
  for (const entry of document.querySelectorAll(ENTRY_SELECTOR)) {
    const label = (entry.getAttribute('aria-label') || '').trim().toLowerCase();
    if (!label || !titles.has(label)) continue;
    entry.remove();
    removed++;
  }
  if (removed) log.info(`Removed ${removed} guide entr(ies)`);
}

/** Runs `prune` once per animation frame, however many mutations arrive. */
function createScheduler() {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      try {
        prune();
      } catch (e) {
        log.warn('Guide prune failed', e);
      }
    });
  };
}

/**
 * Starts hiding the named guide entries and keeps hiding them: the guide is
 * rebuilt on launch, sign-in and tab changes, and each rebuild brings the
 * entries back.
 */
export function initHideGuideEntries() {
  if (typeof document === 'undefined' || !document.body) return;
  const schedule = createScheduler();

  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });

  for (const key of [
    'enableAdBlock',
    'removeGlobalShorts',
    'hideGuideEntries',
    'hideGuideTitles'
  ]) {
    configAddChangeListener(key, schedule);
  }
}
