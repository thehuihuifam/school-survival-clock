import { useEffect } from 'react'

export const REVEAL_SELECTOR = '.reveal-on-scroll'
export const REVEAL_VISIBLE_CLASS = 'is-visible'

export function useRevealOnScroll() {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const targets = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR))
    if (targets.length === 0) {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((target) => target.classList.add(REVEAL_VISIBLE_CLASS))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return
          }
          entry.target.classList.add(REVEAL_VISIBLE_CLASS)
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
    )

    targets.forEach((target) => observer.observe(target))

    return () => observer.disconnect()
  }, [])
}
