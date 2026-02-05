/**
 * LazyThumbLoader - Lazy loading for canvas thumbnails
 *
 * Uses IntersectionObserver to only load images when they're visible.
 * Dramatically reduces memory and initial load time for large capture lists.
 *
 * Usage:
 *   const loader = new LazyThumbLoader();
 *   // Mark an image for lazy loading
 *   loader.observe(imgElement, dataUrl);
 *   // When done
 *   loader.destroy();
 */

class LazyThumbLoader {
  constructor(options = {}) {
    this.rootMargin = options.rootMargin || '50px';
    this.threshold = options.threshold || 0.1;
    this.placeholder = options.placeholder || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Crect fill="%23333" width="48" height="48"/%3E%3C/svg%3E';

    // Map of elements to their actual data URLs
    this.pendingImages = new WeakMap();

    // Stats
    this.stats = {
      observed: 0,
      loaded: 0,
      errors: 0
    };

    this.DEBUG = false;

    // Create IntersectionObserver
    this._createObserver();
  }

  _log(...args) {
    if (this.DEBUG) {
      console.debug('[LazyThumb]', ...args);
    }
  }

  _createObserver() {
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback for environments without IntersectionObserver
      this.observer = null;
      this._log('IntersectionObserver not available, using eager loading');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._loadImage(entry.target);
          }
        }
      },
      {
        rootMargin: this.rootMargin,
        threshold: this.threshold
      }
    );
  }

  /**
   * Observe an image element for lazy loading
   * @param {HTMLImageElement} img - The image element
   * @param {string} dataUrl - The actual image data URL
   */
  observe(img, dataUrl) {
    if (!img || !dataUrl) return;

    this.stats.observed++;

    // Store the actual URL
    this.pendingImages.set(img, dataUrl);

    // Set placeholder
    img.src = this.placeholder;
    img.dataset.lazy = 'pending';

    if (this.observer) {
      this.observer.observe(img);
      this._log('Observing image, pending:', this.stats.observed - this.stats.loaded);
    } else {
      // No IntersectionObserver, load immediately
      this._loadImage(img);
    }
  }

  /**
   * Load the actual image
   */
  _loadImage(img) {
    const dataUrl = this.pendingImages.get(img);
    if (!dataUrl) return;

    // Stop observing
    if (this.observer) {
      this.observer.unobserve(img);
    }

    // Load the actual image
    img.dataset.lazy = 'loading';

    const actualImg = new Image();

    actualImg.onload = () => {
      img.src = dataUrl;
      img.dataset.lazy = 'loaded';
      this.stats.loaded++;
      this.pendingImages.delete(img);
      this._log('Loaded image, total loaded:', this.stats.loaded);
    };

    actualImg.onerror = () => {
      img.dataset.lazy = 'error';
      this.stats.errors++;
      this.pendingImages.delete(img);
      this._log('Failed to load image, errors:', this.stats.errors);
    };

    actualImg.src = dataUrl;
  }

  /**
   * Preload an image without adding to DOM
   * Returns a promise that resolves with the loaded image
   */
  preload(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  /**
   * Force load all pending images
   */
  loadAll() {
    if (!this.observer) return;

    // Get all observed elements and load them
    // Note: We can't iterate WeakMap, so we disconnect and rely on
    // the images already having data-lazy="pending"
    this.observer.disconnect();

    const pendingImages = document.querySelectorAll('img[data-lazy="pending"]');
    pendingImages.forEach(img => {
      this._loadImage(img);
    });
  }

  /**
   * Unobserve a specific image
   */
  unobserve(img) {
    if (this.observer && img) {
      this.observer.unobserve(img);
    }
    this.pendingImages.delete(img);
  }

  /**
   * Get loading stats
   */
  getStats() {
    return {
      ...this.stats,
      pending: this.stats.observed - this.stats.loaded - this.stats.errors
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.stats = { observed: 0, loaded: 0, errors: 0 };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LazyThumbLoader;
}
