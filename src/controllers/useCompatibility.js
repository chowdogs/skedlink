import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// Extract all quiet-hour slots from a weeklySchedule (e.g. "monday-0", "tuesday-14")
const getQuietSlots = (weeklySchedule) => {
  const slots = []
  DAYS.forEach(day => {
    Object.entries(weeklySchedule?.[day] || {}).forEach(([hour, activity]) => {
      if (activity === 'sleep' || activity === 'study' || activity === 'school') {
        slots.push(`${day}-${hour}`)
      }
    })
  })
  return slots
}

// Compare seeker's schedule against an array of tenant schedules.
// 0 tenants → 100%. Otherwise average pairwise overlap score.
const calcPropertyScore = (seekerSchedule, tenantSchedules) => {
  if (tenantSchedules.length === 0) return 100

  const seekerQuiet = getQuietSlots(seekerSchedule)

  const scores = tenantSchedules.map(ts => {
    const tenantQuiet = getQuietSlots(ts)
    const overlap = seekerQuiet.filter(s => tenantQuiet.includes(s)).length
    const total = Math.max(seekerQuiet.length, tenantQuiet.length)
    return total > 0 ? Math.round((overlap / total) * 100) : 100
  })

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

export const useCompatibility = (seekerProfile) => {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!seekerProfile?.uid) {
      setLoading(false)
      return
    }

    const unsub = onSnapshot(collection(db, 'properties'), async (snapshot) => {
      const properties = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))

      const scored = await Promise.all(
        properties.map(async (property) => {
          const tenantUids = property.tenants || []

          const tenantSchedules = await Promise.all(
            tenantUids.map(async (uid) => {
              try {
                const snap = await getDoc(doc(db, 'users', uid))
                return snap.exists() ? (snap.data().weeklySchedule || {}) : {}
              } catch {
                return {}
              }
            })
          )

          const score = calcPropertyScore(seekerProfile.weeklySchedule || {}, tenantSchedules)
          const restriction = property.rules?.genderRestriction
          const seekerGender = seekerProfile.gender
          const genderBlocked = restriction && restriction !== 'none' && seekerGender && seekerGender !== restriction
          return { ...property, score: genderBlocked ? 0 : score }
        })
      )

      setResults(scored.sort((a, b) => b.score - a.score))
      setLoading(false)
    })

    return unsub
  // Re-score when the seeker saves a new schedule
  }, [seekerProfile?.uid, JSON.stringify(seekerProfile?.weeklySchedule)])

  return { results, loading }
}
