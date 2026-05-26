/**
 * @file page.tsx
 * @description Admin shirt catalog management. Allows adding, toggling visibility,
 * and deleting shirt catalog items, each of which can have a front and back image.
 * Images are uploaded to /api/admin/catalog/upload (5 MB limit per file).
 * Back images can be added inline after creation by hovering a card.
 * The display_order field is set to items.length on creation (append-to-end).
 *
 * Auth: provided by the parent (protected) layout. Requires canManageSettings permission.
 */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/contexts/LanguageContext'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ImagePlus, Trash2, Plus, Upload, X, Eye, EyeOff, Shirt, RotateCcw, Pencil } from 'lucide-react'
import Image from 'next/image'
import type { ShirtCatalogItem } from '@/types'

/**
 * uploadImage — uploads a single image file via multipart/form-data and returns
 * the resulting public URL. Throws on failure so callers can surface the error.
 */
async function uploadImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/admin/catalog/upload', { method: 'POST', body: fd })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Upload failed')
  return json.url as string
}

/**
 * CatalogPage — manages the shirt catalog displayed on the public home page.
 * Each item has optional front and back images; both can be uploaded during creation
 * or the back image can be added later via the hover overlay on an existing card.
 */
export default function CatalogPage() {
  const t = useT()
  const [items, setItems] = useState<ShirtCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [viewBack, setViewBack] = useState<Record<string, boolean>>({})
  const [uploadingBackId, setUploadingBackId] = useState<string | null>(null)

  // New item form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newSizes, setNewSizes] = useState<string[]>([])
  const [newCustomSizeInput, setNewCustomSizeInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [backImageFile, setBackImageFile] = useState<File | null>(null)
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const backFileRef = useRef<HTMLInputElement>(null)
  const backUploadRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Inline edit per item
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', price: '', available_sizes: [] as string[] })
  const [editCustomSizeInput, setEditCustomSizeInput] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const PRESET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

  const openEdit = (item: ShirtCatalogItem) => {
    setEditingItemId(item.id)
    setEditCustomSizeInput('')
    setEditForm({
      name: item.name,
      description: item.description ?? '',
      price: item.price != null ? String(item.price) : '',
      available_sizes: item.available_sizes ?? [],
    })
  }

  const handleSaveEdit = async () => {
    if (!editingItemId || !editForm.name.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/admin/catalog/${editingItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          price: editForm.price !== '' ? Number(editForm.price) : null,
          available_sizes: editForm.available_sizes.length > 0 ? editForm.available_sizes : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to save'); return }
      setItems(prev => prev.map(i => i.id === editingItemId ? json.item : i))
      toast.success('Item updated')
      setEditingItemId(null)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSavingEdit(false)
    }
  }

  const toggleSize = (size: string, sizes: string[], setter: (s: string[]) => void) => {
    setter(sizes.includes(size) ? sizes.filter(s => s !== size) : [...sizes, size])
  }

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/admin/catalog')
      const json = await res.json()
      setItems(json.items || [])
    } catch {
      toast.error('Failed to load catalog')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleBackFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setBackImageFile(file)
    setBackImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setImageFile(null); setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const clearBackImage = () => {
    setBackImageFile(null); setBackImagePreview(null)
    if (backFileRef.current) backFileRef.current.value = ''
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setUploading(true)
    try {
      let image_url: string | null = null
      let back_image_url: string | null = null

      if (imageFile) {
        try { image_url = await uploadImage(imageFile) }
        catch (err) { toast.error(err instanceof Error ? err.message : 'Front image upload failed'); return }
      }
      if (backImageFile) {
        try { back_image_url = await uploadImage(backImageFile) }
        catch (err) { toast.error(err instanceof Error ? err.message : 'Back image upload failed'); return }
      }

      const res = await fetch('/api/admin/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          image_url,
          back_image_url,
          display_order: items.length,
          price: newPrice !== '' ? Number(newPrice) : null,
          available_sizes: newSizes.length > 0 ? newSizes : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to add item'); return }

      toast.success(`"${name}" added to catalog`)
      setItems(prev => [...prev, json.item])
      setName(''); setDescription(''); setNewPrice(''); setNewSizes([]); setNewCustomSizeInput(''); clearImage(); clearBackImage()
      setAdding(false)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setUploading(false)
    }
  }

  const handleToggle = async (item: ShirtCatalogItem) => {
    setTogglingId(item.id)
    try {
      const res = await fetch(`/api/admin/catalog/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !item.is_active }),
      })
      if (!res.ok) { const j = await res.json(); toast.error(j.error || 'Failed to update'); return }
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
      toast.success(item.is_active ? 'Hidden from home page' : 'Shown on home page')
    } catch {
      toast.error('Failed to update')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (item: ShirtCatalogItem) => {
    if (!confirm(`Remove "${item.name}" from the catalog? This cannot be undone.`)) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/admin/catalog/${item.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to delete'); return }
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success(`"${item.name}" removed`)
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAddBackImage = async (item: ShirtCatalogItem, file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setUploadingBackId(item.id)
    try {
      const url = await uploadImage(file)
      const res = await fetch(`/api/admin/catalog/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ back_image_url: url }),
      })
      if (!res.ok) throw new Error()
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, back_image_url: url } : i))
      toast.success('Back image added')
    } catch {
      toast.error('Failed to upload back image')
    } finally {
      setUploadingBackId(null)
    }
  }

  const ImageUploadBox = ({
    preview, onFileChange, onClear, inputRef, label, disabled,
  }: {
    preview: string | null
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onClear: () => void
    inputRef: React.RefObject<HTMLInputElement | null>
    label: string
    disabled?: boolean
  }) => (
    <div>
      <Label>{label} <span className="text-gray-400 font-normal">(optional)</span></Label>
      {preview ? (
        <div className="relative mt-2 w-full max-w-[160px]">
          <div className="relative aspect-square rounded-xl overflow-hidden border bg-gray-50">
            <Image src={preview} alt="Preview" fill className="object-cover" />
          </div>
          <button
            type="button"
            onClick={onClear}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="mt-2 w-full max-w-[160px] aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-[#CEDC00] hover:bg-[#E5F2F0] transition-all flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-[#00352F] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-6 h-6" />
          <span className="text-xs font-medium">Upload</span>
          <span className="text-[10px] text-gray-300">JPG, PNG, WebP</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onFileChange} className="hidden" />
    </div>
  )

  const visibleCount = items.filter(i => i.is_active).length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin', 'catalogTitle')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('admin', 'catalogSubtitle')}</p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} className="text-white" style={{ backgroundColor: '#00352F' }}>
            <Plus className="w-4 h-4 mr-2" /> {t('admin', 'addShirt')}
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        {[{ label: t('admin', 'totalItems'), value: items.length, color: 'text-gray-900' }, { label: t('admin', 'visibleItems'), value: visibleCount, color: 'text-[#00352F]' }, { label: t('admin', 'hiddenItems'), value: items.length - visibleCount, color: 'text-gray-400' }].map(s => (
          <div key={s.label} className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <Card className="border-[#CEDC00]/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-[#00352F]" /> {t('admin', 'addNewShirt')}
            </CardTitle>
            <CardDescription>{t('admin', 'addNewShirtDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <ImageUploadBox
                  preview={imagePreview}
                  onFileChange={handleFileChange}
                  onClear={clearImage}
                  inputRef={fileRef}
                  label={t('admin', 'frontImage')}
                  disabled={uploading}
                />
                <ImageUploadBox
                  preview={backImagePreview}
                  onFileChange={handleBackFileChange}
                  onClear={clearBackImage}
                  inputRef={backFileRef}
                  label={t('admin', 'backImage')}
                  disabled={uploading}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-name">{t('admin', 'shirtNameLabel')}</Label>
                  <Input id="item-name" placeholder={t('admin', 'shirtNamePlaceholder')} value={name} onChange={e => setName(e.target.value)} required className="mt-1" disabled={uploading} />
                </div>
                <div>
                  <Label htmlFor="item-desc">{t('admin', 'descriptionLabel')} <span className="text-gray-400 font-normal">({t('common', 'optional')})</span></Label>
                  <Textarea id="item-desc" placeholder={t('admin', 'descriptionPlaceholder')} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 resize-none" rows={2} disabled={uploading} />
                </div>
              </div>

              {/* Price */}
              <div className="max-w-[180px]">
                <Label htmlFor="item-price">Price <span className="text-gray-400 font-normal">(optional)</span></Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <Input
                    id="item-price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="15.00"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    className="pl-7"
                    disabled={uploading}
                  />
                </div>
              </div>

              {/* Available sizes */}
              <div>
                <Label>Available Sizes <span className="text-gray-400 font-normal">(optional)</span></Label>
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {PRESET_SIZES.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggleSize(size, newSizes, setNewSizes)}
                      disabled={uploading}
                      className={`px-3 py-1 rounded-lg text-sm font-medium border-2 transition-colors ${
                        newSizes.includes(size)
                          ? 'border-[#00352F] bg-[#E5F2F0] text-[#00352F]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                  {newSizes.filter(s => !PRESET_SIZES.includes(s)).map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggleSize(size, newSizes, setNewSizes)}
                      disabled={uploading}
                      className="px-3 py-1 rounded-lg text-sm font-medium border-2 border-[#CEDC00] bg-[#CEDC00]/10 text-[#00352F] flex items-center gap-1"
                    >
                      {size} <span className="text-[10px] opacity-50">×</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 max-w-xs">
                  <Input
                    placeholder='e.g. Youth M, 2XL'
                    value={newCustomSizeInput}
                    onChange={e => setNewCustomSizeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const val = newCustomSizeInput.trim().toUpperCase()
                        if (val && !newSizes.includes(val)) setNewSizes(prev => [...prev, val])
                        setNewCustomSizeInput('')
                      }
                    }}
                    className="h-8 text-sm"
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!newCustomSizeInput.trim() || uploading}
                    onClick={() => {
                      const val = newCustomSizeInput.trim().toUpperCase()
                      if (val && !newSizes.includes(val)) setNewSizes(prev => [...prev, val])
                      setNewCustomSizeInput('')
                    }}
                    className="h-8 px-3 text-xs"
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={uploading || !name.trim()} className="text-white" style={{ backgroundColor: '#00352F' }}>
                  {uploading ? t('admin', 'addingShirt') : t('admin', 'addToCatalog')}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setAdding(false); setName(''); setDescription(''); setNewPrice(''); setNewSizes([]); setNewCustomSizeInput(''); clearImage(); clearBackImage() }} disabled={uploading}>
                  {t('admin', 'cancelAction')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Catalog list */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <Skeleton className="aspect-square rounded-t-lg rounded-b-none" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-20 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Shirt className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-900">{t('admin', 'noShirtsYet')}</p>
            <p className="text-gray-500 text-sm mt-1">{t('admin', 'noShirtsDesc')}</p>
            <Button onClick={() => setAdding(true)} className="mt-4 text-white" style={{ backgroundColor: '#00352F' }}>
              <Plus className="w-4 h-4 mr-2" /> {t('admin', 'addFirstShirt')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => {
            const showingBack = viewBack[item.id] ?? false
            const displayUrl = showingBack ? item.back_image_url : item.image_url
            const hasBothSides = !!(item.image_url && item.back_image_url)

            return (
              <Card key={item.id} className={`overflow-hidden transition-opacity ${!item.is_active ? 'opacity-50' : ''}`}>
                {/* Image */}
                <div className="relative aspect-square bg-gray-50 group">
                  {displayUrl ? (
                    <Image src={displayUrl} alt={item.name} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                      <Shirt className="w-12 h-12" />
                      <span className="text-xs mt-2">{t('admin', 'noImage')}</span>
                    </div>
                  )}
                  {!item.is_active && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <Badge variant="outline" className="bg-white text-gray-500 text-xs">{t('admin', 'hiddenBadge')}</Badge>
                    </div>
                  )}

                  {/* Front/Back toggle */}
                  {hasBothSides && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex rounded-lg overflow-hidden border border-white/80 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setViewBack(prev => ({ ...prev, [item.id]: false }))}
                        className={`px-3 py-1 text-xs font-medium transition-colors ${!showingBack ? 'bg-[#00352F] text-white' : 'bg-white/90 text-gray-600 hover:bg-white'}`}
                      >
                        {t('admin', 'frontSide')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewBack(prev => ({ ...prev, [item.id]: true }))}
                        className={`px-3 py-1 text-xs font-medium transition-colors ${showingBack ? 'bg-[#00352F] text-white' : 'bg-white/90 text-gray-600 hover:bg-white'}`}
                      >
                        {t('admin', 'backSide')}
                      </button>
                    </div>
                  )}

                  {/* Add back image on hover (when no back image yet) */}
                  {!item.back_image_url && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        disabled={uploadingBackId === item.id}
                        onClick={() => backUploadRefs.current[item.id]?.click()}
                        className="flex items-center gap-1.5 bg-white/95 text-[#00352F] text-xs font-medium px-3 py-1.5 rounded-lg shadow hover:bg-white transition-colors disabled:opacity-60"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {uploadingBackId === item.id ? t('admin', 'uploadingText') : t('admin', 'addBackImage')}
                      </button>
                      <input
                        ref={el => { backUploadRefs.current[item.id] = el }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleAddBackImage(item, f) }}
                      />
                    </div>
                  )}
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</p>
                      {item.back_image_url && (
                        <p className="text-[10px] text-[#00352F]/60 mt-0.5 flex items-center gap-1">
                          <RotateCcw className="w-2.5 h-2.5" /> {t('admin', 'bothSides')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => editingItemId === item.id ? setEditingItemId(null) : openEdit(item)}
                        title="Edit item"
                        className={`p-1.5 rounded-lg transition-colors ${editingItemId === item.id ? 'bg-[#E5F2F0] text-[#00352F]' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggle(item)}
                        disabled={togglingId === item.id}
                        title={item.is_active ? t('admin', 'hideFromHome') : t('admin', 'showOnHome')}
                        className={`p-1.5 rounded-lg transition-colors ${item.is_active ? 'text-[#00352F] hover:bg-[#E5F2F0]' : 'text-gray-400 hover:bg-gray-100'}`}
                      >
                        {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        title={t('admin', 'removeFromCatalog')}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Price + sizes summary */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.price != null && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: '#E5F2F0', color: '#00352F' }}>
                        ${item.price.toFixed(2)}
                      </span>
                    )}
                    {item.available_sizes && item.available_sizes.length > 0 && item.available_sizes.map(s => (
                      <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {s}
                      </span>
                    ))}
                  </div>

                  {item.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{item.description}</p>
                  )}

                  {/* Inline edit panel */}
                  {editingItemId === item.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="mt-1 h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">Description <span className="text-gray-400 font-normal">(optional)</span></Label>
                        <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="mt-1 text-sm resize-none" rows={2} />
                      </div>
                      <div>
                        <Label className="text-xs">Price <span className="text-gray-400 font-normal">(optional)</span></Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <Input
                            type="number" min="0" step="0.01" placeholder="15.00"
                            value={editForm.price}
                            onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                            className="pl-6 h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Sizes <span className="text-gray-400 font-normal">(optional)</span></Label>
                        <div className="flex flex-wrap gap-1.5 mt-1.5 mb-1.5">
                          {PRESET_SIZES.map(size => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => toggleSize(size, editForm.available_sizes, s => setEditForm(f => ({ ...f, available_sizes: s })))}
                              className={`px-2.5 py-0.5 rounded text-xs font-medium border-2 transition-colors ${
                                editForm.available_sizes.includes(size)
                                  ? 'border-[#00352F] bg-[#E5F2F0] text-[#00352F]'
                                  : 'border-gray-200 text-gray-500'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                          {editForm.available_sizes.filter(s => !PRESET_SIZES.includes(s)).map(size => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => toggleSize(size, editForm.available_sizes, s => setEditForm(f => ({ ...f, available_sizes: s })))}
                              className="px-2.5 py-0.5 rounded text-xs font-medium border-2 border-[#CEDC00] bg-[#CEDC00]/10 text-[#00352F] flex items-center gap-1"
                            >
                              {size} <span className="text-[9px] opacity-50">×</span>
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 max-w-[220px]">
                          <Input
                            placeholder='e.g. Youth M, 2XL'
                            value={editCustomSizeInput}
                            onChange={e => setEditCustomSizeInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const val = editCustomSizeInput.trim().toUpperCase()
                                if (val && !editForm.available_sizes.includes(val))
                                  setEditForm(f => ({ ...f, available_sizes: [...f.available_sizes, val] }))
                                setEditCustomSizeInput('')
                              }
                            }}
                            className="h-7 text-xs"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!editCustomSizeInput.trim()}
                            onClick={() => {
                              const val = editCustomSizeInput.trim().toUpperCase()
                              if (val && !editForm.available_sizes.includes(val))
                                setEditForm(f => ({ ...f, available_sizes: [...f.available_sizes, val] }))
                              setEditCustomSizeInput('')
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit || !editForm.name.trim()} className="text-white text-xs h-7" style={{ backgroundColor: '#00352F' }}>
                          {savingEdit ? 'Saving…' : 'Save'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingItemId(null); setEditCustomSizeInput('') }} className="text-xs h-7">Cancel</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
