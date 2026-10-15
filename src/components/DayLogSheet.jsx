import { useState } from 'react';
import { useData } from '../data/DataProvider.jsx';
import { FLOWS, MOODS, SYMPTOMS } from '../lib/constants.js';
import { fmtLong } from '../lib/dates.js';
import { Chip, Sheet } from './ui.jsx';

const toggle = (list = [], id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export default function DayLogSheet({ dayKey, today, onClose }) {
  const data = useData();
  const existing = data.days[dayKey];
  // Editing a day generated during onboarding turns it into a real log.
  const [e, setE] = useState(() => ({ ...existing, auto: undefined }));
  const set = (patch) => setE((prev) => ({ ...prev, ...patch }));

  const save = () => {
    data.actions.saveDay(dayKey, e);
    onClose();
  };
  const clear = () => {
    data.actions.saveDay(dayKey, {});
    onClose();
  };

  return (
    <Sheet
      title={dayKey === today ? 'Today' : fmtLong(dayKey)}
      onClose={onClose}
      footer={
        <>
          {existing ? (
            <button className="btn danger" onClick={clear}>Clear day</button>
          ) : (
            <span />
          )}
          <button className="btn primary" onClick={save}>Save</button>
        </>
      }
    >
      <section>
        <span className="label">Period flow</span>
        <div className="chips">
          {FLOWS.map((f) => (
            <Chip key={f.id} on={(e.flow || 'none') === f.id} onClick={() => set({ flow: f.id })}>
              {f.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <span className="label">PMS</span>
        <div className="chips">
          <Chip className="pms-chip" on={!!e.pms} onClick={() => set({ pms: !e.pms })}>
            I have PMS today
          </Chip>
        </div>
      </section>

      <section>
        <span className="label">Mood</span>
        <div className="chips">
          {MOODS.map((m) => (
            <Chip key={m.id} on={(e.moods || []).includes(m.id)} onClick={() => set({ moods: toggle(e.moods, m.id) })}>
              {m.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <span className="label">Symptoms</span>
        <div className="chips">
          {SYMPTOMS.map((s) => (
            <Chip key={s.id} on={(e.symptoms || []).includes(s.id)} onClick={() => set({ symptoms: toggle(e.symptoms, s.id) })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <span className="label">Ovulation test (LH)</span>
        <div className="chips">
          {[
            ['', 'Not taken'],
            ['negative', 'Negative'],
            ['positive', 'Positive'],
          ].map(([id, label]) => (
            <Chip key={label} on={(e.lh || '') === id} onClick={() => set({ lh: id })}>
              {label}
            </Chip>
          ))}
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="field">
          <label htmlFor="temp">Basal temperature (°{data.settings.tempUnit})</label>
          <input
            id="temp"
            className="input"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder={data.settings.tempUnit === 'F' ? '97.70' : '36.50'}
            value={e.temp ?? ''}
            onChange={(ev) => set({ temp: ev.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="sex">Intimacy</label>
          <select id="sex" className="input" value={e.sex || ''} onChange={(ev) => set({ sex: ev.target.value })}>
            <option value="">None</option>
            <option value="protected">Protected</option>
            <option value="unprotected">Unprotected</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="note">Private note (never shared)</label>
        <textarea id="note" className="input" rows={3} value={e.note || ''} onChange={(ev) => set({ note: ev.target.value })} />
      </div>
    </Sheet>
  );
}
