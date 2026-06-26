import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Folder, 
  FolderOpen, 
  File, 
  FileCode, 
  FileText, 
  FileJson, 
  FileArchive, 
  FileImage,
  Terminal,
  ChevronRight,
  Search,
  Settings2,
  Copy,
  Check,
  X
} from 'lucide-react';
import { TreeItem, SearchFilters, UIConfig } from '../types';

interface TreeViewProps {
  rootNodes: TreeItem[];
  selectedNode: TreeItem | null;
  onSelectNode: (node: TreeItem) => void;
  filters: SearchFilters;
  onSetFilters: (filters: SearchFilters) => void;
  uiConfig: UIConfig;
  onUpdateUiConfig: (config: Partial<UIConfig>) => void;
}

// Row heights for each density setting (used for virtualization)
const DENSITY_ROW_HEIGHTS: Record<UIConfig['density'], number> = {
  compact: 24,
  comfortable: 32,
  spacious: 40,
};

const OVERSCAN_COUNT = 15; // Extra rows rendered above/below viewport

export default function TreeView({
  rootNodes,
  selectedNode,
  onSelectNode,
  filters,
  onSetFilters,
  uiConfig,
  onUpdateUiConfig
}: TreeViewProps) {
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [showAdvanceFilters, setShowAdvanceFilters] = useState(false);
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search query — the actual query used for tree filtering
  const [debouncedQuery, setDebouncedQuery] = useState(filters.query);

  // Virtualization scroll state
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const rowHeight = DENSITY_ROW_HEIGHTS[uiConfig.density];

  // Debounce the search query (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(filters.query);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.query]);

  // Track container height via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(container);
    setContainerHeight(container.clientHeight);

    return () => observer.disconnect();
  }, []);

  // Handle scroll events for virtualization
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  // Auto expand-all / collapse-all events from custom global events (TitleBar menu actions)
  useEffect(() => {
    const handleExpandAll = () => {
      // ITERATIVE: collect all directory IDs
      const allDirs = new Set<string>();
      const stack = [...rootNodes];

      while (stack.length > 0) {
        const n = stack.pop()!;
        if (n.type === 'directory') {
          allDirs.add(n.id);
          if (n.contents) {
            for (let i = 0; i < n.contents.length; i++) {
              stack.push(n.contents[i]);
            }
          }
        }
      }

      // Guard: warn if the tree is very large
      if (allDirs.size > 50000) {
        const proceed = window.confirm(
          `This tree has ${allDirs.size.toLocaleString()} directories. Expanding all may cause slowness. Continue?`
        );
        if (!proceed) return;
      }

      setExpandedNodeIds(allDirs);
    };

    const handleCollapseAll = () => {
      setExpandedNodeIds(new Set());
    };

    window.addEventListener('tree-expand-all', handleExpandAll);
    window.addEventListener('tree-collapse-all', handleCollapseAll);

    return () => {
      window.removeEventListener('tree-expand-all', handleExpandAll);
      window.removeEventListener('tree-collapse-all', handleCollapseAll);
    };
  }, [rootNodes]);

  // Initial Expansion of first layer
  useEffect(() => {
    if (rootNodes.length > 0 && expandedNodeIds.size === 0) {
      const initial = new Set<string>();
      rootNodes.forEach(node => {
        if (node.type === 'directory') {
          initial.add(node.id);
          // Auto expand to defined depth
          if (uiConfig.autoExpandDepth > 1 && node.contents) {
            node.contents.forEach(child => {
              if (child.type === 'directory') initial.add(child.id);
            });
          }
        }
      });
      setExpandedNodeIds(initial);
    }
  }, [rootNodes, uiConfig.autoExpandDepth]);

  // Helper to check if a single node matches the basic filters
  const matchesNode = useCallback((node: TreeItem): boolean => {
    // 1. Text Query search (fuzzy, regex, or case-sensitive)
    if (debouncedQuery) {
      const nodeName = node.name;
      let matchesQuery = false;
      
      if (filters.useRegex) {
        try {
          const regex = new RegExp(debouncedQuery, filters.caseSensitive ? '' : 'i');
          matchesQuery = regex.test(nodeName);
        } catch {
          // Invalid regex fallback
          matchesQuery = filters.caseSensitive 
            ? nodeName.includes(debouncedQuery)
            : nodeName.toLowerCase().includes(debouncedQuery.toLowerCase());
        }
      } else {
        matchesQuery = filters.caseSensitive 
          ? nodeName.includes(debouncedQuery)
          : nodeName.toLowerCase().includes(debouncedQuery.toLowerCase());
      }
      
      if (!matchesQuery) return false;
    }

    // 2. Node Type Filter
    if (filters.type === 'files' && node.type === 'directory') return false;
    if (filters.type === 'directories' && node.type !== 'directory') return false;

    // 3. Size Filter
    if (filters.sizeMin !== null && (node.size === undefined || node.size < filters.sizeMin)) return false;
    if (filters.sizeMax !== null && (node.size === undefined || node.size > filters.sizeMax)) return false;

    // 4. Extension Filter
    if (filters.extension && filters.extension !== 'all') {
      if (node.type === 'directory') return false;
      if (node.extension?.toLowerCase() !== filters.extension.toLowerCase()) return false;
    }

    // 5. Date filter
    if (filters.dateStart || filters.dateEnd) {
      if (!node.time) return false;
      const nodeTimeStr = node.time.toLowerCase();
      if (filters.dateStart && !nodeTimeStr.includes(filters.dateStart.toLowerCase())) return false;
      if (filters.dateEnd && !nodeTimeStr.includes(filters.dateEnd.toLowerCase())) return false;
    }

    return true;
  }, [debouncedQuery, filters.caseSensitive, filters.useRegex, filters.type, filters.sizeMin, filters.sizeMax, filters.extension, filters.dateStart, filters.dateEnd]);

  // ITERATIVE matching state computation (determines whether a node should be shown)
  const matchingState = useMemo(() => {
    const states: { [id: string]: { matches: boolean; hasMatchingChild: boolean } } = {};

    // Post-order iterative traversal using two stacks
    const stack1: TreeItem[] = [];
    const stack2: TreeItem[] = [];

    // Push all root nodes
    for (let i = rootNodes.length - 1; i >= 0; i--) {
      stack1.push(rootNodes[i]);
    }

    // First pass: build post-order sequence
    while (stack1.length > 0) {
      const node = stack1.pop()!;
      stack2.push(node);
      if (node.contents) {
        for (let i = 0; i < node.contents.length; i++) {
          stack1.push(node.contents[i]);
        }
      }
    }

    // Second pass: process in post-order
    while (stack2.length > 0) {
      const node = stack2.pop()!;
      const isSelfMatch = matchesNode(node);
      let childMatches = false;

      if (node.contents) {
        for (let i = 0; i < node.contents.length; i++) {
          const childState = states[node.contents[i].id];
          if (childState && (childState.matches || childState.hasMatchingChild)) {
            childMatches = true;
            break;
          }
        }
      }

      states[node.id] = { matches: isSelfMatch, hasMatchingChild: childMatches };
    }

    return states;
  }, [rootNodes, matchesNode]);

  // Expand matching nodes when a query is entered
  useEffect(() => {
    if (debouncedQuery && Object.keys(matchingState).length > 0) {
      const toExpand = new Set(expandedNodeIds);
      const ids = Object.keys(matchingState);
      for (let i = 0; i < ids.length; i++) {
        const state = matchingState[ids[i]];
        if (state && state.hasMatchingChild) {
          toExpand.add(ids[i]);
        }
      }
      setExpandedNodeIds(toExpand);
    }
  }, [debouncedQuery, matchingState]);

  // ITERATIVE: Construct flat list of VISIBLE items for rendering and keyboard navigation
  const visibleFlatNodes = useMemo(() => {
    const list: { node: TreeItem; depth: number; isExpanded: boolean; matches: boolean }[] = [];
    const hasQueryActive = !!debouncedQuery;

    // Stack-based DFS traversal
    const stack: { node: TreeItem; depth: number }[] = [];
    for (let i = rootNodes.length - 1; i >= 0; i--) {
      stack.push({ node: rootNodes[i], depth: 0 });
    }

    while (stack.length > 0) {
      const { node, depth } = stack.pop()!;
      const state = matchingState[node.id] || { matches: true, hasMatchingChild: false };

      if (hasQueryActive && !state.matches && !state.hasMatchingChild) {
        continue;
      }

      const isExpanded = expandedNodeIds.has(node.id);
      list.push({ node, depth, isExpanded, matches: state.matches });

      if (node.type === 'directory' && isExpanded && node.contents) {
        for (let i = node.contents.length - 1; i >= 0; i--) {
          stack.push({ node: node.contents[i], depth: depth + 1 });
        }
      }
    }

    return list;
  }, [rootNodes, expandedNodeIds, matchingState, debouncedQuery]);

  // Sink selected node highlights into index
  useEffect(() => {
    if (selectedNode) {
      const idx = visibleFlatNodes.findIndex(item => item.node.id === selectedNode.id);
      if (idx !== -1) {
        setHighlightedIndex(idx);
      }
    } else {
      setHighlightedIndex(-1);
    }
  }, [selectedNode, visibleFlatNodes]);

  // Handle Keyboard Shortcuts for tree
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.getAttribute('contenteditable') === 'true'
      )) {
        if (e.key === 'Escape') {
          (activeElement as HTMLElement).blur();
        }
        return;
      }

      if (visibleFlatNodes.length === 0) return;

      let nextIndex = highlightedIndex;

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          nextIndex = highlightedIndex < visibleFlatNodes.length - 1 ? highlightedIndex + 1 : 0;
          setHighlightedIndex(nextIndex);
          onSelectNode(visibleFlatNodes[nextIndex].node);
          break;

        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          nextIndex = highlightedIndex > 0 ? highlightedIndex - 1 : visibleFlatNodes.length - 1;
          setHighlightedIndex(nextIndex);
          onSelectNode(visibleFlatNodes[nextIndex].node);
          break;

        case 'ArrowRight':
        case 'l': {
          e.preventDefault();
          if (highlightedIndex === -1) break;
          const { node, isExpanded } = visibleFlatNodes[highlightedIndex];
          if (node.type === 'directory') {
            if (!isExpanded) {
              const newExpanded = new Set(expandedNodeIds);
              newExpanded.add(node.id);
              setExpandedNodeIds(newExpanded);
            } else if (node.contents && node.contents.length > 0) {
              setHighlightedIndex(highlightedIndex + 1);
              onSelectNode(visibleFlatNodes[highlightedIndex + 1].node);
            }
          }
          break;
        }

        case 'ArrowLeft':
        case 'h': {
          e.preventDefault();
          if (highlightedIndex === -1) break;
          const { node, isExpanded, depth } = visibleFlatNodes[highlightedIndex];
          
          if (node.type === 'directory' && isExpanded) {
            const newExpanded = new Set(expandedNodeIds);
            newExpanded.delete(node.id);
            setExpandedNodeIds(newExpanded);
          } else if (depth > 0) {
            const parentPath = node.parentPath;
            if (parentPath) {
              const parentIdx = visibleFlatNodes.findIndex(item => item.node.id === parentPath);
              if (parentIdx !== -1) {
                setHighlightedIndex(parentIdx);
                onSelectNode(visibleFlatNodes[parentIdx].node);
              }
            }
          }
          break;
        }

        case 'Space':
        case ' ':
          e.preventDefault();
          if (highlightedIndex !== -1) {
            onSelectNode(visibleFlatNodes[highlightedIndex].node);
            const quickLookPane = document.getElementById('quick-look-preview-pane');
            quickLookPane?.focus();
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (highlightedIndex !== -1) {
            const { node, isExpanded } = visibleFlatNodes[highlightedIndex];
            if (node.type === 'directory') {
              const newExpanded = new Set(expandedNodeIds);
              if (isExpanded) {
                newExpanded.delete(node.id);
              } else {
                newExpanded.add(node.id);
              }
              setExpandedNodeIds(newExpanded);
            } else {
              onSelectNode(node);
            }
          }
          break;

        case 'e':
        case 'E':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('tree-expand-all'));
          break;

        case 'c':
        case 'C':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('tree-collapse-all'));
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visibleFlatNodes, highlightedIndex, expandedNodeIds, onSelectNode]);

  // Scroll active item into view
  useEffect(() => {
    if (highlightedIndex !== -1 && containerRef.current) {
      const container = containerRef.current;
      const itemTop = highlightedIndex * rowHeight;
      const itemBottom = itemTop + rowHeight;

      if (itemTop < container.scrollTop) {
        container.scrollTop = itemTop;
      } else if (itemBottom > container.scrollTop + container.clientHeight) {
        container.scrollTop = itemBottom - container.clientHeight;
      }
    }
  }, [highlightedIndex, rowHeight]);

  // Toggle single directory expansion
  const toggleNodeExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedNodeIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodeIds(newExpanded);
  };

  // Icon Resolver - supports macOS styling and selected-white override
  const getFileIcon = (node: TreeItem, isSelected: boolean) => {
    if (node.type === 'directory') {
      const isExpanded = expandedNodeIds.has(node.id);
      const color = isSelected ? 'text-white' : 'text-[#007AFF] dark:text-[#0a84ff]';
      return isExpanded 
        ? <FolderOpen className={`w-4 h-4 ${color} shrink-0`} />
        : <Folder className={`w-4 h-4 ${color} shrink-0`} />;
    }

    const ext = node.extension?.toLowerCase();
    const color = isSelected ? 'text-white/90' : '';
    switch (ext) {
      case 'json':
        return <FileJson className={`w-4 h-4 ${color || 'text-[#FF9500] dark:text-[#ff9f0a]'} shrink-0`} />;
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return <FileCode className={`w-4 h-4 ${color || 'text-[#007AFF] dark:text-[#0a84ff]'} shrink-0`} />;
      case 'md':
      case 'txt':
      case 'pdf':
        return <FileText className={`w-4 h-4 ${color || 'text-neutral-400 dark:text-neutral-500'} shrink-0`} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return <FileImage className={`w-4 h-4 ${color || 'text-[#AF52DE] dark:text-[#bf5af2]'} shrink-0`} />;
      case 'zip':
      case 'tar':
      case 'gz':
      case 'rar':
        return <FileArchive className={`w-4 h-4 ${color || 'text-[#34C759] dark:text-[#30d158]'} shrink-0`} />;
      case 'sh':
      case 'bash':
        return <Terminal className={`w-4 h-4 ${color || 'text-[#FF3B30] dark:text-[#ff453a]'} shrink-0`} />;
      default:
        return <File className={`w-4 h-4 ${color || 'text-neutral-400 dark:text-neutral-500'} shrink-0`} />;
    }
  };

  // Helper formatting size bytes
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '—';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // ITERATIVE: Extract all distinct extensions available in the dataset
  const allExtensions = useMemo(() => {
    const exts = new Set<string>();
    const stack = [...rootNodes];
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n.type !== 'directory' && n.extension) {
        exts.add(n.extension.toLowerCase());
      }
      if (n.contents) {
        for (let i = 0; i < n.contents.length; i++) {
          stack.push(n.contents[i]);
        }
      }
    }
    return Array.from(exts).sort();
  }, [rootNodes]);

  // --- Virtualization calculations ---
  const totalRows = visibleFlatNodes.length;
  const totalHeight = totalRows * rowHeight;

  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_COUNT);
  const visibleCount = Math.ceil(containerHeight / rowHeight) + 2 * OVERSCAN_COUNT;
  const endIndex = Math.min(totalRows - 1, startIndex + visibleCount);

  const visibleSlice = visibleFlatNodes.slice(startIndex, endIndex + 1);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#1E1E1F] font-sans">
      {/* Search Header and Action Bar */}
      <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-3 shrink-0 bg-neutral-50/30 dark:bg-white/[0.02]">
        <div className="flex items-center gap-2">
          {/* Main search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
            <input
              id="tree-search-input"
              type="text"
              placeholder="Search files and folders... (Press '/' to focus)"
              value={filters.query}
              onChange={(e) => onSetFilters({ ...filters, query: e.target.value })}
              className="w-full pl-9 pr-8 py-1.5 border border-black/10 dark:border-white/10 rounded-lg bg-black/3 dark:bg-black/30 text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:ring-1 focus:ring-[#007AFF] focus:border-[#007AFF] transition-all font-sans"
            />
            {filters.query && (
              <button
                onClick={() => onSetFilters({ ...filters, query: '' })}
                className="absolute right-3 top-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Advance Filters Button */}
          <button
            onClick={() => setShowAdvanceFilters(!showAdvanceFilters)}
            className={`p-1.5 rounded-lg border transition-all flex items-center justify-center gap-1 text-xs font-semibold cursor-pointer ${
              showAdvanceFilters || filters.type !== 'all' || filters.sizeMin !== null || filters.sizeMax !== null || filters.extension !== 'all'
                ? 'bg-[#007AFF]/10 border-[#007AFF]/25 text-[#007AFF] dark:text-[#0a84ff]'
                : 'bg-black/5 border-black/5 text-neutral-600 hover:bg-black/10 dark:bg-white/5 dark:border-white/5 dark:text-neutral-400 dark:hover:bg-white/10'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>

        {/* Active Filter Chips */}
        {(filters.type !== 'all' || filters.extension !== 'all' || filters.sizeMin !== null || filters.sizeMax !== null || filters.caseSensitive || filters.useRegex) && (
          <div className="flex flex-wrap gap-1.5">
            {filters.type !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#007AFF]/10 border border-[#007AFF]/15 text-[#007AFF] text-[9px] font-semibold rounded-full">
                {filters.type === 'files' ? 'Files only' : 'Dirs only'}
                <button onClick={() => onSetFilters({ ...filters, type: 'all' })} className="hover:opacity-75"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.extension !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#AF52DE]/10 border border-[#AF52DE]/15 text-[#AF52DE] text-[9px] font-semibold rounded-full">
                .{filters.extension}
                <button onClick={() => onSetFilters({ ...filters, extension: 'all' })} className="hover:opacity-75"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.sizeMin !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FF9500]/10 border border-[#FF9500]/15 text-[#FF9500] text-[9px] font-semibold rounded-full">
                ≥{filters.sizeMin.toLocaleString()} B
                <button onClick={() => onSetFilters({ ...filters, sizeMin: null })} className="hover:opacity-75"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.sizeMax !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#FF9500]/10 border border-[#FF9500]/15 text-[#FF9500] text-[9px] font-semibold rounded-full">
                ≤{filters.sizeMax.toLocaleString()} B
                <button onClick={() => onSetFilters({ ...filters, sizeMax: null })} className="hover:opacity-75"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.caseSensitive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 text-[9px] font-semibold rounded-full">
                Case sensitive
                <button onClick={() => onSetFilters({ ...filters, caseSensitive: false })} className="hover:opacity-75"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
            {filters.useRegex && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-neutral-700 dark:text-neutral-300 text-[9px] font-semibold rounded-full">
                Regex
                <button onClick={() => onSetFilters({ ...filters, useRegex: false })} className="hover:opacity-75"><X className="w-2.5 h-2.5" /></button>
              </span>
            )}
          </div>
        )}

        {/* Expanded filter drawer */}
        {showAdvanceFilters && (
          <div className="p-3 bg-black/[0.02] dark:bg-white/[0.01] border border-black/5 dark:border-white/5 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3 animate-slide-down">
            {/* Filter Type */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Node Type</label>
              <select
                value={filters.type}
                onChange={(e) => onSetFilters({ ...filters, type: e.target.value as any })}
                className="w-full px-2 py-1 border border-black/10 dark:border-white/10 rounded-md bg-white dark:bg-[#1E1E1F] text-xs text-neutral-700 dark:text-neutral-300 outline-none"
              >
                <option value="all">All Items</option>
                <option value="files">Files Only</option>
                <option value="directories">Directories Only</option>
              </select>
            </div>

            {/* Match Rules */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Search Flags</label>
              <div className="flex gap-3 pt-1">
                <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filters.caseSensitive}
                    onChange={(e) => onSetFilters({ ...filters, caseSensitive: e.target.checked })}
                    className="rounded border-black/10 text-[#007AFF] focus:ring-[#007AFF] h-3.5 w-3.5 cursor-pointer"
                  />
                  <span>Match Case</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filters.useRegex}
                    onChange={(e) => onSetFilters({ ...filters, useRegex: e.target.checked })}
                    className="rounded border-black/10 text-[#007AFF] focus:ring-[#007AFF] h-3.5 w-3.5 cursor-pointer"
                  />
                  <span>Regex</span>
                </label>
              </div>
            </div>

            {/* Size Filters */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">File Size</label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  placeholder="Min bytes"
                  value={filters.sizeMin || ''}
                  onChange={(e) => onSetFilters({ ...filters, sizeMin: e.target.value ? Number(e.target.value) : null })}
                  className="px-2 py-1 border border-black/10 dark:border-white/10 rounded-md bg-white dark:bg-[#1E1E1F] text-xs text-neutral-700 dark:text-neutral-300 outline-none"
                />
                <input
                  type="number"
                  placeholder="Max bytes"
                  value={filters.sizeMax || ''}
                  onChange={(e) => onSetFilters({ ...filters, sizeMax: e.target.value ? Number(e.target.value) : null })}
                  className="px-2 py-1 border border-black/10 dark:border-white/10 rounded-md bg-white dark:bg-[#1E1E1F] text-xs text-neutral-700 dark:text-neutral-300 outline-none"
                />
              </div>
            </div>

            {/* Extensions Filter */}
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Extensions</label>
              <select
                value={filters.extension}
                onChange={(e) => onSetFilters({ ...filters, extension: e.target.value })}
                className="w-full px-2 py-1 border border-black/10 dark:border-white/10 rounded-md bg-white dark:bg-[#1E1E1F] text-xs text-neutral-700 dark:text-neutral-300 outline-none"
              >
                <option value="all">All Extensions</option>
                {allExtensions.map(ext => (
                  <option key={ext} value={ext}>.{ext}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Quick formatting settings */}
        <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 select-none">
          <div className="flex items-center gap-3">
            <span>Density:</span>
            {/* macOS Segment Control */}
            <div className="flex gap-0.5 bg-black/5 dark:bg-black/30 rounded-md p-0.5 border border-black/5 dark:border-white/5">
              {(['compact', 'comfortable', 'spacious'] as const).map(density => (
                <button
                  key={density}
                  onClick={() => onUpdateUiConfig({ density })}
                  className={`px-2 py-0.5 rounded-md text-[9px] font-semibold transition-all capitalize cursor-pointer ${
                    uiConfig.density === density
                      ? 'bg-white dark:bg-[#323233] text-neutral-800 dark:text-white shadow-sm'
                      : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
                >
                  {density}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={uiConfig.showSizeBadges}
                onChange={(e) => onUpdateUiConfig({ showSizeBadges: e.target.checked })}
                className="rounded border-black/10 text-[#007AFF] focus:ring-[#007AFF] h-3 w-3 cursor-pointer"
              />
              <span>Size</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={uiConfig.showDateBadges}
                onChange={(e) => onUpdateUiConfig({ showDateBadges: e.target.checked })}
                className="rounded border-black/10 text-[#007AFF] focus:ring-[#007AFF] h-3 w-3 cursor-pointer"
              />
              <span>Mod Date</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={uiConfig.showPermissions}
                onChange={(e) => onUpdateUiConfig({ showPermissions: e.target.checked })}
                className="rounded border-black/10 text-[#007AFF] focus:ring-[#007AFF] h-3 w-3 cursor-pointer"
              />
              <span>Perms</span>
            </label>
          </div>
        </div>
      </div>

      {/* macOS Finder-style Column Headers */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-black/5 dark:border-white/5 bg-neutral-50 dark:bg-[#1E1E1F] text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider uppercase shrink-0 select-none">
        <div className="flex-1 pr-4 pl-7">Name</div>
        {uiConfig.showDateBadges && <div className="w-[110px] shrink-0 text-left">Date Modified</div>}
        {uiConfig.showSizeBadges && <div className="w-[80px] shrink-0 text-right">Size</div>}
        {uiConfig.showPermissions && <div className="w-[80px] shrink-0 text-right">Permissions</div>}
        <div className="w-[35px] shrink-0"></div> {/* Spacer for copy path */}
      </div>

      {/* Main Virtualized Tree-View Window */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto select-none outline-none font-sans"
        tabIndex={0}
        id="directory-tree-list-scroller"
      >
        {visibleFlatNodes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400 dark:text-neutral-500 font-sans">
            <Search className="w-10 h-10 text-neutral-300 dark:text-neutral-800 mb-2" />
            <h4 className="text-sm font-semibold">No Matching Items</h4>
            <p className="text-xs text-neutral-500 max-w-sm mt-1 leading-normal">
              Try modifying your text query, checking case flags, or disabling active size limits.
            </p>
            <button
              onClick={() => onSetFilters({
                query: '',
                caseSensitive: false,
                useRegex: false,
                type: 'all',
                sizeMin: null,
                sizeMax: null,
                dateStart: null,
                dateEnd: null,
                extension: 'all'
              })}
              className="mt-4 px-3 py-1.5 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* Virtualized container */
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            {visibleSlice.map(({ node, depth, isExpanded, matches }, sliceIndex) => {
              const actualIndex = startIndex + sliceIndex;
              const isSelected = selectedNode?.id === node.id;
              const isHighlighted = highlightedIndex === actualIndex;
              
              const densityPaddings = {
                compact: 'py-0.5',
                comfortable: 'py-1.5',
                spacious: 'py-2.5'
              };
              const paddingClass = densityPaddings[uiConfig.density];

              return (
                <div
                  id={`node-row-${actualIndex}`}
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  className={`group finder-row flex items-center justify-between px-4 cursor-pointer select-none relative ${paddingClass} ${
                    isSelected 
                      ? 'bg-[#007AFF] text-white font-medium shadow-xs' 
                      : isHighlighted
                        ? 'bg-black/5 dark:bg-white/5 text-neutral-900 dark:text-[#f1f1f1]'
                        : 'hover:bg-[#007AFF]/8 text-neutral-700 dark:text-neutral-300'
                  }`}
                  style={{ 
                    position: 'absolute',
                    top: `${actualIndex * rowHeight}px`,
                    left: 0,
                    right: 0,
                    height: `${rowHeight}px`,
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Decorative structural nesting lines (extremely subtle) */}
                  {depth > 0 && Array.from({ length: depth }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute bottom-0 top-0 border-l border-black/5 dark:border-white/5 pointer-events-none"
                      style={{ left: `${(i + 1) * 20 + 2}px` }}
                    />
                  ))}

                  {/* Left Column: Triangle, Icons, Name */}
                  <div 
                    className="flex items-center gap-2 overflow-hidden flex-1 pr-4 relative z-10"
                    style={{ paddingLeft: `${depth * 20}px` }}
                  >
                    {/* Collapsible Disclosure Arrow for directories */}
                    {node.type === 'directory' ? (
                      <button
                        onClick={(e) => toggleNodeExpand(node.id, e)}
                        className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 outline-none flex items-center justify-center"
                      >
                        <ChevronRight 
                          className={`w-3.5 h-3.5 transition-transform duration-100 ${
                            isExpanded ? 'rotate-90' : ''
                          } ${isSelected ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`} 
                        />
                      </button>
                    ) : (
                      <div className="w-4.5 h-4.5 shrink-0" />
                    )}

                    {/* File/Folder Icon with smart select tinting */}
                    {getFileIcon(node, isSelected)}

                    {/* Matched Name highlighting */}
                    <span 
                      className={`truncate text-[12px] font-sans ${
                        !matches ? 'opacity-40' : ''
                      }`} 
                      title={node.name}
                    >
                      {debouncedQuery && matches ? (
                        <HighlightedText text={node.name} highlight={debouncedQuery} regex={filters.useRegex} caseSensitive={filters.caseSensitive} />
                      ) : (
                        node.name
                      )}
                    </span>
                  </div>

                  {/* Column 2: Date Modified */}
                  {uiConfig.showDateBadges && (
                    <div 
                      className={`w-[110px] shrink-0 text-left truncate text-[11px] font-sans relative z-10 font-normal ${
                        isSelected ? 'text-white/80' : 'text-neutral-400 dark:text-neutral-500'
                      }`}
                    >
                      {node.time || '—'}
                    </div>
                  )}

                  {/* Column 3: Size */}
                  {uiConfig.showSizeBadges && (
                    <div 
                      className={`w-[80px] shrink-0 text-right truncate text-[11px] font-mono relative z-10 font-normal ${
                        isSelected ? 'text-white/80' : 'text-neutral-400 dark:text-neutral-500'
                      }`}
                    >
                      {formatBytes(node.size)}
                    </div>
                  )}

                  {/* Column 4: Permissions */}
                  {uiConfig.showPermissions && (
                    <div 
                      className={`w-[80px] shrink-0 text-right truncate text-[11px] font-mono relative z-10 font-normal ${
                        isSelected ? 'text-white/80' : 'text-neutral-400 dark:text-neutral-500'
                      }`}
                    >
                      {node.prot || '—'}
                    </div>
                  )}

                  {/* Column 5: Action indicators (Hover buttons) */}
                  <div className="w-[35px] shrink-0 flex items-center justify-end gap-1 font-sans text-[10px] text-neutral-400 dark:text-neutral-500 z-10">
                    {/* Custom note indicator */}
                    {window.localStorage.getItem(`note-${node.id}`) && (
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-white' : 'bg-[#34C759]'}`} title="Has note" />
                    )}

                    {/* Copy-path hover button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(node.id);
                        setCopiedNodeId(node.id);
                        setTimeout(() => setCopiedNodeId(null), 1500);
                      }}
                      className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 shrink-0 ${
                        isSelected ? 'text-white hover:bg-white/10' : 'text-neutral-400'
                      }`}
                      title="Copy path"
                    >
                      {copiedNodeId === node.id
                        ? <Check className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-[#34C759]'}`} />
                        : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline Subcomponent for highlighting query string inside matched file name
function HighlightedText({ 
  text, 
  highlight, 
  regex, 
  caseSensitive 
}: { 
  text: string; 
  highlight: string; 
  regex: boolean; 
  caseSensitive: boolean 
}) {
  if (!highlight) return <span>{text}</span>;

  let parts: string[] = [];
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    const pattern = regex ? highlight : highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const rx = new RegExp(`(${pattern})`, flags);
    parts = text.split(rx);
  } catch {
    const idx = caseSensitive 
      ? text.indexOf(highlight) 
      : text.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    parts = [
      text.substring(0, idx),
      text.substring(idx, idx + highlight.length),
      text.substring(idx + highlight.length)
    ];
  }

  return (
    <span>
      {parts.map((part, i) => {
        const isMatch = regex 
          ? (() => {
              try { return new RegExp(highlight, caseSensitive ? '' : 'i').test(part); } catch { return false; }
            })()
          : part.toLowerCase() === highlight.toLowerCase();

        return isMatch ? (
          <mark key={i} className="bg-amber-300 dark:bg-[#FFCC00] text-amber-950 dark:text-neutral-900 rounded-sm px-0.5 font-bold">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
}
