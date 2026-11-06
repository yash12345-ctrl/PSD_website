import { useState, useEffect, useMemo, useRef } from 'react'
import DocxViewer from './DocxViewer'

export interface SubmissionRecord {
  id: string
  refId: string
  name: string
  regNo: string
  section: string | null
  email?: string | null
  assignmentName?: string | null
  assignmentSize?: number | null
  reportName?: string | null
  reportSize?: number | null
  createdAt: string
}

interface AdminDashboardProps {
  onLogout: () => void
  onBack?: () => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

interface PreviewModalData {
  isOpen: boolean
  submission: SubmissionRecord
  fileType: 'assignment' | 'poster'
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const SUBMISSIONS_CACHE_KEY = 'psd_admin_submissions_cache'

function getAuthToken(): string {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem('psd_admin_token') || localStorage.getItem('psd_admin_token') || ''
}

function getCachedSubmissions(): SubmissionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(SUBMISSIONS_CACHE_KEY) || localStorage.getItem(SUBMISSIONS_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // ignore
  }
  return []
}

function saveSubmissionsToCache(data: SubmissionRecord[]) {
  try {
    const serialized = JSON.stringify(data)
    sessionStorage.setItem(SUBMISSIONS_CACHE_KEY, serialized)
    localStorage.setItem(SUBMISSIONS_CACHE_KEY, serialized)
  } catch {
    // storage disabled
  }
}

function getAvatarGradient(name?: string | null): string {
  const gradients = [
    'linear-gradient(135deg, #0a84ff 0%, #0040dd 100%)',
    'linear-gradient(135deg, #30d158 0%, #1b8a38 100%)',
    'linear-gradient(135deg, #bf5af2 0%, #8222b8 100%)',
    'linear-gradient(135deg, #ff9f0a 0%, #c97100 100%)',
    'linear-gradient(135deg, #ff375f 0%, #b81438 100%)',
    'linear-gradient(135deg, #64d2ff 0%, #0570a6 100%)',
  ]
  const str = name || 'Student'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return gradients[Math.abs(hash) % gradients.length]
}

export default function AdminDashboard({
  onLogout,
  onBack: _onBack,
  theme,
  toggleTheme,
}: AdminDashboardProps) {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(() => getCachedSubmissions())
  const [loading, setLoading] = useState<boolean>(() => submissions.length === 0)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSection, setSelectedSection] = useState('ALL')
  const [previewData, setPreviewData] = useState<PreviewModalData | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (sub: SubmissionRecord) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the submission for "${sub.name}" (${sub.regNo})?\n\nThis will remove the record and permanently delete uploaded files from disk. This cannot be undone.`
    )
    if (!confirmed) return

    setDeletingId(sub.id)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_BASE_URL}/submissions/${sub.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (response.status === 401) {
        onLogout()
        return
      }

      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to delete submission.')
      }

      setSubmissions((prev) => {
        const next = prev.filter((item) => item.id !== sub.id)
        saveSubmissionsToCache(next)
        return next
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting submission.'
      alert(msg)
    } finally {
      setDeletingId(null)
    }
  }

  const handleOpenPreview = (sub: SubmissionRecord, fileType: 'assignment' | 'poster') => {
    setPreviewData({ isOpen: true, submission: sub, fileType })
  }

  const handleClosePreview = () => {
    setPreviewData(null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewData(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_BASE_URL}/submissions?force=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        onLogout()
        return
      }
      if (!response.ok) throw new Error(`Failed to load data (${response.status})`)
      const json = await response.json()
      if (json.success && Array.isArray(json.data)) {
        setSubmissions(json.data)
        saveSubmissionsToCache(json.data)
      } else {
        setSubmissions([])
        saveSubmissionsToCache([])
      }
    } catch {
      setError('Unable to fetch live database records. Ensure the backend server is running on port 5000.')
    } finally {
      setRefreshing(false)
    }
  }

  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    async function loadData() {
      try {
        const token = getAuthToken()
        const response = await fetch(`${API_BASE_URL}/submissions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (response.status === 401) {
          onLogout()
          return
        }
        if (!response.ok) throw new Error(`Failed to load data (${response.status})`)
        const json = await response.json()
        if (isMountedRef.current) {
          if (json.success && Array.isArray(json.data)) {
            setSubmissions(json.data)
            saveSubmissionsToCache(json.data)
          } else {
            setSubmissions([])
            saveSubmissionsToCache([])
          }
        }
      } catch {
        if (isMountedRef.current) {
          setError('Unable to fetch live database records. Ensure the backend server is running on port 5000.')
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      isMountedRef.current = false
    }
  }, [onLogout])

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '—'
    if (bytes >= 1_048_576) {
      return `${(bytes / 1_048_576).toFixed(1)} MB`
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  // Derive unique sections for filtering
  const sectionsList = useMemo(() => {
    const set = new Set<string>()
    submissions.forEach((s) => {
      if (s.section && s.section.trim()) {
        set.add(s.section.trim().toUpperCase())
      }
    })
    return ['ALL', ...Array.from(set).sort()]
  }, [submissions])

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((item) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.regNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.section && item.section.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.email && item.email.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesSection =
        selectedSection === 'ALL' ||
        (item.section && item.section.toUpperCase() === selectedSection)

      return matchesSearch && matchesSection
    })
  }, [submissions, searchQuery, selectedSection])

  // Statistics
  const stats = useMemo(() => {
    const total = submissions.length
    const withAssignment = submissions.filter((s) => s.assignmentName).length
    const withPoster = submissions.filter((s) => s.reportName).length
    const uniqueSections = new Set(
      submissions.map((s) => s.section?.trim().toUpperCase()).filter(Boolean)
    ).size

    return { total, withAssignment, withPoster, uniqueSections }
  }, [submissions])

  const escapeCsvCell = (val: unknown): string => {
    if (val === null || val === undefined) return '""'
    let str = String(val)
    // CWE-1236 Defense: Neutralize CSV formula execution triggers (=, +, -, @, tab, CR)
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`
    }
    // Escape internal double quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`
  }

  const exportCSV = () => {
    if (filteredSubmissions.length === 0) return

    const headers = [
      'Student Name',
      'Roll Number',
      'Section',
      'Email',
      'Assignment File',
      'Assignment Size',
      'Poster File',
      'Poster Size',
      'Submission Timestamp',
    ]

    const rows = filteredSubmissions.map((s) => [
      escapeCsvCell(s.name),
      escapeCsvCell(s.regNo),
      escapeCsvCell(s.section || ''),
      escapeCsvCell(s.email || ''),
      escapeCsvCell(s.assignmentName || 'None'),
      escapeCsvCell(formatBytes(s.assignmentSize)),
      escapeCsvCell(s.reportName || 'None'),
      escapeCsvCell(formatBytes(s.reportSize)),
      escapeCsvCell(formatDate(s.createdAt)),
    ])

    const csvContent = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `PSD_Submissions_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="admin-page">
      {/* Admin Top Navigation */}
      <header className="admin-nav">
        <div className="admin-nav-inner wide">
          <div className="admin-nav-brand">
            <div className="admin-portal-badge">
              <span className="live-pulse-dot" />
              <span className="brand-title">Admin Dashboard</span>
            </div>
          </div>

          <div className="admin-nav-actions">
            <button
              type="button"
              className="admin-tool-btn"
              onClick={handleRefresh}
              title="Refresh submissions"
              disabled={refreshing}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className={refreshing ? 'spin-icon' : ''}
              >
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span className="hide-on-mobile">Refresh</span>
            </button>

            <button
              type="button"
              className="admin-tool-btn"
              onClick={exportCSV}
              title="Export filtered records to CSV"
              disabled={filteredSubmissions.length === 0}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="hide-on-mobile">Export CSV</span>
            </button>

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

            <button
              type="button"
              className="admin-logout-btn"
              onClick={onLogout}
              title="Sign out of Admin Portal"
              aria-label="Sign Out"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hide-on-mobile">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Workspace */}
      <main className="admin-content-wrap">
        {/* Metric KPI Widgets */}
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <span className="stat-label">Total Submissions</span>
            <div className="stat-value">{stats.total}</div>
            <span className="stat-hint">Saved</span>
          </div>

          <div className="admin-stat-card">
            <span className="stat-label">Assignments Uploaded</span>
            <div className="stat-value blue">{stats.withAssignment}</div>
            <span className="stat-hint">PDF & DOCX deliverables</span>
          </div>

          <div className="admin-stat-card">
            <span className="stat-label">Posters Uploaded</span>
            <div className="stat-value green">{stats.withPoster}</div>
            <span className="stat-hint">PDF & PNG deliverables</span>
          </div>

          <div className="admin-stat-card">
            <span className="stat-label">Sections Active</span>
            <div className="stat-value purple">{stats.uniqueSections}</div>
            <span className="stat-hint">Represented cohorts</span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="admin-filter-bar">
          <div className="admin-search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by student name, roll number, section, or ref ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {sectionsList.length > 2 && (
            <div className="admin-section-filter">
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="section-dropdown"
              >
                {sectionsList.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec === 'ALL' ? 'All Sections' : sec}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Database Status Notice if error */}
        {error && (
          <div className="admin-warning-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Student Submissions List / Table */}
        <div className="admin-table-container">
          <div className="admin-table-header">
            <h2 className="table-heading">
              Student Submissions ({filteredSubmissions.length})
            </h2>
            <span className="table-subheading">
              Showing deliverables uploaded for Principles of Sustainable Development
            </span>
          </div>

          {loading ? (
            <div className="admin-loading-state">
              <div className="admin-spinner" />
              <p>Fetching records from local SQL database...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="admin-empty-state">
              <div className="empty-icon-circle">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <h3>No Submissions Found</h3>
              <p>
                {searchQuery || selectedSection !== 'ALL'
                  ? 'No records match your search filters.'
                  : 'No student deliverables have been uploaded yet. Students can submit through the submission portal.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop View Table */}
              <div className="desktop-table-scroll">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll No.</th>
                      <th>Section</th>
                      <th>Assignment</th>
                      <th>Poster</th>
                      <th>Submitted</th>
                      <th style={{ textAlign: 'center', width: '90px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub.id}>
                        {/* Student Name & Email */}
                        <td>
                          <div className="student-cell-rich">
                            <div
                              className="student-avatar"
                              style={{ background: getAvatarGradient(sub.name) }}
                              aria-hidden="true"
                            >
                              {(sub.name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div className="student-details">
                              <span className="student-name">{sub.name}</span>
                              {sub.email && (
                                <span className="student-email" title={sub.email}>
                                  {sub.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Roll Number */}
                        <td>
                          <span className="roll-box-pill">{sub.regNo}</span>
                        </td>

                        {/* Section */}
                        <td>
                          <span className="section-badge-pill">
                            <span className="sec-dot" />
                            {sub.section ? `Sec ${sub.section}` : 'General'}
                          </span>
                        </td>

                        {/* Assignment Deliverable */}
                        <td>
                          {sub.assignmentName ? (
                            <div className="deliv-premium-card assignment">
                              <div className="deliv-card-top">
                                <div className="deliv-card-icon blue">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                  </svg>
                                </div>
                                <div className="deliv-card-info">
                                  <span className="deliv-card-name" title={sub.assignmentName}>
                                    {sub.assignmentName}
                                  </span>
                                  <span className="deliv-card-size">{formatBytes(sub.assignmentSize)}</span>
                                </div>
                              </div>
                              <div className="deliv-card-actions">
                                <a
                                  href={`${window.location.origin}${window.location.pathname}#viewer?id=${sub.id}&type=assignment`}
                                  className="deliv-btn view blue"
                                  onClick={(e) => {
                                    if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                                      e.preventDefault()
                                      handleOpenPreview(sub, 'assignment')
                                    }
                                  }}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={`Preview ${sub.assignmentName}`}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span>View</span>
                                </a>
                                <a
                                  href={`${API_BASE_URL}/submissions/${sub.id}/download/assignment?token=${encodeURIComponent(getAuthToken())}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="deliv-btn download"
                                  title={`Download ${sub.assignmentName}`}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  <span>Download</span>
                                </a>
                              </div>
                            </div>
                          ) : (
                            <div className="empty-deliv-box">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="8" y1="12" x2="16" y2="12" />
                              </svg>
                              <span>Not attached</span>
                            </div>
                          )}
                        </td>

                        {/* Poster Deliverable */}
                        <td>
                          {sub.reportName ? (
                            <div className="deliv-premium-card poster">
                              <div className="deliv-card-top">
                                <div className="deliv-card-icon green">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                  </svg>
                                </div>
                                <div className="deliv-card-info">
                                  <span className="deliv-card-name" title={sub.reportName}>
                                    {sub.reportName}
                                  </span>
                                  <span className="deliv-card-size">{formatBytes(sub.reportSize)}</span>
                                </div>
                              </div>
                              <div className="deliv-card-actions">
                                <a
                                  href={`${window.location.origin}${window.location.pathname}#viewer?id=${sub.id}&type=poster`}
                                  className="deliv-btn view green"
                                  onClick={(e) => {
                                    if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                                      e.preventDefault()
                                      handleOpenPreview(sub, 'poster')
                                    }
                                  }}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={`Preview ${sub.reportName}`}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span>View</span>
                                </a>
                                <a
                                  href={`${API_BASE_URL}/submissions/${sub.id}/download/poster?token=${encodeURIComponent(getAuthToken())}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="deliv-btn download"
                                  title={`Download ${sub.reportName}`}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  <span>Download</span>
                                </a>
                              </div>
                            </div>
                          ) : (
                            <div className="empty-deliv-box">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="8" y1="12" x2="16" y2="12" />
                              </svg>
                              <span>Not attached</span>
                            </div>
                          )}
                        </td>

                        {/* Date */}
                        <td>
                          <div className="date-cell-box">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            <span>{formatDate(sub.createdAt)}</span>
                          </div>
                        </td>

                        {/* Action - Delete */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="row-delete-btn"
                            onClick={() => handleDelete(sub)}
                            disabled={deletingId === sub.id}
                            title={`Delete submission of ${sub.name}`}
                            aria-label={`Delete submission of ${sub.name}`}
                          >
                            {deletingId === sub.id ? (
                              <span className="btn-spinner-mini" />
                            ) : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            )}
                            <span>{deletingId === sub.id ? 'Deleting...' : 'Delete'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="mobile-submissions-list">
                {filteredSubmissions.map((sub) => (
                  <div key={sub.id} className="mobile-submission-card">
                    <div className="mobile-card-top">
                      <div className="student-meta">
                        <span className="student-name">{sub.name}</span>
                        {sub.email && <span className="student-email">{sub.email}</span>}
                      </div>
                      <span className="badge-pill roll">{sub.regNo}</span>
                    </div>

                    <div className="mobile-card-row">
                      <span className="meta-key">Section</span>
                      <span className="meta-val">{sub.section || 'General'}</span>
                    </div>

                    <div className="mobile-card-row">
                      <span className="meta-key">Submitted</span>
                      <span className="meta-val">{formatDate(sub.createdAt)}</span>
                    </div>

                    {/* Files Section in Mobile Card */}
                    <div className="mobile-card-files">
                      <span className="files-header-label">Uploaded Deliverables</span>
                      <div className="mobile-files-stack">
                        {sub.assignmentName ? (
                          <div className="mobile-file-item blue">
                            <div className="mobile-file-meta-row">
                              <span className="mobile-file-kind blue">Assignment</span>
                              <span className="size-tag">{formatBytes(sub.assignmentSize)}</span>
                            </div>
                            <div className="mobile-file-title" title={sub.assignmentName}>
                              {sub.assignmentName}
                            </div>
                            <div className="mobile-file-actions">
                              <a
                                href={`${window.location.origin}${window.location.pathname}#viewer?id=${sub.id}&type=assignment`}
                                className="mobile-file-btn view blue"
                                onClick={(e) => {
                                  if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                                    e.preventDefault()
                                    handleOpenPreview(sub, 'assignment')
                                  }
                                }}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                <span>View</span>
                              </a>
                              <a
                                href={`${API_BASE_URL}/submissions/${sub.id}/download/assignment?token=${encodeURIComponent(getAuthToken())}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mobile-file-btn download"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                <span>Download</span>
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="missing-file-note">Assignment: Not attached</div>
                        )}

                        {sub.reportName ? (
                          <div className="mobile-file-item green">
                            <div className="mobile-file-meta-row">
                              <span className="mobile-file-kind green">Poster</span>
                              <span className="size-tag">{formatBytes(sub.reportSize)}</span>
                            </div>
                            <div className="mobile-file-title" title={sub.reportName}>
                              {sub.reportName}
                            </div>
                            <div className="mobile-file-actions">
                              <a
                                href={`${window.location.origin}${window.location.pathname}#viewer?id=${sub.id}&type=poster`}
                                className="mobile-file-btn view green"
                                onClick={(e) => {
                                  if (!e.metaKey && !e.ctrlKey && e.button === 0) {
                                    e.preventDefault()
                                    handleOpenPreview(sub, 'poster')
                                  }
                                }}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                <span>View</span>
                              </a>
                              <a
                                href={`${API_BASE_URL}/submissions/${sub.id}/download/poster?token=${encodeURIComponent(getAuthToken())}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mobile-file-btn download"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                <span>Download</span>
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="missing-file-note">Poster: Not attached</div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mobile-card-delete-btn"
                      onClick={() => handleDelete(sub)}
                      disabled={deletingId === sub.id}
                      title={`Delete submission for ${sub.name}`}
                    >
                      {deletingId === sub.id ? (
                        <span className="btn-spinner-mini" />
                      ) : (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      )}
                      <span>{deletingId === sub.id ? 'Deleting...' : 'Delete Submission'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Deliverable File Preview Modal */}
      {previewData?.isOpen && previewData.submission && (() => {
        const sub = previewData.submission
        const fileType = previewData.fileType
        const isAssignment = fileType === 'assignment'
        const fileName = isAssignment ? sub.assignmentName : sub.reportName
        const fileSize = isAssignment ? sub.assignmentSize : sub.reportSize
        const tokenQuery = getAuthToken() ? `?token=${encodeURIComponent(getAuthToken())}` : ''
        const viewUrl = `${API_BASE_URL}/submissions/${sub.id}/view/${fileType}${tokenQuery}`
        const downloadUrl = `${API_BASE_URL}/submissions/${sub.id}/download/${fileType}${tokenQuery}`
        const viewerTabUrl = `${window.location.origin}${window.location.pathname}#viewer?id=${sub.id}&type=${fileType}`
        const ext = (fileName || '').split('.').pop()?.toLowerCase() || ''
        const isPdf = ext === 'pdf'
        const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)
        const isWord = ['doc', 'docx'].includes(ext)

        return (
          <div className="preview-modal-backdrop" onClick={handleClosePreview} role="presentation">
            <div className="preview-modal-shell" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              {/* Modal Header */}
              <div className="preview-modal-header">
                <div className="preview-header-meta">
                  <div className="preview-header-tags">
                    <span className={`preview-badge ${isAssignment ? 'blue' : 'green'}`}>
                      {isAssignment ? 'Assignment Deliverable' : 'Poster Presentation'}
                    </span>
                    <span className="preview-size-badge">{formatBytes(fileSize)}</span>
                  </div>
                  <h3 className="preview-file-name" title={fileName || ''}>
                    {fileName || 'Deliverable Preview'}
                  </h3>
                  <div className="preview-student-subtitle">
                    <span className="student-author">{sub.name}</span>
                    <span className="dot-divider">•</span>
                    <span className="mono-roll">{sub.regNo}</span>
                    {sub.section && (
                      <>
                        <span className="dot-divider">•</span>
                        <span>Section {sub.section}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="preview-header-actions">
                  <a
                    href={viewerTabUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="preview-top-btn"
                    title="Open document in a new browser tab without downloading"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    <span>New Tab</span>
                  </a>

                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="preview-top-btn download"
                    title="Download file to computer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Download</span>
                  </a>

                  <button
                    type="button"
                    className="preview-close-btn"
                    onClick={handleClosePreview}
                    title="Close preview (Esc)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body / Viewer */}
              <div className="preview-modal-body">
                {isPdf ? (
                  <div className="pdf-frame-wrapper">
                    <iframe
                      src={`${viewUrl}#toolbar=1&navpanes=0`}
                      title={fileName || 'PDF Document'}
                      className="pdf-preview-iframe"
                    />
                  </div>
                ) : isImage ? (
                  <div className="image-preview-wrapper">
                    <img
                      src={viewUrl}
                      alt={fileName || 'Image Deliverable'}
                      className="image-preview-img"
                    />
                  </div>
                ) : isWord ? (
                  <DocxViewer
                    url={viewUrl}
                    fileName={fileName || 'Word Document'}
                    downloadUrl={downloadUrl}
                    fileSize={fileSize}
                  />
                ) : (
                  <div className="doc-preview-placeholder">
                    <div className="doc-icon-badge">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <h4>Deliverable File</h4>
                    <p className="doc-hint">{fileName} ({formatBytes(fileSize)})</p>
                    <div className="doc-action-cta">
                      <a href={downloadUrl} className="primary-cta-btn">Download File</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
