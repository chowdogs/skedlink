import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export const notify = async (toUid, { type, title, body, tab = null }) => {
  if (!toUid) return
  try {
    await addDoc(collection(db, 'notifications', toUid, 'items'), {
      type,
      title,
      body,
      tab,
      read: false,
      createdAt: serverTimestamp(),
    })
  } catch {}
}

export const monthLastDay = (yearMonth) => {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

export const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
