import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'
import { auth } from '../firebase'

const functions = getFunctions(auth.app, 'asia-southeast1')
if (process.env.REACT_APP_USE_EMULATORS === 'true') connectFunctionsEmulator(functions, '127.0.0.1', 5001)
export async function platform(action, payload = {}) {
  try {
    const result = await httpsCallable(functions, 'platform')({ action, ...payload })
    return result.data
  } catch (error) {
    if (['functions/unavailable', 'functions/internal', 'functions/not-found'].includes(error.code)) {
      throw new Error('The secure service is unavailable. Please try again after the server is connected.')
    }
    throw error
  }
}
export async function checkout(payload) {
  const result = await httpsCallable(functions, 'createCheckout')(payload)
  window.location.assign(result.data.url)
}
export async function refreshCheckout(id, cancel = false) {
  const result = await httpsCallable(functions, 'refreshCheckout')({ id, cancel })
  return result.data
}
export async function uploadContract(file, path) {
  if (!file || file.type !== 'application/pdf' || file.size > 5 * 1024 * 1024) throw new Error('Choose a PDF under 5 MB.')
  const { ref, uploadBytes } = await import('firebase/storage')
  const { storage } = await import('../firebase')
  const target = ref(storage, path)
  await uploadBytes(target, file, { contentType: 'application/pdf' })
  return { path, name: file.name }
}
export async function downloadContract(file) {
  const { getBlob, ref } = await import('firebase/storage')
  const { storage } = await import('../firebase')
  const blob = await getBlob(ref(storage, file.path))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = file.name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
