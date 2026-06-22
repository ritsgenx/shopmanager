import React from 'react'
import { motion } from 'framer-motion'
import { CalendarCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Attendance() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" /> Attendance Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Attendance records will appear here. Connect your Supabase tables to load data.</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
