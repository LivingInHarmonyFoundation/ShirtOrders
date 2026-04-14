'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users, Plus, Trash2, ToggleLeft, ToggleRight,
  Crown, Shield, UserCheck, Info, Copy, Check, Eye, EyeOff, X
} from 'lucide-react'
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS } from '@/lib/permissions'
import type { TeamMember, UserRole } from '@/types'

const ROLE_ICONS: Record<UserRole, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  staff: UserCheck,
}

function InitialsAvatar({ name, email, role }: { name: string | null; email: string; role: UserRole }) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : email[0].toUpperCase()

  const bg: Record<UserRole, string> = {
    owner: '#00352F',
    admin: '#00594F',
    staff: '#6b7280',
  }

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
      style={{ backgroundColor: bg[role] }}
    >
      {initials}
    </div>
  )
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('staff')
  const [invitePassword, setInvitePassword] = useState('')
  const [showInvitePassword, setShowInvitePassword] = useState(false)
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null)
  const [lastCreatedMinimized, setLastCreatedMinimized] = useState(false)
  const [copied, setCopied] = useState(false)

  const pwRules = [
    { label: 'At least 8 characters', pass: invitePassword.length >= 8 },
    { label: 'One uppercase letter (A–Z)', pass: /[A-Z]/.test(invitePassword) },
    { label: 'One number (0–9)', pass: /[0-9]/.test(invitePassword) },
  ]
  const pwScore = pwRules.filter(r => r.pass).length
  const pwValid = pwScore === 3
  const pwStrengthColor = pwScore === 0 ? '' : pwScore === 1 ? 'bg-red-400' : pwScore === 2 ? 'bg-yellow-400' : 'bg-[#CEDC00]'
  const pwStrengthLabel = ['', 'Weak', 'Almost', 'Strong'][pwScore]
  const pwStrengthTextColor = pwScore === 1 ? 'text-red-500' : pwScore === 2 ? 'text-yellow-600' : 'text-[#00352F]'

  const fetchTeam = async () => {
    try {
      const res = await fetch('/api/admin/team')
      const json = await res.json()
      if (json.members) setMembers(json.members)
    } catch {
      toast.error('Failed to load team')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTeam() }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, full_name: inviteName, password: invitePassword }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to add member')
        return
      }
      setLastCreated({ email: inviteEmail, password: invitePassword })
      setLastCreatedMinimized(false)
      setMembers(prev => [...prev, json.member])
      setInviteEmail('')
      setInviteName('')
      setInviteRole('staff')
      setInvitePassword('')
      setAdding(false)
      toast.success('Account created — share the login details below')
    } catch {
      toast.error('Failed to send invite')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRoleChange = async (member: TeamMember, newRole: UserRole) => {
    setChangingRoleId(member.id)
    try {
      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error || 'Failed to update role')
        return
      }
      toast.success(`${member.full_name || member.email} is now ${ROLE_LABELS[newRole]}`)
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m))
    } catch {
      toast.error('Failed to update role')
    } finally {
      setChangingRoleId(null)
    }
  }

  const handleToggleActive = async (member: TeamMember) => {
    setTogglingId(member.id)
    try {
      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !member.is_active }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error || 'Failed to update status')
        return
      }
      toast.success(`${member.full_name || member.email} ${member.is_active ? 'deactivated' : 'reactivated'}`)
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: !m.is_active } : m))
    } catch {
      toast.error('Failed to update status')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (member: TeamMember) => {
    const name = member.full_name || member.email
    if (!confirm(`Remove "${name}" from the team? This will also delete their login access. This cannot be undone.`)) return
    setDeletingId(member.id)
    try {
      const res = await fetch(`/api/admin/team/${member.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error || 'Failed to remove member')
        return
      }
      toast.success(`${name} has been removed`)
      setMembers(prev => prev.filter(m => m.id !== member.id))
    } catch {
      toast.error('Failed to remove member')
    } finally {
      setDeletingId(null)
    }
  }

  const ownerCount = members.filter(m => m.role === 'owner' && m.is_active).length

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Members</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Manage who has access to the admin panel and what they can do
          </p>
        </div>
        {!adding && (
          <Button
            onClick={() => { setAdding(true); setLastCreated(null) }}
            className="text-white"
            style={{ backgroundColor: '#00352F' }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Member
          </Button>
        )}
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['owner', 'admin', 'staff'] as UserRole[]).map(r => {
          const Icon = ROLE_ICONS[r]
          return (
            <Card key={r} className="border-dashed">
              <CardContent className="p-3 flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${r === 'owner' ? 'bg-[#00352F]' : r === 'admin' ? 'bg-[#E5F2F0]' : 'bg-gray-100'}`}>
                  <Icon className={`w-4 h-4 ${r === 'owner' ? 'text-white' : r === 'admin' ? 'text-[#00352F]' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900">{ROLE_LABELS[r]}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Last created — show login details to share */}
      {lastCreated && (
        <Card className="border-[#CEDC00] bg-[#E5F2F0]">
          <CardContent className="p-4">
            {/* Header row — always visible */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#00352F] flex-shrink-0" />
                <p className="font-semibold text-[#00352F] text-sm">Account created. Share these login details:</p>
              </div>
              <button
                onClick={() => setLastCreatedMinimized(v => !v)}
                className="ml-3 text-xs text-[#00352F]/60 hover:text-[#00352F] underline flex-shrink-0"
              >
                {lastCreatedMinimized ? 'Show' : 'Hide'}
              </button>
            </div>

            {/* Collapsible body */}
            {!lastCreatedMinimized && (
              <div className="mt-3 space-y-3">
                <div className="bg-white rounded-lg border border-[#CEDC00]/40 p-3 space-y-2 text-sm font-mono">
                  <div><span className="text-gray-400 font-sans text-xs">Login URL</span><br />{typeof window !== 'undefined' ? `${window.location.origin}/admin/login` : '/admin/login'}</div>
                  <div><span className="text-gray-400 font-sans text-xs">Email</span><br />{lastCreated.email}</div>
                  <div><span className="text-gray-400 font-sans text-xs">Password</span><br />{lastCreated.password}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#CEDC00] text-[#00352F] hover:bg-[#CEDC00]/10"
                  onClick={() => {
                    const text = `Login URL: ${window.location.origin}/admin/login\nEmail: ${lastCreated.email}\nPassword: ${lastCreated.password}`
                    navigator.clipboard.writeText(text)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? <><Check className="w-3.5 h-3.5 mr-1.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy to clipboard</>}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add member form */}
      {adding && (
        <Card className="border-[#CEDC00]/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Team Member</CardTitle>
            <CardDescription>Set a temporary password and share the login link with them directly. No email needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invite-email">Email Address *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    autoFocus
                    placeholder="employee@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                    className="mt-1"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <Label htmlFor="invite-name">Full Name <span className="text-gray-400">(optional)</span></Label>
                  <Input
                    id="invite-name"
                    placeholder="Jane Smith"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    className="mt-1"
                    disabled={submitting}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="invite-password">Temporary Password *</Label>
                <div className="relative mt-1">
                  <Input
                    id="invite-password"
                    type={showInvitePassword ? 'text' : 'password'}
                    placeholder="Min. 8 chars, 1 uppercase, 1 number"
                    value={invitePassword}
                    onChange={e => setInvitePassword(e.target.value)}
                    className="pr-10"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowInvitePassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showInvitePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {invitePassword.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= pwScore ? pwStrengthColor : 'bg-gray-200'}`} />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${pwStrengthTextColor}`}>{pwStrengthLabel}</p>

                    {/* Rule checklist */}
                    <div className="space-y-1">
                      {pwRules.map(rule => (
                        <div key={rule.label} className="flex items-center gap-2">
                          {rule.pass
                            ? <Check className="w-3.5 h-3.5 text-[#CEDC00] flex-shrink-0" />
                            : <X className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                          <span className={`text-xs ${rule.pass ? 'text-gray-500 line-through' : 'text-gray-500'}`}>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="invite-role">Role *</Label>
                <Select value={inviteRole} onValueChange={v => v && setInviteRole(v as UserRole)}>
                  <SelectTrigger id="invite-role" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">
                      <div className="flex items-center gap-2">
                        <Crown className="w-3.5 h-3.5 text-[#00352F]" />
                        <span>Owner — Full access including team management</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-[#00594F]" />
                        <span>Admin — Orders, schools, settings, reports</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-gray-500" />
                        <span>Staff — View and update orders only</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting || !inviteEmail.trim() || !pwValid}
                  className="text-white"
                  style={{ backgroundColor: '#00352F' }}
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setAdding(false); setInviteEmail(''); setInviteName(''); setInvitePassword(''); setShowInvitePassword(false); setLastCreated(null) }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-900">No team members yet</p>
            <p className="text-gray-500 text-sm mt-1">Invite someone to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map(member => {
            const RoleIcon = ROLE_ICONS[member.role]
            const isOnlyOwner = member.role === 'owner' && ownerCount <= 1

            return (
              <Card
                key={member.id}
                className={`transition-opacity ${!member.is_active ? 'opacity-60' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <InitialsAvatar
                      name={member.full_name}
                      email={member.email}
                      role={member.role}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm">
                          {member.full_name || member.email}
                        </span>

                        {/* Role badge */}
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium flex items-center gap-1 ${ROLE_COLORS[member.role]}`}
                        >
                          <RoleIcon className="w-3 h-3" />
                          {ROLE_LABELS[member.role]}
                        </Badge>

                        {/* Status badges */}
                        {!member.is_active && (
                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-500 border-gray-200">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {member.full_name && (
                        <p className="text-xs text-gray-400 mt-0.5">{member.email}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Joined {new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Role selector */}
                      <Select
                        value={member.role}
                        onValueChange={v => v && handleRoleChange(member, v as UserRole)}
                        disabled={changingRoleId === member.id}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Toggle active */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(member)}
                        disabled={togglingId === member.id || isOnlyOwner}
                        title={
                          isOnlyOwner
                            ? 'Cannot deactivate the only owner'
                            : member.is_active ? 'Deactivate' : 'Reactivate'
                        }
                        className={member.is_active
                          ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50'
                          : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                        }
                      >
                        {togglingId === member.id ? (
                          <span className="text-xs px-1">...</span>
                        ) : member.is_active ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </Button>

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(member)}
                        disabled={deletingId === member.id || isOnlyOwner}
                        title={isOnlyOwner ? 'Cannot remove the only owner' : 'Remove from team'}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {deletingId === member.id ? (
                          <span className="text-xs px-1">...</span>
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Info note */}
      {members.length > 0 && (
        <Card className="bg-[#E5F2F0] border-[#CEDC00]/30">
          <CardContent className="p-4 flex gap-3">
            <Info className="w-4 h-4 text-[#00352F] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[#00352F]">
              <p>Accounts are created immediately — no email invite needed. After creating an account, the login details appear so you can copy and send them directly (text, WhatsApp, etc.).</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
