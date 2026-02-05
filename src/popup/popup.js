/**
 * Popup Script - CrawlHQ Hooker
 * Handles the popup UI logic and rendering using safe DOM methods
 */

// SVG icons helper (loaded via classic script `../shared/category-icons.js`)
const getCategoryIconString =
  globalThis.CrawlHQCategoryIcons && typeof globalThis.CrawlHQCategoryIcons.getCategoryIconString === 'function'
    ? globalThis.CrawlHQCategoryIcons.getCategoryIconString
    : () => '';

const WHITELIST_KEY = 'crawlhqWhitelist';
const CLEAR_ON_RELOAD_KEY = 'crawlhqClearOnReload';

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

class CrawlHQHookerPopup {
  constructor() {
    this.captures = [];
    this.currentFilter = '';
    this.searchQuery = '';
    this.viewMode = 'grid';
    this.selectedCapture = null;
    this.currentTabId = null;
    this.currentUrl = null;
    this.currentDomain = null;
    this.isWhitelisted = false;
    this.isPaused = false;
    this.bufferedCount = 0;
    this.useWhitelistMessages = true;
    this.clearOnReload = true;

    // Health check state (detector injection probe)
    this._healthCheckKey = null;
    this._healthCheckResult = null; // null=unknown, true=active, false=inactive
    this._healthCheckTimer = null;
    this._healthCheckInFlight = false;

    this.init();
  }

  // Visible logging helper - always shows in console
  _log(...args) {
    console.log('%c[Popup]', 'background: #7c3aed; color: white; padding: 2px 6px; border-radius: 3px;', ...args);
  }

  _error(...args) {
    console.log('%c[Popup ERROR]', 'background: #f44336; color: white; padding: 2px 6px; border-radius: 3px;', ...args);
  }

  _warn(...args) {
    console.log('%c[Popup WARN]', 'background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px;', ...args);
  }

  async init() {
    this._log('Initializing CrawlHQ Hooker popup...');

    // Cache DOM elements
    this.elements = {
      totalCount: document.getElementById('totalCount'),
      // Custom dropdown elements
      categoryDropdown: document.getElementById('categoryDropdown'),
      categoryToggle: document.getElementById('categoryToggle'),
      categoryLabel: document.getElementById('categoryLabel'),
      categoryMenu: document.getElementById('categoryMenu'),
      gridViewBtn: document.getElementById('gridViewBtn'),
      listViewBtn: document.getElementById('listViewBtn'),
      capturesContainer: document.getElementById('capturesContainer'),
      emptyState: document.getElementById('emptyState'),
      detailPanel: document.getElementById('detailPanel'),
      detailContent: document.getElementById('detailContent'),
      closeDetailBtn: document.getElementById('closeDetailBtn'),
      clearBtn: document.getElementById('clearBtn'),
      refreshBtn: document.getElementById('refreshBtn'),
      // Pause elements
      pauseBtn: document.getElementById('pauseBtn'),
      pauseIcon: document.getElementById('pauseIcon'),
      playIcon: document.getElementById('playIcon'),
      pauseBufferBadge: document.getElementById('pauseBufferBadge'),
      // Health banner elements
      healthBanner: document.getElementById('healthBanner'),
      healthMessage: document.getElementById('healthMessage'),
      healthReloadBtn: document.getElementById('healthReloadBtn'),
      // Whitelist elements
      whitelistBanner: document.getElementById('whitelistBanner'),
      whitelistStatus: document.getElementById('whitelistStatus'),
      whitelistDomain: document.getElementById('whitelistDomain'),
      whitelistBtn: document.getElementById('whitelistBtn'),
      whitelistBtnText: document.getElementById('whitelistBtnText'),
      // Search elements
      searchInput: document.getElementById('searchInput'),
      clearSearchBtn: document.getElementById('clearSearchBtn'),
      // Modal elements
      confirmModal: document.getElementById('confirmModal'),
      modalCancelBtn: document.getElementById('modalCancelBtn'),
      modalConfirmBtn: document.getElementById('modalConfirmBtn'),
      // Reload behavior elements
      reloadModeBar: document.getElementById('reloadModeBar'),
      reloadModeHint: document.getElementById('reloadModeHint'),
      clearOnReloadToggle: document.getElementById('clearOnReloadToggle')
    };

    // Log DOM element status
    this._log('DOM elements found:', {
      totalCount: !!this.elements.totalCount,
      allCount: !!this.elements.allCount,
      categoryFilter: !!this.elements.categoryFilter,
      capturesContainer: !!this.elements.capturesContainer,
      emptyState: !!this.elements.emptyState,
      detailPanel: !!this.elements.detailPanel
    });

    // Validate critical elements
    if (!this.elements.capturesContainer) {
      this._error('CRITICAL: capturesContainer element not found!');
    }
    if (!this.elements.emptyState) {
      this._error('CRITICAL: emptyState element not found!');
    }

    // Get current tab
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this._log('chrome.tabs.query result:', tabs);

      if (!tabs || tabs.length === 0) {
        this._error('No active tab found!');
        this.currentTabId = null;
      } else {
        const tab = tabs[0];
        this.currentTabId = tab?.id;
        this.currentUrl = tab?.url;
        try {
          const url = new URL(tab?.url || '');
          this.currentDomain = url.hostname;
        } catch {
          this.currentDomain = tab?.url || 'Unknown';
        }
        this._log('Current tab ID:', this.currentTabId, 'URL:', tab?.url, 'Domain:', this.currentDomain);
      }
    } catch (err) {
      this._error('Failed to get current tab:', err);
      this.currentTabId = null;
    }

    // Bind events
    this.bindEvents();

    // Load pause + whitelist state
    await this.loadPauseState();

    // Load whitelist state
    await this.loadWhitelistState();

    // Load reload behavior setting
    await this.loadClearOnReloadSetting();

    // Load initial data
    await this.loadData();

    // Set up auto-refresh
    this.refreshInterval = setInterval(() => this.loadData(), 2000);
    this._log('Initialization complete. TabId:', this.currentTabId);
  }

  bindEvents() {
    // Custom dropdown toggle
    if (this.elements.categoryToggle) {
      this.elements.categoryToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCategoryDropdown();
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.elements.categoryDropdown && !this.elements.categoryDropdown.contains(e.target)) {
        this.closeCategoryDropdown();
      }
    });

    this.elements.gridViewBtn.addEventListener('click', () => {
      this.setViewMode('grid');
    });

    this.elements.listViewBtn.addEventListener('click', () => {
      this.setViewMode('list');
    });

    this.elements.closeDetailBtn.addEventListener('click', () => {
      this.hideDetailPanel();
    });

    this.elements.clearBtn.addEventListener('click', async () => {
      await this.clearCaptures();
    });

    this.elements.refreshBtn.addEventListener('click', async () => {
      await this.loadData();
    });

    if (this.elements.pauseBtn) {
      this.elements.pauseBtn.addEventListener('click', async () => {
        await this.togglePause();
      });
    }

    if (this.elements.healthReloadBtn) {
      this.elements.healthReloadBtn.addEventListener('click', async () => {
        if (this.currentTabId === null || this.currentTabId === undefined) return;

        // Reset health check so it runs again after reload.
        this.resetHealthCheck();
        this.hideHealthBanner();

        try {
          await chrome.tabs.reload(this.currentTabId);
        } catch (e) {
          this._warn('Failed to reload tab:', e?.message || e);
        }

        setTimeout(() => {
          this.loadData().catch((err) => {
            this._warn('Failed to refresh after reload:', err?.message || err);
          });
        }, 1000);
      });
    }

    // Close detail panel with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.selectedCapture) {
        this.hideDetailPanel();
      }
    });

    // Whitelist button
    if (this.elements.whitelistBtn) {
      this.elements.whitelistBtn.addEventListener('click', async () => {
        await this.toggleWhitelist();
      });
    }

    // Search input
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.elements.clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
        this.renderCaptures();
      });
    }

    // Clear search button
    if (this.elements.clearSearchBtn) {
      this.elements.clearSearchBtn.addEventListener('click', () => {
        this.searchQuery = '';
        this.elements.searchInput.value = '';
        this.elements.clearSearchBtn.style.display = 'none';
        this.renderCaptures();
      });
    }

    // Modal buttons
    if (this.elements.modalCancelBtn) {
      this.elements.modalCancelBtn.addEventListener('click', () => {
        this.hideConfirmModal();
      });
    }

    if (this.elements.modalConfirmBtn) {
      this.elements.modalConfirmBtn.addEventListener('click', async () => {
        this.hideConfirmModal();
        await this.performClearCaptures();
      });
    }

    // Close modal on overlay click
    if (this.elements.confirmModal) {
      this.elements.confirmModal.addEventListener('click', (e) => {
        if (e.target === this.elements.confirmModal) {
          this.hideConfirmModal();
        }
      });
    }

    // Clear-on-reload toggle
    if (this.elements.clearOnReloadToggle) {
      this.elements.clearOnReloadToggle.addEventListener('change', async (e) => {
        const enabled = e.target.checked === true;
        await this.setClearOnReload(enabled);
      });
    }
  }

  async loadClearOnReloadSetting() {
    let enabled;

    // Prefer service worker message (keeps behavior consistent with defaults).
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CLEAR_ON_RELOAD' });
      if (typeof response?.clearOnReload === 'boolean') {
        enabled = response.clearOnReload;
      }
    } catch {
      // Ignore and fall back to storage.
    }

    if (typeof enabled !== 'boolean') {
      try {
        const result = await chrome.storage.local.get([CLEAR_ON_RELOAD_KEY]);
        if (typeof result?.[CLEAR_ON_RELOAD_KEY] === 'boolean') {
          enabled = result[CLEAR_ON_RELOAD_KEY];
        }
      } catch (e) {
        this._warn('Failed to read clear-on-reload setting:', e?.message || e);
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
      this._warn('SET_CLEAR_ON_RELOAD message failed, falling back to storage:', e?.message || e);
    }

    try {
      await chrome.storage.local.set({ [CLEAR_ON_RELOAD_KEY]: this.clearOnReload });
    } catch (e) {
      this._error('Failed to persist clear-on-reload setting:', e);
    }
  }

  updateClearOnReloadUI() {
    if (this.elements.clearOnReloadToggle) {
      this.elements.clearOnReloadToggle.checked = this.clearOnReload === true;
    }
    if (this.elements.reloadModeHint) {
      if (this.clearOnReload) {
        this.elements.reloadModeHint.textContent = 'Clears captures on reload';
        this.elements.reloadModeHint.classList.add('active');
      } else {
        this.elements.reloadModeHint.textContent = 'Keeps historical data across reloads';
        this.elements.reloadModeHint.classList.remove('active');
      }
    }
  }

  async loadPauseState() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PAUSED' });
      this.isPaused = response?.paused === true;
      this.bufferedCount = typeof response?.bufferedCount === 'number' ? response.bufferedCount : 0;
    } catch (err) {
      this._warn('Failed to load pause state:', err?.message || err);
      this.isPaused = false;
      this.bufferedCount = 0;
    }

    this.updatePauseUI();
  }

  async togglePause() {
    this._log('Toggling pause state to:', !this.isPaused);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SET_PAUSED',
        paused: !this.isPaused
      });

      this.isPaused = response?.paused === true;
      this.bufferedCount = typeof response?.bufferedCount === 'number' ? response.bufferedCount : 0;
      this.updatePauseUI();

      // If resuming, captures may flush right away; refresh quickly.
      if (!this.isPaused) {
        setTimeout(() => {
          this.loadData().catch((e) => {
            this._warn('Failed to refresh after resuming:', e?.message || e);
          });
        }, 200);
      }
    } catch (err) {
      this._error('Failed to toggle pause state:', err);
    }
  }

  updatePauseUI() {
    if (this.elements.pauseBtn) {
      const label = this.isPaused ? 'Resume capture' : 'Pause capture';
      this.elements.pauseBtn.classList.toggle('paused', this.isPaused);
      this.elements.pauseBtn.title = label;
      this.elements.pauseBtn.setAttribute('aria-label', label);

      if (this.elements.pauseIcon) {
        this.elements.pauseIcon.style.display = this.isPaused ? 'none' : '';
      }
      if (this.elements.playIcon) {
        this.elements.playIcon.style.display = this.isPaused ? '' : 'none';
      }

      if (this.elements.pauseBufferBadge) {
        if (this.isPaused && this.bufferedCount > 0) {
          this.elements.pauseBufferBadge.textContent = String(this.bufferedCount);
          this.elements.pauseBufferBadge.style.display = '';
        } else {
          this.elements.pauseBufferBadge.style.display = 'none';
        }
      }
    }

    this.updateWhitelistUI();
  }

  resetHealthCheck() {
    this._healthCheckKey = null;
    this._healthCheckResult = null;
    this._healthCheckInFlight = false;
    if (this._healthCheckTimer) {
      clearTimeout(this._healthCheckTimer);
      this._healthCheckTimer = null;
    }
  }

  showHealthBanner(message) {
    if (!this.elements.healthBanner) return;
    if (this.elements.healthMessage) {
      this.elements.healthMessage.textContent = message;
    }
    this.elements.healthBanner.style.display = 'flex';
  }

  hideHealthBanner() {
    if (!this.elements.healthBanner) return;
    this.elements.healthBanner.style.display = 'none';
  }

  scheduleHealthCheckIfNeeded() {
    const key = `${this.currentTabId ?? 'null'}:${this.currentDomain ?? 'unknown'}`;
    if (this._healthCheckKey !== key) {
      this._healthCheckKey = key;
      this._healthCheckResult = null;
      if (this._healthCheckTimer) {
        clearTimeout(this._healthCheckTimer);
        this._healthCheckTimer = null;
      }
      this.hideHealthBanner();
    }

    if (!this.isWhitelisted || this.isPaused) {
      this.hideHealthBanner();
      return;
    }

    if (this.captures.length > 0) {
      this._healthCheckResult = true;
      this.hideHealthBanner();
      return;
    }

    if (this._healthCheckResult === false) {
      this.showHealthBanner('Detector not injected. Try reloading. Check extension Site access permissions.');
      return;
    }

    if (this._healthCheckResult !== null || this._healthCheckInFlight || this._healthCheckTimer) {
      return;
    }

    // Debounced one-time probe while captures are still 0.
    this._healthCheckTimer = setTimeout(() => {
      this._healthCheckTimer = null;
      this.runHealthCheck().catch((e) => {
        this._warn('Health check failed:', e?.message || e);
      });
    }, 700);
  }

  async runHealthCheck() {
    if (this._healthCheckInFlight) return;
    if (!this.isWhitelisted || this.isPaused) return;
    if (this.currentTabId === null || this.currentTabId === undefined) return;

    const key = `${this.currentTabId ?? 'null'}:${this.currentDomain ?? 'unknown'}`;
    if (this._healthCheckKey !== key) return;

    this._healthCheckInFlight = true;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.currentTabId },
        world: 'MAIN',
        func: () => !!window.__FINGERPRINT_HOOKER_ACTIVE__
      });

      const active = Array.isArray(results) && results.some((r) => r?.result === true);
      this._healthCheckResult = active;

      if (!active) {
        this.showHealthBanner('Detector not injected. Try reloading. Check extension Site access permissions.');
      } else {
        this.hideHealthBanner();
      }
    } catch (e) {
      this._healthCheckResult = false;
      this.showHealthBanner('Detector not injected. Try reloading. Check extension Site access permissions.');
    } finally {
      this._healthCheckInFlight = false;
    }
  }

  async loadWhitelistState() {
    if (!this.currentDomain) {
      this._warn('No domain to check whitelist for');
      return;
    }

    const domainLower = this.currentDomain.toLowerCase();
    let whitelisted = false;
    let gotValidResponse = false;

    if (this.useWhitelistMessages) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_WHITELIST_STATUS',
          domain: this.currentDomain
        });

        if (typeof response?.whitelisted === 'boolean') {
          whitelisted = response.whitelisted === true;
          gotValidResponse = true;
        } else {
          if (String(response?.error || '').includes('Unknown message type')) {
            this.useWhitelistMessages = false;
          }
          throw new Error(response?.error || 'Invalid whitelist response');
        }
      } catch (err) {
        this._warn('Whitelist status message failed, falling back to storage:', err?.message || err);
        // Fall through to storage fallback below
      }
    }

    if (!gotValidResponse) {
      try {
        const result = await chrome.storage.local.get([WHITELIST_KEY]);
        const domains = Array.isArray(result?.[WHITELIST_KEY]) ? result[WHITELIST_KEY] : [];
        whitelisted = domains.map(d => String(d).toLowerCase()).includes(domainLower);
      } catch (storageErr) {
        this._error('Failed to load whitelist state from storage:', storageErr);
        whitelisted = false;
      }
    }

    this.isWhitelisted = whitelisted;
    this.updateWhitelistUI();
    this._log('Whitelist status for', this.currentDomain, ':', this.isWhitelisted);

    // Ensure the action badge doesn't show stale counts when not monitoring.
    if (!this.isWhitelisted) {
      await this.clearBadgeForCurrentTab();
    }
  }

  async clearBadgeForCurrentTab() {
    if (this.currentTabId === null || this.currentTabId === undefined) return;
    try {
      await chrome.action.setBadgeText({ text: '', tabId: this.currentTabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#666666', tabId: this.currentTabId });
    } catch (e) {
      // Not fatal (e.g. API not available in some contexts)
      this._warn('Failed to clear badge for tab:', this.currentTabId, e?.message || e);
    }
  }

  updateWhitelistUI() {
    if (!this.elements.whitelistBtn) return;

    // Update domain display
    if (this.elements.whitelistDomain) {
      this.elements.whitelistDomain.textContent = this.currentDomain || 'Unknown';
    }

    // Update status text and button
    if (this.isWhitelisted) {
      if (this.isPaused) {
        this.elements.whitelistStatus.textContent = 'Monitoring paused';
        this.elements.whitelistStatus.classList.remove('active');
        this.elements.whitelistStatus.classList.add('paused');
      } else {
        this.elements.whitelistStatus.textContent = 'Monitoring active';
        this.elements.whitelistStatus.classList.remove('paused');
        this.elements.whitelistStatus.classList.add('active');
      }
      this.elements.whitelistBtn.classList.add('active');
      this.elements.whitelistBtnText.textContent = 'Stop monitoring';
    } else {
      this.elements.whitelistStatus.textContent = 'Not monitoring';
      this.elements.whitelistStatus.classList.remove('active');
      this.elements.whitelistStatus.classList.remove('paused');
      this.elements.whitelistBtn.classList.remove('active');
      this.elements.whitelistBtnText.textContent = 'Monitor this page';
    }
  }

  async toggleWhitelist() {
    if (!this.currentDomain) {
      this._warn('No domain to whitelist');
      return;
    }

    const newState = !this.isWhitelisted;
    this._log('Toggling whitelist for', this.currentDomain, 'to', newState);

    try {
      let updated = false;

      try {
        if (!this.useWhitelistMessages) {
          throw new Error('Whitelist messages disabled');
        }

        const response = await chrome.runtime.sendMessage({
          type: newState ? 'ADD_TO_WHITELIST' : 'REMOVE_FROM_WHITELIST',
          domain: this.currentDomain
        });

        if (response?.success === true) {
          updated = true;
        } else {
          if (String(response?.error || '').includes('Unknown message type')) {
            this.useWhitelistMessages = false;
          }
          throw new Error(response?.error || 'Unknown error');
        }
      } catch (messageErr) {
        // Fallback: update whitelist directly in storage (service worker listens to storage changes).
        this._warn('Whitelist message failed, falling back to storage update:', messageErr?.message || messageErr);

        const result = await chrome.storage.local.get([WHITELIST_KEY]);
        const current = Array.isArray(result?.[WHITELIST_KEY]) ? result[WHITELIST_KEY] : [];
        const domainLower = String(this.currentDomain).toLowerCase();

        const nextSet = new Set(current.map(d => String(d).toLowerCase()));
        if (newState) {
          nextSet.add(domainLower);
        } else {
          nextSet.delete(domainLower);
        }

        await chrome.storage.local.set({ [WHITELIST_KEY]: Array.from(nextSet) });
        updated = true;
      }

      if (!updated) return;

      this.isWhitelisted = newState;
      this.updateWhitelistUI();
      this._log('Whitelist updated successfully');

      // If we just stopped monitoring, clear existing captures for this tab
      // so the popup doesn't look like it is still actively monitoring.
      if (!newState && this.currentTabId !== null && this.currentTabId !== undefined) {
        try {
          await chrome.runtime.sendMessage({
            type: 'CLEAR_CAPTURES',
            tabId: this.currentTabId
          });
          this.captures = [];
          this.renderCaptures();
          await this.loadStats();
          this._log('Cleared captures after stopping monitoring:', this.currentTabId);
        } catch (e) {
          this._warn('Failed to clear captures after stopping monitoring:', e?.message || e);
        }
      }

      // When enabling monitoring, clear captures and reload the page
      if (newState && this.currentTabId !== null && this.currentTabId !== undefined && this.currentUrl?.startsWith('http')) {
        try {
          // Clear any stale captures first
          await chrome.runtime.sendMessage({
            type: 'CLEAR_CAPTURES',
            tabId: this.currentTabId
          });
          this.captures = [];
          this.renderCaptures();

          // Reset health check
          this.resetHealthCheck();
          this.hideHealthBanner();

          // Reload to inject detector at document_start
          await chrome.tabs.reload(this.currentTabId);
          this._log('Cleared and reloaded tab to start monitoring:', this.currentTabId);
        } catch (e) {
          this._warn('Failed to clear/reload tab:', e?.message || e);
        }
      }

      // When disabling monitoring, reload to clear the detector from the page
      if (!newState && this.currentTabId !== null && this.currentTabId !== undefined && this.currentUrl?.startsWith('http')) {
        try {
          await chrome.tabs.reload(this.currentTabId);
          this._log('Reloaded tab to clear monitoring state:', this.currentTabId);
        } catch (e) {
          this._warn('Failed to reload tab (monitoring state will apply on next navigation):', e?.message || e);
        }
      }
    } catch (err) {
      this._error('Failed to toggle whitelist:', err);
    }
  }

  async loadData() {
    // Keep pause + whitelist state fresh (can change from other extension UIs)
    await this.loadPauseState();

    // Keep whitelist state fresh (can change from other extension UIs)
    await this.loadWhitelistState();

    // If not monitoring, don't show or refresh captures for this page.
    if (!this.isWhitelisted) {
      this.resetHealthCheck();
      this.hideHealthBanner();
      if (this.captures.length > 0) {
        this.captures = [];
        this.renderCaptures();
      } else {
        // Ensure empty state is visible when not monitoring
        this.renderCaptures();
      }
      await this.loadStats();
      return;
    }

    // Sequential to avoid race where stats show 0 while captures render.
    await this.loadCaptures();
    await this.loadStats();

    this.scheduleHealthCheckIfNeeded();
  }

  async loadCaptures() {
    this._log('Loading captures for tab:', this.currentTabId);

    if (this.currentTabId === null || this.currentTabId === undefined) {
      this._warn('No valid tab ID, cannot load captures');
      this.captures = [];
      this.renderCaptures();
      return;
    }

    try {
      this._log('Sending GET_CAPTURES_BY_TAB message...');
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CAPTURES_BY_TAB',
        tabId: this.currentTabId
      });

      this._log('Received response:', response);
      this._log('Response type:', typeof response, 'isArray:', Array.isArray(response));

      // Handle error responses from service worker
      if (response && response.error) {
        this._error('Service worker returned error:', response.error);
        this.captures = [];
      } else if (response === undefined || response === null) {
        this._warn('Response is null/undefined - service worker may not be responding');
        this.captures = [];
      } else {
        this.captures = Array.isArray(response) ? response : [];
      }

      this._log('Loaded', this.captures.length, 'captures');

      // Log first capture details for debugging
      if (this.captures.length > 0) {
        const first = this.captures[0];
        this._log('First capture sample:', {
          id: first.id,
          method: first.method,
          tabId: first.tabId,
          hasCanvasImage: !!first.canvas?.image,
          imageLength: first.canvas?.image?.length || 0,
          timestamp: first.timestamp
        });
      }

      // Update category filter with detected categories
      this.updateCategoryFilter();
      this.renderCaptures();
    } catch (err) {
      this._error('Failed to load captures:', err);
      this._error('Error details:', err.message, err.stack);
      this.captures = [];
      this.renderCaptures();
    }
  }

  toggleCategoryDropdown() {
    if (this.elements.categoryDropdown) {
      this.elements.categoryDropdown.classList.toggle('open');
    }
  }

  closeCategoryDropdown() {
    if (this.elements.categoryDropdown) {
      this.elements.categoryDropdown.classList.remove('open');
    }
  }

  selectCategory(value, label) {
    this.currentFilter = value;
    if (this.elements.categoryLabel) {
      this.elements.categoryLabel.textContent = label;
    }
    this.closeCategoryDropdown();
    this.renderCaptures();
    this._log('Selected category:', value || 'All');
  }

  updateCategoryFilter() {
    if (!this.elements.categoryMenu) return;

    // Get unique categories from captures
    const detectedCategories = new Set();
    for (const capture of this.captures) {
      const category = capture.category || 'canvas';
      detectedCategories.add(category);
    }

    // Clear and rebuild dropdown menu
    this.elements.categoryMenu.innerHTML = '';

    // Add "All Categories" option
    const allItem = document.createElement('button');
    allItem.className = 'dropdown-item' + (this.currentFilter === '' ? ' active' : '');
    allItem.innerHTML = `
      <span>All Categories</span>
      <span class="item-count">${this.captures.length}</span>
    `;
    allItem.addEventListener('click', () => this.selectCategory('', `All Categories (${this.captures.length})`));
    this.elements.categoryMenu.appendChild(allItem);

    // Sort categories and add them
    const sortedCategories = Array.from(detectedCategories).sort();
    for (const category of sortedCategories) {
      const count = this.captures.filter(c => (c.category || 'canvas') === category).length;
      const iconSvg = getCategoryIconString(category, 16);
      const item = document.createElement('button');
      item.className = 'dropdown-item' + (this.currentFilter === category ? ' active' : '');
      item.innerHTML = `
        <span class="dropdown-icon">${iconSvg}</span>
        <span class="dropdown-category">${category}</span>
        <span class="item-count">${count}</span>
      `;
      item.addEventListener('click', () => this.selectCategory(category, `${category} (${count})`));
      this.elements.categoryMenu.appendChild(item);
    }

    // Update label if filter no longer valid
    if (this.currentFilter && !detectedCategories.has(this.currentFilter)) {
      this.currentFilter = '';
    }

    // Update toggle label
    if (this.elements.categoryLabel) {
      if (this.currentFilter) {
        const iconSvg = getCategoryIconString(this.currentFilter, 16);
        const count = this.captures.filter(c => (c.category || 'canvas') === this.currentFilter).length;
        this.elements.categoryLabel.innerHTML = `<span class="dropdown-icon-label">${iconSvg}</span> ${this.currentFilter} (${count})`;
      } else {
        this.elements.categoryLabel.textContent = `All Categories (${this.captures.length})`;
      }
    }

    this._log('Updated category filter with', detectedCategories.size, 'categories');
  }

  async loadStats() {
    // Count for current tab
    const tabCount = this.captures.length;
    this.elements.totalCount.textContent = tabCount;
    this._log('Stats updated - This page:', tabCount);
  }

  renderCaptures() {
    this._log('Rendering captures, total:', this.captures.length, 'filter:', this.currentFilter || 'none', 'search:', this.searchQuery || 'none');

    let filtered = this.captures;

    // Filter by category dropdown
    if (this.currentFilter) {
      filtered = filtered.filter(c => c.category === this.currentFilter || c.method === this.currentFilter);
      this._log('After category filter:', filtered.length, 'captures');
    }

    // Filter by search query
    if (this.searchQuery) {
      filtered = filtered.filter(c => {
        const category = (c.category || '').toLowerCase();
        const method = (c.method || '').toLowerCase();
        const source = (c.source?.url || '').toLowerCase();
        return category.includes(this.searchQuery) ||
               method.includes(this.searchQuery) ||
               source.includes(this.searchQuery);
      });
      this._log('After search filter:', filtered.length, 'captures');
    }

    // Clear container
    this.elements.capturesContainer.replaceChildren();

    // Update empty state visibility
    if (filtered.length === 0) {
      this._log('No captures to display, showing empty state');
      this.elements.emptyState.classList.add('visible');
      this.elements.emptyState.style.display = 'flex';
      this.elements.capturesContainer.style.display = 'none';
      return;
    }

    this._log('Displaying', filtered.length, 'captures');
    this.elements.emptyState.classList.remove('visible');
    this.elements.emptyState.style.display = 'none';
    this.elements.capturesContainer.style.display = '';

    // Create cards using DOM methods
    filtered.forEach((capture, index) => {
      this._log(`Creating card ${index + 1}/${filtered.length}:`, capture.id, capture.method);
      const card = this.createCaptureCard(capture);
      this.elements.capturesContainer.appendChild(card);
    });

    this._log('Rendered', filtered.length, 'capture cards');
  }

  createCaptureCard(capture) {
    const card = document.createElement('div');
    card.dataset.id = capture.id;

    // Get category (new format) or default to canvas (legacy)
    const category = capture.category || 'canvas';
    const categoryIconSvg = getCategoryIconString(category, 24);
    const categoryColor = CATEGORY_COLORS[category] || '#6b7280';

    // Add category class to card for CSS styling
    card.className = `capture-card cat-${category}`;

    // Check for image in multiple possible locations (canvas captures have images)
    const imageData = capture.data?.canvas?.image || capture.canvas?.image || capture.image || capture.dataUrl;
    const hasImage = imageData && category === 'canvas' && capture.method !== 'measureText';

    // For grid view, use new structure with category header
    if (this.viewMode === 'grid') {
      // Category header bar with colored background
      const headerDiv = document.createElement('div');
      headerDiv.className = `capture-header cat-${category}`;

      const categorySpan = document.createElement('span');
      categorySpan.className = 'capture-category';
      categorySpan.style.color = categoryColor;
      categorySpan.innerHTML = `<span class="category-icon-inline">${categoryIconSvg}</span> ${category}`;
      headerDiv.appendChild(categorySpan);

      card.appendChild(headerDiv);

      // Image/preview container
      const imageDiv = document.createElement('div');
      imageDiv.className = 'capture-image';

      if (hasImage) {
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = 'Canvas capture';
        img.loading = 'lazy';
        img.onerror = () => {
          img.style.display = 'none';
          const errorSpan = document.createElement('span');
          errorSpan.className = 'no-image';
          errorSpan.textContent = 'Error';
          imageDiv.appendChild(errorSpan);
        };
        imageDiv.appendChild(img);
      } else {
        // Show category icon for non-image captures
        const iconSpan = document.createElement('span');
        iconSpan.className = 'category-icon-large';
        iconSpan.innerHTML = categoryIconSvg;
        imageDiv.appendChild(iconSpan);
      }
      card.appendChild(imageDiv);

      // Info footer
      const infoDiv = document.createElement('div');
      infoDiv.className = 'capture-info';

      const methodSpan = document.createElement('span');
      methodSpan.className = 'capture-method';
      methodSpan.textContent = capture.method;
      methodSpan.style.color = categoryColor;
      infoDiv.appendChild(methodSpan);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'capture-time';
      timeSpan.textContent = this.formatTimeAgo(capture.timestamp);
      infoDiv.appendChild(timeSpan);

      card.appendChild(infoDiv);
    } else {
      // List view - original structure
      const imageDiv = document.createElement('div');
      imageDiv.className = 'capture-image';

      if (hasImage) {
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = 'Canvas capture';
        img.loading = 'lazy';
        img.onerror = () => {
          img.style.display = 'none';
          const errorSpan = document.createElement('span');
          errorSpan.className = 'no-image';
          errorSpan.textContent = 'Error';
          imageDiv.appendChild(errorSpan);
        };
        imageDiv.appendChild(img);
      } else {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'category-icon';
        iconSpan.innerHTML = categoryIconSvg;
        iconSpan.style.fontSize = '28px';
        imageDiv.appendChild(iconSpan);
      }

      const infoDiv = document.createElement('div');
      infoDiv.className = 'capture-info';

      const categorySpan = document.createElement('span');
      categorySpan.className = 'capture-category';
      categorySpan.style.color = categoryColor;
      categorySpan.innerHTML = `<span class="category-icon-inline">${categoryIconSvg}</span> ${category}`;
      infoDiv.appendChild(categorySpan);

      const methodSpan = document.createElement('span');
      methodSpan.className = 'capture-method';
      methodSpan.textContent = capture.method;
      infoDiv.appendChild(methodSpan);

      const sourceSpan = document.createElement('span');
      sourceSpan.className = 'capture-source';
      sourceSpan.title = capture.source?.url || 'Unknown';
      sourceSpan.textContent = this.getShortSource(capture.source?.url || 'Unknown');
      infoDiv.appendChild(sourceSpan);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'capture-time';
      timeSpan.textContent = this.formatTimeAgo(capture.timestamp);
      infoDiv.appendChild(timeSpan);

      card.appendChild(imageDiv);
      card.appendChild(infoDiv);
    }

    // Click handler
    card.addEventListener('click', () => {
      this.showDetailPanel(capture);
    });

    return card;
  }

  showDetailPanel(capture) {
    this.selectedCapture = capture;
    this._log('Showing detail panel for capture:', capture.id, capture.method);

    // Clear existing content
    this.elements.detailContent.replaceChildren();

    // Get category info
    const category = capture.category || 'canvas';
    const categoryIconSvg = getCategoryIconString(category, 32);
    const categoryColor = CATEGORY_COLORS[category] || '#6b7280';

    // Image/Preview section
    const imageDiv = document.createElement('div');
    imageDiv.className = 'detail-image';

    // Check for image (canvas category only)
    const imageData = capture.data?.canvas?.image || capture.canvas?.image || capture.image || capture.dataUrl;
    const hasImage = imageData && category === 'canvas' && capture.method !== 'measureText';

    if (hasImage) {
      const img = document.createElement('img');
      img.src = imageData;
      img.alt = 'Canvas capture';
      imageDiv.appendChild(img);
    } else {
      // Show category icon
      const iconSpan = document.createElement('span');
      iconSpan.innerHTML = categoryIconSvg;
      iconSpan.style.fontSize = '48px';
      imageDiv.appendChild(iconSpan);
    }
    this.elements.detailContent.appendChild(imageDiv);

    // Capture Info section
    const infoSection = this.createDetailSection('Capture Info');
    this.addDetailRow(infoSection, 'Category', `<span class="category-icon-inline">${categoryIconSvg}</span> ${category}`);
    this.addDetailRow(infoSection, 'Method', capture.method);
    this.addDetailRow(infoSection, 'Timestamp', new Date(capture.timestamp).toLocaleString());

    // Add category-specific data
    const data = capture.data || capture;
    if (data.canvas) {
      this.addDetailRow(infoSection, 'Canvas Size', `${data.canvas.width || 'N/A'} x ${data.canvas.height || 'N/A'}`, 'mono');
    }

    // Add method-specific arguments (legacy support)
    if (capture.arguments || data.arguments) {
      const args = capture.arguments || data.arguments;
      if (capture.method === 'measureText' && args) {
        this.addDetailRow(infoSection, 'Text', args.text || '', 'mono');
        this.addDetailRow(infoSection, 'Font', args.font || 'default', 'mono');
      } else if (args?.type) {
        this.addDetailRow(infoSection, 'MIME Type', args.type, 'mono');
      }
    }

    // Show captured data for new format
    if (capture.data && typeof capture.data === 'object') {
      const dataSection = this.createDetailSection('Captured Data');
      Object.entries(capture.data).forEach(([key, value]) => {
        if (key !== 'canvas' && key !== 'arguments') {
          const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
          this.addDetailRow(dataSection, key, displayValue.substring(0, 100), 'mono');
        }
      });
      if (dataSection.children.length > 1) {
        this.elements.detailContent.appendChild(dataSection);
      }
    }

    this.elements.detailContent.appendChild(infoSection);

    // Source section
    const sourceSection = this.createDetailSection('Source');
    this.addDetailRow(sourceSection, 'Script', capture.source?.url || 'Unknown', 'mono');
    this.addDetailRow(sourceSection, 'Location', `Line ${capture.source?.line || 'N/A'}, Col ${capture.source?.column || 'N/A'}`, 'mono');
    this.addDetailRow(sourceSection, 'Page', capture.pageUrl || 'Unknown', 'mono');
    this.elements.detailContent.appendChild(sourceSection);

    // Attribution section (best-effort; may be missing for older captures)
    const attrib = capture.attribution;
    if (attrib && typeof attrib === 'object') {
      const attribSection = this.createDetailSection('Attribution');
      if (attrib.topLevelSiteBase || attrib.topLevelDomain) {
        this.addDetailRow(
          attribSection,
          'Top-level',
          attrib.topLevelSiteBase || attrib.topLevelDomain || 'Unknown',
          'mono'
        );
      }
      if (attrib.frameDomain) {
        const frameLabel = attrib.isInIframe ? `iframe (${attrib.frameDomain})` : attrib.frameDomain;
        this.addDetailRow(attribSection, 'Frame', frameLabel, 'mono');
      }
      if (attrib.sourceSiteBase || attrib.sourceDomain) {
        this.addDetailRow(
          attribSection,
          'Script domain',
          attrib.sourceSiteBase || attrib.sourceDomain || 'Unknown',
          'mono'
        );
      }
      if (typeof attrib.isThirdParty === 'boolean') {
        this.addDetailRow(attribSection, 'Third-party', attrib.isThirdParty ? 'Yes' : 'No');
      }
      if (attrib.sourceKind) {
        this.addDetailRow(attribSection, 'Source kind', attrib.sourceKind);
      }
      if (attribSection.children.length > 1) {
        this.elements.detailContent.appendChild(attribSection);
      }
    }

    // Stack trace section
    if (capture.stackTrace) {
      const stackSection = this.createDetailSection('Stack Trace');
      const pre = document.createElement('pre');
      pre.className = 'stack-trace';
      pre.textContent = capture.stackTrace;
      stackSection.appendChild(pre);
      this.elements.detailContent.appendChild(stackSection);
    }

    this.elements.detailPanel.classList.add('active');
  }

  createDetailSection(title) {
    const section = document.createElement('div');
    section.className = 'detail-section';

    const titleEl = document.createElement('div');
    titleEl.className = 'detail-section-title';
    titleEl.textContent = title;
    section.appendChild(titleEl);

    return section;
  }

  addDetailRow(section, label, value, valueClass = '') {
    const row = document.createElement('div');
    row.className = 'detail-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'detail-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const valueEl = document.createElement('span');
    valueEl.className = 'detail-value' + (valueClass ? ` ${valueClass}` : '');
    valueEl.textContent = value;
    row.appendChild(valueEl);

    section.appendChild(row);
  }

  hideDetailPanel() {
    this.elements.detailPanel.classList.remove('active');
    this.selectedCapture = null;
  }

  setViewMode(mode) {
    this.viewMode = mode;

    this.elements.capturesContainer.classList.remove('grid-view', 'list-view');
    this.elements.capturesContainer.classList.add(`${mode}-view`);

    this.elements.gridViewBtn.classList.toggle('active', mode === 'grid');
    this.elements.listViewBtn.classList.toggle('active', mode === 'list');

    this.renderCaptures();
  }

  showConfirmModal() {
    if (this.elements.confirmModal) {
      this.elements.confirmModal.classList.add('active');
    }
  }

  hideConfirmModal() {
    if (this.elements.confirmModal) {
      this.elements.confirmModal.classList.remove('active');
    }
  }

  async clearCaptures() {
    this.showConfirmModal();
  }

  async performClearCaptures() {
    this._log('Clearing captures for tab:', this.currentTabId);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CLEAR_CAPTURES',
        tabId: this.currentTabId
      });

      this._log('Clear response:', response);

      if (response && response.error) {
        this._error('Failed to clear captures:', response.error);
        return;
      }

      this.captures = [];
      this.renderCaptures();
      await this.loadStats();
      this._log('Captures cleared successfully');
    } catch (err) {
      this._error('Error clearing captures:', err);
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

  getShortSource(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      const filename = path.split('/').pop() || path;
      return filename.length > 30 ? filename.substring(0, 27) + '...' : filename;
    } catch {
      return url.length > 30 ? url.substring(0, 27) + '...' : url;
    }
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new CrawlHQHookerPopup();
});
