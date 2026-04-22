---
name: Cart System Architecture
description: Shopping cart system added April 2026 — CartContext, CartDrawer, CartIcon, order_items table
type: project
---

A multi-item cart system was implemented. Key details:

- **CartContext** at `src/contexts/CartContext.tsx` — React Context with localStorage persistence under key `lih_cart`. Exposes `addItem`, `removeItem`, `updateQuantity`, `clearCart`, `totalItems`, `totalAmount`, `isOpen`, `openCart`, `closeCart`.
- **CartProvider** wraps the entire `/order/**` route tree via `src/app/order/layout.tsx`.
- **CartIcon** at `src/components/shared/CartIcon.tsx` — custom SVG shirt-hanger icon (not a lucide icon), lime `#CEDC00` badge with bounce animation.
- **CartDrawer** at `src/components/shared/CartDrawer.tsx` — slide-in drawer, accepts `checkoutPayload` (personal info from form state) and `onCheckoutValidate` callback. POSTs to `/api/orders` with `items[]` array.
- **DB migration** `supabase/migrations/018_order_items.sql` — `order_items` table with `order_id`, `catalog_item_id`, `catalog_item_name`, `shirt_size`, `quantity`, `unit_price`, `subtotal`. Backfills existing orders.
- **Orders API** updated to accept `items: CartItem[]` (multi-item) or legacy single `shirt_size/quantity` fields. Inserts order row + bulk-inserts into `order_items`.
- **Admin order detail** (`/api/admin/orders/[id]/route.ts`) now fetches `order_items` and returns them as `order.items`. The admin UI shows a line-items table when items exist.
- **UX flow**: User fills personal info + picks shirt/size → clicks "Add to Cart" (form submits to addItem, NOT to API) → cart drawer opens → user can add more items → clicks "Checkout" in drawer → single API call creates order + order_items → redirects to `/order/checkout?order_id=XXX`.

**Why:** The existing system only supported one shirt/size per order. This adds multi-item carts while keeping backwards compat (legacy single-item API fields still work).

**How to apply:** When touching order forms or the orders API, be aware of the cart context and the dual-path submission logic.
