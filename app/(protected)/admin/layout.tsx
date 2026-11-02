import type { Metadata } from 'next'
import AdminLogin from '@/components/AdminLogin'
import { hasAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!hasAdminSession()) return <AdminLogin />
  return children
}
