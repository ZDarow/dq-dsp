import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  /** Placement relative to the trigger. */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Show delay in ms (default 120ms). Native `title` delays ~500ms; we
   *  want something much snappier. */
  delay?: number
  /** Maximum width of the tooltip in CSS units (default `18rem`). */
  maxWidth?: string
  className?: string
  /** Override the wrapper span class — use `block` or `flex w-full` when
   *  the trigger is full-width (e.g. a slider). Default `inline-flex`. */
  wrapperClassName?: string
}

const VIEWPORT_MARGIN = 8

/**
 * Lightweight custom tooltip — replaces the native `title` attribute with
 * a fast, theme-styled bubble. Renders into a portal at the document body
 * so it can escape overflow-hidden ancestors. After mount it measures
 * itself and shifts inward when it would overflow the viewport edges, so
 * triggers near a screen edge still show readable tooltips.
 */
export function Tooltip({
  content,
  children,
  placement = 'bottom',
  delay = 120,
  maxWidth = '18rem',
  className,
  wrapperClassName = 'inline-flex',
}: TooltipProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [shift, setShift] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const compute = () => {
    const el = wrapperRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const gap = 8
    let top = 0
    let left = 0
    switch (placement) {
      case 'top':
        top = r.top - gap
        left = r.left + r.width / 2
        break
      case 'bottom':
        top = r.bottom + gap
        left = r.left + r.width / 2
        break
      case 'left':
        top = r.top + r.height / 2
        left = r.left - gap
        break
      case 'right':
        top = r.top + r.height / 2
        left = r.right + gap
        break
    }
    return { top, left }
  }

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setShift({ x: 0, y: 0 })
      setCoords(compute())
      setOpen(true)
    }, delay)
  }

  const hide = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setOpen(false)
    setShift({ x: 0, y: 0 })
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  // Re-position on scroll/resize while open so the bubble tracks the trigger.
  useEffect(() => {
    if (!open) return
    const update = () => {
      setShift({ x: 0, y: 0 })
      setCoords(compute())
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // After the bubble renders, measure its intrinsic size and clamp into
  // the viewport. We compute the *canonical* bounds (where the bubble
  // would sit without any shift) from coords + placement + offsetWidth/
  // Height, so the shift is a pure function of trigger position, not of
  // the current shift state — avoids feedback loops.
  useLayoutEffect(() => {
    if (!open || !bubbleRef.current || !coords) return
    const w = bubbleRef.current.offsetWidth
    const h = bubbleRef.current.offsetHeight

    let canonLeft = 0
    let canonTop = 0
    switch (placement) {
      case 'top':
        canonLeft = coords.left - w / 2
        canonTop = coords.top - h
        break
      case 'bottom':
        canonLeft = coords.left - w / 2
        canonTop = coords.top
        break
      case 'left':
        canonLeft = coords.left - w
        canonTop = coords.top - h / 2
        break
      case 'right':
        canonLeft = coords.left
        canonTop = coords.top - h / 2
        break
    }

    let dx = 0
    let dy = 0
    if (canonLeft < VIEWPORT_MARGIN) {
      dx = VIEWPORT_MARGIN - canonLeft
    } else if (canonLeft + w > window.innerWidth - VIEWPORT_MARGIN) {
      dx = window.innerWidth - VIEWPORT_MARGIN - (canonLeft + w)
    }
    if (canonTop < VIEWPORT_MARGIN) {
      dy = VIEWPORT_MARGIN - canonTop
    } else if (canonTop + h > window.innerHeight - VIEWPORT_MARGIN) {
      dy = window.innerHeight - VIEWPORT_MARGIN - (canonTop + h)
    }

    setShift((prev) => (prev.x === dx && prev.y === dy ? prev : { x: dx, y: dy }))
  }, [open, coords, placement])

  // Translate the bubble so the chosen edge sits at (top,left).
  const bubbleTransform =
    placement === 'top'
      ? 'translate(-50%, -100%)'
      : placement === 'bottom'
        ? 'translate(-50%, 0)'
        : placement === 'left'
          ? 'translate(-100%, -50%)'
          : 'translate(0, -50%)'

  return (
    <span
      ref={wrapperRef}
      className={wrapperClassName}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        coords &&
        createPortal(
          <span
            ref={bubbleRef}
            role="tooltip"
            className={`pointer-events-none fixed z-[100] glass-panel-strong px-2.5 py-1.5 text-xs leading-snug text-text-primary ${className ?? ''}`}
            style={{
              top: coords.top + shift.y,
              left: coords.left + shift.x,
              transform: bubbleTransform,
              maxWidth,
              borderRadius: 'var(--radius-panel)',
              animation: 'dq-tooltip-in 90ms ease-out',
            }}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  )
}
