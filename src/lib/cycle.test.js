import { describe, it, expect } from 'vitest';
import { buildModel, project, detectPeriods, shareModel, estimate } from './cycle.js';
import { addDays } from './dates.js';

function logPeriod(days, start, len = 5, extra = {}) {
  for (let i = 0; i < len; i++) days[addDays(start, i)] = { flow: i < 2 ? 'heavy' : 'light', ...extra };
}

function history(lengths, start = '2026-01-01', periodLen = 5) {
  const days = {};
  let s = start;
  logPeriod(days, s, periodLen);
  for (const L of lengths) {
    s = addDays(s, L);
    logPeriod(days, s, periodLen);
  }
  return { days, lastStart: s };
}

describe('estimate', () => {
  it('uses the prior with no data and moves toward observations', () => {
    expect(estimate([], 28, 2.5).mean).toBe(28);
    const e = estimate([32, 32, 32, 32, 32, 32], 28, 2.5);
    expect(e.mean).toBeGreaterThan(30.5);
    expect(e.mean).toBeLessThan(32);
  });
});

describe('detectPeriods', () => {
  it('bridges one-day gaps, ignores spotting-only groups and starts at the first real bleed', () => {
    const days = {
      '2026-03-01': { flow: 'spotting' },
      '2026-03-02': { flow: 'medium' },
      '2026-03-03': { flow: 'heavy' },
      '2026-03-05': { flow: 'light' },
      '2026-03-15': { flow: 'spotting' },
    };
    expect(detectPeriods(days)).toEqual([{ start: '2026-03-02', end: '2026-03-05', auto: false }]);
  });

  it('treats bleeding soon after a period as irregular bleeding, not a new period', () => {
    const days = {};
    logPeriod(days, '2026-03-01');
    logPeriod(days, '2026-03-10', 2);
    expect(detectPeriods(days)).toHaveLength(1);
  });
});

describe('buildModel + project', () => {
  it('calibrates to a consistent 31-day cycle', () => {
    const { days, lastStart } = history([31, 31, 31, 31, 31, 31]);
    const today = addDays(lastStart, 3);
    const m = buildModel(days, { cycleLength: 28 }, today);
    expect(Math.round(m.estimates.cycle.mean)).toBe(31);
    const p = project(m, today);
    expect(p.nextPeriod).toBe(addDays(lastStart, 31));
    expect(p.phase).toBe('menstrual');
    expect(p.cycleDay).toBe(4);
    expect(m.confidence).toBe('high');
  });

  it('excludes a cycle that is likely a missed log', () => {
    const { days } = history([28, 29, 57, 28]);
    const m = buildModel(days, {}, '2026-06-01');
    expect(m.cycles.filter((c) => c.excluded)).toHaveLength(1);
    expect(Math.round(m.estimates.cycle.mean)).toBe(28);
  });

  it('keeps a one-off long cycle out of predictions but tolerates naturally irregular cycles', () => {
    const regular = buildModel(history([29, 31, 28, 30, 29, 47, 30, 29]).days, {}, '2026-12-30');
    expect(regular.cycles.find((c) => c.length === 47).excluded).toBeTruthy();
    expect(Math.round(regular.estimates.cycle.mean)).toBe(29);

    const irregular = buildModel(history([24, 38, 27, 41, 30, 35]).days, {}, '2026-12-30');
    expect(irregular.cycles.filter((c) => c.excluded)).toHaveLength(0);
  });

  it('learns luteal phase from LH tests and PMS lead time from logged symptoms', () => {
    const { days, lastStart } = history([30, 30, 30, 30]);
    let s = '2026-01-01';
    for (let i = 0; i < 4; i++) {
      const next = addDays(s, 30);
      days[addDays(next, -12)] = { lh: 'positive' }; // ovulation next-11 -> luteal 11
      for (let d = 1; d <= 3; d++) days[addDays(next, -d)] = { symptoms: ['bloating'], moods: ['irritable'] };
      s = next;
    }
    const m = buildModel(days, {}, addDays(lastStart, 5));
    expect(m.estimates.luteal.mean).toBeLessThan(13);
    expect(m.estimates.pms.mean).toBeLessThan(4.5);
    expect(m.pmsSymptoms.map((x) => x.id)).toEqual(expect.arrayContaining(['bloating', 'irritable']));
    const p = project(m, addDays(lastStart, 5));
    expect(p.ovulation).toBe(addDays(p.nextPeriod, -p.lutealLength));
  });

  it('reports late periods', () => {
    const { days, lastStart } = history([28, 28, 28]);
    const today = addDays(lastStart, 32);
    const p = project(buildModel(days, {}, today), today);
    expect(p.phase).toBe('late');
    expect(p.lateBy).toBe(4);
    expect(p.upcoming[0].start).toBe(addDays(today, 1));
  });

  it('marks the fertile window and PMS days on the calendar', () => {
    const { days, lastStart } = history([28, 28]);
    const today = addDays(lastStart, 2);
    const p = project(buildModel(days, {}, today), today);
    expect(p.marks[p.ovulation].ovulation).toBe('estimated');
    expect(p.marks[addDays(p.ovulation, -5)].fertile).toBe(true);
    expect(p.marks[addDays(p.nextPeriod, -1)].pms).toBe('predicted');
    expect(p.marks[p.nextPeriod].period).toBe('predicted');
    expect(p.marks[lastStart].period).toBe('logged');
  });

  it('hides fertility and PMS from the partner when not shared', () => {
    const { days, lastStart } = history([28, 28]);
    const today = addDays(lastStart, 12);
    const shared = shareModel(buildModel(days, {}, today), { fertility: false, pms: false, symptoms: false });
    const p = project(shared, today);
    expect(p.ovulation).toBeNull();
    expect(p.pmsStart).toBeNull();
    expect(['fertile', 'ovulation', 'pms']).not.toContain(p.phase);
    expect(Object.values(p.marks).some((x) => x.fertile || x.pms)).toBe(false);
  });

  it('produces a Firestore-safe model (no nested arrays, no undefined)', () => {
    const { days } = history([28, 29, 30]);
    const m = buildModel(days, {}, '2026-05-01');
    const check = (v) => {
      if (Array.isArray(v)) v.forEach((x) => { expect(Array.isArray(x)).toBe(false); check(x); });
      else if (v && typeof v === 'object') Object.values(v).forEach((x) => { expect(x).not.toBeUndefined(); check(x); });
    };
    check(m);
  });
});
