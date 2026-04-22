import { INCIDENT_COLORS, INCIDENT_LABELS } from './utils'
import type { IncidentType } from './types'

const TYPES = Object.keys(INCIDENT_COLORS) as IncidentType[]

export default function MapLegend() {
  return (
    <div className="absolute bottom-4 left-4 z-10 select-none">
      <p
        className="text-[9px] tracking-[0.2em] mb-2 opacity-60"
        style={{ color: '#00d4ff', fontFamily: 'monospace' }}
      >
        INCIDENT TYPE
      </p>
      <div className="flex flex-col gap-1.5">
        {TYPES.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <span
              className="block rounded-full flex-shrink-0"
              style={{
                width: 8,
                height: 8,
                backgroundColor: INCIDENT_COLORS[type],
                boxShadow: `0 0 6px ${INCIDENT_COLORS[type]}`,
              }}
            />
            <span
              className="text-[9px] tracking-[0.15em] uppercase opacity-80"
              style={{ color: '#a0c8e0', fontFamily: 'monospace' }}
            >
              {INCIDENT_LABELS[type]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
