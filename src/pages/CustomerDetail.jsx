import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Loader2, Pencil, Phone, Mail, MapPin, CreditCard, User, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { getCustomerById } from '@/lib/customers'
import { getCustomerSales, getSaleById } from '@/lib/sales'
import { generateInvoicePdf } from '@/lib/generateInvoicePdf'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CustomerDialog from '@/components/customers/CustomerDialog'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const displayName = (c) => (c?.customer_type === 'company' ? c.company_name : c?.full_name) ?? '—'

const STATUS_COLORS = {
  paid:    'text-emerald-600 bg-emerald-50 border-emerald-200',
  partial: 'text-amber-600 bg-amber-50 border-amber-200',
  pending: 'text-red-600 bg-red-50 border-red-200',
}

function ContactRow({ icon: Icon, children }) {
  if (!children) return null
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <span className="text-foreground/80 leading-snug">{children}</span>
    </div>
  )
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentTenant } = useAuth()
  const tenantId = currentTenant?.id

  const [customer, setCustomer] = useState(null)
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [pdfLoadingId, setPdfLoadingId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!tenantId || !id) return
    Promise.all([
      getCustomerById(tenantId, id),
      getCustomerSales(tenantId, id),
    ]).then(([{ data: cust }, { data: custSales }]) => {
      setCustomer(cust)
      setSales(custSales ?? [])
      setLoading(false)
    })
  }, [tenantId, id])

  const handleDownloadInvoice = async (saleId) => {
    setPdfLoadingId(saleId)
    try {
      const { data } = await getSaleById(tenantId, saleId)
      if (data) {
        generateInvoicePdf({
          sale: data,
          saleItems: data.sale_items ?? [],
          customer: data.customers ?? {},
          tenant: currentTenant,
          sameState: (data.cgst_amount || 0) > 0,
        })
      }
    } catch {
      toast.error('PDF generation failed')
    }
    setPdfLoadingId(null)
  }

  if (loading) {
    return (
      <div className="space-y-5 pb-10">
        <Skeleton className="h-5 w-36" />
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">
        Customer not found.{' '}
        <button onClick={() => navigate(-1)} className="text-indigo-500 underline">Go back</button>
      </div>
    )
  }

  const initials = displayName(customer).slice(0, 2).toUpperCase()
  const fullAddress = [customer.address, customer.city, customer.state, customer.pincode]
    .filter(Boolean).join(', ')

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-10"
    >
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Customers
      </button>

      {/* Two-panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">

        {/* ── LEFT PANEL ── */}
        <div className="lg:sticky lg:top-0 space-y-4">

          {/* Avatar + name + stats */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xl shrink-0">
                {initials}
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>
            </div>

            <h1 className="text-lg font-bold leading-tight">{displayName(customer)}</h1>
            <div className="mt-1">
              {customer.customer_type === 'company' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  🏢 Company
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  👤 Individual
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-5">
              {[
                { label: 'Total Spent', value: fmt(customer.total_purchases) },
                { label: 'Visits',      value: customer.visit_count ?? 0 },
                { label: 'Last Visit',  value: fmtDate(customer.last_visit_date) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-muted/30 border border-border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5 leading-tight">{label}</p>
                  <p className="font-semibold text-xs">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact details */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Contact Info</p>
            <ContactRow icon={Phone}>{customer.phone}</ContactRow>
            <ContactRow icon={Phone}>{customer.whatsapp_number && `WA: ${customer.whatsapp_number}`}</ContactRow>
            <ContactRow icon={Mail}>{customer.email}</ContactRow>
            <ContactRow icon={MapPin}>{fullAddress || null}</ContactRow>
            <ContactRow icon={CreditCard}>{customer.gstin && <span className="font-mono text-xs">{customer.gstin}</span>}</ContactRow>
            <ContactRow icon={User}>{customer.contact_person && `Contact: ${customer.contact_person}`}</ContactRow>
            <ContactRow icon={Calendar}>{customer.date_of_birth && `DOB: ${fmtDate(customer.date_of_birth)}`}</ContactRow>
            <ContactRow icon={Calendar}>{customer.anniversary_date && `Anniversary: ${fmtDate(customer.anniversary_date)}`}</ContactRow>
            {customer.preferred_brand && (
              <div className="text-sm">
                <span className="text-muted-foreground text-xs">Preferred brand: </span>
                <span className="font-medium">{customer.preferred_brand}</span>
              </div>
            )}
            {customer.notes && (
              <div className="pt-3 mt-1 border-t border-border text-xs text-muted-foreground leading-relaxed">
                {customer.notes}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — Purchase history ── */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">Purchase History</h2>
            {sales.length > 0 && (
              <span className="text-sm text-muted-foreground">· {sales.length} invoice{sales.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {sales.length === 0 ? (
            <div className="rounded-2xl border border-border p-16 text-center text-sm text-muted-foreground">
              No purchase history found
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      {['Date', 'Invoice', 'Items Purchased', 'Salesman', 'Amount', 'Status', ''].map((h, i) => (
                        <th
                          key={i}
                          className={cn(
                            'px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                            i === 4 ? 'text-right' : i === 5 ? 'text-center' : 'text-left'
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sales.map(sale => (
                      <tr key={sale.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {fmtDate(sale.sale_date)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                          {sale.invoice_number}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {(sale.sale_items ?? []).map((item, i) => {
                              const p = item.products
                              const name = p
                                ? `${p.brand} ${p.model}${p.variant ? ` ${p.variant}` : ''}`
                                : '—'
                              return (
                                <p key={i} className="text-xs leading-snug">
                                  {name}
                                  {item.quantity > 1 && (
                                    <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                                  )}
                                </p>
                              )
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {sale.users?.full_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                          {fmt(sale.grand_total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize',
                            STATUS_COLORS[sale.payment_status] ?? STATUS_COLORS.pending
                          )}>
                            {sale.payment_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-indigo-500"
                            onClick={() => handleDownloadInvoice(sale.id)}
                            disabled={pdfLoadingId === sale.id}
                          >
                            {pdfLoadingId === sale.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Download className="w-4 h-4" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {sales.map(sale => (
                  <div key={sale.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs font-semibold">{sale.invoice_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(sale.sale_date)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize',
                          STATUS_COLORS[sale.payment_status] ?? STATUS_COLORS.pending
                        )}>
                          {sale.payment_status}
                        </span>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-indigo-500"
                          onClick={() => handleDownloadInvoice(sale.id)}
                          disabled={pdfLoadingId === sale.id}
                        >
                          {pdfLoadingId === sale.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Download className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 space-y-0.5">
                      {(sale.sale_items ?? []).map((item, i) => {
                        const p = item.products
                        const name = p
                          ? `${p.brand} ${p.model}${p.variant ? ` ${p.variant}` : ''}`
                          : '—'
                        return (
                          <p key={i} className="text-xs leading-snug">
                            {name}
                            {item.quantity > 1 && (
                              <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                            )}
                          </p>
                        )
                      })}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">{sale.users?.full_name ?? '—'}</p>
                      <p className="text-sm font-bold">{fmt(sale.grand_total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <CustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
        onSuccess={() => {
          getCustomerById(tenantId, id).then(({ data }) => setCustomer(data))
          setEditOpen(false)
        }}
      />
    </motion.div>
  )
}
