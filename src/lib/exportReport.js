export function exportReport(bills, payments) {
  const safe = v => `"${String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`
  const rows = [['Date', 'Room', 'Bill', 'Amount PHP', 'Method', 'Reference', 'Platform commission PHP']]
  payments.filter(p => p.status === 'paid').forEach(p => {
    const b = bills.find(b => b.id === p.billId)
    rows.push([p.reviewedAt?.toDate?.().toISOString() || '', b?.propertyTitle, b?.title, p.amount, p.method || 'legacy', p.referenceNo, p.platformCommission || 0])
  })
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a');link.href=url;link.download='skedlink-payments.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
