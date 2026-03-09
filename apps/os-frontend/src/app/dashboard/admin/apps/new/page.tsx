'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Cropper from 'react-easy-crop';
import { useAuth } from '@/context/AuthContext';
import { createApp, uploadAppImage } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';

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

export default function NewAppPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', slug: '', url: '', webhook_url: '', is_active: true });
  const [protocol, setProtocol] = useState<'https://' | 'http://'>('https://');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Image crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  useEffect(() => {
    if (user && user.user_type !== 'admin') router.push('/dashboard');
  }, [user, router]);

  // Auto-generate slug from name
  useEffect(() => {
    const generated = form.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setForm((f) => ({ ...f, slug: generated }));
  }, [form.name]);

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
    setError('');
    setSaving(true);
    try {
      const created = await createApp({ ...form, url: protocol + form.url, webhook_url: form.webhook_url || undefined });
      if (imageSrc && croppedAreaPixels) {
        const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
        await uploadAppImage(created.id, blob, `${created.slug}.jpg`);
      }
      router.push('/dashboard/admin/apps');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? 'Failed to create application');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = { border: '1px solid #E2E8F0', color: '#1a202c', backgroundColor: '#fff' };

  return (
    <AdminLayout>
      <div className="p-8 max-w-2xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6" style={{ color: '#94A3B8' }}>
          <Link href="/dashboard" style={{ color: '#4338CA' }}>Home</Link>
          <span>›</span>
          <Link href="/dashboard/admin/apps" style={{ color: '#4338CA' }}>Applications</Link>
          <span>›</span>
          <span style={{ color: '#4338CA' }}>New Application</span>
        </nav>

        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a202c' }}>New Application</h1>
        <p className="text-sm mb-6" style={{ color: '#64748B' }}>Register a new application in the OS portal.</p>

        <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #E2E8F0' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: '#1a202c' }}>Display Name</label>
              <input type="text" required value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Nagarkot Trainings"
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#4338CA')}
                onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: '#1a202c' }}>Slug</label>
              <input type="text" required value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="e.g. trainings"
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none font-mono"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#4338CA')}
                onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
              />
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Auto-generated from name. Lowercase letters, numbers, and dashes only.</p>
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: '#1a202c' }}>Application URL</label>
              <div className="flex gap-0">
                <select value={protocol} onChange={(e) => setProtocol(e.target.value as any)}
                  className="px-3 py-2.5 rounded-l-lg text-sm focus:outline-none shrink-0"
                  style={{ border: '1px solid #E2E8F0', borderRight: 'none', backgroundColor: '#F8FAFC', color: '#475569' }}>
                  <option value="https://">https://</option>
                  <option value="http://">http://</option>
                </select>
                <input type="text" required value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="example.com"
                  className="flex-1 px-4 py-2.5 rounded-r-lg text-sm focus:outline-none"
                  style={{ border: '1px solid #E2E8F0', borderLeft: 'none', color: '#1a202c', backgroundColor: '#fff' }}
                  onFocus={(e) => (e.target.style.borderColor = '#4338CA')}
                  onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: '#1a202c' }}>Webhook URL <span className="font-normal" style={{ color: '#94A3B8' }}>(optional)</span></label>
              <input type="url" value={form.webhook_url}
                onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))}
                placeholder="e.g. http://localhost:8000/webhooks/os"
                className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none font-mono"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#4338CA')}
                onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
              />
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>OS will POST user.deleted / user.deactivated / user.reactivated events here.</p>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold" style={{ color: '#1a202c' }}>Active</label>
              <button type="button" onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: form.is_active ? '#1B3A6C' : '#E2E8F0' }}>
                <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                  style={{ transform: form.is_active ? 'translateX(22px)' : 'translateX(2px)' }} />
              </button>
              <span className="text-xs" style={{ color: '#64748B' }}>{form.is_active ? 'Active — visible to users' : 'Inactive — hidden from users'}</span>
            </div>

            {/* Image upload + crop */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1a202c' }}>App Icon</label>
              {!imageSrc ? (
                <label className="flex flex-col items-center justify-center w-full h-36 rounded-xl cursor-pointer transition-colors hover:bg-slate-50"
                  style={{ border: '2px dashed #E2E8F0' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mb-2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span className="text-sm" style={{ color: '#94A3B8' }}>Click to upload image</span>
                  <span className="text-xs mt-1" style={{ color: '#CBD5E1' }}>PNG, JPG, WebP — max 5 MB</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                </label>
              ) : (
                <div>
                  <div className="relative w-full rounded-xl overflow-hidden" style={{ height: 300, backgroundColor: '#1a1a1a' }}>
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
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Link href="/dashboard/admin/apps"
                className="flex-1 text-center py-2.5 rounded-lg text-sm font-medium border"
                style={{ borderColor: '#E2E8F0', color: '#475569' }}>
                Cancel
              </Link>
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#1B3A6C' }}>
                {saving ? 'Creating…' : 'Create Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
