const cents = value => Math.round(Number(value) * 100)
const amount = value => cents(value) / 100
function assert(condition, message) { if (!condition) throw new Error(message) }
function normalizeTerms(p) {
  const legacy = !p.rentalTerms
  const t = { occupancy: 'shared', period: 'month', minimumStay: 1, minimumUnit: 'month', advancePeriods: 0, depositPeriods: 0, maintenanceCoverage: 'case_by_case', utilities: {}, ...p.rentalTerms }
  assert(['shared', 'exclusive', 'both'].includes(t.occupancy), 'Choose occupancy.')
  assert(['day', 'week', 'month'].includes(t.period), 'Invalid billing period.')
  assert(['day', 'week', 'month'].includes(t.minimumUnit), 'Invalid minimum stay unit.')
  assert(Number.isInteger(t.minimumStay) && t.minimumStay >= 1 && t.minimumStay <= 365, 'Minimum stay must be 1–365 units.')
  for (const key of ['advancePeriods', 'depositPeriods']) assert(Number.isInteger(t[key]) && t[key] >= 0 && t[key] <= 24, 'Advance/deposit must be 0–24 rental periods.')
  assert(['landlord', 'tenant', 'case_by_case'].includes(t.maintenanceCoverage), 'Invalid maintenance policy.')
  assert(Number.isFinite(Number(p.price)) && cents(p.price) > 0, 'Enter a positive room rate.')
  assert(Number.isInteger(Number(p.capacity)) && Number(p.capacity) >= 1 && Number(p.capacity) <= 100, 'Capacity must be 1–100.')
  for (const [key, u] of Object.entries(t.utilities)) {
    assert(['water', 'electricity', 'internet'].includes(key), 'Unknown utility.')
    assert(['included', 'fixed', 'variable'].includes(u.mode), 'Invalid utility policy.')
    if (u.mode === 'fixed') assert(Number.isFinite(Number(u.amount)) && cents(u.amount) > 0, 'Fixed utilities need a positive amount.')
  }
  return { ...t, legacy }
}
function addUnits(date, count, unit) {
  const d = new Date(`${date}T00:00:00Z`)
  assert(!Number.isNaN(d.getTime()), 'Invalid date.')
  if (unit === 'month') {
    const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + count)
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
    d.setUTCDate(Math.min(day, last))
  } else d.setUTCDate(d.getUTCDate() + count * (unit === 'week' ? 7 : 1))
  return d.toISOString().slice(0, 10)
}
function quote(p, selection) {
  const t = normalizeTerms(p), capacity = Number(p.capacity)
  const { occupancy, startDate, endDate } = selection
  assert(['shared', 'exclusive'].includes(occupancy) && (t.occupancy === 'both' || t.occupancy === occupancy), 'This occupancy option is unavailable.')
  assert(/^\d{4}-\d{2}-\d{2}$/.test(startDate) && new Date(`${startDate}T00:00:00Z`).toISOString().slice(0, 10) === startDate, 'Choose a valid check-in date.')
  assert(/^\d{4}-\d{2}-\d{2}$/.test(endDate) && new Date(`${endDate}T00:00:00Z`).toISOString().slice(0, 10) === endDate, 'Choose a valid check-out date.')
  assert(endDate >= addUnits(startDate, t.minimumStay, t.minimumUnit), 'Stay does not meet the listing minimum.')
  const nights = (Date.parse(endDate) - Date.parse(startDate)) / 86400000
  assert(nights > 0 && nights <= 3660, 'Choose a stay of up to ten years.')
  const periods = t.period === 'day' ? nights : t.period === 'week' ? Math.ceil(nights / 7) : 1
  const rate = amount(Number(p.price) * (t.legacy ? (occupancy === 'exclusive' ? capacity : 1) : (occupancy === 'shared' ? 1 / capacity : 1)))
  const lineItems = [{ id: 'rent', label: t.period === 'month' ? 'First month rent' : `Accommodation (${periods} ${t.period === 'day' ? 'nights' : 'weeks'})`, amount: amount(rate * periods) }]
  if (t.advancePeriods) lineItems.push({ id: 'advance', label: 'Reusable advance rent', amount: amount(rate * t.advancePeriods) })
  if (t.depositPeriods) lineItems.push({ id: 'deposit', label: 'Security deposit', amount: amount(rate * t.depositPeriods) })
  for (const [key, u] of Object.entries(t.utilities)) if (u.mode === 'fixed') lineItems.push({ id: key, label: `${key} — fixed charge`, amount: amount(Number(u.amount) * periods) })
  return { occupancy, startDate, endDate, period: t.period, rate, periods, lineItems, total: amount(lineItems.reduce((s, i) => s + i.amount, 0)), terms: t, houseRules: p.houseRules || '' }
}
function overlaps(a, b) { return a.startDate < b.endDate && b.startDate < a.endDate }
function available(p, selection, reservations, now = Date.now()) {
  const holds = reservations.filter(r => (r.status === 'approved' || r.expiresAt > now) && overlaps(r, selection))
  if (holds.some(r => r.occupancy === 'exclusive')) return false
  if (selection.occupancy === 'exclusive') return holds.length === 0
  const events = holds.flatMap(r => [[r.startDate > selection.startDate ? r.startDate : selection.startDate, 1], [r.endDate < selection.endDate ? r.endDate : selection.endDate, -1]])
    .sort((a,b) => a[0].localeCompare(b[0]) || a[1] - b[1])
  let occupied = 1
  for (const [, delta] of events) { occupied += delta; if (occupied > Number(p.capacity)) return false }
  return Number(p.capacity) >= 1
}
function plan(limit) {
  assert([1, 2, 4, 6, 8, 10].includes(Number(limit)), 'Choose a supported plan.')
  return { limit: Number(limit), amount: Number(limit) === 1 ? 0 : Number(limit) * 150 }
}
function split(total, count) {
  assert(Number.isFinite(total) && Number.isInteger(count) && count > 0 && cents(total) >= count, 'Amount must cover all selected tenants.')
  const all = cents(total), base = Math.floor(all / count), remainder = all % count
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100)
}
function score(a = {}, tenants = []) {
  const quiet = s => Object.entries(s).flatMap(([d, hours]) => Object.entries(hours || {}).filter(([, v]) => ['sleep', 'study', 'school'].includes(v)).map(([h]) => `${d}-${h}`))
  const own = quiet(a)
  if (!tenants.length) return null
  const scores = tenants.map(t => { const other = quiet(t); const total = Math.max(own.length, other.length); return total ? own.filter(s => other.includes(s)).length / total * 100 : null }).filter(s => s !== null)
  return scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null
}
module.exports = { cents, amount, assert, normalizeTerms, addUnits, quote, available, plan, split, score }
