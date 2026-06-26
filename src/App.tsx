import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import TreeView from './components/TreeView';
import QuickLook from './components/QuickLook';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import ExportModal from './components/ExportModal';
import { getPresetSources, createTreeSourceFromRaw, hydrateTreeNodes } from './data/presets';
import { TreeSource, TreeItem, SearchFilters, UIConfig } from './types';
import { saveTreeSources, loadTreeSources, deleteTreeSource } from './storageHelper';
import { 
  FolderTree, 
  Terminal, 
  Cpu,
  Loader2,
  CheckCircle2,
  XCircle,
  UploadCloud
} from 'lucide-react';

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const WORKER_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB — use Web Worker for files larger than this

export default function App() {
  // Loading state for async hydration from IndexedDB
  const [isLoading, setIsLoading] = useState(true);

  const [sources, setSources] = useState<TreeSource[]>([]);

  const [activeSourceIds, setActiveSourceIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('tree-viewer-active-ids');
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  const [mergeMode, setMergeMode] = useState<'independent' | 'merged'>(() => {
    const saved = localStorage.getItem('tree-viewer-merge-mode');
    return (saved === 'merged' || saved === 'independent') ? saved : 'independent';
  });

  const [uiConfig, setUiConfig] = useState<UIConfig>(() => {
    const saved = localStorage.getItem('tree-viewer-ui-config');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      theme: 'slate-dark',
      fontFamily: 'font-sans',
      density: 'comfortable',
      showSizeBadges: true,
      showDateBadges: true,
      showPermissions: false,
      autoExpandDepth: 2
    };
  });

  // Modal display controllers
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Selected Tree Item (Detailed metadata Preview)
  const [selectedNode, setSelectedNode] = useState<TreeItem | null>(null);

  // Search and Advanced Filter Settings
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    caseSensitive: false,
    useRegex: false,
    type: 'all',
    sizeMin: null,
    sizeMax: null,
    dateStart: null,
    dateEnd: null,
    extension: 'all'
  });

  // Re-render notifier for storage-linked notes/tags updates
  const [storageTrigger, setStorageTrigger] = useState(0);

  // Import progress state — tracks active worker parsing
  const [importProgress, setImportProgress] = useState<{ name: string; sizeLabel: string } | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounterRef = useRef(0);

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastCounterRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // --- Async hydration from IndexedDB on mount (Reset app & load presets) ---
  useEffect(() => {
    // Clear storage to reset the app completely
    localStorage.removeItem('tree-viewer-sources');
    localStorage.removeItem('tree-viewer-active-ids');
    try {
      indexedDB.deleteDatabase('TreeViewerDB');
    } catch (e) {
      console.warn('[App] Failed to delete TreeViewerDB:', e);
    }

    const presets = getPresetSources();
    setSources(presets);
    setActiveSourceIds([presets[0].id]);
    setIsLoading(false);
  }, []);

  // --- Debounced persistence of sources to storage (500ms trailing) ---
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip save on initial load (we just loaded from storage)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Skip save while still loading
    if (isLoading) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTreeSources(sources).catch((err) => {
        console.warn('[App] Failed to save tree sources:', err);
      });
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [sources, isLoading]);

  // Save lightweight state to localStorage immediately
  useEffect(() => {
    localStorage.setItem('tree-viewer-active-ids', JSON.stringify(activeSourceIds));
  }, [activeSourceIds]);

  useEffect(() => {
    localStorage.setItem('tree-viewer-merge-mode', mergeMode);
  }, [mergeMode]);

  useEffect(() => {
    localStorage.setItem('tree-viewer-ui-config', JSON.stringify(uiConfig));
  }, [uiConfig]);

  // Sync state when local note is set
  useEffect(() => {
    const handleStorageUpdate = () => {
      setStorageTrigger(prev => prev + 1);
    };
    window.addEventListener('storage-note-updated', handleStorageUpdate);
    return () => window.removeEventListener('storage-note-updated', handleStorageUpdate);
  }, []);

  // Theme Toggler: cycles through professional styles
  const handleToggleTheme = () => {
    const themes: UIConfig['theme'][] = ['slate-dark', 'slate-light', 'amber-warm', 'cyberpunk-dark', 'monochrome-minimal'];
    const currentIndex = themes.indexOf(uiConfig.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setUiConfig(prev => ({ ...prev, theme: themes[nextIndex] }));
  };

  // Keyboard shortcut for cycling theme & focusing search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.getAttribute('contenteditable') === 'true'
      );

      if (isInputFocused) return;

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleToggleTheme();
      }

      if (e.key === '/' || (e.ctrlKey && e.key === 'f')) {
        e.preventDefault();
        const searchInput = document.getElementById('tree-search-input');
        searchInput?.focus();
      }

      if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiConfig.theme]);

  // ITERATIVE Recursive Tree Merging Core Logic
  // Uses a work queue instead of recursion to avoid stack overflow on deeply nested merges
  const mergeTreeItemLists = (lists: TreeItem[][]): TreeItem[] => {
    // Work queue approach: each item is { lists, targetMerged }
    type WorkItem = {
      lists: TreeItem[][];
      resultRef: { merged: TreeItem[] };
    };

    const rootResult = { merged: [] as TreeItem[] };
    const queue: WorkItem[] = [{ lists, resultRef: rootResult }];

    // We need to track deferred child merges
    type DeferredMerge = {
      existing: TreeItem;
      childLists: TreeItem[][];
    };

    const deferredMerges: DeferredMerge[] = [];

    // First pass: merge at each level, collecting child merges to process
    while (queue.length > 0) {
      const work = queue.shift()!;
      const merged: TreeItem[] = [];
      const mapByNameAndType: { [key: string]: TreeItem } = {};
      const childListsMap: { [key: string]: TreeItem[][] } = {};

      work.lists.forEach(list => {
        list.forEach(item => {
          const key = `${item.type}:${item.name}`;
          if (!mapByNameAndType[key]) {
            const copy = { ...item };
            if (item.contents) {
              copy.contents = [...item.contents];
            }
            mapByNameAndType[key] = copy;
            merged.push(copy);
          } else {
            const existing = mapByNameAndType[key];
            if (existing.type === 'directory' && item.contents && item.contents.length > 0) {
              if (!existing.contents) {
                existing.contents = [];
              }
              // Collect child lists for deferred iterative merge
              if (!childListsMap[key]) {
                childListsMap[key] = [existing.contents];
              }
              childListsMap[key].push(item.contents);
            }
            if (item.size !== undefined && (existing.size === undefined || item.size > existing.size)) {
              existing.size = item.size;
            }
            if (item.time && !existing.time) {
              existing.time = item.time;
            }
            if (item.prot && !existing.prot) {
              existing.prot = item.prot;
            }
          }
        });
      });

      // Queue up child merges
      for (const key of Object.keys(childListsMap)) {
        const existing = mapByNameAndType[key];
        const childResult = { merged: [] as TreeItem[] };
        queue.push({ lists: childListsMap[key], resultRef: childResult });
        deferredMerges.push({ existing, childLists: childListsMap[key] });
        // We'll replace existing.contents after the queue processes
        // For now, tag the existing node so we can find it
        (existing as any).__childResultRef = childResult;
      }

      work.resultRef.merged = merged;
    }

    // Apply deferred child merge results
    for (const { existing } of deferredMerges) {
      const childResultRef = (existing as any).__childResultRef;
      if (childResultRef) {
        existing.contents = childResultRef.merged;
        delete (existing as any).__childResultRef;
      }
    }

    return rootResult.merged;
  };

  // Process and compute combined display root nodes depending on merge settings
  const processedRootNodes = useMemo(() => {
    const activeSources = sources.filter(s => activeSourceIds.includes(s.id));
    if (activeSources.length === 0) return [];

    if (mergeMode === 'merged') {
      const allRoots = activeSources.map(s => s.rootNodes);
      return mergeTreeItemLists(allRoots);
    } else {
      // Independent mode: list all source root nodes. 
      // If there are multiple active roots, we keep them distinct.
      const result: TreeItem[] = [];
      activeSources.forEach(source => {
        result.push(...source.rootNodes);
      });
      return result;
    }
  }, [sources, activeSourceIds, mergeMode]);

  // Load Preset demo datasets
  const handleLoadPresets = () => {
    const presets = getPresetSources();
    setSources(presets);
    setActiveSourceIds([presets[0].id]);
    setSelectedNode(null);
  };

  // Add customized JSON Tree Source — supports Web Worker for large files
  const handleAddSource = useCallback((name: string, rawJsonOrFile: string | File) => {
    const isFile = rawJsonOrFile instanceof File;
    const size = isFile ? rawJsonOrFile.size : rawJsonOrFile.length;

    // Build a human-readable file size label
    const formatBytes = (b: number) => {
      if (b < 1024) return `${b} B`;
      if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
      if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
      return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    if (isFile || size >= WORKER_SIZE_THRESHOLD) {
      // Use Web Worker for files (or large pasted text) to prevent main-thread freeze
      const worker = new Worker(new URL('./parseWorker.ts', import.meta.url), { type: 'module' });
      const id = `custom-source-${Date.now()}`;

      // Show persistent import progress banner
      setImportProgress({ name, sizeLabel: formatBytes(size) });

      worker.onmessage = (e: MessageEvent) => {
        const { success, result, error } = e.data;
        worker.terminate();
        setImportProgress(null);

        if (success) {
          const rootNodes = JSON.parse(result.rootNodesJson);
          hydrateTreeNodes(rootNodes, result.id);
          const newSource: TreeSource = {
            id: result.id,
            name: result.name,
            importedAt: result.importedAt,
            rawJson: rawJsonOrFile,
            rootNodesJson: result.rootNodesJson,
            rootNodes,
            directoriesCount: result.directoriesCount,
            filesCount: result.filesCount,
            totalSize: result.totalSize,
          };
          setSources(prev => [...prev, newSource]);
          setActiveSourceIds(prev => [...prev, newSource.id]);
          setSelectedNode(null);
          showToast('success', `"${result.name}" imported — ${result.filesCount.toLocaleString()} files, ${result.directoriesCount.toLocaleString()} dirs`);
        } else {
          showToast('error', `Parse failed: ${error}`);
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        setImportProgress(null);
        showToast('error', `Worker error: ${err.message}`);
      };

      const fileToSend = isFile 
        ? rawJsonOrFile 
        : new Blob([rawJsonOrFile], { type: 'application/json' });

      worker.postMessage({ id, name, file: fileToSend });
    } else {
      // Parse on main thread for small pasted text only
      try {
        const rawJson = rawJsonOrFile as string;
        const parsed = JSON.parse(rawJson);
        const id = `custom-source-${Date.now()}`;
        const dataArray = Array.isArray(parsed) ? parsed : [parsed];
        const newSource = createTreeSourceFromRaw(id, name, dataArray);
        setSources(prev => [...prev, newSource]);
        setActiveSourceIds(prev => [...prev, id]);
        setSelectedNode(null);
        showToast('success', `"${name}" imported successfully`);
      } catch (err: any) {
        showToast('error', `Error parsing JSON: ${err.message}`);
      }
    }
  }, [showToast]);

  // Toggle active tree source
  const handleToggleSource = (id: string) => {
    setActiveSourceIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setSelectedNode(null);
  };

  // Delete tree source
  const handleDeleteSource = (id: string) => {
    setSources(prev => prev.filter(x => x.id !== id));
    setActiveSourceIds(prev => prev.filter(x => x !== id));
    setSelectedNode(null);
    // Also clean up IndexedDB
    deleteTreeSource(id).catch(() => {});
  };

  // Clear everything
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all imported JSON tree structures?')) {
      // Clean up IndexedDB for all sources
      sources.forEach(s => deleteTreeSource(s.id).catch(() => {}));
      setSources([]);
      setActiveSourceIds([]);
      setSelectedNode(null);
    }
  };

  // Map theme name to master application styling classes (Apple Mode integration)
  const getThemeClass = () => {
    switch (uiConfig.theme) {
      case 'slate-light':
        return 'bg-white text-neutral-800 border-black/5 font-sans';
      case 'slate-dark':
        return 'dark bg-[#1E1E1F] text-neutral-200 border-white/5 font-sans';
      case 'amber-warm':
        return 'dark bg-[#281a0c] text-[#ffd3a3] border-[#3d2712] font-mono';
      case 'cyberpunk-dark':
        return 'dark bg-black text-[#00ffcc] border-[#ff0055]/30 font-mono';
      case 'monochrome-minimal':
        return 'bg-white text-neutral-900 border-black/10 font-sans';
      default:
        return 'dark bg-[#1E1E1F] text-neutral-200 border-white/5 font-sans';
    }
  };

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only fire if leaving the outermost element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      const sourceName = file.name.replace(/\.json$/i, '');
      handleAddSource(sourceName, file);
    } else if (file) {
      showToast('error', 'Please drop a .json file');
    }
  }, [handleAddSource, showToast]);

  // Show loading screen while hydrating from IndexedDB (Apple loading theme)
  if (isLoading) {
    const isDark = uiConfig.theme.includes('dark') || uiConfig.theme === 'amber-warm' || uiConfig.theme === 'cyberpunk-dark';
    return (
      <div className={`h-screen w-screen flex flex-col items-center justify-center transition-all duration-300 ${
        isDark ? 'bg-[#1E1E1F] text-neutral-200' : 'bg-[#F5F5F7] text-neutral-800'
      }`}>
        <Loader2 className="w-8 h-8 text-[#007AFF] animate-spin mb-3" />
        <p className="text-xs text-neutral-400 font-sans font-medium tracking-wide">Loading saved trees...</p>
      </div>
    );
  }

  const isDarkTheme = uiConfig.theme.includes('dark') || uiConfig.theme === 'amber-warm' || uiConfig.theme === 'cyberpunk-dark';

  return (
    <div
      className={`h-screen w-screen flex items-center justify-center p-3 select-none overflow-hidden transition-all duration-300 ${
        isDarkTheme
          ? 'bg-gradient-to-tr from-[#14151B] to-[#252836]'
          : 'bg-gradient-to-tr from-[#E2E4EB] to-[#F0F2F8]'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Dynamic Drag-and-drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#007AFF]/10 border-4 border-dashed border-[#007AFF] backdrop-blur-xs pointer-events-none rounded-2xl m-3">
          <UploadCloud className="w-16 h-16 text-[#007AFF] mb-3 animate-bounce" />
          <p className="text-lg font-bold text-[#007AFF]">Drop your tree.json here</p>
          <p className="text-xs text-[#007AFF]/80 mt-1">Release to import</p>
        </div>
      )}

      {/* Floating macOS application window container */}
      <div
        className={`h-full w-full max-w-[1600px] flex flex-col rounded-2xl overflow-hidden border relative animate-fade-in ${
          isDarkTheme
            ? 'apple-window-shadow bg-[#1E1E1F] border-white/5 text-neutral-200'
            : 'apple-window-shadow-light bg-white border-black/15 text-neutral-800'
        } ${getThemeClass()}`}
      >
        {/* OS Electron Title Bar Header */}
        <TitleBar 
          onShowShortcuts={() => setIsShortcutsOpen(true)}
          onShowExport={() => setIsExportOpen(true)}
          onToggleTheme={handleToggleTheme}
          currentTheme={uiConfig.theme}
          loadedCount={activeSourceIds.length}
        />

        {/* Import Progress Banner */}
        {importProgress && (
          <div className="h-8 shrink-0 bg-[#007AFF] flex items-center justify-between px-4 font-sans text-white z-40">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              <span className="text-xs font-medium">
                Parsing <span className="font-bold">"{importProgress.name}"</span>
                <span className="opacity-75 ml-1">({importProgress.sizeLabel})</span>
                <span className="opacity-75"> — this may take a moment for large trees…</span>
              </span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main Grid Workspace Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Control Sidebar */}
          <Sidebar 
            sources={sources}
            activeSourceIds={activeSourceIds}
            mergeMode={mergeMode}
            onAddSource={handleAddSource}
            onToggleSource={handleToggleSource}
            onDeleteSource={handleDeleteSource}
            onSetMergeMode={setMergeMode}
            onLoadPresets={handleLoadPresets}
            onClearAll={handleClearAll}
            isImporting={!!importProgress}
          />

          {/* Middle interactive Collapsible Tree Explorer */}
          {activeSourceIds.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-50/20 dark:bg-white/[0.01] font-sans select-none">
              <div className="p-4 rounded-full bg-black/5 dark:bg-white/5 mb-4 animate-bounce" style={{ animationDuration: '3s' }}>
                <FolderTree className="w-12 h-12 text-[#007AFF]" />
              </div>
              <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">No Directories Active</h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-sm mt-1.5 leading-relaxed">
                Import a JSON tree file or drag-and-drop it anywhere on this window to explore its folder indexes.
              </p>
              
              {/* Copyable command snippet */}
              <div className="mt-4 flex items-center gap-2 px-3.5 py-2 bg-black/5 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-xl font-mono text-[11px] text-[#007AFF] max-w-sm w-full">
                <Terminal className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="flex-1 text-left truncate text-neutral-600 dark:text-neutral-400">tree . --info -D -a -J -t -c -s -f &gt; tree.json</span>
                <button
                  onClick={() => { navigator.clipboard.writeText('tree . --info -D -a -J -t -c -s -f > tree.json'); showToast('success', 'Command copied!'); }}
                  className="text-neutral-400 hover:text-[#007AFF] transition-colors shrink-0 cursor-pointer"
                  title="Copy command"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2"/></svg>
                </button>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={handleLoadPresets}
                  className="px-4 py-2 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  Load Preset Projects
                </button>
                <button
                  onClick={() => document.getElementById('json-file-input')?.click()}
                  className="px-4 py-2 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Upload custom JSON
                </button>
              </div>
            </div>
          ) : (
            <TreeView 
              rootNodes={processedRootNodes}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              filters={filters}
              onSetFilters={setFilters}
              uiConfig={uiConfig}
              onUpdateUiConfig={(config) => setUiConfig(prev => ({ ...prev, ...config }))}
            />
          )}

          {/* Right Preview Quick Look Inspector */}
          <QuickLook 
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        </div>

        {/* Bottom Status Bar Info footer */}
        <div className="h-7 border-t border-black/5 dark:border-white/5 bg-neutral-50/50 dark:bg-[#1E1E1F]/50 select-none flex items-center justify-between px-3 shrink-0 text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-neutral-400" />
              <span>Theme: <span className="text-neutral-700 dark:text-neutral-300 font-semibold">{uiConfig.theme}</span></span>
            </span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">Active Trees: <span className="text-neutral-700 dark:text-[#a3a3a3] font-semibold">{activeSourceIds.length}</span></span>
            {processedRootNodes.length > 0 && (
              <>
                <span className="hidden sm:inline">|</span>
                <span className="hidden sm:inline text-[#007AFF] font-semibold">
                  {sources
                    .filter(s => activeSourceIds.includes(s.id))
                    .reduce((a, s) => a + (s.filesCount || 0) + (s.directoriesCount || 0), 0)
                    .toLocaleString()} nodes
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:inline">Press <span className="text-neutral-700 dark:text-neutral-300 font-semibold">?</span> for Keyboard Shortcuts</span>
            <span>Storage: <span className="text-[#34C759] font-semibold">Hybrid (LS + IDB)</span></span>
          </div>
        </div>
      </div>

      {/* Modal overlays */}
      <KeyboardShortcutsModal 
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <ExportModal 
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        rootNodes={processedRootNodes}
        projectName={sources.filter(s => activeSourceIds.includes(s.id)).map(s => s.name).join(' + ') || 'Workspace'}
      />

      {/* Toast Notification Stack */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none font-sans">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold pointer-events-auto transition-all animate-fade-in ${
              toast.type === 'success'
                ? 'bg-white dark:bg-[#2A2A2B] border-[#34C759]/20 text-[#34C759] shadow-black/5 dark:shadow-black/20'
                : 'bg-white dark:bg-[#2A2A2B] border-[#FF3B30]/20 text-[#FF3B30] shadow-black/5 dark:shadow-black/20'
            }`}
          >
            {toast.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0" />
              : <XCircle className="w-4 h-4 text-[#FF3B30] shrink-0" />
            }
            <span className="text-xs">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
