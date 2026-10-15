import { useState } from 'react';
import { useData } from '../data/DataProvider.jsx';

const friendly = (e) => {
  const code = e?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email or password is incorrect.';
  if (code.includes('email-already-in-use')) return 'An account with this email already exists. Sign in instead.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('invalid-email')) return 'That email address looks wrong.';
  if (code.includes('network')) return 'No connection. Check your internet and try again.';
  return e?.message || 'Something went wrong.';
};

function useAsync() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(friendly(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, setErr, run };
}

export function AuthScreen() {
  const { actions } = useData();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [info, setInfo] = useState('');
  const { busy, err, run } = useAsync();

  const submit = (e) => {
    e.preventDefault();
    run(() => (mode === 'signin' ? actions.signIn(email.trim(), pw) : actions.signUp(email.trim(), pw, name.trim())));
  };

  return (
    <div className="center-screen">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand"><img src="./icon.svg" alt="" /> Luna</div>
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>Cycle tracking, shared with the person you choose.</p>
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" className="input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        {err && <div className="error">{err}</div>}
        {info && <div className="notice">{info}</div>}
        <button className="btn primary" disabled={busy}>{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'Create an account' : 'I already have an account'}
          </button>
          {mode === 'signin' && (
            <button
              type="button"
              className="btn link"
              onClick={() => run(async () => {
                if (!email) throw new Error('Enter your email first.');
                await actions.resetPassword(email.trim());
                setInfo('Password reset email sent.');
              })}
            >
              Forgot password?
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function RoleScreen() {
  const data = useData();
  const [role, setRole] = useState(null);
  const [name, setName] = useState(data.user?.displayName || '');
  const { busy, err, run } = useAsync();

  return (
    <div className="center-screen">
      <div className="card auth-card">
        <div className="brand"><img src="./icon.svg" alt="" /> Luna</div>
        <h2 style={{ textAlign: 'center' }}>How will you use Luna?</h2>
        <div className="role-options">
          <button className="role-option" aria-pressed={role === 'tracker'} onClick={() => setRole('tracker')}>
            <b>I&apos;m tracking my cycle</b>
            <span className="muted small">Log periods, PMS and symptoms. Get personal predictions and choose what to share.</span>
          </button>
          <button className="role-option" aria-pressed={role === 'partner'} onClick={() => setRole('partner')}>
            <b>I&apos;m the partner</b>
            <span className="muted small">See her status and predictions with a code she gives you. View only.</span>
          </button>
        </div>
        <div className="field">
          <label htmlFor="rn">Your name</label>
          <input id="rn" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={!role || busy} onClick={() => run(() => data.actions.chooseRole(role, name.trim()))}>
          Continue
        </button>
        <button className="btn link" onClick={data.actions.signOut}>Sign out</button>
      </div>
    </div>
  );
}

export function JoinScreen() {
  const data = useData();
  const [code, setCode] = useState('');
  const { busy, err, run } = useAsync();
  return (
    <div className="center-screen">
      <form
        className="card auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => data.actions.joinWithCode(code));
        }}
      >
        <div className="brand"><img src="./icon.svg" alt="" /> Luna</div>
        <h2 style={{ textAlign: 'center' }}>Connect to her calendar</h2>
        <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>
          She can create a code in Luna under Settings → Partner sharing.
        </p>
        <input
          className="input code"
          style={{ textAlign: 'center', fontSize: 26 }}
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          aria-label="Invite code"
          required
        />
        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={busy || code.length < 6}>Connect</button>
        <button type="button" className="btn link" onClick={data.actions.signOut}>Sign out</button>
      </form>
    </div>
  );
}
