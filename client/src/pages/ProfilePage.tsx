import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useStore } from '@/lib/store'

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, login, logout } = useStore()
  const { toast } = useToast()

  React.useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  const [name, setName] = React.useState(user?.name ?? '')
  const [email, setEmail] = React.useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [profileError, setProfileError] = React.useState('')
  const [passwordError, setPasswordError] = React.useState('')
  const [savingProfile, setSavingProfile] = React.useState(false)
  const [savingPassword, setSavingPassword] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)

  if (!user) return null

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) {
      setProfileError('Name must be at least 2 characters.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileError('Enter a valid email address.')
      return
    }
    setProfileError('')
    setSavingProfile(true)
    setTimeout(() => {
      login(email, name.trim())
      setSavingProfile(false)
      toast('Profile updated.', 'success')
    }, 600)
  }

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentPassword.length < 8) {
      setPasswordError('Enter your current password (8+ characters).')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    setPasswordError('')
    setSavingPassword(true)
    setTimeout(() => {
      setSavingPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      toast('Password updated.', 'success')
    }, 600)
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <div className="mb-8">
        <p className="eyebrow text-stamp-red">Account</p>
        <h1 className="mt-3 font-voice text-[36px] font-medium tracking-[-0.02em]">
          Your profile
        </h1>
        <p className="mt-1 text-text-secondary">
          Manage your name, email, and password.
        </p>
      </div>

      {/* Profile section */}
      <section className="rounded-[var(--radius-card)] border-[0.5px] border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-[16px] font-medium">
          <User className="size-4 text-text-muted" />
          Personal details
        </h2>
        <form onSubmit={saveProfile} className="mt-5 flex flex-col gap-4">
          <Input
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Rivera"
          />
          <div>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@email.com"
            />
            {user.email === 'admin@encore.live' && (
              <p className="mt-1.5 text-[12px] text-text-muted">
                Changing this email will remove admin access.
              </p>
            )}
          </div>
          {profileError && (
            <p role="alert" className="text-[13px] text-destructive">
              {profileError}
            </p>
          )}
          <Button type="submit" size="md" isLoading={savingProfile} className="self-start">
            Save details
          </Button>
        </form>
      </section>

      {/* Password section */}
      <section className="mt-5 rounded-[var(--radius-card)] border-[0.5px] border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-[16px] font-medium">
          <Lock className="size-4 text-text-muted" />
          Password
        </h2>
        <form onSubmit={savePassword} className="mt-5 flex flex-col gap-4">
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Your current password"
            autoComplete="current-password"
          />
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          {passwordError && (
            <p role="alert" className="text-[13px] text-destructive">
              {passwordError}
            </p>
          )}
          <Button type="submit" size="md" variant="secondary" isLoading={savingPassword} className="self-start">
            Update password
          </Button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="mt-5 rounded-[var(--radius-card)] border-[0.5px] border-stamp-red/20 bg-card p-6">
        <h2 className="flex items-center gap-2 text-[16px] font-medium text-stamp-red">
          <Trash2 className="size-4" />
          Delete account
        </h2>
        <p className="mt-2 text-[14px] text-text-secondary">
          Permanently removes your account and anonymises your booking history. This cannot be undone.
        </p>
        {showDeleteConfirm ? (
          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                logout()
                navigate('/')
              }}
            >
              Yes, delete my account
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 text-stamp-red hover:text-stamp-red"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete account
          </Button>
        )}
      </section>

      {/* Email contact link */}
      <div className="mt-6 flex items-center gap-2 text-[13px] text-text-muted">
        <Mail className="size-3.5" />
        <a href="mailto:support@encore.live" className="hover:text-foreground underline-offset-2 hover:underline">
          support@encore.live
        </a>
        <span>· We're here if you need help.</span>
      </div>
    </div>
  )
}
