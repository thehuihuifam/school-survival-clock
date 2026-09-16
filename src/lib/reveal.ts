import { useEffect } from 'react'

const REVEAL_SELECTOR = '.reveal-on-scroll'
const REVEAL_VISIBLE_CLASS = 'is-visible'

/**
 * `.reveal-on-scroll` 요소를 IntersectionObserver로 관찰해
 * 뷰포트에 들어온 순간 `is-visible`을 붙이고 관찰을 해제한다.
 * scroll 이벤트 리스너는 쓰지 않는다.
 */
export function useRevealOnScroll(dependencies: unknown[] = []) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}
