import React from 'react';
import { Terminal, Keyboard, Shield, HelpCircle } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const sections = [
    {
      title: 'Tree Navigation',
      keys: [
        { key: '↑ or K', desc: 'Highlight previous visible node' },
        { key: '↓ or J', desc: 'Highlight next visible node' },
        { key: '→ or L', desc: 'Expand directory / move to child' },
        { key: '← or H', desc: 'Collapse directory / move to parent' },
        { key: 'Enter', desc: 'Toggle directory fold' }
      ]
    },
    {
      title: 'Common Actions',
      keys: [
        { key: 'Space', desc: 'Open file Quick Look Inspector' },
        { key: 'Slash (/)', desc: 'Focus the file/folder search bar' },
        { key: 'Escape', desc: 'Unfocus search or close dialog modals' },
        { key: 'E', desc: 'Expand all directory nodes' },
        { key: 'C', desc: 'Collapse all directory nodes' }
      ]
    },
    {
      title: 'App Settings',
      keys: [
        { key: 'T', desc: 'Cycle themes (Slate Dark, Cyberpunk, Amber)' },
        { key: 'Ctrl + O', desc: 'Trigger upload JSON tree dialog' },
        { key: 'Ctrl + E', desc: 'Trigger export report dialog' }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in font-sans">
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg max-w-lg w-full flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-900 flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200">
            <Keyboard className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm font-semibold">Power User Keyboard Shortcuts</h4>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-500 font-medium"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[350px] overflow-y-auto">
          <div className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded text-xs text-neutral-500 dark:text-neutral-400">
            <HelpCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              Using physical keyboard shortcuts significantly speeds up files exploration. When navigating, scroll containers auto-align selected rows.
            </span>
          </div>

          <div className="space-y-4">
            {sections.map((section, idx) => (
              <div key={idx} className="space-y-1.5">
                <h5 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                  {section.title}
                </h5>
                <div className="space-y-1">
                  {section.keys.map((k, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 dark:border-neutral-900 last:border-0"
                    >
                      <span className="text-neutral-600 dark:text-neutral-400">{k.desc}</span>
                      <kbd className="px-1.5 py-0.5 font-mono text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded shadow-xs">
                        {k.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-neutral-100 dark:border-neutral-900 bg-neutral-50 dark:bg-neutral-900/40 flex justify-end gap-2 shrink-0 text-xs font-medium">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded transition-colors"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
