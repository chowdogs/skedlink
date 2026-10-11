// Dry-run by default. Run only against an explicitly selected project.
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const apply = process.argv.includes('--apply'), projectId = process.env.GCLOUD_PROJECT
if (!projectId) throw new Error('Set GCLOUD_PROJECT explicitly. Export a database backup before --apply.')
initializeApp({ credential: applicationDefault(), projectId })
const db=getFirestore()
async function main(){
  const properties=await db.collection('properties').get(), owners=new Map()
  let summaries=0, sharedBills=0
  for(const p of properties.docs){
    const data=p.data(),safe={};owners.set(data.ownerId,[...(owners.get(data.ownerId)||[]),p.id])
    for(const [uid,t] of Object.entries(data.tenantDetails||{})){safe[uid]={name:t.name||'Tenant',profilePhoto:t.profilePhoto||''};summaries++}
    if(apply)await db.runTransaction(async tx=>{
      const archive=db.collection('migrationArchive').doc(`property_${p.id}`),old=await tx.get(archive)
      if(!old.exists)tx.set(archive,{original:data,migratedAt:FieldValue.serverTimestamp()})
      tx.update(p.ref,{tenantDetails:safe,privacyVersion:2})
    })
  }
  for(const [uid,listingIds] of owners)if(apply)await db.collection('landlordInventory').doc(uid).set({listingIds})
  // Legacy shared bills were readable by every occupant. Split into private per-tenant records,
  // retaining original IDs in an admin-only archive and retargeting the corresponding payments.
  const bills=await db.collection('bills').get()
  for(const b of bills.docs){
    const data=b.data();if(data.tenantUid)continue
    const p=properties.docs.find(p=>p.id===data.propertyId)?.data();if(!p)continue
    sharedBills++
    if(!apply)continue
    const payments=await db.collection('payments').where('billId','==',b.id).get()
    const batch=db.batch();batch.set(db.collection('migrationArchive').doc(`bill_${b.id}`),{original:data,migratedAt:FieldValue.serverTimestamp()})
    const recipients=[...new Set([...(p.tenants||[]),...payments.docs.map(p=>p.data().tenantUid)])]
    for(const uid of recipients){
      const id=`legacy_${b.id}_${uid}`
      batch.set(db.collection('bills').doc(id),{...data,tenantUid:uid,totalAmount:data.perTenantAmount??data.totalAmount,splitCount:1,legacySourceId:b.id})
      for(const payment of payments.docs.filter(p=>p.data().tenantUid===uid))batch.update(payment.ref,{billId:id})
    }
    batch.delete(b.ref);await batch.commit()
  }
  console.log(JSON.stringify({projectId,mode:apply?'applied':'dry-run',properties:properties.size,tenantSummaries:summaries,landlords:owners.size,legacySharedBills:sharedBills}))
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
