import { useState } from 'react'
import type { FormEvent } from 'react'

interface AdminLoginProps {
  onLoginSuccess: () => void
  onBack?: () => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function AdminLogin({
  onLoginSuccess,
  onBack: _onBack,
  theme,
  toggleTheme,
}: AdminLoginProps) {
  const [adminId, setAdminId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!adminId.trim() || !password.trim()) {
      setError('Please enter both Admin ID and Password.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminId.trim(),
          password: password,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success && data.token) {
        sessionStorage.setItem('psd_admin_token', data.token)
        localStorage.setItem('psd_admin_token', data.token)
        onLoginSuccess()
      } else {
        setError(data.message || 'Invalid Admin ID or Password. Please try again.')
      }
    } catch {
      setError('Unable to reach authentication server. Ensure backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-page">
      {/* Navigation */}
      <nav className="admin-nav">
        <div className="admin-nav-inner">
          <span className="admin-nav-title">Admin Portal</span>

          <button
            type="button"
            className="theme-btn-mini"
            onClick={toggleTheme}
            aria-label="Toggle dark/light mode"
          >
            {theme === 'light' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Login Box */}
      <main className="admin-login-wrap">
        <div className="admin-login-card">
          <div className="admin-icon-shield">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h1 className="admin-login-title">Admin Access</h1>
          <p className="admin-login-sub">
            Sign in to view student submissions and download deliverables.
          </p>

          <form onSubmit={handleSubmit} noValidate className="admin-login-form">
            <div className="apple-inset-card">
              <div className="apple-form-row">
                <label htmlFor="admin-id-input" className="admin-row-label">
                  Admin ID
                </label>
                <input
                  id="admin-id-input"
                  type="text"
                  className="apple-form-input"
                  placeholder="e.g. admin"
                  autoComplete="username"
                  autoCapitalize="none"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                />
              </div>

              <div className="apple-form-row">
                <label htmlFor="admin-pass-input" className="admin-row-label">
                  Password
                </label>
                <input
                  id="admin-pass-input"
                  type={showPassword ? 'text' : 'password'}
                  className="apple-form-input"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="show-pass-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <p className="admin-error-banner">{error}</p>}

            <button
              type="submit"
              className="apple-blue-btn admin-submit-btn"
              disabled={loading}
            >
              {loading ? <span>Verifying...</span> : <span>Sign In</span>}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

