export type IncidentType =
  | 'structural_damage'
  | 'power_outage'
  | 'water_main_break'
  | 'noise_complaint'
  | 'traffic_incident'
  | 'gas_leak'

export interface Incident {
  id: string
  type: IncidentType
  title: string
  latitude: number
  longitude: number
  summary: string
  location: string
  reportedAt: string
  assignedTo: string
  imageUrl: string | null
}
