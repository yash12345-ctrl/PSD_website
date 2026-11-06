import { useState, useEffect } from 'react'
import Home from './home/Home'
import Submit from './submit/Submit'
import Admin from './admin/Admin'
import DocumentViewer from './admin/DocumentViewer'

type AppView = 'home' | 'submit' | 'admin' | 'viewer'

function parseHashToView(hash: string): AppView {
  if (hash.startsWith('#viewer') || hash.startsWith('#preview')) return 'viewer'
  if (hash.startsWith('#admin')) return 'admin'
  if (hash.startsWith('#submit')) return 'submit'
  return 'home'
}

function App() {
  const [view, setView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      return parseHashToView(window.location.hash)
    }
    return 'home'
  })

  useEffect(() => {
    const onHashChange = () => {
      setView(parseHashToView(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigateTo = (target: AppView) => {
    setView(target)
    window.location.hash = target === 'home' ? '' : `#${target}`
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (view === 'viewer') {
    const hasToken =
      typeof window !== 'undefined'
        ? Boolean(sessionStorage.getItem('psd_admin_token') || localStorage.getItem('psd_admin_token'))
        : false
    if (!hasToken) {
      return <Admin onBack={() => navigateTo('home')} />
    }
    return <DocumentViewer onBack={() => navigateTo('admin')} />
  }

  if (view === 'admin') {
    return <Admin onBack={() => navigateTo('home')} />
  }

  if (view === 'submit') {
    return (
      <Submit
        onBack={() => navigateTo('home')}
      />
    )
  }

  return (
    <Home
      onOpenSubmit={() => navigateTo('submit')}
      onOpenAdmin={() => navigateTo('admin')}
    />
  )
}

export default App
