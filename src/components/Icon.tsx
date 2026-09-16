import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from 'react'

/**
 * Iconify Solar 아이콘 화이트리스트.
 * 모든 이름은 @iconify-json/solar 컬렉션에 실재하는 것으로 검증했다.
 */
export const SOLAR_ICONS = [
  'alarm-bold',
  'arrow-right-linear',
  'arrow-right-up-linear',
  'battery-charge-bold',
  'bolt-bold',
  'calendar-bold',
  'calendar-date-bold',
  'calendar-mark-bold',
  'chat-round-like-bold',
  'check-circle-bold',
  'clock-circle-bold',
  'close-circle-bold',
  'confetti-bold',
  'cup-hot-bold',
  'cup-hot-linear',
  'danger-triangle-bold',
  'diskette-bold',
  'flash-drive-bold',
  'graph-up-bold',
  'hand-heart-bold',
  'history-2-bold',
  'info-circle-linear',
  'maximize-square-3-bold',
  'minimize-square-bold',
  'moon-bold',
  'notebook-bold',
  'plate-bold',
  'plate-linear',
  'point-on-map-bold',
  'refresh-bold',
  'settings-bold',
  'stars-bold',
  'stars-minimalistic-bold',
  'sun-2-bold',
  'target-bold',
  'user-rounded-bold',
] as const

export type SolarIconName = (typeof SOLAR_ICONS)[number]

type IconifyIconElement = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  icon?: string
  width?: string | number
  height?: string | number
  inline?: boolean
  class?: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'iconify-icon': IconifyIconElement
    }
  }
}

interface SolarIconProps {
  name: SolarIconName
  /** 픽셀 숫자 또는 CSS 길이 문자열. width/height/font-size에 함께 적용된다. */
  size?: number | string
  /** 무한 회전 (transform 기반, prefers-reduced-motion에서 자동 해제) */
  spin?: boolean
  className?: string
  /** 값이 있으면 aria-hidden 대신 role="img" + aria-label로 노출 */
  label?: string
}

export function SolarIcon({ name, size = 20, spin = false, className, label }: SolarIconProps) {
  const dimension = typeof size === 'number' ? `${size}px` : size
  const style: CSSProperties = { width: dimension, height: dimension, fontSize: dimension }
  const classes = [spin ? 'icon-spin' : '', className ?? ''].filter(Boolean).join(' ')

  return (
    <iconify-icon
      icon={`solar:${name}`}
      class={classes || undefined}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
