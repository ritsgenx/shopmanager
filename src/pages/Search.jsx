import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search as SearchIcon, Smartphone, ReceiptText, ShoppingBag, Users, UserCheck,
  Camera, Download, Loader2, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import {
  searchByImei, searchByInvoice, searchByPurchase,
  searchCustomersByTerm, getCustomerHistory,
  searchEmployeesByTerm, getEmployeeActivity,
} from '@/lib/search'
import { getSaleById } from '@/lib/sales'
import { generateInvoicePdf } from '@/lib/generateInvoicePdf'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import BarcodeScanner from '@/components/inventory/BarcodeScanner'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const SEARCH_TYPES = [
  { id: 'imei', label: 'IMEI', icon: Smartphone, placeholder: 'Enter or scan 15-digit IMEI…', scan: true },
  { id: 'invoice', label: 'Invoice No.', icon: ReceiptText, placeholder: 'Enter invoice number…' },
  { id: 'purchase', label: 'Purchase No.', icon: ShoppingBag, placeholder: 'Enter purchase bill number…' },
  { id: 'customer', label: 'Customer', icon: Users, placeholder: 'Enter customer name or phone…' },
  { id: 'employee', label: 'Employee', icon: UserCheck, placeholder: 'Enter employee name or phone…', ownerOnly: true },
]

function DeviceStatusBadge({ status }) {
  if (status === 'sold')
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20">Sold</Badge>
  if (status === 'low_stock')
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20">Low Stock</Badge>
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20">In Stock</Badge>
}

function SaleCard({ sale, onDownload, pdfLoadingId, title = 'Bill Details' }) {
  const cust = sale.customers ?? {}
  const custName = cust.customer_type === 'company' ? cust.company_name : cust.full_name

  return (
    <Card className="max-w-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{title}</p>
            <p className="font-mono font-bold">{sale.invoice_number}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(sale.sale_date)}</p>
          </div>
          <Button
            size="sm"
            className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0"
            onClick={() => onDownload(sale.id)}
            disabled={pdfLoadingId === sale.id}
          >
            {pdfLoadingId === sale.id
              ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              : <Download className="w-4 h-4 mr-1.5" />}
            Reprint Bill
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-border pt-3">
          <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{custName ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Phone</p><p>{cust.phone ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Grand Total</p><p className="font-semibold">{fmt(sale.grand_total)}</p></div>
          <div><p className="text-xs text-muted-foreground">Payment</p><p className="capitalize">{sale.payment_status ?? '—'}</p></div>
        </div>
        {(sale.sale_items?.length ?? 0) > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Items</p>
            <div className="space-y-1.5 text-sm">
              {sale.sale_items.map(item => {
                const p = item.products ?? {}
                return (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {[p.brand, p.model, p.variant].filter(Boolean).join(' ')}
                      {item.imei_number ? ` · ${item.imei_number}` : ''}
                    </span>
                    <span className="font-medium">{fmt(item.total_amount)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ImeiResult({ result, onDownload, pdfLoadingId }) {
  const { device, sale } = result
  const p = device.products ?? {}
  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Device</p>
              <h3 className="font-bold text-lg">{p.brand} {p.model}</h3>
              <p className="text-sm text-muted-foreground">{[p.variant, p.color].filter(Boolean).join(' · ')}</p>
            </div>
            <DeviceStatusBadge status={device.status} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-border pt-3">
            <div><p className="text-xs text-muted-foreground">IMEI</p><p className="font-mono">{device.imei_number}</p></div>
            <div><p className="text-xs text-muted-foreground">Purchase Price</p><p className="font-semibold">{fmt(device.purchase_price)}</p></div>
            <div><p className="text-xs text-muted-foreground">Asking Price</p><p className="font-semibold">{device.selling_price != null ? fmt(device.selling_price) : '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Source</p><p className="capitalize">{device.stock_source}</p></div>
          </div>
        </CardContent>
      </Card>

      {device.status === 'sold' && sale && (
        <SaleCard sale={sale} onDownload={onDownload} pdfLoadingId={pdfLoadingId} title="Sale Details" />
      )}
      {device.status === 'sold' && !sale && (
        <p className="text-sm text-muted-foreground italic">Marked sold, but no matching sale record was found.</p>
      )}
    </div>
  )
}

function PurchaseResult({ data, onPivotImei }) {
  const { purchase, items } = data
  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Purchase</p>
              <p className="font-mono font-bold">{purchase.bill_number ?? '—'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(purchase.created_at)}</p>
            </div>
            <Badge className={purchase.purchase_type === 'official'
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
              : 'bg-slate-500/15 text-slate-400 border-slate-500/25'}>
              {purchase.purchase_type === 'official' ? 'Official' : 'Unofficial'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-border pt-3">
            <div><p className="text-xs text-muted-foreground">Supplier</p><p className="font-medium">{purchase.supplier_name ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Phone</p><p>{purchase.supplier_phone ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Payment</p><p className="capitalize">{(purchase.payment_method ?? '').replace(/_/g, ' ') || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Grand Total</p><p className="font-semibold">{fmt(purchase.grand_total)}</p></div>
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Devices in this batch ({items.length})</p>
            <div className="divide-y divide-border">
              {items.map(item => {
                const p = item.products ?? {}
                return (
                  <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{[p.brand, p.model, p.variant].filter(Boolean).join(' ')}</p>
                      {item.imei_number && (
                        <button onClick={() => onPivotImei(item.imei_number)}
                          className="font-mono text-xs text-indigo-400 hover:underline">
                          {item.imei_number}
                        </button>
                      )}
                    </div>
                    <DeviceStatusBadge status={item.status} />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CustomerList({ customers, onSelect }) {
  return (
    <div className="space-y-2 max-w-2xl">
      {customers.map(c => {
        const name = c.customer_type === 'company' ? c.company_name : c.full_name
        return (
          <Card key={c.id} className="cursor-pointer hover:border-indigo-500/60 transition-colors" onClick={() => onSelect(c)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{c.phone}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function CustomerHistory({ customer, sales, loading, onBack, onDownload, pdfLoadingId }) {
  const name = customer.customer_type === 'company' ? customer.company_name : customer.full_name
  return (
    <div className="max-w-2xl space-y-3">
      <button onClick={onBack} className="text-sm text-indigo-400 hover:underline">← Back to results</button>
      <Card>
        <CardContent className="p-4">
          <p className="font-bold">{name}</p>
          <p className="text-xs text-muted-foreground">{customer.phone}</p>
        </CardContent>
      </Card>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (sales?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No purchase history yet.</p>
      ) : (
        <div className="space-y-2">
          {sales.map(s => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold">{s.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(s.sale_date)}</p>
                  <p className="text-sm font-medium mt-1">{fmt(s.grand_total)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onDownload(s.id)} disabled={pdfLoadingId === s.id}>
                  {pdfLoadingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function EmployeeList({ employees, onSelect }) {
  return (
    <div className="space-y-2 max-w-2xl">
      {employees.map(e => (
        <Card key={e.id} className="cursor-pointer hover:border-indigo-500/60 transition-colors" onClick={() => onSelect(e)}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{e.full_name}</p>
              <p className="text-xs text-muted-foreground capitalize">{e.role} · {e.phone ?? e.email}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EmployeeActivity({ employee, activity, loading, onBack, onDownload, pdfLoadingId }) {
  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={onBack} className="text-sm text-indigo-400 hover:underline">← Back to results</button>
      <Card>
        <CardContent className="p-4">
          <p className="font-bold">{employee.full_name}</p>
          <p className="text-xs text-muted-foreground capitalize">{employee.role} · {employee.phone ?? employee.email}</p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Sales made ({activity?.sales?.length ?? 0})
            </p>
            {(activity?.sales?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No sales recorded.</p>
            ) : (
              <div className="space-y-2">
                {activity.sales.map(s => (
                  <Card key={s.id}>
                    <CardContent className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-mono text-xs font-semibold">{s.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(s.sale_date)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{fmt(s.grand_total)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDownload(s.id)} disabled={pdfLoadingId === s.id}>
                          {pdfLoadingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Stock added ({activity?.stockAdded?.length ?? 0})
            </p>
            {(activity?.stockAdded?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No stock entries recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {activity.stockAdded.map(item => {
                  const p = item.products ?? {}
                  return (
                    <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <span>
                        {[p.brand, p.model, p.variant].filter(Boolean).join(' ')}
                        {item.imei_number ? ` · ${item.imei_number}` : ''}
                      </span>
                      <DeviceStatusBadge status={item.status} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function SearchPage() {
  const { currentUser, currentTenant } = useAuth()
  const tenantId = currentTenant?.id
  const isOwner = currentUser?.role === 'admin'

  const availableTypes = SEARCH_TYPES.filter(t => !t.ownerOnly || isOwner)

  const [searchType, setSearchType] = useState('imei')
  const [queryInput, setQueryInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [result, setResult] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [pdfLoadingId, setPdfLoadingId] = useState(null)

  const [selectedEntity, setSelectedEntity] = useState(null)
  const [entityDetail, setEntityDetail] = useState(null)
  const [entityLoading, setEntityLoading] = useState(false)

  const activeType = SEARCH_TYPES.find(t => t.id === searchType)

  const handleTypeChange = (id) => {
    setSearchType(id)
    setQueryInput('')
    setResult(null)
    setSearched(false)
    setSelectedEntity(null)
    setEntityDetail(null)
  }

  const performSearch = async (type, term) => {
    const t = term.trim()
    if (!t || !tenantId) return
    setLoading(true)
    setSelectedEntity(null)
    setEntityDetail(null)

    let data = null, error = null
    if (type === 'imei') ({ data, error } = await searchByImei(tenantId, t))
    else if (type === 'invoice') ({ data, error } = await searchByInvoice(tenantId, t))
    else if (type === 'purchase') ({ data, error } = await searchByPurchase(tenantId, t))
    else if (type === 'customer') ({ data, error } = await searchCustomersByTerm(tenantId, t))
    else if (type === 'employee') ({ data, error } = await searchEmployeesByTerm(tenantId, t))

    if (error) toast.error('Search failed')
    setResult(data)
    setSearched(true)
    setLoading(false)
  }

  const handleSearch = () => performSearch(searchType, queryInput)

  const pivotToImei = (imei) => {
    setSearchType('imei')
    setQueryInput(imei)
    performSearch('imei', imei)
  }

  const handleScan = (imei) => {
    setQueryInput(imei)
    performSearch('imei', imei)
  }

  const handleSelectCustomer = async (customer) => {
    setSelectedEntity(customer)
    setEntityLoading(true)
    const { data } = await getCustomerHistory(tenantId, customer.id)
    setEntityDetail(data)
    setEntityLoading(false)
  }

  const handleSelectEmployee = async (employee) => {
    setSelectedEntity(employee)
    setEntityLoading(true)
    const activity = await getEmployeeActivity(tenantId, employee.id)
    setEntityDetail(activity)
    setEntityLoading(false)
  }

  const downloadBill = async (saleId) => {
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

  const isListResult = searchType === 'customer' || searchType === 'employee'
  const notFound = searched && !loading && (isListResult ? (result?.length ?? 0) === 0 : !result)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="p-4 md:p-6 space-y-5"
    >
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Find a device, bill, purchase, customer, or employee</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {availableTypes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTypeChange(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              searchType === id
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-indigo-500/40'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={queryInput}
            onChange={e => setQueryInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={activeType?.placeholder}
            className="pl-9"
          />
        </div>
        {activeType?.scan && (
          <Button variant="outline" size="icon" onClick={() => setScannerOpen(true)} title="Scan barcode">
            <Camera className="w-4 h-4" />
          </Button>
        )}
        <Button onClick={handleSearch} disabled={loading} className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {notFound && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <SearchIcon className="w-10 h-10 opacity-25" />
          <p className="font-medium">No {activeType?.label.toLowerCase()} match found for "{queryInput}"</p>
        </div>
      )}

      {searchType === 'imei' && result && (
        <ImeiResult result={result} onDownload={downloadBill} pdfLoadingId={pdfLoadingId} />
      )}

      {searchType === 'invoice' && result && (
        <SaleCard sale={result} onDownload={downloadBill} pdfLoadingId={pdfLoadingId} />
      )}

      {searchType === 'purchase' && result && (
        <PurchaseResult data={result} onPivotImei={pivotToImei} />
      )}

      {searchType === 'customer' && result?.length > 0 && !selectedEntity && (
        <CustomerList customers={result} onSelect={handleSelectCustomer} />
      )}
      {searchType === 'customer' && selectedEntity && (
        <CustomerHistory
          customer={selectedEntity}
          sales={entityDetail}
          loading={entityLoading}
          onBack={() => { setSelectedEntity(null); setEntityDetail(null) }}
          onDownload={downloadBill}
          pdfLoadingId={pdfLoadingId}
        />
      )}

      {searchType === 'employee' && result?.length > 0 && !selectedEntity && (
        <EmployeeList employees={result} onSelect={handleSelectEmployee} />
      )}
      {searchType === 'employee' && selectedEntity && (
        <EmployeeActivity
          employee={selectedEntity}
          activity={entityDetail}
          loading={entityLoading}
          onBack={() => { setSelectedEntity(null); setEntityDetail(null) }}
          onDownload={downloadBill}
          pdfLoadingId={pdfLoadingId}
        />
      )}

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </motion.div>
  )
}
