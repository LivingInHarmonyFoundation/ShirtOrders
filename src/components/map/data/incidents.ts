import type { Incident } from '../types'

export const INCIDENTS: Incident[] = [
  {
    id: 'INC-001',
    type: 'structural_damage',
    title: 'Building Facade Collapse',
    latitude: 18.467,
    longitude: -66.1185,
    summary:
      'Partial facade collapse on a historic four-story building. Debris on the sidewalk. Area cordoned off within a 15-meter radius. Structural engineering team dispatched for assessment.',
    location: 'Calle San Francisco 204, Old San Juan',
    reportedAt: '2026-04-22T10:14:00-04:00',
    assignedTo: 'Unit Alpha-3 / Eng. Rosa Colón',
    imageUrl: null,
  },
  {
    id: 'INC-002',
    type: 'power_outage',
    title: 'Grid Failure — Sector 7',
    latitude: 18.455,
    longitude: -66.073,
    summary:
      'Transformer overload caused loss of power to approximately 1,200 residential and commercial units in the Condado district. Estimated restoration window: 3–4 hours.',
    location: 'Av. Ashford 1060, Condado',
    reportedAt: '2026-04-22T09:42:00-04:00',
    assignedTo: 'LUMA Energy Team B / Supervisor: J. Méndez',
    imageUrl: null,
  },
  {
    id: 'INC-003',
    type: 'water_main_break',
    title: 'High-Pressure Main Rupture',
    latitude: 18.44,
    longitude: -66.081,
    summary:
      'High-pressure water main ruptured causing significant flooding across two lanes on Ponce de León Ave. Traffic rerouted via Calle Loíza. PRASA repair crew on-site with excavation equipment.',
    location: 'Av. Ponce de León 1500, Santurce',
    reportedAt: '2026-04-22T08:55:00-04:00',
    assignedTo: 'PRASA Crew Delta / Lead: M. Rivera',
    imageUrl: null,
  },
  {
    id: 'INC-004',
    type: 'noise_complaint',
    title: 'Unauthorized Sound Event',
    latitude: 18.41,
    longitude: -66.065,
    summary:
      'Large-scale unauthorized music event generating sustained noise levels above 95 dB measured at 200m. Complaints received from residential towers in a 6-block radius. Officers en route.',
    location: 'Centro Comercial Las Américas, Hato Rey',
    reportedAt: '2026-04-22T11:30:00-04:00',
    assignedTo: 'PRPD Unit 18 / Officer L. Torres',
    imageUrl: null,
  },
  {
    id: 'INC-005',
    type: 'traffic_incident',
    title: 'Multi-Vehicle Collision',
    latitude: 18.45,
    longitude: -66.01,
    summary:
      'Three-vehicle rear-end collision on PR-26 eastbound near exit 3. One lane blocked. Two individuals transported to hospital with non-life-threatening injuries. Tow trucks dispatched.',
    location: 'PR-26 E, Isla Verde, Carolina',
    reportedAt: '2026-04-22T07:18:00-04:00',
    assignedTo: 'PRPD Highway Patrol / Unit 44',
    imageUrl: null,
  },
  {
    id: 'INC-006',
    type: 'gas_leak',
    title: 'Natural Gas Leak Detected',
    latitude: 18.40,
    longitude: -66.16,
    summary:
      'Gas company utility crew detected a natural gas leak at a junction beneath Av. Santa Cruz. Block evacuated as precaution. Gas utility crew coordinating with fire department. No ignition risk confirmed yet.',
    location: 'Av. Santa Cruz 78, Bayamón',
    reportedAt: '2026-04-22T12:05:00-04:00',
    assignedTo: 'NaturGas PR Crew 9 / Fire Station #2',
    imageUrl: null,
  },
]
