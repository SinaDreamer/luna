import { addDays } from '../lib/dates.js';

const SIZE = 230;
const R = 96;
const C = SIZE / 2;

function arc(a0, a1) {
  const p = (a) => [C + R * Math.sin(a), C - R * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function colorFor(m) {
  if (!m) return 'var(--line)';
  if (m.period) return 'var(--period)';
  if (m.ovulation || m.fertile) return 'var(--fertile)';
  if (m.pms) return 'var(--pms)';
  return 'var(--line)';
}

/** One segment per cycle day, coloured by phase, with a marker on today. */
export default function PhaseRing({ proj, label }) {
  const total = Math.max(proj.cycleLength, proj.cycleDay);
  const step = (2 * Math.PI) / total;
  const gap = Math.min(0.03, step * 0.25);
  const segs = [];
  for (let i = 0; i < total; i++) {
    const k = addDays(proj.lastStart, i);
    const m = proj.marks[k];
    const late = i >= proj.cycleLength;
    segs.push(
      <path
        key={i}
        d={arc(i * step + gap / 2, (i + 1) * step - gap / 2)}
        stroke={late ? 'var(--muted-mark)' : colorFor(m)}
        strokeWidth={m?.ovulation ? 18 : 12}
        fill="none"
        strokeLinecap="butt"
      />,
    );
  }
  const a = (proj.cycleDay - 0.5) * step;
  const mx = C + R * Math.sin(a);
  const my = C - R * Math.cos(a);
  return (
    <svg className="ring-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Cycle day ${proj.cycleDay} of about ${proj.cycleLength}`}>
      {segs}
      <circle cx={mx} cy={my} r="11" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
      <text x={C} y={C - 4} textAnchor="middle" className="ring-center-day">
        {proj.cycleDay}
      </text>
      <text x={C} y={C + 20} textAnchor="middle" className="ring-center-label">
        {label}
      </text>
    </svg>
  );
}
