import { useState, useEffect, useRef } from 'react'
import DocxViewer from './DocxViewer'
import './DocumentViewer.css'

interface SubmissionData {
  id: string
  refId?: string
  name: string
  regNo: string
  section?: string | null
  email?: string
  assignmentName?: string | null
  assignmentSize?: number | null
  reportName?: string | null
  reportSize?: number | null
  createdAt?: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function getAuthToken(): string {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem('psd_admin_token') || localStorage.getItem('psd_admin_token') || ''
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

interface DocumentViewerProps {
  onBack?: () => void
}

export default function DocumentViewer({ onBack }: DocumentViewerProps) {
  const [submission, setSubmission] = useState<SubmissionData | null>(null)
  const [fileType, setFileType] = useState<'assignment' | 'poster'>('assignment')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      const current = document.documentElement.getAttribute('data-theme')
      if (current === 'light') return 'light'
    }
    return 'dark'
  })

  // Image zoom state
  const [imageZoom, setImageZoom] = useState<number>(1)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    document.documentElement.setAttribute('data-theme', theme)
    return () => {
      isMountedRef.current = false
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  // Parse hash query params: #viewer?id=...&type=...
  useEffect(() => {
    const parseUrlParams = () => {
      const hash = window.location.hash || ''
      const queryIdx = hash.indexOf('?')
      if (queryIdx === -1) {
        setError('Missing document ID parameter.')
        setLoading(false)
        return
      }

      const searchParams = new URLSearchParams(hash.slice(queryIdx + 1))
      const id = searchParams.get('id')
      const type = searchParams.get('type') === 'poster' || searchParams.get('type') === 'report' ? 'poster' : 'assignment'

      if (!id) {
        setError('No document ID specified in the URL.')
        setLoading(false)
        return
      }

      setFileType(type)
      fetchSubmission(id)
    }

    const fetchSubmission = async (id: string) => {
      setLoading(true)
      setError(null)

      const token = getAuthToken()
      if (!token) {
        setError('Unauthorized: Admin authentication token is required to preview this deliverable. Please sign in to the Admin Dashboard.')
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_BASE_URL}/submissions/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401) {
          throw new Error('Your admin session has expired or is invalid. Please sign in again.')
        }
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}: Failed to load submission metadata.`)
        }
        const json = await res.json()
        if (!json.success || !json.data) {
          throw new Error(json.message || 'Submission record not found.')
        }

        if (isMountedRef.current) {
          setSubmission(json.data)
          setLoading(false)
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve document details.')
          setLoading(false)
        }
      }
    }

    parseUrlParams()

    const onHashChange = () => {
      parseUrlParams()
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const handleBackToDashboard = () => {
    if (onBack) {
      onBack()
    } else if (window.opener) {
      window.close()
    } else {
      window.location.hash = '#admin'
    }
  }

  const isAssignment = fileType === 'assignment'
  const fileName = submission ? (isAssignment ? submission.assignmentName : submission.reportName) : null
  const fileSize = submission ? (isAssignment ? submission.assignmentSize : submission.reportSize) : null
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || ''
  const isPdf = ext === 'pdf'
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)
  const isWord = ['doc', 'docx'].includes(ext)

  const tokenParam = getAuthToken() ? `?token=${encodeURIComponent(getAuthToken())}` : ''
  const viewUrl = submission ? `${API_BASE_URL}/submissions/${submission.id}/view/${fileType}${tokenParam}` : ''
  const downloadUrl = submission ? `${API_BASE_URL}/submissions/${submission.id}/download/${fileType}${tokenParam}` : ''

  return (
    <div className="doc-viewer-page">
      {/* Top Navigation Bar */}
      <header className="doc-viewer-header">
        <div className="doc-viewer-header-left">
          <button
            type="button"
            className="doc-viewer-back-btn"
            onClick={handleBackToDashboard}
            title="Return to Admin Dashboard or close tab"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Dashboard</span>
          </button>

          <span className="doc-viewer-divider" />

          {submission && (
            <div className="doc-viewer-file-meta">
              <span className={`doc-viewer-kind-badge ${isAssignment ? 'blue' : 'green'}`}>
                {isAssignment ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                )}
                <span>{isAssignment ? 'Assignment Deliverable' : 'Poster Presentation'}</span>
              </span>

              <h1 className="doc-viewer-title" title={fileName || ''}>
                {fileName || 'Deliverable Document'}
              </h1>

              {fileSize && (
                <span className="doc-viewer-size-pill">{formatBytes(fileSize)}</span>
              )}
            </div>
          )}
        </div>

        {submission && (
          <div className="doc-viewer-header-center">
            <div className="doc-viewer-student-chip" title={`Submitted by ${submission.name}`}>
              <span className="student-name-bold">{submission.name}</span>
              <span className="chip-sep">•</span>
              <span className="student-roll-code">{submission.regNo}</span>
              {submission.section && (
                <>
                  <span className="chip-sep">•</span>
                  <span className="student-cohort">Sec {submission.section}</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="doc-viewer-header-right">
          {isImage && (
            <div className="doc-viewer-zoom-controls">
              <button
                type="button"
                className="zoom-btn"
                onClick={() => setImageZoom((z) => Math.max(0.5, z - 0.25))}
                title="Zoom out"
                aria-label="Zoom out"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <span className="zoom-level">{Math.round(imageZoom * 100)}%</span>
              <button
                type="button"
                className="zoom-btn"
                onClick={() => setImageZoom((z) => Math.min(3, z + 0.25))}
                title="Zoom in"
                aria-label="Zoom in"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              {imageZoom !== 1 && (
                <button
                  type="button"
                  className="zoom-reset-btn"
                  onClick={() => setImageZoom(1)}
                  title="Reset zoom"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="doc-viewer-action-btn download"
              title="Download original file to computer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download</span>
            </a>
          )}

          <button
            type="button"
            className="doc-viewer-theme-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Document Canvas */}
      <main className="doc-viewer-body">
        {loading && (
          <div className="doc-viewer-loading-state">
            <div className="viewer-spinner" />
            <p className="viewer-loading-hint">Loading document preview...</p>
          </div>
        )}

        {error && !loading && (
          <div className="doc-viewer-error-state">
            <div className="viewer-error-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3>Unable to Display Document</h3>
            <p className="error-desc">{error}</p>
            <div className="error-actions">
              <button
                type="button"
                className="primary-cta-btn"
                onClick={handleBackToDashboard}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}

        {!loading && !error && submission && (
          <>
            {isPdf && (
              <div className="doc-viewer-pdf-container">
                <iframe
                  src={`${viewUrl}#toolbar=1&navpanes=0`}
                  title={fileName || 'PDF Document'}
                  className="doc-viewer-fullscreen-iframe"
                />
              </div>
            )}

            {isImage && (
              <div className="doc-viewer-image-container">
                <div
                  className="doc-viewer-image-wrapper"
                  style={{ transform: `scale(${imageZoom})`, transformOrigin: 'top center' }}
                >
                  <img
                    src={viewUrl}
                    alt={fileName || 'Poster Presentation'}
                    className="doc-viewer-fullscreen-image"
                  />
                </div>
              </div>
            )}

            {isWord && (
              <div className="doc-viewer-word-container">
                <DocxViewer
                  url={viewUrl}
                  fileName={fileName || 'Word Document'}
                  downloadUrl={downloadUrl}
                  fileSize={fileSize}
                />
              </div>
            )}

            {!isPdf && !isImage && !isWord && (
              <div className="doc-viewer-fallback-card">
                <div className="fallback-icon">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <h3>{fileName}</h3>
                <p className="fallback-hint">
                  This deliverable file ({formatBytes(fileSize)}) cannot be rendered directly in-browser.
                </p>
                <div className="fallback-cta">
                  <a href={downloadUrl} className="primary-cta-btn">
                    Download File
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

