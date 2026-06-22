import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Package, Users, ShoppingCart, ArrowUpRight, ArrowDownRight, IndianRupee } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const stats = [
  { label: "Today's Revenue", value: '₹24,580', change: '+12.5%', up: true, icon: IndianRupee, color: 'bg-emerald-500' },
  { label: 'Total Orders', value: '142', change: '+8.2%', up: true, icon: ShoppingCart, color: 'bg-blue-500' },
  { label: 'Inventory Items', value: '1,284', change: '-2.1%', up: false, icon: Package, color: 'bg-orange-500' },
  { label: 'Active Customers', value: '389', change: '+5.7%', up: true, icon: Users, color: 'bg-purple-500' },
]

const recentSales = [
  { id: '#INV-001', customer: 'Rahul Sharma', amount: '₹4,200', status: 'Paid', time: '10 mins ago' },
  { id: '#INV-002', customer: 'Priya Patel', amount: '₹1,850', status: 'Paid', time: '25 mins ago' },
  { id: '#INV-003', customer: 'Amit Kumar', amount: '₹7,300', status: 'Pending', time: '1 hr ago' },
  { id: '#INV-004', customer: 'Sneha Joshi', amount: '₹2,650', status: 'Paid', time: '2 hrs ago' },
  { id: '#INV-005', customer: 'Vikram Singh', amount: '₹9,100', status: 'Cancelled', time: '3 hrs ago' },
]

const statusColor = {
  Paid: 'bg-emerald-100 text-emerald-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Cancelled: 'bg-red-100 text-red-700',
}

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {stat.up ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <span className={`text-xs font-medium ${stat.up ? 'text-emerald-500' : 'text-red-500'}`}>
                        {stat.change}
                      </span>
                      <span className="text-xs text-muted-foreground">vs yesterday</span>
                    </div>
                  </div>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${stat.color}`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Sales */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>You made 142 sales today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Invoice</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="py-3 font-mono text-xs text-muted-foreground">{sale.id}</td>
                      <td className="py-3 font-medium">{sale.customer}</td>
                      <td className="py-3 font-semibold">{sale.amount}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[sale.status]}`}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground text-xs">{sale.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
