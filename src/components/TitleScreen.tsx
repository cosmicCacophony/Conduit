type TitleScreenProps = {
  onStart: () => void
}

export function TitleScreen({ onStart }: TitleScreenProps) {
  return (
    <section className="screen screen--title">
      <p className="eyebrow">A quiet island. A strange pull.</p>
      <h1>Conduit</h1>
      <p className="lede">
        You wake on a silent shore. Creatures gather close, as though they have been
        waiting for you.
      </p>
      <button className="primary-button" type="button" onClick={onStart}>
        Begin
      </button>
    </section>
  )
}
