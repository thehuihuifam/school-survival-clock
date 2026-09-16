#!/usr/bin/env node
/**
 * App icon generator (dependency-free).
 *
 * A PWA needs real bitmap icons for install prompts, `apple-touch-icon` and
 * notification badges. Rather than committing binary blobs nobody can
 * reproduce, the icons are rasterised here with plain maths: signed-distance
 * rounded rectangles, a diagonal gradient and a supersampled lightning polygon,
 * encoded to PNG with `node:zlib`. The result matches `public/icon.svg`.
 *
 * Usage: `npm run icons:app`
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(scriptDir, '..', 'public')

/* ------------------------------------------------------------------ *
 * PNG encoder
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let index = 0; index < buffer.length; index += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[index]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: truecolour + alpha
  header[10] = 0 // compression
  header[11] = 0 // filter
  header[12] = 0 // interlace

  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------------ *
 * Drawing primitives
 * ------------------------------------------------------------------ */

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

const clamp01 = (value) => Math.min(1, Math.max(0, value))
const lerp = (from, to, ratio) => from + (to - from) * ratio

/** Signed distance to a rounded rectangle centred on (cx, cy). */
function roundedRectDistance(x, y, cx, cy, halfWidth, halfHeight, radius) {
  const dx = Math.abs(x - cx) - halfWidth + radius
  const dy = Math.abs(y - cy) - halfHeight + radius
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  const inside = Math.min(Math.max(dx, dy), 0)
  return outside + inside - radius
}

/** 1px-wide anti-aliased coverage from a signed distance. */
const coverage = (distance) => clamp01(0.5 - distance)

/** Even-odd point-in-polygon test. */
function insidePolygon(x, y, points) {
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [xi, yi] = points[index]
    const [xj, yj] = points[previous]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) {
      inside = !inside
    }
  }
  return inside
}

/** Supersampled coverage for the polygon (3×3 taps). */
function polygonCoverage(x, y, points) {
  const taps = [-1 / 3, 0, 1 / 3]
  let hits = 0
  for (const offsetY of taps) {
    for (const offsetX of taps) {
      if (insidePolygon(x + offsetX, y + offsetY, points)) {
        hits += 1
      }
    }
  }
  return hits / taps.length ** 2
}

function composite(target, offset, alpha, color) {
  if (alpha <= 0) {
    return
  }
  const inverse = 1 - alpha
  target[offset] = Math.round(lerp(target[offset], color.r, alpha))
  target[offset + 1] = Math.round(lerp(target[offset + 1], color.g, alpha))
  target[offset + 2] = Math.round(lerp(target[offset + 2], color.b, alpha))
  target[offset + 3] = Math.round(clamp01(target[offset + 3] / 255 * inverse + alpha) * 255)
}

/* ------------------------------------------------------------------ *
 * Icon artwork (all coordinates in a 512×512 design space)
 * ------------------------------------------------------------------ */

const DESIGN_SIZE = 512
const PALETTE = {
  gradientStart: hexToRgb('#7ef0c4'),
  gradientEnd: hexToRgb('#046c50'),
  ink: hexToRgb('#052e21'),
  spark: hexToRgb('#eafff6'),
}

const BATTERY = { cx: 236, cy: 256, halfWidth: 132, halfHeight: 78, radius: 42, stroke: 26 }
const TERMINAL = { cx: 396, cy: 256, halfWidth: 16, halfHeight: 30, radius: 12 }
const BOLT = [
  [254, 208],
  [204, 268],
  [234, 268],
  [220, 306],
  [274, 250],
  [242, 250],
]

function renderIcon(size) {
  const scale = size / DESIGN_SIZE
  const rgba = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4

      // Design-space coordinates of this pixel's centre.
      const dx = (x + 0.5) / scale
      const dy = (y + 0.5) / scale

      // 1. Rounded-square backdrop with a diagonal emerald gradient.
      const backdrop = coverage(roundedRectDistance(dx, dy, 256, 256, 256, 256, 112))
      if (backdrop <= 0) {
        rgba[offset + 3] = 0
        continue
      }
      const gradientRatio = clamp01((dx + dy) / (2 * DESIGN_SIZE))
      const base = {
        r: Math.round(lerp(PALETTE.gradientStart.r, PALETTE.gradientEnd.r, gradientRatio)),
        g: Math.round(lerp(PALETTE.gradientStart.g, PALETTE.gradientEnd.g, gradientRatio)),
        b: Math.round(lerp(PALETTE.gradientStart.b, PALETTE.gradientEnd.b, gradientRatio)),
      }
      rgba[offset] = base.r
      rgba[offset + 1] = base.g
      rgba[offset + 2] = base.b
      rgba[offset + 3] = Math.round(backdrop * 255)

      // 2. Battery outline (outer rounded rect minus inner rounded rect).
      const outer = coverage(
        roundedRectDistance(dx, dy, BATTERY.cx, BATTERY.cy, BATTERY.halfWidth, BATTERY.halfHeight, BATTERY.radius),
      )
      const inner = coverage(
        roundedRectDistance(
          dx,
          dy,
          BATTERY.cx,
          BATTERY.cy,
          BATTERY.halfWidth - BATTERY.stroke,
          BATTERY.halfHeight - BATTERY.stroke,
          Math.max(6, BATTERY.radius - BATTERY.stroke),
        ),
      )
      composite(rgba, offset, clamp01(outer - inner), PALETTE.ink)

      // 3. Battery terminal.
      const terminal = coverage(
        roundedRectDistance(dx, dy, TERMINAL.cx, TERMINAL.cy, TERMINAL.halfWidth, TERMINAL.halfHeight, TERMINAL.radius),
      )
      composite(rgba, offset, terminal, PALETTE.ink)

      // 4. Lightning bolt.
      composite(rgba, offset, polygonCoverage(dx, dy, BOLT), PALETTE.spark)
    }
  }

  return encodePng(size, size, rgba)
}

mkdirSync(publicDir, { recursive: true })

const targets = [
  { size: 512, file: 'icon-512.png' },
  { size: 192, file: 'icon-192.png' },
  { size: 180, file: 'apple-touch-icon.png' },
]

for (const target of targets) {
  const png = renderIcon(target.size)
  const destination = join(publicDir, target.file)
  writeFileSync(destination, png)
  console.log(`[icons] ${target.file} ${target.size}×${target.size} (${(png.length / 1024).toFixed(1)} kB)`)
}
