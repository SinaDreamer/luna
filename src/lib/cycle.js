// Cycle prediction engine.
//
// buildModel(days, settings, today)  -> learns from logged days (runs on the tracker's device)
// project(model, today)              -> today's status, upcoming predictions and calendar marks
//
// The model is plain JSON (no nested arrays) so it can be shared with the partner via Firestore
// without exposing the raw day logs.
//
// Calibration: every estimate (cycle length, period length, luteal phase, PMS lead time) is a
// recency-weighted mean of her own observations, shrunk toward a prior. With no data the prior
// (her "typical" values from onboarding) dominates; each logged cycle pulls the estimate toward
// what actually happens.
import { addDays, diffDays } from './dates.js';
import { PMS_SIGNS } from './constants.js';

export const DEFAULT_SETTINGS = { cycleLength: 28, periodLength: 5, pmsDays: 5, tempUnit: 'C', weekStart: 1 };

const BLEED = new Set(['light', 'medium', 'heavy']);
const MIN_CYCLE = 15;
const MAX_CYCLE = 90;
const PRIOR_WEIGHT = 2; // with no data, the prior counts like ~2 observed cycles
const DECAY = 0.85; // each older cycle counts 15% less

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Recency-weighted mean/sd shrunk toward a prior. `values` must be oldest -> newest. */
export function estimate(values, prior, priorSd) {
  const n = values.length;
  const w = values.map((_, i) => DECAY ** (n - 1 - i));
  // The prior fades as her own data accumulates (2 -> 1 after 2 cycles -> 0.5 after 6).
  const pw = PRIOR_WEIGHT / (1 + n / 2);
  let W = pw;
  let S = prior * pw;
  values.forEach((v, i) => {
    W += w[i];
    S += w[i] * v;
  });
  const mean = S / W;
  let V = pw * priorSd * priorSd;
  values.forEach((v, i) => {
    V += w[i] * (v - mean) ** 2;
  });
  return { mean, sd: Math.sqrt(V / W), n };
}

/**
 * Groups flow days into periods. Gaps of one missing day are bridged; spotting alone never
 * starts a period; bleeding less than 15 days after a period start counts as irregular
 * bleeding, not a new period.
 */
export function detectPeriods(days) {
  const keys = Object.keys(days)
    .filter((k) => days[k]?.flow && days[k].flow !== 'none')
    .sort();
  const groups = [];
  let cur = null;
  for (const k of keys) {
    const bleed = BLEED.has(days[k].flow);
    if (cur && diffDays(k, cur.last) <= 2) {
      cur.last = k;
      if (bleed && !cur.firstBleed) cur.firstBleed = k;
      cur.allAuto = cur.allAuto && !!days[k].auto;
    } else {
      cur = { last: k, firstBleed: bleed ? k : null, allAuto: !!days[k].auto };
      groups.push(cur);
    }
  }
  const periods = [];
  for (const g of groups) {
    if (!g.firstBleed) continue;
    const prev = periods[periods.length - 1];
    if (prev && diffDays(g.firstBleed, prev.start) < MIN_CYCLE) {
      prev.end = g.last > prev.end ? g.last : prev.end;
      continue;
    }
    periods.push({ start: g.firstBleed, end: g.last, auto: g.allAuto });
  }
  return periods;
}

/** Ovulation from a positive LH test (ovulation ~1 day later) or a BBT thermal shift (3-over-6 rule). */
export function detectOvulation(days, start, endExclusive, tempUnit = 'C') {
  const len = diffDays(endExclusive, start);
  for (let i = 0; i < len; i++) {
    const k = addDays(start, i);
    if (days[k]?.lh === 'positive') return { day: addDays(k, 1), source: 'LH test' };
  }
  const temps = [];
  for (let i = 0; i < len; i++) {
    const k = addDays(start, i);
    const t = parseFloat(days[k]?.temp);
    if (Number.isFinite(t)) temps.push({ k, t });
  }
  const thr = tempUnit === 'F' ? 0.2 : 0.1;
  for (let i = 6; i + 2 < temps.length; i++) {
    const base = Math.max(...temps.slice(i - 6, i).map((x) => x.t));
    if ([0, 1, 2].every((j) => temps[i + j].t >= base + thr)) {
      return { day: addDays(temps[i].k, -1), source: 'temperature' };
    }
  }
  return null;
}

const isPmsDay = (e) =>
  !!e && (e.pms || (e.symptoms || []).some((s) => PMS_SIGNS.has(s)) || (e.moods || []).some((m) => PMS_SIGNS.has(m)));

/** Earliest day of the PMS run leading into `nextStart` (gaps of up to 2 days allowed). */
export function pmsOnset(days, nextStart) {
  let onset = null;
  let gap = 0;
  for (let i = 1; i <= 14; i++) {
    const k = addDays(nextStart, -i);
    if (isPmsDay(days[k])) {
      onset = k;
      gap = 0;
    } else if (++gap > 2) break;
  }
  if (onset) return { onset, length: diffDays(nextStart, onset) };
  let logged = 0;
  for (let i = 1; i <= 7; i++) if (days[addDays(nextStart, -i)]) logged++;
  return logged >= 3 ? { onset: null, length: 0 } : null; // she logged, but felt fine
}

export function buildModel(days, rawSettings, today) {
  const settings = { ...DEFAULT_SETTINGS, ...rawSettings };
  const periods = detectPeriods(days);

  const cycles = [];
  for (let i = 0; i < periods.length - 1; i++) {
    const p = periods[i];
    const nextStart = periods[i + 1].start;
    const c = { start: p.start, nextStart, length: diffDays(nextStart, p.start), periodLength: diffDays(p.end, p.start) + 1 };
    const ov = detectOvulation(days, p.start, nextStart, settings.tempUnit);
    if (ov) {
      c.ovulation = ov.day;
      c.ovulationSource = ov.source;
    }
    const pms = pmsOnset(days, nextStart);
    if (pms) {
      c.pmsLength = pms.length;
      if (pms.onset) c.pmsOnset = pms.onset;
    }
    cycles.push(c);
  }

  // Outliers stay visible in history but don't steer predictions: cycles about twice her
  // median are usually a missed period log; others far outside her normal spread (robust
  // median/MAD test) are one-offs from illness, travel, stress and so on.
  const sorted = cycles.map((c) => c.length).sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const devs = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = devs[Math.floor(devs.length / 2)] * 1.4826;
  const tolerance = Math.max(7, 3 * mad);
  for (const c of cycles) {
    if (c.length > MAX_CYCLE) c.excluded = 'Very long. A period log may be missing.';
    else if (sorted.length >= 3 && c.length >= 1.7 * median) c.excluded = 'Unusually long. A period log may be missing.';
    else if (sorted.length >= 4 && Math.abs(c.length - median) > tolerance) c.excluded = 'Unusual for her, so not used for predictions.';
  }
  const valid = cycles.filter((c) => !c.excluded);

  const cycleEst = estimate(valid.map((c) => c.length), settings.cycleLength, 2.5);

  // Period length: finished periods where she logged more than just the first day.
  const periodObs = periods
    .filter((p) => !p.auto && p.end !== p.start && diffDays(today, p.end) >= 2)
    .map((p) => diffDays(p.end, p.start) + 1);
  const periodEst = estimate(periodObs, settings.periodLength, 1);

  const lutealObs = valid
    .filter((c) => c.ovulation)
    .map((c) => diffDays(c.nextStart, c.ovulation))
    .filter((l) => l >= 7 && l <= 19);
  const lutealEst = estimate(lutealObs, 14, 1.5);

  const pmsCycles = valid.filter((c) => c.pmsLength !== undefined);
  const pmsEst = estimate(pmsCycles.map((c) => c.pmsLength), settings.pmsDays, 1.5);

  // Which signs show up in her PMS window, as a share of cycles that had PMS.
  const withPms = pmsCycles.filter((c) => c.pmsOnset);
  const counts = {};
  for (const c of withPms) {
    const seen = new Set();
    for (let k = c.pmsOnset; k < c.nextStart; k = addDays(k, 1)) {
      const e = days[k];
      if (!e) continue;
      [...(e.symptoms || []), ...(e.moods || [])].filter((s) => PMS_SIGNS.has(s)).forEach((s) => seen.add(s));
    }
    seen.forEach((s) => {
      counts[s] = (counts[s] || 0) + 1;
    });
  }
  const pmsSymptoms = Object.entries(counts)
    .map(([id, n]) => ({ id, share: n / withPms.length }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);

  // Backtest: what would the model have predicted for each cycle, using only earlier cycles?
  const accuracy = [];
  valid.forEach((c, j) => {
    const prior = estimate(valid.slice(0, j).map((x) => x.length), settings.cycleLength, 2.5);
    accuracy.push({ start: c.start, predicted: Math.round(prior.mean), actual: c.length, error: c.length - Math.round(prior.mean) });
  });
  const recent = accuracy.slice(-6);
  const mae = recent.length ? recent.reduce((s, a) => s + Math.abs(a.error), 0) / recent.length : null;

  const n = valid.length;
  const confidence = n === 0 ? 'learning' : n < 3 ? 'low' : n < 6 || cycleEst.sd > 4 ? 'medium' : 'high';

  const last = periods[periods.length - 1];
  const current = last ? detectOvulation(days, last.start, addDays(today, 1), settings.tempUnit) : null;

  return {
    version: 1,
    periods,
    cycles,
    estimates: { cycle: cycleEst, period: periodEst, luteal: lutealEst, pms: pmsEst },
    pmsSymptoms,
    accuracy: recent,
    mae,
    confidence,
    currentOvulation: current,
    hide: {},
  };
}

/** Removes what the tracker chose not to share before the model goes to the partner. */
export function shareModel(model, sharing) {
  const m = JSON.parse(JSON.stringify(model));
  m.hide = { fertility: !sharing.fertility, pms: !sharing.pms };
  if (m.hide.fertility) {
    m.currentOvulation = null;
    m.cycles.forEach((c) => {
      delete c.ovulation;
      delete c.ovulationSource;
    });
  }
  if (m.hide.pms) {
    m.pmsSymptoms = [];
    m.cycles.forEach((c) => {
      delete c.pmsOnset;
      delete c.pmsLength;
    });
  }
  return m;
}

// Approximate chance of conception by day relative to ovulation (after Wilcox et al., 1995).
const CHANCE = { '-5': 'Medium', '-4': 'Medium', '-3': 'High', '-2': 'High', '-1': 'Peak', 0: 'Peak', 1: 'Medium' };

export function project(model, today, count = 6) {
  if (!model?.periods?.length) return null;
  const { periods, estimates: E, hide = {} } = model;
  const last = periods[periods.length - 1];
  const L = Math.max(MIN_CYCLE, Math.round(E.cycle.mean));
  const P = clamp(Math.round(E.period.mean), 2, 10);
  const lut = clamp(Math.round(E.luteal.mean), 9, 17);
  const pmsLen = clamp(Math.round(E.pms.mean), 0, 12);
  const spread = Math.max(1, Math.round(E.cycle.sd));

  const firstNext = addDays(last.start, L);
  const lateBy = diffDays(today, firstNext);
  const curOv = model.currentOvulation?.day ?? addDays(firstNext, -lut);

  const upcoming = [];
  let s = lateBy > 0 ? addDays(today, 1) : firstNext;
  for (let i = 0; i < count; i++) {
    const anchor = i === 0 ? firstNext : s;
    const ov = i === 0 ? curOv : addDays(s, -lut);
    upcoming.push({
      start: s,
      end: addDays(s, P - 1),
      ovulation: ov,
      fertileStart: addDays(ov, -5),
      fertileEnd: addDays(ov, 1),
      pmsStart: addDays(anchor, -pmsLen),
      spread: Math.round(spread * Math.sqrt(i + 1)),
    });
    s = addDays(s, L);
  }

  // Calendar marks: key -> { period: 'logged'|'predicted', fertile, ovulation, pms }
  const marks = {};
  const mark = (k, patch) => {
    marks[k] = { ...marks[k], ...patch };
  };
  const span = (a, b, patch) => {
    for (let k = a; k <= b; k = addDays(k, 1)) mark(k, patch);
  };

  for (const c of model.cycles) {
    if (!hide.fertility) {
      const ov = c.ovulation ?? addDays(c.nextStart, -lut);
      span(addDays(ov, -5), addDays(ov, 1), { fertile: true });
      mark(ov, { ovulation: c.ovulation ? 'observed' : 'estimated' });
    }
    if (!hide.pms && c.pmsOnset) span(c.pmsOnset, addDays(c.nextStart, -1), { pms: 'logged' });
  }
  const curStart = last.start;
  upcoming.forEach((u, i) => {
    if (!hide.fertility) {
      span(u.fertileStart > curStart ? u.fertileStart : addDays(curStart, 1), u.fertileEnd, { fertile: true });
      mark(u.ovulation, { ovulation: i === 0 && model.currentOvulation ? 'observed' : 'estimated' });
    }
    if (!hide.pms && pmsLen > 0) span(u.pmsStart, addDays(i === 0 ? firstNext : u.start, -1), { pms: marks[u.pmsStart]?.pms || 'predicted' });
    span(u.start, u.end, { period: 'predicted' });
  });
  // Logged periods win over any prediction on the same day.
  for (const p of periods) span(p.start, p.end, { period: 'logged', fertile: false, ovulation: undefined });

  // Today's status
  const cycleDay = diffDays(today, last.start) + 1;
  const onlyStart = last.start === last.end;
  const menstrual =
    today >= last.start && (today <= last.end || (cycleDay <= P && (diffDays(today, last.end) <= 1 || onlyStart)));
  const fertileStart = addDays(curOv, -5);
  const fertileEnd = addDays(curOv, 1);
  const pmsStart = addDays(firstNext, -pmsLen);

  let phase;
  if (menstrual) phase = 'menstrual';
  else if (lateBy > 0) phase = 'late';
  else if (!hide.fertility && today === curOv) phase = 'ovulation';
  else if (!hide.fertility && today >= fertileStart && today <= fertileEnd) phase = 'fertile';
  else if (!hide.pms && pmsLen > 0 && today >= pmsStart) phase = 'pms';
  else phase = today < curOv ? 'follicular' : 'luteal';

  const rel = diffDays(today, curOv);
  const fertilityChance = hide.fertility ? null : menstrual ? 'Low' : CHANCE[rel] ?? 'Low';

  // Next fertile window that hasn't ended yet
  const nextFertile = hide.fertility ? null : upcoming.find((u) => u.fertileEnd >= today) ?? null;

  return {
    cycleDay,
    cycleLength: L,
    periodLength: P,
    lutealLength: lut,
    pmsLength: pmsLen,
    phase,
    lateBy: Math.max(0, lateBy),
    nextPeriod: firstNext,
    daysUntilPeriod: diffDays(firstNext, today),
    spread,
    ovulation: hide.fertility ? null : curOv,
    ovulationSource: model.currentOvulation?.source ?? null,
    fertileWindow: nextFertile ? { start: nextFertile.fertileStart, end: nextFertile.fertileEnd } : null,
    fertilityChance,
    pmsStart: hide.pms ? null : pmsStart,
    upcoming,
    marks,
    lastStart: last.start,
  };
}
