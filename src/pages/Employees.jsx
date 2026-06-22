import React from 'react'
import { motion } from 'framer-motion'
import { UserCheck, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Employees() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2"><Plus className="w-4 h-4" /> Add Employee</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" /> Employee Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Employee records will appear here. Connect your Supabase tables to load data.</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
