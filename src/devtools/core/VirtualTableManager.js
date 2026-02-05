/**
 * VirtualTableManager - Virtual scrolling for large capture tables
 *
 * Only renders rows visible in the viewport plus overscan buffer.
 * Dramatically reduces DOM nodes for large capture lists.
 *
 * Usage:
 *   const vtm = new VirtualTableManager({
 *     container: document.querySelector('.table-container'),
 *     tbody: document.getElementById('capturesBody'),
 *     rowHeight: 60,
 *     renderRow: (capture, index) => createTableRow(capture)
 *   });
 *   vtm.setData(captures);
 */

class VirtualTableManager {
  constructor(options) {
    this.container = options.container;
    this.tbody = options.tbody;
    this.rowHeight = options.rowHeight || 60;
    this.overscan = options.overscan || 5;
    this.renderRow = options.renderRow;
    this.minRowsForVirtual = options.minRowsForVirtual || 50;
    this.onRowClick = options.onRowClick || (() => {});
    this.columnCount = options.columnCount || 6;

    this.data = [];
    this.visibleRows = new Map(); // index -> DOM element
    this.startIndex = 0;
    this.endIndex = 0;
    this.selectedId = null;

    // Create spacer elements using safe DOM methods
    this.topSpacer = this._createSpacerRow();
    this.bottomSpacer = this._createSpacerRow();

    this.DEBUG = false;

    // Bind scroll handler
    this._onScroll = this._onScroll.bind(this);
    this._rafId = null;
    this._scrollTimeout = null;
    this.isVirtualMode = false;

    this._bindEvents();
  }

  /**
   * Create a spacer row using safe DOM methods (no innerHTML)
   */
  _createSpacerRow() {
    const row = document.createElement('tr');
    row.className = 'virtual-spacer';
    const cell = document.createElement('td');
    cell.setAttribute('colspan', String(this.columnCount));
    cell.style.padding = '0';
    cell.style.border = '0';
    cell.style.height = '0px';
    row.appendChild(cell);
    return row;
  }

  _log(...args) {
    if (this.DEBUG) {
      console.debug('[VirtualTable]', ...args);
    }
  }

  _bindEvents() {
    this.container.addEventListener('scroll', this._onScroll, { passive: true });
  }

  _onScroll() {
    if (!this.isVirtualMode) return;

    // Debounce scroll updates
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }

    this._rafId = requestAnimationFrame(() => {
      this._updateVisibleRows();
      this._rafId = null;
    });
  }

  /**
   * Set the data and trigger initial render
   * @param {Array} data - Array of captures
   */
  setData(data) {
    this.data = data || [];

    // Decide rendering mode
    this.isVirtualMode = this.data.length >= this.minRowsForVirtual;

    if (this.isVirtualMode) {
      this._log('Virtual mode enabled for', this.data.length, 'rows');
      this._renderVirtual();
    } else {
      this._log('Standard mode for', this.data.length, 'rows');
      this._renderStandard();
    }
  }

  /**
   * Standard rendering - all rows at once (for small datasets)
   */
  _renderStandard() {
    this.tbody.replaceChildren();
    this.visibleRows.clear();

    for (let i = 0; i < this.data.length; i++) {
      const row = this.renderRow(this.data[i], i);
      this._attachRowEvents(row, i);
      this.tbody.appendChild(row);
    }

    this._updateSelectedState();
  }

  /**
   * Virtual rendering - only visible rows
   */
  _renderVirtual() {
    this.tbody.replaceChildren();
    this.visibleRows.clear();

    // Reset spacer heights
    this.topSpacer.querySelector('td').style.height = '0px';
    this.bottomSpacer.querySelector('td').style.height = '0px';

    // Add spacers
    this.tbody.appendChild(this.topSpacer);
    this.tbody.appendChild(this.bottomSpacer);

    // Reset indices to force full recalculation
    this.startIndex = -1;
    this.endIndex = -1;

    this._updateVisibleRows();
  }

  /**
   * Calculate and render visible rows
   */
  _updateVisibleRows() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;

    // Calculate visible range with overscan
    const startIndex = Math.max(0, Math.floor(scrollTop / this.rowHeight) - this.overscan);
    const visibleCount = Math.ceil(viewportHeight / this.rowHeight) + this.overscan * 2;
    const endIndex = Math.min(this.data.length - 1, startIndex + visibleCount);

    // Skip if range hasn't changed
    if (startIndex === this.startIndex && endIndex === this.endIndex) {
      return;
    }

    this._log('Updating range:', startIndex, '-', endIndex, '(was', this.startIndex, '-', this.endIndex + ')');

    // Remove rows that are now out of range
    for (const [idx, row] of this.visibleRows) {
      if (idx < startIndex || idx > endIndex) {
        row.remove();
        this.visibleRows.delete(idx);
      }
    }

    // Add new rows that are now in range
    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i <= endIndex; i++) {
      if (!this.visibleRows.has(i)) {
        const row = this.renderRow(this.data[i], i);
        this._attachRowEvents(row, i);
        this.visibleRows.set(i, row);
        fragment.appendChild(row);
      }
    }

    // Insert fragment before bottom spacer
    if (fragment.childNodes.length > 0) {
      this.bottomSpacer.before(fragment);

      // Sort visible rows by index (DOM order matters for proper layout)
      this._reorderRows();
    }

    // Update spacer heights
    const topSpacerHeight = startIndex * this.rowHeight;
    const bottomSpacerHeight = Math.max(0, (this.data.length - endIndex - 1) * this.rowHeight);

    this.topSpacer.querySelector('td').style.height = topSpacerHeight + 'px';
    this.bottomSpacer.querySelector('td').style.height = bottomSpacerHeight + 'px';

    this.startIndex = startIndex;
    this.endIndex = endIndex;

    this._updateSelectedState();
  }

  /**
   * Ensure rows are in correct DOM order
   */
  _reorderRows() {
    const sortedIndices = Array.from(this.visibleRows.keys()).sort((a, b) => a - b);
    let prevRow = this.topSpacer;

    for (const idx of sortedIndices) {
      const row = this.visibleRows.get(idx);
      if (row.previousElementSibling !== prevRow) {
        prevRow.after(row);
      }
      prevRow = row;
    }
  }

  _attachRowEvents(row, index) {
    row.addEventListener('click', () => {
      this.onRowClick(this.data[index], index);
    });
  }

  /**
   * Set the selected capture ID
   * @param {string} id - Capture ID to select
   */
  setSelected(id) {
    this.selectedId = id;
    this._updateSelectedState();
  }

  _updateSelectedState() {
    for (const row of this.visibleRows.values()) {
      const isSelected = row.dataset.id === this.selectedId;
      row.classList.toggle('selected', isSelected);
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

    const scrollTop = index * this.rowHeight;
    this.container.scrollTo({
      top: scrollTop,
      behavior
    });
  }

  /**
   * Get visible row count
   */
  getVisibleRowCount() {
    return this.visibleRows.size;
  }

  /**
   * Force re-render all visible rows
   */
  refresh() {
    if (this.isVirtualMode) {
      // Force range recalculation
      this.startIndex = -1;
      this.endIndex = -1;
      this._updateVisibleRows();
    } else {
      this._renderStandard();
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.container.removeEventListener('scroll', this._onScroll);
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }
    this.visibleRows.clear();
    this.data = [];
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualTableManager;
}
