#!/usr/bin/env node
/**
 * Icon generator
 * --------------
 * The dashboard used to load `<iconify-icon>` from a public CDN at runtime and
 * then fetch every Solar glyph over the network. That cost a render-blocking
 * third-party script, one request per icon, invisible icons whenever the CDN or
 * the network was unavailable, and it made offline use impossible.
 *
 * This script inlines the glyphs instead: it scans `src/**` for Solar icon
 * names that are actually referenced, pulls their SVG bodies out of the
 * (dev-only) `@iconify-json/solar` package and writes
 * `src/components/icons.generated.ts`. The shipped bundle therefore contains
 * exactly the icons the UI uses — no more, no less — and `SolarIcon` renders a
 * plain inline `<svg>`.
 *
 * Usage: `npm run icons`
 */
import { createRequire } from 'node:module'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const sourceRoot = join(repoRoot, 'src')
const outputFile = join(sourceRoot, 'components', 'icons.generated.ts')

const collection = require('@iconify-json/solar/icons.json')
const collectionWidth = collection.width ?? 24
const collectionHeight = collection.height ?? 24
const knownNames = new Set(Object.keys(collection.icons))

/** Recursively collect every source file we may reference an icon from. */
function collectSourceFiles(directory) {
  const collected = []
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry)
    const stats = statSync(absolute)
    if (stats.isDirectory()) {
      collected.push(...collectSourceFiles(absolute))
      continue
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.generated.ts') && !entry.endsWith('.test.ts')) {
      collected.push(absolute)
    }
  }
  return collected
}

/**
 * Icons can be referenced directly (`name="bell-bold"`), through typed lookup
 * tables (`icon: 'bell-bold'`) or via unions, so instead of parsing JSX we take
 * every string literal in the source and keep the ones that are real Solar
 * icon names.
 */
function collectUsedNames(files) {
  const used = new Map()
  const literalPattern = /['"`]([a-z0-9]+(?:-[a-z0-9]+)+)['"`]/g

  for (const file of files) {
    const contents = readFileSync(file, 'utf8')
    for (const match of contents.matchAll(literalPattern)) {
      const candidate = match[1]
      if (knownNames.has(candidate) && !used.has(candidate)) {
        used.set(candidate, relative(repoRoot, file))
      }
    }
  }

  return [...used.entries()].sort(([left], [right]) => left.localeCompare(right))
}

// Glyphs are 24×24 and rendered at 13–25 px, so three decimal places are far
// below a visible pixel. Trimming long coordinates cuts ~13% off the map.
const COORDINATE_PRECISION = 3

function roundCoordinate(match) {
  const rounded = Number.parseFloat(match).toFixed(COORDINATE_PRECISION)
  return rounded.replace(/\.?0+$/, '')
}

function normaliseBody(body) {
  // Collapse whitespace and trim coordinate precision. Paint is *not* injected
  // here: `SolarIcon` renders `<svg fill="currentColor">`, so unpainted shapes
  // inherit the text colour while stroked (linear) glyphs keep their own
  // `fill="none"` attributes.
  return body
    .replace(/\s+/g, ' ')
    .replace(/-?\d+\.\d{4,}/g, roundCoordinate)
    .trim()
}

function resolveIcon(name) {
  const icon = collection.icons[name]
  if (!icon || typeof icon.body !== 'string' || icon.body.length === 0) {
    throw new Error(`Icon "solar:${name}" has no usable body in @iconify-json/solar.`)
  }
  if (/<defs|<mask|<clipPath/.test(icon.body)) {
    throw new Error(
      `Icon "solar:${name}" relies on <defs>/<mask>/<clipPath>. Pick a flat variant so the inline SVG stays dependency-free.`,
    )
  }

  let body = normaliseBody(icon.body)
  let width = icon.width ?? collectionWidth
  let height = icon.height ?? collectionHeight

  // Inherit parent-level transforms/opacity so nothing is silently dropped.
  if (icon.transform) {
    const { translate, scale, rotate } = icon.transform
    const parts = []
    if (translate?.x || translate?.y) {
      parts.push(`translate(${translate.x ?? 0} ${translate.y ?? 0})`)
    }
    if (scale) {
      const scaleX = typeof scale === 'number' ? scale : scale.x
      const scaleY = typeof scale === 'number' ? scale : (scale.y ?? scale.x)
      parts.push(`scale(${scaleX} ${scaleY})`)
    }
    if (rotate) {
      parts.push(`rotate(${(rotate * 180) / Math.PI})`)
    }
    if (parts.length > 0) {
      body = `<g transform="${parts.join(' ')}">${body}</g>`
    }
  }
  if (typeof icon.opacity === 'number' && icon.opacity !== 1) {
    body = `<g opacity="${icon.opacity}">${body}</g>`
  }

  return { body, width, height }
}

const sourceFiles = collectSourceFiles(sourceRoot)
const usedIcons = collectUsedNames(sourceFiles)

if (usedIcons.length === 0) {
  throw new Error('No Solar icon references found in src/ — refusing to write an empty icon map.')
}

const entries = usedIcons.map(([name, referencedFrom]) => {
  const icon = resolveIcon(name)
  return `  ${JSON.stringify(name)}: { body: ${JSON.stringify(icon.body)}, width: ${icon.width}, height: ${icon.height} }, // ${referencedFrom}`
})

const output = `/* AUTO-GENERATED by scripts/generate-icons.mjs — do not edit by hand. */
/* Run \`npm run icons\` after adding or removing a SolarIcon name in src/. */
import type { SolarIconGlyph } from './icon-types'

/**
 * Inline Solar glyphs actually referenced from src/.
 * \`body\` is trusted, build-time generated SVG markup (no user input ever
 * reaches it), which is why SolarIcon can inject it directly.
 */
export const SOLAR_ICON_GLYPHS = {
${entries.join('\n')}
} as const satisfies Record<string, SolarIconGlyph>

export type SolarIconName = keyof typeof SOLAR_ICON_GLYPHS
`

writeFileSync(outputFile, output, 'utf8')

const bytes = Buffer.byteLength(output, 'utf8')
console.log(
  `[icons] inlined ${usedIcons.length} Solar glyphs (${(bytes / 1024).toFixed(1)} kB source) → ${relative(repoRoot, outputFile)}`,
)
