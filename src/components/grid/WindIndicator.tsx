import type { WindDirection } from '../../grid/types'

type WindIndicatorProps = {
  current: WindDirection
  upcoming: WindDirection[]
}

const ARROWS: Record<WindDirection, string> = {
  north: '↑',
  east: '→',
  south: '↓',
  west: '←',
}

export function WindIndicator({ current, upcoming }: WindIndicatorProps) {
  return (
    <div className="wind-indicator">
      <span className="wind-indicator__label">Wind</span>
      <span className="wind-indicator__current">
        <span className="wind-indicator__arrow wind-indicator__arrow--current">
          {ARROWS[current]}
        </span>
        <span className="wind-indicator__direction">{current}</span>
      </span>
      <span className="wind-indicator__upcoming">
        {upcoming.map((dir, idx) => (
          <span key={idx} className="wind-indicator__future" title={`${idx + 1} turns ahead`}>
            {ARROWS[dir]}
          </span>
        ))}
      </span>
    </div>
  )
}
