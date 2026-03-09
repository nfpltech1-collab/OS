'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { deleteApp, getApps, updateApp, uploadAppImage } from '@/lib/api';
import Link from 'next/link';
import Cropper from 'react-easy-crop';
import AdminLayout from '@/components/AdminLayout';

interface App {
  id: string;
  slug: string;
  name: string;
  url: string;
  icon_url: string | null;
  webhook_url: string | null;
  is_active: boolean;
}

interface CropArea { x: number; y: number; width: number; height: number }

async function getCroppedBlob(imageSrc: string, pixelCrop: CropArea): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
  });
  const canvas = document.createElement('canvas');
  const SIZE = 512;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, SIZE, SIZE);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9));
}

export default function EditAppPage() {
  const { id } = useParams<{ id: string }>();
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [app, setApp] = useState<App | null>(null);
  const [form, setForm] = useState({ name: '', url: '', webhook_url: '', is_active: true });
  const [protocol, setProtocol] = useState<'https://' | 'http://'>('https://');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Image crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  useEffect(() => {
    if (user && user.user_type !== 'admin') { router.push('/dashboard'); return; }
    getApps().then(apps => {
      const found = apps.find(a => a.id === id);
      if (found) {
        const proto = found.url.startsWith('http://') ? 'http://' : 'https://';
        setProtocol(proto);
        setApp(found);
        setForm({ name: found.name, url: found.url.replace(/^https?:\/\//, ''), webhook_url: found.webhook_url ?? '', is_active: found.is_active });
      }
    }).finally(() => setLoading(false));
  }, [user, id, router]);

  const onCropComplete = useCallback((_: unknown, pixels: CropArea) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true); setSaved(false);
    try {
      await updateApp(id, { ...form, url: protocol + form.url, webhook_url: form.webhook_url || null });
      if (imageSrc && croppedAreaPixels) {
        const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
        const updated = await uploadAppImage(id, blob, `${app?.slug ?? id}.jpg`);
        setApp((prev) => prev ? { ...prev, icon_url: updated.icon_url } : prev);
        setImageSrc(null);
      }
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Failed to save changes');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!app) return;
    const confirmed = window.confirm(`Delete ${app.name}? This removes the application, its app-access links, and the uploaded image.`);
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    try {
      await deleteApp(app.id);
      router.push('/dashboard/admin/apps');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Failed to delete application');
      setDeleting(false);
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

  if (!app) {
    return (
      <AdminLayout>
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <p style={{ color: '#94A3B8' }}>Application not found.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-2xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6" style={{ color: '#94A3B8' }}>
          <Link href="/dashboard" style={{ color: '#4338CA' }}>Home</Link>
          <span>›</span>
          <Link href="/dashboard/admin/apps" style={{ color: '#4338CA' }}>Applications</Link>
          <span>›</span>
          <span style={{ color: '#4338CA' }}>Edit Application</span>
        </nav>

        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a202c' }}>Edit Application</h1>
        <p className="text-sm mb-6" style={{ color: '#64748B' }}>Update the details and configuration for your registered application.</p>

        <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #E2E8F0' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Slug (read-only) */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: '#1a202c' }}>Slug</label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={app.slug}
                  className="w-full px-4 py-2.5 rounded-lg text-sm"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#94A3B8' }}
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>The application slug is permanent and cannot be changed.</p>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: '#1a202c' }}>Display Name</label>
              <input
                type="text" required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none"
                style={{ border: '1px solid #E2E8F0', color: '#1a202c', backgroundColor: '#fff' }}
                onFocus={e => (e.target.style.borderColor = '#4338CA')}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: '#1a202c' }}>Application URL</label>
              <div className="flex">
                <select
                  value={protocol}
                  onChange={e => setProtocol(e.target.value as 'https://' | 'http://')}
                  className="flex items-center px-2 text-sm rounded-l-lg border-y border-l focus:outline-none"
                  style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', color: '#4338CA', height: '42px' }}
                >
                  <option value="https://">https://</option>
                  <option value="http://">http://</option>
                </select>
                <input
                  type="text" required value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  className="flex-1 px-4 py-2.5 text-sm rounded-r-lg focus:outline-none"
                  style={{ border: '1px solid #E2E8F0', borderLeft: 'none', color: '#1a202c', backgroundColor: '#fff' }}
                  onFocus={e => (e.target.style.borderColor = '#4338CA')}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>
              {protocol === 'http://' && (
                <div className="flex items-start gap-1.5 mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <p className="text-xs" style={{ color: '#92400E' }}>Insecure connection. HTTP does not encrypt traffic between the OS portal and the application. Use HTTPS in production.</p>
                </div>
              )}
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: '#1a202c' }}>Webhook URL <span className="font-normal" style={{ color: '#94A3B8' }}>(optional)</span></label>
              <input
                type="url" value={form.webhook_url}
                onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
                placeholder="e.g. http://localhost:8000/webhooks/os"
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none font-mono"
                style={{ border: '1px solid #E2E8F0', color: '#1a202c', backgroundColor: '#fff' }}
                onFocus={e => (e.target.style.borderColor = '#4338CA')}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>OS will POST user.deleted / user.deactivated / user.reactivated events here.</p>
            </div>

            {/* App Icon */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a202c' }}>App Icon</label>

              {/* Current image preview */}
              {app?.icon_url && !imageSrc && (
                <div className="flex items-center gap-4 mb-3">
                  <img src={app.icon_url} alt="Current icon" className="w-16 h-16 rounded-xl object-cover" style={{ border: '1px solid #E2E8F0' }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#1a202c' }}>Current icon</p>
                    <label className="text-xs cursor-pointer mt-1 inline-block" style={{ color: '#4338CA' }}>
                      Change image
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                    </label>
                  </div>
                </div>
              )}

              {!app?.icon_url && !imageSrc && (
                <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ border: '2px dashed #E2E8F0' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-1">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span className="text-sm" style={{ color: '#94A3B8' }}>Upload icon image</span>
                  <span className="text-xs mt-0.5" style={{ color: '#CBD5E1' }}>PNG, JPG, WebP — max 5 MB</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                </label>
              )}

              {imageSrc && (
                <div>
                  <div className="relative w-full rounded-xl overflow-hidden" style={{ height: 280, backgroundColor: '#1a1a1a' }}>
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs shrink-0" style={{ color: '#94A3B8' }}>Zoom</span>
                    <input type="range" min={1} max={3} step={0.05} value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="flex-1 accent-indigo-600" />
                    <button type="button" onClick={() => { setImageSrc(null); setCrop({ x: 0, y: 0 }); setZoom(1); }}
                      className="text-xs shrink-0" style={{ color: '#EF4444' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between py-4 border-t border-b" style={{ borderColor: '#F1F5F9' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1a202c' }}>Active Status</p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Enable or disable this application for all users.</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                className="relative w-12 h-6 rounded-full transition-colors duration-200"
                style={{ backgroundColor: form.is_active ? '#4338CA' : '#CBD5E1' }}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${form.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}
            {saved && <p className="text-green-600 text-sm">Changes saved successfully.</p>}

            <div className="flex justify-end gap-3">
              <Link href="/dashboard/admin/apps" className="px-5 py-2.5 rounded-lg text-sm font-medium border" style={{ borderColor: '#E2E8F0', color: '#475569' }}>Cancel</Link>
              <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ backgroundColor: '#1B3A6C' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Danger zone */}
        <div className="mt-6 rounded-xl p-5" style={{ border: '1px solid #FCA5A5', backgroundColor: '#FFF5F5' }}>
          <div className="flex items-center gap-2 mb-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p className="font-semibold text-sm" style={{ color: '#DC2626' }}>Danger Zone</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: '#1a202c' }}>Delete this application</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Once you delete an application, there is no going back. Please be certain.</p>
            </div>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50" style={{ borderColor: '#DC2626', color: '#DC2626' }}>
              {deleting ? 'Deleting...' : 'Delete Application'}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
