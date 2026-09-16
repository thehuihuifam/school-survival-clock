/** Shape of a single inline Solar glyph produced by `scripts/generate-icons.mjs`. */
export interface SolarIconGlyph {
  /** Trusted, build-time generated SVG inner markup. */
  readonly body: string
  readonly width: number
  readonly height: number
}
