import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { MessageSquareText, X } from 'lucide-react'

import { useAuthProfile } from '../../auth/AuthContext.tsx'
import { FEEDBACK_MAX_LENGTH, sendFeedback } from './feedback.ts'
import './feedback.css'

/** Header button that opens a small "Send feedback" dialog. */
export function FeedbackButton({ view }: { view: string }) {
  const { email, displayName, profileId, isLocal } = useAuthProfile()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<'cloud' | 'device' | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()

  function close() {
    setOpen(false)
    setError(null)
    if (sent) {
      setSent(null)
      setMessage('')
    }
  }

  useEffect(() => {
    if (!open) return
    textareaRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // close() only reads `sent`, which is re-bound each render the dialog is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sent])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result = await sendFeedback({
      message,
      view,
      userId: isLocal ? null : profileId ?? null,
      email,
      displayName,
    })
    setBusy(false)
    if (result.ok) setSent(result.saved)
    else setError(result.error)
  }

  return (
    <>
      <button
        className="feedback-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-ui-sound="true"
        data-ui-sound-hover="hover"
        data-ui-sound-click="open"
      >
        <MessageSquareText size={17} strokeWidth={1.6} absoluteStrokeWidth aria-hidden="true" />
        <span>Feedback</span>
      </button>

      {open && (
        <div
          className="feedback-scrim"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header>
              <h2 id={titleId}>Send feedback</h2>
              <button className="feedback-close" type="button" onClick={close} aria-label="Close">
                <X size={18} strokeWidth={1.6} absoluteStrokeWidth aria-hidden="true" />
              </button>
            </header>

            {sent ? (
              <div className="feedback-done" role="status">
                <strong>Thank you. We got it.</strong>
                <p>
                  {sent === 'cloud'
                    ? 'Your note is on its way to the Clarity team.'
                    : 'Your note is saved on this device. Sign in to send it to the Clarity team.'}
                </p>
                <button className="feedback-send" type="button" onClick={close}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <label htmlFor={`${titleId}-text`}>Describe the issue</label>
                <textarea
                  id={`${titleId}-text`}
                  ref={textareaRef}
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value)
                    setError(null)
                  }}
                  maxLength={FEEDBACK_MAX_LENGTH}
                  rows={6}
                  placeholder="What happened, and what did you expect?"
                />
                <p className="feedback-note">
                  This report will include your description and details about where you were in Clarity
                  (the page and your browser). We may use these to fix problems and improve Clarity.
                </p>
                {error && (
                  <p className="feedback-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="feedback-actions">
                  <button className="feedback-cancel" type="button" onClick={close}>
                    Cancel
                  </button>
                  <button className="feedback-send" type="submit" disabled={busy || !message.trim()}>
                    {busy ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  )
}
