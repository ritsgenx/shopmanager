import { jsPDF } from 'jspdf'
import { numberToWords } from './numberToWords'

const fmtAmt = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

export function generateInvoicePdf({ sale, saleItems, customer, tenant, sameState }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const W = 210
  const M = 15
  const CW = W - 2 * M // 180mm content width
  let y = M

  // ── Helpers ───────────────────────────────────────────────────────────────
  const hLine = (yPos, weight = 0.3) => {
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(weight)
    doc.line(M, yPos, M + CW, yPos)
  }

  const txt = (str, x, yPos, opts = {}) => {
    doc.text(String(str ?? ''), x, yPos, opts)
  }

  // ── Shop Header ───────────────────────────────────────────────────────────
  doc.setFillColor(79, 70, 229) // indigo-600
  doc.rect(M, y, CW, 22, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  txt(tenant?.name || 'MobileShop', M + 4, y + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const shopAddr = [tenant?.address, tenant?.city, tenant?.state].filter(Boolean).join(', ')
  if (shopAddr) txt(shopAddr, M + 4, y + 14)
  if (tenant?.phone) txt('Ph: ' + tenant.phone, M + 4, y + 19)
  if (tenant?.gstin) txt('GSTIN: ' + tenant.gstin, M + 4, y + 23)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  txt('TAX INVOICE', M + CW - 4, y + 10, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  txt(sale.sale_type === 'b2b' ? 'B2B' : 'B2C', M + CW - 4, y + 17, { align: 'right' })

  y += 26
  doc.setTextColor(0, 0, 0)

  // ── Invoice Info + Customer Info ──────────────────────────────────────────
  const halfX = M + CW / 2 + 5

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  txt('Invoice No.', halfX, y)
  txt('Date', halfX, y + 6)
  doc.setFont('helvetica', 'normal')
  txt(sale.invoice_number, halfX + 28, y)
  txt(fmtDate(sale.sale_date), halfX + 28, y + 6)

  const custName = customer?.customer_type === 'company'
    ? customer.company_name
    : customer?.full_name || 'Walk-in Customer'

  doc.setFont('helvetica', 'bold')
  txt('Bill To:', M, y)
  doc.setFont('helvetica', 'normal')
  txt(custName, M, y + 6)
  if (customer?.phone) txt('Ph: ' + customer.phone, M, y + 12)

  const custAddr = [customer?.address, customer?.city, customer?.state, customer?.pincode]
    .filter(Boolean).join(', ')
  if (custAddr) {
    const lines = doc.splitTextToSize(custAddr, CW / 2 - 10)
    doc.text(lines, M, y + 18)
  }
  if (customer?.gstin) txt('GSTIN: ' + customer.gstin, M, y + 28)

  y += 32
  hLine(y, 0.5)
  y += 6

  // ── Items Table ───────────────────────────────────────────────────────────
  // Column definitions [x, width, header, align]
  const COL = {
    sr:     { x: M,      w: 8,  h: 'Sr',      a: 'center' },
    desc:   { x: M + 8,  w: 60, h: 'Description', a: 'left' },
    hsn:    { x: M + 68, w: 18, h: 'HSN',     a: 'center' },
    qty:    { x: M + 86, w: 12, h: 'Qty',     a: 'center' },
    rate:   { x: M + 98, w: 27, h: 'Rate',    a: 'right' },
    gst:    { x: M + 125,w: 13, h: 'GST%',   a: 'center' },
    amount: { x: M + 138,w: 42, h: 'Amount',  a: 'right' },
  }

  const colRight = (col) => col.x + col.w

  // Table header background
  doc.setFillColor(243, 244, 246)
  doc.rect(M, y, CW, 8, 'F')
  hLine(y, 0.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)

  const hY = y + 5.5
  Object.values(COL).forEach((col) => {
    if (col.a === 'right') txt(col.h, colRight(col) - 1, hY, { align: 'right' })
    else if (col.a === 'center') txt(col.h, col.x + col.w / 2, hY, { align: 'center' })
    else txt(col.h, col.x + 1, hY)
  })

  y += 8
  hLine(y, 0.5)
  doc.setTextColor(0, 0, 0)

  // Table rows
  saleItems.forEach((item, i) => {
    const isSmartphone = item.imei_number
    const rowH = isSmartphone ? 13 : 8

    if (i % 2 === 1) {
      doc.setFillColor(249, 250, 251)
      doc.rect(M, y, CW, rowH, 'F')
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    const rY = y + 5.5
    const desc = item.product_name ||
      [item.products?.brand, item.products?.model, item.products?.variant, item.products?.color]
        .filter(Boolean).join(' ')
    const descLines = doc.splitTextToSize(desc, COL.desc.w - 2)

    txt(String(i + 1), COL.sr.x + COL.sr.w / 2, rY, { align: 'center' })
    doc.text(descLines, COL.desc.x + 1, rY)
    if (isSmartphone) {
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      txt('IMEI: ' + item.imei_number, COL.desc.x + 1, rY + 5)
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
    }

    txt(item.products?.hsn_code || '-', COL.hsn.x + COL.hsn.w / 2, rY, { align: 'center' })
    txt(String(item.quantity), COL.qty.x + COL.qty.w / 2, rY, { align: 'center' })
    txt(fmtAmt(item.unit_price), colRight(COL.rate) - 1, rY, { align: 'right' })
    txt((item.gst_rate || 0) + '%', COL.gst.x + COL.gst.w / 2, rY, { align: 'center' })
    txt(fmtAmt(item.total_amount), colRight(COL.amount) - 1, rY, { align: 'right' })

    y += rowH
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.1)
    doc.line(M, y, M + CW, y)
  })

  y += 5

  // ── Totals Block (right-aligned) ──────────────────────────────────────────
  const tLabelX = M + CW * 0.55
  const tValueX = M + CW - 1

  const addRow = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(9)
    txt(label, tLabelX, y)
    txt(value, tValueX, y, { align: 'right' })
    y += 6
  }

  addRow('Subtotal:', fmtAmt(sale.subtotal))
  if ((sale.discount_amount || 0) > 0) addRow('Discount:', '-' + fmtAmt(sale.discount_amount))
  addRow('Taxable Amount:', fmtAmt(sale.taxable_amount))

  if (sameState) {
    addRow('CGST:', fmtAmt(sale.cgst_amount))
    addRow('SGST:', fmtAmt(sale.sgst_amount))
  } else {
    addRow('IGST:', fmtAmt(sale.igst_amount))
  }

  hLine(y, 0.6)
  y += 3
  doc.setFontSize(10)
  addRow('Grand Total:', fmtAmt(sale.grand_total), true)
  hLine(y, 0.6)

  y += 8

  // ── Amount in Words ───────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  const words = 'Amount in words: ' + numberToWords(sale.grand_total)
  const wordLines = doc.splitTextToSize(words, CW)
  doc.text(wordLines, M, y)
  y += wordLines.length * 5 + 6

  // ── Payment Info ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(8)
  txt('Payment Method: ' + (sale.payment_method || '').replace('_', ' ').toUpperCase(), M, y)
  txt('Status: ' + (sale.payment_status || '').toUpperCase(), M + 60, y)
  if (sale.upi_reference) txt('UPI Ref: ' + sale.upi_reference, M + 120, y)

  y += 10
  hLine(y, 0.3)
  y += 6

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(79, 70, 229)
  txt('Thank you for your business!', W / 2, y, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  txt('This is a computer-generated invoice.', W / 2, y + 5, { align: 'center' })

  // Save
  const filename = `Invoice-${sale.invoice_number.replace(/\//g, '-')}.pdf`
  doc.save(filename)
}
