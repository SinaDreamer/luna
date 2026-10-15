import { useCallback, useState } from 'react';
import { DEFAULT_SETTINGS } from '../lib/cycle.js';
import { DEFAULT_SHARING } from '../lib/constants.js';
import { todayKey } from '../lib/dates.js';
import { cleanEntry, isEmptyEntry, onboardingDays } from './entries.js';

const KEY = 'luna-data-v1';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') return { days: {}, ...raw, settings: { ...DEFAULT_SETTINGS, ...raw.settings } };
  } catch {
    /* fall through to a fresh store */
  }
  return { days: {}, settings: { ...DEFAULT_SETTINGS }, onboarded: false, name: '' };
}

/** Single-device mode used when no Firebase project is configured. */
export function useLocalBackend() {
  const [state, setState] = useState(load);

  const update = useCallback((fn) => {
    setState((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage full or blocked: keep the in-memory state */
      }
      return next;
    });
  }, []);

  const actions = {
    saveDay: (key, entry) =>
      update((s) => {
        const days = { ...s.days };
        if (isEmptyEntry(entry)) delete days[key];
        else days[key] = cleanEntry(entry);
        return { ...s, days };
      }),
    saveSettings: (patch) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    saveName: (name) => update((s) => ({ ...s, name })),
    completeOnboarding: ({ name, settings, starts }) =>
      update((s) => ({
        ...s,
        name,
        onboarded: true,
        settings: { ...s.settings, ...settings },
        days: { ...onboardingDays(starts, settings.periodLength, todayKey()), ...s.days },
      })),
    importData: (data) => update((s) => ({ ...s, days: data.days || {}, settings: { ...s.settings, ...data.settings } })),
    deleteAll: () => update(() => ({ days: {}, settings: { ...DEFAULT_SETTINGS }, onboarded: false, name: '' })),
  };

  return {
    mode: 'local',
    status: state.onboarded ? 'ready' : 'needs-onboarding',
    role: 'tracker',
    name: state.name,
    days: state.days,
    settings: state.settings,
    sharing: DEFAULT_SHARING,
    actions,
  };
}
