import { useState, useEffect } from 'react'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'
import './Admin.css'

interface AdminProps {
  onBack: () => void
}

export default function Admin({ onBack }: AdminProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('psd_admin_token') || localStorage.getItem('psd_admin_token')
      return Boolean(token)
    }
    return false
  })

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      const current = document.documentElement.getAttribute('data-theme')
      if (current === 'light') return 'light'
    }
    return 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    sessionStorage.removeItem('psd_admin_token')
    localStorage.removeItem('psd_admin_token')
    setIsAuthenticated(false)
  }

  if (!isAuthenticated) {
    return (
      <AdminLogin
        onLoginSuccess={handleLoginSuccess}
        onBack={onBack}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    )
  }

  return (
    <AdminDashboard
      onLogout={handleLogout}
      onBack={onBack}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  )
}

