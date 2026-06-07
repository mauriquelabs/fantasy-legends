import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Loader2, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { FLAGS } from '@/lib/flags';
import NotFound from '@/pages/not-found';

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";
const btnClass = "w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 20);
}

type State = 'idle' | 'submitting' | 'error';

export default function CreateLeague() {
  if (!FLAGS.createLeague) return <NotFound />;

  const [, navigate] = useLocation();
  const { session, loading: authLoading } = useAuth();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [draftAt, setDraftAt] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!authLoading && !session) navigate('/sign-in?returnTo=/create-league');
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (!codeTouched) setCode(slugify(name));
  }, [name, codeTouched]);

  const codeValid = /^[a-zA-Z0-9_-]{3,20}$/.test(code);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !codeValid) return;
    setState('submitting');
    setErrorMsg('');

    const res = await fetch('/api/leagues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name, code, draftAt: draftAt || undefined }),
    });

    if (res.ok) {
      navigate(`/league/${code}`);
      return;
    }

    const body = await res.json().catch(() => ({}));
    setErrorMsg(body.error ?? 'Something went wrong. Please try again.');
    setState('error');
  };

  if (authLoading || !session) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-12 space-y-8">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary shrink-0" />
          <h1 className="text-2xl font-black tracking-tight">Create a league</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Set up your World Cup 2026 draft league.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            League name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Awesome League"
            required
            maxLength={80}
            disabled={state === 'submitting'}
            className={inputClass}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            League code
          </label>
          <input
            type="text"
            value={code}
            onChange={e => { setCodeTouched(true); setCode(e.target.value); }}
            placeholder="my-awesome-league"
            required
            pattern="[a-zA-Z0-9_\-]{3,20}"
            title="3–20 characters: letters, numbers, hyphens, underscores"
            disabled={state === 'submitting'}
            className={inputClass}
          />
          <p className="text-[11px] text-muted-foreground/60">
            Used in the invite URL · 3–20 characters, letters/numbers/hyphens/underscores
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Draft date & time <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
          </label>
          <input
            type="datetime-local"
            value={draftAt}
            onChange={e => setDraftAt(e.target.value)}
            disabled={state === 'submitting'}
            className={inputClass}
          />
        </div>

        {(state === 'error') && (
          <p className="text-sm text-destructive">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={state === 'submitting' || !name || !codeValid}
          className={btnClass}
        >
          {state === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
          {state === 'submitting' ? 'Creating…' : 'Create league'}
        </button>
      </form>
    </div>
  );
}
