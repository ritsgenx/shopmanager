import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Loader2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { getCustomerById } from '@/lib/customers'
import { getSales, getSaleById } from '@/lib/sales'
import { generateInvoicePdf } from '@/lib/generateInvoicePdf'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import CustomerDialog from '@/components/customers/CustomerDialog'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const displayName = (c) =>
  (c?.customer_type === 'company' ? c.company_name : c?.full_name) ?? '—'

function DetailRow({ label, value, mono = false }) {
  if (!value) return null
  return (
    <div className="flex items-start py-2.5 border-b border-border/50 last:border-0">
      <span className="w-36 shrink-0 text-xs text-muted-foreground pt-0.5">{label}</span>
      <span className={cn('text-sm font-medium flex-1', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  )
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-xl bg-muted/30 border border-border p-4 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  )
}

const TypeBadge = ({ type }) =>
  type === 'company' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
      🏢 Company
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
      👤 Individual
    </span>
  )

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentTenant } = useAuth()
  const tenantId = currentTenant?.id

  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [sales, setSales] = useState([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesFetched, setSalesFetched] = useState(false)
  const [pdfLoadingId, setPdfLoadingId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!tenantId || !id) return
    setLoading(true)
    getCustomerById(tenantId, id).then(({ data }) => {
      setCustomer(data)
      setLoading(false)
    })
  }, [tenantId, id])

  const handleTabChange = async (tab) => {
    setActiveTab(tab)
    if (tab === 'purchases' && !salesFetched) {
      setSalesLoading(true)
      const { data } = await getSales(tenantId, { customerId: id })
      setSales(data ?? [])
      setSalesFetched(true)
      setSalesLoading(false)
    }
  }

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
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">
        Customer not found.{' '}
        <button onClick={() => navigate('/customers')} className="text-indigo-500 underline">
          Go back
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto space-y-5 pb-10"
    >
      {/* Back */}
      <button
        onClick={() => navigate('/customers')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Customers
      </button>

      {/* Customer header */}
      <div className="rounded-xl border border-border bg-indigo-500/5 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {displayName(customer).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{displayName(customer)}</h1>
              <div className="mt-1"><TypeBadge type={customer.customer_type} /></div>
              {customer.phone && (
                <p className="text-sm text-muted-foreground mt-1">{customer.phone}</p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="shrink-0">
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <StatBox label="Total Purchases" value={fmt(customer.total_purchases)} />
          <StatBox label="Visits" value={customer.visit_count ?? 0} />
          <StatBox label="Last Visit" value={fmtDate(customer.last_visit_date)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border border-border rounded-lg p-1 w-fit">
        {[
          { key: 'profile',   label: 'Profile' },
          { key: 'purchases', label: `Purchases (${customer.visit_count ?? 0})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={cn(
              'px-4 py-1.5 rounded text-sm font-medium transition-colors',
              activeTab === key
                ? 'bg-indigo-500 text-white'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="rounded-xl border border-border bg-white px-6 py-2">
          <DetailRow label="Phone"          value={customer.phone} />
          <DetailRow label="WhatsApp"       value={customer.whatsapp_number} />
          <DetailRow label="Email"          value={customer.email} />
          <DetailRow label="Contact Person" value={customer.contact_person} />
          <DetailRow label="GSTIN"          value={customer.gstin} mono />
          <DetailRow label="Preferred Brand" value={customer.preferred_brand} />
          <DetailRow
            label="Address"
            value={[customer.address, customer.city, customer.state, customer.pincode]
              .filter(Boolean).join(', ') || null}
          />
          <DetailRow label="Date of Birth" value={customer.date_of_birth ? fmtDate(customer.date_of_birth) : null} />
          <DetailRow label="Anniversary"   value={customer.anniversary_date ? fmtDate(customer.anniversary_date) : null} />
          {customer.notes && (
            <div className="my-3 rounded-lg bg-muted/30 border border-border px-4 py-3 text-xs text-muted-foreground leading-relaxed">
              {customer.notes}
            </div>
          )}
        </div>
      )}

      {/* Purchases Tab */}
      {activeTab === 'purchases' && (
        <div className="space-y-3">
          {salesLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-4 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : sales.length === 0 ? (
            <div className="rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">
              No purchase history found
            </div>
          ) : (
            sales.map(sale => {
              const statusColor =
                sale.payment_status === 'paid'    ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                sale.payment_status === 'partial' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                    'text-red-600 bg-red-50 border-red-200'
              return (
                <div key={sale.id} className="rounded-xl border border-border bg-white p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{sale.invoice_number}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(sale.sale_date)}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {sale.payment_method?.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{fmt(sale.grand_total)}</p>
                    <span className={cn(
                      'inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize',
                      statusColor
                    )}>
                      {sale.payment_status}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-indigo-500"
                    onClick={() => handleDownloadInvoice(sale.id)}
                    disabled={pdfLoadingId === sale.id}
                  >
                    {pdfLoadingId === sale.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />}
                  </Button>
                </div>
              )
            })
          )}
        </div>
      )}

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
