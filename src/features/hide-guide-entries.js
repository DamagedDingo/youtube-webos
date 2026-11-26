// The left-hand guide's entries, hidden in the DOM rather than in the response.
//
// The response filter (features/adblock/nav-filters.js) only reaches the guide
// when YouTube hands it over as JSON this script can intercept; on webOS 25 the
// guide arrives already rendered, so Shorts, News, Sport and Movies & TV stay in
// the rail. This marks the rendered entries and keeps marking them while the
// guide re-renders (a launch, a sign-in, a tab change).
//
// Marked, not removed: the rail is a virtualised list, and taking nodes out of it
// makes YouTube re-render the wrong ones — on the C2 the expanded rail lost its
// Settings entry while the collapsed rail still showed the entries that had been
// removed. A CSS rule hides the marked entries in both rails, and an entry that
// stops matching gets its mark taken off again.
import { configRead, configAddChangeListener } from '../core/config.js';
import { createLogger } from '../core/log.js';

const log = createLogger('Guide');

const ENTRY_SELECTOR = 'ytlr-guide-entry-renderer';
/** Set on an entry the filter hides; ui/styles/global.css turns it into display:none. */
const HIDDEN_ATTR = 'data-ytaf-guide-hidden';
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
 * An entry's name: the aria-label, which is where the icon-only rail keeps it, or
 * the rendered text when there is no label.
 */
function entryTitle(entry) {
  const label = entry.getAttribute('aria-label');
  if (label && label.trim()) return label.trim().toLowerCase();
  return (entry.textContent || '').trim().toLowerCase();
}

/**
 * Marks the named guide entries, and unmarks the ones that no longer match, so a
 * changed list or a switched-off filter puts them back. Nothing is removed: see
 * the note at the top of the file.
 */
function prune() {
  // The whole group is a cosmetic filter: it does nothing while Ad Blocking is off.
  const titles = configRead('enableAdBlock') ? hiddenTitles() : new Set();

  let marked = 0;
  for (const entry of document.querySelectorAll(ENTRY_SELECTOR)) {
    const hide = titles.has(entryTitle(entry));
    const isMarked = entry.hasAttribute(HIDDEN_ATTR);
    if (hide && !isMarked) {
      entry.setAttribute(HIDDEN_ATTR, '');
      marked++;
    } else if (!hide && isMarked) {
      entry.removeAttribute(HIDDEN_ATTR);
    }
  }
  if (marked) log.info(`Hid ${marked} guide entr(ies)`);
}

/** Runs `prune` once per tick, however many mutations arrive. */
function createScheduler() {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      try {
        prune();
      } catch (e) {
        log.warn('Guide prune failed', e);
      }
    }, 0);
  };
}

/**
 * Whether a mutation record adds a guide entry, directly or inside a subtree
 * that was just rendered in. Every other DOM change on the page is none of
 * this module's business: answering yes to all of them puts a prune on every
 * frame the app draws, which starves the features that do work per frame.
 */
function addsGuideEntry(record) {
  for (const node of record.addedNodes) {
    if (node.nodeType !== 1) continue;
    if (node.matches?.(ENTRY_SELECTOR) || node.querySelector?.(ENTRY_SELECTOR)) return true;
  }
  return false;
}

/**
 * Starts hiding the named guide entries and keeps hiding them: the guide is
 * rebuilt on launch, sign-in and tab changes, and each rebuild brings the entries
 * back unmarked.
 */
export function initHideGuideEntries() {
  if (typeof document === 'undefined' || !document.body) return;
  const schedule = createScheduler();

  schedule();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (addsGuideEntry(record)) {
        schedule();
        return;
      }
    }
  });
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
