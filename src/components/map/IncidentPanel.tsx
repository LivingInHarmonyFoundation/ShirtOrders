'use client'

import { useEffect, useRef } from 'react'
import { INCIDENT_COLORS, INCIDENT_LABELS, formatDate, formatTime } from './utils'
import type { Incident } from './types'

interface Props {
  incident: Incident | null
  onClose: () => void
}

export default function IncidentPanel({ incident, onClose }: Props) {
  const color = incident ? INCIDENT_COLORS[incident.type] : '#00d4ff'
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-30 pointer-events-none"
        style={{
          background: incident
            ? 'linear-gradient(to left, rgba(2,14,26,0.7) 30%, transparent 100%)'
            : 'none',
          transition: 'background 0.4s ease',
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute right-0 top-0 h-full z-40 flex flex-col overflow-hidden"
        style={{
          width: 'clamp(300px, 30vw, 400px)',
          background: 'linear-gradient(180deg, #030f1e 0%, #020d1a 100%)',
          borderLeft: '1px solid rgba(0,212,255,0.15)',
          transform: incident ? 'translateX(0)' : 'translateX(100%)',
          opacity: incident ? 1 : 0,
          transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
          boxShadow: incident ? '-8px 0 40px rgba(0,0,0,0.6), -1px 0 0 rgba(0,212,255,0.08)' : 'none',
          pointerEvents: incident ? 'auto' : 'none',
        }}
      >
        {incident && <PanelContent incident={incident} color={color} onClose={onClose} />}
      </div>
    </>
  )
}

function PanelContent({ incident, color, onClose }: { incident: Incident; color: string; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      {/* Header bar */}
      <div
        className="flex-shrink-0 px-5 pt-5 pb-4"
        style={{ borderBottom: '1px solid rgba(0,212,255,0.1)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-block rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}`,
                  flexShrink: 0,
                }}
              />
              <span
                className="text-[9px] tracking-[0.22em] uppercase"
                style={{ color, fontFamily: 'monospace', opacity: 0.9 }}
              >
                {INCIDENT_LABELS[incident.type]}
              </span>
            </div>
            <h2
              className="text-sm font-semibold tracking-wide leading-tight"
              style={{ color: '#e8f4ff', fontFamily: 'monospace' }}
            >
              {incident.title}
            </h2>
            <p
              className="text-[9px] tracking-[0.18em] mt-1 opacity-50"
              style={{ color: '#00d4ff', fontFamily: 'monospace' }}
            >
              {incident.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded border transition-all duration-200 cursor-pointer"
            style={{
              color: '#00d4ff',
              borderColor: 'rgba(0,212,255,0.25)',
              background: 'rgba(0,212,255,0.05)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,212,255,0.7)'
              e.currentTarget.style.background = 'rgba(0,212,255,0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,212,255,0.25)'
              e.currentTarget.style.background = 'rgba(0,212,255,0.05)'
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-4 flex flex-col gap-5">

        {/* Image */}
        {incident.imageUrl ? (
          <div className="rounded overflow-hidden aspect-video">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={incident.imageUrl} alt={incident.title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div
            className="aspect-video rounded flex flex-col items-center justify-center gap-2"
            style={{
              background: 'rgba(0,20,40,0.6)',
              border: '1px solid rgba(0,212,255,0.1)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" opacity="0.25">
              <rect x="2" y="5" width="24" height="18" rx="2" stroke="#00d4ff" strokeWidth="1.2" />
              <circle cx="9" cy="11" r="2.5" stroke="#00d4ff" strokeWidth="1.2" />
              <path d="M2 20l6-5 4 4 4-5 6 7" stroke="#00d4ff" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            <span
              className="text-[8px] tracking-[0.2em] uppercase opacity-40"
              style={{ color: '#00d4ff', fontFamily: 'monospace' }}
            >
              No Image Available
            </span>
          </div>
        )}

        {/* Summary */}
        <div>
          <Label>Summary</Label>
          <p
            className="text-xs leading-relaxed mt-1"
            style={{ color: 'rgba(180,210,240,0.75)', fontFamily: 'monospace' }}
          >
            {incident.summary}
          </p>
        </div>

        <Divider />

        {/* Location */}
        <Row label="Location" value={incident.location} />

        {/* Coordinates */}
        <Row
          label="Coordinates"
          value={`${incident.latitude.toFixed(4)}°N  ${Math.abs(incident.longitude).toFixed(4)}°W`}
          mono
        />

        <Divider />

        {/* Date/Time */}
        <Row label="Reported" value={`${formatDate(incident.reportedAt)} — ${formatTime(incident.reportedAt)}`} />

        {/* Assigned */}
        <Row label="Assigned To" value={incident.assignedTo} />
      </div>

      {/* Footer accent */}
      <div
        className="flex-shrink-0 px-5 py-3 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-[pr-blink_3s_ease_infinite]"
          style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
        />
        <span
          className="text-[8px] tracking-[0.2em] uppercase opacity-50"
          style={{ color: '#00d4ff', fontFamily: 'monospace' }}
        >
          Active Incident
        </span>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[8px] tracking-[0.22em] uppercase opacity-50 mb-0.5"
      style={{ color: '#00d4ff', fontFamily: 'monospace' }}
    >
      {children}
    </p>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <p
        className="text-[11px] leading-snug"
        style={{ color: '#c8e0f0', fontFamily: mono ? 'monospace' : 'inherit', letterSpacing: mono ? '0.05em' : undefined }}
      >
        {value}
      </p>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,212,255,0.08)' }} />
}
