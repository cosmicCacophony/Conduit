import { useEffect, useRef } from 'react'

import type { LogEntry } from '../../grid/types'

type TurnLogProps = {
  log: LogEntry[]
  hoveredEntryId: string | null
  onHoverEntry: (id: string | null) => void
}

export function TurnLog({ log, hoveredEntryId, onHoverEntry }: TurnLogProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [log])

  return (
    <div className="turn-log" ref={ref}>
      {log.slice(-30).map((entry) => {
        const hoverable = !!entry.detail
        const classes = [
          'turn-log__entry',
          hoverable ? 'turn-log__entry--hoverable' : '',
          hoveredEntryId === entry.id ? 'turn-log__entry--active' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div
            key={entry.id}
            className={classes}
            onMouseEnter={hoverable ? () => onHoverEntry(entry.id) : undefined}
            onMouseLeave={hoverable ? () => onHoverEntry(null) : undefined}
          >
            {entry.message}
          </div>
        )
      })}
    </div>
  )
}
