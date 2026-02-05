/**
 * Service Worker
 * Handles background tasks, message routing, and badge updates
 */

console.log('%c SERVICE WORKER v2.1 STARTED ', 'background: green; color: white; font-size: 20px;');
console.log('[SW] Version 2.1 - Whitelist enforcement enabled');

// ============== Whitelist State ==============
let whitelist = new Set();
const WHITELIST_KEY = 'crawlhqWhitelist';

// ============== Monitoring Preferences ==============
const CLEAR_ON_RELOAD_KEY = 'crawlhqClearOnReload';
// Default to true: start fresh on each reload/navigation while monitoring.
let clearOnReload = true;

// Track last-known URLs for tabs to make reload clearing reliable even when
// Chrome reports temporary/empty URLs during the early "loading" phase.
const lastKnownTabUrl = new Map(); // tabId -> sanitized http(s) url
const lastKnownTabWhitelisted = new Map(); // tabId -> boolean

// Track tabs currently being cleared to block incoming captures during clear
const tabsBeingCleared = new Set(); // tabId -> being cleared

// ============== Content Script Registration ==============
// Detector (MAIN world) + Bridge (ISOLATED world) should only run on whitelisted domains.
const MONITORING_SCRIPT_IDS = {
  detector: 'crawlhq-detector-main',
  bridge: 'crawlhq-bridge-isolated'
};

let monitoringScriptsSyncPromise = Promise.resolve();

function normalizeDomain(domain) {
  if (typeof domain !== 'string') return null;
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === 'unknown') return null;
  if (trimmed.includes('/')) return null;

  try {
    // Basic validation - hostname-only input expected.
    // This also normalizes punycode/international domains.
    const url = new URL(`https://${trimmed}/`);
    return url.hostname;
  } catch {
    return null;
  }
}

function tryParseHttpUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed;
    return null;
  } catch {
    return null;
  }
}

function sanitizeHttpUrl(url) {
  const parsed = tryParseHttpUrl(url);
  if (!parsed) return null;
  return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
}

function truncateString(value, maxLen = 300) {
  if (typeof value !== 'string') return '';
  if (value.length <= maxLen) return value;
  return value.slice(0, Math.max(0, maxLen - 1)) + '…';
}

function getUrlHostname(url) {
  const parsed = tryParseHttpUrl(url);
  return parsed ? parsed.hostname : null;
}

const HOSTED_PUBLIC_SUFFIXES = [
  // Common hosted/public suffixes where the registrable domain is 1 label deeper.
  'github.io',
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'web.app',
  'firebaseapp.com',
  'herokuapp.com'
];

const COMMON_SECOND_LEVEL_TLDS = new Set([
  // Common 2nd-level domains for ccTLDs (co.uk, com.au, etc.)
  'co',
  'com',
  'net',
  'org',
  'gov',
  'edu',
  'ac'
]);

function getSiteBase(hostname) {
  if (typeof hostname !== 'string') return null;
  const host = hostname.trim().toLowerCase();
  if (!host) return null;

  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 2) return host;

  // Hosted/public suffixes (e.g. user.github.io)
  for (const suffix of HOSTED_PUBLIC_SUFFIXES) {
    if (host === suffix) return host;
    if (host.endsWith(`.${suffix}`)) {
      const suffixLabelsCount = suffix.split('.').length;
      const needed = suffixLabelsCount + 1;
      if (labels.length >= needed) {
        return labels.slice(-needed).join('.');
      }
      return host;
    }
  }

  const last = labels[labels.length - 1];
  const secondLast = labels[labels.length - 2];

  // ccTLD with common second-level: example.co.uk, example.com.au, etc.
  if (last.length === 2 && COMMON_SECOND_LEVEL_TLDS.has(secondLast) && labels.length >= 3) {
    return labels.slice(-3).join('.');
  }

  // Default: last two labels (example.com)
  return labels.slice(-2).join('.');
}

function classifySourceKind(sourceUrl, sourceUrlSanitized, frameUrlSanitized, topLevelUrlSanitized) {
  if (typeof sourceUrl !== 'string' || !sourceUrl || sourceUrl === 'unknown') return 'unknown';
  if (sourceUrl.startsWith('blob:')) return 'blob';
  if (sourceUrl.startsWith('data:')) return 'data';
  if (sourceUrl.startsWith('javascript:')) return 'javascript';

  const parsed = tryParseHttpUrl(sourceUrl);
  if (!parsed) return 'other';

  // Heuristic: if callsite resolves to the page URL, it is likely an inline script.
  if (sourceUrlSanitized && (sourceUrlSanitized === frameUrlSanitized || sourceUrlSanitized === topLevelUrlSanitized)) {
    return 'inline';
  }

  return 'script';
}

function buildAttribution({ topLevelUrl, frameUrl, sourceUrl, frameId }) {
  const topLevelUrlSanitized = sanitizeHttpUrl(topLevelUrl);
  const frameUrlSanitized = sanitizeHttpUrl(frameUrl);

  // Only sanitize http(s) sources; for others, keep a short, safe snippet.
  const sourceUrlSanitized = sanitizeHttpUrl(sourceUrl);
  const safeSourceUrl = sourceUrlSanitized || (typeof sourceUrl === 'string' ? truncateString(sourceUrl, 220) : '');

  const topLevelDomain = getUrlHostname(topLevelUrlSanitized || topLevelUrl);
  const frameDomain = getUrlHostname(frameUrlSanitized || frameUrl);
  const sourceDomain = getUrlHostname(sourceUrlSanitized || sourceUrl);

  const topLevelSiteBase = topLevelDomain ? getSiteBase(topLevelDomain) : null;
  const sourceSiteBase = sourceDomain ? getSiteBase(sourceDomain) : null;

  const sourceKind = classifySourceKind(
    sourceUrl,
    sourceUrlSanitized,
    frameUrlSanitized,
    topLevelUrlSanitized
  );

  const isTopFrame = typeof frameId === 'number' ? frameId === 0 : true;
  const isThirdParty = Boolean(
    topLevelSiteBase &&
    sourceSiteBase &&
    topLevelSiteBase !== sourceSiteBase &&
    sourceKind !== 'inline'
  );

  return {
    topLevelDomain: topLevelDomain || '',
    topLevelSiteBase: topLevelSiteBase || '',
    topLevelUrlSanitized: topLevelUrlSanitized || '',
    frameDomain: frameDomain || '',
    frameUrlSanitized: frameUrlSanitized || '',
    sourceDomain: sourceDomain || '',
    sourceSiteBase: sourceSiteBase || '',
    sourceUrlSanitized: safeSourceUrl || '',
    sourceKind,
    isThirdParty,
    isTopFrame,
    isInIframe: !isTopFrame
  };
}

function rememberTabContext(tabId, url) {
  if (typeof tabId !== 'number') return;
  const sanitized = sanitizeHttpUrl(url);
  if (!sanitized) return;

  lastKnownTabUrl.set(tabId, sanitized);
  try {
    lastKnownTabWhitelisted.set(tabId, isWhitelisted(sanitized));
  } catch {
    lastKnownTabWhitelisted.set(tabId, false);
  }
}

async function getBestTabUrl(tabId, tab) {
  let url = tab?.pendingUrl || tab?.url;
  if (!url) {
    try {
      const fresh = await chrome.tabs.get(tabId);
      url = fresh?.pendingUrl || fresh?.url;
    } catch {}
  }
  return url || lastKnownTabUrl.get(tabId) || null;
}

function getWhitelistMatchPatterns() {
  const patterns = new Set();
  for (const domain of whitelist) {
    const normalized = normalizeDomain(domain);
    if (!normalized) continue;
    patterns.add(`*://${normalized}/*`);
  }
  return Array.from(patterns);
}

async function injectMonitoringScriptsIntoTab(tabId) {
  try {
    // Inject bridge (ISOLATED world) first so it's ready to forward messages
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/content-script.js'],
      world: 'ISOLATED'
    });

    // Inject detector (MAIN world)
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/inject/detector.js'],
      world: 'MAIN'
    });

    console.log('[SW] Injected monitoring scripts into tab:', tabId);
    return { injected: true };
  } catch (e) {
    console.warn('[SW] Failed to inject into tab:', tabId, e?.message || e);
    return { injected: false, error: e?.message || String(e) };
  }
}

async function syncMonitoringContentScripts(reason) {
  const matches = getWhitelistMatchPatterns();
  const shouldRegister = matches.length > 0;

  // Always attempt to unregister ALL dynamically registered scripts first.
  // This avoids stale registrations from previous versions causing global injection.
  try {
    await chrome.scripting.unregisterContentScripts();
    console.log('[SW] Unregistered all dynamic content scripts');
  } catch (e) {
    // Ignore "not found" errors - scripts may not be registered yet.
    console.debug('[SW] unregisterContentScripts (ignored):', e?.message || e);
  }

  if (!shouldRegister) {
    console.log('[SW] Monitoring scripts not registered:', {
      reason,
      whitelistSize: whitelist.size,
      matches: matches.length
    });
    return { registered: false, matchesCount: matches.length };
  }

  try {
    // Register bridge first so it is ready to forward messages as early as possible.
    await chrome.scripting.registerContentScripts([
      {
        id: MONITORING_SCRIPT_IDS.bridge,
        js: ['src/content/content-script.js'],
        matches,
        runAt: 'document_start',
        allFrames: true,
        world: 'ISOLATED',
        persistAcrossSessions: true
      },
      {
        id: MONITORING_SCRIPT_IDS.detector,
        js: ['src/inject/detector.js'],
        matches,
        runAt: 'document_start',
        allFrames: true,
        world: 'MAIN',
        persistAcrossSessions: true
      }
    ]);

    console.log('[SW] Registered monitoring scripts:', {
      reason,
      matchesCount: matches.length,
      whitelistSize: whitelist.size
    });

    return { registered: true, matchesCount: matches.length };
  } catch (e) {
    console.error('[SW] Failed to register monitoring scripts:', e);
    return { registered: false, matchesCount: matches.length, error: e?.message || String(e) };
  }
}

function requestMonitoringScriptsSync(reason) {
  monitoringScriptsSyncPromise = monitoringScriptsSyncPromise
    .catch(() => undefined)
    .then(() => syncMonitoringContentScripts(reason));
  return monitoringScriptsSyncPromise;
}

async function loadWhitelist() {
  try {
    const result = await chrome.storage.local.get([WHITELIST_KEY]);
    const domains = result[WHITELIST_KEY] || [];

    const normalizedDomains = Array.isArray(domains)
      ? domains.map(normalizeDomain).filter(Boolean)
      : [];

    const normalizedSet = new Set(normalizedDomains);
    whitelist = normalizedSet;

    // If the stored whitelist contained invalid/un-normalized entries, clean it up.
    if (Array.isArray(domains) && normalizedSet.size !== domains.length) {
      await saveWhitelist();
      console.log('[SW] Cleaned up whitelist entries:', {
        before: domains.length,
        after: normalizedSet.size
      });
    }

    console.log('[SW] Loaded whitelist:', whitelist.size, 'domains');
  } catch (e) {
    console.error('[SW] Failed to load whitelist:', e);
    whitelist = new Set();
  }
}

async function loadClearOnReloadSetting() {
  try {
    const result = await chrome.storage.local.get([CLEAR_ON_RELOAD_KEY]);
    if (typeof result?.[CLEAR_ON_RELOAD_KEY] === 'boolean') {
      clearOnReload = result[CLEAR_ON_RELOAD_KEY] === true;
    } else {
      // Persist the default once so UIs can read a stable value.
      await chrome.storage.local.set({ [CLEAR_ON_RELOAD_KEY]: clearOnReload });
    }
    console.log('[SW] Loaded clearOnReload:', clearOnReload);
  } catch (e) {
    console.error('[SW] Failed to load clearOnReload setting:', e);
    clearOnReload = true;
  }
}

async function saveWhitelist() {
  try {
    await chrome.storage.local.set({ [WHITELIST_KEY]: Array.from(whitelist) });
    console.log('[SW] Saved whitelist:', whitelist.size, 'domains');
  } catch (e) {
    console.error('[SW] Failed to save whitelist:', e);
  }
}

async function addToWhitelist(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    console.warn('[SW] Refusing to whitelist invalid domain:', domain);
    return { success: false, error: 'Invalid domain' };
  }

  whitelist.add(normalized);
  await saveWhitelist();

  const syncResult = await requestMonitoringScriptsSync('whitelist-add');
  await clearBadgesForUnmonitoredTabs('whitelist-add');

  console.log('[SW] Added to whitelist:', normalized, 'registration:', syncResult);
  return {
    success: true,
    domain: normalized,
    registered: syncResult?.registered ?? false
  };
}

async function removeFromWhitelist(domain) {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    console.warn('[SW] Refusing to unwhitelist invalid domain:', domain);
    return { success: false, error: 'Invalid domain' };
  }

  whitelist.delete(normalized);
  await saveWhitelist();
  await requestMonitoringScriptsSync('whitelist-remove');
  await clearBadgesForUnmonitoredTabs('whitelist-remove');
  console.log('[SW] Removed from whitelist:', normalized);
  return { success: true, domain: normalized };
}

function isWhitelisted(url) {
  try {
    const urlObj = new URL(url);
    return whitelist.has(urlObj.hostname);
  } catch {
    return false;
  }
}

// ============== Pause State ==============
let isPaused = false;
const MAX_BUFFER_SIZE = 100;
let captureBuffer = [];

async function loadPauseState() {
  try {
    const result = await chrome.storage.local.get(['canvasLoggerPaused']);
    isPaused = result.canvasLoggerPaused === true;
    console.log('[SW] Loaded pause state:', isPaused);
  } catch (e) {
    console.error('[SW] Failed to load pause state:', e);
    isPaused = false;
  }
}

async function setPauseState(paused) {
  isPaused = paused;
  await chrome.storage.local.set({ canvasLoggerPaused: paused });
  console.log('[SW] Pause state set to:', paused);

  // If unpausing, flush the buffer
  if (!paused && captureBuffer.length > 0) {
    console.log('[SW] Unpausing, flushing', captureBuffer.length, 'buffered captures');
    await flushCaptureBuffer();
  }

  // Keep DevTools panels in sync if pause is toggled elsewhere (e.g. popup).
  notifyAllPanels({
    type: 'PAUSE_STATE',
    paused: isPaused,
    bufferedCount: captureBuffer.length
  });
}

async function flushCaptureBuffer() {
  if (captureBuffer.length === 0) return { flushedCount: 0 };

  const bufferedCaptures = [...captureBuffer];
  captureBuffer = [];

  // Store all buffered captures
  for (const capture of bufferedCaptures) {
    try {
      await storage.addCapture(capture);
      if (capture.tabId) {
        await updateBadge(capture.tabId);
      }
      notifyDevTools(capture);
    } catch (e) {
      console.error('[SW] Failed to store buffered capture:', e);
    }
  }

  // Notify panels about the flush
  notifyAllPanels({
    type: 'BUFFER_FLUSHED',
    count: bufferedCaptures.length
  });

  return { flushedCount: bufferedCaptures.length };
}

function notifyAllPanels(message) {
  for (const port of devToolsPorts.values()) {
    try {
      port.postMessage(message);
    } catch (e) {
      console.debug('[SW] Failed to notify panel:', e.message);
    }
  }
}

// ============== Initialization ==============
let initializationComplete = false;
let initPromise = null;

async function initialize() {
  try {
    await loadPauseState();
    await loadClearOnReloadSetting();
    await loadWhitelist();
    await requestMonitoringScriptsSync('init');
    await clearBadgesForUnmonitoredTabs('init');
    initializationComplete = true;
    console.log('[SW] Initialization complete - whitelist has', whitelist.size, 'domains');
  } catch (e) {
    console.error('[SW] Initialization failed:', e);
    initializationComplete = true; // Still mark complete to prevent deadlock
  }
}

// Start initialization immediately
initPromise = initialize();

// Keep background state in sync if popup updates storage directly.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (!changes) return;

  (async () => {
    // Ensure base initialization is done first.
    if (initPromise) {
      try {
        await initPromise;
      } catch {}
    }

    if (changes[WHITELIST_KEY]) {
      await loadWhitelist();
      await requestMonitoringScriptsSync('storage-whitelist-change');
      await clearBadgesForUnmonitoredTabs('storage-whitelist-change');
    }

    if (changes[CLEAR_ON_RELOAD_KEY]) {
      const next = changes[CLEAR_ON_RELOAD_KEY]?.newValue;
      if (typeof next === 'boolean') {
        clearOnReload = next === true;
        console.log('[SW] clearOnReload updated via storage:', clearOnReload);
      }
    }
  })().catch((e) => {
    console.error('[SW] Failed to handle storage change:', e);
  });
});

// ============== Deduplicator (inlined for service worker) ==============
// Multi-level deduplication for fingerprint captures

class Deduplicator {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 1000;
    this.sameMethodMinGapMs = options.sameMethodMinGapMs || 50;
    this.recentSignatures = new Map();
    this.recentIds = new Set();
    this.cleanupInterval = setInterval(() => this.cleanup(), 5000);
    this.DEBUG = false;
  }

  generateSignature(capture) {
    const parts = [
      capture.category || 'canvas',
      capture.method,
      capture.source?.url || '',
      capture.source?.line || 0
    ];
    if (capture.method === 'getParameter' && capture.data?.parameterCode) {
      parts.push(capture.data.parameterCode);
    }
    if (capture.method === 'measureText' && capture.arguments?.text) {
      parts.push(capture.arguments.text.substring(0, 50));
    }
    if (capture.data?.property) {
      parts.push(capture.data.property);
    }
    return parts.join('|');
  }

  isDuplicate(capture) {
    const now = Date.now();
    if (this.recentIds.has(capture.id)) {
      return { isDuplicate: true, reason: 'duplicate_id' };
    }
    const signature = this.generateSignature(capture);
    const lastSeen = this.recentSignatures.get(signature);
    if (lastSeen) {
      const timeSince = now - lastSeen;
      if (timeSince < this.sameMethodMinGapMs) {
        return { isDuplicate: true, reason: 'too_fast' };
      }
    }
    this.recentIds.add(capture.id);
    this.recentSignatures.set(signature, now);
    return { isDuplicate: false };
  }

  cleanup() {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    for (const [sig, timestamp] of this.recentSignatures.entries()) {
      if (timestamp < cutoff) {
        this.recentSignatures.delete(sig);
      }
    }
    if (this.recentIds.size > 1000) {
      const ids = Array.from(this.recentIds);
      this.recentIds.clear();
      ids.slice(-500).forEach(id => this.recentIds.add(id));
    }
  }

  clear() {
    this.recentSignatures.clear();
    this.recentIds.clear();
  }
}

// Global deduplicator instance
const deduplicator = new Deduplicator({
  windowMs: 1000,
  sameMethodMinGapMs: 50
});

// ============== Storage Manager (inlined to avoid module issues) ==============

const STORAGE_KEY = 'canvasCaptures';
const MAX_CAPTURES_PER_TAB = 100;
const MAX_TOTAL_CAPTURES = 500;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

class StorageManager {
  constructor() {
    this.cache = null;
    this.cacheTime = 0;
    this.CACHE_TTL = 500; // Reduced from 1000ms to 500ms for faster updates
    this.DEBUG = false; // Disable verbose logging for performance
    this._writeQueue = Promise.resolve(); // Queue for serializing writes
  }

  _enqueueWrite(task) {
    // Ensure all write operations are serialized and the queue never gets stuck
    // on rejection. Return the task promise so callers can handle errors.
    const next = this._writeQueue.then(
      () => task(),
      () => task()
    );
    this._writeQueue = next.catch(() => undefined);
    return next;
  }

  _log(...args) {
    if (this.DEBUG) {
      console.debug('[StorageManager]', ...args);
    }
  }

  async getAllCaptures(options = {}) {
    const bypassCache = options?.bypassCache === true;
    const now = Date.now();
    if (!bypassCache && this.cache && (now - this.cacheTime) < this.CACHE_TTL) {
      this._log('Cache hit, returning', this.cache.length, 'captures (age:', now - this.cacheTime, 'ms)');
      // Return a copy to prevent external mutation of cache
      return [...this.cache];
    }
    this._log('Cache miss or expired, reading from storage');
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      this.cache = result[STORAGE_KEY] || [];
      this.cacheTime = now;
      this._log('Loaded', this.cache.length, 'captures from storage');
      // Return a copy to prevent external mutation of cache
      return [...this.cache];
    } catch (e) {
      console.error('Storage read error:', e);
      this._log('Storage read FAILED:', e.message);
      return [];
    }
  }

  async saveCaptures(captures) {
    this._log('Saving', captures.length, 'captures to storage');
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: captures });
      // Store a copy in cache to prevent mutation issues
      this.cache = [...captures];
      this.cacheTime = Date.now();
      this._log('Save successful, cache updated');
    } catch (e) {
      console.error('Storage write error:', e);
      this._log('Storage write FAILED:', e.message);
      // Invalidate cache on write failure to force re-read
      this.cache = null;
      this.cacheTime = 0;
      throw e; // Re-throw so caller knows save failed
    }
  }

  async addCapture(capture) {
    this._log('Adding capture:', capture.id, 'method:', capture.method);
    // Use write queue to prevent race conditions from concurrent writes
    return this._enqueueWrite(async () => {
      try {
        // Check for duplicate (same id)
        const captures = await this.getAllCaptures({ bypassCache: true });
        if (captures.some(c => c.id === capture.id)) {
          this._log('Duplicate capture detected, skipping:', capture.id);
          return capture.id;
        }
        this._log('Current captures count:', captures.length);
        captures.push(capture);
        const trimmed = this.trimCaptures(captures);
        this._log('After trim:', trimmed.length, 'captures (removed:', captures.length - trimmed.length, ')');
        await this.saveCaptures(trimmed);
        this._log('Capture added successfully:', capture.id);
        return capture.id;
      } catch (e) {
        console.error('Failed to add capture:', e);
        this._log('addCapture FAILED:', e.message);
        throw e;
      }
    });
  }

  async getCaptures(filters = {}) {
    this._log('getCaptures called with filters:', JSON.stringify(filters));
    let captures = await this.getAllCaptures();
    const originalCount = captures.length;

    if (filters.method) {
      captures = captures.filter(c => c.method === filters.method);
      this._log('After method filter:', captures.length, 'captures');
    }
    if (filters.tabId !== undefined) {
      captures = captures.filter(c => c.tabId === filters.tabId);
      this._log('After tabId filter:', captures.length, 'captures');
    }
    if (filters.domain) {
      captures = captures.filter(c => {
        try {
          const url = new URL(c.pageUrl);
          return url.hostname.includes(filters.domain);
        } catch {
          return false;
        }
      });
      this._log('After domain filter:', captures.length, 'captures');
    }
    if (filters.since) {
      captures = captures.filter(c => c.timestamp >= filters.since);
      this._log('After since filter:', captures.length, 'captures');
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      captures = captures.filter(c =>
        c.pageUrl?.toLowerCase().includes(searchLower) ||
        c.source?.url?.toLowerCase().includes(searchLower) ||
        c.method?.toLowerCase().includes(searchLower)
      );
      this._log('After search filter:', captures.length, 'captures');
    }

    captures.sort((a, b) => b.timestamp - a.timestamp);

    if (filters.limit) {
      const offset = filters.offset || 0;
      captures = captures.slice(offset, offset + filters.limit);
      this._log('After pagination (offset:', offset, 'limit:', filters.limit, '):', captures.length, 'captures');
    }

    this._log('getCaptures returning', captures.length, 'of', originalCount, 'total captures');
    return captures;
  }

  async getCapturesByTab(tabId) {
    const allCaptures = await this.getAllCaptures();
    return allCaptures.filter(c => c.tabId === tabId);
  }

  async getCountByTab(tabId) {
    const captures = await this.getCapturesByTab(tabId);
    this._log('getCountByTab:', tabId, '=', captures.length);
    return captures.length;
  }

  async getStats() {
    this._log('getStats called');
    const captures = await this.getAllCaptures();
    const stats = {
      total: captures.length,
      byMethod: {},
      byDomain: {},
      recentHour: 0,
      oldestTimestamp: null,
      newestTimestamp: null
    };

    const hourAgo = Date.now() - 60 * 60 * 1000;

    for (const capture of captures) {
      stats.byMethod[capture.method] = (stats.byMethod[capture.method] || 0) + 1;
      try {
        const domain = new URL(capture.pageUrl).hostname;
        stats.byDomain[domain] = (stats.byDomain[domain] || 0) + 1;
      } catch (e) {}
      if (capture.timestamp >= hourAgo) {
        stats.recentHour++;
      }
      if (!stats.oldestTimestamp || capture.timestamp < stats.oldestTimestamp) {
        stats.oldestTimestamp = capture.timestamp;
      }
      if (!stats.newestTimestamp || capture.timestamp > stats.newestTimestamp) {
        stats.newestTimestamp = capture.timestamp;
      }
    }

    this._log('getStats result: total=', stats.total, 'recentHour=', stats.recentHour);
    return stats;
  }

  async clearCaptures(tabId = null) {
    return this._enqueueWrite(async () => {
      if (tabId !== null && tabId !== undefined) {
        await this._clearCapturesByTabImmediate(tabId);
      } else {
        await this.saveCaptures([]);
      }
    });
  }

  async _clearCapturesByTabImmediate(tabId) {
    const captures = await this.getAllCaptures({ bypassCache: true });
    const filtered = captures.filter(c => c.tabId !== tabId);
    await this.saveCaptures(filtered);
  }

  async clearCapturesByTab(tabId) {
    return this._enqueueWrite(async () => {
      await this._clearCapturesByTabImmediate(tabId);
    });
  }

  async cleanupOldCaptures(maxAge = MAX_AGE_MS) {
    return this._enqueueWrite(async () => {
      this._log('cleanupOldCaptures called, maxAge:', maxAge, 'ms (', maxAge / (24 * 60 * 60 * 1000), 'days)');
      const cutoff = Date.now() - maxAge;
      const captures = await this.getAllCaptures({ bypassCache: true });
      const filtered = captures.filter(c => c.timestamp >= cutoff);
      if (filtered.length !== captures.length) {
        const removed = captures.length - filtered.length;
        this._log('Cleaning up', removed, 'old captures (cutoff:', new Date(cutoff).toISOString(), ')');
        await this.saveCaptures(filtered);
        return removed;
      }
      this._log('No old captures to clean up');
      return 0;
    });
  }

  trimCaptures(captures) {
    this._log('trimCaptures called with', captures.length, 'captures');
    const byTab = {};
    for (const capture of captures) {
      const tabId = capture.tabId || 'unknown';
      if (!byTab[tabId]) byTab[tabId] = [];
      byTab[tabId].push(capture);
    }

    this._log('Captures distributed across', Object.keys(byTab).length, 'tabs');

    let result = [];
    for (const tabId in byTab) {
      const tabCaptures = byTab[tabId]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_CAPTURES_PER_TAB);
      if (byTab[tabId].length > MAX_CAPTURES_PER_TAB) {
        this._log('Tab', tabId, ': trimmed from', byTab[tabId].length, 'to', tabCaptures.length);
      }
      result = result.concat(tabCaptures);
    }

    const finalResult = result
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_TOTAL_CAPTURES);

    if (result.length > MAX_TOTAL_CAPTURES) {
      this._log('Total trim: reduced from', result.length, 'to', finalResult.length);
    }

    return finalResult;
  }

  async exportAsJSON(filters = {}) {
    const captures = await this.getCaptures(filters);
    return JSON.stringify(captures, null, 2);
  }

  async exportAsCSV(filters = {}) {
    const captures = await this.getCaptures(filters);
    const headers = ['ID', 'Method', 'Timestamp', 'Page URL', 'Source URL', 'Source Line', 'Canvas Width', 'Canvas Height'];
    const rows = captures.map(c => [
      c.id,
      c.method,
      new Date(c.timestamp).toISOString(),
      c.pageUrl,
      c.source?.url || '',
      c.source?.line || '',
      c.canvas?.width || '',
      c.canvas?.height || ''
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    return csvContent;
  }
}

// ============== Main Service Worker Logic ==============

const storage = new StorageManager();

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only log non-fingerprint messages to reduce noise
  if (message.type !== 'FINGERPRINT_DETECTED') {
    console.debug('[SW] Message:', message.type, 'from tab:', sender.tab?.id ?? 'extension');
  }

  handleMessage(message, sender)
    .then(result => {
      sendResponse(result);
    })
    .catch(err => {
      console.error('[SW] Message handler error for', message.type, ':', err);
      sendResponse({ error: err.message });
    });
  return true;
});

async function handleMessage(message, sender) {
  // Wait for initialization before processing any messages
  if (!initializationComplete && initPromise) {
    await initPromise;
  }

  switch (message.type) {
    case 'FINGERPRINT_DETECTED':
      return handleFingerprintDetected(message.payload, sender);

    case 'GET_CAPTURES':
      return storage.getCaptures(message.filters || {});

    case 'GET_CAPTURES_BY_TAB':
      return storage.getCapturesByTab(message.tabId);

    case 'CLEAR_CAPTURES':
      try {
        await storage.clearCaptures(message.tabId);
        // Also clear deduplicator state for clean slate
        deduplicator.clear();

        if (message.tabId) {
          try {
            const tab = await chrome.tabs.get(message.tabId);
            const tabUrl = tab?.url;

            if (tabUrl && isWhitelisted(tabUrl)) {
              await updateBadge(message.tabId);
            } else {
              await clearBadge(message.tabId);
            }
          } catch (e) {
            // Tab may no longer exist.
          }
        } else {
          await clearBadgesForUnmonitoredTabs('clear-captures');
        }
        return { success: true };
      } catch (e) {
        console.error('[SW] CLEAR_CAPTURES failed:', e);
        return { success: false, error: e.message };
      }

    case 'GET_STATS':
      return storage.getStats();

    case 'GET_PAUSED':
      return { paused: isPaused, bufferedCount: captureBuffer.length };

    case 'SET_PAUSED':
      await setPauseState(message.paused);
      return { success: true, paused: isPaused, bufferedCount: captureBuffer.length };

    case 'EXPORT_DATA':
      if (message.format === 'csv') {
        return storage.exportAsCSV(message.filters || {});
      }
      return storage.exportAsJSON(message.filters || {});

    case 'GET_WHITELIST_STATUS':
      return { whitelisted: whitelist.has(normalizeDomain(message.domain)) };

    case 'ADD_TO_WHITELIST':
      return addToWhitelist(message.domain);

    case 'REMOVE_FROM_WHITELIST':
      return removeFromWhitelist(message.domain);

    case 'GET_WHITELIST':
      return { whitelist: Array.from(whitelist) };

    case 'GET_CLEAR_ON_RELOAD':
      return { clearOnReload };

    case 'SET_CLEAR_ON_RELOAD':
      if (typeof message.enabled !== 'boolean') {
        return { success: false, error: 'Invalid enabled value' };
      }
      clearOnReload = message.enabled === true;
      await chrome.storage.local.set({ [CLEAR_ON_RELOAD_KEY]: clearOnReload });
      return { success: true, clearOnReload };

    case 'INJECT_INTO_TAB':
      if (typeof message.tabId !== 'number') {
        return { injected: false, error: 'Invalid tabId' };
      }
      return injectMonitoringScriptsIntoTab(message.tabId);

    default:
      console.warn('[SW] Unknown message type:', message.type);
      return { error: 'Unknown message type' };
  }
}

async function handleFingerprintDetected(data, sender) {
  console.debug('[SW] handleFingerprintDetected:', data?.method, data?.id);

  if (!data) {
    console.error('[SW] No data provided to handleFingerprintDetected');
    return { success: false, error: 'No data provided' };
  }

  // Validate tabId - must be a valid number
  if (!sender.tab?.id || typeof sender.tab.id !== 'number') {
    console.error('[SW] Invalid tabId from sender:', sender.tab?.id);
    return { success: false, error: 'Invalid tab context - no valid tabId' };
  }

  // Block captures for tabs that are currently being cleared (prevents race condition on reload)
  if (tabsBeingCleared.has(sender.tab.id)) {
    console.debug('[SW] Capture blocked - tab is being cleared:', sender.tab.id, data?.method);
    return { success: true, id: data?.id, ignored: true, reason: 'tab_clearing' };
  }

  const topLevelUrl = typeof sender?.tab?.url === 'string' ? sender.tab.url : null;
  const frameUrl = typeof sender?.url === 'string' ? sender.url : null;

  // Check whitelist - only monitor whitelisted domains
  const senderUrl = (() => {
    const url = sender?.url;
    const tabUrl = sender?.tab?.url;

    if (typeof url === 'string') {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
      } catch {}
    }

    if (typeof tabUrl === 'string') return tabUrl;
    return typeof url === 'string' ? url : null;
  })();
  let hostname = null;
  try {
    hostname = senderUrl ? new URL(senderUrl).hostname : null;
  } catch (e) {
    hostname = null;
  }
  console.log('[SW] Whitelist check:', hostname, '| whitelist size:', whitelist.size, '| in whitelist:', whitelist.has(hostname));

  if (!isWhitelisted(senderUrl)) {
    console.log('[SW] BLOCKED - domain not whitelisted:', hostname);
    return { success: true, id: data?.id, ignored: true, reason: 'not whitelisted' };
  }
  console.log('[SW] ALLOWED - domain is whitelisted:', hostname);

  // Remember the tab context for reliable reload-clearing decisions.
  if (typeof sender?.tab?.id === 'number') {
    rememberTabContext(sender.tab.id, topLevelUrl || senderUrl || '');
  }

  // Sanitize potentially sensitive URLs (strip query/hash) before storing.
  const safeData = { ...data };
  if (typeof safeData.pageUrl === 'string') {
    safeData.pageUrl = sanitizeHttpUrl(safeData.pageUrl) || safeData.pageUrl;
  }
  if (safeData.source && typeof safeData.source === 'object' && typeof safeData.source.url === 'string') {
    const nextUrl = sanitizeHttpUrl(safeData.source.url) || truncateString(safeData.source.url, 220) || safeData.source.url;
    safeData.source = { ...safeData.source, url: nextUrl };
  }

  const attribution = buildAttribution({
    topLevelUrl,
    frameUrl: frameUrl || safeData.pageUrl || null,
    sourceUrl: safeData.source?.url || null,
    frameId: sender.frameId || 0
  });

  const enrichedData = {
    ...safeData,
    tabId: sender.tab.id,
    // NOTE: keep legacy `tabUrl` field as top-level tab URL when available.
    tabUrl: sanitizeHttpUrl(topLevelUrl) || senderUrl || '',
    tabTitle: sender.tab?.title || '',
    frameId: sender.frameId || 0,
    receivedAt: Date.now(),
    attribution
  };

  // PERFORMANCE: Check for duplicate using deduplicator
  const dupeCheck = deduplicator.isDuplicate(enrichedData);
  if (dupeCheck.isDuplicate) {
    console.debug('[SW] Duplicate capture filtered:', data.id, 'reason:', dupeCheck.reason);
    return { success: true, id: data.id, filtered: true, reason: dupeCheck.reason };
  }

  // If paused, buffer the capture instead of storing
  if (isPaused) {
    // Add to buffer with circular behavior (remove oldest if at max)
    if (captureBuffer.length >= MAX_BUFFER_SIZE) {
      captureBuffer.shift();
    }
    captureBuffer.push(enrichedData);
    console.debug('[SW] Capture buffered (paused):', data.id, 'buffer size:', captureBuffer.length);

    // Notify panels about buffer update
    notifyAllPanels({
      type: 'BUFFER_UPDATE',
      bufferedCount: captureBuffer.length
    });

    return { success: true, id: data.id, buffered: true };
  }

  try {
    await storage.addCapture(enrichedData);
    console.debug('[SW] Capture stored:', data.id, data.method);
  } catch (e) {
    console.error('[SW] Failed to store capture:', e);
    return { success: false, error: e.message };
  }

  if (sender.tab?.id) {
    await updateBadge(sender.tab.id);
  }

  notifyDevTools(enrichedData);

  return { success: true, id: data.id };
}

async function clearBadge(tabId) {
  if (!tabId) return;
  try {
    await chrome.action.setBadgeText({ text: '', tabId });
    await chrome.action.setBadgeBackgroundColor({ color: '#666666', tabId });
  } catch (e) {
    console.debug('[SW] clearBadge failed for tab', tabId, '-', e?.message || e);
  }
}

async function clearBadgesForUnmonitoredTabs(reason) {
  try {
    const tabs = await chrome.tabs.query({});
    const tasks = [];

    for (const tab of tabs) {
      const tabId = tab?.id;
      if (!tabId) continue;

      const tabUrl = tab?.url;
      if (tabUrl && isWhitelisted(tabUrl)) {
        tasks.push(updateBadge(tabId));
      } else {
        tasks.push(clearBadge(tabId));
      }
    }

    await Promise.allSettled(tasks);
    console.debug('[SW] Badge sync complete:', {
      reason,
      tasksCount: tasks.length,
      tabsCount: tabs.length,
      whitelistSize: whitelist.size
    });
  } catch (e) {
    console.debug('[SW] clearBadgesForUnmonitoredTabs failed:', e?.message || e);
  }
}

async function updateBadge(tabId) {
  if (!tabId) {
    console.debug('[SW] updateBadge: No tabId provided, skipping');
    return;
  }

  try {
    const count = await storage.getCountByTab(tabId);
    const text = count > 0 ? (count > 99 ? '99+' : count.toString()) : '';
    console.debug('[SW] updateBadge: Setting badge for tab', tabId, 'count:', count, 'text:', text);

    await chrome.action.setBadgeText({ text, tabId });
    await chrome.action.setBadgeBackgroundColor({
      color: count > 0 ? '#ef4444' : '#666666',
      tabId
    });
    console.debug('[SW] updateBadge: Badge updated successfully');
  } catch (e) {
    console.debug('[SW] updateBadge: Failed for tab', tabId, '-', e.message);
  }
}

// Track connected DevTools panels
const devToolsPorts = new Map();

chrome.runtime.onConnect.addListener((port) => {
  console.debug('[SW] Port connected:', port.name);

  if (port.name === 'devtools-panel') {
    console.debug('[SW] DevTools panel connecting...');

    port.onMessage.addListener((msg) => {
      console.debug('[SW] DevTools port message:', msg);
      if (msg.type === 'INIT' && msg.tabId) {
        console.debug('[SW] DevTools panel registered for tabId:', msg.tabId);
        devToolsPorts.set(msg.tabId, port);
        console.debug('[SW] Total DevTools ports:', devToolsPorts.size);
      }
    });

    port.onDisconnect.addListener(() => {
      console.debug('[SW] DevTools port disconnected');
      for (const [id, p] of devToolsPorts.entries()) {
        if (p === port) {
          console.debug('[SW] Removing DevTools port for tabId:', id);
          devToolsPorts.delete(id);
          break;
        }
      }
      console.debug('[SW] Remaining DevTools ports:', devToolsPorts.size);
    });
  }
});

function notifyDevTools(capture) {
  console.debug('[SW] notifyDevTools called for tabId:', capture.tabId);
  console.debug('[SW] Available DevTools ports:', Array.from(devToolsPorts.keys()));

  const port = devToolsPorts.get(capture.tabId);
  if (port) {
    console.debug('[SW] Found DevTools port for tab, sending NEW_CAPTURE');
    try {
      port.postMessage({
        type: 'NEW_CAPTURE',
        capture: capture
      });
      console.debug('[SW] NEW_CAPTURE sent successfully');
    } catch (e) {
      console.debug('[SW] Failed to send to DevTools port:', e.message);
      devToolsPorts.delete(capture.tabId);
    }
  } else {
    console.debug('[SW] No DevTools port found for tabId:', capture.tabId);
  }
}

// Handle tab updates - update badge on completion
// Note: Detector + bridge injection is managed via chrome.scripting.registerContentScripts()
// and is only registered for whitelisted domains.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const status = changeInfo?.status;
  if (!status) return;

  if (!initializationComplete && initPromise) {
    try {
      await initPromise;
    } catch {}
  }

  const tabUrl = await getBestTabUrl(tabId, tab);
  if (tabUrl) {
    rememberTabContext(tabId, tabUrl);
  }

  const isMonitoredTab =
    (tabUrl && isWhitelisted(tabUrl)) ||
    lastKnownTabWhitelisted.get(tabId) === true;

  // Optional: start fresh on each reload/navigation while monitoring.
  if (status === 'loading' && clearOnReload) {
    if (isMonitoredTab) {
      // Block new captures while clearing to prevent race condition
      tabsBeingCleared.add(tabId);
      try {
        console.debug('[SW] clearOnReload: clearing captures for tab', tabId, tabUrl);
        await storage.clearCapturesByTab(tabId);
        // Clear deduplicator state for clean slate (same as manual clear)
        deduplicator.clear();
        // Clear badge while page is loading; it will update on new captures.
        await clearBadge(tabId);
      } catch (e) {
        console.debug('[SW] clearOnReload failed for tab', tabId, '-', e?.message || e);
      } finally {
        // Always unblock captures for this tab
        tabsBeingCleared.delete(tabId);
      }
    }
    return;
  }

  if (status === 'complete') {
    // Only show badge counts for whitelisted (monitored) pages.
    if (isMonitoredTab) {
      await updateBadge(tabId);
      return;
    }

    await clearBadge(tabId);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    if (!initializationComplete && initPromise) {
      await initPromise;
    }

    const tab = await chrome.tabs.get(tabId);
    const tabUrl = tab?.url || tab?.pendingUrl;
    if (tabUrl) {
      rememberTabContext(tabId, tabUrl);
    }

    if (tabUrl && isWhitelisted(tabUrl)) {
      await updateBadge(tabId);
      return;
    }

    await clearBadge(tabId);
  } catch (e) {
    console.debug('[SW] onActivated badge sync failed for tab', tabId, '-', e?.message || e);
  }
});

// ============== LIFECYCLE EVENTS ==============

chrome.runtime.onInstalled.addListener(async () => {
  if (initPromise) await initPromise;
  console.log('[SW] Extension installed/updated');
});

chrome.runtime.onStartup.addListener(async () => {
  if (initPromise) await initPromise;
  console.log('[SW] Browser started');
});

// Handle tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await storage.clearCapturesByTab(tabId);
  await clearBadge(tabId);
  devToolsPorts.delete(tabId);
});

// Periodic cleanup
chrome.alarms.create('cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanup') {
    const removed = await storage.cleanupOldCaptures();
    if (removed > 0) {
      console.debug(`CrawlHQ Hooker: Cleaned up ${removed} old captures`);
    }
  }
});

// Initial cleanup
storage.cleanupOldCaptures().then(removed => {
  if (removed > 0) {
    console.debug(`CrawlHQ Hooker: Initial cleanup removed ${removed} old captures`);
  }
});

console.debug('CrawlHQ Hooker: Service worker started');
