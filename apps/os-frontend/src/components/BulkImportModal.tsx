'use client';

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { bulkCreateUsers } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppCellState = 'none' | 'access' | 'admin';

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

interface BulkRow {
  _id: string;
  name: string;
  email: string;
  password: string;
  user_type: 'employee' | 'client';
  department_id: string;
  is_team_lead: boolean;
  apps: Record<string, AppCellState>; // keyed by app slug
}

interface ImportResult {
  results: { email: string; id: string }[];
  errors: { email: string; error: string }[];
}

interface BulkImportModalProps {
  apps: App[];
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _uid = 0;
function uid(): string {
  return `row-${++_uid}-${Date.now()}`;
}

function cycleState(s: AppCellState): AppCellState {
  if (s === 'none') return 'access';
  if (s === 'access') return 'admin';
  return 'none';
}

function validateRow(row: BulkRow, allRows: BulkRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!row.name.trim()) errors.name = 'Name required';
  if (!row.email.trim()) {
    errors.email = 'Email required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    errors.email = 'Invalid email';
  } else {
    const dups = allRows.filter(
      (r) => r._id !== row._id && r.email.trim().toLowerCase() === row.email.trim().toLowerCase(),
    );
    if (dups.length > 0) errors.email = 'Duplicate email';
  }
  if (!row.password) {
    errors.password = 'Password required';
  } else if (row.password.length < 8) {
    errors.password = 'Min 8 chars';
  }
  return errors;
}

function buildDefaultApps(
  departmentId: string,
  departments: Department[],
): Record<string, AppCellState> {
  const dept = departments.find((d) => d.id === departmentId);
  if (!dept) return {};
  const result: Record<string, AppCellState> = {};
  for (const app of dept.default_apps) {
    result[app.slug] = 'access';
  }
  return result;
}

function downloadTemplate() {
  const csv = [
    'name,email,password,user_type,department_name,is_team_lead',
    'John Doe,john.doe@example.com,SecurePass123,employee,Technology,no',
    'Jane Smith,jane.smith@example.com,SecurePass123,employee,,no',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk-users-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function parseFile(
  file: File,
  departments: Department[],
): Promise<BulkRow[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (raw.length === 0) {
    throw new Error('The file is empty or has no data rows');
  }

  const normalize = (s: string) =>
    s.toLowerCase().trim().replace(/[\s-]+/g, '_');

  return raw.map((r) => {
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      row[normalize(k)] = String(v ?? '').trim();
    }

    const typeRaw = (row['user_type'] || row['type'] || 'employee').toLowerCase();
    const user_type: 'employee' | 'client' = typeRaw === 'client' ? 'client' : 'employee';

    const deptRaw = (row['department_name'] || row['department'] || '').toLowerCase().trim();
    const deptSlug = deptRaw.replace(/\s+/g, '-');
    const dept = departments.find(
      (d) =>
        d.name.toLowerCase() === deptRaw ||
        d.slug === deptRaw ||
        d.slug === deptSlug ||
        (deptRaw.length >= 2 && d.name.toLowerCase().includes(deptRaw)) ||
        (deptRaw.length >= 2 && deptRaw.includes(d.name.toLowerCase())),
    );
    const department_id = dept?.id ?? '';
    const apps = buildDefaultApps(department_id, departments);

    const leadRaw = (row['is_team_lead'] || row['team_lead'] || row['lead'] || '').toLowerCase();
    const is_team_lead = ['yes', 'true', '1', 'y', '✓'].includes(leadRaw);

    return {
      _id: uid(),
      name: row['name'] || row['full_name'] || '',
      email: row['email'] || row['email_address'] || '',
      password: row['password'] || row['pass'] || '',
      user_type,
      department_id,
      is_team_lead,
      apps,
    };
  });
}

// ─── Sticky column definitions ────────────────────────────────────────────────

const COLS = [
  { key: 'num', label: '#', width: 44 },
  { key: 'name', label: 'Name', width: 160 },
  { key: 'email', label: 'Email', width: 196 },
  { key: 'password', label: 'Password', width: 140 },
  { key: 'user_type', label: 'Type', width: 110 },
  { key: 'department', label: 'Department', width: 152 },
  { key: 'lead', label: 'Lead', width: 56 },
  { key: 'del', label: '', width: 36 },
] as const;

const COL_LEFTS: number[] = [];
COLS.reduce((acc, col, i) => {
  COL_LEFTS[i] = acc;
  return acc + col.width;
}, 0);

const TOTAL_STICKY = COLS.reduce((s, c) => s + c.width, 0);

const APP_COL_W = 88;

// ─── Sub-components ───────────────────────────────────────────────────────────

function AppCell({
  state,
  onClick,
}: {
  state: AppCellState;
  onClick: () => void;
}) {
  const base: React.CSSProperties = {
    width: APP_COL_W,
    minWidth: APP_COL_W,
    height: '100%',
    minHeight: 48,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    gap: 2,
    transition: 'background 0.15s',
    border: 'none',
    padding: 0,
    fontFamily: 'inherit',
  };

  if (state === 'none') {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Click to grant access"
        style={{ ...base, background: 'transparent' }}
      >
        <span style={{ color: '#CBD5E1', fontSize: 18, lineHeight: 1 }}>—</span>
      </button>
    );
  }

  if (state === 'access') {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Access granted — click to make Admin"
        style={{ ...base, background: '#EFF6FF' }}
      >
        <span style={{ color: '#1D4ED8', fontSize: 15 }}>✓</span>
        <span style={{ color: '#93C5FD', fontSize: 9, fontWeight: 600, letterSpacing: '0.04em' }}>
          ACCESS
        </span>
      </button>
    );
  }

  // admin
  return (
    <button
      type="button"
      onClick={onClick}
      title="Admin — click to remove access"
      style={{ ...base, background: '#1B3A6C' }}
    >
      <span style={{ color: '#fff', fontSize: 15 }}>✓</span>
      <span style={{ color: '#93C5FD', fontSize: 9, fontWeight: 600, letterSpacing: '0.04em' }}>
        ADMIN
      </span>
    </button>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function BulkImportModal({
  apps,
  departments,
  onClose,
  onSuccess,
}: BulkImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Validation ────────────────────────────────────────────────────────────
  const rowErrors = rows.map((r) => validateRow(r, rows));
  const totalErrors = rowErrors.filter((e) => Object.keys(e).length > 0).length;
  const hasErrors = totalErrors > 0;

  // ─── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        setParseError('Please upload a .csv, .xlsx, or .xls file');
        return;
      }
      setParsing(true);
      setParseError(null);
      try {
        const parsed = await parseFile(file, departments);
        setRows(parsed);
        setStep('preview');
      } catch (err: unknown) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse file');
      } finally {
        setParsing(false);
      }
    },
    [departments],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ─── Row update helpers ────────────────────────────────────────────────────
  const updateRow = (id: string, fields: Partial<Omit<BulkRow, '_id' | 'apps'>>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== id) return r;
        // If department changed, merge new defaults (don't override explicit choices)
        if (
          'department_id' in fields &&
          fields.department_id !== undefined &&
          fields.department_id !== r.department_id
        ) {
          const newDefaults = buildDefaultApps(fields.department_id, departments);
          const merged: Record<string, AppCellState> = { ...r.apps };
          for (const [slug, state] of Object.entries(newDefaults)) {
            if ((merged[slug] ?? 'none') === 'none') {
              merged[slug] = state;
            }
          }
          return { ...r, ...fields, apps: merged };
        }
        return { ...r, ...fields };
      }),
    );
  };

  const toggleApp = (rowId: string, slug: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== rowId) return r;
        const cur = r.apps[slug] ?? 'none';
        return { ...r, apps: { ...r.apps, [slug]: cycleState(cur) } };
      }),
    );
  };

  const deleteRow = (id: string) => setRows((prev) => prev.filter((r) => r._id !== id));

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { _id: uid(), name: '', email: '', password: '', user_type: 'employee', department_id: '', is_team_lead: false, apps: {} },
    ]);
  };

  // ─── Import submit ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (hasErrors || rows.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const payload = rows.map((r) => {
        const app_slugs: string[] = [];
        const admin_app_slugs: string[] = [];
        for (const [slug, state] of Object.entries(r.apps)) {
          if (state === 'access') app_slugs.push(slug);
          if (state === 'admin') {
            app_slugs.push(slug);
            admin_app_slugs.push(slug);
          }
        }
        return {
          name: r.name.trim(),
          email: r.email.trim(),
          password: r.password,
          user_type: r.user_type,
          ...(r.department_id ? { department_id: r.department_id } : {}),
          is_team_lead: r.is_team_lead,
          app_slugs,
          admin_app_slugs,
        };
      });

      const result = await bulkCreateUsers(payload);
      setImportResult(result);
      setStep('done');
      if (result.results.length > 0) onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Import failed. Please try again.';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Cell styles ───────────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = {
    borderBottom: '1px solid #F1F5F9',
    padding: '0 10px',
    height: 48,
    verticalAlign: 'middle',
    fontSize: 13,
    color: '#1a202c',
    backgroundColor: '#fff',
  };

  const stickyCell = (i: number, extra?: React.CSSProperties): React.CSSProperties => ({
    ...cellBase,
    position: 'sticky',
    left: COL_LEFTS[i],
    zIndex: 10,
    ...extra,
  });

  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%',
    height: 30,
    padding: '0 8px',
    borderRadius: 6,
    border: `1px solid ${hasError ? '#FCA5A5' : '#E2E8F0'}`,
    fontSize: 13,
    outline: 'none',
    color: '#1a202c',
    backgroundColor: hasError ? '#FFF5F5' : '#FAFAFA',
    boxSizing: 'border-box',
  });

  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: 30,
    padding: '0 6px',
    borderRadius: 6,
    border: '1px solid #E2E8F0',
    fontSize: 13,
    color: '#1a202c',
    backgroundColor: '#FAFAFA',
    cursor: 'pointer',
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          width: step === 'preview' ? '80vw' : '520px',
          maxWidth: step === 'preview' ? '80vw' : '520px',
          height: step === 'preview' ? '90vh' : 'auto',
          maxHeight: 'calc(100vh - 32px)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '18px 24px 16px',
            borderBottom: '1px solid #E2E8F0',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a202c', margin: 0 }}>
              {step === 'upload' && 'Import Users'}
              {step === 'preview' &&
                `Preview — ${rows.length} user${rows.length !== 1 ? 's' : ''}`}
              {step === 'done' && 'Import Complete'}
            </h2>
            {step === 'preview' && (
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 0' }}>
                {hasErrors
                  ? `${totalErrors} row${totalErrors !== 1 ? 's have' : ' has'} errors · `
                  : ''}
                Click an app cell to cycle: — → Access → Admin → —
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              marginLeft: 16,
              lineHeight: 0,
              color: '#94A3B8',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* ─── UPLOAD STEP ─── */}
          {step === 'upload' && (
            <div style={{ padding: '28px 32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#1B3A6C' : '#CBD5E1'}`,
                  borderRadius: 12,
                  background: dragOver ? '#EFF6FF' : '#FAFBFC',
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = '';
                  }}
                />
                {parsing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        border: '3px solid #E2E8F0',
                        borderTopColor: '#1B3A6C',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <p style={{ color: '#64748B', fontSize: 14 }}>Parsing file…</p>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1a202c', marginBottom: 6 }}>
                      Drop your file here, or click to browse
                    </p>
                    <p style={{ fontSize: 13, color: '#94A3B8' }}>.csv · .xlsx · .xls</p>
                  </>
                )}
              </div>

              {/* Parse error */}
              {parseError && (
                <div
                  style={{
                    background: '#FFF5F5',
                    border: '1px solid #FCA5A5',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: 13,
                    color: '#DC2626',
                  }}
                >
                  {parseError}
                </div>
              )}

              {/* Template + tips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#1B3A6C',
                    alignSelf: 'flex-start',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Template
                </button>
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 8,
                    padding: '12px 14px',
                    fontSize: 12,
                    color: '#64748B',
                    lineHeight: 1.7,
                  }}
                >
                  <strong style={{ color: '#475569' }}>Required columns:</strong> name, email,
                  password, user_type (employee / client)
                  <br />
                  <strong style={{ color: '#475569' }}>Optional:</strong> department_name, is_team_lead (yes / no) — default
                  apps for that department are pre-assigned automatically
                </div>
              </div>
            </div>
          )}

          {/* ─── PREVIEW STEP ─── */}
          {step === 'preview' && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: '1px solid #F1F5F9',
                  gap: 12,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      border: '1px solid #E2E8F0',
                      borderRadius: 7,
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#475569',
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M19 12H5M12 5l-7 7 7 7" />
                    </svg>
                    Re-upload
                  </button>

                  <button
                    type="button"
                    onClick={addRow}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      border: '1px solid #E2E8F0',
                      borderRadius: 7,
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#475569',
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add Row
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPasswords((v) => !v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      border: '1px solid #E2E8F0',
                      borderRadius: 7,
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#475569',
                    }}
                  >
                    {showPasswords ? (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                    {showPasswords ? 'Hide' : 'Show'} Passwords
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {hasErrors && (
                    <span
                      style={{
                        fontSize: 12,
                        color: '#DC2626',
                        background: '#FFF5F5',
                        border: '1px solid #FCA5A5',
                        borderRadius: 6,
                        padding: '4px 10px',
                      }}
                    >
                      {totalErrors} error{totalErrors !== 1 ? 's' : ''}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: '7px 16px',
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#64748B',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={hasErrors || rows.length === 0 || submitting}
                    style={{
                      padding: '7px 20px',
                      border: 'none',
                      borderRadius: 8,
                      background:
                        hasErrors || rows.length === 0 || submitting ? '#94A3B8' : '#1B3A6C',
                      color: '#fff',
                      cursor:
                        hasErrors || rows.length === 0 || submitting ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {submitting ? (
                      <>
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: '#fff',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                          }}
                        />
                        Importing…
                      </>
                    ) : (
                      `Import ${rows.length} User${rows.length !== 1 ? 's' : ''}`
                    )}
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '6px 16px',
                  borderBottom: '1px solid #F1F5F9',
                  flexShrink: 0,
                  fontSize: 11,
                  color: '#94A3B8',
                }}
              >
                <span style={{ fontWeight: 600, color: '#64748B' }}>App cells:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 18,
                      height: 18,
                      border: '1px solid #E2E8F0',
                      borderRadius: 3,
                      background: '#F8FAFC',
                    }}
                  />
                  No access
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 18,
                      height: 18,
                      border: '1px solid #BFDBFE',
                      borderRadius: 3,
                      background: '#EFF6FF',
                    }}
                  />
                  Access
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 18,
                      height: 18,
                      borderRadius: 3,
                      background: '#1B3A6C',
                    }}
                  />
                  Admin
                </span>
                <span style={{ marginLeft: 'auto', color: '#CBD5E1' }}>
                  * Dept. default apps are pre-assigned
                </span>
              </div>

              {/* Spreadsheet */}
              {rows.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94A3B8',
                    fontSize: 14,
                    gap: 12,
                  }}
                >
                  <p>No rows. Add one manually or re-upload a file.</p>
                  <button
                    type="button"
                    onClick={addRow}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      background: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#1B3A6C',
                      fontWeight: 500,
                    }}
                  >
                    + Add Row
                  </button>
                </div>
              ) : (
                <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                  <table
                    style={{
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                      minWidth: TOTAL_STICKY + apps.length * APP_COL_W,
                    }}
                  >
                    <colgroup>
                      {COLS.map((c) => (
                        <col key={c.key} style={{ width: c.width, minWidth: c.width }} />
                      ))}
                      {apps.map((a) => (
                        <col key={a.slug} style={{ width: APP_COL_W, minWidth: APP_COL_W }} />
                      ))}
                    </colgroup>

                    {/* ── THEAD ── */}
                    <thead>
                      <tr>
                        {COLS.map((col, i) => (
                          <th
                            key={col.key}
                            style={{
                              position: 'sticky',
                              top: 0,
                              left: COL_LEFTS[i],
                              zIndex: 30,
                              background: '#F8FAFC',
                              borderBottom: '1px solid #E2E8F0',
                              borderRight:
                                i === COLS.length - 1 ? '2px solid #E2E8F0' : undefined,
                              padding: '0 10px',
                              height: 38,
                              textAlign: 'left',
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#64748B',
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {col.label}
                          </th>
                        ))}

                        {/* App headers */}
                        {apps.map((app) => (
                          <th
                            key={app.slug}
                            style={{
                              position: 'sticky',
                              top: 0,
                              zIndex: 20,
                              background: '#F8FAFC',
                              borderBottom: '1px solid #E2E8F0',
                              padding: '0 4px',
                              height: 38,
                              textAlign: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#64748B',
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              maxWidth: APP_COL_W,
                            }}
                            title={app.name}
                          >
                            <span
                              style={{
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {app.name}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    {/* ── TBODY ── */}
                    <tbody>
                      {rows.map((row, idx) => {
                        const errs = rowErrors[idx];
                        const hasRowErr = Object.keys(errs).length > 0;

                        return (
                          <tr
                            key={row._id}
                            style={{
                              background: hasRowErr ? '#FFFBFB' : '#fff',
                            }}
                          >
                            {/* # */}
                            <td
                              style={{
                                ...stickyCell(0),
                                color: '#94A3B8',
                                fontSize: 12,
                                fontWeight: 500,
                                textAlign: 'center',
                                borderRight: 'none',
                              }}
                            >
                              {idx + 1}
                            </td>

                            {/* Name */}
                            <td style={stickyCell(1)}>
                              <div style={{ position: 'relative' }}>
                                <input
                                  value={row.name}
                                  onChange={(e) =>
                                    updateRow(row._id, { name: e.target.value })
                                  }
                                  placeholder="Full name"
                                  style={inputStyle(!!errs.name)}
                                  title={errs.name}
                                />
                                {errs.name && (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      right: 6,
                                      top: '50%',
                                      transform: 'translateY(-50%)',
                                      fontSize: 10,
                                      color: '#EF4444',
                                      pointerEvents: 'none',
                                    }}
                                  >
                                    ⚠
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Email */}
                            <td style={stickyCell(2)}>
                              <input
                                type="email"
                                value={row.email}
                                onChange={(e) =>
                                  updateRow(row._id, { email: e.target.value })
                                }
                                placeholder="email@example.com"
                                style={inputStyle(!!errs.email)}
                                title={errs.email}
                              />
                            </td>

                            {/* Password */}
                            <td style={stickyCell(3)}>
                              <input
                                type={showPasswords ? 'text' : 'password'}
                                value={row.password}
                                onChange={(e) =>
                                  updateRow(row._id, { password: e.target.value })
                                }
                                placeholder="Min 8 chars"
                                style={inputStyle(!!errs.password)}
                                title={errs.password}
                              />
                            </td>

                            {/* Type */}
                            <td style={stickyCell(4)}>
                              <select
                                value={row.user_type}
                                onChange={(e) =>
                                  updateRow(row._id, {
                                    user_type: e.target.value as 'employee' | 'client',
                                  })
                                }
                                style={selectStyle}
                              >
                                <option value="employee">Employee</option>
                                <option value="client">Client</option>
                              </select>
                            </td>

                            {/* Department */}
                            <td style={stickyCell(5)}>
                              <select
                                value={row.department_id}
                                onChange={(e) =>
                                  updateRow(row._id, { department_id: e.target.value })
                                }
                                style={selectStyle}
                              >
                                <option value="">— No dept —</option>
                                {departments.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Team Lead */}
                            <td
                              style={{
                                ...stickyCell(6),
                                textAlign: 'center',
                                padding: 0,
                                borderRight: '2px solid #E2E8F0',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setRows((prev) =>
                                    prev.map((r2) =>
                                      r2._id === row._id
                                        ? { ...r2, is_team_lead: !r2.is_team_lead }
                                        : r2,
                                    ),
                                  )
                                }
                                title={row.is_team_lead ? 'Team Lead — click to unmark' : 'Mark as Team Lead'}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  padding: 6,
                                  borderRadius: 4,
                                  color: row.is_team_lead ? '#1B3A6C' : '#CBD5E1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: 'auto',
                                  transition: 'color 0.15s',
                                }}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill={row.is_team_lead ? 'currentColor' : 'none'}
                                  stroke="currentColor"
                                  strokeWidth={row.is_team_lead ? '0' : '1.5'}
                                >
                                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                                </svg>
                              </button>
                            </td>

                            {/* Delete */}
                            <td
                              style={{
                                ...stickyCell(7),
                                textAlign: 'center',
                                padding: 0,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => deleteRow(row._id)}
                                title="Remove row"
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  color: '#CBD5E1',
                                  padding: '4px 6px',
                                  borderRadius: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                onMouseEnter={(e) =>
                                  ((e.currentTarget as HTMLElement).style.color = '#EF4444')
                                }
                                onMouseLeave={(e) =>
                                  ((e.currentTarget as HTMLElement).style.color = '#CBD5E1')
                                }
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </button>
                            </td>

                            {/* App cells */}
                            {apps.map((app) => (
                              <td
                                key={app.slug}
                                style={{
                                  ...cellBase,
                                  padding: 0,
                                  width: APP_COL_W,
                                  borderLeft: '1px solid #F1F5F9',
                                }}
                              >
                                <AppCell
                                  state={row.apps[app.slug] ?? 'none'}
                                  onClick={() => toggleApp(row._id, app.slug)}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─── DONE STEP ─── */}
          {step === 'done' && importResult && (
            <div style={{ padding: '32px 32px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Success summary */}
              {importResult.results.length > 0 && (
                <div
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #86EFAC',
                    borderRadius: 10,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 22 }}>✅</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#166534', margin: 0 }}>
                      {importResult.results.length} user
                      {importResult.results.length !== 1 ? 's' : ''} imported successfully
                    </p>
                    <p style={{ fontSize: 12, color: '#4ADE80', margin: '3px 0 0' }}>
                      They can now log in with their credentials.
                    </p>
                  </div>
                </div>
              )}

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div
                  style={{
                    background: '#FFF5F5',
                    border: '1px solid #FCA5A5',
                    borderRadius: 10,
                    padding: '14px 18px',
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#DC2626',
                      margin: '0 0 10px',
                    }}
                  >
                    {importResult.errors.length} failed:
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}
                  >
                    {importResult.errors.map((e, i) => (
                      <div
                        key={i}
                        style={{ fontSize: 13, color: '#7F1D1D', fontFamily: 'monospace' }}
                      >
                        <strong>{e.email}</strong>: {e.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FOOTER (step-specific) ── */}
        {step === 'upload' && (
          <div
            style={{
              padding: '12px 24px 16px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                color: '#64748B',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'done' && (
          <div
            style={{
              padding: '12px 24px 16px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 24px',
                border: 'none',
                borderRadius: 8,
                background: '#1B3A6C',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
