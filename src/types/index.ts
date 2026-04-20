export type InstitutionType = 'school' | 'government' | 'personal' | 'private_company'

export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'manual'

export type PaymentMethod = 'paypal' | 'venmo' | 'card' | 'cash'

export type OrderStatus = 'new' | 'processing' | 'ready' | 'completed' | 'cancelled'

export type DeliveryStatus = 'not_delivered' | 'partially_delivered' | 'delivered'

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

export interface CartItem {
  id: string
  catalog_item_id: string | null
  catalog_item_name: string
  catalog_item_image: string | null
  shirt_size: string
  quantity: number
  unit_price: number
}

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
  admin_notes: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

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
}

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
  personal_allowed_payment_methods: string[] | null
  confirmation_message: string
  qr_tagline: string
  admin_phone: string | null
  sms_notifications_enabled: boolean
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  order_id: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
}

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
  ended_message: string
  created_at: string
  updated_at: string
  order_count?: number
}
