'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { QrCode, Download, RefreshCw, Link2, Type } from 'lucide-react'
import { useRole } from '@/components/admin/role-provider'
import { toast } from 'sonner'

const BRAND = {
  green:     '#00352F',
  lime:      '#CEDC00',
  lightTeal: '#E5F2F0',
  white:     '#FFFFFF',
} as const

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

const URL_OPTIONS = [
  { label: 'Order Page (/order)', value: `${APP_URL}/order` },
  { label: 'Home Page (/)',       value: `${APP_URL}/`      },
  { label: 'Custom URL',          value: 'custom'            },
]

const SIZE_PRESETS = [
  { label: 'Instagram Square (1080 × 1080)', w: 1080, h: 1080 },
  { label: 'Instagram Story (1080 × 1920)',  w: 1080, h: 1920 },
  { label: 'Print / Large (2400 × 2400)',    w: 2400, h: 2400 },
] as const

// Polyfill roundRect for older Safari
function ensureRoundRect(ctx: CanvasRenderingContext2D) {
  if (!ctx.roundRect) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ctx as any).roundRect = function(x: number, y: number, w: number, h: number, r: number) {
      const radius = Math.min(r, w / 2, h / 2)
      this.moveTo(x + radius, y)
      this.lineTo(x + w - radius, y)
      this.arcTo(x + w, y, x + w, y + h, radius)
      this.lineTo(x + w, y + h - radius)
      this.arcTo(x + w, y + h, x, y + h, radius)
      this.lineTo(x + radius, y + h)
      this.arcTo(x, y + h, x, y, radius)
      this.lineTo(x, y + radius)
      this.arcTo(x, y, x + w, y, radius)
      this.closePath()
    }
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

async function drawBrandedQR(
  canvas: HTMLCanvasElement,
  canvasW: number,
  canvasH: number,
  url: string,
  ctaText: string,
  variant: 'light' | 'dark'
): Promise<string> {
  // 1. Generate QR matrix (error correction H — survives 30% data loss, needed for logo overlay)
  const qr     = QRCode.create(url, { errorCorrectionLevel: 'H' })
  const matrix = qr.modules.data
  const size   = qr.modules.size

  const ctx = canvas.getContext('2d')!
  canvas.width  = canvasW
  canvas.height = canvasH
  ensureRoundRect(ctx)

  const isPortrait = canvasH > canvasW * 1.4

  // 2. Compute layout
  const pad         = canvasW * 0.055
  const accentH     = Math.round(canvasW * 0.012)
  const topTextH    = canvasW * (isPortrait ? 0.18 : 0.115)
  const bottomTextH = canvasW * (isPortrait ? 0.18 : 0.135)

  let qrAreaSize: number, qrX: number, qrY: number

  if (isPortrait) {
    qrAreaSize = canvasW * 0.82
    qrX        = (canvasW - qrAreaSize) / 2
    qrY        = (canvasH - qrAreaSize) / 2 - canvasH * 0.03
  } else {
    qrAreaSize = Math.min(canvasW - pad * 2, canvasH - topTextH - bottomTextH - pad * 2)
    qrX        = (canvasW - qrAreaSize) / 2
    qrY        = pad + topTextH
  }

  const cellSize = qrAreaSize / size

  // 3. Background
  ctx.fillStyle = variant === 'light' ? BRAND.white : BRAND.green
  ctx.fillRect(0, 0, canvasW, canvasH)

  // Portrait: decorative large lime circle in upper third
  if (isPortrait) {
    ctx.globalAlpha = 0.05
    ctx.fillStyle   = BRAND.lime
    ctx.beginPath()
    ctx.arc(canvasW / 2, canvasH * 0.22, canvasW * 0.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Lime accent strip — top
  ctx.fillStyle = BRAND.lime
  ctx.fillRect(0, 0, canvasW, accentH)

  // 4. Top text
  const topCenterY = isPortrait ? canvasH * 0.12 : pad + topTextH * 0.4

  const orgFontSize = Math.round(canvasW * (isPortrait ? 0.042 : 0.046))
  ctx.font         = `700 ${orgFontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle    = variant === 'light' ? BRAND.green : BRAND.lime
  ctx.fillText('Living in Harmony Foundation', canvasW / 2, topCenterY)

  const subFontSize = Math.round(canvasW * 0.026)
  ctx.font      = `400 ${subFontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.fillStyle = variant === 'light' ? 'rgba(0,53,47,0.45)' : 'rgba(206,220,0,0.55)'
  ctx.fillText('livinginharmonypr.org', canvasW / 2, topCenterY + orgFontSize * 1.5)

  // 5. QR module background (quiet zone)
  ctx.fillStyle = BRAND.white
  ctx.beginPath()
  ctx.roundRect(qrX - 2, qrY - 2, qrAreaSize + 4, qrAreaSize + 4, cellSize * 0.5)
  ctx.fill()

  // Draw QR modules with rounded corners
  ctx.fillStyle = BRAND.green
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!matrix[row * size + col]) continue
      const mx = qrX + col * cellSize
      const my = qrY + row * cellSize
      const ms = cellSize - 0.5
      ctx.beginPath()
      ctx.roundRect(mx, my, ms, ms, ms * 0.35)
      ctx.fill()
    }
  }

  // 6. Logo overlay — centered, 20% of QR area
  const logoZoneSize = qrAreaSize * 0.20
  const logoX = qrX + (qrAreaSize - logoZoneSize) / 2
  const logoY = qrY + (qrAreaSize - logoZoneSize) / 2
  const logoPad    = logoZoneSize * 0.18
  const backingSize = logoZoneSize + logoPad * 2

  ctx.shadowColor   = 'rgba(0,0,0,0.2)'
  ctx.shadowBlur    = canvasW * 0.012
  ctx.shadowOffsetY = canvasW * 0.004
  ctx.fillStyle     = BRAND.white
  ctx.beginPath()
  ctx.roundRect(logoX - logoPad, logoY - logoPad, backingSize, backingSize, backingSize * 0.2)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur  = 0
  ctx.shadowOffsetY = 0

  try {
    const logo = await loadImage('/logo.png')
    ctx.drawImage(logo, logoX, logoY, logoZoneSize, logoZoneSize)
  } catch {
    // If logo fails, QR still works — just no logo overlay
  }

  // 7. Bottom CTA
  const ctaTopY = isPortrait
    ? qrY + qrAreaSize + canvasH * 0.055
    : qrY + qrAreaSize + (canvasH - qrY - qrAreaSize) * 0.22

  const ctaFontSize = Math.round(canvasW * (isPortrait ? 0.048 : 0.052))
  ctx.font         = `800 ${ctaFontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle    = variant === 'light' ? BRAND.green : BRAND.white
  ctx.fillText(ctaText, canvasW / 2, ctaTopY)

  // Lime accent dots flanking the CTA
  const dotR  = canvasW * 0.007
  const textW = ctx.measureText(ctaText).width
  const dotY  = ctaTopY + ctaFontSize / 2
  ctx.fillStyle = BRAND.lime
  ctx.beginPath(); ctx.arc(canvasW / 2 - textW / 2 - dotR * 2.5, dotY, dotR, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(canvasW / 2 + textW / 2 + dotR * 2.5, dotY, dotR, 0, Math.PI * 2); ctx.fill()

  // URL hint below CTA
  const urlFontSize = Math.round(canvasW * 0.022)
  ctx.font      = `400 ${urlFontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.fillStyle = variant === 'light' ? 'rgba(0,53,47,0.38)' : 'rgba(229,242,240,0.40)'
  const displayUrl = url.replace(/^https?:\/\//, '')
  ctx.fillText(displayUrl, canvasW / 2, ctaTopY + ctaFontSize * 1.5)

  // Lime accent strip — bottom
  ctx.fillStyle = BRAND.lime
  ctx.fillRect(0, canvasH - accentH, canvasW, accentH)

  return canvas.toDataURL('image/png')
}

export default function QRCodePage() {
  const { permissions } = useRole()

  const [urlOption,   setUrlOption]   = useState(URL_OPTIONS[0].value)
  const [customUrl,   setCustomUrl]   = useState('')
  const [ctaText,     setCtaText]     = useState('Scan to Order Your Shirt')
  const [variant,     setVariant]     = useState<'light' | 'dark'>('light')
  const [generating,  setGenerating]  = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  const targetUrl = urlOption === 'custom' ? customUrl.trim() : urlOption

  const generatePreview = useCallback(async () => {
    if (!previewCanvasRef.current) return
    if (!targetUrl) return

    setGenerating(true)
    try {
      const dpr     = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
      const logical = 480
      const canvas  = previewCanvasRef.current
      await drawBrandedQR(canvas, logical * dpr, logical * dpr, targetUrl, ctaText, variant)
      canvas.style.width  = `${logical}px`
      canvas.style.height = `${logical}px`
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate QR code. Check the URL.')
    } finally {
      setGenerating(false)
    }
  }, [targetUrl, ctaText, variant])

  useEffect(() => {
    generatePreview()
  }, [generatePreview])

  const handleDownload = async (preset: typeof SIZE_PRESETS[number]) => {
    if (!targetUrl) { toast.error('No URL configured'); return }
    setDownloading(preset.label)
    try {
      const offscreen = document.createElement('canvas')
      const dataUrl   = await drawBrandedQR(offscreen, preset.w, preset.h, targetUrl, ctaText, variant)
      const a = document.createElement('a')
      a.href     = dataUrl
      a.download = `lih-qr-${preset.w}x${preset.h}.png`
      a.click()
      toast.success(`Downloaded — ${preset.label}`)
    } catch {
      toast.error('Download failed. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  const noAppUrl = !APP_URL && urlOption !== 'custom'
  const canGenerate = !!targetUrl && !noAppUrl

  if (!permissions.canManageSettings) {
    return (
      <div className="max-w-lg">
        <Card>
          <CardContent className="py-16 text-center">
            <QrCode className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-700">Access Restricted</p>
            <p className="text-sm text-gray-400 mt-1">Only admins and owners can generate QR codes.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Code Generator</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Create a branded QR code for social media, TV displays, and printed flyers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* LEFT — Live Preview */}
        <Card className="md:sticky md:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <QrCode className="w-4 h-4" /> Live Preview
            </CardTitle>
            <CardDescription className="text-xs">
              Updates as you change options below
            </CardDescription>
          </CardHeader>
          <CardContent>
            {noAppUrl && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                <strong>NEXT_PUBLIC_APP_URL</strong> is not set. Add it to your environment variables, or use a Custom URL.
              </div>
            )}
            <div className="relative rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center" style={{ aspectRatio: '1 / 1' }}>
              <canvas
                ref={previewCanvasRef}
                style={{ display: 'block', imageRendering: 'crisp-edges', maxWidth: '100%' }}
              />
              {generating && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                  <RefreshCw className="w-6 h-6 animate-spin" style={{ color: BRAND.green }} />
                </div>
              )}
              {!targetUrl && !generating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <QrCode className="w-10 h-10 opacity-30" />
                  <p className="text-xs">Enter a URL to preview</p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              Preview at screen resolution — downloads are full resolution
            </p>
          </CardContent>
        </Card>

        {/* RIGHT — Controls */}
        <div className="space-y-4">

          {/* Destination URL */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Link2 className="w-4 h-4" /> Destination URL
              </CardTitle>
              <CardDescription className="text-xs">
                Where the QR code will take people when scanned
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={urlOption} onValueChange={(v) => v && setUrlOption(v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {URL_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {urlOption === 'custom' && (
                <Input
                  placeholder="https://your-url.com"
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  className="text-sm font-mono"
                />
              )}
              {targetUrl && (
                <div className="px-2.5 py-1.5 bg-gray-50 rounded-lg border">
                  <p className="text-[11px] text-gray-500 font-mono truncate">{targetUrl}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Text & Style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Type className="w-4 h-4" /> Text & Style
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Call to Action</Label>
                <Input
                  value={ctaText}
                  onChange={e => setCtaText(e.target.value)}
                  placeholder="Scan to Order Your Shirt"
                  maxLength={48}
                  className="text-sm"
                />
                <p className="text-[11px] text-gray-400">{ctaText.length}/48 characters</p>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs">Color Variant</Label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setVariant('light')}
                    className="flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                    style={variant === 'light'
                      ? { borderColor: BRAND.green, backgroundColor: BRAND.lightTeal, color: BRAND.green }
                      : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => setVariant('dark')}
                    className="flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                    style={variant === 'dark'
                      ? { borderColor: BRAND.green, backgroundColor: BRAND.green, color: BRAND.lime }
                      : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Download */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Download className="w-4 h-4" /> Download
              </CardTitle>
              <CardDescription className="text-xs">
                High-resolution PNG — ready for print and social media
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {SIZE_PRESETS.map(preset => (
                <Button
                  key={preset.label}
                  variant="outline"
                  className="w-full justify-between text-sm font-normal h-10"
                  onClick={() => handleDownload(preset)}
                  disabled={!canGenerate || !!downloading}
                >
                  <span>{preset.label}</span>
                  {downloading === preset.label
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400" />
                    : <Download className="w-3.5 h-3.5 text-gray-400" />
                  }
                </Button>
              ))}
              <p className="text-[11px] text-gray-400 pt-1">
                All sizes generated locally — no data is sent to any server.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
