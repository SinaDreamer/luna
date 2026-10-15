import { addDays, diffDays } from '../lib/dates.js';

/** True when a day log has nothing worth storing. */
export function isEmptyEntry(e) {
  if (!e) return true;
  return (
    (!e.flow || e.flow === 'none') &&
    !e.pms &&
    !(e.symptoms || []).length &&
    !(e.moods || []).length &&
    !e.lh &&
    (e.temp === undefined || e.temp === '' || e.temp === null) &&
    !e.sex &&
    !(e.note || '').trim()
  );
}

/** Strips empty fields so stored docs stay small and Firestore never sees `undefined`. */
export function cleanEntry(e) {
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (k === 'flow' && v === 'none') continue;
    out[k] = v;
  }
  return out;
}

/** Day logs created from onboarding answers ("my last period started on..."). */
export function onboardingDays(starts, periodLength, today) {
  const days = {};
  for (const s of starts.filter(Boolean)) {
    for (let i = 0; i < periodLength; i++) {
      const k = addDays(s, i);
      if (diffDays(k, today) > 0) break;
      days[k] = { flow: i < 2 ? 'medium' : 'light', auto: true };
    }
  }
  return days;
}
