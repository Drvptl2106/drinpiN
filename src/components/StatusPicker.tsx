import { STATUSES, STATUS_LABELS, type Status } from '../lib/types';

export function StatusPicker({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Status">
      {STATUSES.map((s) => (
        <button key={s} type="button" aria-pressed={value === s} onClick={() => onChange(s)}>
          <span className={'dot ' + s} />
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
