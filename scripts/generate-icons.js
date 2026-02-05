/**
 * Generate PNG icons for CrawlHQ Hooker extension from source logo
 * Run: npm run generate-icons
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '..', 'icons');
const sourceLogo = path.join(__dirname, '..', 'LOGOCRAWLHQ.png');

// Bilinear interpolation for smooth resizing
function getPixel(png, x, y) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const idx = (png.width * y + x) << 2;
  return {
    r: png.data[idx],
    g: png.data[idx + 1],
    b: png.data[idx + 2],
    a: png.data[idx + 3]
  };
}

function bilinearInterpolate(png, x, y) {
  const x1 = Math.floor(x);
  const y1 = Math.floor(y);
  const x2 = Math.min(x1 + 1, png.width - 1);
  const y2 = Math.min(y1 + 1, png.height - 1);

  const xFrac = x - x1;
  const yFrac = y - y1;

  const p11 = getPixel(png, x1, y1);
  const p21 = getPixel(png, x2, y1);
  const p12 = getPixel(png, x1, y2);
  const p22 = getPixel(png, x2, y2);

  const interpolate = (c11, c21, c12, c22) => {
    const top = c11 * (1 - xFrac) + c21 * xFrac;
    const bottom = c12 * (1 - xFrac) + c22 * xFrac;
    return Math.round(top * (1 - yFrac) + bottom * yFrac);
  };

  return {
    r: interpolate(p11.r, p21.r, p12.r, p22.r),
    g: interpolate(p11.g, p21.g, p12.g, p22.g),
    b: interpolate(p11.b, p21.b, p12.b, p22.b),
    a: interpolate(p11.a, p21.a, p12.a, p22.a)
  };
}

function resizeImage(source, targetSize) {
  const output = new PNG({ width: targetSize, height: targetSize });

  const scaleX = source.width / targetSize;
  const scaleY = source.height / targetSize;

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcX = x * scaleX;
      const srcY = y * scaleY;

      const pixel = bilinearInterpolate(source, srcX, srcY);

      const idx = (targetSize * y + x) << 2;
      output.data[idx] = pixel.r;
      output.data[idx + 1] = pixel.g;
      output.data[idx + 2] = pixel.b;
      output.data[idx + 3] = pixel.a;
    }
  }

  return output;
}

// Check source logo exists
if (!fs.existsSync(sourceLogo)) {
  console.error(`Error: Source logo not found at ${sourceLogo}`);
  process.exit(1);
}

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Read source logo
console.log(`Reading source logo: ${sourceLogo}`);
const sourceData = fs.readFileSync(sourceLogo);
const source = PNG.sync.read(sourceData);
console.log(`Source size: ${source.width}x${source.height}`);

// Generate icons
sizes.forEach(size => {
  const resized = resizeImage(source, size);
  const buffer = PNG.sync.write(resized);
  const filename = path.join(iconsDir, `icon${size}.png`);

  fs.writeFileSync(filename, buffer);
  console.log(`Generated: icon${size}.png (${size}x${size})`);
});

console.log('\nAll CrawlHQ Hooker icons generated successfully!');
console.log(`Icons saved to: ${iconsDir}`);
