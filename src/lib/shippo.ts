/**
 * @file shippo.ts
 * @description Quote-only shipping rate lookup via Shippo. This module ONLY fetches a
 * price estimate for a destination — it never purchases labels or creates shipments
 * (the foundation handles actual fulfillment separately). Used to price the "Shipping"
 * line on personal orders based on the customer's delivery ZIP.
 *
 * Auth: SHIPPO_API_TOKEN (server-only env var). Origin + per-shirt weight are constants
 * below. Returns null on any failure so the caller can fall back to a flat rate.
 */

const SHIPPO_TOKEN = process.env.SHIPPO_API_TOKEN

/** Ship-from — the foundation's San Juan address (rate origin only; not a label). */
const SHIP_FROM = {
  name: 'Living in Harmony Foundation',
  street1: '1607 Ave. Ponce de Leon, Cobians Plaza Suite LM-12',
  city: 'San Juan',
  state: 'PR',
  zip: '00909',
  country: 'US',
} as const

/** Approximate weight of one shirt, in ounces (used to size the parcel for the quote). */
export const SHIRT_WEIGHT_OZ = 6

interface Destination {
  city?: string
  state?: string
  zip: string
}

/**
 * getCheapestShippingRate — returns the lowest available shipping cost (USD) from the
 * foundation to `dest` for a parcel of `totalWeightOz`, preferring USPS. Returns null if
 * the token is missing, the request fails/times out, or no rates come back — the caller
 * then applies a flat fallback rate. Purely a rate quote; buys nothing.
 */
export async function getCheapestShippingRate(dest: Destination, totalWeightOz: number): Promise<number | null> {
  if (!SHIPPO_TOKEN || !dest.zip) return null
  try {
    const res = await fetch('https://api.goshippo.com/shipments/', {
      method: 'POST',
      headers: {
        Authorization: `ShippoToken ${SHIPPO_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address_from: SHIP_FROM,
        address_to: {
          name: 'Customer',
          city: dest.city || '',
          state: dest.state || '',
          zip: dest.zip,
          country: 'US',
        },
        parcels: [{
          length: '10', width: '8', height: '1', distance_unit: 'in',
          weight: String(Math.max(1, Math.round(totalWeightOz))), mass_unit: 'oz',
        }],
        async: false,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null

    const data = await res.json()
    const rates: { provider?: string; amount?: string }[] = data.rates || []
    const amounts = rates
      .filter(r => r.amount && !Number.isNaN(parseFloat(r.amount)))
      .map(r => ({ provider: r.provider, amount: parseFloat(r.amount!) }))
    if (amounts.length === 0) return null

    // Prefer the cheapest USPS rate (standard for light shirt parcels); else cheapest overall.
    const usps = amounts.filter(a => a.provider === 'USPS')
    const pool = usps.length > 0 ? usps : amounts
    return Math.min(...pool.map(a => a.amount))
  } catch {
    return null
  }
}
