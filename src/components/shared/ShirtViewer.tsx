'use client'

import Image from 'next/image'
import { useRef, useState, useCallback, useEffect } from 'react'

interface ShirtViewerProps {
  frontUrl: string | null
  backUrl: string | null
  name: string
  /** 'square' (default) or 'compact' for order picker */
  variant?: 'square' | 'compact'
  className?: string
}

export default function ShirtViewer({ frontUrl, backUrl, name, variant = 'square', className = '' }: ShirtViewerProps) {
  const hasBack = Boolean(backUrl)

  // rotation angle in degrees (0 = front, 180 = back)
  const [rotation, setRotation] = useState(0)
  // whether we're actively dragging
  const dragging = useRef(false)
  const startX = useRef(0)
  const startRotation = useRef(0)
  // track velocity for momentum
  const lastX = useRef(0)
  const lastT = useRef(0)
  const velocity = useRef(0)
  const rafId = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Normalized rotation so it's always clamped to [0, 360)
  const normalizeAngle = (deg: number) => ((deg % 360) + 360) % 360

  // Snap to nearest 0 or 180 with momentum
  const snapToNearest = useCallback((currentRot: number, vel: number) => {
    const norm = normalizeAngle(currentRot)
    // Determine which face to snap to based on momentum + current position
    const projected = norm + vel * 80
    const normProjected = normalizeAngle(projected)

    let target: number
    if (normProjected < 90 || normProjected >= 270) {
      // snap to front face (find nearest multiple of 360)
      const base = Math.round(currentRot / 360) * 360
      target = base
    } else {
      const base = Math.round(currentRot / 360) * 360
      target = base + 180
    }

    // Animate to target
    const animate = () => {
      setRotation(prev => {
        const diff = target - prev
        if (Math.abs(diff) < 0.3) return target
        rafId.current = requestAnimationFrame(animate)
        return prev + diff * 0.15
      })
    }
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(animate)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!hasBack) return
    dragging.current = true
    startX.current = e.clientX
    startRotation.current = rotation
    lastX.current = e.clientX
    lastT.current = Date.now()
    velocity.current = 0
    if (rafId.current) cancelAnimationFrame(rafId.current)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [hasBack, rotation])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - startX.current
    const now = Date.now()
    const dt = now - lastT.current
    if (dt > 0) {
      velocity.current = (e.clientX - lastX.current) / dt
    }
    lastX.current = e.clientX
    lastT.current = now
    // 1px = 0.5deg of rotation
    setRotation(startRotation.current - dx * 0.5)
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    snapToNearest(rotation, velocity.current)
  }, [rotation, snapToNearest])

  const handleClick = useCallback(() => {
    if (!hasBack || dragging.current) return
    // Only treat as click if minimal drag happened
    const norm = normalizeAngle(rotation)
    const target = (norm < 90 || norm >= 270) ? Math.round(rotation / 360) * 360 + 180 : Math.round(rotation / 360) * 360
    const animate = () => {
      setRotation(prev => {
        const diff = target - prev
        if (Math.abs(diff) < 0.3) return target
        rafId.current = requestAnimationFrame(animate)
        return prev + diff * 0.15
      })
    }
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(animate)
  }, [hasBack, rotation])

  useEffect(() => () => { if (rafId.current) cancelAnimationFrame(rafId.current) }, [])

  const norm = normalizeAngle(rotation)
  const showingBack = norm > 90 && norm <= 270

  // CSS transform for the card — flip on Y axis
  const cardStyle: React.CSSProperties = {
    transform: `rotateY(${rotation}deg)`,
    transformStyle: 'preserve-3d',
    transition: dragging.current ? 'none' : undefined,
    willChange: 'transform',
  }

  const faceStyle: React.CSSProperties = { backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }
  const faceBase = 'absolute inset-0 rounded-2xl overflow-hidden'

  return (
    <div className={`relative select-none ${className}`} style={{ perspective: '800px' }}>
      {/* Card wrapper */}
      <div
        ref={containerRef}
        className={`relative w-full ${variant === 'compact' ? 'aspect-[4/3]' : 'aspect-square'} rounded-2xl`}
        style={cardStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={handleClick}
        role={hasBack ? 'button' : undefined}
        aria-label={hasBack ? `${name} — click or drag to rotate` : name}
        tabIndex={hasBack ? 0 : undefined}
        onKeyDown={hasBack ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() } : undefined}
      >
        {/* Front face */}
        <div
          className={faceBase}
          style={{ ...faceStyle, backgroundColor: '#E5F2F0', cursor: hasBack ? 'grab' : 'default' }}
        >
          {frontUrl ? (
            <Image
              src={frontUrl}
              alt={`${name} front`}
              fill
              className="object-cover pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[#CEDC00]/40">
              <svg viewBox="0 0 24 24" className="w-12 h-12" fill="currentColor">
                <path d="M21 6.5l-1-2c-.3-.6-.9-1-1.5-1H14c0-1.1-.9-2-2-2s-2 .9-2 2H5.5c-.6 0-1.2.4-1.5 1l-1 2c-.3.6 0 1.3.5 1.5L5 9v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9l1.5-.9c.6-.3.8-1 .5-1.6z" />
              </svg>
            </div>
          )}
        </div>

        {/* Back face — rotated 180° so it faces the camera when the card is flipped */}
        {hasBack && (
          <div
            className={faceBase}
            style={{
              ...faceStyle,
              backgroundColor: '#E5F2F0',
              transform: 'rotateY(180deg)',
              cursor: 'grab',
            }}
          >
            <Image
              src={backUrl!}
              alt={`${name} back`}
              fill
              className="object-cover pointer-events-none"
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* Front / Back label pill */}
      {hasBack && (
        <div
          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider pointer-events-none"
          style={{
            backgroundColor: 'rgba(0,53,47,0.75)',
            color: '#CEDC00',
            backdropFilter: 'blur(6px)',
          }}
        >
          <span
            style={{
              opacity: showingBack ? 0.45 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            Front
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span
            style={{
              opacity: showingBack ? 1 : 0.45,
              transition: 'opacity 0.2s',
            }}
          >
            Back
          </span>
        </div>
      )}

    </div>
  )
}
