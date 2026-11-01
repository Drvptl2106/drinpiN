// The first screen brand-new visitors see.
import { Link } from 'react-router-dom';
import { config } from '../lib/config';
import { WELCOMED_KEY } from '../app/startup';

const remember = () => {
  try { localStorage.setItem(WELCOMED_KEY, '1'); } catch { /* fine */ }
};

export function Welcome() {
  return (
    <div className="welcome">
      <div className="welcome-collage" aria-hidden="true">
        <div /><div /><div /><div /><div /><div />
      </div>
      <img src="icons/icon.svg" alt="" width={52} height={52} style={{ marginBottom: 18 }} />
      <h1>Save the look.<br /><b>Find the pieces.</b></h1>
      <p className="lead">
        Share outfits from Instagram to drinpiN, tag the kurti, the jeans, the jhumkas, and shop each one in a tap.
      </p>
      <div className="push">
        <Link className="btn primary block" to="/" replace onClick={remember}>Start saving</Link>
        {config.cloudEnabled && (
          <Link className="btn block" to="/me" replace onClick={remember}>I already have an account</Link>
        )}
      </div>
    </div>
  );
}
