/**
 * Content Script (ISOLATED world)
 * Bridges MAIN-world detector events -> service worker.
 *
 * Note: This script should only be injected on whitelisted sites via
 * chrome.scripting.registerContentScripts().
 */

(() => {
  const BRIDGE_FLAG = '__CRAWLHQ_HOOKER_BRIDGE_ACTIVE__';
  const DETECTOR_EVENT_TYPE = '__FINGERPRINT_DETECTED__';

  if (window[BRIDGE_FLAG]) return;
  window[BRIDGE_FLAG] = true;

  function forwardCapture(payload) {
    try {
      chrome.runtime.sendMessage({
        type: 'FINGERPRINT_DETECTED',
        payload
      });
    } catch (e) {
      // Ignore - e.g. extension context shutting down.
    }
  }

  window.addEventListener(
    'message',
    (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.type !== DETECTOR_EVENT_TYPE) return;
      if (!data.payload || typeof data.payload !== 'object') return;

      forwardCapture(data.payload);
    },
    false
  );
})();
