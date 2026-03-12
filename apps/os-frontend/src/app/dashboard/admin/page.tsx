'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUsers, updateUser, deleteUser, getApplications, getDepartments } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import BulkImportModal from '@/components/BulkImportModal';

interface User {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'disabled' | 'deleted';
  created_at: string;
  userType: { slug: string; label: string };
  department: { id: string; name: string } | null;
}

interface App {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
}

interface Department {
  id: string;
  slug: string;
  name: string;
  default_apps: { id: string; slug: string; name: string }[];
}

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  admin:    { bg: '#EEF2FF', color: '#4338CA' },
  employee: { bg: '#DBEAFE', color: '#1D4ED8' },
  client:   { bg: '#F0FDF4', color: '#16A34A' },
};

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    if (user?.user_type !== 'admin') { router.push('/dashboard'); return; }
    Promise.all([
      getUsers(),
      getApplications(),
      getDepartments(),
    ]).then(([u, a, d]) => {
      setUsers(u);
      setApps(a);
      setDepartments(d);
    }).finally(() => setLoading(false));
  }, [user]);

  async function toggleActive(u: User) {
    if (u.id === user?.id) return;
    const prev = [...users];
    const newStatus = u.status === 'active' ? 'disabled' : 'active';
    setUsers(current => current.map(x =>
      x.id === u.id ? { ...x, status: newStatus } : x
    ));
    try {
      await updateUser(u.id, { status: newStatus });
    } catch {
      setUsers(prev); // rollback on failure
      alert('Failed to update user status. Please try again.');
    }
  }

  async function handleDelete(u: User) {
    if (u.id === user?.id) return;
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try {
      await deleteUser(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch {
      alert('Failed to delete user. Please try again.');
    }
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    admins: users.filter(u => u.userType.slug === 'admin').length,
  };

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
            <h1 className="text-2xl font-bold" style={{ color: '#1a202c' }}>User Management</h1>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>Manage your organization&apos;s members</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
                style={{ border: '1px solid #E2E8F0', width: 260, color: '#1a202c', backgroundColor: '#fff' }}
              />
            </div>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ border: '1px solid #E2E8F0', backgroundColor: '#fff', color: '#1B3A6C', cursor: 'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import Users
            </button>
            <Link
              href="/dashboard/admin/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#1B3A6C' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              New User
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Users', value: stats.total },
            { label: 'Active Now', value: stats.active, dot: true },
            { label: 'Admins', value: stats.admins },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-5 border" style={{ borderColor: '#E2E8F0' }}>
              <p className="text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>{s.label}</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{ color: '#1a202c' }}>{s.value}</span>
                {s.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block' }} />}
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                {['NAME', 'EMAIL', 'DEPARTMENT', 'TYPE', 'STATUS', 'ACTIONS'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold tracking-wider" style={{ color: '#94A3B8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const ts = TYPE_STYLE[u.userType.slug] ?? { bg: '#F1F5F9', color: '#475569' };
                const joined = u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '';
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ backgroundColor: '#1B3A6C' }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: '#1a202c' }}>{u.name}</p>
                          {joined && <p className="text-xs" style={{ color: '#94A3B8' }}>Joined {joined}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4" style={{ color: '#4338CA' }}>{u.email}</td>
                    <td className="px-6 py-4">
                      {u.department ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                          {u.department.name}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: ts.bg, color: ts.color }}>
                        {u.userType.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: u.status === 'active' ? '#F0FDF4' : '#F8FAFC', color: u.status === 'active' ? '#16A34A' : '#94A3B8' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: u.status === 'active' ? '#22C55E' : '#CBD5E1', display: 'inline-block' }} />
                        {u.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {u.id === user?.id ? (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#EEF2FF', color: '#4338CA' }}>You</span>
                        ) : (
                          <>
                            <Link href={`/dashboard/admin/${u.id}`} className="text-sm font-medium" style={{ color: '#1B3A6C' }}>Manage access</Link>
                            <button onClick={() => toggleActive(u)} className="text-xs" style={{ color: '#94A3B8' }}>
                              {u.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                            {u.userType?.slug !== 'admin' && (
                              <button onClick={() => handleDelete(u)} className="text-xs" style={{ color: '#EF4444' }}>Delete</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm" style={{ color: '#94A3B8' }}>
              {search ? 'No users match your search.' : <span>No users yet. <Link href="/dashboard/admin/new" style={{ color: '#1B3A6C' }}>Create the first one.</Link></span>}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Import Modal */}
      {showImport && (
        <BulkImportModal
          apps={apps}
          departments={departments}
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setShowImport(false);
            getUsers().then(setUsers);
          }}
        />
      )}
    </AdminLayout>
  );
}
