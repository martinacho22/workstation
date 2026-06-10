import { useState, useRef, useEffect } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './GrillModal.module.css'

interface Props {
  onClose: () => void
}

type Phase = 'idea' | 'grilling' | 'ready' | 'generating'

export default function GrillModal({ onClose }: Props) {
  const {
    project, grillLoading, grillQuestion, grillAnswers,
    startGrill, answerGrill, finishGrill, generateBlueprint,
    blueprintLoading, blueprintError,
  } = useWorkstationStore()

  const [phase, setPhase] = useState<Phase>('idea')
  const [idea, setIdeaText] = useState(project?.description ?? '')
  const [answer, setAnswer] = useState('')
  const answerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (phase === 'grilling' && !grillLoading) {
      answerRef.current?.focus()
    }
  }, [phase, grillLoading, grillQuestion])

  async function handleStartGrill() {
    if (!idea.trim()) return
    setPhase('grilling')
    await startGrill(idea.trim())
  }

  async function handleAnswer(useRecommendation = false) {
    const rec = grillQuestion?.split('\n\nRecommendation: ')[1]
    const finalAnswer = useRecommendation && rec ? rec : answer.trim()
    if (!finalAnswer) return
    setAnswer('')
    await answerGrill(finalAnswer)
  }

  function handleFinishEarly() {
    finishGrill()
    setPhase('ready')
  }

  async function handleGenerate() {
    setPhase('generating')
    finishGrill()
    await generateBlueprint()
    onClose()
  }

  const questionText = grillQuestion?.split('\n\nRecommendation:')[0] ?? ''
  const recommendation = grillQuestion?.includes('\n\nRecommendation:')
    ? grillQuestion.split('\n\nRecommendation: ')[1]
    : null

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Idea phase */}
        {phase === 'idea' && (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>Plan your project</h2>
              <p className={styles.subtitle}>
                Before generating a blueprint, Claude will interview you to reach a shared understanding.
                No assumptions. No wasted sections.
              </p>
            </div>

            <div className={styles.body}>
              <label className={styles.label}>What are you building?</label>
              <textarea
                className={styles.textarea}
                placeholder="Describe your project — what it does, who it's for, what problem it solves. Don't overthink it."
                value={idea}
                onChange={e => setIdeaText(e.target.value)}
                autoFocus
                rows={5}
              />
            </div>

            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button
                className={styles.primaryBtn}
                onClick={handleStartGrill}
                disabled={!idea.trim()}
              >
                Start planning
              </button>
            </div>
          </>
        )}

        {/* Grilling phase */}
        {phase === 'grilling' && (
          <>
            <div className={styles.header}>
              <div className={styles.grillProgress}>
                {grillAnswers.map((_, i) => (
                  <div key={i} className={styles.grillDot} />
                ))}
                {grillLoading && <div className={`${styles.grillDot} ${styles.grillDotPending}`} />}
              </div>
              <h2 className={styles.title}>
                {grillLoading ? 'Thinking...' : 'Question ' + (grillAnswers.length + 1)}
              </h2>
              <p className={styles.subtitle}>
                Answer each question to align Claude with your project before it builds the plan.
              </p>
            </div>

            {grillLoading ? (
              <div className={styles.thinking}>
                <span className={styles.thinkingDots}>●●●</span>
              </div>
            ) : grillQuestion ? (
              <div className={styles.body}>
                <div className={styles.question}>{questionText}</div>

                {recommendation && (
                  <div className={styles.recommendation}>
                    <span className={styles.recLabel}>Recommendation</span>
                    <span className={styles.recText}>{recommendation}</span>
                  </div>
                )}

                <input
                  ref={answerRef}
                  className={styles.answerInput}
                  placeholder="Your answer..."
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAnswer()}
                />
              </div>
            ) : null}

            <div className={styles.footer}>
              <button className={styles.skipBtn} onClick={handleFinishEarly}>
                Skip to blueprint
              </button>
              <div className={styles.footerRight}>
                {recommendation && (
                  <button
                    className={styles.recBtn}
                    onClick={() => handleAnswer(true)}
                    disabled={grillLoading}
                  >
                    Use recommendation
                  </button>
                )}
                <button
                  className={styles.primaryBtn}
                  onClick={() => handleAnswer()}
                  disabled={grillLoading || !answer.trim()}
                >
                  {grillAnswers.length >= 5 ? 'Answer & finish' : 'Answer'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Ready phase */}
        {(phase === 'ready' || (phase === 'grilling' && grillAnswers.length >= 6 && !grillLoading && !grillQuestion)) && (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>Ready to blueprint</h2>
              <p className={styles.subtitle}>
                {grillAnswers.length} questions answered. Claude now has enough context to generate a focused, accurate blueprint.
              </p>
            </div>

            <div className={styles.body}>
              <div className={styles.answerSummary}>
                {grillAnswers.map((qa, i) => (
                  <div key={i} className={styles.qaSummaryItem}>
                    <div className={styles.qaSummaryQ}>{qa.question}</div>
                    <div className={styles.qaSummaryA}>{qa.answer}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.footer}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button
                className={styles.primaryBtn}
                onClick={handleGenerate}
                disabled={blueprintLoading}
              >
                {blueprintLoading ? 'Generating...' : 'Generate blueprint'}
              </button>
            </div>

            {blueprintError && (
              <div className={styles.error}>{blueprintError}</div>
            )}
          </>
        )}

        {/* Generating phase */}
        {phase === 'generating' && (
          <div className={styles.generatingState}>
            <div className={styles.generatingTitle}>Building blueprint...</div>
            <div className={styles.generatingDesc}>
              Claude is generating sections based on your answers. Sections will appear on the canvas.
            </div>
            <span className={styles.thinkingDots}>●●●</span>
          </div>
        )}

      </div>
    </div>
  )
}
