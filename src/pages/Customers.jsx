import React from 'react'
import { motion } from 'framer-motion'
import { Users, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Customers() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2"><Plus className="w-4 h-4" /> Add Customer</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Customer Directory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Customer records will appear here. Connect your Supabase tables to load data.</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
