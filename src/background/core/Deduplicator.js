/**
 * Deduplicator - Multi-level deduplication for fingerprint captures
 *
 * Levels of deduplication:
 * 1. ID-based: Same capture ID (already in storage)
 * 2. Method signature: Same method + source location within time window
 * 3. Content hash: Same data content within time window
 */

class Deduplicator {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 1000;
    this.sameMethodMinGapMs = options.sameMethodMinGapMs || 50;

    // Recent capture signatures for quick dedup
    this.recentSignatures = new Map(); // signature -> timestamp
    this.recentIds = new Set(); // seen IDs

    // Cleanup timer
    this.cleanupInterval = setInterval(() => this.cleanup(), 5000);

    this.DEBUG = false;
  }

  _log(...args) {
    if (this.DEBUG) {
      console.debug('[Deduplicator]', ...args);
    }
  }

  /**
   * Generate a signature for a capture based on its key attributes
   */
  generateSignature(capture) {
    const parts = [
      capture.category || 'canvas',
      capture.method,
      capture.source?.url || '',
      capture.source?.line || 0
    ];

    // For certain methods, include data in signature
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

  /**
   * Check if a capture is a duplicate
   * @param {Object} capture - The capture to check
   * @returns {Object} { isDuplicate: boolean, reason?: string }
   */
  isDuplicate(capture) {
    const now = Date.now();

    // Level 1: ID-based
    if (this.recentIds.has(capture.id)) {
      this._log('Duplicate by ID:', capture.id);
      return { isDuplicate: true, reason: 'duplicate_id' };
    }

    // Level 2: Method signature within time window
    const signature = this.generateSignature(capture);
    const lastSeen = this.recentSignatures.get(signature);

    if (lastSeen) {
      const timeSince = now - lastSeen;
      if (timeSince < this.sameMethodMinGapMs) {
        this._log('Duplicate by signature (too fast):', signature, 'timeSince:', timeSince);
        return { isDuplicate: true, reason: 'too_fast' };
      }
    }

    // Not a duplicate - record it
    this.recentIds.add(capture.id);
    this.recentSignatures.set(signature, now);

    return { isDuplicate: false };
  }

  /**
   * Check multiple captures and return only unique ones
   * @param {Array} captures - Array of captures to filter
   * @returns {Array} Unique captures
   */
  filterDuplicates(captures) {
    const unique = [];
    for (const capture of captures) {
      const result = this.isDuplicate(capture);
      if (!result.isDuplicate) {
        unique.push(capture);
      }
    }
    this._log('Filtered', captures.length, 'to', unique.length, 'unique captures');
    return unique;
  }

  /**
   * Clean up old signatures and IDs
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Clean old signatures
    for (const [sig, timestamp] of this.recentSignatures.entries()) {
      if (timestamp < cutoff) {
        this.recentSignatures.delete(sig);
      }
    }

    // Limit recentIds to prevent unbounded growth
    if (this.recentIds.size > 1000) {
      // Convert to array, keep last 500
      const ids = Array.from(this.recentIds);
      this.recentIds.clear();
      ids.slice(-500).forEach(id => this.recentIds.add(id));
    }

    this._log('Cleanup: signatures=', this.recentSignatures.size, 'ids=', this.recentIds.size);
  }

  /**
   * Clear all state
   */
  clear() {
    this.recentSignatures.clear();
    this.recentIds.clear();
    this._log('State cleared');
  }

  /**
   * Destroy the deduplicator
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Export for service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Deduplicator;
}
