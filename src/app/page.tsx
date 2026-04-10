import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { School, Building2, CheckCircle, Shield, CreditCard, FileText, ShoppingBag } from 'lucide-react'

export default function LandingPage() {
  const features = [
    { icon: ShoppingBag, title: 'Easy Ordering',    desc: 'Simple form for placing shirt orders' },
    { icon: CreditCard,  title: 'Secure Payment',   desc: 'Pay safely with Stripe-powered checkout' },
    { icon: FileText,    title: 'Order Tracking',   desc: 'Get a confirmation with your order number' },
    { icon: Shield,      title: 'Secure & Safe',    desc: 'Your data is protected and secure' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F4F0]">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-0.5 border border-gray-100">
              <Image src="/logo.png" alt="Living in Harmony Foundation" width={36} height={36} className="object-contain" />
            </div>
            <div>
              <p className="font-bold text-[#1B4D2E] text-sm leading-none">Living in Harmony Foundation</p>
              <p className="text-gray-400 text-xs mt-0.5">Shirt Order Manager</p>
            </div>
          </div>
          <Link href="/admin/login">
            <Button variant="outline" size="sm">Admin Login</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 px-4" style={{ background: 'linear-gradient(135deg, #EFF8E8 0%, #d4edda 100%)' }}>
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 border-[#8DC63F]/50 text-[#1B4D2E]" style={{ backgroundColor: '#d4edda' }}>
              Official Order Portal
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Order Your Institution Shirts
            </h1>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Place your shirt order online in minutes. Secure payment, instant confirmation, and easy tracking for schools and government organizations.
            </p>
            <Link href="/order">
              <Button size="lg" className="text-white px-10 h-12 text-base font-semibold shadow-md" style={{ backgroundColor: '#1B4D2E' }}>
                Place an Order
              </Button>
            </Link>
          </div>
        </section>

        {/* Who can order */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Who Can Order?</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-2 border-[#8DC63F]/30 hover:border-[#1B4D2E]/40 transition-colors">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#EFF8E8] rounded-xl flex items-center justify-center flex-shrink-0">
                    <School className="w-6 h-6 text-[#1B4D2E]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Schools</h3>
                    <p className="text-gray-600 text-sm">Students, teachers, and staff from schools. Include grade and classroom details.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-[#8DC63F]/30 hover:border-[#1B4D2E]/40 transition-colors">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#EFF8E8] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-[#1B4D2E]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Government Organizations</h3>
                    <p className="text-gray-600 text-sm">Government agencies, departments, and offices. Include department details.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-[#F5F4F0]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Why Order With Us?</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="text-center">
                  <div className="w-12 h-12 bg-[#EFF8E8] rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-6 h-6 text-[#1B4D2E]" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">{title}</h3>
                  <p className="text-gray-500 text-xs">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">3 Simple Steps</h2>
            <div className="space-y-4">
              {[
                { step: '1', title: 'Fill Out the Form', desc: 'Enter your details and shirt preferences' },
                { step: '2', title: 'Review & Pay',      desc: 'Review your order summary and pay securely' },
                { step: '3', title: 'Get Confirmation',  desc: 'Receive your order confirmation instantly' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-center gap-4 p-4 rounded-xl bg-[#EFF8E8]">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm" style={{ backgroundColor: '#1B4D2E' }}>
                    {step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{title}</h3>
                    <p className="text-gray-500 text-sm">{desc}</p>
                  </div>
                  <CheckCircle className="ml-auto w-5 h-5 text-[#8DC63F]" />
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/order">
                <Button size="lg" className="text-white px-10 h-12 font-semibold shadow-md" style={{ backgroundColor: '#1B4D2E' }}>
                  Start Your Order
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white py-6 px-4">
        <div className="max-w-6xl mx-auto text-center text-gray-400 text-sm">
          © {new Date().getFullYear()} Living in Harmony Foundation. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
