// String tables shared by the adblock modules.

// TELEMETRY_REGEX is derived from this list. '/api/stats/watchtime' and
// '/api/stats/playback' are deliberately absent: they register the view against
// the creator and leak nothing the player has not already sent.
const BLOCKED_TELEMETRY_PATHS = [
  '/youtubei/v1/log_event',
  '/ptracking',
  '/api/stats/atr',
  '/api/stats/qoe',
  '/pagead/',
  '/eligibility_check'
];

export const TELEMETRY_REGEX = new RegExp(
  BLOCKED_TELEMETRY_PATHS.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
);

export const UI_STRINGS = {
  SHORTS_TITLE: 'Shorts',
  TOP_LIVE_GAMES_TITLE: 'Top live games',
  MOST_RELEVANT_TITLE: 'Most relevant',
  GUEST_PROMPT_TEXT: 'Sign in for better recommendations',
  // A shelf whose title matches this is a news shelf: 'News', 'Breaking news',
  // 'Live news'. Localised titles will not match.
  NEWS_SHELF_TITLE_PATTERN: /\bnews\b/i,
  // A tile given the members-only (or members-first) badge: the text sits in a
  // badge or overlay, so only those keys are matched (a video whose title talks
  // about memberships must stay).
  MEMBERS_BADGE_PATTERN: /members?[ -]?(only|first)/i
};

export const YT_CONSTANTS = {
  SHELF_TYPE_SHORTS: 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS',
  TILE_STYLE_SHORTS: 'TILE_STYLE_YTLR_SHORTS',
  BADGE_STYLE_LIVE: 'THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE',
  TIME_STATUS_STYLE_LIVE: 'LIVE',
  TIME_STATUS_STYLE_LIVE_LONG: 'THUMBNAIL_OVERLAY_TIME_STATUS_RENDERER_STYLE_LIVE',
  CONTENT_TYPE_LIVE: 'TILE_CONTENT_TYPE_LIVE',
  CONTENT_TYPE_SHORTS: 'TILE_CONTENT_TYPE_SHORTS',
  VIDEO_TYPE_REEL_AD: 'REEL_VIDEO_TYPE_AD'
};

export const CONFIG_KEYS = {
  ADBLOCK: 'enableAdBlock',
  TRACKING: 'enableTrackingBlock',
  SHORTS: 'removeGlobalShorts',
  LIVE: 'removeLiveVideos',
  LIVE_GAMES: 'removeTopLiveGames',
  MOST_RELEVANT: 'removeMostRelevant',
  NEWS: 'removeNewsShelves',
  GUIDE: 'hideGuideEntries',
  GUIDE_TITLES: 'hideGuideTitles',
  MEMBERS: 'hideMembersOnly',
  GUEST_PROMPTS: 'hideGuestSignInPrompts',
  EMOJI_FIX: 'enableLegacyEmojiFix',
  ENDCARDS: 'hideEndcards',
  THUMBNAILS: 'upgradeThumbnails',
  ROWS_AHEAD: 'enableRowsAhead',
  DEARROW: 'enableDeArrow'
};

// Response types left untouched (no filtering, text fixes, thumbnails or nav
// entries) while a Short is playing.
export const IGNORE_ON_SHORTS = new Set(['SEARCH', 'PLAYER', 'ACTION']);
