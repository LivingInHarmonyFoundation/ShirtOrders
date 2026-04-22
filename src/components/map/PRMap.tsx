'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Incident } from './types'
import { INCIDENTS } from './data/incidents'
import { INCIDENT_COLORS, INCIDENT_LABELS, toSVG } from './utils'
import IncidentPanel from './IncidentPanel'
import MapLegend from './MapLegend'

// Geographically accurate Puerto Rico outline
// Coordinate system: SVG viewBox "0 0 900 350"
// lon → x: (lon + 67.35) * 455.6 + 40
// lat → y: (18.52 - lat) * 453.1 + 30
const PR_PATH = [
  'M 131,44',
  'C 164,38 198,43 230,47',
  'C 268,44 306,44 346,46',
  'C 384,45 422,49 458,52',
  'C 492,52 524,52 556,56',
  'C 574,60 588,55 608,48',
  'C 626,44 648,47 670,52',
  'C 694,58 718,66 742,76',
  'C 762,84 778,94 796,108',
  'C 810,120 824,134 836,150',
  'C 843,163 847,177 846,190',
  'C 845,205 838,218 826,233',
  'C 810,247 789,259 762,268',
  'C 733,276 700,279 665,279',
  'C 628,279 592,278 556,276',
  'C 520,275 484,274 448,273',
  'C 412,272 378,272 344,272',
  'C 312,272 286,274 260,279',
  'C 238,283 218,283 198,278',
  'C 178,278 160,280 142,288',
  'C 128,295 114,297 112,288',
  'C 108,276 110,260 118,243',
  'C 124,228 128,211 130,194',
  'C 132,175 130,157 124,140',
  'C 118,126 108,113 96,103',
  'C 86,94 83,84 88,76',
  'C 92,68 106,58 120,52',
  'Z',
].join(' ')

// San Juan metro highlight region
const SJ = { x: 566, y: 30, w: 132, h: 76 }

// ViewBox states
const VB_FULL = [0, 0, 900, 350]
const VB_SJ   = [488, 15, 255, 99]  // maintains 900:350 ≈ 2.57 ratio

// City labels shown in full-PR view
const CITY_LABELS = [
  { name: 'AGUADILLA',  x: 100, y: 80,  anchor: 'middle' },
  { name: 'ARECIBO',    x: 316, y: 34,  anchor: 'middle' },
  { name: 'MAYAGÜEZ',   x: 100, y: 198, anchor: 'middle' },
  { name: 'PONCE',      x: 462, y: 288, anchor: 'middle' },
  { name: 'FAJARDO',    x: 836, y: 116, anchor: 'start'  },
]

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

function animateVB(
  svg: SVGSVGElement,
  from: number[],
  to: number[],
  duration: number,
  onDone?: () => void,
) {
  const t0 = performance.now()
  function step(now: number) {
    const p = Math.min((now - t0) / duration, 1)
    const e = easeInOut(p)
    const vb = from.map((f, i) => f + (to[i] - f) * e)
    svg.setAttribute('viewBox', vb.join(' '))
    if (p < 1) requestAnimationFrame(step)
    else onDone?.()
  }
  requestAnimationFrame(step)
}

type MapMode = 'full' | 'zoomed' | 'animating'

export default function PRMap() {
  const [mode, setMode]           = useState<MapMode>('full')
  const [selected, setSelected]   = useState<Incident | null>(null)
  const [clock, setClock]         = useState('')
  const svgRef = useRef<SVGSVGElement>(null)

  // Live clock
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false, timeZone: 'America/Puerto_Rico',
        }),
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const zoomIn = useCallback(() => {
    const svg = svgRef.current
    if (!svg || mode !== 'full') return
    setMode('animating')
    animateVB(svg, VB_FULL, VB_SJ, 900, () => setMode('zoomed'))
  }, [mode])

  const zoomOut = useCallback(() => {
    const svg = svgRef.current
    if (!svg || mode !== 'zoomed') return
    setSelected(null)
    setMode('animating')
    animateVB(svg, VB_SJ, VB_FULL, 900, () => setMode('full'))
  }, [mode])

  return (
    <div
      className="h-screen flex flex-col overflow-hidden select-none"
      style={{ background: '#020e1a', fontFamily: 'monospace' }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-5 py-3"
        style={{
          borderBottom: '1px solid rgba(0,212,255,0.12)',
          background: 'rgba(2,14,26,0.95)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="text-base font-bold tracking-[0.15em]" style={{ color: '#00d4ff' }}>
            PR
          </span>
          <span className="text-base font-bold tracking-[0.15em]" style={{ color: '#3a7a9a' }}>
            MAP
          </span>
        </div>

        {/* Status pills */}
        <div className="hidden sm:flex items-center gap-5">
          <StatusPill active label="SYSTEM ONLINE" />
          <StatusPill label={`${INCIDENTS.length} ACTIVE INCIDENTS`} />
          <StatusPill
            label={mode === 'zoomed' ? 'SAN JUAN SECTOR — ZOOMED' : 'SAN JUAN SECTOR'}
            dim={mode !== 'zoomed'}
          />
        </div>

        {/* Clock */}
        <div
          className="text-sm tracking-[0.12em] tabular-nums"
          style={{ color: '#00d4ff', opacity: 0.9 }}
        >
          {clock}
        </div>
      </header>

      {/* ── Map area ────────────────────────────────────── */}
      <main className="relative flex-1 overflow-hidden">
        {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)
            `,
            backgroundSize: '44px 44px',
          }}
        />

        {/* Scan line */}
        <div
          className="absolute left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.25), transparent)',
            animation: 'pr-scan 8s linear infinite',
            top: 0,
          }}
        />

        {/* Corner brackets */}
        <CornerBracket pos="tl" />
        <CornerBracket pos="tr" />
        <CornerBracket pos="bl" />
        <CornerBracket pos="br" />

        {/* SVG Map */}
        <svg
          ref={svgRef}
          viewBox="0 0 900 350"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="pr-glow-cyan" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="pr-glow-teal" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="pr-glow-dot" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Puerto Rico fill (subtle) */}
          <path
            d={PR_PATH}
            fill="rgba(0,40,70,0.35)"
            stroke="none"
          />

          {/* Puerto Rico outline — outer glow */}
          <path
            d={PR_PATH}
            fill="none"
            stroke="rgba(0,212,255,0.25)"
            strokeWidth="4"
          />

          {/* Puerto Rico outline — primary */}
          <path
            d={PR_PATH}
            fill="none"
            stroke="#00d4ff"
            strokeWidth="1.4"
            filter="url(#pr-glow-cyan)"
          />

          {/* City labels (only shown in full-PR view via opacity) */}
          {CITY_LABELS.map(({ name, x, y, anchor }) => (
            <text
              key={name}
              x={x} y={y}
              textAnchor={anchor as 'middle' | 'start'}
              fontSize="7"
              letterSpacing="1.5"
              fill="#3a6a8a"
              style={{
                fontFamily: 'monospace',
                opacity: mode === 'full' ? 0.9 : 0,
                transition: 'opacity 0.4s ease',
              }}
            >
              {name}
            </text>
          ))}

          {/* San Juan region — fill */}
          <rect
            x={SJ.x} y={SJ.y} width={SJ.w} height={SJ.h} rx={4}
            fill="rgba(0,229,200,0.04)"
            stroke="none"
          />

          {/* San Juan region — dashed border */}
          <rect
            x={SJ.x} y={SJ.y} width={SJ.w} height={SJ.h} rx={4}
            fill="none"
            stroke="#00e5c8"
            strokeWidth="1"
            strokeDasharray="5 3"
            filter="url(#pr-glow-teal)"
            style={{ animation: 'pr-dash-flow 1.8s linear infinite' }}
          />

          {/* San Juan label */}
          <text
            x={SJ.x + SJ.w / 2}
            y={SJ.y + SJ.h / 2 + 4}
            textAnchor="middle"
            fontSize="9"
            letterSpacing="2.5"
            fill="#00e5c8"
            filter="url(#pr-glow-teal)"
            style={{ fontFamily: 'monospace', pointerEvents: 'none', opacity: 0.7 }}
          >
            SAN JUAN
          </text>

          {/* San Juan click target */}
          <rect
            x={SJ.x} y={SJ.y} width={SJ.w} height={SJ.h} rx={4}
            fill="transparent"
            style={{
              cursor: mode === 'full' ? 'pointer' : 'default',
              pointerEvents: mode === 'animating' ? 'none' : 'auto',
            }}
            onClick={mode === 'full' ? zoomIn : undefined}
            onMouseEnter={(e) => {
              if (mode !== 'full') return
              ;(e.target as SVGRectElement).previousElementSibling?.setAttribute(
                'fill', 'rgba(0,229,200,0.09)',
              )
            }}
            onMouseLeave={(e) => {
              ;(e.target as SVGRectElement).previousElementSibling?.setAttribute(
                'fill', 'rgba(0,229,200,0.04)',
              )
            }}
          />

          {/* Incident dots */}
          {INCIDENTS.map((inc, i) => {
            const { x, y } = toSVG(inc.longitude, inc.latitude)
            const color = INCIDENT_COLORS[inc.type]
            const delay = `${i * 0.4}s`
            return (
              <g
                key={inc.id}
                transform={`translate(${x},${y})`}
                style={{ cursor: 'pointer', pointerEvents: mode === 'animating' ? 'none' : 'auto' }}
                onClick={(e) => { e.stopPropagation(); setSelected(inc) }}
              >
                {/* Pulse ring */}
                <circle
                  r={5}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.8}
                  style={{
                    animation: `pr-pulse-ring 2.4s ease-out ${delay} infinite`,
                    transformOrigin: '0 0',
                  }}
                />
                {/* Glow halo */}
                <circle
                  r={4}
                  fill={color}
                  opacity={0.15}
                  filter="url(#pr-glow-dot)"
                />
                {/* Main dot */}
                <circle
                  r={3.5}
                  fill={color}
                  filter="url(#pr-glow-dot)"
                  style={{
                    animation: `pr-dot-breathe 3s ease-in-out ${delay} infinite`,
                    transformOrigin: '0 0',
                  }}
                />
                {/* Hover ring (CSS :hover doesn't work reliably on SVG in all browsers,
                    so we use title for tooltip instead) */}
                <title>{inc.title} — {INCIDENT_LABELS[inc.type]}</title>
              </g>
            )
          })}
        </svg>

        {/* Back button */}
        <button
          onClick={zoomOut}
          className="absolute top-4 left-4 z-20 flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 transition-all duration-200"
          style={{
            color: '#00d4ff',
            border: '1px solid rgba(0,212,255,0.3)',
            background: 'rgba(2,14,26,0.85)',
            backdropFilter: 'blur(8px)',
            opacity: mode === 'zoomed' ? 1 : 0,
            pointerEvents: mode === 'zoomed' ? 'auto' : 'none',
            transform: mode === 'zoomed' ? 'translateX(0)' : 'translateX(-8px)',
            transition: 'opacity 0.35s ease, transform 0.35s ease, border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.7)'
            e.currentTarget.style.background = 'rgba(0,30,50,0.9)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'
            e.currentTarget.style.background = 'rgba(2,14,26,0.85)'
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M7 4H1M1 4L4 1M1 4L4 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        {/* Legend */}
        <MapLegend />

        {/* Coordinate display */}
        <div className="absolute bottom-4 right-4 z-10 text-right" style={{ pointerEvents: 'none' }}>
          <p className="text-[9px] tracking-[0.16em] tabular-nums" style={{ color: '#00d4ff', opacity: 0.55 }}>
            LAT 18.2208°N
          </p>
          <p className="text-[9px] tracking-[0.16em] tabular-nums" style={{ color: '#00d4ff', opacity: 0.55 }}>
            LON 66.5901°W
          </p>
          <p className="text-[8px] tracking-[0.14em] mt-1" style={{ color: '#3a6a8a', opacity: 0.6 }}>
            PUERTO RICO · UTC-4
          </p>
        </div>

        {/* Incident panel */}
        <IncidentPanel incident={selected} onClose={() => setSelected(null)} />
      </main>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusPill({ label, active, dim }: { label: string; active?: boolean; dim?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {active && (
        <span
          className="block w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: '#00ff88',
            boxShadow: '0 0 6px #00ff88',
            animation: 'pr-blink 3s ease infinite',
          }}
        />
      )}
      <span
        className="text-[9px] tracking-[0.18em] uppercase"
        style={{ color: dim ? '#2a5a7a' : '#00d4ff', opacity: dim ? 0.7 : 0.9 }}
      >
        {label}
      </span>
    </div>
  )
}

function CornerBracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const map = {
    tl: 'top-2 left-2 border-t border-l',
    tr: 'top-2 right-2 border-t border-r',
    bl: 'bottom-2 left-2 border-b border-l',
    br: 'bottom-2 right-2 border-b border-r',
  }
  return (
    <div
      className={`absolute w-4 h-4 pointer-events-none ${map[pos]}`}
      style={{ borderColor: 'rgba(0,212,255,0.25)' }}
    />
  )
}
