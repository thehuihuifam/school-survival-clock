/**
 * Path helper for assets that live in `public/`.
 *
 * The app is deployed under `https://thehuihuifam.github.io/school-survival-clock/`
 * but also runs from `/` in dev, so every public asset is resolved against the
 * document's own base URI instead of being hard-coded to a root path.
 */
export function assetUrl(relativePath: string): string {
  const cleaned = relativePath.replace(/^\.?\/+/, '')
  if (typeof document === 'undefined') {
    return `./${cleaned}`
  }
  return new URL(`./${cleaned}`, document.baseURI).href
}
