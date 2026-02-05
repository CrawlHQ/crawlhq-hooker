/**
 * DevTools Panel Script - CrawlHQ Hooker
 * Full-featured panel for analyzing browser fingerprinting
 *
 * Performance optimizations:
 * - Virtual scrolling for large capture lists (50+ rows)
 * - Lazy loading for thumbnails via IntersectionObserver
 * - RAF-batched DOM updates
 * - Client-side deduplication
 */

// SVG icons helper (loaded via classic script `../shared/category-icons.js`)
const getCategoryIconString =
  globalThis.CrawlHQCategoryIcons && typeof globalThis.CrawlHQCategoryIcons.getCategoryIconString === 'function'
    ? globalThis.CrawlHQCategoryIcons.getCategoryIconString
    : () => '';

// ============== Performance Config ==============
const PERF_CONFIG = {
  virtualScroll: {
    enabled: true,
    rowHeight: 52,
    overscan: 8,
    minRowsForVirtual: 30
  },
  lazyThumbnails: {
    enabled: true,
    placeholder: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Crect fill="%23333" width="48" height="48"/%3E%3C/svg%3E'
  },
  dedupe: {
    enabled: true,
    windowMs: 500
  },
  statsRefresh: 5000 // Refresh stats every 5 seconds
};

// Storage keys (source of truth)
const CAPTURES_KEY = 'canvasCaptures';
const WHITELIST_KEY = 'crawlhqWhitelist';
const CLEAR_ON_RELOAD_KEY = 'crawlhqClearOnReload';

// ============== Client-side Deduplicator ==============
class ClientDeduplicator {
  constructor(windowMs = 500) {
    this.windowMs = windowMs;
    this.recentIds = new Set();
    this.timestamps = new Map();
  }

  isDuplicate(capture) {
    if (this.recentIds.has(capture.id)) {
      return true;
    }
    this.recentIds.add(capture.id);
    this.timestamps.set(capture.id, Date.now());
    // Cleanup old entries
    this.cleanup();
    return false;
  }

  cleanup() {
    const cutoff = Date.now() - this.windowMs;
    for (const [id, ts] of this.timestamps) {
      if (ts < cutoff) {
        this.recentIds.delete(id);
        this.timestamps.delete(id);
      }
    }
  }

  clear() {
    this.recentIds.clear();
    this.timestamps.clear();
  }
}

// Import SVG icons (replacing emoji constants)
// CATEGORY_ICONS removed - using getCategoryIconString from category-icons.js

// Category colors for styling - CrawlHQ Green theme
const CATEGORY_COLORS = {
  canvas: '#00d26a',
  webgl: '#00b359',
  audio: '#00cc77',
  navigator: '#00ff88',
  screen: '#33ffaa',
  fonts: '#00e680',
  webrtc: '#00d26a',
  storage: '#00b359',
  timing: '#00cc77',
  speech: '#00ff88',
  permissions: '#33ffaa',
  clientHints: '#00e680',
  battery: '#00d26a',
  // Anti-bot detection categories
  behavior: '#00b359',
  automation: '#00cc77',
  sensors: '#00ff88',
  gamepad: '#33ffaa',
  network: '#00e680',
  media: '#00d26a',
  geolocation: '#00b359',
  dom: '#00cc77',
  crypto: '#00ff88',
  hardware: '#33ffaa',
  clipboard: '#00e680',
  credentials: '#00d26a'
};

// Panel loaded
console.debug('[Panel] Script loaded');

class CrawlHQHookerPanel {
  constructor() {
    console.debug('[Panel] Initializing CrawlHQHookerPanel');

    this.captures = [];
    this.filteredCaptures = [];
    this.selectedCapture = null;
    this.currentFilter = '';
    this.searchQuery = '';
    this.sortField = 'timestamp';
    this.sortDirection = 'desc';
    this.viewMode = 'grid'; // 'grid', 'list', 'timeline', or 'category' - grid is default
    this.isPaused = false;
    this.bufferedCount = 0;
    this.clearOnReload = true;

    // Whitelist-gated monitoring state (per-site)
    this.currentUrl = null;
    this.currentDomain = null;
    this.isWhitelisted = false;

    // Storage-backed refresh (debounced)
    this._storageRefreshTimer = null;
    this._pendingStorageRefreshReason = null;
    this._lastStorageRefreshAt = 0;

    // Performance components
    this.deduplicator = PERF_CONFIG.dedupe.enabled
      ? new ClientDeduplicator(PERF_CONFIG.dedupe.windowMs)
      : null;

    // Use the external LazyThumbLoader class if available
    this.thumbLoader = (typeof LazyThumbLoader !== 'undefined' && PERF_CONFIG.lazyThumbnails.enabled)
      ? new LazyThumbLoader({ placeholder: PERF_CONFIG.lazyThumbnails.placeholder })
      : null;

    // Virtual table manager (initialized later)
    this.virtualTable = null;

    // Virtual grid manager (initialized later)
    this.virtualGrid = null;

    // Timeline and category managers
    this.timelineManager = (typeof TimelineManager !== 'undefined')
      ? new TimelineManager()
      : null;

    this.categoryManager = (typeof CategoryGroupManager !== 'undefined')
      ? new CategoryGroupManager()
      : null;

    // RAF scheduler for batched updates
    this.rafScheduler = (typeof RAFScheduler !== 'undefined')
      ? new RAFScheduler({ maxUpdatesPerFrame: 15 })
      : null;

    // Get tabId with validation
    if (!chrome.devtools || !chrome.devtools.inspectedWindow) {
      console.error('[Panel] chrome.devtools.inspectedWindow not available');
      this.tabId = null;
    } else {
      this.tabId = chrome.devtools.inspectedWindow.tabId;
    }

    if (this.tabId === null || this.tabId === undefined) {
      console.error('[Panel] tabId is null/undefined - panel cannot function');
      return;
    }

    this.init();
  }

  async init() {
    console.debug('[Panel] init() called for tabId:', this.tabId);

    // Cache DOM elements
    this.elements = {
      // Stats
      thisPageCount: document.getElementById('thisPageCount'),
      allTimeCount: document.getElementById('allTimeCount'),
      lastHourCount: document.getElementById('lastHourCount'),
      // Whitelist
      whitelistBanner: document.getElementById('whitelistBanner'),
      whitelistStatus: document.getElementById('whitelistStatus'),
      whitelistDomain: document.getElementById('whitelistDomain'),
      whitelistBtn: document.getElementById('whitelistBtn'),
      whitelistBtnText: document.getElementById('whitelistBtnText'),
      // Search/Filter
      searchInput: document.getElementById('searchInput'),
      categoryFilter: document.getElementById('categoryFilter'),
      // Buttons
      exportJsonBtn: document.getElementById('exportJsonBtn'),
      exportCsvBtn: document.getElementById('exportCsvBtn'),
      pauseBtn: document.getElementById('pauseBtn'),
      pauseIcon: document.getElementById('pauseIcon'),
      playIcon: document.getElementById('playIcon'),
      pauseBtnText: document.getElementById('pauseBtnText'),
      bufferBadge: document.getElementById('bufferBadge'),
      clearBtn: document.getElementById('clearBtn'),
      gridViewBtn: document.getElementById('gridViewBtn'),
      listViewBtn: document.getElementById('listViewBtn'),
      timelineViewBtn: document.getElementById('timelineViewBtn'),
      categoryViewBtn: document.getElementById('categoryViewBtn'),
      // Table
      tableContainer: document.querySelector('.table-container'),
      capturesBody: document.getElementById('capturesBody'),
      emptyState: document.getElementById('emptyState'),
      // Grid
      gridContainer: document.querySelector('.grid-container'),
      gridView: document.getElementById('gridView'),
      // Grouped (Timeline/Category)
      groupedContainer: document.querySelector('.grouped-container'),
      groupedTitle: document.getElementById('groupedTitle'),
      groupedView: document.getElementById('groupedView'),
      expandAllBtn: document.getElementById('expandAllBtn'),
      collapseAllBtn: document.getElementById('collapseAllBtn'),
      // Reload behavior toggle
      clearOnReloadToggle: document.getElementById('clearOnReloadToggle'),
      // Sidebar
      detailSidebar: document.getElementById('detailSidebar'),
      sidebarContent: document.getElementById('sidebarContent'),
      closeSidebarBtn: document.getElementById('closeSidebarBtn')
    };

    // Validate required DOM elements
    const missingElements = Object.entries(this.elements)
      .filter(([key, el]) => !el)
      .map(([key]) => key);
    if (missingElements.length > 0) {
      console.warn('[Panel] Missing DOM elements:', missingElements);
    }

    // Initialize virtual table manager if available
    if (typeof VirtualTableManager !== 'undefined' && PERF_CONFIG.virtualScroll.enabled) {
      this.virtualTable = new VirtualTableManager({
        container: this.elements.tableContainer,
        tbody: this.elements.capturesBody,
        rowHeight: PERF_CONFIG.virtualScroll.rowHeight,
        overscan: PERF_CONFIG.virtualScroll.overscan,
        minRowsForVirtual: PERF_CONFIG.virtualScroll.minRowsForVirtual,
        columnCount: 6,
        renderRow: (capture, index) => this.createTableRow(capture),
        onRowClick: (capture) => this.selectCapture(capture)
      });
    }

    // Initialize virtual grid manager if available
    if (typeof VirtualGridManager !== 'undefined') {
      this.virtualGrid = new VirtualGridManager({
        container: this.elements.gridContainer,
        gridElement: this.elements.gridView,
        cardHeight: 160,
        cardGap: 12,
        overscan: 4,
        minRowsForVirtual: 20,
        renderCard: (capture, index) => this.createGridCard(capture),
        onCardClick: (capture) => this.selectCapture(capture)
      });
    }

    this.bindEvents();

    // Resolve inspected tab context + whitelist state first (per-site monitoring)
    await this.refreshInspectedTabContext();
    await this.loadWhitelistFromStorage();
    await this.loadClearOnReloadSetting();
    await this.refreshFromStorage('init');

    await this.loadPauseState();
    this.connectToBackground();

    // Initialize the view mode (show correct container based on viewMode)
    this.setViewMode(this.viewMode);

    // Update "time ago" values every 30 seconds
    setInterval(() => this.updateTimeDisplays(), 30000);

    // Keep last-hour stat accurate even without new captures
    setInterval(() => this.refreshStatsFromStorage('stats-refresh'), PERF_CONFIG.statsRefresh);

    // Slow polling fallback (storage events + port are primary)
    setInterval(() => {
      if (!this.isPaused) {
        this.scheduleStorageRefresh('slow-poll');
      }
    }, 30000);

    // Live updates without relying solely on background messaging
    this.installStorageListeners();
    this.installNavigationListener();

    console.debug('[Panel] Initialization complete');
  }

  updateTimeDisplays() {
    // Update all time-relative elements
    const timeRelatives = document.querySelectorAll('.time-relative');
    timeRelatives.forEach(el => {
      const timestamp = parseInt(el.dataset.timestamp, 10);
      if (timestamp) {
        el.textContent = this.formatTimeAgo(timestamp);
      }
    });
  }

  installStorageListeners() {
    if (this._storageListenersInstalled) return;
    this._storageListenersInstalled = true;

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      if (changes?.[WHITELIST_KEY]) {
        this.loadWhitelistFromStorage()
          .then(() => this.scheduleStorageRefresh('whitelist-changed'))
          .catch((err) => console.error('[Panel] Failed to handle whitelist change:', err));
      }

      if (changes?.[CLEAR_ON_RELOAD_KEY]) {
        const next = changes[CLEAR_ON_RELOAD_KEY]?.newValue;
        if (typeof next === 'boolean') {
          this.clearOnReload = next === true;
          this.updateClearOnReloadUI();
        }
      }

      if (changes?.[CAPTURES_KEY]) {
        this.scheduleStorageRefresh('captures-changed');
      }
    });
  }

  installNavigationListener() {
    if (this._navigationListenerInstalled) return;
    this._navigationListenerInstalled = true;

    if (!chrome.devtools?.network?.onNavigated) return;

    chrome.devtools.network.onNavigated.addListener(() => {
      this.handleNavigated().catch((err) => {
        console.error('[Panel] Failed to handle navigation:', err);
      });
    });
  }

  async handleNavigated() {
    await this.refreshInspectedTabContext();
    await this.loadWhitelistFromStorage();

    // If navigated to a non-monitored page, clear displayed captures
    if (!this.isWhitelisted) {
      this.captures = [];
      this.filteredCaptures = [];
      this.updateCategoryFilter();
      this.renderTable();
      this.setStatsCounts({ thisPage: 0, allTime: 0, lastHour: 0 });
      return;
    }

    await this.refreshFromStorage('navigated');
  }

  async refreshInspectedTabContext() {
    let url = null;

    // Primary: tabs.get(tabId)
    try {
      const tab = await chrome.tabs.get(this.tabId);
      if (tab?.url && typeof tab.url === 'string') {
        url = tab.url;
      }
    } catch (e) {
      console.debug('[Panel] chrome.tabs.get failed, falling back to inspectedWindow.eval:', e?.message || e);
    }

    // Fallback: eval in inspected window
    if (!url) {
      url = await new Promise((resolve) => {
        try {
          chrome.devtools.inspectedWindow.eval('location.href', (result, exceptionInfo) => {
            if (exceptionInfo) {
              resolve(null);
              return;
            }
            resolve(typeof result === 'string' ? result : null);
          });
        } catch {
          resolve(null);
        }
      });
    }

    this.currentUrl = url;
    this.currentDomain = null;

    if (typeof url === 'string' && url.startsWith('http')) {
      try {
        this.currentDomain = new URL(url).hostname;
      } catch {
        this.currentDomain = null;
      }
    }

    if (this.elements?.whitelistDomain) {
      this.elements.whitelistDomain.textContent = this.currentDomain || 'Unknown';
      this.elements.whitelistDomain.title = this.currentUrl || '';
    }
  }

  async loadWhitelistFromStorage() {
    const result = await chrome.storage.local.get([WHITELIST_KEY]);
    const list = Array.isArray(result?.[WHITELIST_KEY]) ? result[WHITELIST_KEY] : [];
    const domainLower = this.currentDomain ? String(this.currentDomain).toLowerCase() : '';

    const normalized = list
      .map((d) => String(d).trim().toLowerCase())
      .filter(Boolean);

    this.isWhitelisted = domainLower ? normalized.includes(domainLower) : false;
    this.updateWhitelistUI();
  }

  updateWhitelistUI() {
    if (this.elements?.whitelistDomain) {
      this.elements.whitelistDomain.textContent = this.currentDomain || 'Unknown';
      this.elements.whitelistDomain.title = this.currentUrl || '';
    }

    if (!this.elements?.whitelistBtn || !this.elements?.whitelistStatus || !this.elements?.whitelistBtnText) return;

    const canToggle = Boolean(this.currentDomain);
    this.elements.whitelistBtn.disabled = !canToggle;

    if (this.isWhitelisted) {
      this.elements.whitelistStatus.textContent = 'Monitoring active';
      this.elements.whitelistStatus.classList.add('active');
      this.elements.whitelistBtn.classList.add('active');
      this.elements.whitelistBtnText.textContent = 'Stop monitoring';
    } else {
      this.elements.whitelistStatus.textContent = 'Not monitoring';
      this.elements.whitelistStatus.classList.remove('active');
      this.elements.whitelistBtn.classList.remove('active');
      this.elements.whitelistBtnText.textContent = 'Monitor this page';
    }
  }

  scheduleStorageRefresh(reason) {
    this._pendingStorageRefreshReason = reason;
    if (this._storageRefreshTimer) return;

    this._storageRefreshTimer = setTimeout(() => {
      const pendingReason = this._pendingStorageRefreshReason;
      this._pendingStorageRefreshReason = null;
      this._storageRefreshTimer = null;

      this.refreshFromStorage(pendingReason || 'debounced')
        .catch((err) => console.error('[Panel] Storage refresh failed:', err));
    }, 200);
  }

  setStatsCounts({ thisPage = 0, allTime = 0, lastHour = 0 } = {}) {
    if (this.elements?.thisPageCount) this.elements.thisPageCount.textContent = String(thisPage);
    if (this.elements?.allTimeCount) this.elements.allTimeCount.textContent = String(allTime);
    if (this.elements?.lastHourCount) this.elements.lastHourCount.textContent = String(lastHour);
  }

  async refreshFromStorage(reason) {
    this._lastStorageRefreshAt = Date.now();

    // Note: Whitelist gating removed - captures are already filtered at storage time
    // by the service worker. If captures exist for this tabId, they were from a
    // whitelisted domain when captured.

    try {
      const result = await chrome.storage.local.get([CAPTURES_KEY]);
      const all = Array.isArray(result?.[CAPTURES_KEY]) ? result[CAPTURES_KEY] : [];
      const allCaptures = all.filter(Boolean);

      const byTab = allCaptures.filter((c) => c && c.tabId === this.tabId);
      this.captures = byTab;

      this.updateCategoryFilter();
      this.applyFilters();

      const now = Date.now();
      const lastHour = allCaptures.filter((c) => typeof c?.timestamp === 'number' && c.timestamp >= (now - 3600_000)).length;
      this.setStatsCounts({ thisPage: byTab.length, allTime: allCaptures.length, lastHour });

      console.debug('[Panel] Refreshed from storage:', {
        reason,
        tabId: this.tabId,
        isWhitelisted: this.isWhitelisted,
        thisPage: byTab.length,
        allTime: allCaptures.length
      });
    } catch (err) {
      console.error('[Panel] Failed to refresh from storage:', reason, err);
      this.captures = [];
      this.updateCategoryFilter();
      this.applyFilters();
      this.setStatsCounts({ thisPage: 0, allTime: 0, lastHour: 0 });
    }
  }

  async refreshStatsFromStorage(reason) {
    if (!this.isWhitelisted) {
      this.setStatsCounts({ thisPage: 0, allTime: 0, lastHour: 0 });
      return;
    }

    try {
      const result = await chrome.storage.local.get([CAPTURES_KEY]);
      const all = Array.isArray(result?.[CAPTURES_KEY]) ? result[CAPTURES_KEY] : [];
      const allCaptures = all.filter(Boolean);

      const now = Date.now();
      const lastHour = allCaptures.filter((c) => typeof c?.timestamp === 'number' && c.timestamp >= (now - 3600_000)).length;
      this.setStatsCounts({ thisPage: this.captures.length, allTime: allCaptures.length, lastHour });

      console.debug('[Panel] Stats refreshed:', { reason, thisPage: this.captures.length, allTime: allCaptures.length, lastHour });
    } catch (err) {
      console.error('[Panel] Failed to refresh stats from storage:', reason, err);
    }
  }

  async toggleWhitelist() {
    if (this._whitelistToggleInProgress) return;
    this._whitelistToggleInProgress = true;

    try {
      if (!this.currentDomain) {
        console.warn('[Panel] No domain to toggle monitoring for');
        return;
      }

      const domainLower = String(this.currentDomain).toLowerCase();
      const result = await chrome.storage.local.get([WHITELIST_KEY]);
      const current = Array.isArray(result?.[WHITELIST_KEY]) ? result[WHITELIST_KEY] : [];

      const nextSet = new Set(current.map((d) => String(d).trim().toLowerCase()).filter(Boolean));
      const newState = !nextSet.has(domainLower);

      if (newState) {
        nextSet.add(domainLower);
      } else {
        nextSet.delete(domainLower);
      }

      await chrome.storage.local.set({ [WHITELIST_KEY]: Array.from(nextSet) });

      this.isWhitelisted = newState;
      this.updateWhitelistUI();

      if (!newState) {
        await this.clearCapturesForTab();
      }

      await this.reloadInspectedTab();
      await this.refreshFromStorage('toggle-whitelist');
    } finally {
      this._whitelistToggleInProgress = false;
    }
  }

  async clearCapturesForTab() {
    // Preferred: ask service worker to clear (also updates badge + dedupe state)
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_CAPTURES', tabId: this.tabId });
      return true;
    } catch (e) {
      console.warn('[Panel] CLEAR_CAPTURES message failed, falling back to storage rewrite:', e?.message || e);
    }

    // Fallback: rewrite captures in storage directly
    try {
      const result = await chrome.storage.local.get([CAPTURES_KEY]);
      const all = Array.isArray(result?.[CAPTURES_KEY]) ? result[CAPTURES_KEY] : [];
      const next = all.filter((c) => c && c.tabId !== this.tabId);
      await chrome.storage.local.set({ [CAPTURES_KEY]: next });
      return true;
    } catch (e) {
      console.error('[Panel] Failed to clear captures via storage fallback:', e);
      return false;
    }
  }

  async reloadInspectedTab() {
    try {
      await chrome.tabs.reload(this.tabId);
      return;
    } catch (e) {
      console.debug('[Panel] chrome.tabs.reload failed, falling back to inspectedWindow.reload:', e?.message || e);
    }

    try {
      chrome.devtools.inspectedWindow.reload();
    } catch (e) {
      console.warn('[Panel] Failed to reload inspected tab:', e);
    }
  }

  async loadStats() {
    return this.refreshStatsFromStorage('loadStats');
  }

  async loadPauseState() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PAUSED' });
      if (response) {
        this.isPaused = response.paused === true;
        this.bufferedCount = response.bufferedCount || 0;
        this.updatePauseUI();
      }
    } catch (err) {
      console.error('[Panel] Failed to load pause state:', err);
    }
  }

  async togglePause() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SET_PAUSED',
        paused: !this.isPaused
      });
      if (response) {
        this.isPaused = response.paused;
        this.bufferedCount = response.bufferedCount || 0;
        this.updatePauseUI();
      }
    } catch (err) {
      console.error('[Panel] Failed to toggle pause:', err);
    }
  }

  updatePauseUI() {
    if (!this.elements.pauseBtn) return;

    this.elements.pauseBtn.classList.toggle('paused', this.isPaused);

    // Toggle icons
    if (this.elements.pauseIcon) {
      this.elements.pauseIcon.style.display = this.isPaused ? 'none' : '';
    }
    if (this.elements.playIcon) {
      this.elements.playIcon.style.display = this.isPaused ? '' : 'none';
    }

    // Update button text
    if (this.elements.pauseBtnText) {
      this.elements.pauseBtnText.textContent = this.isPaused ? 'Resume' : 'Pause';
    }

    // Update buffer badge
    if (this.elements.bufferBadge) {
      if (this.isPaused && this.bufferedCount > 0) {
        this.elements.bufferBadge.textContent = this.bufferedCount;
        this.elements.bufferBadge.style.display = '';
      } else {
        this.elements.bufferBadge.style.display = 'none';
      }
    }
  }

  setViewMode(mode) {
    this.viewMode = mode;

    // Update button states
    if (this.elements.gridViewBtn) {
      this.elements.gridViewBtn.classList.toggle('active', mode === 'grid');
    }
    if (this.elements.listViewBtn) {
      this.elements.listViewBtn.classList.toggle('active', mode === 'list');
    }
    if (this.elements.timelineViewBtn) {
      this.elements.timelineViewBtn.classList.toggle('active', mode === 'timeline');
    }
    if (this.elements.categoryViewBtn) {
      this.elements.categoryViewBtn.classList.toggle('active', mode === 'category');
    }

    // Toggle container visibility (use explicit display values)
    if (this.elements.tableContainer) {
      this.elements.tableContainer.style.display = mode === 'list' ? 'block' : 'none';
    }
    if (this.elements.gridContainer) {
      this.elements.gridContainer.style.display = mode === 'grid' ? 'block' : 'none';
    }
    if (this.elements.groupedContainer) {
      this.elements.groupedContainer.style.display = (mode === 'timeline' || mode === 'category') ? 'block' : 'none';
    }

    // Update grouped view title
    if (this.elements.groupedTitle) {
      this.elements.groupedTitle.textContent = mode === 'timeline' ? 'Timeline' : mode === 'category' ? 'Categories' : '';
    }

    // Re-render the appropriate view
    this.renderTable();
  }

  bindEvents() {
    // Per-site monitoring (whitelist) toggle
    if (this.elements.whitelistBtn) {
      this.elements.whitelistBtn.addEventListener('click', () => {
        this.toggleWhitelist().catch((err) => {
          console.error('[Panel] Failed to toggle monitoring for this page:', err);
        });
      });
    }

    // View mode toggle
    if (this.elements.gridViewBtn) {
      this.elements.gridViewBtn.addEventListener('click', () => this.setViewMode('grid'));
    }
    if (this.elements.listViewBtn) {
      this.elements.listViewBtn.addEventListener('click', () => this.setViewMode('list'));
    }
    if (this.elements.timelineViewBtn) {
      this.elements.timelineViewBtn.addEventListener('click', () => this.setViewMode('timeline'));
    }
    if (this.elements.categoryViewBtn) {
      this.elements.categoryViewBtn.addEventListener('click', () => this.setViewMode('category'));
    }

    // Expand/Collapse all buttons for grouped views
    if (this.elements.expandAllBtn) {
      this.elements.expandAllBtn.addEventListener('click', () => this.expandAllGroups());
    }
    if (this.elements.collapseAllBtn) {
      this.elements.collapseAllBtn.addEventListener('click', () => this.collapseAllGroups());
    }

    // Search
    let searchTimeout;
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchQuery = e.target.value.toLowerCase();
          this.applyFilters();
        }, 200);
      });
    }

    // Category filter
    if (this.elements.categoryFilter) {
      this.elements.categoryFilter.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.applyFilters();
      });
    }

    // Sort headers
    document.querySelectorAll('.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (this.sortField === field) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = field;
          this.sortDirection = 'desc';
        }
        this.updateSortIndicators();
        this.applyFilters();
      });
    });

    // Export buttons
    this.elements.exportJsonBtn.addEventListener('click', () => this.exportData('json'));
    this.elements.exportCsvBtn.addEventListener('click', () => this.exportData('csv'));

    // Pause button
    if (this.elements.pauseBtn) {
      this.elements.pauseBtn.addEventListener('click', () => this.togglePause());
    }

    // Clear-on-reload toggle
    if (this.elements.clearOnReloadToggle) {
      this.elements.clearOnReloadToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked === true;
        this.setClearOnReload(enabled).catch((err) => {
          console.error('[Panel] Failed to set clearOnReload:', err);
        });
      });
    }

    // Clear button
    this.elements.clearBtn.addEventListener('click', () => this.clearCaptures());

    // Close sidebar
    this.elements.closeSidebarBtn.addEventListener('click', () => this.closeSidebar());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSidebar();
      }
      // Spacebar to toggle pause (only when not typing in input)
      if (e.key === ' ' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        this.togglePause();
      }
      // Arrow key navigation for captures
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateCaptures(e.key === 'ArrowUp' ? -1 : 1);
      }
      // Enter to select focused row
      if (e.key === 'Enter' && document.activeElement?.closest('tr')) {
        const captureId = document.activeElement.closest('tr')?.dataset.id;
        if (captureId) {
          const capture = this.captures.find(c => c.id === captureId);
          if (capture) this.selectCapture(capture);
        }
      }
    });
  }

  navigateCaptures(direction) {
    if (this.filteredCaptures.length === 0) return;

    const currentIndex = this.selectedCapture
      ? this.filteredCaptures.findIndex(c => c.id === this.selectedCapture.id)
      : -1;

    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= this.filteredCaptures.length) newIndex = this.filteredCaptures.length - 1;

    const newCapture = this.filteredCaptures[newIndex];
    if (newCapture) {
      this.selectCapture(newCapture);
      // Scroll row into view
      const row = document.querySelector(`tr[data-id="${newCapture.id}"]`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  connectToBackground() {
    // Connect to service worker for real-time updates
    try {
      console.debug('[Panel] Connecting to background for tabId:', this.tabId);
      const port = chrome.runtime.connect({ name: 'devtools-panel' });
      port.postMessage({ type: 'INIT', tabId: this.tabId });
      console.debug('[Panel] Port connection established, INIT sent');

      port.onMessage.addListener((msg) => {
        console.debug('[Panel] Port message received:', msg.type);
        if (msg.type === 'NEW_CAPTURE') {
          console.debug('[Panel] NEW_CAPTURE received, capture tabId:', msg.capture?.tabId, 'panel tabId:', this.tabId);
          if (msg.capture && msg.capture.tabId === this.tabId) {
            this.scheduleStorageRefresh('port-new-capture');
          }
        } else if (msg.type === 'BUFFER_UPDATE') {
          // Update buffer count while paused
          this.bufferedCount = msg.bufferedCount || 0;
          this.updatePauseUI();
        } else if (msg.type === 'PAUSE_STATE') {
          // Pause state toggled outside DevTools (e.g. popup)
          this.isPaused = msg.paused === true;
          this.bufferedCount = msg.bufferedCount || 0;
          this.updatePauseUI();
        } else if (msg.type === 'BUFFER_FLUSHED') {
          // Reload captures after buffer flush
          this.isPaused = false;
          this.bufferedCount = 0;
          this.updatePauseUI();
          this.scheduleStorageRefresh('buffer-flushed');
        }
      });

      port.onDisconnect.addListener(() => {
        console.debug('[Panel] Port disconnected, reconnecting in 1 second...');
        // Reconnect after a delay
        setTimeout(() => this.connectToBackground(), 1000);
      });
    } catch (err) {
      console.error('[Panel] Error connecting to background:', err);
    }
  }

  async loadClearOnReloadSetting() {
    let enabled;

    // Prefer service worker message (consistent defaults)
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CLEAR_ON_RELOAD' });
      if (typeof response?.clearOnReload === 'boolean') {
        enabled = response.clearOnReload;
      }
    } catch {
      // Ignore and fall back to storage
    }

    if (typeof enabled !== 'boolean') {
      try {
        const result = await chrome.storage.local.get([CLEAR_ON_RELOAD_KEY]);
        if (typeof result?.[CLEAR_ON_RELOAD_KEY] === 'boolean') {
          enabled = result[CLEAR_ON_RELOAD_KEY];
        }
      } catch (e) {
        console.debug('[Panel] Failed to read clearOnReload from storage:', e?.message || e);
      }
    }

    this.clearOnReload = typeof enabled === 'boolean' ? enabled : true;
    this.updateClearOnReloadUI();
  }

  async setClearOnReload(enabled) {
    this.clearOnReload = enabled === true;
    this.updateClearOnReloadUI();

    // Prefer service worker message (also persists to storage)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SET_CLEAR_ON_RELOAD',
        enabled: this.clearOnReload
      });
      if (response?.success !== true) {
        throw new Error(response?.error || 'Unknown error');
      }
      return;
    } catch (e) {
      console.debug('[Panel] SET_CLEAR_ON_RELOAD message failed, falling back to storage:', e?.message || e);
    }

    await chrome.storage.local.set({ [CLEAR_ON_RELOAD_KEY]: this.clearOnReload });
  }

  updateClearOnReloadUI() {
    if (!this.elements?.clearOnReloadToggle) return;
    this.elements.clearOnReloadToggle.checked = this.clearOnReload === true;
    this.elements.clearOnReloadToggle.title = this.clearOnReload
      ? 'Reset on reload is ON (captures clear when page reloads)'
      : 'Reset on reload is OFF (keeps historical data)';
  }

  async loadCaptures() {
    return this.refreshFromStorage('loadCaptures');
  }

  updateCategoryFilter() {
    if (!this.elements.categoryFilter) return;

    // Get unique categories from captures
    const detectedCategories = new Set();
    for (const capture of this.captures) {
      const category = capture.category || 'canvas';
      detectedCategories.add(category);
    }

    // Remember current selection
    const currentValue = this.elements.categoryFilter.value;

    // Clear and rebuild dropdown
    this.elements.categoryFilter.innerHTML = '';

    // Add "All Categories" option
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = `All Categories (${this.captures.length})`;
    this.elements.categoryFilter.appendChild(allOption);

    // Sort categories and add them
    const sortedCategories = Array.from(detectedCategories).sort();
    for (const category of sortedCategories) {
      const count = this.captures.filter(c => (c.category || 'canvas') === category).length;
      const iconSvg = getCategoryIconString(category, 16);
      const option = document.createElement('option');
      option.value = category;
      option.innerHTML = `<span class="category-icon-inline">${iconSvg}</span> ${category} (${count})`;
      this.elements.categoryFilter.appendChild(option);
    }

    // Restore selection if still valid
    if (currentValue && detectedCategories.has(currentValue)) {
      this.elements.categoryFilter.value = currentValue;
    } else {
      this.elements.categoryFilter.value = '';
      this.currentFilter = '';
    }

    console.debug('[Panel] Updated category filter with', detectedCategories.size, 'categories');
  }

  addCapture(capture) {
    // Storage is the source of truth (keeps DevTools resilient even if ports/messages are flaky).
    if (!capture || capture.tabId !== this.tabId) return;
    this.scheduleStorageRefresh('addCapture');
  }

  applyFilters() {
    let filtered = [...this.captures];

    // Category filter
    if (this.currentFilter) {
      filtered = filtered.filter(c => c.category === this.currentFilter);
    }

    // Search filter
    if (this.searchQuery) {
      filtered = filtered.filter(c =>
        c.pageUrl?.toLowerCase().includes(this.searchQuery) ||
        c.source?.url?.toLowerCase().includes(this.searchQuery) ||
        c.method?.toLowerCase().includes(this.searchQuery) ||
        c.category?.toLowerCase().includes(this.searchQuery) ||
        c.arguments?.text?.toLowerCase().includes(this.searchQuery)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;

      switch (this.sortField) {
        case 'category':
          aVal = a.category || '';
          bVal = b.category || '';
          break;
        case 'method':
          aVal = a.method;
          bVal = b.method;
          break;
        case 'source':
          aVal = a.source?.url || '';
          bVal = b.source?.url || '';
          break;
        case 'timestamp':
        default:
          aVal = a.timestamp;
          bVal = b.timestamp;
      }

      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    this.filteredCaptures = filtered;

    // Close sidebar if selected capture is no longer in filtered results
    if (this.selectedCapture && !filtered.find(c => c.id === this.selectedCapture.id)) {
      this.closeSidebar();
    }

    this.renderTable();
  }

  updateSortIndicators() {
    document.querySelectorAll('.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.sort === this.sortField) {
        th.classList.add(`sorted-${this.sortDirection}`);
      }
    });
  }

  renderTable() {
    // Update stats
    if (this.elements.thisPageCount) {
      this.elements.thisPageCount.textContent = this.filteredCaptures.length;
    }

    if (this.filteredCaptures.length === 0) {
      this.elements.emptyState.classList.add('visible');
      this.elements.tableContainer.style.display = 'none';
      if (this.elements.gridContainer) {
        this.elements.gridContainer.style.display = 'none';
      }
      // Differentiate empty states: filtered vs no data
      const emptyText = this.elements.emptyState.querySelector('p');
      const emptyHint = this.elements.emptyState.querySelector('.empty-hint');
      if (this.captures.length > 0) {
        // Have captures but filter/search returned 0
        if (emptyText) emptyText.textContent = 'No captures match your filters';
        if (emptyHint) emptyHint.textContent = 'Try adjusting your category filter or search query';
      } else {
        // No captures at all
        if (emptyText) emptyText.textContent = 'No fingerprinting attempts detected';
        if (emptyHint) emptyHint.textContent = 'Browser fingerprint API calls will appear here in real-time';
      }
      return;
    }

    this.elements.emptyState.classList.remove('visible');

    // Route to appropriate view
    switch (this.viewMode) {
      case 'grid':
        this.renderGrid();
        break;
      case 'timeline':
        this.renderTimelineView();
        break;
      case 'category':
        this.renderCategoryView();
        break;
      case 'list':
      default:
        this.renderListView();
        break;
    }
  }

  renderGrid() {
    // Show grid container, hide others
    if (this.elements.gridContainer) {
      this.elements.gridContainer.style.display = 'block';
    }
    if (this.elements.tableContainer) {
      this.elements.tableContainer.style.display = 'none';
    }
    if (this.elements.groupedContainer) {
      this.elements.groupedContainer.style.display = 'none';
    }

    // Use virtual grid manager
    if (this.virtualGrid) {
      this.virtualGrid.setData(this.filteredCaptures);
      if (this.selectedCapture) {
        this.virtualGrid.setSelected(this.selectedCapture.id);
      }
      return;
    }

    // Fallback: standard rendering (shouldn't happen if VirtualGridManager is loaded)
    if (this.elements.gridView) {
      this.elements.gridView.replaceChildren();
      const fragment = document.createDocumentFragment();
      for (const capture of this.filteredCaptures) {
        const card = this.createGridCard(capture);
        card.addEventListener('click', () => this.selectCapture(capture));
        fragment.appendChild(card);
      }
      this.elements.gridView.appendChild(fragment);
    }
  }

  renderListView() {
    // Show table container, hide others
    if (this.elements.tableContainer) {
      this.elements.tableContainer.style.display = 'block';
    }
    if (this.elements.gridContainer) {
      this.elements.gridContainer.style.display = 'none';
    }
    if (this.elements.groupedContainer) {
      this.elements.groupedContainer.style.display = 'none';
    }

    // Use virtual table manager for large datasets
    if (this.virtualTable && this.filteredCaptures.length >= PERF_CONFIG.virtualScroll.minRowsForVirtual) {
      this.virtualTable.setData(this.filteredCaptures);
      if (this.selectedCapture) {
        this.virtualTable.setSelected(this.selectedCapture.id);
      }
      return;
    }

    // Standard rendering for small datasets
    this.elements.capturesBody.replaceChildren();

    // Use RAF batching if available
    if (this.rafScheduler) {
      const batchSize = 20;
      for (let i = 0; i < this.filteredCaptures.length; i += batchSize) {
        const batch = this.filteredCaptures.slice(i, i + batchSize);
        this.rafScheduler.schedule(() => {
          const fragment = document.createDocumentFragment();
          for (const capture of batch) {
            const row = this.createTableRow(capture);
            fragment.appendChild(row);
          }
          this.elements.capturesBody.appendChild(fragment);
        }, i === 0 ? 'high' : 'normal');
      }
    } else {
      // Fallback: standard rendering with DocumentFragment
      const fragment = document.createDocumentFragment();
      for (const capture of this.filteredCaptures) {
        const row = this.createTableRow(capture);
        fragment.appendChild(row);
      }
      this.elements.capturesBody.appendChild(fragment);
    }
  }

  renderTimelineView() {
    if (!this.elements.groupedView || !this.timelineManager) return;

    // Show grouped container, hide others
    if (this.elements.groupedContainer) {
      this.elements.groupedContainer.style.display = 'block';
    }
    if (this.elements.tableContainer) {
      this.elements.tableContainer.style.display = 'none';
    }
    if (this.elements.gridContainer) {
      this.elements.gridContainer.style.display = 'none';
    }

    const groups = this.timelineManager.groupByTime(this.filteredCaptures);
    this.renderGroupedView(groups, 'timeline');
  }

  renderCategoryView() {
    if (!this.elements.groupedView || !this.categoryManager) return;

    // Show grouped container, hide others
    if (this.elements.groupedContainer) {
      this.elements.groupedContainer.style.display = 'block';
    }
    if (this.elements.tableContainer) {
      this.elements.tableContainer.style.display = 'none';
    }
    if (this.elements.gridContainer) {
      this.elements.gridContainer.style.display = 'none';
    }

    const groups = this.categoryManager.groupByCategory(this.filteredCaptures);
    this.renderGroupedView(groups, 'category');
  }

  renderGroupedView(groups, type) {
    this.elements.groupedView.replaceChildren();

    const fragment = document.createDocumentFragment();

    for (const group of groups) {
      const section = this.createGroupSection(group, type);
      fragment.appendChild(section);
    }

    this.elements.groupedView.appendChild(fragment);
  }

  createGroupSection(group, type) {
    const section = document.createElement('div');
    section.className = 'group-section';
    if (group.collapsed) {
      section.classList.add('collapsed');
    }

    // Header
    const header = document.createElement('div');
    header.className = 'group-header';

    if (type === 'category') {
      header.classList.add(`cat-${group.category}`);
    }

    const headerLeft = document.createElement('div');
    headerLeft.className = 'group-header-left';

    // Chevron
    const chevron = document.createElement('svg');
    chevron.className = 'group-chevron';
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.setAttribute('stroke-width', '2');
    chevron.innerHTML = '<polyline points="6,9 12,15 18,9"/>';
    headerLeft.appendChild(chevron);

    // Icon (for category) or time label
    if (type === 'category') {
      const icon = document.createElement('span');
      icon.className = 'group-icon';
      icon.innerHTML = getCategoryIconString(group.category, 16);
      headerLeft.appendChild(icon);
    }

    // Title
    const title = document.createElement('span');
    title.className = 'group-title';
    if (type === 'category') {
      title.textContent = group.category;
      title.style.color = CATEGORY_COLORS[group.category] || '#6b7280';
    } else {
      title.textContent = group.label;
    }
    headerLeft.appendChild(title);

    // Count badge
    const count = document.createElement('span');
    count.className = 'group-count';
    count.textContent = group.captures.length;
    headerLeft.appendChild(count);

    header.appendChild(headerLeft);

    // Time range for timeline view
    if (type === 'timeline') {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'group-time';
      timeSpan.textContent = new Date(group.endTime).toLocaleTimeString();
      header.appendChild(timeSpan);
    }

    // Click handler for header
    header.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      if (type === 'category' && this.categoryManager) {
        this.categoryManager.toggleGroup(group.category);
      }
    });

    section.appendChild(header);

    // Content (cards)
    const content = document.createElement('div');
    content.className = 'group-content';

    for (const capture of group.captures) {
      const card = this.createGroupCard(capture);
      content.appendChild(card);
    }

    section.appendChild(content);

    return section;
  }

  createGroupCard(capture) {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.id = capture.id;

    if (this.selectedCapture?.id === capture.id) {
      card.classList.add('selected');
    }

    const category = capture.category || 'canvas';
    const categoryIconSvg = getCategoryIconString(category, 16);

    // Preview
    const preview = document.createElement('div');
    preview.className = 'group-card-preview';

    const hasImage = capture.canvas?.image && capture.method !== 'measureText';
    if (hasImage) {
      const img = document.createElement('img');
      img.src = capture.canvas.image;
      img.alt = 'Preview';
      img.loading = 'lazy';
      preview.appendChild(img);
    } else {
      const noPreview = document.createElement('span');
      noPreview.className = 'no-preview';
      noPreview.innerHTML = categoryIconSvg;
      preview.appendChild(noPreview);
    }
    card.appendChild(preview);

    // Info
    const info = document.createElement('div');
    info.className = 'group-card-info';

    const method = document.createElement('span');
    method.className = 'group-card-method';
    method.textContent = capture.method;
    method.style.color = CATEGORY_COLORS[category] || '#6b7280';
    info.appendChild(method);

    const time = document.createElement('span');
    time.className = 'group-card-time';
    time.textContent = this.formatTimeAgo(capture.timestamp);
    info.appendChild(time);

    card.appendChild(info);

    // Click handler
    card.addEventListener('click', () => {
      this.selectCapture(capture);
    });

    return card;
  }

  expandAllGroups() {
    if (this.viewMode === 'category' && this.categoryManager) {
      this.categoryManager.expandAll();
    }
    // Expand all DOM groups
    if (this.elements.groupedView) {
      this.elements.groupedView.querySelectorAll('.group-section').forEach(section => {
        section.classList.remove('collapsed');
      });
    }
  }

  collapseAllGroups() {
    if (this.viewMode === 'category' && this.categoryManager) {
      const groups = this.categoryManager.groupByCategory(this.filteredCaptures);
      this.categoryManager.collapseAll(groups);
    }
    // Collapse all DOM groups
    if (this.elements.groupedView) {
      this.elements.groupedView.querySelectorAll('.group-section').forEach(section => {
        section.classList.add('collapsed');
      });
    }
  }

  createGridCard(capture) {
    const card = document.createElement('div');
    card.className = 'grid-card';
    card.dataset.id = capture.id;

    if (this.selectedCapture?.id === capture.id) {
      card.classList.add('selected');
    }

    // Header with category
    const header = document.createElement('div');
    header.className = `grid-card-header cat-${capture.category || 'canvas'}`;

    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'grid-card-category';
    const categoryIcon = document.createElement('span');
    categoryIcon.className = 'category-icon';
    categoryIcon.innerHTML = getCategoryIconString(capture.category || 'canvas', 16);
    const categoryText = document.createElement('span');
    categoryText.textContent = capture.category || 'canvas';
    categoryDiv.appendChild(categoryIcon);
    categoryDiv.appendChild(categoryText);
    header.appendChild(categoryDiv);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'grid-card-time';
    timeSpan.textContent = this.formatTimeAgo(capture.timestamp);
    timeSpan.dataset.timestamp = capture.timestamp;
    header.appendChild(timeSpan);

    card.appendChild(header);

    // Body with preview
    const body = document.createElement('div');
    body.className = 'grid-card-body';

    const hasImage = capture.canvas?.image && capture.method !== 'measureText';
    if (hasImage) {
      const img = document.createElement('img');
      img.className = 'grid-card-preview';
      img.alt = 'Preview';
      img.onerror = () => {
        img.remove();
        const noPreview = document.createElement('div');
        noPreview.className = 'grid-card-no-preview';
        noPreview.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 L12 10 Q12 16, 8 18 Q4 20, 4 16 Q4 13, 7 12"/><path d="M7 12 L9 10"/><circle cx="12" cy="2" r="1.5"/></svg><span>Error</span>';
        body.appendChild(noPreview);
      };

      // Use lazy loading if available
      if (this.thumbLoader) {
        this.thumbLoader.observe(img, capture.canvas.image);
      } else {
        img.src = capture.canvas.image;
      }
      body.appendChild(img);
    } else {
      const noPreview = document.createElement('div');
      noPreview.className = 'grid-card-no-preview';
      const iconSvg = getCategoryIconString(capture.category || 'canvas', 24);
      noPreview.innerHTML = `<span style="font-size: 32px">${iconSvg}</span><span>${capture.method === 'measureText' ? 'Text' : this.getDataSummary(capture)}</span>`;
      body.appendChild(noPreview);
    }

    card.appendChild(body);

    // Footer with method and source
    const footer = document.createElement('div');
    footer.className = 'grid-card-footer';

    const methodSpan = document.createElement('span');
    methodSpan.className = 'grid-card-method';
    methodSpan.textContent = capture.method;
    methodSpan.style.color = CATEGORY_COLORS[capture.category] || CATEGORY_COLORS.canvas;
    footer.appendChild(methodSpan);

    const sourceSpan = document.createElement('span');
    sourceSpan.className = 'grid-card-source';
    sourceSpan.textContent = this.getShortUrl(capture.source?.url || 'Unknown');
    sourceSpan.title = capture.source?.url || 'Unknown';
    footer.appendChild(sourceSpan);

    card.appendChild(footer);

    return card;
  }

  createTableRow(capture) {
    const row = document.createElement('tr');
    row.dataset.id = capture.id;

    if (this.selectedCapture?.id === capture.id) {
      row.classList.add('selected');
    }

    // Preview cell with lazy loading
    const previewCell = document.createElement('td');
    previewCell.className = 'col-preview';
    const previewThumb = document.createElement('div');
    previewThumb.className = 'preview-thumb';

    const hasImage = capture.canvas?.image && capture.method !== 'measureText';

    if (hasImage) {
      const img = document.createElement('img');
      img.alt = 'Preview';
      img.onerror = () => {
        img.remove();
        const errorSpan = document.createElement('span');
        errorSpan.className = 'no-preview';
        errorSpan.textContent = 'Error';
        errorSpan.title = 'Image failed to load';
        errorSpan.style.color = 'var(--accent-error, #ef4444)';
        previewThumb.appendChild(errorSpan);
      };

      // Use lazy loading if available
      if (this.thumbLoader) {
        this.thumbLoader.observe(img, capture.canvas.image);
      } else {
        img.src = capture.canvas.image;
      }
      previewThumb.appendChild(img);
    } else {
      const noPreview = document.createElement('span');
      noPreview.className = 'no-preview';
      noPreview.textContent = capture.method === 'measureText' ? 'Text' : 'N/A';
      previewThumb.appendChild(noPreview);
    }
    previewCell.appendChild(previewThumb);
    row.appendChild(previewCell);

    // Category cell
    const categoryCell = document.createElement('td');
    categoryCell.className = 'col-category';
    const categoryBadge = document.createElement('span');
    categoryBadge.className = `category-badge category-${capture.category || 'canvas'}`;
    const categoryIcon = document.createElement('span');
    categoryIcon.className = 'category-icon';
    categoryIcon.innerHTML = getCategoryIconString(capture.category || 'canvas', 16);
    const categoryText = document.createElement('span');
    categoryText.textContent = capture.category || 'canvas';
    categoryBadge.appendChild(categoryIcon);
    categoryBadge.appendChild(categoryText);
    categoryBadge.style.color = CATEGORY_COLORS[capture.category] || CATEGORY_COLORS.canvas;
    categoryCell.appendChild(categoryBadge);
    row.appendChild(categoryCell);

    // Method cell
    const methodCell = document.createElement('td');
    methodCell.className = 'col-method';
    const methodBadge = document.createElement('span');
    methodBadge.className = `method-badge ${capture.method}`;
    methodBadge.textContent = capture.method;
    methodCell.appendChild(methodBadge);
    row.appendChild(methodCell);

    // Source cell
    const sourceCell = document.createElement('td');
    sourceCell.className = 'col-source';
    const sourceDiv = document.createElement('div');
    sourceDiv.className = 'source-cell';

    const sourceUrl = document.createElement('span');
    sourceUrl.className = 'source-url';
    sourceUrl.textContent = this.getShortUrl(capture.source?.url || 'Unknown');
    sourceUrl.title = capture.source?.url || 'Unknown';
    sourceDiv.appendChild(sourceUrl);

    const sourceLocation = document.createElement('span');
    sourceLocation.className = 'source-location';
    sourceLocation.textContent = `Line ${capture.source?.line || '?'}, Col ${capture.source?.column || '?'}`;
    sourceDiv.appendChild(sourceLocation);

    sourceCell.appendChild(sourceDiv);
    row.appendChild(sourceCell);

    // Data cell (category-specific summary)
    const dataCell = document.createElement('td');
    dataCell.className = 'col-data';
    dataCell.textContent = this.getDataSummary(capture);
    row.appendChild(dataCell);

    // Time cell
    const timeCell = document.createElement('td');
    timeCell.className = 'col-time';
    const timeDiv = document.createElement('div');
    timeDiv.className = 'time-cell';

    const timeAbsolute = document.createElement('span');
    timeAbsolute.className = 'time-absolute';
    timeAbsolute.textContent = new Date(capture.timestamp).toLocaleTimeString();
    timeDiv.appendChild(timeAbsolute);

    const timeRelative = document.createElement('span');
    timeRelative.className = 'time-relative';
    timeRelative.textContent = this.formatTimeAgo(capture.timestamp);
    timeRelative.dataset.timestamp = capture.timestamp; // For periodic updates
    timeDiv.appendChild(timeRelative);

    timeCell.appendChild(timeDiv);
    row.appendChild(timeCell);

    // Click handler
    row.addEventListener('click', () => {
      this.selectCapture(capture);
    });

    return row;
  }

  selectCapture(capture) {
    this.selectedCapture = capture;

    // Update selected row in table view
    if (this.elements.capturesBody) {
      this.elements.capturesBody.querySelectorAll('tr').forEach(row => {
        row.classList.toggle('selected', row.dataset.id === capture.id);
      });
    }

    // Update selected card in grid view
    if (this.virtualGrid) {
      this.virtualGrid.setSelected(capture.id);
    } else if (this.elements.gridView) {
      this.elements.gridView.querySelectorAll('.grid-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === capture.id);
      });
    }

    this.showSidebar(capture);
  }

  showSidebar(capture) {
    this.elements.sidebarContent.replaceChildren();

    // Image
    const imageDiv = document.createElement('div');
    imageDiv.className = 'sidebar-image';

    if (capture.canvas?.image && capture.method !== 'measureText') {
      const img = document.createElement('img');
      img.src = capture.canvas.image;
      img.alt = 'Canvas capture';
      imageDiv.appendChild(img);
    } else {
      const noImage = document.createElement('span');
      noImage.className = 'no-image';
      noImage.textContent = capture.method === 'measureText' ? 'Text metrics capture' : 'No image available';
      imageDiv.appendChild(noImage);
    }
    this.elements.sidebarContent.appendChild(imageDiv);

    // Details section
    const detailsSection = this.createSidebarSection('Details');
    const categoryIconSvg = getCategoryIconString(capture.category || 'canvas', 16);
    this.addSidebarRow(detailsSection, 'Category', `<span class="category-icon-inline">${categoryIconSvg}</span> ${capture.category || 'canvas'}`);
    this.addSidebarRow(detailsSection, 'Method', capture.method);
    this.addSidebarRow(detailsSection, 'Timestamp', new Date(capture.timestamp).toLocaleString());

    if (capture.canvas?.width && capture.canvas?.height) {
      this.addSidebarRow(detailsSection, 'Canvas Size', `${capture.canvas.width} x ${capture.canvas.height}`);
    }

    // Category-specific data
    if (capture.data) {
      const data = capture.data;
      Object.keys(data).forEach(key => {
        let value = data[key];
        if (typeof value === 'object') {
          value = JSON.stringify(value).substring(0, 100);
        }
        this.addSidebarRow(detailsSection, key, String(value), true);
      });
    }

    // Method-specific info (legacy canvas support)
    if (capture.arguments) {
      if (capture.method === 'measureText') {
        this.addSidebarRow(detailsSection, 'Text', capture.arguments.text || '', true);
        this.addSidebarRow(detailsSection, 'Font', capture.arguments.font || 'default', true);
        if (capture.result?.width !== undefined) {
          this.addSidebarRow(detailsSection, 'Measured Width', capture.result.width.toFixed(4), true);
        }
      } else if (capture.arguments.type) {
        this.addSidebarRow(detailsSection, 'MIME Type', capture.arguments.type, true);
      }
    }

    this.elements.sidebarContent.appendChild(detailsSection);

    // Source section
    const sourceSection = this.createSidebarSection('Source');
    this.addSidebarRow(sourceSection, 'Script', capture.source?.url || 'Unknown', true);
    this.addSidebarRow(sourceSection, 'Location', `Line ${capture.source?.line || '?'}, Col ${capture.source?.column || '?'}`, true);
    this.addSidebarRow(sourceSection, 'Page URL', capture.pageUrl || 'Unknown', true);
    this.elements.sidebarContent.appendChild(sourceSection);

    // Attribution section (best-effort; may be missing for older captures)
    const attrib = capture.attribution;
    if (attrib && typeof attrib === 'object') {
      const attribSection = this.createSidebarSection('Attribution');
      if (attrib.topLevelSiteBase || attrib.topLevelDomain) {
        this.addSidebarRow(
          attribSection,
          'Top-level',
          attrib.topLevelSiteBase || attrib.topLevelDomain || 'Unknown',
          true
        );
      }
      if (attrib.frameDomain) {
        const frameLabel = attrib.isInIframe ? `iframe (${attrib.frameDomain})` : attrib.frameDomain;
        this.addSidebarRow(attribSection, 'Frame', frameLabel, true);
      }
      if (attrib.sourceSiteBase || attrib.sourceDomain) {
        this.addSidebarRow(
          attribSection,
          'Script domain',
          attrib.sourceSiteBase || attrib.sourceDomain || 'Unknown',
          true
        );
      }
      if (typeof attrib.isThirdParty === 'boolean') {
        this.addSidebarRow(attribSection, 'Third-party', attrib.isThirdParty ? 'Yes' : 'No', true);
      }
      if (attrib.sourceKind) {
        this.addSidebarRow(attribSection, 'Source kind', attrib.sourceKind, true);
      }
      if (attribSection.children.length > 1) {
        this.elements.sidebarContent.appendChild(attribSection);
      }
    }

    // Stack trace section
    if (capture.stackTrace) {
      const stackSection = this.createSidebarSection('Stack Trace');

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(capture.stackTrace).then(() => {
          copyBtn.textContent = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      });
      stackSection.querySelector('.sidebar-section-title').appendChild(copyBtn);

      const stackPre = document.createElement('pre');
      stackPre.className = 'sidebar-stack';
      stackPre.textContent = capture.stackTrace;
      stackSection.appendChild(stackPre);

      this.elements.sidebarContent.appendChild(stackSection);
    }

    this.elements.detailSidebar.classList.add('open');
  }

  createSidebarSection(title) {
    const section = document.createElement('div');
    section.className = 'sidebar-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'sidebar-section-title';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    return section;
  }

  addSidebarRow(section, label, value, mono = false) {
    const row = document.createElement('div');
    row.className = 'sidebar-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'sidebar-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const valueEl = document.createElement('span');
    valueEl.className = 'sidebar-value' + (mono ? ' mono' : '');
    valueEl.textContent = value;
    row.appendChild(valueEl);

    section.appendChild(row);
  }

  closeSidebar() {
    this.elements.detailSidebar.classList.remove('open');
    this.selectedCapture = null;

    // Clear table row selection
    if (this.elements.capturesBody) {
      this.elements.capturesBody.querySelectorAll('tr').forEach(row => {
        row.classList.remove('selected');
      });
    }

    // Clear grid card selection
    if (this.virtualGrid) {
      this.virtualGrid.setSelected(null);
    } else if (this.elements.gridView) {
      this.elements.gridView.querySelectorAll('.grid-card').forEach(card => {
        card.classList.remove('selected');
      });
    }
  }

  async exportData(format) {
    try {
      const data = await chrome.runtime.sendMessage({
        type: 'EXPORT_DATA',
        format: format,
        filters: { tabId: this.tabId }
      });

      const blob = new Blob([data], {
        type: format === 'json' ? 'application/json' : 'text/csv'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `canvas-fingerprints-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Panel] Export failed:', err);
      alert('Export failed: ' + err.message);
    }
  }

  async clearCaptures() {
    if (!confirm('Clear all captures for this tab?')) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_CAPTURES',
        tabId: this.tabId
      });

      this.captures = [];
      this.selectedCapture = null;
      // Clear client-side deduplicator
      if (this.deduplicator) this.deduplicator.clear();
      this.closeSidebar();
      // Reset filters on clear
      if (this.elements.categoryFilter) {
        this.elements.categoryFilter.value = '';
      }
      this.currentFilter = '';
      if (this.elements.searchInput) {
        this.elements.searchInput.value = '';
      }
      this.searchQuery = '';
      this.applyFilters();
      // Update stats
      this.loadStats();
    } catch (err) {
      console.error('[Panel] Clear failed:', err);
    }
  }

  getDataSummary(capture) {
    const category = capture.category || 'canvas';
    const data = capture.data || {};

    switch (category) {
      case 'canvas':
        if (capture.canvas?.width && capture.canvas?.height) {
          return `${capture.canvas.width}x${capture.canvas.height}`;
        }
        if (capture.arguments?.text) {
          return `"${capture.arguments.text.substring(0, 20)}..."`;
        }
        return capture.arguments?.type || '-';
      case 'webgl':
        if (data.param) return data.param;
        if (data.extension) return data.extension;
        if (data.extensions) return `${data.extensions.length} extensions`;
        return '-';
      case 'audio':
        if (data.sampleRate) return `${data.sampleRate}Hz`;
        return data.type || '-';
      case 'navigator':
        if (typeof data.value === 'string') {
          return data.value.length > 30 ? data.value.substring(0, 27) + '...' : data.value;
        }
        if (typeof data.value === 'number') return String(data.value);
        if (Array.isArray(data.value)) return `[${data.value.length} items]`;
        return '-';
      case 'screen':
        if (data.value !== undefined) return String(data.value);
        return '-';
      case 'fonts':
        if (data.font) return data.font;
        return '-';
      case 'webrtc':
        if (data.candidate) return 'ICE candidate';
        if (data.devices) return `${data.devices.length} devices`;
        return data.type || '-';
      case 'storage':
        if (data.key) return data.key;
        if (data.name) return data.name;
        return '-';
      case 'timing':
        if (data.value !== undefined) return data.value.toFixed(2) + 'ms';
        if (data.entries) return `${data.entries.length} entries`;
        return '-';
      case 'speech':
        if (data.voices) return `${data.voices.length} voices`;
        return '-';
      case 'permissions':
        if (data.name) return data.name;
        return '-';
      case 'clientHints':
        if (data.brands) return `${data.brands.length} brands`;
        return data.platform || '-';
      case 'battery':
        if (data.level !== undefined) return `${Math.round(data.level * 100)}%`;
        return '-';
      // New anti-bot detection categories
      case 'behavior':
        if (data.eventType) return data.eventType;
        if (data.type) return data.type;
        return capture.method || '-';
      case 'automation':
        if (data.property) return data.property;
        if (data.detected !== undefined) return data.detected ? 'Detected' : 'Not detected';
        return capture.method || '-';
      case 'sensors':
        if (data.sensorType) return data.sensorType;
        if (data.alpha !== undefined) return `α:${data.alpha?.toFixed(1)}°`;
        return capture.method || '-';
      case 'gamepad':
        if (data.gamepads) return `${data.gamepads} connected`;
        if (data.id) return data.id.substring(0, 20);
        return capture.method || '-';
      case 'network':
        if (data.url) return this.getShortUrl(data.url);
        if (data.method) return data.method;
        return capture.method || '-';
      case 'media':
        if (data.mimeType) return data.mimeType;
        if (data.supported !== undefined) return data.supported ? 'Supported' : 'Not supported';
        return capture.method || '-';
      case 'geolocation':
        if (data.latitude && data.longitude) return `${data.latitude.toFixed(2)}, ${data.longitude.toFixed(2)}`;
        if (data.accuracy) return `±${data.accuracy}m`;
        return capture.method || '-';
      case 'dom':
        if (data.selector) return data.selector.substring(0, 25);
        if (data.property) return data.property;
        return capture.method || '-';
      case 'crypto':
        if (data.algorithm) return data.algorithm;
        if (data.length) return `${data.length} bytes`;
        return capture.method || '-';
      case 'hardware':
        if (data.deviceType) return data.deviceType;
        if (data.devices) return `${data.devices} devices`;
        return capture.method || '-';
      case 'clipboard':
        if (data.type) return data.type;
        if (data.length) return `${data.length} chars`;
        return capture.method || '-';
      case 'credentials':
        if (data.type) return data.type;
        if (data.id) return data.id.substring(0, 15);
        return capture.method || '-';
      default:
        return capture.method || '-';
    }
  }

  getShortUrl(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const filename = path.split('/').pop() || urlObj.hostname;
      return filename.length > 40 ? filename.substring(0, 37) + '...' : filename;
    } catch {
      return url.length > 40 ? url.substring(0, 37) + '...' : url;
    }
  }

  formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}

// Initialize panel
document.addEventListener('DOMContentLoaded', () => {
  try {
    window.panelInstance = new CrawlHQHookerPanel();
  } catch (err) {
    console.error('[Panel] Failed to create panel:', err);
  }
});
