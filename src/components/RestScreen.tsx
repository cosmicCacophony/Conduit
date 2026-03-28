type RestScreenProps = {
  encounterText: string
  onContinue: () => void
}

export function RestScreen({ encounterText, onContinue }: RestScreenProps) {
  return (
    <section className="screen">
      <p className="eyebrow">Rest</p>
      <h2>A little stillness</h2>
      <p className="screen-copy">{encounterText}</p>
      <p className="screen-copy muted">All creatures heal 40% of their maximum HP.</p>
      <button className="primary-button" type="button" onClick={onContinue}>
        Breathe and continue
      </button>
    </section>
  )
}
