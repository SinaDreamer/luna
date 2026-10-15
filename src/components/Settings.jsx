import { useRef, useState } from 'react';
import { useData } from '../data/DataProvider.jsx';
import { remindersOn, remindersSupported, setReminders } from '../lib/reminders.js';
import { todayKey } from '../lib/dates.js';
import { Switch } from './ui.jsx';

function NumberSetting({ label, value, min, max, onSave }) {
  const [v, setV] = useState(String(value));
  const commit = () => {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n >= min && n <= max) onSave(n);
    else setV(String(value));
  };
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" type="number" min={min} max={max} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
    </div>
  );
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Settings() {
  const data = useData();
  const { actions, settings, sharing } = data;
  const isPartner = data.role === 'partner';
  const synced = data.mode === 'firebase';
  const [name, setName] = useState(data.name || '');
  const [reminders, setRemindersState] = useState(remindersOn);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const run = async (fn) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onImport = (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    f.text().then((t) =>
      run(async () => {
        const parsed = JSON.parse(t);
        if (!parsed.days) throw new Error('This file is not a Luna export.');
        await actions.importData(parsed);
        setMsg(`Imported ${Object.keys(parsed.days).length} days.`);
      }),
    );
    ev.target.value = '';
  };

  return (
    <div className="page">
      <h1>Settings</h1>
      {msg && <div className="notice">{msg}</div>}

      <div className="grid-2">
        <div className="card">
          <h3>Profile</h3>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== data.name && actions.saveName(name.trim())} />
          </div>
          {synced && (
            <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
              <span className="muted small">Signed in as {data.email}</span>
              <button className="btn" onClick={actions.signOut}>Sign out</button>
            </div>
          )}
        </div>

        <div className="card">
          <h3>{isPartner ? 'Linked account' : 'Partner sharing'}</h3>
          {!synced ? (
            <div className="notice">
              Luna is running in local mode on this device. To share with your partner, connect a free Firebase project
              (see <b>README.md</b>, about 5 minutes), then sign in on both devices.
            </div>
          ) : isPartner ? (
            <>
              <p style={{ marginTop: 0 }}>
                Following <b>{data.partnerName || 'her'}</b>. She decides what is shared with you.
              </p>
              <button className="btn danger" disabled={busy} onClick={() => confirm('Stop following her cycle?') && run(actions.leaveCouple)}>
                Unlink
              </button>
            </>
          ) : data.partnerLinked ? (
            <>
              <p style={{ marginTop: 0 }}>
                Shared with <b>{data.partnerName || 'your partner'}</b>. They see predictions and your status, never raw logs or notes.
              </p>
              <button className="btn danger" disabled={busy} onClick={() => confirm('Stop sharing with your partner?') && run(actions.unlinkPartner)}>
                Stop sharing
              </button>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>Create a code, then have your partner choose &quot;I&apos;m the partner&quot; in Luna and enter it.</p>
              {data.inviteCode && <div className="code" style={{ marginBottom: 12 }}>{data.inviteCode}</div>}
              <button className="btn primary" disabled={busy} onClick={() => run(actions.createInvite)}>
                {data.inviteCode ? 'New code' : 'Create invite code'}
              </button>
            </>
          )}
        </div>
      </div>

      {!isPartner && synced && (
        <div className="card">
          <h3>What your partner can see</h3>
          <Switch label="Period predictions and status" hint="Always shared. This is what the partner view is for." checked disabled onChange={() => {}} />
          <Switch label="Fertile window and ovulation" checked={sharing.fertility} onChange={(v) => actions.saveSharing({ fertility: v })} />
          <Switch label="PMS days and typical PMS signs" checked={sharing.pms} onChange={(v) => actions.saveSharing({ pms: v })} />
          <Switch label="Moods and symptoms from the last 2 days" hint="Notes, temperatures, LH tests and intimacy logs are never shared." checked={sharing.symptoms} onChange={(v) => actions.saveSharing({ symptoms: v })} />
        </div>
      )}

      {!isPartner && (
        <div className="card">
          <h3>Starting assumptions</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Luna uses these until it has learned from your own cycles, then gives them less weight with every cycle you log.
          </p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <NumberSetting label="Typical cycle (days)" value={settings.cycleLength} min={18} max={60} onSave={(n) => actions.saveSettings({ cycleLength: n })} />
            <NumberSetting label="Typical period (days)" value={settings.periodLength} min={1} max={12} onSave={(n) => actions.saveSettings({ periodLength: n })} />
            <NumberSetting label="PMS before period (days)" value={settings.pmsDays} min={0} max={14} onSave={(n) => actions.saveSettings({ pmsDays: n })} />
          </div>
        </div>
      )}

      <div className="card">
        <h3>Preferences</h3>
        {!isPartner && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 8 }}>
            <div className="field">
              <label htmlFor="ws">Week starts on</label>
              <select id="ws" className="input" value={settings.weekStart} onChange={(e) => actions.saveSettings({ weekStart: Number(e.target.value) })}>
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tu">Temperature unit</label>
              <select id="tu" className="input" value={settings.tempUnit} onChange={(e) => actions.saveSettings({ tempUnit: e.target.value })}>
                <option value="C">°C</option>
                <option value="F">°F</option>
              </select>
            </div>
          </div>
        )}
        <Switch
          label="Reminders on this device"
          hint={remindersSupported() ? 'A heads-up before periods, PMS and fertile days, shown while Luna is running.' : 'Not supported on this device yet.'}
          checked={reminders}
          disabled={!remindersSupported()}
          onChange={async (v) => setRemindersState(await setReminders(v))}
        />
      </div>

      {!isPartner && (
        <div className="card">
          <h3>Your data</h3>
          <div className="row">
            <button className="btn" onClick={() => download(`luna-export-${todayKey()}.json`, JSON.stringify({ app: 'luna', version: 1, days: data.days, settings }, null, 2))}>
              Export backup
            </button>
            <button className="btn" disabled={busy} onClick={() => fileRef.current.click()}>Import backup</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImport} />
            <button
              className="btn danger"
              disabled={busy}
              onClick={() => confirm('Delete ALL cycle data permanently? This cannot be undone.') && run(actions.deleteAll)}
            >
              Delete all data
            </button>
          </div>
        </div>
      )}

      <p className="muted small">
        Luna gives estimates from logged data and is not a medical device or a method of contraception. Talk to a doctor about very
        irregular cycles, severe pain, or PMS that disrupts daily life.
      </p>
    </div>
  );
}
