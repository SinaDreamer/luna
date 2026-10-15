import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DataContext } from '../data/DataProvider.jsx';
import { buildModel, project, shareModel } from '../lib/cycle.js';
import { addDays } from '../lib/dates.js';
import Today from './Today.jsx';
import CalendarView from './CalendarView.jsx';
import Insights from './Insights.jsx';

// Builds what her device would publish, then renders the partner's screens from it alone.
function partnerSetup(sharing) {
  const days = {};
  let s = '2026-05-01';
  for (let c = 0; c < 5; c++) {
    for (let i = 0; i < 5; i++) days[addDays(s, i)] = { flow: 'medium' };
    days[addDays(s, -2)] = { pms: true, symptoms: ['bloating'], note: 'secret note' };
    s = addDays(s, 29);
  }
  const today = addDays(s, -29 + 20);
  const model = shareModel(buildModel(days, {}, today), sharing);
  const summary = JSON.parse(JSON.stringify({ model, lastLog: sharing.symptoms ? { date: today, moods: ['calm'], symptoms: [], pms: false } : null, weekStart: 1 }));
  const ctx = { role: 'partner', mode: 'firebase', partnerName: 'Mia', summary, days: {}, settings: {}, actions: {} };
  const proj = project(summary.model, today);
  const render = (el) => renderToString(<DataContext.Provider value={ctx}>{el}</DataContext.Provider>).replaceAll('<!-- -->', '');
  return { summary, proj, today, render };
}

describe('partner view', () => {
  it('shows her status, fertility, PMS and support tips when shared', () => {
    const { summary, proj, today, render } = partnerSetup({ fertility: true, pms: true, symptoms: true });
    const html = render(<Today proj={proj} model={summary.model} today={today} onLog={null} />);
    expect(html).toContain('Mia&#x27;s cycle');
    expect(html).toContain('Fertile window');
    expect(html).toContain('How to support Mia');
    expect(html).toContain('Calm');
    expect(html).not.toContain('Log today');
    expect(JSON.stringify(summary)).not.toContain('secret note');

    const cal = render(<CalendarView proj={proj} days={null} today={today} weekStart={1} onLog={null} />);
    expect(cal).toContain('Calendar');
    expect(cal).not.toContain('Edit log');
    expect(render(<Insights model={summary.model} proj={proj} />)).toContain('Cycle history');
  });

  it('hides what she chose not to share', () => {
    const { summary, proj, today, render } = partnerSetup({ fertility: false, pms: false, symptoms: false });
    const html = render(<Today proj={proj} model={summary.model} today={today} onLog={null} />);
    expect(html).not.toContain('Fertile window');
    expect(html).not.toContain('>PMS<');
    expect(html).toContain('Nothing logged in the last few days');
    const ins = render(<Insights model={summary.model} proj={proj} />);
    expect(ins).not.toContain('Ovulation');
    expect(ins).not.toContain('PMS lead time');
  });
});
