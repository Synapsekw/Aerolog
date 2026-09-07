'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  browserClient,
  api,
  setActiveOrganization,
} from '@/lib/supabase-browser';
import type { EquipmentAlias } from '@/lib/domain/equipment-identity';
import type { Profile, RecordEnvelope, Kind } from '@/lib/domain/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import OrganizationPanel from './organization-panel';
import { Crosshair, ArrowRight, ShieldCheck } from 'lucide-react';
import type { InspectionMeterRoute } from '@/lib/operations/inspection-meter-routing';
type Store = {
  profile: Profile & { email: string };
  organization: any;
  records: RecordEnvelope[];
  equipmentAliases: EquipmentAlias[];
  inspectionMeterRoutes: InspectionMeterRoute[];
  profiles: Profile[];
  notifications: any[];
  audit: any[];
};
const Context = createContext<any>(null);
export function useApp() {
  return useContext(Context) as Store & {
    refresh: () => Promise<void>;
    command: (
      command: string,
      kind: Kind,
      data: any,
      note?: string,
    ) => Promise<any>;
    notify: (s: string) => void;
    signOut: () => Promise<void>;
    busy: boolean;
    items: (kind: string) => any[];
    revision: (kind: string, id: string) => number;
    status: any;
    markRead: (id: string) => Promise<void>;
  };
}
export default function AppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [store, setStore] = useState<Store | null>(null),
    [loading, setLoading] = useState(true),
    [onboarding, setOnboarding] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [status, setStatus] = useState<any>({});
  const refresh = useCallback(async () => {
    try {
      await api('organizations');
    } catch {
      setOnboarding(false);
      throw Error('Please sign in.');
    }
    let data: Store;
    try {
      data = await api<Store>('bootstrap');
    } catch (e) {
      if ((e as Error).message.includes('no active workspace membership')) {
        setStore(null);
        setOnboarding(true);
        return;
      }
      throw e;
    }
    setOnboarding(false);
    setActiveOrganization(data.organization.id);
    setStore(data);
    setStatus(await api('status'));
  }, []);
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const {
          data: { session },
        } = await browserClient().auth.getSession();
        if (session && active) await refresh();
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void init();
    const {
      data: { subscription },
    } = browserClient().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setStore(null);
        setOnboarding(false);
      }
      if (event === 'SIGNED_IN' && session)
        setTimeout(() => void refresh().catch((e) => setError(e.message)), 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refresh]);
  const signedIn = !!store;
  useEffect(() => {
    if (!signedIn) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible')
        void refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [signedIn, refresh]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(t);
  }, [message]);
  async function login(role?: string) {
    setBusy(true);
    setError('');
    try {
      if (role) {
        const response = await fetch('/api/local-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        });
        const r = await response.json();
        if (!response.ok) throw Error(r.error);
        const { error } = await browserClient().auth.setSession(r.session);
        if (error) throw error;
      } else {
        const { error } = await browserClient().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      await refresh();
      setPassword('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const revision = (kind: string, id: string) =>
    store?.records.find((r) => r.kind === kind && r.id === id)?.revision || 0;
  async function command(action: string, kind: Kind, data: any, note?: string) {
    setBusy(true);
    try {
      const result = await api('commands', {
        method: 'POST',
        body: JSON.stringify({
          command: action,
          payload: { kind, data, revision: revision(kind, data.id), note },
        }),
      });
      await refresh();
      return result;
    } catch (e) {
      setMessage((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="auth-screen">
        <div className="auth-card glass">
          <Crosshair className="text-lime" />
          <h1>Connecting your workspace</h1>
          <p>Loading your account and operational records…</p>
        </div>
      </main>
    );
  if (onboarding)
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <OrganizationPanel onChange={refresh} />
          <Button
            variant="ghost"
            onClick={() => void browserClient().auth.signOut()}
          >
            Sign out
          </Button>
        </div>
      </main>
    );
  if (!store)
    return (
      <main className="auth-screen">
        <form
          className="auth-card glass"
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <div className="brand">
            <Crosshair />
            <span>AEROLOG</span>
          </div>
          <span className="eyebrow">OPERATIONS START HERE</span>
          <h1>Welcome to your workspace</h1>
          <p>Sign in to plan, fly and keep your fleet ready.</p>
          <label className="field" htmlFor="login-email">
            <span>Email</span>
            <Input
              id="login-email"
              autoComplete="username"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field" htmlFor="login-password">
            <span>Password</span>
            <Input
              id="login-password"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <Button className="primary wide" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
            <ArrowRight size={16} />
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              if (!email || password.length < 12) {
                setError(
                  'Enter your email and a password of at least 12 characters.',
                );
                return;
              }
              setBusy(true);
              setError('');
              try {
                const { data, error } = await browserClient().auth.signUp({
                  email,
                  password,
                  options: { emailRedirectTo: location.origin },
                });
                if (error) throw error;
                if (data.session) await refresh();
                else
                  setError(
                    'Check your email to confirm your account, then sign in to create or join an organization.',
                  );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Create an account
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="wide"
            onClick={async () => {
              if (!email) {
                setError('Enter your email first.');
                return;
              }
              if (!status.smtp) {
                setError(
                  'Email delivery is not configured yet. Ask your administrator to reset your password.',
                );
                return;
              }
              const { error } =
                await browserClient().auth.resetPasswordForEmail(email, {
                  redirectTo: location.origin,
                });
              setError(
                error ? error.message : 'Password reset email requested.',
              );
            }}
          >
            Forgot password?
          </Button>
          {process.env.NODE_ENV === 'development' && (
            <div className="local-test-login">
              <p>
                <ShieldCheck size={14} /> Local test accounts
              </p>
              <div>
                {['admin', 'manager', 'pilot', 'technician', 'observer'].map(
                  (role) => (
                    <Button
                      key={role}
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void login(role)}
                    >
                      {role}
                    </Button>
                  ),
                )}
              </div>
              <small>
                Available only on localhost in development. Uses real Supabase
                sessions and role permissions.
              </small>
            </div>
          )}
        </form>
      </main>
    );
  return (
    <Context.Provider
      value={{
        ...store,
        status,
        refresh,
        command,
        revision,
        notify: setMessage,
        busy,
        items: (kind: string) =>
          store.records.filter((r) => r.kind === kind).map((r) => r.data),
        signOut: async () => {
          await browserClient().auth.signOut();
          setStore(null);
        },
        markRead: async (id: string) => {
          await api('commands', {
            method: 'POST',
            body: JSON.stringify({
              command: 'notification_read',
              payload: { id },
            }),
          });
          await refresh();
        },
      }}
    >
      <div key={store.organization.id} style={{ display: 'contents' }}>
        {children}
      </div>
      {message && (
        <div className="toast" role="status">
          {message}
          <button onClick={() => setMessage('')} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
