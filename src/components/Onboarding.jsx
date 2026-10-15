import { useState } from 'react';
import { useData } from '../data/DataProvider.jsx';
import { todayKey } from '../lib/dates.js';

export default function Onboarding() {
  const data = useData();
  const today = todayKey();
  const [name, setName] = useState(data.name || '');
  const [last, setLast] = useState('');
  const [prev1, setPrev1] = useState('');
  const [prev2, setPrev2] = useState('');
  const [periodLength, setPeriodLength] = useState(5);
  const [cycleLength, setCycleLength] = useState(28);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!last) return setErr('Please enter when your last period started.');
    setBusy(true);
    try {
      await data.actions.completeOnboarding({
        name: name.trim(),
        settings: { periodLength: Number(periodLength) || 5, cycleLength: Number(cycleLength) || 28 },
        starts: [prev2, prev1, last],
      });
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  return (
    <div className="center-screen">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand"><img src="./icon.svg" alt="" /> Luna</div>
        <div>
          <h2>Let&apos;s set up your cycle</h2>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Estimates are fine. Luna recalibrates with every period you log.
          </p>
        </div>
        <div className="field">
          <label htmlFor="n">Your name</label>
          <input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="last">When did your last period start?</label>
          <input id="last" className="input" type="date" max={today} value={last} onChange={(e) => setLast(e.target.value)} required />
        </div>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="pl">Period usually lasts (days)</label>
            <input id="pl" className="input" type="number" min={1} max={12} value={periodLength} onChange={(e) => setPeriodLength(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cl">Cycle usually lasts (days)</label>
            <input id="cl" className="input" type="number" min={18} max={60} value={cycleLength} onChange={(e) => setCycleLength(e.target.value)} />
          </div>
        </div>
        <details>
          <summary className="label" style={{ cursor: 'pointer' }}>Remember earlier periods? (optional, gives better first predictions)</summary>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
            <div className="field">
              <label htmlFor="p1">The one before</label>
              <input id="p1" className="input" type="date" max={last || today} value={prev1} onChange={(e) => setPrev1(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="p2">And before that</label>
              <input id="p2" className="input" type="date" max={prev1 || today} value={prev2} onChange={(e) => setPrev2(e.target.value)} />
            </div>
          </div>
        </details>
        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={busy}>Start tracking</button>
      </form>
    </div>
  );
}
