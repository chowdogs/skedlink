// Database triggers generate notifications after successful writes.
export const notify = async () => {}

export const monthLastDay = (yearMonth) => {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
