'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getAuditLogs, AuditLogEntry } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';

const PAGE_SIZE = 50;

const ACTION_STYLE: Record<string, { bg: string; color: string }> = {
  'user.created':                   { bg: '#F0FDF4', color: '#16A34A' },
  'user.updated':                   { bg: '#EFF6FF', color: '#2563EB' },
  'user.status.changed':            { bg: '#FFF7ED', color: '#EA580C' },
  'user.deleted':                   { bg: '#FEF2F2', color: '#DC2626' },
  'app_access.granted':             { bg: '#F0FDF4', color: '#16A34A' },
  'app_access.revoked':             { bg: '#FFF7ED', color: '#EA580C' },
  'department.created':             { bg: '#F0FDF4', color: '#16A34A' },
  'department.updated':             { bg: '#EFF6FF', color: '#2563EB' },
  'department.deleted':             { bg: '#FEF2F2', color: '#DC2626' },
  'department.default_app.added':   { bg: '#EFF6FF', color: '#2563EB' },
  'department.default_app.removed': { bg: '#FFF7ED', color: '#EA580C' },
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLE[action] ?? { bg: '#F1F5F9', color: '#475569' };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-mono font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {action}
    </span>
  );
}

function JsonPreview({ value }: { value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) return <span style={{ color: '#CBD5E1' }}>—</span>;
  return (
    <code className="text-xs break-all" style={{ color: '#64748B' }}>
      {JSON.stringify(value)}
    </code>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

const ENTITY_TYPES = ['', 'user', 'department'];

export default function AuditLogsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const [filterEntity, setFilterEntity] = useState('');
  const [filterEntityId, setFilterEntityId] = useState('');
  const [entityIdInput, setEntityIdInput] = useState('');

  const load = useCallback(async (off: number, entity_type: string, entity_id: string) => {
    setLoading(true);
    try {
      const data = await getAuditLogs({
        limit: PAGE_SIZE,
        offset: off,
        entity_type: entity_type || undefined,
        entity_id: entity_id || undefined,
      });
      setRows(data.rows);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.user_type !== 'admin') { router.push('/dashboard'); return; }
    load(0, filterEntity, filterEntityId);
  }, [user]);

  function applyFilters() {
    const id = entityIdInput.trim();
    setFilterEntityId(id);
    setOffset(0);
    load(0, filterEntity, id);
  }

  function clearFilters() {
    setFilterEntity('');
    setFilterEntityId('');
    setEntityIdInput('');
    setOffset(0);
    load(0, '', '');
  }

  function goPage(next: number) {
    setOffset(next);
    load(next, filterEntity, filterEntityId);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  if (loading && rows.length === 0) {
    return (
      <AdminLayout>
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#1B3A6C', borderTopColor: 'transparent' }} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#1a202c' }}>Audit Logs</h1>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {total.toLocaleString()} event{total !== 1 ? 's' : ''} recorded
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5 items-end">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Entity type</label>
            <select
              value={filterEntity}
              onChange={e => setFilterEntity(e.target.value)}
              className="text-sm rounded-lg border px-3 py-2 bg-white outline-none"
              style={{ borderColor: '#E2E8F0', color: '#1a202c', minWidth: 140 }}
            >
              <option value="">All types</option>
              {ENTITY_TYPES.filter(Boolean).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>Entity ID</label>
            <input
              type="text"
              placeholder="UUID…"
              value={entityIdInput}
              onChange={e => setEntityIdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
              className="text-sm rounded-lg border px-3 py-2 bg-white outline-none font-mono"
              style={{ borderColor: '#E2E8F0', color: '#1a202c', width: 260 }}
            />
          </div>

          <button
            onClick={applyFilters}
            className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-opacity"
            style={{ backgroundColor: '#1B3A6C' }}
          >
            Filter
          </button>

          {(filterEntity || filterEntityId) && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ color: '#64748B', border: '1px solid #E2E8F0' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0', backgroundColor: '#fff' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#1B3A6C', borderTopColor: 'transparent' }} />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm" style={{ color: '#94A3B8' }}>No audit events found.</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                  {['Timestamp', 'Action', 'Entity', 'Entity ID', 'Actor ID', 'Before → After'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: '#94A3B8' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: i < rows.length - 1 ? '1px solid #F1F5F9' : undefined,
                    }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs" style={{ color: '#64748B' }}>
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ActionBadge action={row.action} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-mono" style={{ color: '#475569' }}>
                      {row.entity_type ?? '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <span className="font-mono text-xs truncate block" style={{ color: '#94A3B8' }} title={row.entity_id ?? ''}>
                        {row.entity_id ? row.entity_id.slice(0, 8) + '…' : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <span className="font-mono text-xs truncate block" style={{ color: '#94A3B8' }} title={row.actor_id}>
                        {row.actor_id.slice(0, 8) + '…'}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[300px]">
                      <div className="flex flex-col gap-0.5">
                        {row.before && <JsonPreview value={row.before} />}
                        {row.after  && <JsonPreview value={row.after} />}
                        {!row.before && !row.after && <span style={{ color: '#CBD5E1' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => goPage(offset - PAGE_SIZE)}
                disabled={offset === 0}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border disabled:opacity-40"
                style={{ borderColor: '#E2E8F0', color: '#475569' }}
              >
                ← Prev
              </button>
              <button
                onClick={() => goPage(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border disabled:opacity-40"
                style={{ borderColor: '#E2E8F0', color: '#475569' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
