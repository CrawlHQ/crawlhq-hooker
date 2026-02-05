/**
 * CategoryGroupManager - Category-based grouping with persistence
 *
 * Groups captures by category and persists expand/collapse state to localStorage.
 *
 * Usage:
 *   const cgm = new CategoryGroupManager();
 *   const groups = cgm.groupByCategory(captures);
 *   cgm.toggleGroup('canvas');
 *   const isCollapsed = cgm.isCollapsed('canvas');
 */

class CategoryGroupManager {
  constructor(options = {}) {
    this.DEBUG = options.debug || false;
    this.storageKey = options.storageKey || 'bytewall_category_state';
    this.sortBy = options.sortBy || 'count'; // 'count' or 'alpha'

    // Load persisted state
    this._collapsedState = this._loadState();

    // Cache
    this._cache = null;
    this._cacheKey = null;
  }

  _log(...args) {
    if (this.DEBUG) {
      console.debug('[CategoryGroupManager]', ...args);
    }
  }

  /**
   * Load collapsed state from localStorage
   * @returns {Set} Set of collapsed category names
   */
  _loadState() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.version === 1 && Array.isArray(data.collapsed)) {
          this._log('Loaded state:', data.collapsed.length, 'collapsed categories');
          return new Set(data.collapsed);
        }
      }
    } catch (e) {
      this._log('Failed to load state:', e.message);
    }
    return new Set();
  }

  /**
   * Save collapsed state to localStorage
   */
  _saveState() {
    try {
      const data = {
        version: 1,
        collapsed: Array.from(this._collapsedState)
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      this._log('Saved state:', this._collapsedState.size, 'collapsed categories');
    } catch (e) {
      this._log('Failed to save state:', e.message);
    }
  }

  /**
   * Group captures by category
   * @param {Array} captures - Array of capture objects
   * @returns {Array} Array of category groups
   */
  groupByCategory(captures) {
    if (!captures || captures.length === 0) {
      return [];
    }

    // Check cache
    const cacheKey = `${captures.length}-${captures[0]?.id}-${this.sortBy}`;
    if (this._cacheKey === cacheKey && this._cache) {
      this._log('Cache hit');
      // Update collapsed state from persisted data
      return this._cache.map(g => ({
        ...g,
        collapsed: this._collapsedState.has(g.category)
      }));
    }

    this._log('Grouping', captures.length, 'captures by category');

    // Group by category
    const categoryMap = new Map();

    for (const capture of captures) {
      const category = capture.category || 'canvas';

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          captures: [],
          collapsed: this._collapsedState.has(category)
        });
      }

      categoryMap.get(category).captures.push(capture);
    }

    // Convert to array
    let groups = Array.from(categoryMap.values());

    // Sort groups
    if (this.sortBy === 'count') {
      groups.sort((a, b) => b.captures.length - a.captures.length);
    } else {
      groups.sort((a, b) => a.category.localeCompare(b.category));
    }

    // Sort captures within each group by timestamp (newest first)
    for (const group of groups) {
      group.captures.sort((a, b) => b.timestamp - a.timestamp);
      group.count = group.captures.length;
    }

    this._log('Created', groups.length, 'category groups');

    // Update cache
    this._cache = groups;
    this._cacheKey = cacheKey;

    return groups;
  }

  /**
   * Check if a category is collapsed
   * @param {string} category - Category name
   * @returns {boolean} Whether the category is collapsed
   */
  isCollapsed(category) {
    return this._collapsedState.has(category);
  }

  /**
   * Toggle collapse state for a category
   * @param {string} category - Category name
   * @returns {boolean} New collapsed state
   */
  toggleGroup(category) {
    if (this._collapsedState.has(category)) {
      this._collapsedState.delete(category);
    } else {
      this._collapsedState.add(category);
    }
    this._saveState();
    this._log('Toggled', category, '- collapsed:', this._collapsedState.has(category));
    return this._collapsedState.has(category);
  }

  /**
   * Expand all categories
   */
  expandAll() {
    this._collapsedState.clear();
    this._saveState();
    this._log('Expanded all categories');
  }

  /**
   * Collapse all categories
   * @param {Array} groups - Current groups to collapse
   */
  collapseAll(groups) {
    for (const group of groups) {
      this._collapsedState.add(group.category);
    }
    this._saveState();
    this._log('Collapsed all categories');
  }

  /**
   * Set sort mode
   * @param {string} sortBy - 'count' or 'alpha'
   */
  setSortBy(sortBy) {
    if (sortBy !== this.sortBy) {
      this.sortBy = sortBy;
      this.clearCache();
    }
  }

  /**
   * Get statistics about categories
   * @param {Array} captures - Array of capture objects
   * @returns {object} Category statistics
   */
  getStats(captures) {
    const groups = this.groupByCategory(captures);
    return {
      categoryCount: groups.length,
      largestCategory: groups[0]?.category || null,
      largestCount: groups[0]?.count || 0,
      distribution: groups.map(g => ({
        category: g.category,
        count: g.count,
        percentage: Math.round((g.count / captures.length) * 100)
      }))
    };
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this._cache = null;
    this._cacheKey = null;
  }

  /**
   * Reset all state
   */
  reset() {
    this._collapsedState.clear();
    this._saveState();
    this.clearCache();
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CategoryGroupManager;
}
