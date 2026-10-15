import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from './data/DataProvider.jsx';
import { buildModel, project, shareModel } from './lib/cycle.js';
import { addDays, todayKey } from './lib/dates.js';
import { AuthScreen, RoleScreen, JoinScreen } from './components/AuthScreens.jsx';
import Onboarding from './components/Onboarding.jsx';
import Today from './components/Today.jsx';
import CalendarView from './components/CalendarView.jsx';
import Insights from './components/Insights.jsx';
import Settings from './components/Settings.jsx';
import DayLogSheet from './components/DayLogSheet.jsx';
import { Icon } from './components/ui.jsx';
import { runReminders } from './lib/reminders.js';

/** Today's date key, refreshed when the clock passes midnight. */
function useToday() {
  const [t, setT] = useState(todayKey);
  useEffect(() => {
    const id = setInterval(() => setT(todayKey()), 60_000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export default function App() {
  const data = useData();
  switch (data.status) {
    case 'loading':
      return <div className="splash">Loading…</div>;
    case 'signed-out':
      return <AuthScreen />;
    case 'needs-role':
      return <RoleScreen />;
    case 'needs-link':
      return <JoinScreen />;
    case 'needs-onboarding':
      return <Onboarding />;
    default:
      return <Main />;
  }
}

const TABS = [
  { id: 'today', label: 'Today', icon: 'sun' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'insights', label: 'Insights', icon: 'chart' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

/** Her app keeps the partner's summary in sync whenever her data or sharing choices change. */
function usePublishSummary(data, model, today) {
  const last = useRef('');
  const enabled = data.mode === 'firebase' && data.role === 'tracker' && !!model;
  const payload = useMemo(() => {
    if (!enabled) return null;
    let lastLog = null;
    if (data.sharing.symptoms) {
      for (let i = 0; i <= 2 && !lastLog; i++) {
        const k = addDays(today, -i);
        const e = data.days[k];
        if (e && (e.moods?.length || e.symptoms?.length || e.pms)) {
          lastLog = { date: k, moods: e.moods || [], symptoms: e.symptoms || [], pms: !!e.pms };
        }
      }
    }
    return JSON.stringify({ model: shareModel(model, data.sharing), lastLog, weekStart: data.settings.weekStart, name: data.name });
  }, [enabled, model, data.sharing, data.days, data.settings.weekStart, data.name, today]);

  const publish = data.actions.publishSummary;
  useEffect(() => {
    if (!payload || payload === last.current) return undefined;
    const id = setTimeout(() => {
      last.current = payload;
      publish({ ...JSON.parse(payload), updatedAt: new Date().toISOString() });
    }, 1200);
    return () => clearTimeout(id);
  }, [payload, publish]);
}

function Main() {
  const data = useData();
  const today = useToday();
  const [tab, setTab] = useState('today');
  const [logDay, setLogDay] = useState(null);
  const isPartner = data.role === 'partner';

  const model = useMemo(
    () => (isPartner ? data.summary?.model ?? null : buildModel(data.days, data.settings, today)),
    [isPartner, data.summary, data.days, data.settings, today],
  );
  const proj = useMemo(() => (model ? project(model, today) : null), [model, today]);

  usePublishSummary(data, model, today);

  useEffect(() => {
    if (proj) runReminders(proj, today, isPartner ? data.partnerName : null);
  }, [proj, today, isPartner, data.partnerName]);

  const weekStart = isPartner ? data.summary?.weekStart ?? 1 : data.settings.weekStart;
  const openLog = isPartner ? null : setLogDay;

  return (
    <div className="app">
      <nav className="nav" aria-label="Main">
        <div className="brand">
          <img src="./icon.svg" alt="" /> Luna
        </div>
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} /> {t.label}
          </button>
        ))}
        <div className="spacer" />
        <div className="who">
          {data.mode === 'local' ? 'Local mode (this device)' : isPartner ? `Following ${data.partnerName || 'her'}` : data.partnerLinked ? `Shared with ${data.partnerName}` : 'Not shared yet'}
        </div>
      </nav>

      <main className="content">
        {data.error && (
          <div className="page" style={{ marginBottom: 16 }}>
            <div className="error" role="alert">
              <span>{data.error}</span>
              <button className="btn link" onClick={data.clearError}>Dismiss</button>
            </div>
          </div>
        )}
        {tab === 'today' && <Today proj={proj} model={model} today={today} onLog={openLog} />}
        {tab === 'calendar' && <CalendarView proj={proj} days={isPartner ? null : data.days} today={today} weekStart={weekStart} onLog={openLog} />}
        {tab === 'insights' && <Insights model={model} proj={proj} />}
        {tab === 'settings' && <Settings />}
      </main>

      {logDay && <DayLogSheet dayKey={logDay} today={today} onClose={() => setLogDay(null)} />}
    </div>
  );
}
