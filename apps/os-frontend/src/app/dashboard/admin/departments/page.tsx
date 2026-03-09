'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api, { createDepartment, updateDepartment, deleteDepartment } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';

interface Department {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
}

export default function DepartmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

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
    api.get('/users/departments').then((r) => setDepartments(r.data)).finally(() => setLoading(false));
  }, [user, router]);

  useEffect(() => {
    if (adding) setTimeout(() => newInputRef.current?.focus(), 50);
  }, [adding]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddError('');
    setAddLoading(true);
    try {
      const dept = await createDepartment(newName.trim());
      setDepartments((prev) => [...prev, dept]);
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
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    setEditError('');
    setEditLoading(true);
    try {
      const updated = await updateDepartment(id, editName.trim());
      setDepartments((prev) => prev.map((d) => (d.id === id ? { ...d, name: updated.name } : d)));
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
      setDepartments((prev) => prev.filter((d) => d.id !== id));
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
              Manage your organization&apos;s departments. Departments with active users cannot be deleted.
            </p>
          </div>
          <button
            onClick={() => { setAdding(true); setAddError(''); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
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

        {/* Departments list */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          {departments.length === 0 && !adding && (
            <div className="text-center py-12" style={{ color: '#94A3B8' }}>
              <p className="font-medium">No departments yet.</p>
              <p className="text-sm mt-1">Click &quot;Add Department&quot; to create one.</p>
            </div>
          )}

          {departments.map((dept, idx) => (
            <div
              key={dept.id}
              className="px-5 py-4 flex items-center gap-4"
              style={{ borderBottom: idx < departments.length - 1 ? '1px solid #F1F5F9' : 'none' }}
            >
              {editingId === dept.id ? (
                // Inline edit
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
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: '#1a202c' }}>{dept.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>slug: {dept.slug}</p>
                  </div>

                  {deletingId === dept.id ? (
                    // Delete confirm
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
                      <button onClick={() => startEdit(dept)}
                        className="text-sm font-medium" style={{ color: '#4338CA' }}>
                        Edit
                      </button>
                      <button onClick={() => { setDeletingId(dept.id); setDeleteError(''); }}
                        className="text-sm font-medium" style={{ color: '#EF4444' }}>
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
