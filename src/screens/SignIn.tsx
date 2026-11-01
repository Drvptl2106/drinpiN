// Sign in with an emailed 6-digit code (works inside the installed app, unlike email links),
// or with Google if it's turned on.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { config } from '../lib/config';

function friendly(message: string) {
  if (/rate limit|too many|security purposes/i.test(message)) return 'Too many tries. Wait a minute, then try again.';
  if (/expired|invalid|token/i.test(message)) return "That code didn't work. Check it, or send a new one.";
  if (/fetch|network/i.test(message)) return "Can't reach drinpiN right now. Check your internet connection.";
  return message;
}

export function SignIn() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (!wait) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  if (!supabase) return null;
  const client = supabase;
  const redirect = location.origin + location.pathname;

  async function sendCode() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter your email address.');
    setBusy(true);
    setError('');
    const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: redirect } });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    setStep('code');
    setWait(45);
  }

  async function verify() {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return setError('Enter the code from the email.');
    setBusy(true);
    setError('');
    const { error } = await client.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    setBusy(false);
    if (error) setError(friendly(error.message));
  }

  async function google() {
    setError('');
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } });
    if (error) setError(friendly(error.message));
  }

  if (step === 'code') {
    return (
      <form className="form" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
        <p style={{ margin: 0 }}>We emailed a code to <b>{email.trim()}</b>. Enter it below, or tap the link in the email.</p>
        <input
          className="input code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          aria-label="Sign-in code"
          autoFocus
        />
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
        <div className="btn-row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="link-btn" onClick={() => { setStep('email'); setCode(''); setError(''); }}>Use another email</button>
          <button type="button" className="link-btn" disabled={wait > 0 || busy} onClick={() => void sendCode()}>
            {wait > 0 ? `Resend in ${wait}s` : 'Send a new code'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
      <p style={{ margin: 0 }} className="muted">Back up your saves and see them on your phone and laptop. No password needed.</p>
      <input
        className="input"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email address"
        autoComplete="email"
        inputMode="email"
      />
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in code'}</button>
      {config.googleEnabled && (
        <button className="btn outline block" type="button" onClick={() => void google()}>
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" style={{ stroke: 'none' }}>
            <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
            <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" />
            <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" />
          </svg>
          Continue with Google
        </button>
      )}
    </form>
  );
}
