import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type Mode = 'signin' | 'register'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useStore()
  const from = (location.state as { from?: string } | null)?.from ?? '/bookings'

  const [mode, setMode] = React.useState<Mode>('signin')
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const reset = (next: Mode) => {
    setMode(next)
    setError('')
    setName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setError('Enter your full name (at least 2 characters).')
        return
      }
      if (!validateEmail(email)) {
        setError('Enter a valid email address.')
        return
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    } else {
      if (!validateEmail(email)) {
        setError('Enter a valid email and password to continue.')
        return
      }
      if (password.length < 8) {
        setError('Enter a valid email and password to continue.')
        return
      }
    }

    setLoading(true)
    // Simulated auth — any valid-looking credentials sign you in.
    setTimeout(() => {
      login(email, mode === 'register' ? name.trim() : undefined)
      navigate(from, { replace: true })
    }, 700)
  }

  const tabClass = (t: Mode) =>
    cn(
      'flex-1 py-2.5 text-[14px] font-medium transition-colors border-b-2',
      mode === t
        ? 'border-stamp-red text-foreground'
        : 'border-transparent text-text-secondary hover:text-foreground',
    )

  return (
    <div className="mx-auto flex max-w-md flex-col px-5 py-16">
      <p className="eyebrow text-stamp-red">Your account</p>
      <h1 className="mt-3 font-voice text-[36px] font-medium tracking-[-0.02em]">
        {mode === 'signin' ? 'Sign in to Encore' : 'Create an account'}
      </h1>
      <p className="mt-2 text-[15px] text-text-secondary">
        {mode === 'signin'
          ? 'Sign in to book seats and keep your ticket stubs in one place.'
          : 'Register to start booking concerts and track your tickets.'}
      </p>

      <div className="mt-8 rounded-[var(--radius-card)] border-[0.5px] border-border bg-card overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b-[0.5px] border-border">
          <button type="button" className={tabClass('signin')} onClick={() => reset('signin')}>
            Sign in
          </button>
          <button type="button" className={tabClass('register')} onClick={() => reset('register')}>
            Register
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 p-6">
          {mode === 'register' && (
            <Input
              label="Full name"
              type="text"
              placeholder="Alex Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="name@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            required
          />
          {mode === 'register' && (
            <Input
              label="Confirm password"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          )}
          {error && (
            <p role="alert" className="text-[13px] text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" fullWidth isLoading={loading}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
          <p className="text-center text-[13px] text-text-muted">
            Demo build — any valid-looking credentials work.
            {mode === 'signin' && (
              <> Sign in as <span className="font-mono">admin@encore.live</span> for admin access.</>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}
