'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QrCode, Download, RefreshCw } from 'lucide-react'
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
  { label: 'Instagram Square', slug: 'square',  w: 1080, h: 1080, res: '1080 × 1080' },
  { label: 'Instagram Story',  slug: 'story',   w: 1080, h: 1920, res: '1080 × 1920' },
  { label: 'Print / Large',    slug: 'print',   w: 2400, h: 2400, res: '2400 × 2400' },
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

// Helper: draw a rounded rectangle path
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

async function drawBrandedQR(
  canvas: HTMLCanvasElement,
  canvasW: number,
  canvasH: number,
  url: string,
  ctaText: string,
  variant: 'light' | 'dark'
): Promise<string> {
  // ── 1. Generate QR matrix ───────────────────────────────────────────────
  const qr     = QRCode.create(url, { errorCorrectionLevel: 'H' })
  const matrix = qr.modules.data
  const size   = qr.modules.size

  const ctx = canvas.getContext('2d')!
  canvas.width  = canvasW
  canvas.height = canvasH
  ensureRoundRect(ctx)

  const isPortrait = canvasH > canvasW * 1.4

  // ── 2. Theme colours ────────────────────────────────────────────────────
  const bg          = variant === 'light' ? '#FAFAF8' : '#00352F'
  const cardBg      = '#FFFFFF'
  const qrModuleClr = '#00352F'
  const outerFrame  = '#CEDC00'
  const textPrimary = variant === 'light' ? '#00352F' : '#FFFFFF'
  const textAccent  = variant === 'light' ? '#00352F' : '#CEDC00'
  const arcColor    = variant === 'light' ? '#00352F' : '#CEDC00'
  const arcAlpha    = variant === 'light' ? 0.07 : 0.10
  const urlColor    = variant === 'light' ? 'rgba(0,53,47,0.38)' : 'rgba(206,220,0,0.45)'

  // ── 3. Background fill ──────────────────────────────────────────────────
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvasW, canvasH)

  // ── 4. Decorative sweeping arc lines ────────────────────────────────────
  // Five quadratic curves sweeping top-left → bottom-right
  ctx.save()
  ctx.globalAlpha = arcAlpha
  ctx.strokeStyle = arcColor
  ctx.lineWidth   = canvasW * 0.003

  const arcCount = 5
  for (let i = 0; i < arcCount; i++) {
    const t      = i / (arcCount - 1)           // 0 → 1
    const startX = canvasW * (0.05 + t * 0.85)  // spread across top edge
    const startY = 0
    const endX   = 0
    const endY   = canvasH * (0.15 + t * 0.75)  // spread across left edge
    const cpX    = canvasW * (0.1 + t * 0.6)
    const cpY    = canvasH * (0.15 + t * 0.55)

    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.quadraticCurveTo(cpX, cpY, endX, endY)
    ctx.stroke()
  }

  // Second set of arcs from right/bottom for fullness
  for (let i = 0; i < arcCount; i++) {
    const t      = i / (arcCount - 1)
    const startX = canvasW
    const startY = canvasH * (0.05 + t * 0.85)
    const endX   = canvasW * (0.15 + t * 0.75)
    const endY   = canvasH
    const cpX    = canvasW * (0.9 - t * 0.5)
    const cpY    = canvasH * (0.5 + t * 0.35)

    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.quadraticCurveTo(cpX, cpY, endX, endY)
    ctx.stroke()
  }

  ctx.restore()

  // ── 5. Compute layout zones ─────────────────────────────────────────────
  const topH    = canvasH * (isPortrait ? 0.18 : 0.22)
  const bottomH = canvasH * (isPortrait ? 0.20 : 0.22)

  // QR card is a square that fills the middle zone
  const maxCardW = canvasW * 0.78
  const midZoneH = canvasH - topH - bottomH
  const qrCardW  = Math.min(maxCardW, midZoneH * 0.96)
  const qrCardH  = qrCardW
  const qrCardX  = (canvasW - qrCardW) / 2
  const qrCardY  = topH + (midZoneH - qrCardH) / 2

  // ── 6. Top section ──────────────────────────────────────────────────────
  const logoSize = canvasW * 0.14
  const logoX    = (canvasW - logoSize) / 2
  // Push logo down so there is comfortable breathing room from the top edge
  const logoY    = topH * 0.18

  // Logo image
  try {
    const logo = await loadImage('/logo.png')
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize)
  } catch {
    ctx.save()
    ctx.fillStyle   = textAccent
    ctx.globalAlpha = 0.3
    ctx.beginPath()
    ctx.arc(canvasW / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Org name — appears once, below the logo
  const orgFontSize = Math.round(canvasW * 0.036)
  ctx.font         = `700 ${orgFontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle    = textPrimary
  ctx.fillText('Living in Harmony Foundation', canvasW / 2, logoY + logoSize + orgFontSize * 0.3)

  // ── 7. QR card ──────────────────────────────────────────────────────────
  const cardRadius  = qrCardW * 0.08
  const framePad    = qrCardW * 0.045  // lime outer frame expands beyond white card
  const frameRadius = cardRadius + framePad * 0.5

  // 7a. Lime outer frame (slightly larger than white card)
  ctx.save()
  ctx.strokeStyle = outerFrame
  ctx.lineWidth   = canvasW * 0.006
  rrect(ctx,
    qrCardX - framePad,
    qrCardY - framePad,
    qrCardW + framePad * 2,
    qrCardH + framePad * 2,
    frameRadius
  )
  ctx.stroke()
  ctx.restore()

  // 7b. White card with drop shadow
  ctx.save()
  ctx.shadowColor   = 'rgba(0,0,0,0.18)'
  ctx.shadowBlur    = canvasW * 0.025
  ctx.shadowOffsetY = canvasW * 0.008
  ctx.fillStyle     = cardBg
  rrect(ctx, qrCardX, qrCardY, qrCardW, qrCardH, cardRadius)
  ctx.fill()
  ctx.restore()

  // 7c. Lime corner accent squares (4 corners of outer lime frame)
  const accentSize = qrCardW * 0.04
  const fx         = qrCardX - framePad
  const fy         = qrCardY - framePad
  const fw         = qrCardW + framePad * 2
  const fh         = qrCardH + framePad * 2

  ctx.fillStyle = outerFrame
  // Top-left
  ctx.fillRect(fx - accentSize * 0.5, fy - accentSize * 0.5, accentSize, accentSize)
  // Top-right
  ctx.fillRect(fx + fw - accentSize * 0.5, fy - accentSize * 0.5, accentSize, accentSize)
  // Bottom-left
  ctx.fillRect(fx - accentSize * 0.5, fy + fh - accentSize * 0.5, accentSize, accentSize)
  // Bottom-right
  ctx.fillRect(fx + fw - accentSize * 0.5, fy + fh - accentSize * 0.5, accentSize, accentSize)

  // 7d. QR modules inside white card
  const quietPad = qrCardW * 0.07
  const qrSize   = qrCardW - quietPad * 2
  const cellSize = qrSize / size
  const qrOriginX = qrCardX + quietPad
  const qrOriginY = qrCardY + quietPad

  ctx.fillStyle = qrModuleClr
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!matrix[row * size + col]) continue
      const mx = qrOriginX + col * cellSize
      const my = qrOriginY + row * cellSize
      const ms = cellSize - 0.6
      ctx.beginPath()
      ctx.roundRect(mx, my, ms, ms, ms * 0.28)
      ctx.fill()
    }
  }

  // 7e. Logo overlay centered in QR quiet zone
  const logoOverlaySize = qrSize * 0.21
  const logoOverX = qrCardX + (qrCardW - logoOverlaySize) / 2
  const logoOverY = qrCardY + (qrCardH - logoOverlaySize) / 2
  const logoPad   = logoOverlaySize * 0.18
  const backingW  = logoOverlaySize + logoPad * 2

  // White backing square for logo
  ctx.save()
  ctx.shadowColor   = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur    = canvasW * 0.012
  ctx.fillStyle     = cardBg
  rrect(ctx,
    logoOverX - logoPad,
    logoOverY - logoPad,
    backingW,
    backingW,
    backingW * 0.18
  )
  ctx.fill()
  ctx.restore()

  try {
    const logo = await loadImage('/logo.png')
    ctx.drawImage(logo, logoOverX, logoOverY, logoOverlaySize, logoOverlaySize)
  } catch {
    // QR still scannable without logo
  }

  // ── 8. Bottom section ───────────────────────────────────────────────────
  const bottomZoneTop    = qrCardY + qrCardH + framePad
  const bottomZoneHeight = canvasH - bottomZoneTop
  const ctaFontSize      = Math.round(canvasW * (isPortrait ? 0.046 : 0.050))

  // CTA text — bold uppercase
  const ctaText_upper = ctaText.toUpperCase()
  const ctaY = bottomZoneTop + bottomZoneHeight * 0.22

  ctx.font         = `800 ${ctaFontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle    = textPrimary
  ctx.fillText(ctaText_upper, canvasW / 2, ctaY)

  // Thin lime horizontal rule
  const ruleY = ctaY + ctaFontSize * 1.55
  const ruleW = canvasW * 0.52
  const ruleX = (canvasW - ruleW) / 2
  ctx.save()
  ctx.strokeStyle = outerFrame
  ctx.lineWidth   = canvasW * 0.0025
  ctx.globalAlpha = 0.85
  ctx.beginPath()
  ctx.moveTo(ruleX, ruleY)
  ctx.lineTo(ruleX + ruleW, ruleY)
  ctx.stroke()
  ctx.restore()

  // Tagline — italic, very small, bottom
  const tagFontSize = Math.round(canvasW * 0.018)
  ctx.font         = `italic 400 ${tagFontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle    = variant === 'light' ? 'rgba(0,53,47,0.35)' : 'rgba(206,220,0,0.38)'
  ctx.fillText('Únete a la lucha contra la soledad', canvasW / 2, canvasH - canvasH * 0.025)

  return canvas.toDataURL('image/png')
}

// ── Mini variant thumbnail for the toggle UI ─────────────────────────────
function VariantThumb({ v, selected, onClick }: {
  v: 'light' | 'dark'
  selected: boolean
  onClick: () => void
}) {
  const isLight = v === 'light'
  return (
    <button
      onClick={onClick}
      style={{
        outline: 'none',
        cursor: 'pointer',
        border: selected ? `2.5px solid ${BRAND.lime}` : '2.5px solid transparent',
        borderRadius: '10px',
        padding: '2px',
        background: 'transparent',
        transition: 'border-color 0.15s',
      }}
      aria-label={isLight ? 'Light variant' : 'Dark variant'}
    >
      {/* Mini poster thumbnail */}
      <div
        style={{
          width: 68,
          height: 84,
          borderRadius: 8,
          background: isLight ? '#FAFAF8' : BRAND.green,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative arc hint */}
        <svg style={{ position: 'absolute', inset: 0 }} width="68" height="84">
          <path
            d="M 60 0 Q 30 40 0 70"
            fill="none"
            stroke={isLight ? BRAND.green : BRAND.lime}
            strokeWidth="1"
            opacity="0.15"
          />
          <path
            d="M 68 10 Q 40 50 8 84"
            fill="none"
            stroke={isLight ? BRAND.green : BRAND.lime}
            strokeWidth="1"
            opacity="0.10"
          />
        </svg>

        {/* Logo placeholder circle */}
        <div style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: isLight ? BRAND.green : BRAND.lime,
          opacity: 0.5,
        }} />

        {/* QR card mock */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 5,
          background: '#FFFFFF',
          border: `1.5px solid ${BRAND.lime}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1.5,
          padding: 4,
        }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              style={{
                borderRadius: 1,
                background: [0,1,4,5,2,7,8,11,14,15].includes(i) ? BRAND.green : 'transparent',
              }}
            />
          ))}
        </div>

        {/* CTA bar */}
        <div style={{
          width: 44,
          height: 4,
          borderRadius: 2,
          background: isLight ? BRAND.green : BRAND.lime,
          opacity: 0.6,
        }} />

        {/* Variant label */}
        <span style={{
          fontSize: 8,
          fontWeight: 600,
          color: isLight ? BRAND.green : BRAND.lime,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          opacity: 0.85,
        }}>
          {isLight ? 'Light' : 'Dark'}
        </span>
      </div>
    </button>
  )
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
    setDownloading(preset.slug)
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

  const noAppUrl    = !APP_URL && urlOption !== 'custom'
  const canGenerate = !!targetUrl && !noAppUrl

  if (!permissions.canManageSettings) {
    return (
      <div className="max-w-lg">
        <div className="rounded-2xl border bg-white p-16 text-center shadow-sm">
          <QrCode className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-700">Access Restricted</p>
          <p className="text-sm text-gray-400 mt-1">Only admins and owners can generate QR codes.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: BRAND.green }}>QR Code Generator</h1>
        <p className="text-sm text-gray-400 mt-1.5">
          Export a complete branded poster — ready for print, social media, or TV display.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

        {/* ── LEFT: Preview Stage ─────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#F3F4F2', padding: '32px' }}
          >
            {noAppUrl && (
              <div className="mb-4 px-4 py-3 rounded-xl text-xs"
                style={{ background: '#FEF9EC', border: '1px solid #F0D66C', color: '#92660A' }}>
                <strong>NEXT_PUBLIC_APP_URL</strong> is not set — add it to your environment, or choose Custom URL.
              </div>
            )}

            {/* Canvas centered with shadow */}
            <div className="flex items-center justify-center">
              <div
                className="relative"
                style={{
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.12)',
                  aspectRatio: '1 / 1',
                  width: '100%',
                  maxWidth: 480,
                }}
              >
                <canvas
                  ref={previewCanvasRef}
                  style={{
                    display: 'block',
                    imageRendering: 'crisp-edges',
                    width: '100%',
                    height: '100%',
                  }}
                />

                {generating && (
                  <div className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.72)' }}>
                    <RefreshCw className="w-7 h-7 animate-spin" style={{ color: BRAND.green }} />
                  </div>
                )}

                {!targetUrl && !generating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                    style={{ background: '#FAFAF8' }}>
                    <QrCode className="w-12 h-12" style={{ color: BRAND.green, opacity: 0.18 }} />
                    <p className="text-xs font-medium text-gray-400">Enter a URL to preview</p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-center mt-4 text-[11px] font-medium tracking-wide"
              style={{ color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Preview — updates live
            </p>
          </div>
        </div>

        {/* ── RIGHT: Controls ─────────────────────────────────────────── */}
        <div className="space-y-0 rounded-2xl border bg-white overflow-hidden shadow-sm">

          {/* Section: Destination */}
          <div className="px-6 pt-6 pb-5">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-4"
              style={{ color: '#9CA3AF' }}>
              Destination
            </p>

            <div className="space-y-3">
              <Select value={urlOption} onValueChange={(v) => v && setUrlOption(v)}>
                <SelectTrigger className="text-sm h-10">
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
                  className="text-sm font-mono h-10"
                />
              )}

              {targetUrl && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: '#F5F5F4' }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: BRAND.lime }} />
                  <p className="text-[11px] font-mono truncate text-gray-500">{targetUrl}</p>
                </div>
              )}
            </div>
          </div>

          <div className="h-px mx-6" style={{ background: '#F0F0EF' }} />

          {/* Section: Call to Action */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-4"
              style={{ color: '#9CA3AF' }}>
              Call to Action
            </p>

            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Poster headline text</Label>
              <Input
                value={ctaText}
                onChange={e => setCtaText(e.target.value)}
                placeholder="Scan to Order Your Shirt"
                maxLength={48}
                className="text-sm h-10"
              />
              <p className="text-[11px] text-gray-400 text-right">{ctaText.length} / 48</p>
            </div>
          </div>

          <div className="h-px mx-6" style={{ background: '#F0F0EF' }} />

          {/* Section: Color Variant */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-4"
              style={{ color: '#9CA3AF' }}>
              Color Variant
            </p>

            <div className="flex gap-4 justify-center">
              <VariantThumb v="light" selected={variant === 'light'} onClick={() => setVariant('light')} />
              <VariantThumb v="dark"  selected={variant === 'dark'}  onClick={() => setVariant('dark')}  />
            </div>
          </div>

          <div className="h-px" style={{ background: '#F0F0EF' }} />

          {/* Section: Export */}
          <div className="px-6 pt-5 pb-6">
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-4"
              style={{ color: '#9CA3AF' }}>
              Export
            </p>

            <div className="rounded-xl overflow-hidden"
              style={{ border: '1px solid #EBEBEA' }}>
              {SIZE_PRESETS.map((preset, idx) => (
                <div key={preset.slug}>
                  {idx > 0 && <div className="h-px" style={{ background: '#EBEBEA' }} />}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors"
                    style={{
                      background: 'transparent',
                      cursor: canGenerate && !downloading ? 'pointer' : 'not-allowed',
                      opacity: canGenerate && !downloading ? 1 : 0.45,
                    }}
                    onClick={() => canGenerate && !downloading && handleDownload(preset)}
                    disabled={!canGenerate || !!downloading}
                    onMouseEnter={e => {
                      if (canGenerate && !downloading)
                        (e.currentTarget as HTMLButtonElement).style.background = '#FAFAF8'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{preset.label}</p>
                      <p className="text-[11px] font-mono text-gray-400 mt-0.5">{preset.res} px</p>
                    </div>

                    <div className="flex-shrink-0 ml-3">
                      {downloading === preset.slug
                        ? <RefreshCw className="w-4 h-4 animate-spin" style={{ color: BRAND.green }} />
                        : (
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                            style={{ background: '#F0F0EF' }}
                          >
                            <Download className="w-3.5 h-3.5 text-gray-500" />
                          </div>
                        )
                      }
                    </div>
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-gray-400 mt-3 text-center tracking-wide">
              Generated locally — no data sent to any server.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
