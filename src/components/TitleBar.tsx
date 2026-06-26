import React, { useState } from 'react';
import { 
  FolderTree, 
  Terminal, 
  Info, 
  Settings, 
  ChevronDown
} from 'lucide-react';

interface TitleBarProps {
  onShowShortcuts: () => void;
  onShowExport: () => void;
  onToggleTheme: () => void;
  currentTheme: string;
  loadedCount: number;
}

export default function TitleBar({ 
  onShowShortcuts, 
  onShowExport, 
  onToggleTheme, 
  currentTheme,
  loadedCount 
}: TitleBarProps) {
  const handleMinimize = () => {
    if ((window as any).electron) {
      (window as any).electron.minimize();
    }
  };

  const handleMaximize = () => {
    if ((window as any).electron) {
      (window as any).electron.maximize();
    }
  };

  const handleClose = () => {
    if ((window as any).electron) {
      (window as any).electron.close();
    }
  };

  const isElectron = !!(window as any).electron;
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const menus = {
    File: [
      { label: 'Import JSON Tree...', shortcut: '⌘O', action: () => document.getElementById('json-file-input')?.click() },
      { label: 'Export Report...', shortcut: '⌘E', action: onShowExport },
      { label: 'Quit Application', shortcut: '⌘Q', action: () => {
        if (isElectron) {
          handleClose();
        } else {
          console.info('[Web mode] Quit is only available in the Electron build.');
        }
      } }
    ],
    Edit: [
      { label: 'Find File...', shortcut: '/', action: () => document.getElementById('tree-search-input')?.focus() },
      { label: 'Expand All Nodes', shortcut: 'E', action: () => window.dispatchEvent(new CustomEvent('tree-expand-all')) },
      { label: 'Collapse All Nodes', shortcut: 'C', action: () => window.dispatchEvent(new CustomEvent('tree-collapse-all')) }
    ],
    View: [
      { label: 'Toggle Theme', shortcut: 'T', action: onToggleTheme },
      { label: 'Reset Grid Layout', shortcut: 'Esc', action: () => window.dispatchEvent(new CustomEvent('layout-reset')) }
    ],
    Help: [
      { label: 'Keyboard Shortcuts', shortcut: '?', action: onShowShortcuts },
      { label: 'About Tree Viewer', shortcut: 'F1', action: () => alert('JSON Directory Tree Viewer\nDesigned for offline visual exploration of trees created using: \ntree . -J -s -f -D') }
    ]
  };

  const handleMenuClick = (menu: string) => {
    if (activeMenu === menu) {
      setActiveMenu(null);
    } else {
      setActiveMenu(menu);
    }
  };

  return (
    <div 
      className="h-11 border-b border-black/5 dark:border-white/5 bg-white/70 dark:bg-[#1E1E1F]/75 backdrop-blur-md select-none flex items-center justify-between px-4 shrink-0 z-50 relative"
      id="app-title-bar"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* macOS Traffic Lights & Title */}
      <div className="flex items-center gap-4">
        {/* macOS Traffic Lights */}
        <div 
          className="flex items-center gap-2 group"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div 
            onClick={handleClose}
            className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] relative flex items-center justify-center cursor-pointer"
          >
            <span className="absolute text-[6px] text-[#4c0002] font-black opacity-0 group-hover:opacity-100 transition-opacity">×</span>
          </div>
          <div 
            onClick={handleMinimize}
            className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] relative flex items-center justify-center cursor-pointer"
          >
            <span className="absolute text-[6px] text-[#5c3e00] font-black opacity-0 group-hover:opacity-100 transition-opacity">-</span>
          </div>
          <div 
            onClick={handleMaximize}
            className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1A9C2B] relative flex items-center justify-center cursor-pointer"
          >
            <span className="absolute text-[6px] text-[#003c03] font-black opacity-0 group-hover:opacity-100 transition-opacity">+</span>
          </div>
        </div>

        <div className="w-[1px] h-4 bg-black/10 dark:bg-white/10" />

        {/* Application Icon & Title */}
        <div className="flex items-center gap-2 font-sans font-medium text-xs tracking-tight text-neutral-800 dark:text-neutral-200">
          <FolderTree className="w-4 h-4 text-[#007AFF]" />
          <span className="font-semibold">Tree Viewer</span>
          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-sans rounded border border-black/5 dark:border-white/5">
            {isElectron ? 'ELECTRON_SHELL' : 'WEB_SHELL'}
          </span>
        </div>

        {/* Desktop Menus */}
        <div 
          className="hidden md:flex items-center gap-0.5 ml-4 relative z-50"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {Object.entries(menus).map(([name, items]) => (
            <div key={name} className="relative">
              <button
                className={`px-2 py-1 text-xs font-normal rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-400 flex items-center gap-0.5 ${
                  activeMenu === name ? 'bg-black/5 dark:bg-white/5 text-neutral-900 dark:text-neutral-100 font-medium' : ''
                }`}
                onClick={() => handleMenuClick(name)}
                onMouseEnter={() => activeMenu && setActiveMenu(name)}
              >
                {name}
                <ChevronDown className="w-3 h-3 opacity-40" />
              </button>

              {activeMenu === name && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setActiveMenu(null)}
                  />
                  <div className="absolute left-0 mt-1 w-52 rounded-xl bg-white/95 dark:bg-[#2A2A2B]/95 border border-black/10 dark:border-white/10 shadow-2xl py-1 z-50 animate-fade-in font-sans backdrop-blur-xl">
                    {items.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          item.action();
                          setActiveMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-[#007AFF] hover:text-white dark:hover:bg-[#007AFF] dark:hover:text-white flex items-center justify-between transition-all rounded-md mx-1 my-0.5 w-[calc(100%-8px)]"
                      >
                        <span className="font-normal">{item.label}</span>
                        <span className="text-[10px] opacity-60 font-mono tracking-wider font-light">
                          {item.shortcut}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Terminal Command Tip & Status Info */}
      <div className="flex items-center gap-3">
        <div 
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-lg font-mono text-[9px] text-neutral-500 dark:text-neutral-400 max-w-sm overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Terminal className="w-3 h-3 text-[#a3a3a3] shrink-0" />
          <span className="opacity-60">Command:</span>
          <span className="select-all">tree . --info -D -a -J -t -c -s -f</span>
        </div>

        <div 
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Active status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-sans font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse"></span>
            <span>{loadedCount} {loadedCount === 1 ? 'tree' : 'trees'}</span>
          </div>

          <button
            onClick={onShowShortcuts}
            className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Keyboard Shortcuts"
          >
            <Info className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Cycle Theme (T)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
