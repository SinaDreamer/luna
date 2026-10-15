import { useEffect, useState } from 'react';
import { LABELS } from '../lib/constants.js';
import { fmt } from '../lib/dates.js';

function useNarrow() {
  const query = '(max-width: 600px)';
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

/** Single-series bar chart of recent cycle lengths with the learned average. */
function CycleChart({ cycles, avg }) {
  const [hover, setHover] = useState(null);
  const narrow = useNarrow();
  const data = cycles.slice(narrow ? -8 : -12);
  // A narrower viewBox on phones keeps axis text legible instead of scaling it down.
  const W = narrow ? 340 : 640;
  const H = narrow ? 200 : 220;
  const pad = { l: 34, r: 12, t: 16, b: 30 };
  const max = Math.max(35, ...data.map((c) => c.length), avg) + 2;
  const min = Math.min(20, ...data.map((c) => c.length)) - 2;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - min) / (max - min));
  const bw = (W - pad.l - pad.r) / data.length;
  const barW = Math.min(36, bw - 2);
  const ticks = [];
  for (let t = Math.ceil(min / 5) * 5; t <= max; t += 5) ticks.push(t);

  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cycle length per cycle">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--surface-2)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted-mark)" strokeWidth="2" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text className="axis-text" x={pad.l - 8} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {data.map((c, i) => {
          const x = pad.l + i * bw + (bw - barW) / 2;
          const top = y(c.length);
          const bottom = y(min);
          const r = Math.min(4, barW / 2);
          // Rounded top only; the bar stays anchored to the baseline.
          const d = `M${x} ${bottom} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + barW - r} Q${x + barW} ${top} ${x + barW} ${top + r} V${bottom} Z`;
          return (
            <g key={c.start}>
              <path d={d} className={`bar ${c.excluded ? 'excluded' : ''} ${hover !== null && hover !== i ? 'dim' : ''}`} />
              {(i === 0 || i === data.length - 1 || data.length <= (narrow ? 5 : 8)) && (
                <text className="axis-text" x={x + barW / 2} y={H - 10} textAnchor="middle">{fmt(c.start, { month: 'short' })}</text>
              )}
              <rect className="hit" x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}
        <line className="avg-line" x1={pad.l} x2={W - pad.r} y1={y(avg)} y2={y(avg)} />
        <text className="avg-text" x={W - pad.r} y={y(avg) - 6} textAnchor="end">avg {avg.toFixed(1)}</text>
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${((pad.l + hover * bw + bw / 2) / W) * 100}%`, top: `${(y(data[hover].length) / H) * 100}%` }}>
          {fmt(data[hover].start)}: <b>{data[hover].length} days</b>
          {data[hover].excluded ? ` · ignored (${data[hover].excluded.toLowerCase()})` : ''}
        </div>
      )}
    </div>
  );
}

export default function Insights({ model, proj }) {
  if (!model || !proj) {
    return (
      <div className="page">
        <h1>Insights</h1>
        <div className="card notice">Insights appear once there is cycle data.</div>
      </div>
    );
  }
  const E = model.estimates;
  const cycles = model.cycles;
  const luteaLearned = E.luteal.n;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Insights</h1>
        <span className="muted small">{cycles.length} completed cycle{cycles.length === 1 ? '' : 's'} logged</span>
      </div>

      <div className="grid">
        <div className="card stat">
          <h3>Cycle length</h3>
          <div className="value">{E.cycle.mean.toFixed(1)} days</div>
          <div className="sub">±{E.cycle.sd.toFixed(1)} days variation · {E.cycle.n ? `learned from ${E.cycle.n} cycles` : 'typical value'}</div>
        </div>
        <div className="card stat">
          <h3>Period length</h3>
          <div className="value">{proj.periodLength} days</div>
          <div className="sub">{E.period.n ? `learned from ${E.period.n} periods` : 'typical value'}</div>
        </div>
        {!model.hide?.fertility && (
          <div className="card stat">
            <h3>Ovulation</h3>
            <div className="value">~{proj.lutealLength} days before period</div>
            <div className="sub">{luteaLearned ? `learned from ${luteaLearned} LH tests or temperature shifts` : 'textbook 14 days until LH tests or temperatures are logged'}</div>
          </div>
        )}
        {!model.hide?.pms && (
          <div className="card stat">
            <h3>PMS lead time</h3>
            <div className="value">{proj.pmsLength} days</div>
            <div className="sub">{E.pms.n ? `learned from ${E.pms.n} cycles` : 'typical value, logs refine it'}</div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Cycle history</h3>
        {cycles.length ? (
          <CycleChart cycles={cycles} avg={E.cycle.mean} />
        ) : (
          <div className="muted">The chart starts after the second logged period.</div>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Prediction accuracy</h3>
          {model.accuracy.length ? (
            <>
              <p style={{ marginTop: 0 }}>
                Recent predictions were off by <b>{model.mae.toFixed(1)} days</b> on average. Each new cycle sharpens the next prediction.
              </p>
              <div className="table-scroll">
                <table className="data">
                  <thead>
                    <tr><th>Cycle</th><th>Predicted</th><th>Actual</th><th>Off by</th></tr>
                  </thead>
                  <tbody>
                    {[...model.accuracy].reverse().map((a) => (
                      <tr key={a.start}>
                        <td>{fmt(a.start)}</td>
                        <td>{a.predicted} d</td>
                        <td>{a.actual} d</td>
                        <td>{a.error === 0 ? 'exact' : `${a.error > 0 ? '+' : ''}${a.error} d`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="muted">Accuracy is tracked once a predicted period actually arrives.</div>
          )}
        </div>

        {!model.hide?.pms && (
          <div className="card">
            <h3>Typical PMS signs</h3>
            {model.pmsSymptoms.length ? (
              model.pmsSymptoms.map((s) => (
                <div key={s.id} className="hbar">
                  <span>{LABELS[s.id]}</span>
                  <div className="track"><div className="fill" style={{ width: `${Math.round(s.share * 100)}%` }} /></div>
                  <span className="val">{Math.round(s.share * 100)}%</span>
                </div>
              ))
            ) : (
              <div className="muted">Log PMS, moods and symptoms in the days before a period. Luna will learn which ones repeat.</div>
            )}
            {model.pmsSymptoms.length > 0 && <p className="muted small">Share of cycles where the sign appeared during PMS days.</p>}
          </div>
        )}
      </div>

      {cycles.length > 0 && (
        <div className="card">
          <h3>All cycles</h3>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr><th>Started</th><th>Cycle</th><th>Period</th>{!model.hide?.fertility && <th>Ovulation</th>}{!model.hide?.pms && <th>PMS</th>}<th /></tr>
              </thead>
              <tbody>
                {[...cycles].reverse().map((c) => (
                  <tr key={c.start}>
                    <td>{fmt(c.start, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>{c.length} d</td>
                    <td>{c.periodLength} d</td>
                    {!model.hide?.fertility && <td>{c.ovulation ? `${fmt(c.ovulation)} (${c.ovulationSource})` : '—'}</td>}
                    {!model.hide?.pms && <td>{c.pmsOnset ? `${c.pmsLength} d` : c.pmsLength === 0 ? 'none' : '—'}</td>}
                    <td className="muted small">{c.excluded ? 'ignored: likely missed log' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3>How Luna learns</h3>
        <p style={{ margin: 0 }} className="muted">
          Each prediction blends the typical values from setup with the cycles actually logged. Recent cycles count most, and the
          starting guess fades as data builds up. Unusually long cycles, which are usually a forgotten log, are ignored. Positive LH tests
          and basal-temperature shifts pin down ovulation, and PMS timing comes from the days PMS signs were logged.
        </p>
      </div>
    </div>
  );
}
