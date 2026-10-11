import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RentalTermsFields } from './views/components/property/RentalTermsFields'
import { ContactModal } from './views/components/property/ContactModal'
import { ApplicationsPanel } from './views/components/property/ApplicationsPanel'
import { platform } from './lib/platform'

jest.mock('./lib/platform',()=>({platform:jest.fn(),uploadContract:jest.fn(),downloadContract:jest.fn()}))
const property={id:'room',ownerId:'owner',title:'Sunrise room',price:6000,capacity:3,rentalTerms:{occupancy:'both',period:'month',minimumStay:3,minimumUnit:'month',advancePeriods:3,depositPeriods:1,maintenanceCoverage:'case_by_case',utilities:{water:{mode:'included',amount:0},electricity:{mode:'variable',amount:0},internet:{mode:'included',amount:0}}}}
test('seeker sees shared and whole-room initial totals before submitting',()=>{
 render(<ContactModal property={property} tenant={{uid:'tenant'}} onClose={()=>{}} onSent={()=>{}} />)
 expect(screen.getByText(/Initial payment:/)).toHaveTextContent('₱10,000.00')
 fireEvent.change(screen.getByLabelText('Occupancy'),{target:{value:'exclusive'}})
 expect(screen.getByText(/Initial payment:/)).toHaveTextContent('₱30,000.00')
 expect(screen.getByText(/Minimum stay:/)).toHaveTextContent('3 month')
})
test('application sends chosen dates and occupancy without trusting browser prices',async()=>{
 platform.mockResolvedValueOnce({id:'application'});const onSent=jest.fn()
 render(<ContactModal property={property} tenant={{uid:'tenant'}} onClose={()=>{}} onSent={onSent} />)
 fireEvent.change(screen.getByLabelText('Check-in'),{target:{value:'2027-10-12'}})
 fireEvent.change(screen.getByLabelText('Check-out / contract end'),{target:{value:'2028-01-12'}})
 fireEvent.click(screen.getByText('Submit application'))
 await waitFor(()=>expect(onSent).toHaveBeenCalled())
 expect(platform).toHaveBeenCalledWith('apply',expect.objectContaining({selection:{occupancy:'shared',startDate:'2027-10-12',endDate:'2028-01-12'}}))
})
test('advance and deposit can be independently enabled',()=>{
 const change=jest.fn();render(<RentalTermsFields price={6000} capacity={3} value={{advancePeriods:0,depositPeriods:1}} onChange={change}/>)
 fireEvent.click(screen.getByLabelText('Reusable advance'))
 expect(change).toHaveBeenCalledWith(expect.objectContaining({advancePeriods:1,depositPeriods:1}))
})
test('accepted contract directs seeker to payment without any activation button',()=>{
 const inquiry={id:'application',propertyTitle:'Sunrise',status:'awaiting_payment',type:'rent'}
 render(<ApplicationsPanel inquiries={[inquiry]} user={{uid:'tenant'}} />)
 expect(screen.getByText(/Open Payments to complete/)).toBeInTheDocument()
 expect(screen.queryByText('Approve tenant')).not.toBeInTheDocument()
})
