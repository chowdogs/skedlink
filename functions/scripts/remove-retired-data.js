// Preview by default. This retires the old manual-proof payment records and chores.
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

async function main() {
  const args = process.argv.slice(2), at = args.indexOf('--project')
  const projectId = at >= 0 ? args[at + 1] : null, apply = args.includes('--apply')
  if (!projectId || !/^[a-z][a-z0-9-]{4,29}$/.test(projectId)) throw new Error('Pass --project with the Firebase project ID.')
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) throw new Error('GCLOUD_PROJECT does not match --project.')
  initializeApp({ projectId })
  const db = getFirestore()
  const [bills, payments, chores] = await Promise.all(['bills', 'payments', 'chores'].map(name => db.collection(name).get()))
  const oldBills = bills.docs.filter(doc => doc.data().schemaVersion !== 2)
  const oldPayments = payments.docs.filter(doc => !['paymongo_test', 'advance'].includes(doc.data().method))
  console.log(JSON.stringify({ projectId, mode: apply ? 'apply' : 'dry-run', legacyBills: oldBills.length, legacyPayments: oldPayments.length, chores: chores.size }, null, 2))
  if (!apply) return
  for (const doc of [...oldPayments, ...oldBills, ...chores.docs]) await db.recursiveDelete(doc.ref)
  console.log('Retired records removed.')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
