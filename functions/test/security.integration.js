const {test,before,after}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing')
const {doc,setDoc,getDoc,updateDoc,collection,getDocs,query,where}=require('firebase/firestore')
const {ref,uploadBytes,getBytes}=require('firebase/storage')
const projectId='demo-skedlink'
let env
before(async()=>{
 env=await initializeTestEnvironment({projectId,firestore:{rules:fs.readFileSync('../firestore.rules','utf8')},storage:{rules:fs.readFileSync('../storage.rules','utf8')}})
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore()
  await Promise.all([
   setDoc(doc(db,'users','tenant'),{uid:'tenant',role:'seeker',email:'private@example.test',weeklySchedule:{monday:{0:'sleep'}}}),
   setDoc(doc(db,'users','owner'),{uid:'owner',role:'owner'}),
   setDoc(doc(db,'properties','room'),{ownerId:'owner',tenants:['tenant','roommate'],tenantDetails:{tenant:{name:'Tenant'}}}),
   setDoc(doc(db,'inquiries','application'),{tenantUid:'tenant',landlordUid:'owner',propertyId:'room',status:'awaiting_payment'}),
   setDoc(doc(db,'bills','bill'),{tenantUid:'tenant',landlordUid:'owner',propertyId:'room',schemaVersion:2,totalAmount:2000,paidAmount:0}),
   setDoc(doc(db,'subscriptions','owner'),{landlordUid:'owner',limit:2}),
   setDoc(doc(db,'tenantAccounts','account'),{tenantUid:'tenant',landlordUid:'owner',advanceBalance:6000})
  ])
 })
})
after(async()=>{await env?.cleanup()})
test('tenant reads own profile but roommate and landlord cannot read schedule/contact data',async()=>{
 await assertSucceeds(getDoc(doc(env.authenticatedContext('tenant').firestore(),'users','tenant')))
 for(const uid of ['roommate','owner'])await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(),'users','tenant')))
})
test('landlord cannot bypass contract/payment by directly activating an application',async()=>{
 const db=env.authenticatedContext('owner').firestore()
 await assertFails(updateDoc(doc(db,'inquiries','application'),{status:'approved'}))
 await assertFails(updateDoc(doc(db,'properties','room'),{tenants:['intruder']}))
})
test('clients cannot mint paid bills, subscriptions, or advance balances',async()=>{
 for(const uid of ['owner','tenant']){
  const db=env.authenticatedContext(uid).firestore()
  await assertFails(updateDoc(doc(db,'bills','bill'),{paidAmount:2000,status:'paid'}))
  await assertFails(updateDoc(doc(db,'subscriptions','owner'),{limit:10}))
  await assertFails(updateDoc(doc(db,'tenantAccounts','account'),{advanceBalance:999999}))
 }
})
test('tenant bill queries are private and role-scoped',async()=>{
 const tenant=env.authenticatedContext('tenant').firestore(),roommate=env.authenticatedContext('roommate').firestore()
 await assertSucceeds(getDocs(query(collection(tenant,'bills'),where('tenantUid','==','tenant'))))
 await assertFails(getDocs(query(collection(roommate,'bills'),where('propertyId','==','room'))))
})
test('landlord can query own subscription',async()=>{
 const db=env.authenticatedContext('owner').firestore()
 const result=await assertSucceeds(getDocs(query(collection(db,'subscriptions'),where('landlordUid','==','owner'))));assert.equal(result.size,1)
})
test('self-service profiles cannot change roles',async()=>{
 await assertFails(updateDoc(doc(env.authenticatedContext('tenant').firestore(),'users','tenant'),{role:'owner'}))
})
test('contracts are private PDFs and cannot be overwritten',async()=>{
 const storage=env.authenticatedContext('tenant').storage()
 const path='contracts/application/tenant/signed.pdf',bytes=new TextEncoder().encode('%PDF-1.7\nTest')
 await assertSucceeds(uploadBytes(ref(storage,path),bytes,{contentType:'application/pdf'}))
 await assertFails(uploadBytes(ref(storage,path),new TextEncoder().encode('%PDF-1.7\nReplaced'),{contentType:'application/pdf'}))
 await assertSucceeds(getBytes(ref(env.authenticatedContext('owner').storage(),path)))
 await assertFails(getBytes(ref(env.authenticatedContext('roommate').storage(),path)))
 await assertFails(uploadBytes(ref(storage,'contracts/application/tenant/bad.txt'),bytes,{contentType:'text/plain'}))
})
