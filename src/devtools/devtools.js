/**
 * DevTools Entry Point
 * Creates the CrawlHQ Hooker panel in Chrome DevTools
 */

chrome.devtools.panels.create(
  'CrawlHQ Hooker',
  'icons/icon32.png',
  'src/devtools/panel.html',
  (panel) => {
    if (chrome.runtime.lastError) {
      console.error('CrawlHQ Hooker DevTools panel creation failed:', chrome.runtime.lastError.message);
    } else {
      console.log('CrawlHQ Hooker DevTools panel created successfully');
    }
  }
);
