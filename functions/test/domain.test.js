const {test}=require('node:test')
const assert=require('node:assert/strict')
const D=require('../domain')
const property={price:6000,capacity:3,rentalTerms:{occupancy:'both',period:'month',minimumStay:1,minimumUnit:'month',advancePeriods:3,depositPeriods:1,maintenanceCoverage:'case_by_case',utilities:{water:{mode:'included',amount:0},internet:{mode:'fixed',amount:100}}}}
const selection={occupancy:'shared',startDate:'2026-10-12',endDate:'2027-04-12'}
test('shared initial charges separate first month, reusable advance and deposit',()=>{
 const q=D.quote(property,selection);assert.equal(q.rate,2000);assert.equal(q.total,10100);assert.deepEqual(q.lineItems.map(i=>i.amount),[2000,6000,2000,100])
})
test('exclusive rate covers entire room',()=>assert.equal(D.quote(property,{...selection,occupancy:'exclusive'}).rate,6000))
test('legacy per-tenant prices are preserved',()=>assert.equal(D.quote({price:2000,capacity:3},selection).rate,2000))
test('daily bookings bill nights and weekly bookings round up',()=>{
 const p={...property,price:600,rentalTerms:{...property.rentalTerms,period:'day',minimumUnit:'day',advancePeriods:0,depositPeriods:0,utilities:{}}}
 assert.equal(D.quote(p,{...selection,endDate:'2026-10-15'}).total,600)
 p.rentalTerms.period='week';assert.equal(D.quote(p,{...selection,endDate:'2026-10-20'}).periods,2)
})
test('minimum calendar months clamp end-of-month rather than overflow',()=>{
 assert.equal(D.addUnits('2027-01-31',1,'month'),'2027-02-28')
 assert.throws(()=>D.quote(property,{...selection,endDate:'2026-11-11'}),/minimum/)
})
test('reject unsupported periods, negative charges, invalid dates and occupancy',()=>{
 assert.throws(()=>D.quote({...property,price:-1},selection))
 assert.throws(()=>D.quote(property,{...selection,startDate:'2026-02-30'}))
 assert.throws(()=>D.quote({...property,rentalTerms:{...property.rentalTerms,occupancy:'shared'}},{...selection,occupancy:'exclusive'}))
 assert.throws(()=>D.normalizeTerms({...property,rentalTerms:{...property.rentalTerms,advancePeriods:1.5}}))
})
test('whole-room reservation blocks overlapping shared rentals, but not adjacent stays',()=>{
 const h={...selection,occupancy:'exclusive',status:'approved'}
 assert.equal(D.available(property,selection,[h]),false)
 assert.equal(D.available(property,{...selection,startDate:'2027-04-12',endDate:'2027-05-12'},[h]),true)
})
test('exclusive requests require empty room; expired holds do not consume capacity',()=>{
 assert.equal(D.available(property,{...selection,occupancy:'exclusive'},[{...selection,status:'approved'}]),false)
 assert.equal(D.available(property,selection,[{...selection,occupancy:'exclusive',status:'reserved',expiresAt:10}],20),true)
 assert.equal(D.available(property,selection,Array(3).fill({...selection,status:'approved'})),false)
})
test('split charges conserve centavos and reject non-finite amounts',()=>{assert.deepEqual(D.split(100,3),[33.34,33.33,33.33]);assert.equal(D.split(100,3).reduce((s,v)=>s+D.cents(v),0),10000);assert.throws(()=>D.split(Infinity,3))})
test('sequential reservations do not consume slots at the same time',()=>{
 const holds=[{startDate:'2026-10-12',endDate:'2026-11-12',status:'approved'},{startDate:'2026-11-12',endDate:'2026-12-12',status:'approved'}]
 assert.equal(D.available({...property,capacity:2},selection,holds),true)
})
test('paid tiers follow 300 per two rooms; custom tiers require review',()=>{
 assert.deepEqual([1,2,4,6,8,10].map(n=>D.plan(n).amount),[0,300,600,900,1200,1500]);assert.throws(()=>D.plan(12))
})
test('missing schedules do not claim a perfect match',()=>{assert.equal(D.score({},[]),null);assert.equal(D.score({},[{}]),null);assert.equal(D.score({monday:{0:'sleep'}},[{monday:{0:'sleep'}}]),100)})
