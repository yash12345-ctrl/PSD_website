import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import './Home.css'

/* ==========================================================================
   Course configuration — edit these values to match your course.
   ========================================================================== */
const COURSE_NAME = 'Principles of Sustainable Development'

const DAY_MS = 86_400_000
const WINDOW_OPENS = new Date('2026-10-15T00:00:00')

// Final deadline: 9 November at 11:59 PM
const FINAL_DEADLINE = new Date('2026-11-09T23:59:00')

const KEY_DATES = [
  {
    date: new Date('2026-10-20T23:59:00'),
    title: 'Topic selection',
    detail: 'Choose the principle your work will focus on.',
  },
  {
    date: FINAL_DEADLINE,
    title: 'Final submission',
    detail: 'Upload your assignment report and poster by 11:59 PM.',
  },
  {
    date: new Date(FINAL_DEADLINE.getTime() + 5 * DAY_MS),
    title: 'Poster presentation',
    detail: 'Present your poster to the class.',
  },
]

/* ==========================================================================
   Helpers
   ========================================================================== */
const formatShortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* ==========================================================================
   Icons
   ========================================================================== */
const Icon = ({ children, size = 20 }: { children: ReactNode; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const LeafIcon = () => (
  <Icon size={16}>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </Icon>
)

const MoonIcon = () => (
  <Icon size={16}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Icon>
)

const SunIcon = () => (
  <Icon size={16}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </Icon>
)

const ArrowIcon = () => (
  <Icon size={18}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

/* ==========================================================================
   Page
   ========================================================================== */
interface HomeProps {
  onOpenSubmit?: () => void
  onOpenAdmin?: () => void
}

export default function Home({ onOpenSubmit, onOpenAdmin: _onOpenAdmin }: HomeProps = {}) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const [now, setNow] = useState(() => Date.now())

  /* Live countdown clock updates every 1 second */
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  /* Theme */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  /* Fade-up sections as they enter the viewport */
  useEffect(() => {
    const elements = document.querySelectorAll('.reveal')
    if (!('IntersectionObserver' in window)) {
      elements.forEach(el => el.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    elements.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  /* Submission window & live remaining time */
  const opens = WINDOW_OPENS.getTime()
  const closes = FINAL_DEADLINE.getTime()
  const phase: 'upcoming' | 'open' | 'closed' = now < opens ? 'upcoming' : now > closes ? 'closed' : 'open'
  const msLeft = Math.max(0, closes - now)
  const totalSeconds = Math.floor(msLeft / 1000)
  const daysLeft = Math.floor(totalSeconds / 86400)
  const hoursLeft = Math.floor((totalSeconds % 86400) / 3600)
  const minutesLeft = Math.floor((totalSeconds % 3600) / 60)
  const secondsLeft = totalSeconds % 60
  const nextIndex = KEY_DATES.findIndex(d => d.date.getTime() >= now)
  const nextDate = nextIndex >= 0 ? KEY_DATES[nextIndex] : null

  const phaseLabel =
    phase === 'open' ? 'Submissions open' : phase === 'upcoming' ? `Opens ${formatShortDate(WINDOW_OPENS)}` : 'Submissions closed'


  return (
    <div className="page">
      {/* ================= Navigation ================= */}
      <header className="nav">
        <div className="container nav-inner">
          <a
            href="#top"
            className="brand"
            onClick={e => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            <span className="brand-mark">
              <LeafIcon />
            </span>
            <span className="brand-text">PSD Portal</span>
          </a>

          <div className="nav-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button
              type="button"
              className="nav-cta"
              onClick={onOpenSubmit || (() => scrollToId('requirements'))}
            >
              {onOpenSubmit ? 'Submit' : 'Requirements'}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ================= Hero ================= */}
        <section className="hero">
          {/* Ambient Multi-Layered Aurora Glow & Micro-Dot Matrix */}
          <div className="hero-bg-lights" aria-hidden="true">
            <div className="glow-orb glow-top-emerald" />
            <div className="glow-orb glow-top-cyan" />
            <div className="glow-orb glow-card-sapphire" />
            <div className="hero-grid-matrix" />
          </div>

          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="hero-eyebrow animate-in">
                <span className="hero-eyebrow-icon">
                  <LeafIcon />
                </span>
                <span className="hero-eyebrow-text">{COURSE_NAME}</span>
              </div>
              <h1 className="hero-title animate-in delay-1">
                Submit your assignment <span className="accent">and poster.</span>
              </h1>
              <p className="hero-lead animate-in delay-2">
                Upload your report and poster, check the requirements, and keep track of every deadline — all in
                one place.
              </p>
              <div className="hero-actions animate-in delay-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onOpenSubmit || (() => scrollToId('requirements'))}
                >
                  {onOpenSubmit ? 'Submit assignment' : 'View requirements'}
                  <ArrowIcon />
                </button>
              </div>
            </div>

            {/* Status widget */}
            <aside className="status-card animate-in delay-3" aria-label="Submission status">
              <div className="status-top">
                <span className={`status-live ${phase !== 'open' ? 'is-off' : ''}`}>
                  <span className="live-dot" />
                  {phaseLabel}
                </span>
                <span className="status-close">
                  {phase === 'closed' ? 'Closed 9 Nov · 11:59 PM' : 'Due 9 Nov · 11:59 PM'}
                </span>
              </div>

              <div className="status-count">
                <strong>{phase === 'closed' ? 0 : daysLeft > 0 ? daysLeft : hoursLeft}</strong>
                <div className="status-count-sub">
                  <span className="status-count-unit">
                    {phase === 'closed'
                      ? 'Closed'
                      : daysLeft > 0
                        ? (daysLeft === 1 ? 'day left' : 'days left')
                        : hoursLeft > 0
                          ? (hoursLeft === 1 ? 'hour left' : 'hours left')
                          : (minutesLeft === 1 ? 'minute left' : 'minutes left')}
                  </span>
                  {phase === 'open' && (
                    <span className="status-count-timer" title="Live countdown">
                      {daysLeft > 0 && `${daysLeft}d `}
                      {String(hoursLeft % 24).padStart(2, '0')}h {String(minutesLeft).padStart(2, '0')}m {String(secondsLeft).padStart(2, '0')}s
                    </span>
                  )}
                </div>
              </div>
              <p className="status-caption">
                {phase === 'closed'
                  ? 'Submissions are officially closed.'
                  : 'Final submission closes 9 Nov at 11:59 PM'}
              </p>

              {nextDate && (
                <div className="status-next">
                  <span>Next up</span>
                  <strong>
                    {nextDate.title} · {formatShortDate(nextDate.date)}
                  </strong>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>

    </div>
  )
}
