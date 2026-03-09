'use client';

import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconApps() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><circle cx="8" cy="16" r="3"/><circle cx="16" cy="16" r="3"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

const ROLE_LABEL: Record<string, string> = {
  admin:    'Super Administrator',
  employee: 'Employee',
  client:   'Client',
};

function NavItem({ icon, label, href, active }: { icon: React.ReactNode; label: string; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
      style={{
        backgroundColor: active ? '#EEF2FF' : 'transparent',
        color: active ? '#4338CA' : '#64748B',
      }}
    >
      {icon}
      {label}
    </Link>
  );
}

const SIDEBAR_W = 220;
const HEADER_H = 56;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.user_type === 'admin';

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className="flex flex-col shrink-0 fixed top-0 left-0 bottom-0"
        style={{ width: SIDEBAR_W, backgroundColor: '#fff', borderRight: '1px solid #E2E8F0', zIndex: 40 }}
      >
        {/* Logo — exact same height as topbar */}
        <div
          className="flex items-center px-5 shrink-0"
          style={{ height: HEADER_H, borderBottom: '1px solid #E2E8F0' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Nagarkot" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
          <NavItem icon={<IconGrid />}  label="Dashboard"    href="/dashboard"             active={pathname === '/dashboard'} />
          {isAdmin && (
            <>
              <NavItem icon={<IconApps />}     label="Applications" href="/dashboard/admin/apps"        active={pathname.startsWith('/dashboard/admin/apps')} />
              <NavItem icon={<IconBuilding />}  label="Departments"  href="/dashboard/admin/departments" active={pathname.startsWith('/dashboard/admin/departments')} />
              <NavItem icon={<IconUsers />}     label="Users"        href="/dashboard/admin"             active={pathname === '/dashboard/admin' || (pathname.startsWith('/dashboard/admin/') && !pathname.startsWith('/dashboard/admin/apps') && !pathname.startsWith('/dashboard/admin/departments'))} />
            </>
          )}
          <NavItem icon={<IconSettings />} label="Settings" href="#" />
        </nav>

        {/* System Status */}
        <div className="p-4 border-t" style={{ borderColor: '#E2E8F0' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94A3B8' }}>System Status</p>
          <div className="flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block' }} />
            <span className="text-xs" style={{ color: '#64748B' }}>All systems online</span>
          </div>
        </div>
      </aside>

      {/* ── Right column ────────────────────────────────── */}
      <div className="flex flex-col flex-1" style={{ marginLeft: SIDEBAR_W }}>

        {/* Topbar */}
        <header
          className="flex items-center justify-end gap-3 px-8 bg-white border-b shrink-0 sticky top-0"
          style={{ height: HEADER_H, borderColor: '#E2E8F0', zIndex: 30 }}
        >
          {user && (
            <>
              <div className="text-right">
                <p className="text-sm font-semibold leading-tight" style={{ color: '#1a202c' }}>{user.name}</p>
                <p className="text-xs leading-tight" style={{ color: '#94A3B8' }}>{ROLE_LABEL[user.user_type] ?? 'User'}</p>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: '#1B3A6C' }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={logout}
                className="text-xs ml-1 transition-colors"
                style={{ color: '#94A3B8' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#1a202c')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
              >
                Sign out
              </button>
            </>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
