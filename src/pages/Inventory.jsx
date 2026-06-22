import React from 'react'
import { motion } from 'framer-motion'
import { Package, Plus, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const products = [
  { id: 1, name: 'Samsung Galaxy A54', sku: 'SAM-A54', category: 'Smartphone', stock: 24, price: '₹38,999', status: 'In Stock' },
  { id: 2, name: 'iPhone 15', sku: 'APL-IP15', category: 'Smartphone', stock: 8, price: '₹79,900', status: 'Low Stock' },
  { id: 3, name: 'OnePlus 12', sku: 'OP-12', category: 'Smartphone', stock: 0, price: '₹64,999', status: 'Out of Stock' },
  { id: 4, name: 'Realme Narzo 60', sku: 'RL-N60', category: 'Smartphone', stock: 45, price: '₹16,999', status: 'In Stock' },
  { id: 5, name: 'Redmi Note 13', sku: 'MI-N13', category: 'Smartphone', stock: 31, price: '₹17,499', status: 'In Stock' },
]

const statusColor = {
  'In Stock': 'text-emerald-600 bg-emerald-50',
  'Low Stock': 'text-yellow-600 bg-yellow-50',
  'Out of Stock': 'text-red-600 bg-red-50',
}

export default function Inventory() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-9 w-64" />
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" /> Product Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">SKU</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Stock</th>
                  <th className="pb-3 font-medium">Price</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="py-3">{p.category}</td>
                    <td className="py-3">{p.stock}</td>
                    <td className="py-3 font-semibold">{p.price}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
