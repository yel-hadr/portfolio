// Minimal 256-color PNG encoder for the social card. A truecolor screenshot of the card is
// ~700 KB (the photo and the anti-aliased wave lines defeat PNG's compression); a median-cut
// palette with Floyd-Steinberg dithering brings it to ~230 KB with no visible loss, and avoids
// depending on ImageMagick or pngquant.
import { deflateSync } from 'node:zlib';

const PALETTE_SIZE = 256;
// Share of the quantization error that is diffused. Full-strength dithering turns the smooth
// navy background into noise that compresses badly; half of it still hides the banding
// (full strength: ~325 KB, half: ~230 KB).
const DITHER = 0.5;

// Median cut over a 5-bit-per-channel histogram: split the box with the most weighted spread
// along its widest channel, at the median pixel, until there are 256 boxes.
const buildPalette = (rgba) => {
  const counts = new Uint32Array(32768);
  for (let i = 0; i < rgba.length; i += 4) {
    counts[((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3)]++;
  }
  const bins = [];
  for (let key = 0; key < counts.length; key++) {
    if (counts[key]) bins.push({ c: [key >> 10, (key >> 5) & 31, key & 31], n: counts[key] });
  }

  const describe = (items) => {
    const min = [31, 31, 31];
    const max = [0, 0, 0];
    let n = 0;
    for (const { c, n: count } of items) {
      for (let k = 0; k < 3; k++) {
        if (c[k] < min[k]) min[k] = c[k];
        if (c[k] > max[k]) max[k] = c[k];
      }
      n += count;
    }
    const ranges = max.map((value, k) => value - min[k]);
    const axis = ranges.indexOf(Math.max(...ranges));
    return { items, n, axis, score: n * ranges[axis] };
  };

  const boxes = [describe(bins)];
  while (boxes.length < PALETTE_SIZE) {
    boxes.sort((a, b) => b.score - a.score);
    const box = boxes[0];
    if (box.score === 0) break;
    const sorted = [...box.items].sort((a, b) => a.c[box.axis] - b.c[box.axis]);
    let seen = 0;
    let cut = 1;
    for (; cut < sorted.length - 1; cut++) {
      seen += sorted[cut - 1].n;
      if (seen >= box.n / 2) break;
    }
    boxes.splice(0, 1, describe(sorted.slice(0, cut)), describe(sorted.slice(cut)));
  }

  // Each palette entry is the pixel-weighted mean of its box (bin centers, 8-bit)
  return boxes.map(({ items, n }) => {
    const sum = [0, 0, 0];
    for (const { c, n: count } of items)
      for (let k = 0; k < 3; k++) sum[k] += (c[k] * 8 + 4) * count;
    return sum.map((value) => Math.round(value / n));
  });
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

/** RGBA pixels (alpha ignored: the card is opaque) -> indexed PNG buffer. */
export const encodePng8 = (rgba, width, height) => {
  const palette = buildPalette(rgba);
  // Nearest palette entry, cached on a 6-bit-per-channel key (dithered values vary finely)
  const cache = new Int16Array(1 << 18).fill(-1);
  const nearest = (r, g, b) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    if (cache[key] >= 0) return cache[key];
    let best = 0;
    let bestDistance = Infinity;
    palette.forEach(([pr, pg, pb], index) => {
      const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    cache[key] = best;
    return best;
  };

  // Floyd-Steinberg error diffusion on a float copy of the image
  const work = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    work[j] = rgba[i];
    work[j + 1] = rgba[i + 1];
    work[j + 2] = rgba[i + 2];
  }
  const clamp = (value) => (value < 0 ? 0 : value > 255 ? 255 : Math.round(value));
  const spread = (x, y, error, weight) => {
    if (x < 0 || x >= width || y >= height) return;
    const j = (y * width + x) * 3;
    for (let k = 0; k < 3; k++) work[j + k] += error[k] * weight;
  };
  // Each row starts with filter byte 0 (none): palette indices compress best unfiltered
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const j = (y * width + x) * 3;
      const color = [clamp(work[j]), clamp(work[j + 1]), clamp(work[j + 2])];
      const index = nearest(...color);
      raw[y * (width + 1) + 1 + x] = index;
      const error = color.map((value, k) => (value - palette[index][k]) * DITHER);
      spread(x + 1, y, error, 7 / 16);
      spread(x - 1, y + 1, error, 3 / 16);
      spread(x, y + 1, error, 5 / 16);
      spread(x + 1, y + 1, error, 1 / 16);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 3; // color type: indexed
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('PLTE', Buffer.from(palette.flat())),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};
