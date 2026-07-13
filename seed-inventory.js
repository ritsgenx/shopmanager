/**
 * MobileShop — Inventory Seed Script
 *
 * Cleans: inventory, purchases, purchase_items, sales, sale_items, attendance, commissions
 * Seeds:  ~500 phones per shop (50% official POs, 50% unofficial POs)
 *         Owner-created stock = approved | Employee-created stock = pending
 *
 * Usage:
 *   1. Add SUPABASE_SERVICE_ROLE_KEY to your .env file
 *      (Supabase Dashboard → Project Settings → API → service_role secret)
 *   2. node seed-inventory.js
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// ── Load .env ────────────────────────────────────────────────────────────────
try {
  const raw = readFileSync('.env', 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌  Missing required environment variables:')
  if (!SUPABASE_URL) console.error('   VITE_SUPABASE_URL        (already in .env)')
  if (!SERVICE_KEY)  console.error('   SUPABASE_SERVICE_ROLE_KEY (add to .env — Supabase → Settings → API → service_role)')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Phone catalog — total must equal PHONES_PER_SHOP ─────────────────────────
const PHONES_PER_SHOP = 500

const CATALOG = [
  // Samsung — 180
  { brand: 'Samsung', model: 'Galaxy A14',  variant: '4GB/64GB',   color: 'Black',            buy: 10800, sell: 13999, count: 30 },
  { brand: 'Samsung', model: 'Galaxy A14',  variant: '4GB/64GB',   color: 'Green',            buy: 10800, sell: 13999, count: 25 },
  { brand: 'Samsung', model: 'Galaxy A14',  variant: '6GB/128GB',  color: 'Black',            buy: 12500, sell: 15999, count: 20 },
  { brand: 'Samsung', model: 'Galaxy M14',  variant: '4GB/128GB',  color: 'Dark Blue',        buy: 12000, sell: 15499, count: 25 },
  { brand: 'Samsung', model: 'Galaxy A34',  variant: '6GB/128GB',  color: 'Black',            buy: 22000, sell: 26999, count: 25 },
  { brand: 'Samsung', model: 'Galaxy A34',  variant: '6GB/128GB',  color: 'Silver',           buy: 22000, sell: 26999, count: 15 },
  { brand: 'Samsung', model: 'Galaxy A34',  variant: '8GB/256GB',  color: 'Awesome Violet',   buy: 24500, sell: 29999, count: 15 },
  { brand: 'Samsung', model: 'Galaxy A54',  variant: '8GB/256GB',  color: 'Awesome Graphite', buy: 31000, sell: 37999, count: 15 },
  { brand: 'Samsung', model: 'Galaxy S23',  variant: '8GB/256GB',  color: 'Phantom Black',    buy: 62000, sell: 74999, count: 10 },
  // Apple — 125
  { brand: 'Apple',   model: 'iPhone 13',   variant: '128GB',      color: 'Midnight',         buy: 44000, sell: 54999, count: 25 },
  { brand: 'Apple',   model: 'iPhone 13',   variant: '128GB',      color: 'Starlight',        buy: 44000, sell: 54999, count: 20 },
  { brand: 'Apple',   model: 'iPhone 14',   variant: '128GB',      color: 'Midnight',         buy: 55000, sell: 67999, count: 25 },
  { brand: 'Apple',   model: 'iPhone 14',   variant: '256GB',      color: 'Blue',             buy: 62000, sell: 74999, count: 15 },
  { brand: 'Apple',   model: 'iPhone 14',   variant: '128GB',      color: 'Yellow',           buy: 55000, sell: 67999, count: 10 },
  { brand: 'Apple',   model: 'iPhone 15',   variant: '128GB',      color: 'Black',            buy: 68000, sell: 79999, count: 20 },
  { brand: 'Apple',   model: 'iPhone 15',   variant: '128GB',      color: 'Pink',             buy: 68000, sell: 79999, count: 10 },
  // Redmi — 95
  { brand: 'Redmi',   model: 'Note 12',     variant: '4GB/128GB',  color: 'Midnight Black',   buy: 12000, sell: 14999, count: 20 },
  { brand: 'Redmi',   model: 'Note 12',     variant: '6GB/128GB',  color: 'Ice Blue',         buy: 13500, sell: 16999, count: 20 },
  { brand: 'Redmi',   model: 'Note 12 Pro', variant: '6GB/128GB',  color: 'Stardust Purple',  buy: 16000, sell: 19999, count: 25 },
  { brand: 'Redmi',   model: 'Note 12 Pro', variant: '8GB/256GB',  color: 'Arctic White',     buy: 18000, sell: 22499, count: 10 },
  { brand: 'Redmi',   model: 'Note 13',     variant: '6GB/128GB',  color: 'Midnight Black',   buy: 15500, sell: 18999, count: 20 },
  // Realme — 40
  { brand: 'Realme',  model: 'C55',         variant: '6GB/128GB',  color: 'Rainy Night',      buy: 10500, sell: 12999, count: 15 },
  { brand: 'Realme',  model: 'C55',         variant: '6GB/128GB',  color: 'Rainforest',       buy: 10500, sell: 12999, count: 10 },
  { brand: 'Realme',  model: 'Narzo 60',    variant: '6GB/128GB',  color: 'Cosmic Black',     buy: 14000, sell: 17499, count: 15 },
  // Vivo — 35
  { brand: 'Vivo',    model: 'Y100',        variant: '6GB/128GB',  color: 'Radiant Red',      buy: 14500, sell: 17999, count: 20 },
  { brand: 'Vivo',    model: 'Y200',        variant: '8GB/256GB',  color: 'Glossy Black',     buy: 18500, sell: 22999, count: 15 },
  // OnePlus — 25
  { brand: 'OnePlus', model: 'Nord CE 3',   variant: '8GB/128GB',  color: 'Aqua Surge',       buy: 22500, sell: 26999, count: 25 },
]
// 180 + 125 + 95 + 40 + 35 + 25 = 500 ✓

const OFFICIAL_SUPPLIERS = [
  { name: 'Ingram Micro India Pvt Ltd',  phone: '9988776655', gstin: '27AABCI1234A1Z5' },
  { name: 'Redington India Ltd',         phone: '9977665544', gstin: '33AABCR5678B1Z3' },
  { name: 'Tech Pacific India Pvt Ltd',  phone: '9966554433', gstin: '07AABCT9012C1Z1' },
  { name: 'Supertron Electronics Ltd',   phone: '9955443322', gstin: '19AABCS3456D1Z9' },
]

const UNOFFICIAL_SUPPLIERS = [
  { name: 'Raj Electronics',       phone: '9876543210' },
  { name: 'Sharma Mobile Hub',     phone: '9765432109' },
  { name: 'Capital Distributors',  phone: '9654321098' },
  { name: 'Prime Mobile Supply',   phone: '9543210987' },
]

// ── Utilities ─────────────────────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function chunk(arr, minSize, maxSize) {
  const result = []
  let i = 0
  while (i < arr.length) {
    const size = Math.min(arr.length - i, Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize)
    result.push(arr.slice(i, i + size))
    i += size
  }
  return result
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function randomDate(maxDaysAgo = 180, minDaysAgo = 2) {
  const ms = (Math.floor(Math.random() * (maxDaysAgo - minDaysAgo)) + minDaysAgo) * 86_400_000
  return new Date(Date.now() - ms)
}

let _imei = 350_000_100_000_000n  // BigInt for safe arithmetic
function nextImei() {
  const val = _imei++
  return val.toString()
}

// ── Data cleanup ──────────────────────────────────────────────────────────────
async function clearTenantData(tenantId) {
  // commissions reference sales — delete first
  const { error: ce } = await db.from('commissions').delete().eq('tenant_id', tenantId)
  if (ce && ce.code !== '42P01') console.warn(`    ⚠️  commissions clear: ${ce.message}`)

  // sale_items — try via sale_id to avoid needing tenant_id column
  const { data: salesRows } = await db.from('sales').select('id').eq('tenant_id', tenantId)
  const saleIds = (salesRows ?? []).map(s => s.id)
  if (saleIds.length) {
    const { error: sie } = await db.from('sale_items').delete().in('sale_id', saleIds)
    if (sie && sie.code !== '42P01') {
      await db.from('sale_items').delete().eq('tenant_id', tenantId)
    }
  }

  await db.from('sales').delete().eq('tenant_id', tenantId)
  await db.from('purchase_items').delete().eq('tenant_id', tenantId)
  await db.from('purchases').delete().eq('tenant_id', tenantId)
  await db.from('inventory').delete().eq('tenant_id', tenantId)
  await db.from('attendance').delete().eq('tenant_id', tenantId)
}

// ── Catalog setup ─────────────────────────────────────────────────────────────
// Models (brand+name+variant) are first-class rows; products are their color
// rows. Returns the same map as before: brand|model|variant|color → product id.
async function ensureProducts(tenantId) {
  // 0. Tax category — models must point at one (smartphone / 8517 / 18%)
  let { data: taxCat } = await db
    .from('tax_categories')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', 'smartphone')
    .maybeSingle()
  if (!taxCat) {
    const { data: created, error: tcErr } = await db
      .from('tax_categories')
      .insert({ tenant_id: tenantId, name: 'smartphone', hsn_code: '8517', gst_rate: 18 })
      .select('id')
      .single()
    if (tcErr) throw new Error(`Tax category creation failed: ${tcErr.message}`)
    taxCat = created
  }

  // 1. Models
  const { data: existingModels } = await db
    .from('models')
    .select('id, brand, name, variant')
    .eq('tenant_id', tenantId)

  const modelMap = {}
  for (const m of existingModels ?? []) {
    modelMap[`${m.brand}|${m.name}|${m.variant}`] = m.id
  }

  const wantedModels = new Map()
  for (const c of CATALOG) {
    const key = `${c.brand}|${c.model}|${c.variant}`
    if (!modelMap[key] && !wantedModels.has(key)) {
      wantedModels.set(key, {
        tenant_id:       tenantId,
        brand:           c.brand,
        name:            c.model,
        variant:         c.variant,
        tax_category_id: taxCat.id,
      })
    }
  }

  if (wantedModels.size) {
    const { data: createdModels, error: mErr } = await db.from('models')
      .insert([...wantedModels.values()])
      .select('id, brand, name, variant')
    if (mErr) throw new Error(`Model creation failed: ${mErr.message}`)
    for (const m of createdModels ?? []) {
      modelMap[`${m.brand}|${m.name}|${m.variant}`] = m.id
    }
    console.log(`    🏷️  Created ${wantedModels.size} new models (${Object.keys(modelMap).length} total)`)
  }

  // 2. Color rows
  const { data: existing } = await db
    .from('products')
    .select('id, model_id, color')
    .eq('tenant_id', tenantId)

  const byModelColor = {}
  for (const p of existing ?? []) {
    byModelColor[`${p.model_id}|${p.color ?? ''}`] = p.id
  }

  const map = {}
  const toCreate = []
  for (const c of CATALOG) {
    const modelId = modelMap[`${c.brand}|${c.model}|${c.variant}`]
    const existingId = byModelColor[`${modelId}|${c.color}`]
    if (existingId) {
      map[`${c.brand}|${c.model}|${c.variant}|${c.color}`] = existingId
    } else {
      toCreate.push({ tenant_id: tenantId, model_id: modelId, color: c.color })
    }
  }

  if (toCreate.length) {
    const { data: created, error } = await db.from('products').insert(toCreate)
      .select('id, model_id, color, models ( brand, name, variant )')
    if (error) throw new Error(`Product creation failed: ${error.message}`)
    for (const p of created ?? []) {
      map[`${p.models.brand}|${p.models.name}|${p.models.variant}|${p.color}`] = p.id
    }
    console.log(`    📱 Created ${toCreate.length} new products (${Object.keys(map).length} total)`)
  } else {
    console.log(`    📱 Using ${Object.keys(map).length} existing products`)
  }

  return map
}

// ── Create one purchase order + its inventory rows ────────────────────────────
async function createBatch({ tenantId, phones, purchaseType, supplier, createdBy, admin, date, poNum, isEmployee }) {
  const grandTotal = phones.reduce((s, p) => s + p.buy, 0)
  const gstAmount  = Math.round(grandTotal * 18 / 118)
  const baseAmount = grandTotal - gstAmount
  const isoDate    = date.toISOString()

  // Purchase header
  const { data: po, error: poErr } = await db.from('purchases').insert({
    tenant_id:        tenantId,
    created_by:       createdBy.id,
    purchase_type:    purchaseType,
    supplier_name:    supplier.name,
    supplier_phone:   supplier.phone,
    supplier_gstin:   purchaseType === 'official' ? supplier.gstin : null,
    bill_number:      purchaseType === 'official'
                        ? `INV-${String(poNum).padStart(5, '0')}`
                        : `RF-${String(poNum).padStart(4, '0')}`,
    bill_date:        purchaseType === 'official' ? isoDate.slice(0, 10) : null,
    payment_method:   purchaseType === 'official' ? pick(['bank_transfer', 'cheque']) : pick(['cash', 'upi']),
    payment_status:   'paid',
    total_amount:     baseAmount,
    gst_amount:       gstAmount,
    grand_total:      grandTotal,
    reference_number: null,
    created_at:       isoDate,
  }).select('id').single()

  if (poErr) { console.error(`    ❌  PO ${poNum}: ${poErr.message}`); return }

  // Purchase line items (grouped by product)
  const byProduct = {}
  for (const ph of phones) {
    if (!byProduct[ph.productId]) byProduct[ph.productId] = { productId: ph.productId, buy: ph.buy, qty: 0 }
    byProduct[ph.productId].qty++
  }
  const lineItems = Object.values(byProduct).map(g => {
    const lineGross = g.buy * g.qty
    const lineGst   = Math.round(lineGross * 18 / 118)
    const lineBase  = lineGross - lineGst
    return {
      purchase_id:  po.id,
      tenant_id:    tenantId,
      product_id:   g.productId,
      quantity:     g.qty,
      unit_price:   Math.round(lineBase / g.qty),
      gst_rate:     18,
      gst_amount:   lineGst,
      total_amount: lineBase,
    }
  })
  const { error: piErr } = await db.from('purchase_items').insert(lineItems)
  if (piErr) console.error(`    ❌  purchase_items PO ${poNum}: ${piErr.message}`)

  // Inventory rows — one per phone
  const inventoryRows = phones.map((ph, idx) => ({
    tenant_id:          tenantId,
    product_id:         ph.productId,
    purchase_price:     ph.buy,
    selling_price:      ph.sell,
    quantity:           1,
    quantity_remaining: 1,
    quantity_sold:      0,
    imei_number:        ph.imei,
    stock_source:       purchaseType,
    approval_status:    isEmployee ? 'pending' : 'approved',
    submitted_by:       createdBy.id,
    approved_by:        isEmployee ? null : admin.id,
    approved_at:        isEmployee ? null : isoDate,
    status:             'in_stock',
    created_at:         new Date(date.getTime() + idx * 1500).toISOString(),
  }))

  const { error: invErr } = await db.from('inventory').insert(inventoryRows)
  if (invErr) console.error(`    ❌  inventory PO ${poNum}: ${invErr.message}`)
}

// ── Seed one tenant ───────────────────────────────────────────────────────────
async function seedTenant(tenantId, shopName, tenantIdx) {
  console.log(`\n🏪  ${shopName}`)

  // Get admin + active employees
  const { data: users, error: uErr } = await db
    .from('users')
    .select('id, role, full_name')
    .eq('tenant_id', tenantId)
    .in('role', ['admin', 'employee'])
    .eq('is_active', true)

  if (uErr) { console.error(`    ❌  Users fetch: ${uErr.message}`); return }

  const admin     = (users ?? []).find(u => u.role === 'admin')
  const employees = (users ?? []).filter(u => u.role === 'employee')

  if (!admin) { console.warn('    ⚠️  No active admin found — skipping'); return }

  console.log(`    Owner:     ${admin.full_name}`)
  console.log(`    Employees: ${employees.length ? employees.map(e => e.full_name).join(', ') : 'none (all stock will be owner-added)'}`)

  // Clear existing data
  console.log('    🗑️  Clearing sales, purchases, inventory, attendance...')
  await clearTenantData(tenantId)

  // Ensure products exist
  console.log('    📦 Setting up phone catalog...')
  const productMap = await ensureProducts(tenantId)

  // Build phone list
  const phones = []
  for (const item of CATALOG) {
    const pid = productMap[`${item.brand}|${item.model}|${item.variant}|${item.color}`]
    if (!pid) { console.warn(`    ⚠️  Product missing: ${item.brand} ${item.model} ${item.variant} ${item.color}`); continue }
    for (let i = 0; i < item.count; i++) {
      phones.push({ productId: pid, buy: item.buy, sell: item.sell, imei: nextImei() })
    }
  }

  // Shuffle and split 50/50 by purchase type
  shuffle(phones)
  const official   = phones.slice(0, PHONES_PER_SHOP / 2)   // 250 official
  const unofficial = phones.slice(PHONES_PER_SHOP / 2)       // 250 unofficial

  // Create purchase orders
  console.log('    🏗️  Creating purchase orders and inventory...')
  const EMP_RATIO = employees.length > 0 ? 0.4 : 0  // 40% employee if employees exist
  let empPhones   = 0
  let ownerPhones = 0
  let poNum       = tenantIdx * 1000 + 1

  for (const [group, purchaseType] of [[official, 'official'], [unofficial, 'unofficial']]) {
    for (const batch of chunk(group, 8, 15)) {
      const currentRatio = empPhones / (empPhones + ownerPhones + 0.001)
      const isEmployee   = employees.length > 0 && currentRatio < EMP_RATIO
      const createdBy    = isEmployee ? pick(employees) : admin
      const supplier     = purchaseType === 'official'
                             ? pick(OFFICIAL_SUPPLIERS)
                             : pick(UNOFFICIAL_SUPPLIERS)

      await createBatch({
        tenantId, phones: batch, purchaseType, supplier,
        createdBy, admin, date: randomDate(180, 2),
        poNum: poNum++, isEmployee,
      })

      if (isEmployee) empPhones += batch.length
      else            ownerPhones += batch.length
    }
  }

  console.log(`    ✅ ${phones.length} phones created`)
  console.log(`       Approved (owner):  ${ownerPhones}`)
  console.log(`       Pending (employee): ${empPhones}`)
  console.log(`       Official: 250  ·  Unofficial: 250`)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱  MobileShop — Inventory Seed')
  console.log('═'.repeat(50))

  const { data: tenants, error } = await db
    .from('tenants')
    .select('id, shop_name')
    .eq('is_active', true)
    .order('created_at')

  if (error) { console.error('❌  Tenants fetch failed:', error.message); process.exit(1) }
  if (!tenants?.length) { console.warn('⚠️  No active tenants found'); return }

  console.log(`Found ${tenants.length} active shop(s)`)

  for (let i = 0; i < tenants.length; i++) {
    await seedTenant(tenants[i].id, tenants[i].shop_name, i)
  }

  console.log('\n' + '═'.repeat(50))
  console.log('✅  Inventory seed complete!')
  console.log('    When ready, ask me to run the Sales & Customer seed next.')
}

main().catch(err => { console.error('\n💥  Fatal error:', err.message); process.exit(1) })
