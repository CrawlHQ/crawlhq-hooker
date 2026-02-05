/**
 * CrawlHQ Hooker - Category Icons (SVG)
 * Professional, consistent SVG icons for fingerprinting categories
 * Theme: CrawlHQ Green (#00d26a)
 */

(() => {
  // Idempotent: avoid redefining if loaded multiple times.
  if (globalThis.CrawlHQCategoryIcons) return;

  const CATEGORY_ICONS = {
  // Canvas - Image/Canvas API calls
  canvas: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="2" width="14" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <path d="M4 6L7 9L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="5" cy="5" r="1" fill="currentColor"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M6 9L10 13L17 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="26" height="24" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 12L13 17L22 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="9" cy="9" r="2" fill="currentColor"/>
    </svg>`
  },

  // WebGL - WebGL rendering APIs
  webgl: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2L14 5L14 11L8 14L2 11L2 5L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M2 5L8 8L14 5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M8 14L8 8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L20 7L20 16L12 20L4 16L4 7L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M4 7L12 11L20 7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 20L12 11" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4L26 9L26 21L16 26L6 21L6 9L16 4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M6 9L16 14L26 9" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M16 26L16 14" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`
  },

  // Audio - Audio context and analyzers
  audio: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8H3V10H2V8Z" fill="currentColor"/>
      <path d="M5 6H6V10H5V6Z" fill="currentColor"/>
      <path d="M8 4H9V10H8V4Z" fill="currentColor"/>
      <path d="M11 5H12V10H11V5Z" fill="currentColor"/>
      <path d="M14 7H15V10H14V7Z" fill="currentColor"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12H4V15H3V12Z" fill="currentColor"/>
      <path d="M7 9H8V15H7V9Z" fill="currentColor"/>
      <path d="M11 6H12V15H11V6Z" fill="currentColor"/>
      <path d="M15 7H16V15H15V7Z" fill="currentColor"/>
      <path d="M19 10H20V15H19V10Z" fill="currentColor"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 16H6V20H4V16Z" fill="currentColor"/>
      <path d="M9 12H11V20H9V12Z" fill="currentColor"/>
      <path d="M14 8H16V20H14V8Z" fill="currentColor"/>
      <path d="M19 9H21V20H19V9Z" fill="currentColor"/>
      <path d="M24 13H26V20H24V13Z" fill="currentColor"/>
    </svg>`
  },

  // Navigator - Browser navigator properties
  navigator: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 8L8 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 8L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 12L12 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 12L15.5 15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1.5"/>
      <path d="M16 16L16 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 16L20.5 20.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Screen - Display properties
  screen: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="2" width="14" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 14H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 12V14" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="20" height="14" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M7 19H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 17V19" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="26" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M9 24H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 22V24" stroke="currentColor" stroke-width="1.5"/>
    </svg>`
  },

  // Fonts - Font detection APIs
  fonts: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4L6 12H7L8 8L9 12H10L12 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 6L9 18H10.5L12.5 12L14.5 18H16L19 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 8L12 24H14L17 16L20 24H22L26 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },

  // WebRTC - Web Real-Time Communication
  webrtc: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <path d="M5.2 7.4L10.8 4.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M5.2 8.6L10.8 11.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="12" r="2" fill="currentColor"/>
      <circle cx="18" cy="6" r="2" fill="currentColor"/>
      <circle cx="18" cy="18" r="2" fill="currentColor"/>
      <path d="M8 11L16 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 13L16 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="16" r="3" fill="currentColor"/>
      <circle cx="24" cy="8" r="3" fill="currentColor"/>
      <circle cx="24" cy="24" r="3" fill="currentColor"/>
      <path d="M11 14.5L21 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M11 17.5L21 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Storage - localStorage, sessionStorage, indexedDB
  storage: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="8" cy="4" rx="5" ry="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M3 4V10C3 11.105 5.239 12 8 12C10.761 12 13 11.105 13 10V4" stroke="currentColor" stroke-width="1.5"/>
      <path d="M3 7C3 8.105 5.239 9 8 9C10.761 9 13 8.105 13 7" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 6V15C5 16.657 8.134 18 12 18C15.866 18 19 16.657 19 15V6" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 10.5C5 12.157 8.134 13.5 12 13.5C15.866 13.5 19 12.157 19 10.5" stroke="currentColor" stroke-width="1.5"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="8" rx="9" ry="4" stroke="currentColor" stroke-width="1.5"/>
      <path d="M7 8V20C7 22.209 11.03 24 16 24C20.97 24 25 22.209 25 20V8" stroke="currentColor" stroke-width="1.5"/>
      <path d="M7 14C7 16.209 11.03 18 16 18C20.97 18 25 16.209 25 14" stroke="currentColor" stroke-width="1.5"/>
    </svg>`
  },

  // Timing - Performance timing APIs
  timing: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 8L8 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 8L10.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 12L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 12L16.5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 12L15 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 12L15 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1.5"/>
      <path d="M16 16L16 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 16L22 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 16L20 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 16L20 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Speech - Speech synthesis APIs
  speech: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2.5C6.895 2.5 6 3.395 6 4.5V8.5C6 9.605 6.895 10.5 8 10.5C9.105 10.5 10 9.605 10 8.5V4.5C10 3.395 9.105 2.5 8 2.5Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M4.5 7.5V8.2C4.5 10.2 6 11.7 8 11.7C10 11.7 11.5 10.2 11.5 8.2V7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 11.7V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M6.5 14H9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3.5C10.343 3.5 9 4.843 9 6.5V12.5C9 14.157 10.343 15.5 12 15.5C13.657 15.5 15 14.157 15 12.5V6.5C15 4.843 13.657 3.5 12 3.5Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M6.5 11V12.2C6.5 15.2 9 17.5 12 17.5C15 17.5 17.5 15.2 17.5 12.2V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 17.5V21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9.5 21H14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 5C13.79 5 12 6.79 12 9V17C12 19.21 13.79 21 16 21C18.21 21 20 19.21 20 17V9C20 6.79 18.21 5 16 5Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8.5 15V16.7C8.5 20.6 12 23.5 16 23.5C20 23.5 23.5 20.6 23.5 16.7V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 23.5V28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12.5 28H19.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Permissions - Permissions API
  permissions: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="10" height="9" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <path d="M10 9L10 12L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 2L8 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="7" width="15" height="14" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M15 13L15 18L18 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11.5 3L11.5 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="9" width="20" height="19" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M20 17L20 24L24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M15.5 4L15.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Client Hints - User-Agent Client Hints
  clientHints: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 5H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M5 7H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M5 9H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="13" cy="13" r="2" fill="currentColor"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M7 7H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7 10H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7 13H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="19" cy="19" r="3" fill="currentColor"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="24" height="24" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M9 9H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 13H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 17H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="25" cy="25" r="4" fill="currentColor"/>
    </svg>`
  },

  // Battery - Battery API
  battery: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="4" width="11" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 6V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="3" y="6" width="5" height="4" rx="0.5" fill="currentColor"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="6" width="16" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M18 8V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="5" y="9" width="7" height="6" rx="1" fill="currentColor"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="8" width="22" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M25 10V22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="7" y="12" width="9" height="8" rx="1" fill="currentColor"/>
    </svg>`
  },

  // Behavior - User behavior tracking
  behavior: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2.5C5.791 2.5 4 4.291 4 6.5V9.5C4 11.709 5.791 13.5 8 13.5C10.209 13.5 12 11.709 12 9.5V6.5C12 4.291 10.209 2.5 8 2.5Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 5.5V7.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C8.686 3 6 5.686 6 9V13C6 16.314 8.686 19 12 19C15.314 19 18 16.314 18 13V9C18 5.686 15.314 3 12 3Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 7V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4C11.582 4 8 7.582 8 12V18C8 22.418 11.582 26 16 26C20.418 26 24 22.418 24 18V12C24 7.582 20.418 4 16 4Z" stroke="currentColor" stroke-width="1.5"/>
      <path d="M16 9V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Automation - Bot detection
  automation: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="6" cy="7" r="1.5" fill="currentColor"/>
      <circle cx="10" cy="7" r="1.5" fill="currentColor"/>
      <path d="M6 10L6 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M10 10L10 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M3 13L8 13L8 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="15" rx="3" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="9" cy="11.5" r="2" fill="currentColor"/>
      <circle cx="15" cy="11.5" r="2" fill="currentColor"/>
      <path d="M9 15L9 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M15 15L15 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M5 19L12 19L12 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="24" height="20" rx="4" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="12" cy="16" r="2.5" fill="currentColor"/>
      <circle cx="20" cy="16" r="2.5" fill="currentColor"/>
      <path d="M12 20L12 23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M20 20L20 23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M6 26L16 26L16 30" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },

  // Sensors - Device sensors
  sensors: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 5L8 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 10L8 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M5 8L6 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M10 8L11 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 7L12 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 15.5L12 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7 12L8.5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M15.5 12L17 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1.5"/>
      <path d="M16 9L16 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 21L16 23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 16L11 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M21 16L23 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
    </svg>`
  },

  // Gamepad - Gamepad API
  gamepad: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="4" width="14" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="5" cy="7" r="1.5" fill="currentColor"/>
      <circle cx="11" cy="7" r="1.5" fill="currentColor"/>
      <rect x="7" y="6" width="2" height="2" rx="0.5" fill="currentColor"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="6" width="20" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="7.5" cy="12" r="2" fill="currentColor"/>
      <circle cx="16.5" cy="12" r="2" fill="currentColor"/>
      <rect x="10.5" y="10.5" width="3" height="3" rx="1" fill="currentColor"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="8" width="26" height="16" rx="4" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="10" cy="16" r="2.5" fill="currentColor"/>
      <circle cx="22" cy="16" r="2.5" fill="currentColor"/>
      <rect x="14" y="14" width="4" height="4" rx="1" fill="currentColor"/>
    </svg>`
  },

  // Network - Network requests
  network: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="3" cy="13" r="2" fill="currentColor"/>
      <circle cx="13" cy="3" r="2" fill="currentColor"/>
      <path d="M4.5 11.5L11.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M3 8H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M11 5H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="4" cy="20" r="3" fill="currentColor"/>
      <circle cx="20" cy="4" r="3" fill="currentColor"/>
      <circle cx="20" cy="20" r="3" fill="currentColor"/>
      <path d="M6.5 18.5L17.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M4 12H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M17 6H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M20 17V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="27" r="4" fill="currentColor"/>
      <circle cx="27" cy="5" r="4" fill="currentColor"/>
      <circle cx="27" cy="27" r="4" fill="currentColor"/>
      <path d="M8.5 24.5L23.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M5 16H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M23 8H27" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M27 23V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Media - Media capabilities
  media: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="3" width="14" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 10L5 6L9 8L5 10Z" fill="currentColor"/>
      <path d="M10 7L13 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M10 9L13 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="20" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M7 15L7 9L13 12L7 15Z" fill="currentColor"/>
      <path d="M15 10L20 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M15 13L20 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="26" height="20" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M9 20L9 12L17 16L9 20Z" fill="currentColor"/>
      <path d="M20 13L27 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M20 17L27 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Geolocation - Location APIs
  geolocation: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2C5.239 2 3 5.239 3 8C3 10.761 5.239 14 8 14C10.761 14 13 10.761 13 8C13 5.239 10.761 2 8 2Z" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="8" cy="8" r="2" fill="currentColor"/>
      <path d="M8 14L8 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C7.582 3 4 7.582 4 12C4 16.418 7.582 21 12 21C16.418 21 20 16.418 20 12C20 7.582 16.418 3 12 3Z" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="3" fill="currentColor"/>
      <path d="M12 21L12 22.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 4C10.11 4 5 10.11 5 16C5 21.89 10.11 28 16 28C21.89 28 27 21.89 27 16C27 10.11 21.89 4 16 4Z" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="16" cy="16" r="4" fill="currentColor"/>
      <path d="M16 28L16 30" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // DOM - DOM manipulation
  dom: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="5" height="5" rx="0.5" stroke="currentColor" stroke-width="1.5"/>
      <rect x="9" y="3" width="5" height="5" rx="0.5" stroke="currentColor" stroke-width="1.5"/>
      <rect x="5" y="8" width="6" height="5" rx="0.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M4.5 8L6.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9.5 8L11.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 6L8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="7" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <rect x="14" y="4" width="7" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <rect x="7" y="12" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <path d="M6.5 12L9.5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M14.5 12L17.5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 8L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="5" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <rect x="18" y="5" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <rect x="9" y="17" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8.5 17L12.5 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M19.5 17L23.5 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 15L16 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Crypto - Cryptography APIs
  crypto: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 9L8 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 7L8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="8" cy="7" r="1" fill="currentColor"/>
      <path d="M6 9H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="7" width="18" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 13L12 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 10L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="10" r="1.5" fill="currentColor"/>
      <path d="M9 13H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="9" width="24" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M16 17L16 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 13L16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="16" cy="13" r="2" fill="currentColor"/>
      <path d="M12 17H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Hardware - Hardware information
  hardware: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <path d="M4 6H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M4 8H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M4 10H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="10" r="1" fill="currentColor"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="6" width="18" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M6 9H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M6 12H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M6 15H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="18" cy="15" r="1.5" fill="currentColor"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="8" width="24" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 12H24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 16H24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 20H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="24" cy="20" r="2" fill="currentColor"/>
    </svg>`
  },

  // Clipboard - Clipboard APIs
  clipboard: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 3V2C4 1.448 4.448 1 5 1H11C11.552 1 12 1.448 12 2V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="2" y="3" width="12" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <path d="M5 6H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M5 9H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3V2C6 1.448 6.448 1 7 1H17C17.552 1 18 1.448 18 2V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="3" y="3" width="18" height="18" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M7 8H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7 12H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7 16H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 4V3C8 2.448 8.448 2 9 2H23C23.552 2 24 2.448 24 3V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="4" y="4" width="24" height="24" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <path d="M9 11H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 16H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 21H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },

  // Credentials - Credentials Management API
  credentials: {
    icon16: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="8" cy="6.5" r="1.5" fill="currentColor"/>
      <path d="M5 9H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M5 11H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon24: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="15" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="12" cy="10" r="2.5" fill="currentColor"/>
      <path d="M7 13H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7 16H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    icon32: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="5" width="24" height="20" rx="2" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="16" cy="13" r="3" fill="currentColor"/>
      <path d="M9 18H23" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M9 22H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  }
  };

/**
 * Get category icon as DOM element
 * @param {string} category - Category name
 * @param {number} size - Icon size (16, 24, or 32)
 * @param {string} color - Optional color (defaults to CSS currentColor)
 * @returns {HTMLElement} SVG element
 */
  function getCategoryIcon(category, size = 24, color = null) {
  const icons = CATEGORY_ICONS[category];
  if (!icons) {
    // Fallback to canvas icon if category not found
    return getCategoryIcon('canvas', size, color);
  }

  const svgKey = `icon${size}`;
  const svgString = icons[svgKey] || icons.icon24;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');

  if (color) {
    svg.style.color = color;
  }

  return svg;
}

/**
 * Get category icon as HTML string
 * @param {string} category - Category name
 * @param {number} size - Icon size (16, 24, or 32)
 * @param {string} color - Optional color
 * @returns {string} SVG HTML string
 */
  function getCategoryIconString(category, size = 24, color = null) {
  const icons = CATEGORY_ICONS[category];
  if (!icons) {
    return getCategoryIconString('canvas', size, color);
  }

  const svgKey = `icon${size}`;
  let svgString = icons[svgKey] || icons.icon24;

  if (color) {
    svgString = svgString.replace(/stroke="currentColor"/g, `stroke="${color}"`);
    svgString = svgString.replace(/fill="currentColor"/g, `fill="${color}"`);
  }

  return svgString;
}

  globalThis.CrawlHQCategoryIcons = {
    CATEGORY_ICONS,
    getCategoryIcon,
    getCategoryIconString
  };
})();