import { useEffect, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'

interface DocxViewerProps {
  url: string
  fileName: string
  downloadUrl: string
  fileSize?: number | null
}
export default function DocxViewer({ url, fileName, downloadUrl }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    isMountedRef.current = true

    async function renderDocx() {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch file`)
        const blob = await res.blob()

        if (!isMountedRef.current || !containerRef.current) return

        containerRef.current.innerHTML = ''
        await renderAsync(blob, containerRef.current, undefined, {
          className: 'docx-page',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          experimental: true,
        })

        if (isMountedRef.current) {
          setStatus('success')
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setErrorMessage(err instanceof Error ? err.message : 'Unable to render Word document.')
          setStatus('error')
        }
      }
    }

    renderDocx()

    return () => {
      isMountedRef.current = false
    }
  }, [url])

  if (status === 'error') {
    return (
      <div className="doc-preview-placeholder">
        <div className="doc-icon-badge blue">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        </div>
        <h4>Microsoft Word Document</h4>
        <p className="doc-hint">
          {errorMessage || 'Unable to preview this document in-browser.'} You can download the file to view it in Microsoft Word or Google Docs.
        </p>
        <div className="doc-action-cta">
          <a href={downloadUrl} className="primary-cta-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download {fileName}</span>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="docx-scroll-viewport">
      {status === 'loading' && (
        <div className="docx-loading-overlay">
          <div className="admin-spinner" />
          <p className="docx-loading-text">Rendering Word Document...</p>
        </div>
      )}
      <div
        ref={containerRef}
        className="docx-render-target"
        style={{ opacity: status === 'loading' ? 0 : 1 }}
      />
    </div>
  )
}