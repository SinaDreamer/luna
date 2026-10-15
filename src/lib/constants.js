export const FLOWS = [
  { id: 'none', label: 'None' },
  { id: 'spotting', label: 'Spotting' },
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'heavy', label: 'Heavy' },
];

// `pms: true` marks symptoms that count as PMS when they show up in the days before a period.
export const SYMPTOMS = [
  { id: 'cramps', label: 'Cramps', pms: true },
  { id: 'bloating', label: 'Bloating', pms: true },
  { id: 'tender_breasts', label: 'Tender breasts', pms: true },
  { id: 'headache', label: 'Headache', pms: true },
  { id: 'acne', label: 'Acne', pms: true },
  { id: 'back_pain', label: 'Back pain', pms: true },
  { id: 'fatigue', label: 'Fatigue', pms: true },
  { id: 'cravings', label: 'Cravings', pms: true },
  { id: 'insomnia', label: 'Insomnia', pms: true },
  { id: 'nausea', label: 'Nausea', pms: false },
  { id: 'digestion', label: 'Upset stomach', pms: false },
  { id: 'discharge', label: 'Egg-white discharge', pms: false },
];

export const MOODS = [
  { id: 'happy', label: 'Happy', pms: false },
  { id: 'calm', label: 'Calm', pms: false },
  { id: 'energetic', label: 'Energetic', pms: false },
  { id: 'loving', label: 'Affectionate', pms: false },
  { id: 'irritable', label: 'Irritable', pms: true },
  { id: 'anxious', label: 'Anxious', pms: true },
  { id: 'sad', label: 'Sad', pms: true },
  { id: 'mood_swings', label: 'Mood swings', pms: true },
  { id: 'sensitive', label: 'Sensitive', pms: true },
];

export const PMS_SIGNS = new Set([...SYMPTOMS, ...MOODS].filter((s) => s.pms).map((s) => s.id));

export const LABELS = Object.fromEntries([...SYMPTOMS, ...MOODS].map((s) => [s.id, s.label]));

export const PHASES = {
  menstrual: {
    label: 'Period',
    blurb: 'Hormones are at their lowest, so energy can dip.',
    tips: ['Offer a hot water bottle or tea', 'Keep painkillers and snacks stocked', 'Plan cosy, low-effort evenings'],
  },
  follicular: {
    label: 'Follicular phase',
    blurb: 'Estrogen is rising, and energy and mood often lift.',
    tips: ['A good week for plans and dates', 'Try something active together'],
  },
  fertile: {
    label: 'Fertile window',
    blurb: 'Pregnancy is possible on these days.',
    tips: ['Fertile days: be mindful of contraception', 'Energy and confidence are often high'],
  },
  ovulation: {
    label: 'Ovulation',
    blurb: 'Estimated ovulation day, at peak fertility.',
    tips: ['Peak fertility today', 'Often a high-energy, social day'],
  },
  luteal: {
    label: 'Luteal phase',
    blurb: 'Progesterone rises, and she may want more rest.',
    tips: ['Be patient if energy dips', 'Help out with chores'],
  },
  pms: {
    label: 'PMS days',
    blurb: 'PMS symptoms are likely before the next period.',
    tips: ['Extra patience and kindness go a long way', 'Bring her favourite comfort food', "Don't take irritability personally", 'Ask what would help, then listen'],
  },
  late: {
    label: 'Period late',
    blurb: 'The period is later than predicted. Stress, travel or illness can shift cycles.',
    tips: ['Stay calm and supportive', 'Let her share when she wants to'],
  },
};

export const DEFAULT_SHARING = { fertility: true, pms: true, symptoms: true };
