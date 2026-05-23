import { useEffect, useRef } from 'react'

type TurnLogProps = {
  log: string[]
}

export function TurnLog({ log }: TurnLogProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [log])

  return (
    <div className="turn-log" ref={ref}>
      {log.slice(-30).map((entry, i) => (
        <div key={i} className="turn-log__entry">
          {entry}
        </div>
      ))}
    </div>
  )
}
