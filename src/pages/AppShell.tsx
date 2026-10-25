import { Outlet } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { useRealtimeNotifications } from '@/data/hooks'
import { OverdueNotice } from '@/components/overdue/OverdueNotice'

export default function AppShell() {
  useRealtimeNotifications()
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
      <OverdueNotice />
    </div>
  )
}
