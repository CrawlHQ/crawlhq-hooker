/**
 * TimelineManager - Time-based capture grouping with adaptive bucketing
 *
 * Groups captures into time buckets that adapt based on the time range:
 * - 0-1 min: 5-second buckets
 * - 1-10 min: 30-second buckets
 * - 10-60 min: 2-minute buckets
 * - 1+ hour: 10-minute buckets
 *
 * Usage:
 *   const tm = new TimelineManager();
 *   const groups = tm.groupByTime(captures);
 *   // Returns: [{ label: '2 min ago', startTime, endTime, captures: [...] }, ...]
 */

class TimelineManager {
  constructor(options = {}) {
    this.DEBUG = options.debug || false;

    // Bucket size configuration (in milliseconds)
    this.bucketConfig = options.bucketConfig || [
      { maxAge: 60 * 1000, bucketSize: 5 * 1000, label: 's' },           // 0-1 min: 5s buckets
      { maxAge: 10 * 60 * 1000, bucketSize: 30 * 1000, label: 's' },     // 1-10 min: 30s buckets
      { maxAge: 60 * 60 * 1000, bucketSize: 2 * 60 * 1000, label: 'm' }, // 10-60 min: 2m buckets
      { maxAge: Infinity, bucketSize: 10 * 60 * 1000, label: 'm' }       // 1+ hour: 10m buckets
    ];

    // Cache for grouping results
    this._cache = null;
    this._cacheKey = null;
  }

  _log(...args) {
    if (this.DEBUG) {
      console.debug('[TimelineManager]', ...args);
    }
  }

  /**
   * Get the appropriate bucket size for a given age
   * @param {number} ageMs - Age in milliseconds
   * @returns {object} Bucket config { bucketSize, label }
   */
  _getBucketConfig(ageMs) {
    for (const config of this.bucketConfig) {
      if (ageMs <= config.maxAge) {
        return config;
      }
    }
    return this.bucketConfig[this.bucketConfig.length - 1];
  }

  /**
   * Format a time bucket label
   * @param {number} startTime - Bucket start timestamp
   * @param {number} endTime - Bucket end timestamp
   * @param {number} now - Current timestamp
   * @returns {string} Human-readable label
   */
  _formatBucketLabel(startTime, endTime, now) {
    const ageMs = now - endTime;
    const seconds = Math.floor(ageMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  /**
   * Group captures by time buckets
   * @param {Array} captures - Array of capture objects with timestamp property
   * @returns {Array} Array of time groups
   */
  groupByTime(captures) {
    if (!captures || captures.length === 0) {
      return [];
    }

    const now = Date.now();

    // Check cache
    const cacheKey = `${captures.length}-${captures[0]?.id}-${captures[captures.length - 1]?.id}`;
    if (this._cacheKey === cacheKey && this._cache) {
      this._log('Cache hit');
      return this._cache;
    }

    this._log('Grouping', captures.length, 'captures by time');

    // Sort captures by timestamp (newest first)
    const sorted = [...captures].sort((a, b) => b.timestamp - a.timestamp);

    // Group into buckets
    const buckets = new Map();

    for (const capture of sorted) {
      const age = now - capture.timestamp;
      const config = this._getBucketConfig(age);

      // Calculate bucket boundaries
      const bucketIndex = Math.floor(age / config.bucketSize);
      const bucketEndTime = now - (bucketIndex * config.bucketSize);
      const bucketStartTime = bucketEndTime - config.bucketSize;
      const bucketKey = `${bucketStartTime}-${bucketEndTime}`;

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, {
          startTime: bucketStartTime,
          endTime: bucketEndTime,
          label: this._formatBucketLabel(bucketStartTime, bucketEndTime, now),
          captures: [],
          collapsed: false
        });
      }

      buckets.get(bucketKey).captures.push(capture);
    }

    // Convert to array and sort by time (newest first)
    const groups = Array.from(buckets.values())
      .sort((a, b) => b.endTime - a.endTime);

    this._log('Created', groups.length, 'time groups');

    // Update cache
    this._cache = groups;
    this._cacheKey = cacheKey;

    return groups;
  }

  /**
   * Get timeline visualization data for rendering
   * @param {Array} captures - Array of capture objects
   * @returns {object} Timeline data for visualization
   */
  getTimelineData(captures) {
    if (!captures || captures.length === 0) {
      return { buckets: [], minTime: 0, maxTime: 0, totalCaptures: 0 };
    }

    const now = Date.now();
    const groups = this.groupByTime(captures);

    // Calculate time range
    const timestamps = captures.map(c => c.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime;

    // Create visualization buckets with normalized positions
    const buckets = groups.map(group => ({
      ...group,
      position: timeRange > 0 ? (group.endTime - minTime) / timeRange : 0.5,
      width: timeRange > 0 ? (group.endTime - group.startTime) / timeRange : 0.1,
      count: group.captures.length,
      density: group.captures.length / captures.length
    }));

    return {
      buckets,
      minTime,
      maxTime,
      timeRange,
      totalCaptures: captures.length,
      groupCount: groups.length
    };
  }

  /**
   * Toggle collapse state for a time group
   * @param {Array} groups - Current groups array
   * @param {number} index - Group index to toggle
   * @returns {Array} Updated groups array
   */
  toggleGroup(groups, index) {
    if (index < 0 || index >= groups.length) return groups;

    const updated = [...groups];
    updated[index] = {
      ...updated[index],
      collapsed: !updated[index].collapsed
    };
    return updated;
  }

  /**
   * Expand all groups
   * @param {Array} groups - Current groups array
   * @returns {Array} Updated groups with all expanded
   */
  expandAll(groups) {
    return groups.map(g => ({ ...g, collapsed: false }));
  }

  /**
   * Collapse all groups
   * @param {Array} groups - Current groups array
   * @returns {Array} Updated groups with all collapsed
   */
  collapseAll(groups) {
    return groups.map(g => ({ ...g, collapsed: true }));
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this._cache = null;
    this._cacheKey = null;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimelineManager;
}
