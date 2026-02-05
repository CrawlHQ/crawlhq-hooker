/**
 * VirtualGridManager - Row-based virtual scrolling for card grid layout
 *
 * Virtualizes rows of cards (not individual cards) for smooth performance
 * with 500+ captures. CSS Grid handles responsive column count.
 *
 * Usage:
 *   const vgm = new VirtualGridManager({
 *     container: document.querySelector('.grid-container'),
 *     gridElement: document.getElementById('gridView'),
 *     cardHeight: 160,
 *     cardGap: 12,
 *     renderCard: (capture) => createGridCard(capture),
 *     onCardClick: (capture) => selectCapture(capture)
 *   });
 *   vgm.setData(captures);
 */

class VirtualGridManager {
  constructor(options) {
    this.container = options.container;
    this.gridElement = options.gridElement;
    this.cardHeight = options.cardHeight || 160;
    this.cardGap = options.cardGap || 12;
    this.overscan = options.overscan || 4; // Extra rows above/below viewport
    this.minRowsForVirtual = options.minRowsForVirtual || 20;
    this.renderCard = options.renderCard;
    this.onCardClick = options.onCardClick || (() => {});
    this.defaultColumnsPerRow = options.columnsPerRow || 3;

    this.data = [];
    this.visibleCards = new Map(); // index -> DOM element
    this.startIndex = -1;
    this.endIndex = -1;
    this.selectedId = null;
    this.columnsPerRow = this.defaultColumnsPerRow;
    this.rowHeight = this.cardHeight + this.cardGap;

    // Create spacer elements
    this.topSpacer = this._createSpacer();
    this.bottomSpacer = this._createSpacer();

    this.DEBUG = false;
    this._rafId = null;
    this._resizeObserver = null;
    this.isVirtualMode = false;

    this._onScroll = this._onScroll.bind(this);
    this._onResize = this._onResize.bind(this);

    this._bindEvents();
  }

  _log(...args) {
    if (this.DEBUG) {
      console.debug('[VirtualGrid]', ...args);
    }
  }

  _createSpacer() {
    const spacer = document.createElement('div');
    spacer.className = 'virtual-grid-spacer';
    spacer.style.cssText = 'grid-column: 1 / -1; height: 0; padding: 0; margin: 0;';
    return spacer;
  }

  _bindEvents() {
    this.container.addEventListener('scroll', this._onScroll, { passive: true });

    // Detect column count changes via ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(this.gridElement);
    }
  }

  _onScroll() {
    if (!this.isVirtualMode) return;

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }

    this._rafId = requestAnimationFrame(() => {
      this._updateVisibleCards();
      this._rafId = null;
    });
  }

  _onResize() {
    const newCols = this._detectColumnCount();
    if (newCols !== this.columnsPerRow) {
      this._log('Column count changed:', this.columnsPerRow, '->', newCols);
      this.columnsPerRow = newCols;
      this._recalculateLayout();
    }
  }

  _detectColumnCount() {
    if (!this.gridElement) return this.defaultColumnsPerRow;

    try {
      const computed = getComputedStyle(this.gridElement);
      const cols = computed.gridTemplateColumns.split(' ').filter(s => s.trim()).length;
      return cols || this.defaultColumnsPerRow;
    } catch (e) {
      return this.defaultColumnsPerRow;
    }
  }

  _recalculateLayout() {
    if (!this.isVirtualMode) return;

    // Force re-render with new column count
    this.startIndex = -1;
    this.endIndex = -1;
    this._updateVisibleCards();
  }

  /**
   * Set the data and trigger render
   * @param {Array} data - Array of captures
   */
  setData(data) {
    this.data = data || [];
    this.columnsPerRow = this._detectColumnCount();

    const rowCount = Math.ceil(this.data.length / this.columnsPerRow);
    this.isVirtualMode = rowCount >= this.minRowsForVirtual;

    if (this.isVirtualMode) {
      this._log('Virtual mode enabled:', this.data.length, 'items in', rowCount, 'rows');
      this._renderVirtual();
    } else {
      this._log('Standard mode:', this.data.length, 'items');
      this._renderStandard();
    }
  }

  /**
   * Standard rendering for small datasets
   */
  _renderStandard() {
    this.gridElement.replaceChildren();
    this.visibleCards.clear();

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < this.data.length; i++) {
      const card = this.renderCard(this.data[i], i);
      this._attachCardEvents(card, i);
      if (this.data[i].id === this.selectedId) {
        card.classList.add('selected');
      }
      fragment.appendChild(card);
    }
    this.gridElement.appendChild(fragment);
  }

  /**
   * Virtual rendering - only visible cards
   */
  _renderVirtual() {
    this.gridElement.replaceChildren();
    this.visibleCards.clear();

    // Reset spacer heights
    this.topSpacer.style.height = '0px';
    this.bottomSpacer.style.height = '0px';

    // Add spacers
    this.gridElement.appendChild(this.topSpacer);
    this.gridElement.appendChild(this.bottomSpacer);

    // Reset indices
    this.startIndex = -1;
    this.endIndex = -1;

    this._updateVisibleCards();
  }

  /**
   * Calculate and render visible cards
   */
  _updateVisibleCards() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;

    // Calculate visible row range
    const startRow = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.overscan);
    const visibleRows = Math.ceil(viewportHeight / this.rowHeight) + this.overscan * 2;
    const totalRows = Math.ceil(this.data.length / this.columnsPerRow);
    const endRow = Math.min(totalRows - 1, startRow + visibleRows);

    // Convert to item indices
    const startIndex = startRow * this.columnsPerRow;
    const endIndex = Math.min((endRow + 1) * this.columnsPerRow - 1, this.data.length - 1);

    // Skip if range hasn't changed
    if (startIndex === this.startIndex && endIndex === this.endIndex) {
      return;
    }

    this._log('Updating range:', startIndex, '-', endIndex, '(was', this.startIndex, '-', this.endIndex + ')');

    // Remove cards that are now out of range
    for (const [idx, card] of this.visibleCards) {
      if (idx < startIndex || idx > endIndex) {
        card.remove();
        this.visibleCards.delete(idx);
      }
    }

    // Add new cards that are now in range
    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i <= endIndex; i++) {
      if (!this.visibleCards.has(i) && this.data[i]) {
        const card = this.renderCard(this.data[i], i);
        this._attachCardEvents(card, i);
        if (this.data[i].id === this.selectedId) {
          card.classList.add('selected');
        }
        this.visibleCards.set(i, card);
        fragment.appendChild(card);
      }
    }

    // Insert fragment before bottom spacer
    if (fragment.childNodes.length > 0) {
      this.bottomSpacer.before(fragment);
      this._reorderCards();
    }

    // Update spacer heights
    const topSpacerHeight = startRow * this.rowHeight;
    const bottomSpacerHeight = Math.max(0, (totalRows - endRow - 1) * this.rowHeight);

    this.topSpacer.style.height = topSpacerHeight + 'px';
    this.bottomSpacer.style.height = bottomSpacerHeight + 'px';

    this.startIndex = startIndex;
    this.endIndex = endIndex;
  }

  /**
   * Ensure cards are in correct DOM order (by index)
   */
  _reorderCards() {
    const sortedIndices = Array.from(this.visibleCards.keys()).sort((a, b) => a - b);
    let prevEl = this.topSpacer;

    for (const idx of sortedIndices) {
      const card = this.visibleCards.get(idx);
      if (card.previousElementSibling !== prevEl) {
        prevEl.after(card);
      }
      prevEl = card;
    }
  }

  _attachCardEvents(card, index) {
    card.addEventListener('click', () => {
      this.onCardClick(this.data[index], index);
    });
  }

  /**
   * Set the selected capture ID
   * @param {string} id - Capture ID to select
   */
  setSelected(id) {
    this.selectedId = id;

    // Update selection state on visible cards
    for (const [idx, card] of this.visibleCards) {
      const isSelected = this.data[idx]?.id === id;
      card.classList.toggle('selected', isSelected);
    }
  }

  /**
   * Scroll to a specific capture by ID
   * @param {string} id - Capture ID
   * @param {string} behavior - scroll behavior ('smooth' or 'auto')
   */
  scrollToId(id, behavior = 'smooth') {
    const index = this.data.findIndex(c => c.id === id);
    if (index === -1) return;

    const row = Math.floor(index / this.columnsPerRow);
    const scrollTop = row * this.rowHeight;

    this.container.scrollTo({
      top: scrollTop,
      behavior
    });
  }

  /**
   * Get visible card count
   */
  getVisibleCardCount() {
    return this.visibleCards.size;
  }

  /**
   * Get total row count
   */
  getRowCount() {
    return Math.ceil(this.data.length / this.columnsPerRow);
  }

  /**
   * Force re-render all visible cards
   */
  refresh() {
    if (this.isVirtualMode) {
      this.startIndex = -1;
      this.endIndex = -1;
      this._updateVisibleCards();
    } else {
      this._renderStandard();
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.container.removeEventListener('scroll', this._onScroll);

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }

    this.visibleCards.clear();
    this.data = [];
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualGridManager;
}
