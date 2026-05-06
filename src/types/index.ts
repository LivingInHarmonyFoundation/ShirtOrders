/**
 * @file types/index.ts
 * @description Central TypeScript type definitions for the entire application.
 * All domain types (orders, cart, settings, team, catalog) live here and are
 * imported throughout the codebase.
 *
 * Key invariant: The `Order` interface includes both legacy flat fields
 * (shirt_size, quantity, unit_price from when each order was a single item)
 * AND the `items?: OrderItem[]` array added later to support multi-item orders.
 * Both shapes are valid; the `items` array takes precedence when present.
 */

// ─── Enum-style String Unions ─────────────────────────────────

/** InstitutionType — the four order categories supported by the ordering form. */
export type InstitutionType = 'school' | 'government' | 'personal' | 'private_company'

/** ShirtSize — available shirt size options. */
export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL'

/** PaymentStatus — lifecycle states for an order's payment. */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'manual'

/** PaymentMethod — the payment instrument used (or to be used) for an order. */
export type PaymentMethod = 'paypal' | 'venmo' | 'card' | 'cash'

/** OrderStatus — admin-managed fulfilment lifecycle state. */
export type OrderStatus = 'new' | 'processing' | 'ready' | 'completed' | 'cancelled'

/** DeliveryStatus — physical delivery state of the order. */
export type DeliveryStatus = 'not_delivered' | 'partially_delivered' | 'delivered'

// ─── Order Domain ─────────────────────────────────────────────

/**
 * OrderItem — a single line item within a multi-item order, stored in the
 * order_items table. Linked to an order via order_id.
 */
export interface OrderItem {
  id: string
  order_id: string
  catalog_item_id: string | null
  catalog_item_name: string
  shirt_size: string
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

/**
 * CartItem — an item held in the client-side cart (CartContext). Not
 * persisted to the database until checkout completes. The `id` field is a
 * locally generated UUID used as a React key and for targeted mutations.
 */
export interface CartItem {
  id: string
  catalog_item_id: string | null
  catalog_item_name: string
  catalog_item_image: string | null
  shirt_size: string
  quantity: number
  unit_price: number
}

/**
 * Order — the full order record as returned from the database.
 * Contains both legacy flat item fields (shirt_size, quantity, unit_price,
 * catalog_item_id, catalog_item_name) from the original single-item schema
 * AND the optional `items` array added for multi-item support.
 * When `items` is present and non-empty it takes precedence for display and
 * CSV export; the flat fields are kept for backward compatibility.
 */
export interface Order {
  id: string
  order_number: string
  full_name: string
  email: string
  phone: string | null
  institution_type: InstitutionType
  school_name: string | null
  grade: string | null
  classroom: string | null
  organization_name: string | null
  department_office: string | null
  company_name: string | null
  company_department: string | null
  delivery_address: string | null
  shirt_size: ShirtSize
  quantity: number
  unit_price: number
  total_amount: number
  payment_status: PaymentStatus
  order_status: OrderStatus
  delivery_status: DeliveryStatus
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  payment_method: PaymentMethod | null
  company_link_id: string | null
  order_allowed_payment_methods: string[] | null
  date_submitted: string
  date_paid: string | null
  date_delivered: string | null
  catalog_item_id: string | null
  catalog_item_name: string | null
  notes: string | null
  applied_fees?: { name: string; type: 'percentage' | 'fixed'; value: number; amount: number }[] | null
  discount_code?: string | null
  discount_amount?: number
  admin_notes: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

/**
 * OrderFormData — the shape of the form data collected on the order page
 * before the cart is submitted. Passed as the checkoutPayload to CartDrawer.
 */
export interface OrderFormData {
  full_name: string
  email: string
  phone?: string
  institution_type: InstitutionType
  school_name?: string
  grade?: string
  classroom?: string
  organization_name?: string
  department_office?: string
  company_name?: string
  company_department?: string
  delivery_address?: string
  shirt_size: ShirtSize
  quantity: number
  notes?: string
  campaign_id?: string
}

// ─── Fees ─────────────────────────────────────────────────

/**
 * OrderFee — a single named fee configured by an admin in app_settings.order_fees.
 * Applied server-side at order creation; the computed per-order breakdown is stored
 * in orders.applied_fees as AppliedFee[].
 */
export interface OrderFee {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  /** null or empty array means applies to all institution types */
  applies_to: InstitutionType[] | null
}

// ─── Discount Codes ───────────────────────────────────────────

/**
 * DiscountCode — a promotional code that can reduce an order's total.
 * Stored in the discount_codes table. type 'percentage' applies a percent
 * reduction to total_amount; 'fixed' subtracts a flat USD amount.
 */
export interface DiscountCode {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  expires_at: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

// ─── Application Settings ─────────────────────────────────────

/**
 * AppSettings — global configuration for the app, stored in a single row in
 * the settings table. Controls feature flags, pricing, payment methods, and
 * notification preferences.
 *
 * Note: `admin_phone` is the ntfy.sh topic name used for push notifications,
 * not an actual phone number. See notifications.ts.
 */
export interface AppSettings {
  id: string
  app_name: string
  logo_url: string | null
  mission_banner_url: string | null
  badge_url: string | null
  shirt_price: number
  available_sizes: string[]
  school_orders_enabled: boolean
  government_orders_enabled: boolean
  personal_orders_enabled: boolean
  private_company_orders_enabled: boolean
  manual_payment_enabled: boolean
  cash_enabled: boolean
  cash_enabled_school: boolean
  cash_enabled_government: boolean
  cash_enabled_private_company: boolean
  personal_allowed_payment_methods: string[] | null
  confirmation_message: string
  qr_tagline: string
  order_fees: OrderFee[]
  admin_phone: string | null
  sms_notifications_enabled: boolean
  created_at: string
  updated_at: string
}

// ─── Admin / Reporting Types ──────────────────────────────────

/**
 * AuditLog — a single field-change record for an order, used to track admin
 * edits. Stored in the audit_logs table.
 */
export interface AuditLog {
  id: string
  order_id: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
}

/**
 * DashboardStats — aggregated metrics returned by the /api/admin/stats route
 * for the admin dashboard. Includes order counts, revenue, and breakdowns by
 * institution type, size, date, and catalog item.
 */
export interface DashboardStats {
  total_orders: number
  total_shirts: number
  total_revenue: number
  paid_orders: number
  unpaid_orders: number
  delivered_orders: number
  pending_deliveries: number
  orders_by_institution: { institution_type: string; count: number }[]
  orders_by_size: { shirt_size: string; count: number }[]
  revenue_by_date: { date: string; revenue: number }[]
  orders_by_catalog_item: { name: string; orders: number; shirts: number }[]
  has_catalog_breakdown: boolean
}

/**
 * OrderFilters — filter and pagination parameters passed to the orders list
 * API. All fields are optional; omitted fields are treated as "no filter".
 */
export interface OrderFilters {
  search?: string
  institution_type?: InstitutionType | ''
  payment_status?: PaymentStatus | ''
  delivery_status?: DeliveryStatus | ''
  shirt_size?: ShirtSize | ''
  date_from?: string
  date_to?: string
  campaign_id?: string
  sort?: 'newest' | 'oldest' | 'paid' | 'unpaid' | 'delivered' | 'not_delivered'
  page?: number
  limit?: number
}

/**
 * PaginatedOrders — the response shape returned by the paginated orders
 * endpoint, including the page of results and total count metadata.
 */
export interface PaginatedOrders {
  orders: Order[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export type UserRole = 'owner' | 'admin' | 'staff'

export interface TeamMember {
  id: string
  user_id: string | null
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  invited_by: string | null
  created_at: string
  updated_at: string
}

export interface ShirtCatalogItem {
  id: string
  name: string
  description: string | null
  image_url: string | null
  back_image_url: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GovOrg {
  id: string
  name: string
  is_active: boolean
  departments: string[] | null
  allowed_payment_methods: string[] | null
  created_at: string
  updated_at: string
}

export interface PrivateCompany {
  id: string
  name: string
  slug: string
  is_active: boolean
  allowed_payment_methods: string[] | null
  created_at: string
  updated_at: string
  order_count?: number
}

export interface SchoolLink {
  id: string
  school_name: string
  slug: string
  is_active: boolean
  grades: string[] | null
  allowed_payment_methods: string[] | null
  created_at: string
  order_count?: number
}

export interface Campaign {
  id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  /** When true, start_date/end_date are treated as an annual month-day window that auto-activates yearly */
  is_recurring: boolean
  ended_message: string
  slug: string | null
  banner_url: string | null
  badge_url: string | null
  created_at: string
  updated_at: string
  order_count?: number
  catalog_items?: ShirtCatalogItem[]
}

export interface ShirtInventoryItem {
  id: string
  catalog_item_id: string | null
  shirt_size: string
  quantity: number
  low_stock_threshold: number
  created_at: string
  updated_at: string
  // joined field from shirt_catalog
  catalog_item_name?: string | null
}
