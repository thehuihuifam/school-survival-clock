import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface FocusTrapOptions {
  isOpen: boolean
  containerRef: RefObject<HTMLElement | null>
  onClose: () => void
}

/**
 * Modal accessibility plumbing: move focus in, keep Tab inside, close on
 * Escape, restore focus on the way out and stop the page behind from
 * scrolling. Written by hand so the dashboard stays dependency-free.
 */
export function useFocusTrap({ isOpen, containerRef, onClose }: FocusTrapOptions) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusables = () =>
      Array.from(containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      )

    const focusFirst = () => {
      const candidates = focusables()
      const target = candidates[0] ?? containerRef.current
      target?.focus({ preventScroll: true })
    }

    // Focus after the browser paints the dialog so `offsetParent` is reliable.
    const rafId = window.requestAnimationFrame(focusFirst)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') {
        return
      }

      const candidates = focusables()
      if (candidates.length === 0) {
        event.preventDefault()
        containerRef.current?.focus({ preventScroll: true })
        return
      }

      const first = candidates[0]
      const last = candidates[candidates.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || !containerRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.cancelAnimationFrame(rafId)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus({ preventScroll: true })
    }
  }, [isOpen, onClose, containerRef])
}
