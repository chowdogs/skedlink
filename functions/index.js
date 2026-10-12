const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret, defineString } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getStorage } = require('firebase-admin/storage')
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore')
const crypto = require('node:crypto')
const D = require('./domain')
initializeApp()
const db = getFirestore(), region = 'asia-southeast1'
const paymongoKey = defineSecret('PAYMONGO_SECRET_KEY'), webhookKey = defineSecret('PAYMONGO_WEBHOOK_SECRET')
const appUrl = defineString('APP_URL', { default: 'http://localhost:3000' })
const stamp = () => FieldValue.serverTimestamp()
const ref = (c, id) => { D.assert(typeof id === 'string' && id.length > 0 && !id.includes('/'), 'Invalid record.'); return db.collection(c).doc(id) }
const must = D.assert
async function record(c, id) { const snap = await ref(c, id).get(); must(snap.exists, 'Record not found.'); return { id: snap.id, ...snap.data() } }
function landlord(user) { must(user.role === 'owner', 'Landlord access required.') }
function owner(p, uid) { must(p.ownerId === uid, 'This listing belongs to another landlord.') }
const privateSummary = u => ({ name: u.fullName || 'Tenant', profilePhoto: u.profilePhoto || '' })
const participant = (i, uid) => must([i.tenantUid, i.landlordUid].includes(uid), 'You cannot access this application.')

exports.platform = onCall({ region, invoker: 'public' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')
  try {
    const uid = request.auth.uid, data = request.data || {}, user = await record('users', uid)
    switch (data.action) {
      case 'saveProperty': {
        landlord(user)
        const input = data.property, t = D.normalizeTerms(input)
        must(input.title?.trim() && input.location, 'Title and location are required.')
        const id = data.id || db.collection('properties').doc().id
        const pRef = ref('properties', id), inventory = ref('landlordInventory', uid)
        await db.runTransaction(async tx => {
          const [pSnap, inventorySnap, subSnap] = await Promise.all([tx.get(pRef), tx.get(inventory), tx.get(ref('subscriptions', uid))])
          if (pSnap.exists) { owner(pSnap.data(), uid); must(Number(input.capacity) >= (pSnap.data().tenants || []).length, 'Capacity cannot be below current occupancy.') }
          const sub = subSnap.data(), limit = sub?.status === 'active' && sub.expiresAt.toMillis() > Date.now() ? sub.limit : 1
          const ids = inventorySnap.data()?.listingIds || []
          if (!pSnap.exists) must(ids.length < limit, `Your plan allows ${limit} listing(s). Upgrade in Plans.`)
          const allowed = ['title','description','price','capacity','propertyType','amenities','rules','photos','location','permits','houseRules','emergencyContacts','rentalTerms']
          const clean = Object.fromEntries(allowed.filter(k => input[k] !== undefined).map(k => [k, input[k]]))
          clean.price = Number(input.price); clean.capacity = Number(input.capacity); clean.rentalTerms = { ...t }; delete clean.rentalTerms.legacy
          tx.set(pRef, { ...clean, ownerId: uid, updatedAt: stamp(), ...(!pSnap.exists ? { createdAt: stamp(), tenants: [], tenantDetails: {} } : {}) }, { merge: true })
          if (!pSnap.exists) tx.set(inventory, { listingIds: [...ids, id] })
        })
        return { id }
      }
      case 'deleteProperty': {
        const p = await record('properties', data.id); owner(p, uid)
        await db.runTransaction(async tx => {
          const pRef = ref('properties', data.id), rRef = ref('roomReservations', data.id), inv = ref('landlordInventory', uid)
          const [ps, rs] = await Promise.all([tx.get(pRef), tx.get(rRef)])
          must(!(ps.data().tenants || []).length && !Object.values(rs.data()?.holds || {}).some(h => h.status === 'approved' || h.expiresAt > Date.now()), 'Close active tenancies and reservations before deleting.')
          tx.delete(pRef); tx.set(inv, { listingIds: FieldValue.arrayRemove(data.id) }, { merge: true })
        }); return { ok: true }
      }
      case 'apply': {
        must(user.role === 'seeker', 'Seeker access required.')
        const p = await record('properties', data.propertyId)
        must(!(p.tenants || []).includes(uid), 'You are already a tenant of this room.')
        const [inventory, subscription] = await Promise.all([ref('landlordInventory', p.ownerId).get(), ref('subscriptions', p.ownerId).get()])
        const sub = subscription.data(), limit = sub?.status === 'active' && sub.expiresAt.toMillis() > Date.now() ? sub.limit : 1
        must((inventory.data()?.listingIds || []).slice(0, limit).includes(p.id), 'This room is not accepting new applications under the landlord’s current plan.')
        const selection = D.quote(p, data.selection)
        must(selection.startDate >= new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }), 'Check-in cannot be in the past.')
        const id = db.collection('inquiries').doc().id
        await db.runTransaction(async tx => {
          const lock = ref('applicationLocks', `${uid}_${p.id}`), locked = await tx.get(lock)
          const iRef = ref('inquiries', id), old = locked.exists ? await tx.get(ref('inquiries', locked.data().id)) : { exists: false }
          must(!old.exists || ['closed', 'cancelled', 'rejected', 'expired'].includes(old.data().status), 'An application already exists for this room.')
          tx.set(iRef, { propertyId: p.id, propertyTitle: p.title, landlordUid: p.ownerId, tenantUid: uid, tenantName: user.fullName, tenantEmail: user.email, tenantPhone: user.phone || '', type: data.type === 'visit' ? 'visit' : 'rent', message: String(data.message || '').slice(0, 2000), selection, status: 'pending', unreadByOwner: true, unreadByTenant: false, createdAt: stamp() })
          tx.set(lock, { id })
        }); return { id }
      }
      case 'sendContract': {
        const i = await record('inquiries', data.id); must(i.landlordUid === uid, 'Landlord access required.')
        must(i.type === 'rent', 'Only rental applications need a contract.')
        must(data.file?.path?.startsWith(`contracts/${i.id}/${uid}/`), 'Upload a contract first.')
        must((await getStorage().bucket().file(data.file.path).exists())[0], 'Contract upload is missing.')
        await db.runTransaction(async tx => {
          const iRef = ref('inquiries', i.id), pRef = ref('properties', i.propertyId), rRef = ref('roomReservations', i.propertyId)
          const [is, ps, rs] = await Promise.all([tx.get(iRef), tx.get(pRef), tx.get(rRef)])
          must(['pending','active','contract_sent','contract_submitted'].includes(is.data().status), 'Application is no longer editable.')
          const p = ps.data(), selection = D.quote(p, is.data().selection || data.selection), holds = rs.data()?.holds || {}
          const legacyTenants = (p.tenants || []).filter(t => !Object.values(holds).some(h => h.tenantUid === t && h.status === 'approved'))
          must(selection.occupancy === 'exclusive' ? legacyTenants.length === 0 : legacyTenants.length < Number(p.capacity), 'Room is occupied.')
          must(D.available({ ...p, capacity: Number(p.capacity) - legacyTenants.length }, selection, Object.entries(holds).filter(([key]) => key !== i.id).map(([, h]) => h)), 'Room is unavailable for these dates.')
          const expiresAt = Date.now() + 48 * 3600000
          tx.set(rRef, { holds: { ...holds, [i.id]: { ...selection, tenantUid: i.tenantUid, status: 'reserved', expiresAt } } })
          tx.update(iRef, { selection, contract: data.file, signedContract: FieldValue.delete(), status: 'contract_sent', contractSentAt: stamp(), reservationExpiresAt: Timestamp.fromMillis(expiresAt), unreadByTenant: true })
        }); return { ok: true }
      }
      case 'submitContract': {
        const i = await record('inquiries', data.id); must(i.tenantUid === uid, 'Tenant access required.')
        must(data.file?.path?.startsWith(`contracts/${i.id}/${uid}/`), 'Upload the signed PDF first.')
        must((await getStorage().bucket().file(data.file.path).exists())[0], 'Signed contract upload is missing.')
        await db.runTransaction(async tx => {
          const r = ref('inquiries', i.id), s = await tx.get(r)
          must(s.data().status === 'contract_sent' && s.data().reservationExpiresAt.toMillis() > Date.now(), 'Contract reservation has expired or changed.')
          tx.update(r, { signedContract: data.file, signedAt: stamp(), status: 'contract_submitted', unreadByOwner: true })
        }); return { ok: true }
      }
      case 'acceptContract': {
        const i = await record('inquiries', data.id); must(i.landlordUid === uid, 'Landlord access required.')
        await db.runTransaction(async tx => {
          const r = ref('inquiries', i.id), s = await tx.get(r), current = s.data()
          must(current.status === 'contract_submitted' && current.signedContract && current.reservationExpiresAt.toMillis() > Date.now(), 'A valid signed contract is required.')
          tx.update(r, { status: 'awaiting_payment', contractAcceptedAt: stamp(), unreadByTenant: true })
          tx.set(ref('bills', `initial_${i.id}`), { propertyId: i.propertyId, propertyTitle: i.propertyTitle, landlordUid: uid, tenantUid: i.tenantUid, inquiryId: i.id, title: 'Move-in payment', type: 'initial', lineItems: current.selection.lineItems, totalAmount: current.selection.total, perTenantAmount: current.selection.total, paidAmount: 0, status: 'unpaid', month: current.selection.startDate.slice(0,7), dueDate: current.selection.startDate, createdAt: stamp(), schemaVersion: 2 })
        }); return { ok: true }
      }
      case 'cancelApplication': {
        const i = await record('inquiries', data.id); participant(i, uid)
        await db.runTransaction(async tx => {
          const ir = ref('inquiries', i.id), rs = ref('roomReservations', i.propertyId), bRef = ref('bills', `initial_${i.id}`)
          const [s, b] = await Promise.all([tx.get(ir), tx.get(bRef)])
          must(s.data().status !== 'approved', 'Use move-out for an active tenancy.')
          must(!b.data()?.checkoutPending, 'A payment is being processed. Wait for its result before cancelling.')
          tx.update(ir, { status: 'cancelled', cancelledAt: stamp() }); tx.set(rs, { holds: { [i.id]: FieldValue.delete() } }, { merge: true })
          if (b.exists) tx.update(bRef, { status: 'cancelled' })
        }); return { ok: true }
      }
      case 'matching': {
        must(user.role === 'seeker', 'Seeker access required.')
        const props = await db.collection('properties').get()
        const results = await Promise.all(props.docs.map(async p => {
          const property = p.data(), tenants = await Promise.all((property.tenants || []).filter(t => t !== uid).map(t => ref('users', t).get()))
          const blocked = property.rules?.genderRestriction && property.rules.genderRestriction !== 'none' && user.gender && user.gender !== property.rules.genderRestriction
          return { id: p.id, score: blocked ? 0 : D.score(user.weeklySchedule, tenants.filter(t => t.exists).map(t => t.data().weeklySchedule || {})) }
        })); return { results }
      }
      case 'maintenanceStatus': {
        const m = await record('maintenanceRequests', data.id); must(m.landlordUid === uid, 'Landlord access required.')
        must(['open','in_progress','resolved'].includes(data.status), 'Invalid status.')
        const changes = { status: data.status, updatedAt: stamp(), history: FieldValue.arrayUnion({ status: data.status, at: Timestamp.now(), by: uid }) }
        if (data.status === 'resolved') changes.resolvedAt = stamp()
        if (data.status === 'in_progress' && !m.startedAt) changes.startedAt = stamp()
        if (data.status !== 'resolved') changes.resolvedAt = null
        await ref('maintenanceRequests', m.id).update(changes); return { ok: true }
      }
      case 'postBill': {
        const p = await record('properties', data.propertyId); owner(p, uid)
        const recipients = data.tenantUid ? [data.tenantUid] : (p.tenants || [])
        must(recipients.length && recipients.every(t => p.tenants.includes(t)), 'Select current tenants.')
        must(data.title?.trim() && data.dueDate && data.month, 'Complete the bill details.')
        must(['rent','water','electricity','internet','maintenance','other'].includes(data.type), 'Choose a charge type.')
        const t = D.normalizeTerms(p)
        const active = await db.collection('inquiries').where('propertyId','==',p.id).where('status','==','approved').get()
        for (const tenant of recipients) {
          const agreement = active.docs.find(i => i.data().tenantUid === tenant)?.data().selection?.terms || t
          if (['water','electricity','internet'].includes(data.type)) must(agreement.utilities?.[data.type]?.mode !== 'included', `${data.type} is included in the agreed rent.`)
          if (data.type === 'maintenance') must(agreement.maintenanceCoverage !== 'landlord', 'The contract assigns maintenance costs to the landlord.')
        }
        if (data.type === 'maintenance') must(data.reason?.trim(), 'Explain why maintenance is charged to tenants.')
        if (data.maintenanceId) { const m = await record('maintenanceRequests', data.maintenanceId); must(m.propertyId === p.id, 'Maintenance request belongs to another room.') }
        must(typeof data.requestId === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(data.requestId), 'Missing billing request reference.')
        const amounts = D.split(Number(data.amount), recipients.length)
        await db.runTransaction(async tx => {
          const bills = recipients.map(tenant => ref('bills', `charge_${data.maintenanceId || data.requestId}_${tenant}`))
          const old = await Promise.all(bills.map(b => tx.get(b)))
          if (old.every(b => b.exists)) return
          must(old.every(b => !b.exists), 'Some tenants have already been charged for this maintenance request.')
          recipients.forEach((tenant, index) => {
            tx.set(bills[index], { propertyId: p.id, propertyTitle: p.title, tenantUid: tenant, tenantName: p.tenantDetails?.[tenant]?.name || 'Tenant', landlordUid: uid, title: data.title.trim(), totalAmount: amounts[index], perTenantAmount: amounts[index], paidAmount: 0, type: data.type, reason: data.reason || '', maintenanceId: data.maintenanceId || null, month: data.month, dueDate: data.dueDate, status: 'unpaid', schemaVersion: 2, isRevenue: data.type === 'rent', createdAt: stamp() })
          })
        }); return { ok: true }
      }
      case 'requestAdvance': {
        const b = await record('bills', data.billId); must(b.tenantUid === uid && b.type === 'rent', 'Advance can cover your rent bills only.')
        const accountId = `${b.propertyId}_${uid}`
        const requestRef = db.collection('advanceRequests').doc()
        await db.runTransaction(async tx => {
          const ar = ref('tenantAccounts', accountId), br = ref('bills', b.id), rr = requestRef
          const [as, bs] = await Promise.all([tx.get(ar), tx.get(br)])
          const a = as.data(), bill = bs.data(), value = D.amount(data.amount)
          must(!bill.checkoutPending, 'Finish the pending checkout first.')
          must(!bill.advancePending, 'An advance request is already pending.')
          must(value > 0 && D.cents(value) <= D.cents(bill.totalAmount - (bill.paidAmount || 0)), 'Invalid amount for this bill.')
          must(a && D.cents(value) <= D.cents(a.advanceBalance - (a.reservedAdvance || 0)), 'Insufficient available advance.')
          tx.update(ar, { reservedAdvance: D.amount((a.reservedAdvance || 0) + value) })
          tx.set(rr, { billId: b.id, accountId, tenantUid: uid, landlordUid: b.landlordUid, propertyId: b.propertyId, amount: value, status: 'pending', createdAt: stamp() })
          tx.update(br, { advancePending: rr.id })
        }); return { ok: true, id: requestRef.id }
      }
      case 'reviewAdvance': {
        const r = await record('advanceRequests', data.id); must(r.landlordUid === uid, 'Landlord access required.')
        await db.runTransaction(async tx => {
          const rr = ref('advanceRequests', r.id), ar = ref('tenantAccounts', r.accountId), br = ref('bills', r.billId)
          const [rs, as, bs] = await Promise.all([tx.get(rr), tx.get(ar), tx.get(br)])
          must(rs.data().status === 'pending', 'Request already reviewed.')
          const a = as.data(), b = bs.data(), value = rs.data().amount, approve = data.approve === true
          if (approve) must(D.cents(value) <= D.cents(a.advanceBalance) && D.cents(value) <= D.cents(b.totalAmount - (b.paidAmount || 0)), 'Balance changed; reject and request again.')
          tx.update(ar, { reservedAdvance: D.amount((a.reservedAdvance || 0) - value), advanceBalance: D.amount(a.advanceBalance - (approve ? value : 0)) })
          tx.update(rr, { status: approve ? 'approved' : 'rejected', reviewedAt: stamp() })
          const paid = D.amount((b.paidAmount || 0) + (approve ? value : 0))
          tx.update(br, { advancePending: false, paidAmount: paid, status: D.cents(paid) >= D.cents(b.totalAmount) ? 'paid' : 'unpaid' })
          if (approve) tx.set(ref('payments', `advance_${r.id}`), { billId: b.id || r.billId, propertyId: b.propertyId, landlordUid: uid, tenantUid: r.tenantUid, amount: value, status: 'paid', method: 'advance', submittedAt: stamp(), reviewedAt: stamp(), referenceNo: `ADV-${r.id}` })
        }); return { ok: true }
      }
      case 'removeTenant': {
        const p = await record('properties', data.propertyId); owner(p, uid)
        const inquiries = await db.collection('inquiries').where('propertyId','==',p.id).where('status','==','approved').get()
        const ids = inquiries.docs.filter(s => s.data().tenantUid === data.tenantUid).map(s => s.id)
        await db.runTransaction(async tx => {
          const pr=ref('properties',p.id),rr=ref('roomReservations',p.id), cr=ref('propertyChats',p.id)
          const [ps,rs,cs] = await Promise.all([tx.get(pr),tx.get(rr),tx.get(cr)])
          must(ps.data().tenants.includes(data.tenantUid),'Tenant already removed.')
          let moveout
          if(data.moveoutReqId){moveout=await tx.get(ref('moveoutRequests',data.moveoutReqId));must(moveout.data()?.propertyId===p.id&&moveout.data()?.tenantUid===data.tenantUid,'Invalid move-out request.')}
          const holds=rs.data()?.holds||{};for(const id of ids)delete holds[id]
          tx.update(pr,{tenants:FieldValue.arrayRemove(data.tenantUid),[`tenantDetails.${data.tenantUid}`]:FieldValue.delete()})
          tx.set(rr,{holds});for(const id of ids)tx.update(ref('inquiries',id),{status:'closed',closedAt:stamp()})
          if(cs.exists)tx.update(cr,{participantUids:FieldValue.arrayRemove(data.tenantUid),[`participantNames.${data.tenantUid}`]:FieldValue.delete()})
          if(moveout)tx.update(moveout.ref,{status:'confirmed',confirmedAt:stamp()})
        });return {ok:true}
      }
      case 'customPlan': {
        landlord(user); must(Number.isInteger(Number(data.listings)) && Number(data.listings) > 10 && Number(data.listings) <= 10000, 'Enter a custom plan size of 11–10,000 listings.')
        await ref('customPlanRequests', uid).set({ landlordUid: uid, listings: Number(data.listings), note: String(data.note || '').slice(0,2000), status: 'requested', createdAt: stamp() }); return { ok: true }
      }
      case 'generateRent': landlord(user); return generateRent(uid)
      default: throw new Error('Unknown action.')
    }
  } catch (error) { if (error instanceof HttpsError) throw error; throw new HttpsError('failed-precondition', error.message) }
})

async function paymongo(path, method = 'GET', body) {
  const key = paymongoKey.value()
  must(key.startsWith('sk_test_'), 'PayMongo test mode is not configured.')
  const response = await fetch(`https://api.paymongo.com/v1/${path}`, { method, headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const result = await response.json()
  if (!response.ok) {
    const error = new Error(result.errors?.[0]?.detail || 'Payment provider unavailable.')
    error.definitive = response.status >= 400 && response.status < 500
    throw error
  }
  return result.data
}

exports.createCheckout = onCall({ region, invoker: 'public', secrets: [paymongoKey] }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')
  const uid = request.auth.uid, data = request.data || {}, orderRef = db.collection('checkoutOrders').doc()
  try {
    must(paymongoKey.value().startsWith('sk_test_'), 'PayMongo test mode is not configured.')
    const u = await record('users', uid)
    let value, description, kind, billId = null, limit = null
    if (data.limit !== undefined) {
      landlord(u); const p = D.plan(data.limit); must(p.limit > 1, 'Free plan needs no checkout.')
      const [inventory,sub]=await Promise.all([ref('landlordInventory',uid).get(),ref('subscriptions',uid).get()])
      must((inventory.data()?.listingIds||[]).length<=p.limit,'This tier is below your current listing count.')
      must(!(sub.data()?.expiresAt?.toMillis()>Date.now())||sub.data().limit<=p.limit,'Downgrade after the current term expires.')
      value = p.amount; limit = p.limit; description = `SkedLink Premium — ${limit} listings / 30 days`; kind = 'subscription'
    }
    else {
      const b = await record('bills', data.billId); must(b.tenantUid === uid && b.schemaVersion === 2, 'This bill cannot be paid using checkout.')
      must(b.status !== 'cancelled', 'Bill cancelled.')
      value = D.amount(b.totalAmount - (b.paidAmount || 0)); must(value > 0, 'Bill already paid.'); description = b.title; kind = 'bill'; billId = b.id
    }
    await db.runTransaction(async tx => {
      if (billId) {
        const br = ref('bills', billId), bs = await tx.get(br), b = bs.data()
        must(!b.checkoutPending && !b.advancePending, 'A checkout or advance request is already pending.')
        must(D.cents(b.totalAmount - (b.paidAmount || 0)) === D.cents(value), 'Bill changed. Refresh and try again.')
        if (b.type === 'initial') {
          const i = await tx.get(ref('inquiries', b.inquiryId))
          must(i.data().status === 'awaiting_payment' && i.data().reservationExpiresAt.toMillis() > Date.now(), 'Reservation expired or contract not accepted.')
        }
        tx.update(br, { checkoutPending: orderRef.id })
      }
      tx.set(orderRef, { uid, kind, billId, limit, amount: value, status: 'creating', createdAt: stamp() })
    })
    const session = await paymongo('checkout_sessions', 'POST', { data: { attributes: {
      line_items: [{ currency: 'PHP', amount: D.cents(value), name: description, quantity: 1 }],
      payment_method_types: ['gcash', 'paymaya', 'card'], description,
      reference_number: orderRef.id, send_email_receipt: false, show_description: true,
      success_url: `${appUrl.value()}/?checkout=${orderRef.id}`, cancel_url: `${appUrl.value()}/?checkout=${orderRef.id}`,
    } } })
    await orderRef.update({ sessionId: session.id, status: 'pending', url: session.attributes.checkout_url })
    return { url: session.attributes.checkout_url }
  } catch (error) {
    const order = (await orderRef.get()).data()
    if (order?.status === 'creating') {
      // Keep uncertain provider calls locked. A reconciliation action retrieves the session before release.
      if (error.definitive) {
        await db.runTransaction(async tx => {
          const current = await tx.get(orderRef)
          const br = order.billId ? ref('bills', order.billId) : null, bs = br ? await tx.get(br) : null
          if (current.data().status !== 'creating') return
          tx.update(orderRef, { status: 'failed' })
          if (bs?.data()?.checkoutPending === orderRef.id) tx.update(br, { checkoutPending: FieldValue.delete() })
        })
      } else await orderRef.update({ status: 'needs_review', error: 'Checkout creation did not finish. Contact support before retrying.' })
    }
    throw new HttpsError('failed-precondition', error.message)
  }
})

async function settle(session) {
  const attrs = session.attributes, id = attrs.reference_number
  const paidPayment = attrs.payments?.find(p => p.attributes?.status === 'paid')
  must(paidPayment && paidPayment.attributes.currency === 'PHP' && attrs.livemode !== true && paidPayment.attributes.livemode !== true, 'No confirmed test payment.')
  await db.runTransaction(async tx => {
    const orderRef = ref('checkoutOrders', id), os = await tx.get(orderRef), order = os.data()
    must(order && (!order.sessionId || order.sessionId === session.id), 'Unknown checkout session.')
    if (order.status === 'paid') return
    must(paidPayment.attributes.amount === D.cents(order.amount), 'Payment amount mismatch.')
    if (order.kind === 'subscription') {
      const sr = ref('subscriptions', order.uid), old = await tx.get(sr)
      const expiry = (old.data()?.limit === order.limit ? Math.max(Date.now(), old.data()?.expiresAt?.toMillis() || 0) : Date.now()) + 30 * 86400000
      tx.set(sr, { landlordUid: order.uid, limit: order.limit, status: 'active', expiresAt: Timestamp.fromMillis(expiry), amount: order.amount, updatedAt: stamp() })
    } else {
      const br = ref('bills', order.billId), bs = await tx.get(br), bill = bs.data()
      must(bill && D.cents(bill.totalAmount - (bill.paidAmount || 0)) === D.cents(order.amount), 'Bill balance changed; payment requires reconciliation.')
      let i, ps, reservations, account, userSnap
      if (bill.type === 'initial') {
        const snapshots = await Promise.all([tx.get(ref('inquiries', bill.inquiryId)), tx.get(ref('properties', bill.propertyId)), tx.get(ref('roomReservations', bill.propertyId)), tx.get(ref('tenantAccounts', `${bill.propertyId}_${bill.tenantUid}`)), tx.get(ref('users', bill.tenantUid))])
        i = snapshots[0].data(); ps = snapshots[1].data(); reservations = snapshots[2].data()?.holds || {}; account = snapshots[3].data(); userSnap = snapshots[4].data()
        must(i.status === 'awaiting_payment', 'Application changed; payment requires reconciliation.')
        const other = Object.entries(reservations).filter(([key]) => key !== bill.inquiryId).map(([, h]) => h)
        must(D.available(ps, i.selection, other), 'Room unavailable; payment requires reconciliation.')
        const legacy = (ps.tenants || []).filter(t => !Object.values(reservations).some(h => h.tenantUid === t && h.status === 'approved'))
        must((i.selection.occupancy !== 'exclusive' || legacy.length === 0) && D.available({ ...ps, capacity: Number(ps.capacity) - legacy.length }, i.selection, other), 'Occupancy changed; payment requires reconciliation.')
      }
      const commissionBase = bill.type === 'initial' ? i.selection.lineItems.find(l => l.id === 'rent').amount : 0
      const commission = D.amount(commissionBase * (i?.selection.period === 'month' ? 0.03 : 0.08))
      tx.update(br, { paidAmount: bill.totalAmount, status: 'paid', checkoutPending: FieldValue.delete(), paidAt: stamp() })
      tx.set(ref('payments', id), { billId: order.billId, propertyId: bill.propertyId, landlordUid: bill.landlordUid, tenantUid: bill.tenantUid, amount: order.amount, revenueAmount: bill.type === 'initial' ? commissionBase : bill.isRevenue ? order.amount : 0, platformCommission: commission, method: 'paymongo_test', status: 'paid', referenceNo: session.id, submittedAt: stamp(), reviewedAt: stamp() })
      if (i) {
        tx.update(ref('inquiries', bill.inquiryId), { status: 'approved', activatedAt: stamp() })
        tx.update(ref('properties', bill.propertyId), { tenants: FieldValue.arrayUnion(bill.tenantUid), [`tenantDetails.${bill.tenantUid}`]: privateSummary(userSnap) })
        tx.set(ref('roomReservations', bill.propertyId), { holds: { ...reservations, [bill.inquiryId]: { ...i.selection, tenantUid: bill.tenantUid, status: 'approved', expiresAt: 0 } } })
        tx.set(ref('tenantAccounts', `${bill.propertyId}_${bill.tenantUid}`), { tenantUid: bill.tenantUid, landlordUid: bill.landlordUid, propertyId: bill.propertyId, advanceBalance: D.amount((account?.advanceBalance || 0) + (i.selection.lineItems.find(l => l.id === 'advance')?.amount || 0)), depositBalance: D.amount((account?.depositBalance || 0) + (i.selection.lineItems.find(l => l.id === 'deposit')?.amount || 0)), reservedAdvance: account?.reservedAdvance || 0 })
        tx.set(ref('propertyChats', bill.propertyId), { propertyTitle: bill.propertyTitle, participantUids: FieldValue.arrayUnion(bill.tenantUid, bill.landlordUid), participantNames: { [bill.tenantUid]: i.tenantName } }, { merge: true })
      }
    }
    tx.update(orderRef, { status: 'paid', sessionId: session.id, paidAt: stamp() })
  })
}

exports.refreshCheckout = onCall({ region, invoker: 'public', secrets: [paymongoKey] }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')
  try {
    const o = await record('checkoutOrders', request.data.id); must(o.uid === request.auth.uid, 'Not your payment.')
    if (o.status === 'paid') return { status: 'paid' }
    must(o.sessionId, 'Checkout requires support review before retrying.')
    const session = await paymongo(`checkout_sessions/${o.sessionId}`)
    if (session.attributes.payments?.some(p => p.attributes?.status === 'paid')) { await settle(session); return { status: 'paid' } }
    if (request.data.cancel) {
      await paymongo(`checkout_sessions/${o.sessionId}/expire`, 'POST')
      const current = await paymongo(`checkout_sessions/${o.sessionId}`)
      if (current.attributes.payments?.some(p => p.attributes?.status === 'paid')) { await settle(current); return { status: 'paid' } }
      must(current.attributes.status === 'expired', 'Checkout cannot be cancelled yet.')
      await db.runTransaction(async tx => {
        const or = ref('checkoutOrders', o.id), os = await tx.get(or)
        if (os.data().status === 'paid') return
        const br = o.billId ? ref('bills', o.billId) : null, bs = br ? await tx.get(br) : null
        tx.update(or, { status: 'expired' })
        if (bs?.data()?.checkoutPending === o.id) tx.update(br, { checkoutPending: FieldValue.delete() })
      }); return { status: 'expired' }
    }
    return { status: 'pending', url: o.url }
  } catch (error) { throw new HttpsError('failed-precondition', error.message) }
})

exports.paymongoWebhook = onRequest({ region, invoker: 'public', secrets: [paymongoKey, webhookKey] }, async (req, res) => {
  if (req.method !== 'POST') return res.sendStatus(405)
  try {
    const parts = Object.fromEntries(String(req.get('Paymongo-Signature') || '').split(',').map(v => v.trim().split('=')))
    must(parts.t && parts.te && Math.abs(Date.now()/1000 - Number(parts.t)) < 300, 'Invalid signature timestamp.')
    const expected = crypto.createHmac('sha256', webhookKey.value()).update(`${parts.t}.`).update(req.rawBody).digest()
    const actual = Buffer.from(parts.te, 'hex'); must(actual.length === expected.length && crypto.timingSafeEqual(actual, expected), 'Invalid signature.')
    const event = req.body.data?.attributes || req.body.data
    if (event?.type !== 'checkout_session.payment.paid') return res.sendStatus(200)
    const session = await paymongo(`checkout_sessions/${event.data.id}`)
    await settle(session); return res.sendStatus(200)
  } catch (error) { console.error('Webhook rejected:', error.message); return res.status(400).send('Unable to reconcile event') }
})

// Only name and avatar are mirrored into household-visible data.
exports.syncHouseholdProfile = onDocumentWritten({ region, document: 'users/{uid}' }, async event => {
  const before=event.data.before.data(),after=event.data.after.data()
  if(!after || (before?.fullName===after.fullName && before?.profilePhoto===after.profilePhoto && JSON.stringify(before?.weeklySchedule)===JSON.stringify(after.weeklySchedule)))return
  const properties=await db.collection('properties').where('tenants','array-contains',event.params.uid).get()
  for(const property of properties.docs)await property.ref.update({[`tenantDetails.${event.params.uid}`]:privateSummary(after),compatibilityUpdatedAt:stamp()})
})
async function notice(uid,id,title,body,tab,type='default'){
  if(!uid)return
  await db.collection('notifications').doc(uid).collection('items').doc(id).set({title,body,tab,type,read:false,createdAt:stamp()})
}
exports.applicationNotice=onDocumentWritten({region,document:'inquiries/{id}'},async event=>{
  const before=event.data.before.data(),i=event.data.after.data();if(!i||before?.status===i.status)return
  const target=['pending','contract_submitted'].includes(i.status)?i.landlordUid:i.tenantUid
  await notice(target,event.id,'Application update',`${i.propertyTitle}: ${i.status.replaceAll('_',' ')}`,'applications','inquiry')
})
exports.billNotice=onDocumentCreated({region,document:'bills/{id}'},async event=>{
  const b=event.data.data();await notice(b.tenantUid,event.id,'New bill',`${b.title}: PHP ${b.totalAmount}`,'payments','bill')
})
exports.paymentNotice=onDocumentWritten({region,document:'payments/{id}'},async event=>{
  const before=event.data.before.data(),p=event.data.after.data();if(!p||before?.status===p.status)return
  await Promise.all([notice(p.landlordUid,event.id,'Payment update',`Payment is ${p.status}: PHP ${p.amount}`,'payments','payment'),notice(p.tenantUid,event.id,'Payment update',`Payment is ${p.status}: PHP ${p.amount}`,'payments','payment')])
})
exports.maintenanceNotice=onDocumentWritten({region,document:'maintenanceRequests/{id}'},async event=>{
  const before=event.data.before.data(),m=event.data.after.data();if(!m||before?.status===m.status)return
  await notice(before?m.tenantUid:m.landlordUid,event.id,'Maintenance update',`${m.title}: ${m.status.replaceAll('_',' ')}`,before?'myhome':'maintenance')
})
exports.choreNotice=onDocumentWritten({region,document:'chores/{id}'},async event=>{
  const before=event.data.before.data(),c=event.data.after.data();if(!c||before?.status===c.status)return
  await notice(c.status==='done'?c.landlordUid:c.assignedTo,event.id,'Chore update',`${c.title}: ${c.status}`,c.status==='done'?'chores':'myhome','chore')
})
exports.moveoutNotice=onDocumentWritten({region,document:'moveoutRequests/{id}'},async event=>{
  const before=event.data.before.data(),m=event.data.after.data();if(!m||before?.status===m.status)return
  await notice(before?m.tenantUid:m.landlordUid,event.id,'Move-out update',`Move-out request: ${m.status}`,before?'myhome':'properties','moveout')
})

async function generateRent(uid) {
        const all = await db.collection('inquiries').where('landlordUid','==',uid).where('status','==','approved').get()
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
        let count = 0
        for (const doc of all.docs) {
          const i = doc.data(); if (i.selection?.period !== 'month') continue
          for (let n = 1; n < 120; n++) {
            const due = D.addUnits(i.selection.startDate, n, 'month')
            if (due >= i.selection.endDate || due > today) break
            const id = `rent_${doc.id}_${due}`
            await db.runTransaction(async tx => {
              const br = ref('bills', id), old = await tx.get(br); if (old.exists) return
              tx.set(br, { tenantUid: i.tenantUid, landlordUid: uid, propertyId: i.propertyId, propertyTitle: i.propertyTitle, inquiryId: doc.id, type: 'rent', title: `Rent — ${due}`, totalAmount: i.selection.rate, perTenantAmount: i.selection.rate, paidAmount: 0, status: 'unpaid', dueDate: due, month: due.slice(0,7), schemaVersion: 2, isRevenue: true, createdAt: stamp() })
              for (const [key, u] of Object.entries(i.selection.terms.utilities || {})) if (u.mode === 'fixed') tx.set(ref('bills', `${id}_${key}`), { tenantUid: i.tenantUid, landlordUid: uid, propertyId: i.propertyId, propertyTitle: i.propertyTitle, type: key, title: `${key} — ${due}`, totalAmount: D.amount(u.amount), perTenantAmount: D.amount(u.amount), paidAmount: 0, status: 'unpaid', dueDate: due, month: due.slice(0,7), schemaVersion: 2, isRevenue: false, createdAt: stamp() })
              count++
            })
          }
        } return { count }
}

const { onSchedule } = require('firebase-functions/v2/scheduler')
exports.dailyRent = onSchedule({ region, schedule: '5 0 * * *', timeZone: 'Asia/Manila' }, async () => {
  const owners = await db.collection('users').where('role', '==', 'owner').get()
  for (const owner of owners.docs) await generateRent(owner.id)
})
