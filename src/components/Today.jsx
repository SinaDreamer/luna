import { useData } from '../data/DataProvider.jsx';
import { PHASES, LABELS } from '../lib/constants.js';
import { addDays, diffDays, fmt, fmtLong } from '../lib/dates.js';
import PhaseRing from './PhaseRing.jsx';

const confidenceText = (level, her) =>
  ({
    learning: `Using ${her} typical cycle until a full cycle is logged`,
    low: `Still learning ${her} pattern`,
    medium: `Getting to know ${her} rhythm`,
    high: `${her === 'your' ? 'Your' : 'Her'} cycle is well understood`,
  })[level];

function headline(p) {
  if (p.phase === 'menstrual') return `Period day ${p.cycleDay}`;
  if (p.phase === 'late') return `Period ${p.lateBy} day${p.lateBy > 1 ? 's' : ''} late`;
  const d = p.daysUntilPeriod;
  if (d === 0) return 'Period expected today';
  if (d === 1) return 'Period expected tomorrow';
  return `Period in ${d} days`;
}

function daysLabel(from, to) {
  const n = diffDays(to, from);
  if (n <= 0) return 'now';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

export default function Today({ proj, model, today, onLog }) {
  const data = useData();
  const isPartner = data.role === 'partner';
  const who = isPartner ? data.partnerName || 'Her' : 'You';

  if (!proj) {
    return (
      <div className="page">
        <h1>{isPartner ? `${data.partnerName || 'Her'} cycle` : 'Today'}</h1>
        <div className="card notice">
          {isPartner ? 'Nothing shared yet. Her predictions show up here as soon as she opens Luna.' : 'Log your last period to start predictions.'}
        </div>
        {onLog && (
          <div className="row">
            <button className="btn primary" onClick={() => onLog(today)}>Log today</button>
          </div>
        )}
      </div>
    );
  }

  const phase = PHASES[proj.phase];
  const todayLog = !isPartner ? data.days[today] : null;
  const periodStartedToday = todayLog?.flow && todayLog.flow !== 'none';

  const startPeriodToday = () => data.actions.saveDay(today, { ...(todayLog || {}), flow: 'medium', auto: undefined });

  const greeting = isPartner ? `${who}'s cycle` : `Hi${data.name ? ` ${data.name}` : ''}`;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{greeting}</h1>
          <div className="muted">{fmtLong(today)}</div>
        </div>
      </div>

      <div className="card hero">
        <PhaseRing proj={proj} label={`of ~${proj.cycleLength} days`} />
        <div className="hero-text">
          <span className={`phase-pill ${proj.phase}`}>
            <i /> {phase.label}
          </span>
          <div className="big">{headline(proj)}</div>
          <div className="muted">{phase.blurb}</div>
          {!isPartner && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={() => onLog(today)}>Log today</button>
              {!periodStartedToday && proj.phase !== 'menstrual' && (
                <button className="btn" onClick={startPeriodToday}>Period started today</button>
              )}
            </div>
          )}
          {isPartner && data.summary?.updatedAt && (
            <div className="muted small">Last synced {new Date(data.summary.updatedAt).toLocaleString()}</div>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="card stat">
          <h3>Next period</h3>
          <div className="value">
            <span className="marker" style={{ background: 'var(--period)' }} />
            {proj.phase === 'late' ? 'Any day now' : fmt(proj.nextPeriod, { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <div className="sub">
            {proj.phase === 'late'
              ? `Was expected ${fmt(proj.nextPeriod)}`
              : `Likely ${fmt(addDays(proj.nextPeriod, -proj.spread))} – ${fmt(addDays(proj.nextPeriod, proj.spread))}`}
          </div>
        </div>

        {proj.fertileWindow && (
          <div className="card stat">
            <h3>Fertile window</h3>
            <div className="value">
              <span className="marker" style={{ background: 'var(--fertile)' }} />
              {fmt(proj.fertileWindow.start)} – {fmt(proj.fertileWindow.end)}
            </div>
            <div className="sub">
              Chance of pregnancy today: <b>{proj.fertilityChance}</b>
              {proj.ovulationSource && ` · ovulation detected via ${proj.ovulationSource}`}
            </div>
          </div>
        )}

        {proj.pmsStart && proj.pmsLength > 0 && (
          <div className="card stat">
            <h3>PMS</h3>
            <div className="value">
              <span className="marker" style={{ background: 'var(--pms)' }} />
              {proj.phase === 'pms' ? 'Likely now' : `From ${fmt(proj.pmsStart)}`}
            </div>
            <div className="sub">
              {proj.phase === 'pms'
                ? `About ${proj.pmsLength} days before the period`
                : `Starts ${daysLabel(today, proj.pmsStart)}`}
              {model.pmsSymptoms?.length > 0 && ` · usually ${model.pmsSymptoms.slice(0, 3).map((s) => LABELS[s.id].toLowerCase()).join(', ')}`}
            </div>
          </div>
        )}

        <div className="card stat">
          <h3>Prediction confidence</h3>
          <div className="value" style={{ textTransform: 'capitalize' }}>{model.confidence}</div>
          <div className="sub">
            {confidenceText(model.confidence, isPartner ? 'her' : 'your')}
            {model.mae !== null && ` · recent predictions off by ~${model.mae.toFixed(1)} days`}
          </div>
        </div>
      </div>

      {isPartner ? (
        <div className="grid-2">
          <div className="card">
            <h3>How to support {who}</h3>
            <ul className="tips">
              {phase.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3>How she&apos;s feeling</h3>
            {data.summary?.lastLog ? (
              <>
                <div className="muted small" style={{ marginBottom: 8 }}>
                  Logged {data.summary.lastLog.date === today ? 'today' : fmt(data.summary.lastLog.date, { weekday: 'long' })}
                </div>
                <div className="tag-list">
                  {data.summary.lastLog.pms && <span className="tag pms">PMS</span>}
                  {[...data.summary.lastLog.moods, ...data.summary.lastLog.symptoms].map((s) => (
                    <span key={s} className="tag">{LABELS[s] || s}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="muted">Nothing logged in the last few days.</div>
            )}
          </div>
        </div>
      ) : (
        todayLog && (
          <div className="card">
            <h3>Today&apos;s log</h3>
            <div className="tag-list">
              {todayLog.flow && <span className="tag period">Flow: {todayLog.flow}</span>}
              {todayLog.pms && <span className="tag pms">PMS</span>}
              {[...(todayLog.moods || []), ...(todayLog.symptoms || [])].map((s) => (
                <span key={s} className="tag">{LABELS[s] || s}</span>
              ))}
              {todayLog.lh && <span className="tag fertile">LH {todayLog.lh}</span>}
              {todayLog.temp && <span className="tag">{todayLog.temp}°{data.settings.tempUnit}</span>}
              {todayLog.note && <span className="tag">📝 note</span>}
            </div>
          </div>
        )
      )}

      <p className="muted small">
        Predictions are estimates from logged data. Don&apos;t use them as contraception or medical advice.
      </p>
    </div>
  );
}
