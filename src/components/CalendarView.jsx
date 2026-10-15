import { useState } from 'react';
import { LABELS } from '../lib/constants.js';
import { fmtLong, fromKey, toKey } from '../lib/dates.js';
import { Icon } from './ui.jsx';

const monthLabel = (y, m) => new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

function weekdayNames(weekStart) {
  // 2024-01-07 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + ((i + weekStart) % 7)).toLocaleDateString(undefined, { weekday: 'short' }));
}

function describe(m) {
  const out = [];
  if (!m) return out;
  if (m.period === 'logged') out.push({ cls: 'period', text: 'Period' });
  if (m.period === 'predicted') out.push({ cls: 'period', text: 'Predicted period' });
  if (m.ovulation) out.push({ cls: 'fertile', text: m.ovulation === 'observed' ? 'Ovulation (detected)' : 'Ovulation (estimated)' });
  else if (m.fertile) out.push({ cls: 'fertile', text: 'Fertile window' });
  if (m.pms === 'logged') out.push({ cls: 'pms', text: 'PMS (logged)' });
  if (m.pms === 'predicted') out.push({ cls: 'pms', text: 'PMS likely' });
  return out;
}

export default function CalendarView({ proj, days, today, weekStart = 1, onLog }) {
  const [cursor, setCursor] = useState(() => {
    const d = fromKey(today);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);

  const move = (delta) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const first = new Date(cursor.y, cursor.m, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const count = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(<div key={`b${i}`} />);
  for (let d = 1; d <= count; d++) {
    const k = toKey(new Date(cursor.y, cursor.m, d));
    const m = proj?.marks[k];
    const e = days?.[k];
    const logged = e && (e.symptoms?.length || e.moods?.length || e.pms || e.note || e.lh || e.temp || e.sex);
    const cls = ['cal-day'];
    if (m?.period === 'logged') cls.push('is-period');
    else if (m?.period === 'predicted') cls.push('is-pred-period');
    if (m?.fertile) cls.push('is-fertile');
    if (m?.ovulation) cls.push('is-ovulation');
    if (k === today) cls.push('is-today');
    if (k === selected) cls.push('is-selected');
    if (k > today) cls.push('is-future');
    const labels = describe(m).map((x) => x.text);
    cells.push(
      <button
        key={k}
        className={cls.join(' ')}
        onClick={() => setSelected(k)}
        onDoubleClick={() => onLog && k <= today && onLog(k)}
        aria-label={`${fmtLong(k)}${labels.length ? `: ${labels.join(', ')}` : ''}`}
        aria-pressed={k === selected}
      >
        <span className="num">{d}</span>
        {m?.pms && <span className={`pms-bar ${m.pms === 'logged' ? 'logged' : ''}`} />}
        {logged && <span className="dot" />}
      </button>,
    );
  }

  const sel = days?.[selected];
  const tags = describe(proj?.marks[selected]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Calendar</h1>
        <button
          className="btn"
          onClick={() => {
            const d = fromKey(today);
            setCursor({ y: d.getFullYear(), m: d.getMonth() });
            setSelected(today);
          }}
        >
          Today
        </button>
      </div>

      <div className="cal-layout">
        <div className="card">
          <div className="cal-head">
            <button className="icon-btn" onClick={() => move(-1)} aria-label="Previous month">
              <Icon name="left" size={18} />
            </button>
            <h2>{monthLabel(cursor.y, cursor.m)}</h2>
            <button className="icon-btn" onClick={() => move(1)} aria-label="Next month">
              <Icon name="right" size={18} />
            </button>
          </div>
          <div className="cal-grid">
            {weekdayNames(weekStart).map((w) => (
              <div key={w} className="cal-wd">{w}</div>
            ))}
            {cells}
          </div>
          <div className="legend">
            <span><i className="sw period" /> Period</span>
            <span><i className="sw pred" /> Predicted period</span>
            <span><i className="sw fertile" /> Fertile</span>
            <span><i className="sw ovulation" /> Ovulation</span>
            <span><i className="sw pms" /> PMS</span>
            {days && <span><i className="sw log" /> Logged</span>}
          </div>
        </div>

        <div className="card day-detail">
          <h2>{fmtLong(selected)}</h2>
          {tags.length ? (
            <div className="tag-list">
              {tags.map((t) => (
                <span key={t.text} className={`tag ${t.cls}`}>{t.text}</span>
              ))}
            </div>
          ) : (
            <div className="muted">No cycle events.</div>
          )}
          {sel && (
            <div className="tag-list">
              {sel.flow && <span className="tag period">Flow: {sel.flow}</span>}
              {sel.pms && <span className="tag pms">PMS</span>}
              {[...(sel.moods || []), ...(sel.symptoms || [])].map((s) => (
                <span key={s} className="tag">{LABELS[s] || s}</span>
              ))}
              {sel.lh && <span className="tag fertile">LH {sel.lh}</span>}
              {sel.temp && <span className="tag">Temp {sel.temp}</span>}
            </div>
          )}
          {sel?.note && <div className="notice">{sel.note}</div>}
          {onLog && (
            selected <= today ? (
              <button className="btn primary" onClick={() => onLog(selected)}>{sel ? 'Edit log' : 'Log this day'}</button>
            ) : (
              <div className="muted small">You can log days up to today.</div>
            )
          )}
          {onLog && <div className="muted small">Tip: double-click a day to log it.</div>}
        </div>
      </div>
    </div>
  );
}
