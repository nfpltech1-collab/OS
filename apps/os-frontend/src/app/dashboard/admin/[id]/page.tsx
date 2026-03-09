'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getUser, getUserAppAccess, setAppAccess, setAppAdmin, getApplications } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface AccessRecord {
  app_slug: string;
  app_name: string;
  is_enabled: boolean;
  is_app_admin: boolean;
  granted_at: string;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const isSelf = currentUser?.id === id;
  const [user, setUser] = useState<{ name: string; email: string; is_active: boolean; userType: { label: string; slug: string } } | null>(null);
  const [access, setAccess] = useState<AccessRecord[]>([]);
  const [allApps, setAllApps] = useState<{ slug: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUser(id), getUserAppAccess(id), getApplications()])
      .then(([u, a, apps]) => {
        setUser(u);
        setAccess(a);
        setAllApps(apps);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleAccess(slug: string, currentlyEnabled: boolean) {
    const prev = [...access];
    setIsLoading(slug);
    try {
      await setAppAccess(id, slug, !currentlyEnabled);
      setAccess((current) => {
        const exists = current.find((a) => a.app_slug === slug);
        if (exists) {
          return current.map((a) =>
            a.app_slug === slug ? { ...a, is_enabled: !currentlyEnabled } : a,
          );
        }
        return [
          ...current,
          {
            app_slug: slug,
            app_name: allApps.find((a) => a.slug === slug)?.name ?? slug,
            is_enabled: true,
            is_app_admin: false,
            granted_at: new Date().toISOString(),
          },
        ];
      });
    } catch {
      setAccess(prev); // rollback
    } finally {
      setIsLoading(null);
    }
  }

  async function toggleAppAdmin(slug: string, currentlyAdmin: boolean) {
    const prev = [...access];
    setIsLoading(slug + '_admin');
    try {
      await setAppAdmin(id, slug, !currentlyAdmin);
      setAccess((current) =>
        current.map((a) =>
          a.app_slug === slug ? { ...a, is_app_admin: !currentlyAdmin } : a,
        ),
      );
    } catch {
      setAccess(prev); // rollback
    } finally {
      setIsLoading(null);
    }
  }

  function isEnabled(slug: string) {
    const record = access.find((a) => a.app_slug === slug);
    return record?.is_enabled ?? false;
  }

  function isAppAdmin(slug: string) {
    const record = access.find((a) => a.app_slug === slug);
    return record?.is_app_admin ?? false;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f7fa' }}>
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1B3A6C', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f7fa' }}>
      <header className="bg-white border-b flex items-center gap-4 px-8 py-4" style={{ borderColor: '#e2e8f0' }}>
        <Link href="/dashboard/admin" className="text-sm" style={{ color: '#718096' }}>
          ← Back
        </Link>
        <span style={{ color: '#e2e8f0' }}>|</span>
        <h1 className="text-sm font-semibold" style={{ color: '#1a202c' }}>
          {user?.name} — App Access
        </h1>
      </header>

      <main className="px-8 py-8 max-w-lg mx-auto">
        {/* User info */}
        <div className="bg-white rounded-xl p-5 mb-6" style={{ border: '1px solid #e2e8f0' }}>
          <p className="font-semibold" style={{ color: '#1a202c' }}>{user?.name}</p>
          <p className="text-sm mt-0.5" style={{ color: '#718096' }}>{user?.email}</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">
              {user?.userType?.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              user?.is_active
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {user?.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* App access toggles */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest mb-4 font-medium" style={{ color: '#718096' }}>
            Application Access
          </p>
          {isSelf && (
            <div className="rounded-xl px-5 py-4 text-sm" style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
              You cannot manage your own app access.
            </div>
          )}
          {!isSelf && allApps.map((app) => {
            const enabled = isEnabled(app.slug);

            return (
              <div
                key={app.slug}
                className="bg-white flex items-center justify-between rounded-xl px-5 py-4"
                style={{ border: '1px solid #e2e8f0' }}
              >
                <span className="text-sm font-medium" style={{ color: '#1a202c' }}>{app.name}</span>

                <div className="flex items-center gap-6">
                  {/* App Admin toggle — only shown when app is enabled */}
                  {enabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: '#94A3B8' }}>App Admin</span>
                      <button
                        onClick={() => toggleAppAdmin(app.slug, isAppAdmin(app.slug))}
                        disabled={isLoading === app.slug + '_admin'}
                        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                          isLoading === app.slug + '_admin' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        style={{ backgroundColor: isAppAdmin(app.slug) ? '#D97706' : '#cbd5e0' }}
                      >
                        <span className={`
                          absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white
                          transition-transform duration-200
                          ${isAppAdmin(app.slug) ? 'translate-x-4' : 'translate-x-0'}
                        `} />
                      </button>
                    </div>
                  )}

                  {/* Enable/Disable toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#94A3B8' }}>Access</span>
                    <button
                      onClick={() => toggleAccess(app.slug, enabled)}
                      disabled={isLoading === app.slug}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                        isLoading === app.slug ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      style={{ backgroundColor: enabled ? '#1B3A6C' : '#cbd5e0' }}
                    >
                      <span className={`
                        absolute top-1 left-1 w-4 h-4 rounded-full bg-white
                        transition-transform duration-200
                        ${enabled ? 'translate-x-5' : 'translate-x-0'}
                      `} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
