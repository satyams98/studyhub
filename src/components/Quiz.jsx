import { useState } from 'react'

export default function Quiz({ question, options, explanation }) {
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)

  if (!question || !options?.length) return null

  const handleSelect = (idx) => {
    if (revealed) return
    setSelected(idx)
  }

  const handleCheck = () => {
    if (selected === null) return
    setRevealed(true)
  }

  const correctIdx = options.findIndex(o => o.correct)

  return (
    <div className="quiz-block">
      <div className="quiz-label">CONCEPT CHECK</div>
      <p className="quiz-question">{question}</p>
      <div className="quiz-options">
        {options.map((opt, i) => {
          let cls = 'quiz-option'
          if (selected === i && !revealed) cls += ' selected'
          if (revealed && i === correctIdx) cls += ' correct'
          if (revealed && selected === i && i !== correctIdx) cls += ' incorrect'
          return (
            <button key={i} className={cls} onClick={() => handleSelect(i)}>
              <span className="quiz-option-letter">{String.fromCharCode(65 + i)}</span>
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>
      {!revealed && (
        <button className="quiz-check-btn" onClick={handleCheck} disabled={selected === null}>
          Check Answer
        </button>
      )}
      {revealed && explanation && (
        <div className={`quiz-explanation ${selected === correctIdx ? 'correct' : 'incorrect'}`}>
          <strong>{selected === correctIdx ? 'Correct!' : 'Not quite.'}</strong> {explanation}
        </div>
      )}
    </div>
  )
}
