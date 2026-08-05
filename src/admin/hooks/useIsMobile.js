import { useState, useEffect } from 'react'

// Deterministic mobile detection via matchMedia — used instead of relying on
// CSS media queries fighting inline styles (which is fragile: a stylesheet
// rule needs !important to beat an inline style, and inline gridTemplateColumns
// set from JS state is easy to accidentally leave un-overridden). This hook
// lets each split-pane admin page compute the RIGHT layout in JS directly,
// so there's no possibility of the "collapse to single column" rule silently
// failing to apply.
export function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = () => setIsMobile(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}
