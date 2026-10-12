import { Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Logo from './Logo.jsx';
import { isTauri } from '../lib/api.js';

export default function TitleBar() {
  const win = isTauri() ? getCurrentWindow() : null;
  const btn = 'flex h-9 w-12 items-center justify-center text-mute hover:bg-hi hover:text-ink';

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center justify-between border-b-2 border-lo bg-slot"
    >
      <div data-tauri-drag-region className="flex items-center gap-3 pe-3 ps-4">
        <Logo size={14} />
        <span data-tauri-drag-region className="pointer-events-none font-display text-lg font-bold tracking-wide">
          Prime Launcher
        </span>
      </div>
      <div dir="ltr" className="flex">
        <button type="button" className={btn} onClick={() => win?.minimize()} aria-label="تصغير">
          <Minus size={14} />
        </button>
        <button type="button" className={btn} onClick={() => win?.toggleMaximize()} aria-label="تكبير">
          <Square size={11} />
        </button>
        <button
          type="button"
          className={`${btn} hover:!bg-[#8e3b36] hover:!text-white`}
          onClick={() => win?.close()}
          aria-label="إغلاق"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
