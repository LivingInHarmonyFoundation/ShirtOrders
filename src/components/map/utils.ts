import type { IncidentType } from './types'

export const INCIDENT_COLORS: Record<IncidentType, string> = {
  structural_damage: '#ff4d4d',
  power_outage:      '#ff9500',
  water_main_break:  '#00ccff',
  noise_complaint:   '#ffe100',
  traffic_incident:  '#cc44ff',
  gas_leak:          '#00ff88',
}

export const INCIDENT_LABELS: Record<IncidentType, string> = {
  structural_damage: 'Structural Damage',
  power_outage:      'Power Outage',
  water_main_break:  'Water Main Break',
  noise_complaint:   'Noise Complaint',
  traffic_incident:  'Traffic Incident',
  gas_leak:          'Gas Leak',
}

// SVG viewBox: "0 0 900 350"
// lon: [-67.35, -65.55] → x: [40, 860]
// lat: [18.52, 17.88]   → y: [30, 320]
export function toSVG(lon: number, lat: number): { x: number; y: number } {
  const x = (lon + 67.35) * 455.6 + 40
  const y = (18.52 - lat) * 453.1 + 30
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
