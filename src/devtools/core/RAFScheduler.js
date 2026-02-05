/**
 * RAFScheduler - RequestAnimationFrame-based DOM update scheduler
 *
 * Batches DOM operations to run in animation frames for smooth performance.
 * Prevents layout thrashing by grouping reads and writes.
 *
 * Usage:
 *   const scheduler = new RAFScheduler();
 *
 *   // Schedule a DOM update
 *   scheduler.schedule(() => {
 *     element.textContent = 'Updated';
 *   });
 *
 *   // Schedule with priority
 *   scheduler.schedule(() => updateCritical(), 'high');
 *
 *   // Debounced scheduling (useful for rapid events)
 *   scheduler.scheduleDebounced('resize', () => handleResize(), 100);
 */

class RAFScheduler {
  constructor(options = {}) {
    this.maxUpdatesPerFrame = options.maxUpdatesPerFrame || 10;

    // Task queues by priority
    this.queues = {
      high: [],
      normal: [],
      low: []
    };

    // Debounced tasks
    this.debouncedTasks = new Map(); // key -> { timer, callback }

    this._rafId = null;
    this._isRunning = false;

    this.DEBUG = false;

    // Stats
    this.stats = {
      scheduled: 0,
      executed: 0,
      frames: 0,
      dropped: 0
    };
  }

  _log(...args) {
    if (this.DEBUG) {
      console.debug('[RAFScheduler]', ...args);
    }
  }

  /**
   * Schedule a task to run in the next animation frame
   * @param {Function} task - The task to execute
   * @param {string} priority - 'high', 'normal', or 'low'
   */
  schedule(task, priority = 'normal') {
    if (typeof task !== 'function') return;

    const queue = this.queues[priority] || this.queues.normal;
    queue.push(task);
    this.stats.scheduled++;

    this._ensureRunning();
  }

  /**
   * Schedule a debounced task
   * @param {string} key - Unique key for this debounced task
   * @param {Function} task - The task to execute
   * @param {number} delay - Debounce delay in ms
   */
  scheduleDebounced(key, task, delay = 16) {
    const existing = this.debouncedTasks.get(key);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      this.debouncedTasks.delete(key);
      this.schedule(task, 'normal');
    }, delay);

    this.debouncedTasks.set(key, { timer, task });
  }

  /**
   * Cancel a debounced task
   */
  cancelDebounced(key) {
    const existing = this.debouncedTasks.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      this.debouncedTasks.delete(key);
    }
  }

  _ensureRunning() {
    if (this._isRunning) return;

    this._isRunning = true;
    this._rafId = requestAnimationFrame(() => this._processFrame());
  }

  _processFrame() {
    this.stats.frames++;

    let executed = 0;
    const maxUpdates = this.maxUpdatesPerFrame;

    // Process high priority first
    while (this.queues.high.length > 0 && executed < maxUpdates) {
      const task = this.queues.high.shift();
      this._executeTask(task);
      executed++;
    }

    // Then normal priority
    while (this.queues.normal.length > 0 && executed < maxUpdates) {
      const task = this.queues.normal.shift();
      this._executeTask(task);
      executed++;
    }

    // Then low priority with remaining budget
    while (this.queues.low.length > 0 && executed < maxUpdates) {
      const task = this.queues.low.shift();
      this._executeTask(task);
      executed++;
    }

    // Track dropped tasks (deferred to next frame)
    const remaining = this.queues.high.length + this.queues.normal.length + this.queues.low.length;
    if (remaining > 0) {
      this.stats.dropped += remaining;
      this._log('Deferred', remaining, 'tasks to next frame');
    }

    this.stats.executed += executed;

    // Continue if there are more tasks
    if (remaining > 0) {
      this._rafId = requestAnimationFrame(() => this._processFrame());
    } else {
      this._isRunning = false;
      this._rafId = null;
    }
  }

  _executeTask(task) {
    try {
      task();
    } catch (err) {
      console.error('[RAFScheduler] Task execution error:', err);
    }
  }

  /**
   * Execute all pending tasks immediately (sync)
   * Use sparingly - bypasses frame limiting
   */
  flush() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    for (const queue of Object.values(this.queues)) {
      while (queue.length > 0) {
        const task = queue.shift();
        this._executeTask(task);
        this.stats.executed++;
      }
    }

    this._isRunning = false;
  }

  /**
   * Clear all pending tasks without executing
   */
  clear() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    for (const queue of Object.values(this.queues)) {
      queue.length = 0;
    }

    for (const { timer } of this.debouncedTasks.values()) {
      clearTimeout(timer);
    }
    this.debouncedTasks.clear();

    this._isRunning = false;
  }

  /**
   * Get scheduler stats
   */
  getStats() {
    return {
      ...this.stats,
      pending: this.queues.high.length + this.queues.normal.length + this.queues.low.length,
      isRunning: this._isRunning
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    this.clear();
  }
}

// Utility: Create a write batch for efficient DOM updates
RAFScheduler.createWriteBatch = function() {
  const writes = [];
  return {
    add(fn) {
      writes.push(fn);
    },
    execute() {
      for (const fn of writes) {
        try { fn(); } catch (e) { console.error(e); }
      }
      writes.length = 0;
    }
  };
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RAFScheduler;
}
