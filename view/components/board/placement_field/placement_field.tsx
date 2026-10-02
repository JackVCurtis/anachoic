import { useId } from 'react'
import { PLACEMENT_OPTIONS, type Placement } from '../../helpers/follow_up'
import { joinClasses } from '../../helpers/join_classes'
import { done } from '../../helpers/strings'
import { SectionHeader } from '../../patterns/section_header/section_header'
import styles from './placement_field.module.css'

export interface PlacementFieldProps {
  placement: Placement
  disabled?: boolean
  onChange: (placement: Placement) => void
}

/**
 * Where in the Queue a follow-up puts its task: "Back", then "Front". Native
 * radios drawn as two segments, so the pair is one tab stop and the arrow
 * keys choose.
 */
export function PlacementField({ placement, disabled = false, onChange }: PlacementFieldProps) {
  const name = useId()

  return (
    <fieldset disabled={disabled} className={styles.field}>
      <SectionHeader level="label" accent element="legend" title={done.placementLabel} />
      <div className={styles.options}>
        {PLACEMENT_OPTIONS.map((option) => (
          <label key={option.placement} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={option.placement}
              checked={placement === option.placement}
              onChange={() => onChange(option.placement)}
              className={styles.input}
            />
            <span className={joinClasses('text-control', styles.label)}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
