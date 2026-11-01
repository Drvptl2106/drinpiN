// One outfit in the grid.
import { Link } from 'react-router-dom';
import type { Outfit } from '../lib/types';
import { STATUS_LABELS } from '../lib/types';
import { Thumb } from './Thumb';

export function PinCard({ outfit }: { outfit: Outfit }) {
  const n = outfit.pieces.length;
  return (
    <Link className="pin" to={`/o/${outfit.id}`}>
      <div className="pin-media">
        <Thumb outfit={outfit} />
        {n === 0 && <span className="pin-flag">To sort</span>}
      </div>
      <div className="pin-body">
        <p className="pin-title">{outfit.title}</p>
        <p className="pin-meta">
          <span className={'dot ' + outfit.status} />
          {STATUS_LABELS[outfit.status]}
          {n > 0 && <> · {n} {n === 1 ? 'piece' : 'pieces'}</>}
        </p>
      </div>
    </Link>
  );
}
