import { uploadBytesResumable, getDownloadURL } from 'firebase/storage'

export const uploadFile = (storageRef, file, timeoutMs = 30000) =>
  new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file)
    const timer = setTimeout(() => {
      task.cancel()
      reject(new Error(
        'Upload timed out. Go to Firebase Console → Storage → Rules and set: allow read, write: if request.auth != null;'
      ))
    }, timeoutMs)
    task.on(
      'state_changed',
      null,
      (err) => { clearTimeout(timer); reject(err) },
      async () => {
        clearTimeout(timer)
        resolve(await getDownloadURL(task.snapshot.ref))
      }
    )
  })
