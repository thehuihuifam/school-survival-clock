import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { SolarIcon, type SolarIconName } from '../Icon'

/* ------------------------------------------------------------------ *
 * Field
 * ------------------------------------------------------------------ */

interface FieldProps {
  id: string
  label: string
  icon?: SolarIconName
  hint?: string
  error?: string
  className?: string
  children: ReactNode
}

export function Field({ id, label, icon, hint, error, className, children }: FieldProps) {
  return (
    <div className={`settings-field ${className ?? ''} ${error ? 'has-error' : ''}`.trim()}>
      <label htmlFor={id}>
        {icon && <SolarIcon name={icon} size={15} />}
        {label}
      </label>
      {children}
      {error
        ? <span className="field-error" role="alert"><SolarIcon name="danger-circle-bold" size={13} /> {error}</span>
        : hint
          ? <span className="field-hint">{hint}</span>
          : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Toggle row (switch)
 * ------------------------------------------------------------------ */

interface ToggleRowProps {
  id: string
  title: string
  description?: string
  icon: SolarIconName
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  /** Extra control rendered on the right (e.g. a permission button). */
  aside?: ReactNode
}

export function ToggleRow({ id, title, description, icon, checked, disabled, onChange, aside }: ToggleRowProps) {
  return (
    <div className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="toggle-icon" aria-hidden="true"><SolarIcon name={icon} size={17} /></span>
      <div className="toggle-copy">
        <label htmlFor={id}>{title}</label>
        {description && <p>{description}</p>}
      </div>
      {aside}
      <button
        id={id}
        type="button"
        role="switch"
        className="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        <span className="sr-only">{checked ? '켜짐' : '꺼짐'}</span>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Segmented control (roving radio group)
 * ------------------------------------------------------------------ */

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: SolarIconName
}

interface SegmentedControlProps<T extends string> {
  label: string
  value: T
  options: Array<SegmentOption<T>>
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string>({ label, value, options, onChange, size = 'md' }: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = options.findIndex((option) => option.value === value)
    let nextIndex = currentIndex

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % options.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + options.length) % options.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = options.length - 1
    } else {
      return
    }

    event.preventDefault()
    onChange(options[nextIndex].value)

    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    buttons?.[nextIndex]?.focus()
  }

  return (
    <div
      className={`segmented-control is-${size}`}
      role="radiogroup"
      aria-label={label}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={`segment ${isSelected ? 'is-selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.icon && <SolarIcon name={option.icon} size={14} />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Section shell used by every settings tab
 * ------------------------------------------------------------------ */

interface SettingsSectionProps {
  title: string
  description?: string
  icon: SolarIconName
  aside?: ReactNode
  children: ReactNode
}

export function SettingsSection({ title, description, icon, aside, children }: SettingsSectionProps) {
  return (
    <section className="settings-section">
      <header className="settings-section-header">
        <span className="section-icon" aria-hidden="true"><SolarIcon name={icon} size={16} /></span>
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  )
}
