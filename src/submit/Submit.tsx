import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import './Submit.css'

interface SubmitProps {
  onBack?: () => void
}

interface SubmissionReceipt {
  refId: string
  name: string
  regNo: string
  section: string
  email: string
  assignmentFile: string
  posterFile: string
  timestamp: string
}

interface FileTypePopupInfo {
  isOpen: boolean
  deliverableName: 'Assignment' | 'Poster'
  fileName: string
  allowedList: string
  pickerId: string
}

const MAX_ASSIGNMENT_MB = 20
const MAX_POSTER_MB = 50
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Submit({ onBack }: SubmitProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      const current = document.documentElement.getAttribute('data-theme')
      if (current === 'light') return 'light'
    }
    // Default to dark mode to match the Apple dark design mockup
    return 'dark'
  })

  // Form Fields
  const [name, setName] = useState('')
  const [regNo, setRegNo] = useState('')
  const [section, setSection] = useState('')
  const [email, setEmail] = useState('')

  // Deliverables
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null)
  const [posterFile, setPosterFile] = useState<File | null>(null)

  // Status & Feedback
  const [fileError, setFileError] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null)
  const [popupInfo, setPopupInfo] = useState<FileTypePopupInfo | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && popupInfo?.isOpen) {
        setPopupInfo(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [popupInfo])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1_048_576) {
      return `${(bytes / 1_048_576).toFixed(1)} MB`
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  const handleAssignmentUpload = (file: File | undefined) => {
    if (!file) return

    const ext = file.name.includes('.')
      ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      : ''
    const allowed = ['.pdf', '.doc', '.docx']

    if (!allowed.includes(ext)) {
      setPopupInfo({
        isOpen: true,
        deliverableName: 'Assignment',
        fileName: file.name,
        allowedList: 'PDF or DOC / DOCX',
        pickerId: 'assignment-picker',
      })
      setFileError('Assignment strictly only accepts PDF or DOC/DOCX documents.')
      return
    }

    if (file.size > MAX_ASSIGNMENT_MB * 1_048_576) {
      setFileError(`Assignment must be under ${MAX_ASSIGNMENT_MB} MB.`)
      return
    }

    setFileError('')
    setAssignmentFile(file)
  }

  const handlePosterUpload = (file: File | undefined) => {
    if (!file) return

    const ext = file.name.includes('.')
      ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      : ''
    const allowed = ['.pdf', '.png']

    if (!allowed.includes(ext)) {
      setPopupInfo({
        isOpen: true,
        deliverableName: 'Poster',
        fileName: file.name,
        allowedList: 'PDF or PNG',
        pickerId: 'poster-picker',
      })
      setFileError('Poster strictly only accepts PDF or PNG files.')
      return
    }

    if (file.size > MAX_POSTER_MB * 1_048_576) {
      setFileError(`Poster must be under ${MAX_POSTER_MB} MB.`)
      return
    }

    setFileError('')
    setPosterFile(file)
  }

  const isValid =
    name.trim().length > 0 &&
    regNo.trim().length > 0 &&
    (assignmentFile !== null || posterFile !== null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValid) {
      setShowValidation(true)
      return
    }

    setIsSubmitting(true)
    setFileError('')

    const cleanReg = regNo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Prepare FormData payload for backend
    const formData = new FormData()
    formData.append('name', name.trim())
    formData.append('regNo', cleanReg)
    formData.append('section', section.trim() || 'A')
    formData.append('email', email.trim())

    if (assignmentFile) {
      formData.append('assignment', assignmentFile)
    }
    if (posterFile) {
      formData.append('poster', posterFile)
    }

    try {
      const response = await fetch(`${API_BASE_URL}/submissions`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setReceipt({
          refId: data.data.refId,
          name: data.data.name,
          regNo: data.data.regNo,
          section: data.data.section || (section.trim() || 'A'),
          email: email.trim(),
          assignmentFile: data.data.assignmentName || (assignmentFile ? assignmentFile.name : 'Not attached'),
          posterFile: data.data.reportName || (posterFile ? posterFile.name : 'Not attached'),
          timestamp: new Date().toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        })
      } else {
        throw new Error(data.message || 'Submission could not be saved.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to the backend server. Ensure backend is running on port 5000.'
      setFileError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setName('')
    setRegNo('')
    setSection('')
    setEmail('')
    setAssignmentFile(null)
    setPosterFile(null)
    setFileError('')
    setShowValidation(false)
    setReceipt(null)
  }

  return (
    <div className="submit-page">
      {/* Apple Frosted Navigation Bar */}
      <nav className="submit-nav">
        <div className="submit-nav-inner">
          {onBack ? (
            <button type="button" className="back-link" onClick={onBack}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Back</span>
            </button>
          ) : (
            <span className="nav-portal-title">PSD Portal</span>
          )}

          <span className="nav-portal-title center">Submission</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        </div>
      </nav>

      {/* Main Container */}
      <main className="submit-layout-wrap">
        {receipt ? (
          /* Receipt / Confirmation Card */
          <div className="receipt-card">
            <div className="receipt-check-circle">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 className="receipt-title">Submission Confirmed</h2>
            <p className="receipt-message">
              Thank you, <strong>{receipt.name}</strong>. Your academic deliverables have been securely saved.
            </p>

            <ul className="receipt-details-list">
              <li className="receipt-item">
                <span className="receipt-label">Reference ID</span>
                <span className="receipt-value mono">{receipt.refId}</span>
              </li>
              <li className="receipt-item">
                <span className="receipt-label">Student Name</span>
                <span className="receipt-value">{receipt.name}</span>
              </li>
              <li className="receipt-item">
                <span className="receipt-label">Roll / Reg No.</span>
                <span className="receipt-value">{receipt.regNo}</span>
              </li>
              <li className="receipt-item">
                <span className="receipt-label">Section</span>
                <span className="receipt-value">{receipt.section}</span>
              </li>
              {receipt.email && (
                <li className="receipt-item">
                  <span className="receipt-label">Email</span>
                  <span className="receipt-value">{receipt.email}</span>
                </li>
              )}
              <li className="receipt-item">
                <span className="receipt-label">Assignment</span>
                <span className="receipt-value">{receipt.assignmentFile}</span>
              </li>
              <li className="receipt-item">
                <span className="receipt-label">Poster</span>
                <span className="receipt-value">{receipt.posterFile}</span>
              </li>
              <li className="receipt-item">
                <span className="receipt-label">Time Stamp</span>
                <span className="receipt-value">{receipt.timestamp}</span>
              </li>
            </ul>

            <div className="receipt-btn-group">
              <button type="button" className="apple-blue-btn" onClick={resetForm}>
                Submit Another Entry
              </button>
              {onBack && (
                <button
                  type="button"
                  className="apple-secondary-btn"
                  onClick={onBack}
                >
                  Return to Overview
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Two Column Layout matching reference screenshot */
          <div className="submission-split-grid">
            {/* Left Column: Heading & Guidelines */}
            <div className="submission-left-pane">
              <div className="submit-badge-pill">
                <span>Submission</span>
              </div>

              <h1 className="submit-headline">Submit your work.</h1>

              <p className="submit-subheading">
                Fill in your details and attach your files. You can submit the assignment and poster together or one at a time.
              </p>
            </div>

            {/* Right Column: Inset Group Cards Form */}
            <div className="submission-right-pane">
              <form onSubmit={handleSubmit} noValidate>
                {/* 1. Student Details */}
                <div className="form-group-block">
                  <p className="card-group-label">STUDENT DETAILS</p>
                  <div className="apple-inset-card">
                    <div className="apple-form-row">
                      <label htmlFor="student-name" className="apple-row-label">Name</label>
                      <input
                        id="student-name"
                        type="text"
                        className="apple-form-input"
                        placeholder="Full name"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div className="apple-form-row">
                      <label htmlFor="roll-no" className="apple-row-label">Roll no.</label>
                      <input
                        id="roll-no"
                        type="text"
                        className="apple-form-input"
                        placeholder="e.g. 23BCE1024"
                        autoCapitalize="characters"
                        value={regNo}
                        onChange={(e) => setRegNo(e.target.value)}
                      />
                    </div>

                    <div className="apple-form-row">
                      <label htmlFor="section" className="apple-row-label">Section</label>
                      <input
                        id="section"
                        type="text"
                        className="apple-form-input"
                        placeholder="e.g. Section A"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                      />
                    </div>

                    <div className="apple-form-row">
                      <label htmlFor="email" className="apple-row-label">Email</label>
                      <input
                        id="email"
                        type="email"
                        className="apple-form-input"
                        placeholder="you@college.edu"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Files */}
                <div className="form-group-block">
                  <p className="card-group-label">FILES</p>
                  <div className="apple-inset-card">
                    {/* Assignment Row */}
                    <div className="apple-file-row">
                      <div className="apple-file-left">
                        <div className="file-icon-badge blue">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </div>
                        <div className="file-meta-col">
                          <span className="file-title-text">Assignment</span>
                          <span className={`file-sub-text ${assignmentFile ? 'attached' : ''}`}>
                            {assignmentFile
                              ? `${assignmentFile.name} • ${formatSize(assignmentFile.size)}`
                              : 'PDF or DOCX · up to 20 MB'}
                          </span>
                        </div>
                      </div>

                      {assignmentFile ? (
                        <button
                          type="button"
                          className="apple-action-pill remove"
                          onClick={() => setAssignmentFile(null)}
                        >
                          Remove
                        </button>
                      ) : (
                        <>
                          <label htmlFor="assignment-picker" className="apple-action-pill">
                            Choose
                          </label>
                          <input
                            id="assignment-picker"
                            type="file"
                            className="hidden-native-input"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => {
                              handleAssignmentUpload(e.target.files?.[0])
                              e.target.value = ''
                            }}
                          />
                        </>
                      )}
                    </div>

                    {/* Poster Row */}
                    <div className="apple-file-row">
                      <div className="apple-file-left">
                        <div className="file-icon-badge green">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                        </div>
                        <div className="file-meta-col">
                          <span className="file-title-text">Poster</span>
                          <span className={`file-sub-text ${posterFile ? 'attached' : ''}`}>
                            {posterFile
                              ? `${posterFile.name} • ${formatSize(posterFile.size)}`
                              : 'PDF or PNG · up to 50 MB'}
                          </span>
                        </div>
                      </div>

                      {posterFile ? (
                        <button
                          type="button"
                          className="apple-action-pill remove"
                          onClick={() => setPosterFile(null)}
                        >
                          Remove
                        </button>
                      ) : (
                        <>
                          <label htmlFor="poster-picker" className="apple-action-pill">
                            Choose
                          </label>
                          <input
                            id="poster-picker"
                            type="file"
                            className="hidden-native-input"
                            accept=".pdf,.png"
                            onChange={(e) => {
                              handlePosterUpload(e.target.files?.[0])
                              e.target.value = ''
                            }}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <p className="files-caption-note">
                    Attach one or both. You can come back and add the other later.
                  </p>

                  {fileError && <p className="form-error-banner">{fileError}</p>}
                </div>

                {/* Validation message */}
                {showValidation && !isValid && (
                  <p className="form-error-banner">
                    Please provide your Name, Roll no., and attach at least one file (Assignment or Poster).
                  </p>
                )}

                {/* 5. Main Action Button */}
                <div className="action-button-wrap">
                  <button
                    type="submit"
                    className="apple-blue-btn"
                    disabled={isSubmitting || (showValidation && !isValid)}
                  >
                    {isSubmitting ? (
                      <span>Submitting...</span>
                    ) : (
                      <span>Submit</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Invalid File Format Pop-up Alert Modal */}
      {popupInfo?.isOpen && (
        <div className="popup-alert-backdrop" onClick={() => setPopupInfo(null)} role="presentation">
          <div
            className="popup-alert-card"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="popup-icon-wrapper">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h3 className="popup-title">Invalid File Format</h3>

            <p className="popup-desc">
              <strong>&ldquo;{popupInfo.fileName}&rdquo;</strong> is not accepted for <strong>{popupInfo.deliverableName}</strong>.
            </p>

            <div className="popup-allowed-badge">
              <span>Strictly accepted: </span>
              <strong>{popupInfo.allowedList}</strong>
            </div>

            <p className="popup-hint">
              Please upload a valid <strong>{popupInfo.allowedList}</strong> file to continue.
            </p>

            <div className="popup-action-row">
              <button
                type="button"
                className="popup-confirm-btn"
                onClick={() => {
                  const pickerId = popupInfo.pickerId
                  setPopupInfo(null)
                  setTimeout(() => {
                    document.getElementById(pickerId)?.click()
                  }, 100)
                }}
              >
                Upload {popupInfo.allowedList}
              </button>
              <button
                type="button"
                className="popup-dismiss-btn"
                onClick={() => setPopupInfo(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
