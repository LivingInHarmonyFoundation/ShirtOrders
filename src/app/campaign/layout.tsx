import { CartProvider } from '@/contexts/CartContext'

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>
}
