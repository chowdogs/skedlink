import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export const DEFAULT_ACTIVITIES = [
  { id: 'sleep',  label: 'Sleep',             hex: '#6366f1' },
  { id: 'school', label: 'At School',         hex: '#3b82f6' },
  { id: 'work',   label: 'Working',           hex: '#f59e0b' },
  { id: 'dayoff', label: 'Day Off',           hex: '#10b981' },
  { id: 'out',    label: 'Out of the House',  hex: '#f97316' },
]

export const CUSTOM_PALETTE = [
  '#f472b6', '#a78bfa', '#34d399', '#fb923c',
  '#f87171', '#60a5fa', '#a3e635', '#e879f9'
]

const buildEmptySchedule = () => {
  const s = {}
  DAYS.forEach(day => {
    s[day] = {}
    for (let h = 0; h < 24; h++) s[day][h] = 'dayoff'
  })
  return s
}

export const useSchedulePainter = (userId) => {
  const [schedule, setSchedule] = useState(buildEmptySchedule())
  const [customActivities, setCustomActivities] = useState([])
  const [currentActivity, setCurrentActivity] = useState('sleep')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', userId))
        if (snap.exists()) {
          const data = snap.data()
          if (data.weeklySchedule) setSchedule(data.weeklySchedule)
          if (data.customActivities) setCustomActivities(data.customActivities)
        }
      } catch (err) {
        console.error('Failed to load schedule:', err)
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [userId])

  const updateHour = useCallback((day, hour, activity) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [hour]: activity }
    }))
  }, [])

  const reset = useCallback(() => setSchedule(buildEmptySchedule()), [])

  const saveSchedule = async () => {
    if (!userId) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', userId), { weeklySchedule: schedule, customActivities })
    } finally {
      setSaving(false)
    }
  }

  const addCustomActivity = async (label, hex) => {
    const newAct = { id: `custom_${Date.now()}`, label, hex }
    const updated = [...customActivities, newAct]
    setCustomActivities(updated)
    setCurrentActivity(newAct.id)
    if (userId) await updateDoc(doc(db, 'users', userId), { customActivities: updated })
  }

  const removeCustomActivity = async (id) => {
    const updated = customActivities.filter(a => a.id !== id)
    setCustomActivities(updated)
    if (currentActivity === id) setCurrentActivity('sleep')
    // Replace removed activity slots with 'dayoff'
    setSchedule(prev => {
      const next = { ...prev }
      DAYS.forEach(day => {
        const daySlots = { ...next[day] }
        Object.keys(daySlots).forEach(h => {
          if (daySlots[h] === id) daySlots[h] = 'dayoff'
        })
        next[day] = daySlots
      })
      return next
    })
    if (userId) await updateDoc(doc(db, 'users', userId), { customActivities: updated })
  }

  const allActivities = [...DEFAULT_ACTIVITIES, ...customActivities]

  const getActivityHex = (actId) => {
    const act = allActivities.find(a => a.id === actId)
    return act?.hex || '#cbd5e1'
  }

  return {
    schedule, currentActivity, setCurrentActivity,
    updateHour, reset, saveSchedule, saving, loaded,
    customActivities, addCustomActivity, removeCustomActivity,
    allActivities, getActivityHex, DAYS
  }
}
