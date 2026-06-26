import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Layers, 
  Database, 
  Upload, 
  Eye,
  EyeOff,
  RefreshCw,
  FolderOpen,
  PieChart,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { TreeSource } from '../types';

// macOS inspired system color dots
const SOURCE_COLORS = [
  'bg-[#34C759]', // green
  'bg-[#007AFF]', // blue
  'bg-[#AF52DE]', // purple
  'bg-[#FF9500]', // orange
  'bg-[#FF3B30]', // red
  'bg-[#5AC8FA]', // cyan
  'bg-[#FF2D55]', // pink
  'bg-[#FFCC00]', // yellow
];

interface SidebarProps {
  sources: TreeSource[];
  activeSourceIds: string[];
  mergeMode: 'independent' | 'merged';
  onAddSource: (name: string, rawJsonOrFile: string | File) => void;
  onToggleSource: (id: string) => void;
  onDeleteSource: (id: string) => void;
  onSetMergeMode: (mode: 'independent' | 'merged') => void;
  onLoadPresets: () => void;
  onClearAll: () => void;
  isImporting?: boolean;
}

export default function Sidebar({
  sources,
  activeSourceIds,
  mergeMode,
  onAddSource,
  onToggleSource,
  onDeleteSource,
  onSetMergeMode,
  onLoadPresets,
  onClearAll,
  isImporting = false
}: SidebarProps) {
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteName, setPasteName] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [localImporting, setLocalImporting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importing = isImporting || localImporting;

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalImporting(true);
    try {
      const sourceName = file.name.replace(/\.json$/i, '');
      onAddSource(sourceName, file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      // Error handled by toast in App.tsx
    } finally {
      setTimeout(() => setLocalImporting(false), 300);
    }
  };

  // Paste Submitter
  const handlePasteSubmit = () => {
    if (!pasteName.trim()) {
      setPasteError('Please provide a name for this source.');
      return;
    }
    try {
      JSON.parse(pasteContent);
      setLocalImporting(true);
      onAddSource(pasteName.trim(), pasteContent);
      setPasteName('');
      setPasteContent('');
      setPasteError('');
      setShowPasteModal(false);
      setTimeout(() => setLocalImporting(false), 300);
    } catch (err: any) {
      setPasteError(`Invalid JSON structure: ${err.message}`);
    }
  };

  // Calculate aggregates
  const activeSources = sources.filter(s => activeSourceIds.includes(s.id));
  const totalDirs = activeSources.reduce((acc, s) => acc + s.directoriesCount, 0);
  const totalFiles = activeSources.reduce((acc, s) => acc + s.filesCount, 0);
  const totalBytes = activeSources.reduce((acc, s) => acc + s.totalSize, 0);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Collapsed sidebar: icon-only strip (Apple Style)
  if (collapsed) {
    return (
      <div className="w-12 border-r border-black/5 dark:border-white/5 bg-neutral-50/50 dark:bg-[#1E1E1F]/50 backdrop-blur-md flex flex-col items-center py-4 gap-4 shrink-0 z-30">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-lg text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <div className="w-6 h-[1px] bg-black/5 dark:bg-white/5" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="p-2 rounded-lg text-[#007AFF] hover:bg-[#007AFF]/10 transition-colors disabled:opacity-50"
          title="Upload JSON"
        >
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setShowPasteModal(true)}
          className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Paste JSON"
        >
          <Plus className="w-4 h-4" />
        </button>
        {sources.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {sources.map((s, i) => {
              const color = SOURCE_COLORS[i % SOURCE_COLORS.length];
              const isActive = activeSourceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => onToggleSource(s.id)}
                  className={`w-3 h-3 rounded-full ${color} transition-all ring-offset-2 dark:ring-offset-[#1E1E1F] ${
                    isActive ? 'ring-2 ring-[#007AFF] scale-110' : 'opacity-40 hover:opacity-80'
                  }`}
                  title={s.name}
                />
              );
            })}
          </div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" id="json-file-input" />
        
        {/* Paste Modal shown when collapsed */}
        {showPasteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white/95 dark:bg-[#2A2A2B]/95 border border-black/10 dark:border-white/10 rounded-2xl max-w-lg w-full flex flex-col overflow-hidden shadow-2xl font-sans backdrop-blur-xl">
              <div className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-black/2 dark:bg-white/2">
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Paste JSON Tree Data</h4>
                <button onClick={() => setShowPasteModal(false)} className="text-neutral-400 hover:text-neutral-600 transition-colors text-xs font-normal">Cancel</button>
              </div>
              <div className="p-4 space-y-3">
                <input type="text" placeholder="Workspace Name" value={pasteName} onChange={e => setPasteName(e.target.value)} className="w-full px-3 py-1.5 border border-black/10 dark:border-white/10 rounded-lg bg-white dark:bg-[#1E1E1F] text-xs text-neutral-800 dark:text-neutral-200 outline-none focus:ring-1 focus:ring-[#007AFF] transition-all" />
                <textarea placeholder="Paste JSON output here..." value={pasteContent} onChange={e => setPasteContent(e.target.value)} className="w-full min-h-[140px] p-2.5 font-mono text-[10px] border border-black/10 dark:border-white/10 rounded-lg bg-neutral-50 dark:bg-[#151516] text-neutral-800 dark:text-neutral-200 outline-none resize-none focus:ring-1 focus:ring-[#007AFF] transition-all" />
                {pasteError && <div className="text-[10px] text-[#FF3B30] bg-[#FF3B30]/10 border border-[#FF3B30]/20 px-2 py-1 rounded">{pasteError}</div>}
              </div>
              <div className="p-3 border-t border-black/5 dark:border-white/5 flex justify-end gap-2 bg-black/2 dark:bg-white/2">
                <button onClick={() => setShowPasteModal(false)} className="px-3 py-1.5 bg-black/5 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs hover:bg-black/10 dark:hover:bg-white/10 transition-colors">Cancel</button>
                <button onClick={handlePasteSubmit} className="px-3 py-1.5 bg-[#007AFF] text-white rounded-lg text-xs font-medium hover:bg-[#0062CC] transition-colors">Import Tree</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className="w-80 border-r border-black/5 dark:border-white/5 bg-neutral-50/50 dark:bg-[#1E1E1F]/50 backdrop-blur-md flex flex-col h-full shrink-0 overflow-y-auto select-none font-sans z-30"
      id="sidebar-panel"
    >
      {/* Import & Actions Panel */}
      <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#007AFF]" />
            <span>TREE DATA SOURCES</span>
          </h3>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-md text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              importing
                ? 'bg-neutral-300 text-white cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-600'
                : 'bg-[#007AFF] text-white cursor-pointer hover:bg-[#0062CC]'
            }`}
          >
            {importing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>{importing ? 'Importing...' : 'Upload JSON'}</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
            id="json-file-input"
          />

          {/* Paste JSON Button */}
          <button
            onClick={() => setShowPasteModal(true)}
            disabled={importing}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium transition-all ${
              importing
                ? 'bg-neutral-100 dark:bg-[#1E1E1F] text-neutral-400 border-black/5 dark:border-white/5 cursor-not-allowed'
                : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-800 dark:text-neutral-200 border-black/5 dark:border-white/5'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Paste Raw</span>
          </button>
        </div>

        {/* Preset Loaders */}
        {sources.length === 0 && (
          <div className="bg-[#007AFF]/5 border border-[#007AFF]/15 rounded-xl p-3 text-xs text-neutral-700 dark:text-neutral-300 space-y-2.5">
            <p className="font-semibold text-[#007AFF]">Get Started with Demo Presets</p>
            <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">No directory trees loaded yet. Import your own or click below to load demo scans of common templates.</p>
            <button
              onClick={onLoadPresets}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Load 3 Demo Trees</span>
            </button>
          </div>
        )}
      </div>

      {/* Multiple Tree Sources List */}
      <div className="p-4 border-b border-black/5 dark:border-white/5 flex-1 min-h-[200px] flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
            LOADED TREE INDEXES
          </h3>
          {sources.length > 0 && (
            <button 
              onClick={onClearAll}
              className="text-[10px] text-[#FF3B30] hover:underline flex items-center gap-0.5 font-medium"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {sources.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-black/10 dark:border-white/10 rounded-xl bg-black/[0.01] dark:bg-white/[0.01]">
            <FolderOpen className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mb-2" />
            <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">No trees available</p>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-1 leading-normal max-w-[160px]">Upload a .json tree file or drag-and-drop it anywhere</p>
          </div>
        ) : (
          <div className="space-y-1 overflow-y-auto max-h-[350px] pr-1">
            {sources.map((source, srcIndex) => {
              const isActive = activeSourceIds.includes(source.id);
              const colorDot = SOURCE_COLORS[srcIndex % SOURCE_COLORS.length];
              return (
                <div 
                  key={source.id}
                  className={`group relative px-3 py-2 rounded-lg border transition-all ${
                    isActive 
                      ? 'bg-white dark:bg-[#2A2A2B] border-black/5 dark:border-white/5 shadow-sm font-medium' 
                      : 'bg-transparent border-transparent opacity-65 hover:opacity-90 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => onToggleSource(source.id)}
                      className="flex-1 flex items-center gap-2 text-left select-none outline-none overflow-hidden"
                    >
                      {/* Apple-style color indicator dot */}
                      <span className={`w-2 h-2 rounded-full ${colorDot} shrink-0`} />
                      <div className="flex-1 overflow-hidden">
                        <div className="text-xs text-neutral-800 dark:text-neutral-200 truncate">
                          {source.name}
                        </div>
                        <div className="text-[9px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5 font-light truncate">
                          {source.filesCount.toLocaleString()} files • {formatBytes(source.totalSize)}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                      {/* Active Toggle Eye */}
                      <button
                        onClick={() => onToggleSource(source.id)}
                        className={`p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                          isActive ? 'text-[#007AFF]' : 'text-neutral-400'
                        }`}
                        title={isActive ? 'Deactivate' : 'Activate'}
                      >
                        {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => onDeleteSource(source.id)}
                        className="p-1 rounded text-neutral-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Combination & Grouping Settings */}
      <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-3.5 shrink-0">
        <h3 className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#007AFF]" />
          <span>GROUPING & MERGING</span>
        </h3>

        <div className="space-y-2">
          {/* macOS Style Segmented Controller */}
          <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-black/5 dark:bg-black/30 rounded-lg border border-black/5 dark:border-white/5">
            <button
              onClick={() => onSetMergeMode('independent')}
              className={`py-1 px-1.5 text-[10px] font-medium rounded-md transition-all text-center cursor-pointer ${
                mergeMode === 'independent'
                  ? 'bg-white dark:bg-[#323233] text-neutral-800 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
              }`}
              title="Keep each JSON tree as its own independent root directory structure"
            >
              Independent
            </button>
            <button
              onClick={() => onSetMergeMode('merged')}
              className={`py-1 px-1.5 text-[10px] font-medium rounded-md transition-all text-center cursor-pointer ${
                mergeMode === 'merged'
                  ? 'bg-white dark:bg-[#323233] text-neutral-800 dark:text-white shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
              }`}
              title="Merge multiple trees together. Matching path folders are unified into a single logical view"
            >
              Logical Merge
            </button>
          </div>

          <p className="text-[9px] text-neutral-400 dark:text-neutral-500 leading-normal font-light">
            {mergeMode === 'independent'
              ? 'Displays multiple trees side-by-side as separate directories.'
              : 'Combines directories matching paths (like "./src") into a single unified root.'}
          </p>
        </div>
      </div>

      {/* Aggregate Statistics Panel */}
      <div className="p-4 space-y-3 shrink-0">
        <h3 className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
          <PieChart className="w-3.5 h-3.5 text-[#007AFF]" />
          <span>WORKSPACE STATS</span>
        </h3>

        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-black/3 dark:bg-white/2 border border-black/5 dark:border-white/5 p-2 rounded-lg">
            <div className="text-[8px] text-neutral-400 dark:text-neutral-500 font-semibold uppercase tracking-wider">Dirs</div>
            <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5">{totalDirs.toLocaleString()}</div>
          </div>
          <div className="bg-black/3 dark:bg-white/2 border border-black/5 dark:border-white/5 p-2 rounded-lg">
            <div className="text-[8px] text-neutral-400 dark:text-neutral-500 font-semibold uppercase tracking-wider">Files</div>
            <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5">{totalFiles.toLocaleString()}</div>
          </div>
          <div className="bg-black/3 dark:bg-white/2 border border-black/5 dark:border-white/5 p-2 rounded-lg col-span-1">
            <div className="text-[8px] text-neutral-400 dark:text-neutral-500 font-semibold uppercase tracking-wider">Size</div>
            <div className="text-[10px] font-semibold text-neutral-800 dark:text-neutral-200 mt-1 select-all">{formatBytes(totalBytes)}</div>
          </div>
        </div>
      </div>

      {/* Paste Modal Popover (macOS Sheet-style) */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white/95 dark:bg-[#2A2A2B]/95 border border-black/10 dark:border-white/10 rounded-2xl max-w-lg w-full flex flex-col overflow-hidden shadow-2xl font-sans backdrop-blur-xl">
            <div className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-black/2 dark:bg-white/2">
              <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest">Paste JSON Tree Data</h4>
              <button 
                onClick={() => setShowPasteModal(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors text-xs font-normal"
              >
                Cancel
              </button>
            </div>
            
            <div className="p-4 space-y-4 flex-1 flex flex-col">
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Workspace Name</label>
                <input
                  type="text"
                  placeholder="e.g. Production Scan"
                  value={pasteName}
                  onChange={(e) => setPasteName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-black/10 dark:border-white/10 rounded-lg bg-white dark:bg-[#1E1E1F] text-xs text-neutral-800 dark:text-neutral-200 outline-none focus:ring-1 focus:ring-[#007AFF] transition-all"
                />
              </div>

              <div className="space-y-1 flex-1 flex flex-col">
                <label className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">JSON Content</label>
                <textarea
                  placeholder='Paste array or object matching the tree scan...'
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  className="w-full flex-1 min-h-[160px] p-2.5 font-mono text-[10px] border border-black/10 dark:border-white/10 rounded-lg bg-neutral-50 dark:bg-[#151516] text-neutral-800 dark:text-neutral-200 outline-none focus:ring-1 focus:ring-[#007AFF] transition-all resize-none"
                />
              </div>

              {pasteError && (
                <div className="text-[10px] text-[#FF3B30] bg-[#FF3B30]/10 border border-[#FF3B30]/20 px-2.5 py-2 rounded-lg font-mono leading-normal">
                  {pasteError}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-black/5 dark:border-white/5 bg-black/2 dark:bg-white/2 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-3 py-1.5 bg-black/5 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteSubmit}
                className="px-3 py-1.5 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                Import Tree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
