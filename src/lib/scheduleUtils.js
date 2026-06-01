const JS_DAY_TO_KEY = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

const getCurrentDayKey = () => JS_DAY_TO_KEY[new Date().getDay()]
const getCurrentHour = () => new Date().getHours()

// Returns a grammatically safe predicate phrase for "is ___"
// Works for any activity name — known or custom user-defined.
export const getActivityPhrase = (actId, customActivities = []) => {
  const defaults = {
    sleep:  'sleeping',
    school: 'at school',
    work:   'working',
    dayoff: 'on a day off',
    out:    'out of the house',
  }
  if (defaults[actId]) return defaults[actId]

  // Resolve custom activity label
  const custom = customActivities.find(c => c.id === actId)
  const label = (custom?.label || actId).trim()

  // Already a gerund (ends in -ing) → use as-is lowercase: "Studying" → "studying"
  if (label.toLowerCase().endsWith('ing')) return label.toLowerCase()

  // Starts with a preposition-like phrase → use as-is: "At the gym" → "at the gym"
  const lower = label.toLowerCase()
  if (/^(at |in |on |out |near )/.test(lower)) return lower

  // Fallback: "doing [label]" — always grammatically correct
  return `doing ${label}`
}

// Returns null if no meaningful activity (dayoff / no schedule)
export const getCurrentActivityPhrase = (weeklySchedule, customActivities = []) => {
  if (!weeklySchedule) return null
  const day = getCurrentDayKey()
  const hour = getCurrentHour()
  const actId = weeklySchedule[day]?.[hour]
  if (!actId || actId === 'dayoff') return null
  return getActivityPhrase(actId, customActivities)
}
