import { Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Logo from './Logo.jsx';
import { isTauri } from '../lib/api.js';

export default function TitleBar() {
  const win = isTauri() ? getCurrentWindow() : null;
  const btn = 'flex h-9 w-11 items-center justify-center text-mute transition-colors hover:bg-white/10 hover:text-ink';

  return (
    <div
      data-tauri-drag-region
      className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur"
    >
      <div data-tauri-drag-region className="flex items-center gap-3 ps-4">
        <Logo size={14} />
        <span data-tauri-drag-region className="pointer-events-none font-display text-lg font-bold tracking-wide">
          Prime Launcher
        </span>
      </div>
      <div dir="ltr" className="flex items-center gap-1 pe-2">
        <button type="button" className={`${btn} rounded-lg`} onClick={() => win?.minimize()} aria-label="تصغير">
          <Minus size={15} />
        </button>
        <button type="button" className={`${btn} rounded-lg`} onClick={() => win?.toggleMaximize()} aria-label="تكبير">
          <Square size={11} />
        </button>
        <button
          type="button"
          className={`${btn} rounded-lg hover:!bg-red-500/80 hover:!text-white`}
          onClick={() => win?.close()}
          aria-label="إغلاق"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
