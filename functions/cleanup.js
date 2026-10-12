const { FieldValue } = require('firebase-admin/firestore')

async function cleanupDeletedProperty(db, storage, id) {
  const inquiries = await db.collection('inquiries').where('propertyId', '==', id).get()
  for (const inquiry of inquiries.docs) {
    await storage.bucket().deleteFiles({ prefix: `contracts/${inquiry.id}/`, force: true })
    if (inquiry.data().tenantUid) await db.collection('applicationLocks').doc(`${inquiry.data().tenantUid}_${id}`).delete()
    await db.recursiveDelete(inquiry.ref)
  }
  for (const collection of ['maintenanceRequests', 'moveoutRequests', 'announcements', 'chores', 'tenantAccounts', 'advanceRequests']) {
    const records = await db.collection(collection).where('propertyId', '==', id).get()
    for (const record of records.docs) await db.recursiveDelete(record.ref)
  }
  await db.recursiveDelete(db.collection('propertyChats').doc(id))
  await db.recursiveDelete(db.collection('roomReservations').doc(id))
}

// Auth deletion is asynchronous. Keep this idempotent so retries can finish a partial cleanup.
async function cleanupDeletedUser(db, storage, uid) {
  const owned = await db.collection('properties').where('ownerId', '==', uid).get()
  const ownedIds = new Set(owned.docs.map(doc => doc.id))
  const memberships = await db.collection('properties').where('tenants', 'array-contains', uid).get()

  for (const property of memberships.docs) {
    if (ownedIds.has(property.id)) continue
    await property.ref.update({
      tenants: FieldValue.arrayRemove(uid),
      [`tenantDetails.${uid}`]: FieldValue.delete(),
    })
    const reservation = db.collection('roomReservations').doc(property.id)
    const holds = (await reservation.get()).data()?.holds || {}
    const removed = Object.entries(holds).filter(([, hold]) => hold.tenantUid === uid).map(([id]) => id)
    if (removed.length) await reservation.update(Object.fromEntries(removed.map(id => [`holds.${id}`, FieldValue.delete()])))
    const chat = db.collection('propertyChats').doc(property.id)
    if ((await chat.get()).exists) await chat.update({ participantUids: FieldValue.arrayRemove(uid), [`participantNames.${uid}`]: FieldValue.delete() })
  }

  const direct = await db.collection('directMessages').where('participants', 'array-contains', uid).get()
  for (const chat of direct.docs) await db.recursiveDelete(chat.ref)

  const inquiryRefs = new Map()
  for (const [field, value] of [['tenantUid', uid], ['landlordUid', uid], ...[...ownedIds].map(id => ['propertyId', id])]) {
    const snapshot = await db.collection('inquiries').where(field, '==', value).get()
    snapshot.docs.forEach(doc => inquiryRefs.set(doc.id, { ref: doc.ref, propertyId: doc.data().propertyId, tenantUid: doc.data().tenantUid }))
  }
  for (const [id, inquiry] of inquiryRefs) {
    await storage.bucket().deleteFiles({ prefix: `contracts/${id}/`, force: true })
    await db.recursiveDelete(inquiry.ref)
  }

  const collections = {
    bills: ['tenantUid', 'landlordUid', 'propertyId'],
    payments: ['tenantUid', 'landlordUid', 'propertyId'],
    tenantAccounts: ['tenantUid', 'landlordUid', 'propertyId'],
    advanceRequests: ['tenantUid', 'landlordUid', 'propertyId'],
    checkoutOrders: ['uid'],
    maintenanceRequests: ['tenantUid', 'landlordUid', 'propertyId'],
    moveoutRequests: ['tenantUid', 'landlordUid', 'propertyId'],
    announcements: ['landlordUid', 'propertyId'],
    chores: ['assignedTo', 'landlordUid', 'propertyId'],
  }
  for (const [collection, fields] of Object.entries(collections)) {
    const refs = new Map()
    for (const field of fields) {
      for (const value of field === 'propertyId' ? ownedIds : [uid]) {
        const snapshot = await db.collection(collection).where(field, '==', value).get()
        snapshot.docs.forEach(doc => refs.set(doc.id, doc.ref))
      }
    }
    for (const ref of refs.values()) await db.recursiveDelete(ref)
  }

  for (const id of ownedIds) {
    await db.recursiveDelete(db.collection('propertyChats').doc(id))
    await db.recursiveDelete(db.collection('roomReservations').doc(id))
    await db.recursiveDelete(db.collection('properties').doc(id))
  }
  for (const collection of ['subscriptions', 'customPlanRequests', 'landlordInventory']) {
    await db.recursiveDelete(db.collection(collection).doc(uid))
  }
  for (const [id, inquiry] of inquiryRefs) {
    if (inquiry.tenantUid && inquiry.propertyId) await db.collection('applicationLocks').doc(`${inquiry.tenantUid}_${inquiry.propertyId}`).delete()
  }
  await db.recursiveDelete(db.collection('notifications').doc(uid))
  await db.recursiveDelete(db.collection('users').doc(uid))
}

module.exports = { cleanupDeletedUser, cleanupDeletedProperty }
