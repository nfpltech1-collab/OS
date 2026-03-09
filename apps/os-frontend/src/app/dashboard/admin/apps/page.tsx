'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { deleteApp, getApps, updateApp } from '@/lib/api';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

interface App {
  id: string;
  slug: string;
  name: string;
  url: string;
  icon_url: string | null;
  is_active: boolean;
}

export default function AdminAppsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.user_type !== 'admin') {
      router.push('/dashboard');
      return;
    }
    getApps()
      .then(setApps)
      .finally(() => setLoading(false));
  }, [user]);

  async function toggleActive(app: App) {
    setToggling(app.id);
    try {
      await updateApp(app.id, { is_active: !app.is_active });
      setApps((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, is_active: !app.is_active } : a,
        ),
      );
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(app: App) {
    const confirmed = window.confirm(`Delete ${app.name}? This will remove app access assignments and the uploaded image.`);
    if (!confirmed) return;

    setDeleting(app.id);
    try {
      await deleteApp(app.id);
      setApps((prev) => prev.filter((item) => item.id !== app.id));
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1B3A6C', borderTopColor: 'transparent' }} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1a202c' }}>Applications</h1>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>Manage and monitor your registered application instances.</p>
          </div>
          <Link href="/dashboard/admin/apps/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#1B3A6C' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Application
          </Link>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #E2E8F0' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                {['ICON', 'NAME', 'SLUG', 'URL', 'STATUS', 'ACTIONS'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold tracking-wider" style={{ color: '#94A3B8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <tr key={app.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td className="px-6 py-4">
                    {app.icon_url
                      ? <img src={app.icon_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      : <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F1F5F9' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                        </div>
                    }
                  </td>
                  <td className="px-6 py-4 font-semibold" style={{ color: '#1a202c' }}>{app.name}</td>
                  <td className="px-6 py-4">
                    <code className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F1F5F9', color: '#4a5568' }}>{app.slug}</code>
                  </td>
                  <td className="px-6 py-4 text-xs max-w-45 truncate" style={{ color: '#4338CA' }}>{app.url}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: app.is_active ? '#F0FDF4' : '#F8FAFC', color: app.is_active ? '#16A34A' : '#94A3B8' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: app.is_active ? '#22C55E' : '#CBD5E1', display: 'inline-block' }} />
                      {app.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Link href={`/dashboard/admin/apps/${app.id}`} className="text-sm font-medium" style={{ color: '#1B3A6C' }}>Edit</Link>
                      <button
                        onClick={() => toggleActive(app)}
                        disabled={toggling === app.id}
                        className="text-xs disabled:opacity-50"
                        style={{ color: '#94A3B8' }}
                      >
                        {app.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(app)}
                        disabled={deleting === app.id}
                        className="text-xs disabled:opacity-50"
                        style={{ color: '#DC2626' }}
                      >
                        {deleting === app.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2 p-4 rounded-xl text-sm" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <p><strong>Note:</strong> Application slugs are unique identifiers used in the API and cannot be changed after creation. Please ensure your naming convention matches your production endpoint requirements.</p>
        </div>

        {/* Bottom widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          {/* API Status */}
          <div className="rounded-xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #1B3A6C 0%, #4338CA 100%)' }}>
            <p className="font-semibold text-base mb-1">API Status</p>
            <p className="text-sm mb-4" style={{ color: '#C7D2FE' }}>Global infrastructure is healthy</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-full h-2" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <div className="h-2 rounded-full" style={{ width: '98%', backgroundColor: '#fff' }} />
              </div>
              <span className="text-sm font-semibold">98%</span>
            </div>
          </div>
          {/* Active Users */}
          <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #E2E8F0' }}>
            <p className="font-semibold text-sm mb-1" style={{ color: '#1a202c' }}>Active Users</p>
            <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>Real-time engagement across apps</p>
            <p className="text-3xl font-bold" style={{ color: '#1a202c' }}>12,482</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
