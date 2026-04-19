'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import QRCode from 'qrcode'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QrCode, Download, RefreshCw, Link2, Type, ArrowDownToLine } from 'lucide-react'
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
  { label: 'Instagram Square', resolution: '1080 × 1080 px', platform: 'Social Media', w: 1080, h: 1080 },
  { label: 'Instagram Story',  resolution: '1080 × 1920 px', platform: 'Social Media', w: 1080, h: 1920 },
  { label: 'Print / Large',    resolution: '2400 × 2400 px', platform: 'Print',        w: 2400, h: 2400 },
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
  const qr     = QRCode.create(url, { errorCorrectionLevel: 'H' })
  const matrix = qr.modules.data
  const size   = qr.modules.size

  const ctx = canvas.getContext('2d')!
  canvas.width  = canvasW
  canvas.height = canvasH
  ensureRoundRect(ctx)

  const isPortrait = canvasH > canvasW * 1.4

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

  ctx.fillStyle = variant === 'light' ? BRAND.white : BRAND.green
  ctx.fillRect(0, 0, canvasW, canvasH)

  if (isPortrait) {
    ctx.globalAlpha = 0.05
    ctx.fillStyle   = BRAND.lime
    ctx.beginPath()
    ctx.arc(canvasW / 2, canvasH * 0.22, canvasW * 0.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.fillStyle = BRAND.lime
  ctx.fillRect(0, 0, canvasW, accentH)

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

  ctx.fillStyle = BRAND.white
  ctx.beginPath()
  ctx.roundRect(qrX - 2, qrY - 2, qrAreaSize + 4, qrAreaSize + 4, cellSize * 0.5)
  ctx.fill()

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
    // no-op
  }

  const ctaTopY = isPortrait
    ? qrY + qrAreaSize + canvasH * 0.055
    : qrY + qrAreaSize + (canvasH - qrY - qrAreaSize) * 0.22

  const ctaFontSize = Math.round(canvasW * (isPortrait ? 0.048 : 0.052))
  ctx.font         = `800 ${ctaFontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle    = variant === 'light' ? BRAND.green : BRAND.white
  ctx.fillText(ctaText, canvasW / 2, ctaTopY)

  const dotR  = canvasW * 0.007
  const textW = ctx.measureText(ctaText).width
  const dotY  = ctaTopY + ctaFontSize / 2
  ctx.fillStyle = BRAND.lime
  ctx.beginPath(); ctx.arc(canvasW / 2 - textW / 2 - dotR * 2.5, dotY, dotR, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(canvasW / 2 + textW / 2 + dotR * 2.5, dotY, dotR, 0, Math.PI * 2); ctx.fill()

  const urlFontSize = Math.round(canvasW * 0.022)
  ctx.font      = `400 ${urlFontSize}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.fillStyle = variant === 'light' ? 'rgba(0,53,47,0.38)' : 'rgba(229,242,240,0.40)'
  const displayUrl = url.replace(/^https?:\/\//, '')
  ctx.fillText(displayUrl, canvasW / 2, ctaTopY + ctaFontSize * 1.5)

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
        <div
          className="rounded-2xl overflow-hidden border border-gray-100"
          style={{ backgroundColor: '#FAFAF9' }}
        >
          <div
            className="h-1 w-full"
            style={{ backgroundColor: BRAND.lime }}
          />
          <div className="py-16 text-center px-8">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ backgroundColor: BRAND.lightTeal }}
            >
              <QrCode className="w-6 h-6" style={{ color: BRAND.green }} />
            </div>
            <p className="font-semibold text-gray-800 tracking-tight">Access Restricted</p>
            <p className="text-sm text-gray-400 mt-1.5">Only admins and owners can generate QR codes.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <span
            className="text-[10px] font-mono font-semibold tracking-widest uppercase px-2 py-0.5 rounded"
            style={{ backgroundColor: BRAND.lightTeal, color: BRAND.green }}
          >
            Export Studio
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">QR Code Generator</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Branded assets for social media, TV displays, and printed flyers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-0 rounded-2xl overflow-hidden shadow-xl border border-gray-100">

        {/* LEFT — Immersive Preview Stage */}
        <div
          className="relative flex flex-col items-center justify-center p-10 min-h-[480px]"
          style={{
            background: `radial-gradient(ellipse at 50% 30%, #004d43 0%, ${BRAND.green} 65%)`,
          }}
        >
          {/* Dot pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, #CEDC00 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Lime top accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-0.5"
            style={{ backgroundColor: BRAND.lime }}
          />

          {/* Stage label */}
          <div className="absolute top-5 left-6 flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: BRAND.lime }}
            />
            <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: 'rgba(206,220,0,0.7)' }}>
              Live Preview
            </span>
          </div>

          {/* Canvas stage */}
          <div className="relative z-10 flex items-center justify-center" style={{ width: '100%', maxWidth: 420 }}>
            <div
              className="relative rounded-2xl overflow-hidden w-full"
              style={{ aspectRatio: '1 / 1' }}
            >
              <canvas
                ref={previewCanvasRef}
                style={{ display: 'block', imageRendering: 'crisp-edges', maxWidth: '100%' }}
              />

              {generating && (
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-2xl"
                  style={{ backgroundColor: 'rgba(0,53,47,0.75)' }}
                >
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin" style={{ color: BRAND.lime }} />
                    <span className="text-[11px] font-mono tracking-wider" style={{ color: 'rgba(229,242,240,0.7)' }}>
                      RENDERING
                    </span>
                  </div>
                </div>
              )}

              {!targetUrl && !generating && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl"
                  style={{ backgroundColor: 'rgba(0,53,47,0.9)' }}
                >
                  <QrCode className="w-10 h-10 opacity-20" style={{ color: BRAND.lime }} />
                  <p className="text-xs font-mono tracking-wider" style={{ color: 'rgba(229,242,240,0.4)' }}>
                    ENTER A URL TO PREVIEW
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Stage footer */}
          <div className="absolute bottom-5 left-0 right-0 flex justify-center">
            <span className="text-[10px] font-mono" style={{ color: 'rgba(229,242,240,0.3)' }}>
              Screen resolution preview — exports are full-resolution
            </span>
          </div>
        </div>

        {/* RIGHT — Controls Panel */}
        <div
          className="flex flex-col border-l border-gray-100"
          style={{ backgroundColor: '#FAFAF9' }}
        >
          {noAppUrl && (
            <div className="px-6 pt-6">
              <div className="rounded-xl px-4 py-3 border border-yellow-200 bg-yellow-50 text-yellow-800 text-xs">
                <span className="font-semibold font-mono">NEXT_PUBLIC_APP_URL</span> is not set.
                Use a Custom URL below, or add it to your environment variables.
              </div>
            </div>
          )}

          {/* Section: Destination */}
          <div className="px-6 pt-7 pb-6">
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">
                Destination
              </span>
            </div>

            <div className="space-y-3">
              <Select value={urlOption} onValueChange={(v) => v && setUrlOption(v)}>
                <SelectTrigger className="w-full text-sm h-9 bg-white">
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
                  className="text-sm font-mono h-9 bg-white"
                />
              )}

              {targetUrl && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-white">
                  <div
                    className="w-1 h-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: BRAND.lime }}
                  />
                  <p className="text-[11px] font-mono text-gray-400 truncate">{targetUrl}</p>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-6 h-px bg-gray-100" />

          {/* Section: Text */}
          <div className="px-6 py-6">
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">
                Call to Action
              </span>
            </div>

            <div className="space-y-1.5">
              <Input
                value={ctaText}
                onChange={e => setCtaText(e.target.value)}
                placeholder="Scan to Order Your Shirt"
                maxLength={48}
                className="text-sm h-9 bg-white"
              />
              <div className="flex justify-end">
                <span className="text-[10px] font-mono text-gray-300">
                  {ctaText.length}/48
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-6 h-px bg-gray-100" />

          {/* Section: Color Variant */}
          <div className="px-6 py-6">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 block mb-4">
              Color Variant
            </span>

            <div className="grid grid-cols-2 gap-3">
              {/* Light swatch */}
              <button
                onClick={() => setVariant('light')}
                className="group relative rounded-xl overflow-hidden border-2 transition-all duration-150"
                style={{
                  borderColor: variant === 'light' ? BRAND.green : 'transparent',
                  outline: variant === 'light' ? 'none' : undefined,
                }}
              >
                <div
                  className="aspect-square flex flex-col items-center justify-center gap-1.5"
                  style={{ backgroundColor: BRAND.white }}
                >
                  <div
                    className="w-8 h-8 rounded-lg"
                    style={{ backgroundColor: BRAND.green }}
                  />
                  <div
                    className="w-5 h-1 rounded-full"
                    style={{ backgroundColor: BRAND.lime }}
                  />
                </div>
                <div
                  className="px-2 py-1.5 text-center border-t"
                  style={{
                    backgroundColor: variant === 'light' ? BRAND.lightTeal : '#F5F5F4',
                    borderColor: variant === 'light' ? BRAND.green : '#E5E7EB',
                  }}
                >
                  <span
                    className="text-[11px] font-semibold tracking-wide"
                    style={{ color: variant === 'light' ? BRAND.green : '#9CA3AF' }}
                  >
                    Light
                  </span>
                </div>
                {variant === 'light' && (
                  <div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full"
                    style={{ backgroundColor: BRAND.lime }}
                  />
                )}
              </button>

              {/* Dark swatch */}
              <button
                onClick={() => setVariant('dark')}
                className="group relative rounded-xl overflow-hidden border-2 transition-all duration-150"
                style={{
                  borderColor: variant === 'dark' ? BRAND.green : 'transparent',
                }}
              >
                <div
                  className="aspect-square flex flex-col items-center justify-center gap-1.5"
                  style={{ backgroundColor: BRAND.green }}
                >
                  <div
                    className="w-8 h-8 rounded-lg"
                    style={{ backgroundColor: BRAND.white }}
                  />
                  <div
                    className="w-5 h-1 rounded-full"
                    style={{ backgroundColor: BRAND.lime }}
                  />
                </div>
                <div
                  className="px-2 py-1.5 text-center border-t"
                  style={{
                    backgroundColor: variant === 'dark' ? BRAND.green : '#F5F5F4',
                    borderColor: variant === 'dark' ? BRAND.green : '#E5E7EB',
                  }}
                >
                  <span
                    className="text-[11px] font-semibold tracking-wide"
                    style={{ color: variant === 'dark' ? BRAND.lime : '#9CA3AF' }}
                  >
                    Dark
                  </span>
                </div>
                {variant === 'dark' && (
                  <div
                    className="absolute top-2 right-2 w-2 h-2 rounded-full"
                    style={{ backgroundColor: BRAND.lime }}
                  />
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-6 h-px bg-gray-100" />

          {/* Section: Export */}
          <div className="px-6 py-6 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">
                Export
              </span>
            </div>
            <p className="text-[11px] text-gray-300 mb-4 font-mono">PNG · generated locally</p>

            <div className="space-y-1.5">
              {SIZE_PRESETS.map(preset => {
                const isThisDownloading = downloading === preset.label
                const disabled = !canGenerate || !!downloading

                return (
                  <button
                    key={preset.label}
                    onClick={() => handleDownload(preset)}
                    disabled={disabled}
                    className="group w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: isThisDownloading ? BRAND.lightTeal : 'white',
                      border: `1px solid ${isThisDownloading ? BRAND.green : '#E5E7EB'}`,
                    }}
                    onMouseEnter={e => {
                      if (!disabled) {
                        const el = e.currentTarget
                        el.style.backgroundColor = BRAND.lightTeal
                        el.style.borderColor = BRAND.green
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isThisDownloading) {
                        const el = e.currentTarget
                        el.style.backgroundColor = 'white'
                        el.style.borderColor = '#E5E7EB'
                      }
                    }}
                  >
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-gray-700 leading-none mb-1">
                        {preset.label}
                      </p>
                      <p className="text-[11px] font-mono text-gray-400 leading-none">
                        {preset.resolution}
                        <span
                          className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
                          style={{ backgroundColor: BRAND.lightTeal, color: BRAND.green }}
                        >
                          {preset.platform}
                        </span>
                      </p>
                    </div>
                    <div className="flex-shrink-0 ml-3">
                      {isThisDownloading
                        ? <RefreshCw className="w-4 h-4 animate-spin" style={{ color: BRAND.green }} />
                        : <ArrowDownToLine
                            className="w-4 h-4 text-gray-300 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:text-gray-500"
                          />
                      }
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
