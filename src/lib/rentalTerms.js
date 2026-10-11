export const money = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0)
export const DEFAULT_TERMS = {
  occupancy: 'shared', period: 'month', minimumStay: 1, minimumUnit: 'month',
  advancePeriods: 0, depositPeriods: 0, maintenanceCoverage: 'case_by_case',
  utilities: { water: { mode: 'included', amount: 0 }, electricity: { mode: 'included', amount: 0 }, internet: { mode: 'included', amount: 0 } },
}
export function termsFor(property = {}) {
  return { ...DEFAULT_TERMS, ...property.rentalTerms, utilities: { ...DEFAULT_TERMS.utilities, ...property.rentalTerms?.utilities } }
}
// Legacy prices were entered as per-tenant rates. Never silently reinterpret them.
export function rentalRate(property, occupancy = 'shared') {
  const capacity = Math.max(1, Number(property.capacity) || 1)
  if (!property.rentalTerms) return Number(property.price) * (occupancy === 'exclusive' ? capacity : 1)
  return Math.round(Number(property.price) / (occupancy === 'shared' ? capacity : 1) * 100) / 100
}
export function priceLabel(property) {
  const terms = termsFor(property)
  const mode = terms.occupancy === 'exclusive' ? 'exclusive' : 'shared'
  return `${money(rentalRate(property, mode))} / ${mode === 'exclusive' ? 'room' : 'bed'} / ${terms.period === 'day' ? 'night' : terms.period}`
}
export function initialCharges(property, occupancy, periods = 1) {
  const terms = termsFor(property), rate = rentalRate(property, occupancy)
  const items = [{ id: 'rent', label: terms.period === 'month' ? 'First month rent' : `Accommodation (${periods} ${terms.period === 'day' ? 'nights' : 'weeks'})`, amount: Math.round(rate * (terms.period === 'month' ? 1 : periods) * 100) / 100 }]
  if (Number(terms.advancePeriods)) items.push({ id: 'advance', label: `Reusable advance (${terms.advancePeriods} periods)`, amount: rate * Number(terms.advancePeriods) })
  if (Number(terms.depositPeriods)) items.push({ id: 'deposit', label: `Security deposit (${terms.depositPeriods} periods)`, amount: rate * Number(terms.depositPeriods) })
  Object.entries(terms.utilities).forEach(([key, utility]) => {
    if (utility.mode === 'fixed') items.push({ id: key, label: `${key} (fixed per tenant / billing period)`, amount: Number(utility.amount) * (terms.period === 'month' ? 1 : periods) })
  })
  return items.map(item => ({ ...item, amount: Math.round(item.amount * 100) / 100 }))
}
export const PLANS = [1, 2, 4, 6, 8, 10].map(limit => ({ limit, amount: limit === 1 ? 0 : limit * 150, label: limit === 1 ? 'Free' : `Premium ${limit}` }))
export function listingLimit(subscription) {
  const expiry = subscription?.expiresAt?.toMillis?.() || Number(subscription?.expiresAt || 0)
  return subscription?.status === 'active' && expiry > Date.now() ? Number(subscription.limit) : 1
}
export function formatDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null)
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded'
}
