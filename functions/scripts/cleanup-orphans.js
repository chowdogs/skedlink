const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')
const { cleanupDeletedUser } = require('../cleanup')

async function main() {
  const args = process.argv.slice(2)
  const index = args.indexOf('--project')
  const projectId = index >= 0 ? args[index + 1] : null
  const apply = args.includes('--apply')
  if (!projectId || !/^[a-z][a-z0-9-]{4,29}$/.test(projectId)) throw new Error('Pass --project with the Firebase project ID.')
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) throw new Error('GCLOUD_PROJECT does not match --project.')
  initializeApp({ projectId })
  const db = getFirestore(), auth = getAuth(), candidates = new Set()
  for (const [collection, fields] of [
    ['users', []], ['notifications', []], ['landlordInventory', []],
    ['properties', ['ownerId', 'tenants']],
    ['inquiries', ['landlordUid', 'tenantUid']],
    ['tenantAccounts', ['landlordUid', 'tenantUid']],
    ['bills', ['landlordUid', 'tenantUid']],
    ['payments', ['landlordUid', 'tenantUid']],
    ['advanceRequests', ['landlordUid', 'tenantUid']],
    ['checkoutOrders', ['uid']],
    ['maintenanceRequests', ['landlordUid', 'tenantUid']],
    ['moveoutRequests', ['landlordUid', 'tenantUid']],
    ['announcements', ['landlordUid']],
    ['chores', ['landlordUid', 'assignedTo']],
    ['subscriptions', ['landlordUid']], ['customPlanRequests', ['landlordUid']],
  ]) {
    const snapshot = await db.collection(collection).get()
    for (const doc of snapshot.docs) {
      if (['users', 'notifications', 'landlordInventory', 'subscriptions', 'customPlanRequests'].includes(collection)) candidates.add(doc.id)
      for (const field of fields) {
        const value = doc.data()[field]
        for (const uid of Array.isArray(value) ? value : [value]) if (typeof uid === 'string' && uid) candidates.add(uid)
      }
    }
  }
  const missing = []
  for (const uid of candidates) {
    try { await auth.getUser(uid) }
    catch (error) {
      if (error.code !== 'auth/user-not-found') throw error
      missing.push(uid)
    }
  }
  console.log(JSON.stringify({ projectId, mode: apply ? 'apply' : 'dry-run', checked: candidates.size, orphanedUsers: missing }, null, 2))
  if (!apply) return
  for (const uid of missing) {
    await cleanupDeletedUser(db, getStorage(), uid)
    console.log(`Cleaned ${uid}`)
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
