'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ImagePlus, Trash2, Plus, Upload, X, Eye, EyeOff, GripVertical, Shirt
} from 'lucide-react'
import Image from 'next/image'
import type { ShirtCatalogItem } from '@/types'

export default function CatalogPage() {
  const [items, setItems] = useState<ShirtCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // New item form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setUploading(true)
    try {
      let image_url: string | null = null

      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        const upRes = await fetch('/api/admin/catalog/upload', { method: 'POST', body: fd })
        const upJson = await upRes.json()
        if (!upRes.ok) { toast.error(upJson.error || 'Upload failed'); return }
        image_url = upJson.url
      }

      const res = await fetch('/api/admin/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, image_url, display_order: items.length }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to add item'); return }

      toast.success(`"${name}" added to catalog`)
      setItems(prev => [...prev, json.item])
      setName('')
      setDescription('')
      clearImage()
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

  const visibleCount = items.filter(i => i.is_active).length

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shirt Catalog</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage the shirts displayed on the public home page
          </p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} className="text-white" style={{ backgroundColor: '#00352F' }}>
            <Plus className="w-4 h-4 mr-2" /> Add Shirt
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Items</p>
        </div>
        <div className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-[#00352F]">{visibleCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Visible</p>
        </div>
        <div className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-gray-400">{items.length - visibleCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Hidden</p>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <Card className="border-[#CEDC00]/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-[#00352F]" /> Add New Shirt
            </CardTitle>
            <CardDescription>
              Upload an image and add a name. Image is optional — you can add one later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              {/* Image upload */}
              <div>
                <Label>Shirt Image <span className="text-gray-400">(optional)</span></Label>
                {imagePreview ? (
                  <div className="relative mt-2 w-full max-w-xs">
                    <div className="relative aspect-square rounded-xl overflow-hidden border bg-gray-50">
                      <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-2 w-full max-w-xs aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-[#CEDC00] hover:bg-[#E5F2F0] transition-all flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-[#00352F]"
                  >
                    <Upload className="w-8 h-8" />
                    <span className="text-sm font-medium">Click to upload</span>
                    <span className="text-xs">JPG, PNG, WebP · Max 5MB</span>
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-name">Shirt Name *</Label>
                  <Input
                    id="item-name"
                    placeholder="e.g. Classic Green Polo"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="mt-1"
                    disabled={uploading}
                  />
                </div>
                <div>
                  <Label htmlFor="item-desc">Description <span className="text-gray-400">(optional)</span></Label>
                  <Textarea
                    id="item-desc"
                    placeholder="Short description..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="mt-1 resize-none"
                    rows={2}
                    disabled={uploading}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={uploading || !name.trim()}
                  className="text-white"
                  style={{ backgroundColor: '#00352F' }}
                >
                  {uploading ? 'Adding...' : 'Add to Catalog'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setAdding(false); setName(''); setDescription(''); clearImage() }}
                  disabled={uploading}
                >
                  Cancel
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
            <p className="font-semibold text-gray-900">No shirts in catalog yet</p>
            <p className="text-gray-500 text-sm mt-1">Add your first shirt to display it on the home page.</p>
            <Button onClick={() => setAdding(true)} className="mt-4 text-white" style={{ backgroundColor: '#00352F' }}>
              <Plus className="w-4 h-4 mr-2" /> Add First Shirt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <Card key={item.id} className={`overflow-hidden transition-opacity ${!item.is_active ? 'opacity-50' : ''}`}>
              {/* Image */}
              <div className="relative aspect-square bg-gray-50">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                    <Shirt className="w-12 h-12" />
                    <span className="text-xs mt-2">No image</span>
                  </div>
                )}
                {!item.is_active && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <Badge variant="outline" className="bg-white text-gray-500 text-xs">Hidden</Badge>
                  </div>
                )}
              </div>

              {/* Info + actions */}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</p>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(item)}
                      disabled={togglingId === item.id}
                      title={item.is_active ? 'Hide from home page' : 'Show on home page'}
                      className={`p-1.5 rounded-lg transition-colors ${item.is_active ? 'text-[#00352F] hover:bg-[#E5F2F0]' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                      {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      title="Remove from catalog"
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
