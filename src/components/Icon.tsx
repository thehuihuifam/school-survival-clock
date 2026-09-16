import type { CSSProperties } from 'react'
import { SOLAR_ICON_GLYPHS, type SolarIconName } from './icons.generated'

export type { SolarIconName }

/**
 * Inline Solar icon.
 *
 * The glyphs are generated at build time (`npm run icons`) from the dev-only
 * `@iconify-json/solar` package, so the dashboard no longer ships a
 * render-blocking Iconify CDN script and no longer needs one network request
 * per icon. Rendering a plain `<svg>` also means icons are visible on the very
 * first paint, work offline, and inherit `currentColor` like normal text.
 *
 * `body` comes from the generated map only — user input never reaches it.
 */
interface SolarIconProps {
  name: SolarIconName
  /** Pixel number or any CSS length; applied to width/height/font-size. */
  size?: number | string
  /** Continuous rotation (transform based, disabled by `prefers-reduced-motion`). */
  spin?: boolean
  className?: string
  /** When set, the icon is exposed to assistive tech as `role="img"`. */
  label?: string
}

export function SolarIcon({ name, size = 20, spin = false, className, label }: SolarIconProps) {
  const glyph = SOLAR_ICON_GLYPHS[name]
  const dimension = typeof size === 'number' ? `${size}px` : size
  const style: CSSProperties = { width: dimension, height: dimension, fontSize: dimension }
  const classes = ['solar-icon', spin ? 'icon-spin' : '', className ?? ''].filter(Boolean).join(' ')

  return (
    <svg
      className={classes}
      style={style}
      viewBox={`0 0 ${glyph.width} ${glyph.height}`}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: glyph.body }}
    />
  )
}
