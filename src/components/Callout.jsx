export default function Callout({ label, text, tone = 'accent' }) {
  if (!text) return null
  return (
    <div className={`callout${tone === 'green' ? ' green' : ''}`}>
      <div className="callout-label">{label}</div>
      <div className="callout-text">{text}</div>
    </div>
  )
}
