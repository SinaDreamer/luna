// Gentle once-a-day heads-ups via the system notification API (works in Electron and browsers).
const PREF = 'luna-reminders';
const LAST = 'luna-reminded-on';

const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export const remindersSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const remindersOn = () => read(PREF) === '1';

export async function setReminders(on) {
  if (on && remindersSupported() && Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return false;
  }
  write(PREF, on ? '1' : '0');
  return on;
}

/** `partnerName` is set when the partner's app is running; messages switch to third person. */
export function runReminders(proj, today, partnerName) {
  if (!remindersOn() || !remindersSupported() || Notification.permission !== 'granted') return;
  if (read(LAST) === today) return;
  const her = partnerName || 'her';
  const you = !partnerName;
  const msgs = [];
  const d = proj.daysUntilPeriod;
  if (d === 2 || d === 1) msgs.push(you ? `Your period is expected in ${d} day${d > 1 ? 's' : ''}.` : `${her}'s period is expected in ${d} day${d > 1 ? 's' : ''}.`);
  if (d === 0) msgs.push(you ? 'Your period is expected today.' : `${her}'s period is expected today.`);
  if (proj.pmsStart === today) msgs.push(you ? 'PMS days may start around now. Be kind to yourself.' : `PMS days may start for ${her}. A little extra care goes a long way.`);
  if (proj.fertileWindow?.start === today) msgs.push(you ? 'Your fertile window starts today.' : `${her}'s fertile window starts today.`);
  if (!msgs.length) return;
  write(LAST, today);
  new Notification('Luna', { body: msgs.join(' '), icon: './icon.svg' });
}
