import React, { useState, useEffect } from 'react';
import { 
  File, 
  Folder, 
  MousePointerClick, 
  Check, 
  Tag, 
  PenTool, 
  Info,
  PieChart,
  Shield,
  Copy,
  ChevronRight
} from 'lucide-react';
import { TreeItem } from '../types';

interface QuickLookProps {
  node: TreeItem | null;
  onClose: () => void;
}

export default function QuickLook({ node, onClose }: QuickLookProps) {
  const [copied, setCopied] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Load custom note and tag for this node from localStorage
  useEffect(() => {
    if (node) {
      const savedNote = localStorage.getItem(`note-${node.id}`) || '';
      const savedTag = localStorage.getItem(`tag-${node.id}`) || null;
      setNoteText(savedNote);
      setActiveTag(savedTag);
    } else {
      setNoteText('');
      setActiveTag(null);
    }
  }, [node]);

  // Save Note Text
  const handleNoteSave = (text: string) => {
    setNoteText(text);
    if (node) {
      if (text.trim() === '') {
        localStorage.removeItem(`note-${node.id}`);
      } else {
        localStorage.setItem(`note-${node.id}`, text);
      }
      window.dispatchEvent(new CustomEvent('storage-note-updated'));
    }
  };

  // Toggle active Tag
  const handleTagToggle = (tag: string) => {
    if (!node) return;
    const nextTag = activeTag === tag ? null : tag;
    setActiveTag(nextTag);
    if (nextTag === null) {
      localStorage.removeItem(`tag-${node.id}`);
    } else {
      localStorage.setItem(`tag-${node.id}`, nextTag);
    }
    window.dispatchEvent(new CustomEvent('storage-note-updated'));
  };

  if (!node) {
    return (
      <div 
        className="w-80 border-l border-black/5 dark:border-white/5 bg-neutral-50/50 dark:bg-[#1E1E1F]/50 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 select-none font-sans shrink-0 z-30"
        id="quick-look-preview-pane"
      >
        <MousePointerClick className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mb-3 animate-pulse" />
        <h4 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
          Quick Look Inspector
        </h4>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-xs mt-2 leading-relaxed">
          Select any file or directory in the explorer tree to view full POSIX properties, tag review states, and add annotations.
        </p>
      </div>
    );
  }

  // Copy Path action
  const handleCopyPath = () => {
    navigator.clipboard.writeText(node.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Human bytes converter
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '—';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Parse Permissions string
  const permissions = node.prot || '---------';
  const gridPermissions = {
    owner: {
      r: permissions[1] === 'r',
      w: permissions[2] === 'w',
      x: permissions[3] === 'x' || permissions[3] === 's' || permissions[3] === 't',
    },
    group: {
      r: permissions[4] === 'r',
      w: permissions[5] === 'w',
      x: permissions[6] === 'x' || permissions[6] === 's' || permissions[6] === 't',
    },
    other: {
      r: permissions[7] === 'r',
      w: permissions[8] === 'w',
      x: permissions[9] === 'x' || permissions[9] === 's' || permissions[9] === 't',
    }
  };

  // macOS system colored tag pills
  const tagOptions = [
    { name: 'Critical', color: 'bg-[#FF3B30] text-white border-[#FF3B30]' },
    { name: 'Review', color: 'bg-[#FF9500] text-white border-[#FF9500]' },
    { name: 'Docs', color: 'bg-[#34C759] text-white border-[#34C759]' },
    { name: 'Clean', color: 'bg-[#007AFF] text-white border-[#007AFF]' }
  ];

  // Breadcrumbs generator
  const pathParts = (node.id || node.name || 'unknown').split('/');

  // Folder sub-stats
  const countDescendants = (item: TreeItem): { files: number; dirs: number; size: number } => {
    let files = 0;
    let dirs = 0;
    let size = item.size || 0;
    const stack = item.contents ? [...item.contents] : [];
    while (stack.length > 0) {
      const child = stack.pop()!;
      if (child.type === 'directory') {
        dirs++;
        size += child.size || 0;
        if (child.contents) stack.push(...child.contents);
      } else {
        files++;
        size += child.size || 0;
      }
    }
    return { files, dirs, size };
  };

  const isDirectory = node.type === 'directory';
  const folderStats = isDirectory ? countDescendants(node) : null;

  // Folder/File Icon with macOS tints
  const renderHeaderIcon = () => {
    const color = isDirectory ? 'text-[#007AFF] dark:text-[#0a84ff]' : 'text-neutral-500';
    return isDirectory 
      ? <Folder className={`w-10 h-10 ${color}`} /> 
      : <File className={`w-10 h-10 ${color}`} />;
  };

  return (
    <div 
      className="w-80 border-l border-black/5 dark:border-white/5 bg-neutral-50/50 dark:bg-[#1E1E1F]/50 backdrop-blur-md flex flex-col h-full overflow-y-auto select-none font-sans shrink-0 z-30"
      id="quick-look-preview-pane"
    >
      {/* Header title */}
      <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-black/2 dark:bg-white/2">
        <h4 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
          Quick Look Inspector
        </h4>
        <button 
          onClick={onClose}
          className="w-5 h-5 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors text-xs font-semibold"
        >
          ✕
        </button>
      </div>

      {/* Breadcrumbs path */}
      <div className="px-4 py-2.5 bg-black/3 dark:bg-black/20 border-b border-black/5 dark:border-white/5">
        <div className="flex flex-wrap items-center gap-1 text-[9px] font-mono text-neutral-400 dark:text-neutral-500 leading-normal">
          {pathParts.map((part, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-2.5 h-2.5 opacity-55" />}
              <span className={idx === pathParts.length - 1 ? 'text-neutral-800 dark:text-neutral-200 font-semibold' : 'truncate max-w-[80px]'}>
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="p-4 flex-1 space-y-4">
        {/* Row 1: File Icon & Primary Metrics */}
        <div className="flex items-center gap-3 bg-white dark:bg-[#2A2A2B] border border-black/5 dark:border-white/5 p-3 rounded-xl shadow-xs">
          <div className="shrink-0">
            {renderHeaderIcon()}
          </div>

          <div className="overflow-hidden flex-1">
            <h3 className="font-semibold text-xs text-neutral-800 dark:text-neutral-200 truncate select-all" title={node.name}>
              {node.name}
            </h3>
            <span className="inline-block px-1.5 py-0.5 text-[8px] font-semibold uppercase font-mono rounded bg-black/5 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 mt-1 border border-black/5">
              {node.type} {node.extension && node.extension !== 'directory' ? `• .${node.extension}` : ''}
            </span>
          </div>
        </div>

        {/* Copy path row */}
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-black/3 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl">
          <span className="text-[9px] font-mono text-neutral-400 dark:text-neutral-500 truncate select-all">
            {node.id}
          </span>
          <button
            onClick={handleCopyPath}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 text-neutral-400 hover:text-[#007AFF]"
            title="Copy full path"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#34C759]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Section 2: POSIX File Metadata Grid */}
        <div className="space-y-1.5">
          <h5 className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#007AFF]" />
            <span>METADATA PROPERTIES</span>
          </h5>

          <div className="bg-white dark:bg-[#2A2A2B] border border-black/5 dark:border-white/5 rounded-xl divide-y divide-black/5 dark:divide-white/5 text-xs font-sans overflow-hidden">
            {node.size !== undefined && (
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-neutral-400 dark:text-neutral-500 text-[10px] font-mono">FILE_SIZE</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {formatBytes(node.size)} <span className="text-[10px] font-normal text-neutral-400 font-mono">({node.size.toLocaleString()} B)</span>
                </span>
              </div>
            )}

            {node.mode && (
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-neutral-400 dark:text-neutral-500 text-[10px] font-mono">OCTAL_MODE</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{node.mode}</span>
              </div>
            )}

            {(node.user || node.uid !== undefined) && (
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-neutral-400 dark:text-neutral-500 text-[10px] font-mono">OWNER_UID</span>
                <span className="text-neutral-800 dark:text-neutral-200">
                  {node.user || 'uid'}:{node.uid ?? 1000}
                </span>
              </div>
            )}

            {(node.group || node.gid !== undefined) && (
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-neutral-400 dark:text-neutral-500 text-[10px] font-mono">GROUP_GID</span>
                <span className="text-neutral-800 dark:text-neutral-200">
                  {node.group || 'gid'}:{node.gid ?? 1000}
                </span>
              </div>
            )}

            {node.time && (
              <div className="flex justify-between items-center px-3 py-2">
                <span className="text-neutral-400 dark:text-neutral-500 text-[10px] font-mono">MOD_DATE</span>
                <span className="text-neutral-800 dark:text-neutral-200">{node.time}</span>
              </div>
            )}

            <div className="flex justify-between items-center px-3 py-2">
              <span className="text-neutral-400 dark:text-neutral-500 text-[10px] font-mono">PATH_DEPTH</span>
              <span className="text-neutral-800 dark:text-neutral-200 font-mono">{node.depth}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Folder sub-stats or Cumulative metrics */}
        {isDirectory && folderStats && (
          <div className="space-y-1.5">
            <h5 className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-[#007AFF]" />
              <span>DIRECTORY SUMMARY</span>
            </h5>
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-sans">
              <div className="bg-white dark:bg-[#2A2A2B] border border-black/5 dark:border-white/5 p-2 rounded-xl">
                <span className="text-[9px] text-neutral-400 block font-mono">SUB_DIRS</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 block mt-0.5">{folderStats.dirs}</span>
              </div>
              <div className="bg-white dark:bg-[#2A2A2B] border border-black/5 dark:border-white/5 p-2 rounded-xl">
                <span className="text-[9px] text-neutral-400 block font-mono">SUB_FILES</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 block mt-0.5">{folderStats.files}</span>
              </div>
              <div className="bg-white dark:bg-[#2A2A2B] border border-black/5 dark:border-white/5 px-3 py-2 rounded-xl col-span-2 flex justify-between items-center text-left">
                <span className="text-[9px] text-neutral-400 font-mono">CUMULATIVE_SIZE</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">{formatBytes(folderStats.size)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: POSIX Permission Checkbox Grid */}
        <div className="space-y-1.5">
          <h5 className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#007AFF]" />
            <span>POSIX PROTECTION GRID</span>
          </h5>

          <div className="border border-black/5 dark:border-white/5 rounded-xl bg-white dark:bg-[#2A2A2B] overflow-hidden">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-black/2 dark:bg-black/30 border-b border-black/5 dark:border-white/5 text-[9px] text-neutral-400 dark:text-neutral-500 font-bold">
                  <th className="py-2 px-3 text-left">ROLE</th>
                  <th className="py-2 px-2 font-mono">R</th>
                  <th className="py-2 px-2 font-mono">W</th>
                  <th className="py-2 px-2 font-mono">X</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 text-neutral-700 dark:text-neutral-300">
                {/* Owner row */}
                <tr>
                  <td className="py-1.5 px-3 text-left text-neutral-400 dark:text-neutral-500 text-[9px] font-mono">OWNER</td>
                  <td className="py-1.5 px-2">
                    <input type="checkbox" checked={gridPermissions.owner.r} disabled className="rounded text-[#007AFF] focus:ring-0 h-3 w-3 border-black/10 pointer-events-none" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="checkbox" checked={gridPermissions.owner.w} disabled className="rounded text-[#007AFF] focus:ring-0 h-3 w-3 border-black/10 pointer-events-none" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="checkbox" checked={gridPermissions.owner.x} disabled className="rounded text-[#007AFF] focus:ring-0 h-3 w-3 border-black/10 pointer-events-none" />
                  </td>
                </tr>
                {/* Group row */}
                <tr>
                  <td className="py-1.5 px-3 text-left text-neutral-400 dark:text-neutral-500 text-[9px] font-mono">GROUP</td>
                  <td className="py-1.5 px-2">
                    <input type="checkbox" checked={gridPermissions.group.r} disabled className="rounded text-[#007AFF] focus:ring-0 h-3 w-3 border-black/10 pointer-events-none" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="checkbox" checked={gridPermissions.group.w} disabled className="rounded text-[#007AFF] focus:ring-0 h-3 w-3 border-black/10 pointer-events-none" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="checkbox" checked={gridPermissions.group.x} disabled className="rounded text-[#007AFF] focus:ring-0 h-3 w-3 border-black/10 pointer-events-none" />
                  </td>
                </tr>
                {/* Other row */}
                <tr>
                  <td className="py-1.5 px-3 text-left text-neutral-400 dark:text-neutral-500 text-[9px] font-mono">OTHERS</td>
                  <td className="py-1.5 px-2">
                    <input type="checkbox" checked={gridPermissions.other.r} disabled className="rounded text-[#007AFF] focus:ring-0 h-3 w-3 border-black/10 pointer-events-none" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="checkbox" checked={gridPermissions.other.w} disabled className="rounded text-[#007AFF] focus:ring-0 h-3 w-3 border-black/10 pointer-events-none" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="checkbox" checked={gridPermissions.other.x} disabled className="rounded text-[#007AFF] focus:ring-0 h-3 w-3 border-black/10 pointer-events-none" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Annotations / Notes & Tags */}
        <div className="space-y-3 pt-1">
          <h5 className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#007AFF]" />
            <span>ANNOTATION FLAGS</span>
          </h5>

          {/* Quick Tags row */}
          <div className="space-y-1">
            <div className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {tagOptions.map((tag) => {
                const isTagged = activeTag === tag.name;
                return (
                  <button
                    key={tag.name}
                    onClick={() => handleTagToggle(tag.name)}
                    className={`px-2.5 py-1 text-[9px] font-semibold rounded-full border transition-all cursor-pointer ${
                      isTagged 
                        ? `${tag.color} scale-105 shadow-sm font-bold border-transparent`
                        : 'bg-white hover:bg-black/5 dark:bg-[#1E1E1F] border-black/10 dark:border-white/10 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Annotation Note */}
          <div className="space-y-1">
            <div className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase flex items-center justify-between">
              <span>Auto-saving Notes</span>
              <PenTool className="w-3 h-3 text-neutral-400" />
            </div>
            <textarea
              placeholder="Add description, notes, or flags for this path..."
              value={noteText}
              onChange={(e) => handleNoteSave(e.target.value)}
              className="w-full h-20 p-2 text-xs border border-black/10 dark:border-white/10 rounded-xl bg-white dark:bg-[#2A2A2B] text-neutral-800 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-[#007AFF] focus:border-[#007AFF] resize-none font-sans"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
