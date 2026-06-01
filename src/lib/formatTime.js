export const formatHour = (hour) => {
  return hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`
}

export const formatTime24h = (hour) => {
  return `${String(hour).padStart(2, '0')}:00`
}

export const calculateOverlapHours = (user1Hours, user2Hours) => {
  let overlap = 0
  user1Hours.forEach(h => {
    if (user2Hours.includes(h)) overlap++
  })
  return overlap
}

export const calculateCompatibility = (user1Hours, user2Hours) => {
  const quietHours1 = user1Hours.filter(h => ['sleep', 'study'].includes(h.activity))
  const quietHours2 = user2Hours.filter(h => ['sleep', 'study'].includes(h.activity))
  
  const hours1 = quietHours1.map(h => h.hour)
  const hours2 = quietHours2.map(h => h.hour)
  
  let overlap = 0
  hours1.forEach(h => {
    if (hours2.includes(h)) overlap++
  })
  
  const total = Math.max(hours1.length, hours2.length)
  return total === 0 ? 0 : Math.round((overlap / total) * 100)
}
