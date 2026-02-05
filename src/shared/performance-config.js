/**
 * Centralized Performance Configuration
 * All performance-related settings in one place for easy tuning
 */

const PERFORMANCE_CONFIG = {
  // ============ Capture Processing ============
  capture: {
    // Batch window in ms - group rapid captures together
    batchWindowMs: 100,
    // Max captures per batch (prevents memory spikes)
    maxBatchSize: 20,
    // Debounce delay for consecutive same-method captures
    dedupeWindowMs: 50
  },

  // ============ Deduplication ============
  dedupe: {
    // Enable content-based deduplication
    enabled: true,
    // Time window for considering captures as potential duplicates
    windowMs: 1000,
    // Minimum time between same method calls to be considered unique
    sameMethodMinGapMs: 50
  },

  // ============ Thumbnails ============
  thumbnail: {
    // Maximum thumbnail dimension
    maxSize: 200,
    // JPEG quality for thumbnails (0-1)
    quality: 0.8,
    // Enable lazy loading via IntersectionObserver
    lazyLoad: true,
    // Placeholder while loading
    placeholder: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Crect fill="%23333" width="48" height="48"/%3E%3C/svg%3E'
  },

  // ============ Virtual Scrolling ============
  virtualScroll: {
    // Enable virtual scrolling for tables
    enabled: true,
    // Row height in pixels
    rowHeight: 60,
    // Number of rows to render above/below viewport
    overscan: 5,
    // Minimum rows to use virtual scrolling (below this, render all)
    minRowsForVirtual: 50
  },

  // ============ DOM Updates ============
  dom: {
    // Enable RAF batching for DOM updates
    batchUpdates: true,
    // Max DOM updates per animation frame
    maxUpdatesPerFrame: 10,
    // Debounce resize/scroll handlers
    scrollDebounceMs: 16,
    resizeDebounceMs: 100
  },

  // ============ Storage ============
  storage: {
    // Cache TTL for storage reads
    cacheTtlMs: 500,
    // Max captures per tab
    maxPerTab: 100,
    // Max total captures
    maxTotal: 500,
    // Max age before cleanup (7 days)
    maxAgeMs: 7 * 24 * 60 * 60 * 1000
  },

  // ============ Logging ============
  debug: {
    // Enable performance timing logs
    timingLogs: false,
    // Enable verbose capture logs
    captureLogs: false,
    // Enable DOM update logs
    domLogs: false
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.PERFORMANCE_CONFIG = PERFORMANCE_CONFIG;
}
if (typeof globalThis !== 'undefined') {
  globalThis.PERFORMANCE_CONFIG = PERFORMANCE_CONFIG;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PERFORMANCE_CONFIG;
}
