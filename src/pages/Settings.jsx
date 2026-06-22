import React from 'react'
import { motion } from 'framer-motion'
import { Settings as SettingsIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Settings() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" /> Application Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Store configuration, branding, and preferences will appear here.</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
