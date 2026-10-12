const {test,before,after}=require('node:test')
const assert=require('node:assert/strict')
process.env.GCLOUD_PROJECT='demo-skedlink'
process.env.FIREBASE_CONFIG=JSON.stringify({projectId:'demo-skedlink',storageBucket:'demo-skedlink.appspot.com'})
const api=require('../index')
const {getFirestore}=require('firebase-admin/firestore')
const {getApps,deleteApp}=require('firebase-admin/app')
const {getStorage}=require('firebase-admin/storage')
const db=getFirestore(),call=(uid,data)=>api.platform.run({auth:{uid},data})
const terms={occupancy:'both',period:'month',minimumStay:1,minimumUnit:'month',advancePeriods:3,depositPeriods:1,maintenanceCoverage:'landlord',utilities:{water:{mode:'included'}}}
before(async()=>{
 await db.doc('users/workflow-owner').set({role:'owner',fullName:'Owner'})
 await db.doc('users/workflow-tenant').set({role:'seeker',fullName:'Tenant',email:'test@example.test'})
})
after(async()=>{await Promise.all(getApps().map(deleteApp))})
test('concurrent listing creation cannot exceed free limit',async()=>{
 const property={title:'Test room',price:6000,capacity:3,location:{address:'Test'},rentalTerms:terms}
 const results=await Promise.allSettled([call('workflow-owner',{action:'saveProperty',property}),call('workflow-owner',{action:'saveProperty',property})])
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 const id=results.find(r=>r.status==='fulfilled').value.id
 await db.doc('testMetadata/room').set({id})
})
test('application computes trusted totals and does not activate occupancy',async()=>{
 const id=(await db.doc('testMetadata/room').get()).data().id
 const result=await call('workflow-tenant',{action:'apply',propertyId:id,selection:{occupancy:'exclusive',startDate:'2027-10-12',endDate:'2028-01-12',rate:1,total:1}})
 const i=(await db.doc(`inquiries/${result.id}`).get()).data()
 assert.equal(i.selection.rate,6000);assert.equal(i.selection.total,30000);assert.equal(i.status,'pending')
 assert.deepEqual((await db.doc(`properties/${id}`).get()).data().tenants,[])
 await assert.rejects(call('workflow-owner',{action:'acceptContract',id:result.id}),/signed contract/)
})
test('maintenance assigned to landlord and included utilities cannot be charged',async()=>{
 const id=(await db.doc('testMetadata/room').get()).data().id
 await db.doc(`properties/${id}`).update({tenants:['workflow-tenant']})
 const bill={propertyId:id,tenantUid:'workflow-tenant',title:'Repair',amount:500,month:'2027-10',dueDate:'2027-10-12',reason:'Tenant broke it'}
 await assert.rejects(call('workflow-owner',{action:'postBill',...bill,type:'maintenance'}),/landlord/)
 await assert.rejects(call('workflow-owner',{action:'postBill',...bill,type:'water'}),/included/)
})
test('advance requests reserve funds; concurrent approvals debit and credit exactly once',async()=>{
 const propertyId='credit-room',tenantUid='workflow-tenant',landlordUid='workflow-owner',accountId=`${propertyId}_${tenantUid}`
 await db.doc(`tenantAccounts/${accountId}`).set({tenantUid,landlordUid,propertyId,advanceBalance:6000,reservedAdvance:0,depositBalance:2000})
 await db.doc('bills/credit-rent').set({tenantUid,landlordUid,propertyId,type:'rent',totalAmount:2000,paidAmount:0})
 const requested=await call(tenantUid,{action:'requestAdvance',billId:'credit-rent',amount:2000})
 assert.equal((await db.doc(`tenantAccounts/${accountId}`).get()).data().reservedAdvance,2000)
 const results=await Promise.allSettled([call(landlordUid,{action:'reviewAdvance',id:requested.id,approve:true}),call(landlordUid,{action:'reviewAdvance',id:requested.id,approve:true})])
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 const a=(await db.doc(`tenantAccounts/${accountId}`).get()).data(),b=(await db.doc('bills/credit-rent').get()).data()
 assert.equal(a.advanceBalance,4000);assert.equal(a.reservedAdvance,0);assert.equal(a.depositBalance,2000);assert.equal(b.paidAmount,2000);assert.equal(b.status,'paid')
})
test('contract exchange unlocks billing but does not activate tenant before payment',async()=>{
 const propertyId='contract-room',id='contract-application',tenantUid='workflow-tenant',landlordUid='workflow-owner'
 const property={ownerId:landlordUid,title:'Contract room',price:6000,capacity:3,tenants:[],rentalTerms:terms}
 const selection=require('../domain').quote(property,{occupancy:'exclusive',startDate:'2027-10-12',endDate:'2028-01-12'})
 await db.doc(`properties/${propertyId}`).set(property)
 await db.doc(`inquiries/${id}`).set({propertyId,propertyTitle:property.title,landlordUid,tenantUid,tenantName:'Tenant',type:'rent',status:'pending',selection})
 const contract={path:`contracts/${id}/${landlordUid}/contract.pdf`,name:'contract.pdf'},signed={path:`contracts/${id}/${tenantUid}/signed.pdf`,name:'signed.pdf'},bucket=getStorage().bucket()
 await bucket.file(contract.path).save('%PDF-1.7\nTest',{contentType:'application/pdf'});await bucket.file(signed.path).save('%PDF-1.7\nSigned',{contentType:'application/pdf'})
 await call(landlordUid,{action:'sendContract',id,file:contract})
 assert.equal((await db.doc(`inquiries/${id}`).get()).data().status,'contract_sent')
 await call(tenantUid,{action:'submitContract',id,file:signed})
 await call(landlordUid,{action:'acceptContract',id})
 const bill=(await db.doc(`bills/initial_${id}`).get()).data()
 assert.equal(bill.totalAmount,30000);assert.equal(bill.status,'unpaid')
 assert.deepEqual((await db.doc(`properties/${propertyId}`).get()).data().tenants,[])
 await assert.rejects(call(landlordUid,{action:'acceptContract',id}),/signed contract/)
})
test('confirmed provider result activates once, credits advance once and records commission',async()=>{
 const id='contract-application',orderId='paid-order',sessionId='cs_test_fixture'
 await db.doc(`checkoutOrders/${orderId}`).set({uid:'workflow-tenant',kind:'bill',billId:`initial_${id}`,sessionId,amount:30000,status:'pending'})
 await db.doc(`bills/initial_${id}`).update({checkoutPending:orderId})
 process.env.PAYMONGO_SECRET_KEY='sk_test_local_fixture_not_a_real_key'
 const original=global.fetch
 global.fetch=async()=>({ok:true,json:async()=>({data:{id:sessionId,attributes:{reference_number:orderId,livemode:false,payments:[{attributes:{status:'paid',currency:'PHP',amount:3000000,livemode:false}}]}}})})
 try{
  await Promise.all([api.refreshCheckout.run({auth:{uid:'workflow-tenant'},data:{id:orderId}}),api.refreshCheckout.run({auth:{uid:'workflow-tenant'},data:{id:orderId}})])
  const p=(await db.doc('properties/contract-room').get()).data(),a=(await db.doc('tenantAccounts/contract-room_workflow-tenant').get()).data(),payment=(await db.doc(`payments/${orderId}`).get()).data()
  assert.deepEqual(p.tenants,['workflow-tenant']);assert.equal(a.advanceBalance,18000);assert.equal(a.depositBalance,6000);assert.equal(payment.platformCommission,180)
  assert.deepEqual(Object.keys(p.tenantDetails['workflow-tenant']).sort(),['name','profilePhoto'])
  assert.equal((await db.doc(`inquiries/${id}`).get()).data().status,'approved')
 }finally{global.fetch=original}
})
test('provider amount mismatch does not mark bill paid',async()=>{
 const id='wrong-order';await db.doc(`checkoutOrders/${id}`).set({uid:'workflow-tenant',kind:'subscription',sessionId:'cs_wrong',limit:2,amount:300,status:'pending'})
 const original=global.fetch;global.fetch=async()=>({ok:true,json:async()=>({data:{id:'cs_wrong',attributes:{reference_number:id,livemode:false,payments:[{attributes:{status:'paid',currency:'PHP',amount:1}}]}}})})
 try{await assert.rejects(api.refreshCheckout.run({auth:{uid:'workflow-tenant'},data:{id}}),/amount mismatch/);assert.equal((await db.doc(`checkoutOrders/${id}`).get()).data().status,'pending')}finally{global.fetch=original}
})
test('partial advance approvals preserve separate immutable receipt history',async()=>{
 const tenantUid='workflow-tenant',landlordUid='workflow-owner',propertyId='credit-room'
 await db.doc('bills/partial-rent').set({tenantUid,landlordUid,propertyId,type:'rent',totalAmount:1000,paidAmount:0})
 const first=await call(tenantUid,{action:'requestAdvance',billId:'partial-rent',amount:400})
 await call(landlordUid,{action:'reviewAdvance',id:first.id,approve:true})
 const second=await call(tenantUid,{action:'requestAdvance',billId:'partial-rent',amount:600})
 await call(landlordUid,{action:'reviewAdvance',id:second.id,approve:true})
 assert.notEqual(first.id,second.id)
 assert.equal((await db.doc(`payments/advance_${first.id}`).get()).data().amount,400)
 assert.equal((await db.doc(`payments/advance_${second.id}`).get()).data().amount,600)
 assert.equal((await db.doc('bills/partial-rent').get()).data().paidAmount,1000)
})
test('repeated rent generation preserves agreed rate and does not duplicate bills',async()=>{
 await db.doc('inquiries/recurring-rental').set({landlordUid:'workflow-owner',tenantUid:'workflow-tenant',propertyId:'contract-room',propertyTitle:'Room',status:'approved',selection:{startDate:'2026-08-01',endDate:'2027-01-01',period:'month',rate:2000,terms:{utilities:{internet:{mode:'fixed',amount:100}}}}})
 await Promise.all([call('workflow-owner',{action:'generateRent'}),call('workflow-owner',{action:'generateRent'})])
 assert.equal((await db.doc('bills/rent_recurring-rental_2026-09-01').get()).data().totalAmount,2000)
 assert.equal((await db.doc('bills/rent_recurring-rental_2026-09-01_internet').get()).data().totalAmount,100)
 const bills=await db.collection('bills').where('inquiryId','==','recurring-rental').get()
 assert.equal(new Set(bills.docs.map(b=>b.id)).size,bills.size)
})
test('deleted tenant cleanup removes private records and room membership',async()=>{
 const {cleanupDeletedUser}=require('../cleanup')
 const uid='cleanup-tenant', owner='cleanup-owner', propertyId='cleanup-room'
 await db.doc(`users/${uid}`).set({role:'seeker'})
 await db.doc(`properties/${propertyId}`).set({ownerId:owner,tenants:[uid],tenantDetails:{[uid]:{name:'Test'}}})
 await db.doc(`roomReservations/${propertyId}`).set({holds:{'cleanup-inquiry':{tenantUid:uid,status:'approved'}}})
 await db.doc(`propertyChats/${propertyId}`).set({participantUids:[owner,uid],participantNames:{[uid]:'Test'}})
 await db.doc('inquiries/cleanup-inquiry').set({propertyId,tenantUid:uid,landlordUid:owner})
 await db.doc(`applicationLocks/${uid}_${propertyId}`).set({id:'cleanup-inquiry'})
 await db.doc('bills/cleanup-bill').set({propertyId,tenantUid:uid,landlordUid:owner})
 await db.doc('tenantAccounts/cleanup-account').set({propertyId,tenantUid:uid,landlordUid:owner})
 await cleanupDeletedUser(db,getStorage(),uid)
 assert.equal((await db.doc(`users/${uid}`).get()).exists,false)
 assert.deepEqual((await db.doc(`properties/${propertyId}`).get()).data().tenants,[])
 assert.equal((await db.doc('inquiries/cleanup-inquiry').get()).exists,false)
 assert.equal((await db.doc('bills/cleanup-bill').get()).exists,false)
 assert.equal((await db.doc('tenantAccounts/cleanup-account').get()).exists,false)
 assert.equal((await db.doc(`applicationLocks/${uid}_${propertyId}`).get()).exists,false)
 assert.deepEqual((await db.doc(`roomReservations/${propertyId}`).get()).data().holds,{})
})
test('deleted listing cleanup removes application lock and nested conversation',async()=>{
 const {cleanupDeletedProperty}=require('../cleanup')
 const id='cleanup-property',tenant='cleanup-property-tenant',inquiry='cleanup-property-inquiry'
 await db.doc(`inquiries/${inquiry}`).set({propertyId:id,tenantUid:tenant})
 await db.doc(`inquiries/${inquiry}/messages/m1`).set({text:'Private'})
 await db.doc(`applicationLocks/${tenant}_${id}`).set({id:inquiry})
 await db.doc(`propertyChats/${id}/messages/m1`).set({text:'Private'})
 await db.doc(`roomReservations/${id}`).set({holds:{}})
 await cleanupDeletedProperty(db,getStorage(),id)
 assert.equal((await db.doc(`inquiries/${inquiry}`).get()).exists,false)
 assert.equal((await db.doc(`inquiries/${inquiry}/messages/m1`).get()).exists,false)
 assert.equal((await db.doc(`applicationLocks/${tenant}_${id}`).get()).exists,false)
 assert.equal((await db.doc(`propertyChats/${id}/messages/m1`).get()).exists,false)
 assert.equal((await db.doc(`roomReservations/${id}`).get()).exists,false)
})
test('admin verification change updates existing landlord listings',async()=>{
 const id='verification-room',uid='workflow-owner'
 await db.doc(`properties/${id}`).set({ownerId:uid,landlordVerified:false})
 await api.syncLandlordVerification.run({params:{uid},data:{
  before:{data:()=>({role:'owner',isVerified:false})},
  after:{data:()=>({role:'owner',isVerified:true})},
 }})
 assert.equal((await db.doc(`properties/${id}`).get()).data().landlordVerified,true)
})
