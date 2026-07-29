import { useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  DOMAIN_PRESENTATION,
  DIFFICULTIES,
  SAT_DOMAINS,
  type Difficulty,
  type SatDomain,
} from '../../progression/config.ts'
import {
  SCORE_SCREENSHOT_ACCEPT,
  ScoreParserError,
  serverScoreParser,
  type ParsedScoreResults,
  type ScoreParser,
  validateScoreScreenshot,
} from '../../progression/scoreParser.ts'
import { Character } from './Character.tsx'
import './adaptive.css'

type OnboardingProps = {
  onConfirm(
    results: Record<SatDomain, Difficulty>,
    screenshotName: string | null,
  ): void
  parser?: ScoreParser
  onCancel?: () => void
  replacingExisting?: boolean
}

type Stage = 'welcome' | 'ready' | 'parsing' | 'confirm' | 'invalid' | 'error'

const LEVEL_HELP: Record<Difficulty, string> = {
  Easy: 'Starts at Noobie',
  Medium: 'Starts at Adventurer',
  Hard: 'Starts at Master',
}

function isDifficulty(value: string | undefined): value is Difficulty {
  return DIFFICULTIES.some((difficulty) => difficulty === value)
}

function cleanParsedResults(results: ParsedScoreResults | undefined): ParsedScoreResults {
  const cleaned: ParsedScoreResults = {}
  for (const domain of SAT_DOMAINS) {
    const result = results?.[domain]
    if (isDifficulty(result)) cleaned[domain] = result
  }
  return cleaned
}

export function Onboarding({
  onConfirm,
  parser = serverScoreParser,
  onCancel,
  replacingExisting = false,
}: OnboardingProps) {
  const privacyId = useId()
  const requestIdRef = useRef(0)

  const [stage, setStage] = useState<Stage>('welcome')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [results, setResults] = useState<ParsedScoreResults>({})
  const [uncertainDomains, setUncertainDomains] = useState<SatDomain[]>([])
  const [notice, setNotice] = useState('')
  const [problem, setProblem] = useState('')

  const previewUrl = useMemo(
    () => (screenshot ? URL.createObjectURL(screenshot) : null),
    [screenshot],
  )

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )

  useEffect(
    () => () => {
      requestIdRef.current += 1
    },
    [],
  )

  const complete = SAT_DOMAINS.every((domain) => isDifficulty(results[domain]))

  async function parseScreenshot(file: File) {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setStage('parsing')
    setProblem('')
    setNotice('')

    try {
      const parsed = await parser.parse(file)
      if (requestId !== requestIdRef.current) return

      const cleaned = cleanParsedResults(parsed.results)
      const needsReview = new Set<SatDomain>(parsed.uncertainDomains ?? [])
      for (const domain of SAT_DOMAINS) {
        if (!cleaned[domain]) needsReview.add(domain)
      }

      setResults(cleaned)
      setUncertainDomains([...needsReview])
      setNotice(
        parsed.message ??
          (needsReview.size > 0
            ? 'We found part of your report. Check every result and fill in anything we could not read.'
            : 'We found all four results. Check them before continuing.'),
      )
      setStage('confirm')
    } catch (error) {
      if (requestId !== requestIdRef.current) return
      setProblem(
        error instanceof ScoreParserError
          ? error.message
          : 'We could not read that screenshot. You can try again, choose another image, or enter the four results manually.',
      )
      setStage('error')
    }
  }

  function chooseFile(file: File) {
    requestIdRef.current += 1
    const validationProblem = validateScoreScreenshot(file)
    if (validationProblem) {
      setScreenshot(null)
      setResults({})
      setUncertainDomains([])
      setProblem(validationProblem)
      setStage('invalid')
      return
    }

    setScreenshot(file)
    setResults({})
    setUncertainDomains([])
    setProblem('')
    setNotice('')
    setStage('ready')
  }

  function useManualEntry() {
    requestIdRef.current += 1
    setUncertainDomains([...SAT_DOMAINS])
    setNotice(
      screenshot
        ? 'Use your screenshot as a reference and choose the result shown for each domain.'
        : 'Choose the difficulty shown for each domain on your College Board report.',
    )
    setProblem('')
    setStage('confirm')
  }

  function changeResult(domain: SatDomain, value: string) {
    setResults((current) => {
      const next = { ...current }
      if (isDifficulty(value)) next[domain] = value
      else delete next[domain]
      return next
    })
    setUncertainDomains((current) => current.filter((item) => item !== domain))
  }

  function submitResults(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!complete) {
      setProblem('Choose a result for all four domains before continuing.')
      return
    }

    const confirmed = Object.fromEntries(
      SAT_DOMAINS.map((domain) => [domain, results[domain]]),
    ) as Record<SatDomain, Difficulty>
    onConfirm(confirmed, screenshot?.name ?? null)
  }

  return (
    <main className="adaptive-onboarding app-shell">
      <header className="app-header">
        <span className="wordmark">
          clarity<span>.</span>
        </span>
        {onCancel ? (
          <button className="link-button" type="button" onClick={onCancel}>
            ← Back to dashboard
          </button>
        ) : (
          <span className="adaptive-header-note">Adaptive SAT practice</span>
        )}
      </header>

      {stage === 'welcome' && (
        <section className="adaptive-welcome" aria-labelledby="adaptive-welcome-title">
          <div className="adaptive-welcome__copy">
            <p className="eyebrow">Your training starts here</p>
            <h1 id="adaptive-welcome-title">
              {replacingExisting
                ? 'Upload a new score report.'
                : 'Turn your score report into your next adventure.'}
            </h1>
            <p className="adaptive-lede">
              {replacingExisting
                ? 'Choose a new College Board Knowledge and Skills screenshot. Your saved path will stay unchanged until you review and confirm all four results.'
                : 'Upload a screenshot of your College Board Knowledge and Skills results. Clarity will check all four domains, suggest the best place to begin, and build a practice path around you.'}
            </p>

            {!replacingExisting && (
              <div className="adaptive-how-it-works" role="note">
                <strong>How Clarity works</strong>
                <span>1. Read your four score bands</span>
                <span>2. Run a full domain diagnostic</span>
                <span>3. Teach, practice, and review one skill at a time</span>
              </div>
            )}

            <div className="adaptive-welcome-actions">
              <UploadControl
                label="Upload SAT score screenshot"
                onFile={chooseFile}
                privacyDescriptionId={privacyId}
              />
              <button
                className="adaptive-text-button"
                type="button"
                onClick={useManualEntry}
              >
                Don’t have a screenshot? Enter results manually
              </button>
              <div className="upload-example">
                <div className="upload-example__report" aria-hidden="true">
                  <div className="upload-example__bar">Knowledge and Skills</div>
                  {SAT_DOMAINS.map((domain, index) => (
                    <div className="upload-example__row" key={domain}>
                      <span>{DOMAIN_PRESENTATION[domain].shortName}</span>
                      <i style={{ width: `${52 + index * 10}%` }} />
                      <b>{index < 2 ? 'Medium' : 'Hard'}</b>
                    </div>
                  ))}
                </div>
                <div className="upload-example__copy">
                  <strong>Upload a screenshot like this</strong>
                  <span>Show the full “Knowledge and Skills” section with all four domain labels and their Easy, Medium, or Hard bands.</span>
                  <small>Crop out your name, school, QR code, and student ID.</small>
                </div>
              </div>
            </div>
          </div>

          <div className="adaptive-welcome-party" aria-label="Four SAT domain characters">
            {SAT_DOMAINS.map((domain) => (
              <div className="adaptive-welcome-character" key={domain}>
                <Character domain={domain} stage="Noobie" />
                <span>{DOMAIN_PRESENTATION[domain].shortName}</span>
              </div>
            ))}
          </div>

          <ol className="adaptive-welcome-steps" aria-label="How score setup works">
            <li>
              <span>1</span>
              <strong>Upload</strong>
              <small>Choose your score screenshot.</small>
            </li>
            <li>
              <span>2</span>
              <strong>Analyze</strong>
              <small>Check the four domain results.</small>
            </li>
            <li>
              <span>3</span>
              <strong>Diagnose</strong>
              <small>Take the full quiz before skill practice.</small>
            </li>
          </ol>

          <PrivacyNote id={privacyId} />
        </section>
      )}

      {stage === 'ready' && screenshot && previewUrl && (
        <section
          className="adaptive-upload-review"
          aria-labelledby="adaptive-upload-review-title"
        >
          <div className="adaptive-upload-review__heading">
            <p className="eyebrow">Screenshot ready</p>
            <h1 id="adaptive-upload-review-title">Ready to check your four domains?</h1>
            <p>
              Make sure the Knowledge and Skills section is visible. Analysis will never
              save the image in Clarity, and you’ll confirm every result before your path
              begins. Crop out your name, school, student ID, QR code, and other identifying
              details first.
            </p>
          </div>

          <div className="adaptive-upload-review__card">
            <figure className="adaptive-upload-review__preview">
              <img src={previewUrl} alt="Preview of the selected SAT score screenshot" />
              <figcaption>
                <strong>{screenshot.name}</strong>
                <span>{formatFileSize(screenshot.size)}</span>
              </figcaption>
            </figure>

            <div className="adaptive-upload-review__actions">
              <div className="adaptive-analysis-summary">
                <span className="adaptive-analysis-summary__icon" aria-hidden="true">✓</span>
                <div>
                  <strong>Image uploaded</strong>
                  <p>Next, check it for Easy, Medium, or Hard in all four domains.</p>
                </div>
              </div>
              <button
                className="button adaptive-analyze-button"
                type="button"
                onClick={() => void parseScreenshot(screenshot)}
              >
                Analyze score screenshot
                <span aria-hidden="true">→</span>
              </button>
              <UploadControl
                compact
                label="Choose a different image"
                onFile={chooseFile}
                privacyDescriptionId={privacyId}
              />
              <button
                className="adaptive-text-button"
                type="button"
                onClick={useManualEntry}
              >
                Skip analysis and enter results manually
              </button>
            </div>
          </div>

          <PrivacyNote id={privacyId} />
        </section>
      )}

      {stage === 'parsing' && (
        <section
          className="adaptive-state-card"
          aria-labelledby="adaptive-parsing-title"
          aria-live="polite"
          aria-busy="true"
          role="status"
        >
          <div className="adaptive-spinner" aria-hidden="true" />
          <p className="eyebrow">Reading your report</p>
          <h1 id="adaptive-parsing-title">Checking all four domains…</h1>
          <p>
            We’ll always ask you to confirm the results before they become your starting
            levels.
          </p>
          <button className="adaptive-text-button" type="button" onClick={useManualEntry}>
            Enter the results manually instead
          </button>
        </section>
      )}

      {stage === 'invalid' && (
        <section
          className="adaptive-state-card adaptive-state-card--problem"
          aria-labelledby="adaptive-invalid-title"
        >
          <p className="eyebrow">That file won’t work</p>
          <h1 id="adaptive-invalid-title">Choose another screenshot.</h1>
          <p role="alert">{problem}</p>
          <div className="adaptive-state-actions">
            <UploadControl
              compact
              label="Choose another image"
              onFile={chooseFile}
              privacyDescriptionId={privacyId}
            />
            <button className="adaptive-text-button" type="button" onClick={useManualEntry}>
              Enter results manually
            </button>
          </div>
          <PrivacyNote id={privacyId} />
        </section>
      )}

      {stage === 'error' && (
        <section
          className="adaptive-state-card adaptive-state-card--problem"
          aria-labelledby="adaptive-error-title"
        >
          <p className="eyebrow">We hit a snag</p>
          <h1 id="adaptive-error-title">Your report is still yours to enter.</h1>
          <p role="alert">{problem}</p>
          <div className="adaptive-state-actions">
            {screenshot && (
              <button
                className="button"
                type="button"
                onClick={() => void parseScreenshot(screenshot)}
              >
                Try reading it again
              </button>
            )}
            <UploadControl
              compact
              label="Choose another image"
              onFile={chooseFile}
              privacyDescriptionId={privacyId}
            />
            <button className="adaptive-text-button" type="button" onClick={useManualEntry}>
              Enter results manually
            </button>
          </div>
          <PrivacyNote id={privacyId} />
        </section>
      )}

      {stage === 'confirm' && (
        <section className="adaptive-confirm" aria-labelledby="adaptive-confirm-title">
          <div className="adaptive-confirm-heading">
            <p className="eyebrow">Confirm your starting point</p>
            <h1 id="adaptive-confirm-title">What did your report show?</h1>
            <p>
              These results set the first level for each character. You’ll still be free to
              practice any domain.
            </p>
          </div>

          <div
            className="adaptive-notice"
            role="status"
            aria-live="polite"
          >
            <strong>{screenshot ? screenshot.name : 'Manual entry'}</strong>
            <span>{notice}</span>
          </div>

          <div className={`adaptive-confirm-layout ${previewUrl ? '' : 'adaptive-confirm-layout--solo'}`}>
            {previewUrl && (
              <aside className="adaptive-preview" aria-label="Uploaded screenshot">
                <img src={previewUrl} alt="Preview of the uploaded score report" />
                <div className="adaptive-preview-copy">
                  <span>Keep the report open as a reference.</span>
                  <UploadControl
                    compact
                    label="Use a different image"
                    onFile={chooseFile}
                    privacyDescriptionId={privacyId}
                  />
                </div>
              </aside>
            )}

            <form className="adaptive-results-form" onSubmit={submitResults}>
              <fieldset>
                <legend className="adaptive-visually-hidden">
                  College Board difficulty result for each SAT domain
                </legend>
                <div className="adaptive-result-grid">
                  {SAT_DOMAINS.map((domain, index) => {
                    const selectId = `adaptive-domain-${index}`
                    const uncertain = uncertainDomains.includes(domain)
                    return (
                      <label
                        className={`adaptive-result-field ${uncertain ? 'adaptive-result-field--check' : ''}`}
                        htmlFor={selectId}
                        key={domain}
                      >
                        <span className="adaptive-result-name">{domain}</span>
                        {uncertain && (
                          <span className="adaptive-check-label">Check this result</span>
                        )}
                        <select
                          id={selectId}
                          value={results[domain] ?? ''}
                          onChange={(event) => changeResult(domain, event.target.value)}
                          required
                        >
                          <option value="">Choose Easy, Medium, or Hard</option>
                          {DIFFICULTIES.map((difficulty) => (
                            <option key={difficulty} value={difficulty}>
                              {difficulty} — {LEVEL_HELP[difficulty]}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {problem && (
                <p className="adaptive-inline-error" role="alert">
                  {problem}
                </p>
              )}

              {replacingExisting && (
                <div className="adaptive-replace-warning" role="note">
                  <strong>This starts a new adaptive path.</strong>
                  <span>
                    Confirming will reset character, skill, remediation, and checkpoint
                    progress for all four domains. Your current path stays safe until then.
                  </span>
                </div>
              )}

              <div className="adaptive-confirm-actions">
                <button className="button adaptive-confirm-button" type="submit" disabled={!complete}>
                  {replacingExisting
                    ? 'Replace report and start new path →'
                    : 'Confirm and see my path →'}
                </button>
                {!screenshot && (
                  <UploadControl
                    compact
                    label="Add a screenshot instead"
                    onFile={chooseFile}
                    privacyDescriptionId={privacyId}
                  />
                )}
              </div>
            </form>
          </div>

          <PrivacyNote id={privacyId} />
        </section>
      )}
    </main>
  )
}

type UploadControlProps = {
  label: string
  onFile: (file: File) => void
  privacyDescriptionId: string
  compact?: boolean
}

function UploadControl({
  label,
  onFile,
  privacyDescriptionId,
  compact = false,
}: UploadControlProps) {
  const inputId = useId()
  const helpId = useId()

  return (
    <label
      className={`adaptive-upload ${compact ? 'adaptive-upload--compact' : ''}`}
      htmlFor={inputId}
    >
      <input
        id={inputId}
        type="file"
        accept={SCORE_SCREENSHOT_ACCEPT}
        aria-describedby={`${helpId} ${privacyDescriptionId}`}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) onFile(file)
        }}
      />
      <span className="adaptive-upload-icon" aria-hidden="true">↑</span>
      <span className="adaptive-upload-copy">
        <strong>{label}</strong>
        <small id={helpId}>PNG, JPEG, or WebP · up to 10 MB</small>
      </span>
    </label>
  )
}

function PrivacyNote({ id }: { id: string }) {
  return (
    <p className="adaptive-privacy" id={id}>
      <span aria-hidden="true">◉</span>
      Clarity uses AI to read the screenshot. It is sent securely to OpenAI for analysis
      and is not saved by Clarity. Crop out personal details first. Only the four results
      you confirm become part of your progress.
    </p>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
