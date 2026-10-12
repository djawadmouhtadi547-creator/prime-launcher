import { useCallback, useEffect, useState } from 'react';
import { Gamepad2, Palette, Puzzle, Settings as Cog, Users } from 'lucide-react';
import TitleBar from './components/TitleBar.jsx';
import HomePage from './components/HomePage.jsx';
import ModsPage from './components/ModsPage.jsx';
import AccountsPage from './components/AccountsPage.jsx';
import ThemePage from './components/ThemePage.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import { api, onEvent } from './lib/api.js';
import { DEFAULT_SETTINGS, usePersisted } from './lib/store.js';
import { applyTheme } from './lib/theme.js';

const PAGES = [
  { id: 'home', label: 'الرئيسية', icon: Gamepad2 },
  { id: 'mods', label: 'المودات', icon: Puzzle },
  { id: 'accounts', label: 'الحسابات', icon: Users },
  { id: 'theme', label: 'المظهر', icon: Palette },
  { id: 'settings', label: 'الإعدادات', icon: Cog },
];

const MAX_LOG_LINES = 300;

function Sidebar({ page, onChange }) {
  return (
    <nav
      className="flex w-[88px] shrink-0 flex-col gap-2 border-l-2 border-lo bg-panel/50 p-2"
      aria-label="التنقل"
    >
      {PAGES.map(({ id, label, icon: Icon }) => {
        const active = page === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex flex-col items-center gap-1 px-1 py-3 text-xs ${
              active ? 'inset text-accent-hi' : 'border-2 border-transparent text-mute hover:text-ink'
            }`}
          >
            {active && <span className="absolute inset-y-2 start-0 w-1 bg-accent" />}
            <Icon size={20} />
            {label}
          </button>
        );
      })}
      <span dir="ltr" className="mt-auto pb-1 text-center text-[11px] text-mute">
        v1.0.0
      </span>
    </nav>
  );
}

export default function App() {
  const [settings, setSettings] = usePersisted('prime.settings', DEFAULT_SETTINGS);
  const [accounts, setAccounts] = usePersisted('prime.accounts', []);
  const [page, setPage] = useState('home');
  const [versions, setVersions] = useState([]);
  const [versionsError, setVersionsError] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | preparing | running
  const [progress, setProgress] = useState({ label: '', current: 0, total: 0 });
  const [logs, setLogs] = useState([]);
  const [lastCommand, setLastCommand] = useState('');
  const [error, setError] = useState('');

  const patch = useCallback((p) => setSettings((s) => ({ ...s, ...p })), [setSettings]);
  const active = accounts.find((a) => a.id === settings.activeAccount) || accounts[0] || null;

  // تطبيق الثيم
  useEffect(() => {
    applyTheme({ accent: settings.accent, bg: settings.bg, pattern: settings.pattern });
  }, [settings.accent, settings.bg, settings.pattern]);

  // قائمة إصدارات ماينكرافت
  useEffect(() => {
    let dead = false;
    api
      .listVersions()
      .then((list) => {
        if (dead) return;
        setVersions(list);
        setVersionsError('');
      })
      .catch((e) => !dead && setVersionsError(e.message));
    return () => {
      dead = true;
    };
  }, []);

  // اختيار أحدث إصدار رسمي عند أول تشغيل
  useEffect(() => {
    if (!settings.version && versions.length) {
      const latest = versions.find((v) => v.type === 'release') || versions[0];
      patch({ version: latest.id });
    }
  }, [versions, settings.version, patch]);

  // أحداث محرّك Rust
  useEffect(() => {
    let dead = false;
    const offs = [];
    const add = async (name, cb) => {
      const off = await onEvent(name, cb);
      if (dead) off();
      else offs.push(off);
    };
    const pushLog = (line) => setLogs((prev) => [...prev.slice(-(MAX_LOG_LINES - 1)), line]);
    add('progress', (p) => setProgress(p));
    add('game_log', pushLog);
    add('game_exit', (code) => {
      setPhase('idle');
      pushLog(`انتهت اللعبة برمز الخروج ${code}`);
    });
    return () => {
      dead = true;
      offs.forEach((f) => f());
    };
  }, []);

  const play = async () => {
    setError('');
    if (!active) {
      setPage('accounts');
      return;
    }
    if (!settings.version) {
      setError('اختر إصداراً أولاً.');
      return;
    }
    setPhase('preparing');
    setProgress({ label: 'بدء التجهيز', current: 0, total: 0 });
    setLogs([]);
    setLastCommand('');
    try {
      const res = await api.launchGame({
        version: settings.version,
        loader: settings.loader,
        username: active.name,
        uuid: active.uuid,
        accessToken: '0',
        ramMb: settings.ramMb,
        javaPath: settings.javaPath,
        extraJvmArgs: settings.jvmArgs,
        fullscreen: settings.fullscreen,
      });
      setLastCommand(res.command);
      setPhase('running');
    } catch (e) {
      setPhase('idle');
      setError(e.message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar page={page} onChange={setPage} />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {page === 'home' && (
            <HomePage
              settings={settings}
              patch={patch}
              versions={versions}
              versionsError={versionsError}
              account={active}
              phase={phase}
              progress={progress}
              logs={logs}
              lastCommand={lastCommand}
              error={error}
              onPlay={play}
            />
          )}
          {page === 'mods' && <ModsPage settings={settings} patch={patch} />}
          {page === 'accounts' && (
            <AccountsPage
              accounts={accounts}
              setAccounts={setAccounts}
              settings={settings}
              patch={patch}
              active={active}
            />
          )}
          {page === 'theme' && <ThemePage settings={settings} patch={patch} />}
          {page === 'settings' && <SettingsPage settings={settings} patch={patch} />}
        </main>
      </div>
    </div>
  );
}
