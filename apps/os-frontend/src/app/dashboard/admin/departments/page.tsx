'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api, {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentDefaultApps,
  addDepartmentDefaultApp,
  removeDepartmentDefaultApp,
  getApps,
} from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';

interface Department {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
}

interface App {
  id: string;
  slug: string;
  name: string;
  url: string;
  icon_url: string | null;
  webhook_url: string | null;
  is_active: boolean;
}

interface DefaultApp {
  id: string;
  slug: string;
  name: string;
}

export default function DepartmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allApps, setAllApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  // Accordion state: which dept is expanded
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Default apps per dept: { [deptId]: DefaultApp[] }
  const [defaultApps, setDefaultApps] = useState<Record<string, DefaultApp[]>>({});
  const [defaultAppsLoading, setDefaultAppsLoading] = useState<Record<string, boolean>>({});
  const [togglingApp, setTogglingApp] = useState<string | null>(null); // `${deptId}-${appId}`

  // Add new department
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  // Edit department
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (user && user.user_type !== 'admin') { router.push('/dashboard'); return; }
    Promise.all([
      api.get('/users/departments').then(r => r.data),
      getApps(),
    ]).then(([depts, apps]) => {
      setDepartments(depts);
      setAllApps(apps.filter((a: App) => a.is_active));
    }).finally(() => setLoading(false));
  }, [user, router]);

  useEffect(() => {
    if (adding) setTimeout(() => newInputRef.current?.focus(), 50);
  }, [adding]);

  // Load default apps when accordion opens
  async function handleExpand(deptId: string) {
    if (expandedId === deptId) { setExpandedId(null); return; }
    setExpandedId(deptId);
    if (defaultApps[deptId]) return; // already loaded
    setDefaultAppsLoading(prev => ({ ...prev, [deptId]: true }));
    try {
      const apps = await getDepartmentDefaultApps(deptId);
      setDefaultApps(prev => ({ ...prev, [deptId]: apps }));
    } finally {
      setDefaultAppsLoading(prev => ({ ...prev, [deptId]: false }));
    }
  }

  async function handleToggleApp(deptId: string, app: App) {
    const current = defaultApps[deptId] ?? [];
    const isAssigned = current.some(a => a.id === app.id);
    const key = `${deptId}-${app.id}`;
    setTogglingApp(key);
    try {
      if (isAssigned) {
        await removeDepartmentDefaultApp(deptId, app.id);
        setDefaultApps(prev => ({
          ...prev,
          [deptId]: prev[deptId].filter(a => a.id !== app.id),
        }));
      } else {
        await addDepartmentDefaultApp(deptId, app.id);
        setDefaultApps(prev => ({
          ...prev,
          [deptId]: [...(prev[deptId] ?? []), { id: app.id, slug: app.slug, name: app.name }],
        }));
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      alert(axiosErr?.response?.data?.message ?? 'Failed to toggle default app assignment');
    } finally {
      setTogglingApp(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddError('');
    setAddLoading(true);
    try {
      const dept = await createDepartment(newName.trim());
      setDepartments(prev => [...prev, dept]);
      setNewName('');
      setAdding(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setAddError(axiosErr?.response?.data?.message ?? 'Failed to create department');
    } finally {
      setAddLoading(false);
    }
  }

  function startEdit(dept: Department) {
    setEditingId(dept.id);
    setEditName(dept.name);
    setEditError('');
    setExpandedId(null);
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    setEditError('');
    setEditLoading(true);
    try {
      const updated = await updateDepartment(id, editName.trim());
      setDepartments(prev => prev.map(d => (d.id === id ? { ...d, name: updated.name } : d)));
      setEditingId(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setEditError(axiosErr?.response?.data?.message ?? 'Failed to update department');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await deleteDepartment(id);
      setDepartments(prev => prev.filter(d => d.id !== id));
      setDeletingId(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setDeleteError(axiosErr?.response?.data?.message ?? 'Failed to delete department');
    } finally {
      setDeleteLoading(false);
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
      <div className="p-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1a202c' }}>Departments</h1>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>
              Manage departments and configure which apps are assigned by default to new members.
            </p>
          </div>
          <button
            onClick={() => { setAdding(true); setAddError(''); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0"
            style={{ backgroundColor: '#1B3A6C' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Department
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <form onSubmit={handleAdd} className="bg-white rounded-xl p-4 mb-4 flex items-center gap-3" style={{ border: '1px solid #4338CA' }}>
            <input
              ref={newInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Department name (e.g. Engineering)"
              required
              className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ border: '1px solid #E2E8F0', color: '#1a202c' }}
              onFocus={(e) => (e.target.style.borderColor = '#4338CA')}
              onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
            />
            {addError && <p className="text-red-500 text-xs">{addError}</p>}
            <div className="flex gap-2 shrink-0">
              <button type="submit" disabled={addLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: '#1B3A6C' }}>
                {addLoading ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => { setAdding(false); setNewName(''); setAddError(''); }}
                className="px-3 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: '#E2E8F0', color: '#64748B' }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Departments accordion list */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          {departments.length === 0 && !adding && (
            <div className="bg-white text-center py-12" style={{ color: '#94A3B8' }}>
              <p className="font-medium">No departments yet.</p>
              <p className="text-sm mt-1">Click &quot;Add Department&quot; to create one.</p>
            </div>
          )}

          {departments.map((dept, idx) => {
            const isExpanded = expandedId === dept.id;
            const assigned = defaultApps[dept.id] ?? [];
            const assignedIds = new Set(assigned.map(a => a.id));

            return (
              <div key={dept.id} style={{ borderBottom: idx < departments.length - 1 ? '1px solid #F1F5F9' : 'none' }}>

                {/* Department row */}
                <div className="bg-white px-5 py-4 flex items-center gap-4">
                  {editingId === dept.id ? (
                    <div className="flex-1 flex items-center gap-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="flex-1 px-3 py-1.5 rounded-lg text-sm focus:outline-none"
                        style={{ border: '1px solid #4338CA', color: '#1a202c' }}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }}
                      />
                      {editError && <p className="text-red-500 text-xs shrink-0">{editError}</p>}
                      <button onClick={() => handleUpdate(dept.id)} disabled={editLoading}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: '#1B3A6C' }}>
                        {editLoading ? '…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-lg text-sm border"
                        style={{ borderColor: '#E2E8F0', color: '#64748B' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Expand toggle + name */}
                      <button
                        onClick={() => handleExpand(dept.id)}
                        className="flex-1 flex items-center gap-3 text-left min-w-0"
                      >
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: '#1a202c' }}>{dept.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>slug: {dept.slug}</p>
                        </div>
                        {assigned.length > 0 && !isExpanded && (
                          <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                            style={{ backgroundColor: '#EEF2FF', color: '#4338CA' }}>
                            {assigned.length} default {assigned.length === 1 ? 'app' : 'apps'}
                          </span>
                        )}
                      </button>

                      {/* Actions */}
                      {deletingId === dept.id ? (
                        <div className="flex items-center gap-2 shrink-0">
                          {deleteError && <p className="text-red-500 text-xs">{deleteError}</p>}
                          <span className="text-xs" style={{ color: '#64748B' }}>Delete?</span>
                          <button onClick={() => handleDelete(dept.id)} disabled={deleteLoading}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 disabled:opacity-50">
                            {deleteLoading ? '…' : 'Yes, delete'}
                          </button>
                          <button onClick={() => { setDeletingId(null); setDeleteError(''); }}
                            className="px-3 py-1.5 rounded-lg text-xs border"
                            style={{ borderColor: '#E2E8F0', color: '#64748B' }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 shrink-0">
                          <button onClick={() => startEdit(dept)} className="text-sm font-medium" style={{ color: '#4338CA' }}>
                            Edit
                          </button>
                          <button onClick={() => { setDeletingId(dept.id); setDeleteError(''); }} className="text-sm font-medium" style={{ color: '#EF4444' }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Accordion panel — default apps */}
                {isExpanded && editingId !== dept.id && (
                  <div className="px-5 pb-4 pt-1" style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
                    <p className="text-xs font-semibold mb-3 mt-3 uppercase tracking-wide" style={{ color: '#94A3B8' }}>
                      Default Apps
                    </p>

                    {defaultAppsLoading[dept.id] ? (
                      <div className="flex items-center gap-2 py-2">
                        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1B3A6C', borderTopColor: 'transparent' }} />
                        <span className="text-xs" style={{ color: '#94A3B8' }}>Loading…</span>
                      </div>
                    ) : allApps.length === 0 ? (
                      <p className="text-xs" style={{ color: '#94A3B8' }}>No active apps registered. Add apps first via the Apps panel.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {allApps.map(app => {
                          const isOn = assignedIds.has(app.id);
                          const toggling = togglingApp === `${dept.id}-${app.id}`;
                          return (
                            <button
                              key={app.id}
                              onClick={(e) => {
                                e.stopPropagation(); // prevent accordion from toggling
                                handleToggleApp(dept.id, app);
                              }}
                              disabled={toggling}
                              title={isOn ? `Remove ${app.name} as default` : `Add ${app.name} as default`}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-60"
                              style={isOn ? {
                                backgroundColor: '#1B3A6C',
                                color: '#fff',
                                border: '1.5px solid #1B3A6C',
                              } : {
                                backgroundColor: '#fff',
                                color: '#64748B',
                                border: '1.5px solid #E2E8F0',
                              }}
                            >
                              {toggling ? (
                                <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin inline-block"
                                  style={{ borderColor: isOn ? '#fff' : '#64748B', borderTopColor: 'transparent' }} />
                              ) : isOn ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              ) : (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              )}
                              {app.name}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {assigned.length > 0 && (
                      <p className="text-xs mt-3" style={{ color: '#94A3B8' }}>
                        New members of <strong style={{ color: '#1a202c' }}>{dept.name}</strong> will automatically receive access to highlighted apps.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
