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
      <p className="screen-copy muted">The hush gathers close: "Stillness is also a kind of answer."</p>
      <p className="screen-copy muted">Each living creature heals 40% of its maximum HP.</p>
      <button className="primary-button" type="button" onClick={onContinue}>
        Breathe and continue
      </button>
    </section>
  )
}
