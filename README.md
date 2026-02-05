# CrawlHQ Hooker

<p align="center">
  <strong>Comprehensive Browser Fingerprint Detection & Visualization</strong>
</p>

<p align="center">
  <img src="screenshots/banner.png" alt="CrawlHQ Hooker Banner" width="800">
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#monitored-apis">APIs</a> •
  <a href="#screenshots">Screenshots</a>
</p>

---

A powerful Chrome extension that detects, hooks, and visualizes browser fingerprinting attempts in real-time. Monitor 20+ fingerprinting categories including Canvas, WebGL, Audio, Navigator, and more. Perfect for security researchers, privacy advocates, and developers building anti-fingerprinting solutions.

## Features

### Real-time Detection
- **Instant Monitoring**: Captures fingerprinting attempts as they happen
- **Per-site Whitelist**: Only monitor sites you choose - no performance impact on other sites
- **Reset on Reload**: Optionally clear captures when the page reloads for clean testing

### Visual Analysis
- **Canvas/WebGL Preview**: See exactly what fingerprint images are being generated
- **Stack Traces**: Identify the exact source script and line number
- **Categorized View**: Organize captures by API category

### Multiple Interfaces
- **Popup**: Quick overview with grid/list views
- **DevTools Panel**: Full-featured analysis with search, filters, and export
- **Badge Counter**: See capture count at a glance

### Data Export
- **JSON Export**: Full data with all metadata
- **CSV Export**: Spreadsheet-compatible format
- **Persistent Storage**: Data survives browser restarts

### Performance Optimized
- **Virtual Scrolling**: Handle thousands of captures smoothly
- **Lazy Loading**: Thumbnails load on-demand
- **Deduplication**: Automatic filtering of duplicate captures

## Installation

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/CrawlHQ/crawlhq-hooker.git
   cd crawlhq-hooker
   ```

2. **Install dependencies and generate icons**
   ```bash
   npm install
   npm run generate-icons
   ```

3. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable **Developer mode** (top right toggle)
   - Click **Load unpacked**
   - Select the `crawlhq-hooker` folder

4. **Pin the extension** (optional)
   - Click the puzzle icon in Chrome toolbar
   - Pin "CrawlHQ Hooker" for easy access

## Usage

### Getting Started

1. **Enable Monitoring**: Click the extension icon and click "Monitor this page"
2. **Browse Normally**: The extension will capture all fingerprinting attempts
3. **View Captures**: 
   - Click the popup for a quick view
   - Open DevTools → "CrawlHQ Hooker" tab for detailed analysis

### Popup Interface

| Feature | Description |
|---------|-------------|
| **Grid View** | Visual cards with thumbnails |
| **List View** | Compact list format |
| **Search** | Filter by method name or category |
| **Category Filter** | Show only specific API categories |
| **Reset on Reload** | Toggle to clear captures on page refresh |

### DevTools Panel

| Feature | Description |
|---------|-------------|
| **Real-time Updates** | See captures as they happen |
| **Sortable Columns** | Sort by time, method, category |
| **Full Details** | Click any row for complete information |
| **Export** | Download as JSON or CSV |
| **Pause/Resume** | Temporarily stop capture recording |

## Monitored APIs

CrawlHQ Hooker monitors **20+ fingerprinting categories**:

### Canvas & Graphics
| API | Methods |
|-----|---------|
| **Canvas** | `toDataURL()`, `toBlob()`, `getImageData()`, `measureText()` |
| **WebGL** | `readPixels()`, `getParameter()`, `getExtension()`, `getSupportedExtensions()` |

### Audio
| API | Methods |
|-----|---------|
| **AudioContext** | Constructor, `createOscillator()`, `createAnalyser()`, `createDynamicsCompressor()` |

### Browser & Hardware
| API | Methods |
|-----|---------|
| **Navigator** | `userAgent`, `platform`, `hardwareConcurrency`, `deviceMemory`, `plugins`, `mimeTypes` |
| **Screen** | `width`, `height`, `colorDepth`, `orientation`, `devicePixelRatio` |
| **Hardware** | GPU info via `WEBGL_debug_renderer_info`, `vibrate()` |
| **Battery** | `getBattery()` |

### Network & Communication
| API | Methods |
|-----|---------|
| **WebRTC** | `RTCPeerConnection`, `createDataChannel()` |
| **Network** | `fetch()`, `XMLHttpRequest`, `navigator.connection` |

### Sensors & Input
| API | Methods |
|-----|---------|
| **Sensors** | `DeviceMotionEvent`, `DeviceOrientationEvent` |
| **Gamepad** | `getGamepads()` |
| **Behavior** | Mouse movements, keystrokes, touch events, scroll |

### Storage & Permissions
| API | Methods |
|-----|---------|
| **Storage** | `localStorage`, `sessionStorage`, `IndexedDB` |
| **Permissions** | `permissions.query()` |
| **Credentials** | `credentials.get()` |

### Other APIs
| API | Methods |
|-----|---------|
| **Fonts** | `document.fonts.check()`, `document.fonts.load()` |
| **Speech** | `speechSynthesis.getVoices()` |
| **Client Hints** | `userAgentData`, `getHighEntropyValues()` |
| **Timing** | `performance.now()` |
| **DOM** | `getComputedStyle()`, `getBoundingClientRect()`, `matchMedia()` |
| **Crypto** | `crypto.getRandomValues()` |
| **Automation** | Detects headless browser indicators |
| **Geolocation** | `getCurrentPosition()` |
| **Media** | `canPlayType()`, `enumerateDevices()` |
| **Clipboard** | Copy/paste events |

## Screenshots

### Features Overview
![Features](screenshots/features.png)

### Category Detection
![Categories](screenshots/categories.png)

## Test Sites

Test the extension on these fingerprinting demonstration sites:

- [BrowserLeaks Canvas](https://browserleaks.com/canvas) - Canvas fingerprinting
- [AmIUnique](https://amiunique.org/) - Comprehensive fingerprinting
- [Cover Your Tracks (EFF)](https://coveryourtracks.eff.org/) - Privacy testing
- [CreepJS](https://abrahamjuliot.github.io/creepjs/) - Advanced fingerprinting detection
- [FingerprintJS](https://fingerprintjs.github.io/fingerprintjs/) - Commercial fingerprinting demo

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Page                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    detector.js                           │   │
│  │              (MAIN world injection)                      │   │
│  │                                                          │   │
│  │  • Hooks 20+ fingerprinting APIs                        │   │
│  │  • Captures canvas/WebGL images                         │   │
│  │  • Records stack traces                                 │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │ postMessage                           │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │              content-script.js                           │   │
│  │            (ISOLATED world bridge)                       │   │
│  └──────────────────────┬──────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────┘
                          │ chrome.runtime.sendMessage
┌─────────────────────────▼───────────────────────────────────────┐
│                   service-worker.js                              │
│                                                                  │
│  • Validates whitelist                                          │
│  • Deduplicates captures                                        │
│  • Stores in chrome.storage.local                               │
│  • Updates badge count                                          │
│  • Notifies UI components                                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
┌───────────────────┐               ┌───────────────────┐
│     popup.js      │               │     panel.js      │
│                   │               │                   │
│  • Grid/List view │               │  • Table view     │
│  • Quick filters  │               │  • Full search    │
│  • Capture count  │               │  • JSON/CSV export│
└───────────────────┘               └───────────────────┘
```

## Privacy & Security

- **100% Local**: All data stays in your browser - nothing is sent externally
- **Per-site Control**: Only monitors sites you explicitly whitelist
- **Auto Cleanup**: Old captures are automatically deleted after 7 days
- **Open Source**: Full source code available for review
- **No Tracking**: The extension itself does not track or fingerprint you

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
