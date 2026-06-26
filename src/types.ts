export type NodeType = 'directory' | 'file' | 'link' | 'socket' | 'report' | 'fifo' | 'device';

export interface TreeItem {
  type: NodeType;
  name: string; // File name or relative path
  size?: number;
  mode?: string; // Octal permissions e.g., "0755"
  prot?: string; // Protection string e.g., "-rwxr-xr-x"
  uid?: number;
  user?: string;
  gid?: number;
  group?: string;
  time?: string; // Modification time
  contents?: TreeItem[]; // Children nodes for directories
  
  // Computed fields (non-enumerable or added post-parsing for search & UI performance)
  id: string; // Unique node identifier (typically path-based)
  parentPath?: string;
  depth: number;
  extension: string; // Extracted extension (e.g. "json", "tsx", or "no-ext")
  treeSourceId: string; // ID of the tree this node originated from
}

export interface TreeSource {
  id: string;
  name: string;
  importedAt: string;
  rawJson?: string | Blob; // Optional: large trees store this in IndexedDB, not in-memory
  rootNodesJson?: string; // Cache of root nodes serialized to JSON
  rootNodes: TreeItem[];
  directoriesCount: number;
  filesCount: number;
  totalSize: number;
}

export interface SearchFilters {
  query: string;
  caseSensitive: boolean;
  useRegex: boolean;
  type: 'all' | 'files' | 'directories';
  sizeMin: number | null; // in bytes
  sizeMax: number | null; // in bytes
  dateStart: string | null;
  dateEnd: string | null;
  extension: string; // e.g. "ts", "json" or "all"
}

export interface UIConfig {
  theme: 'slate-light' | 'slate-dark' | 'amber-warm' | 'cyberpunk-dark' | 'monochrome-minimal';
  fontFamily: 'font-sans' | 'font-mono';
  density: 'compact' | 'comfortable' | 'spacious';
  showSizeBadges: boolean;
  showDateBadges: boolean;
  showPermissions: boolean;
  autoExpandDepth: number;
}

export interface FileTag {
  nodeId: string;
  tag: string;
  color: string;
}

export interface FileNote {
  nodeId: string;
  note: string;
  updatedAt: string;
}
