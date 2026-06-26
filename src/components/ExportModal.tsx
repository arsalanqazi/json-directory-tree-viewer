import React, { useState } from 'react';
import { 
  FileJson, 
  FileSpreadsheet, 
  Globe, 
  Printer, 
  Download, 
  Info,
  Layers,
  Sparkles
} from 'lucide-react';
import { TreeItem } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rootNodes: TreeItem[];
  projectName: string;
}

export default function ExportModal({ isOpen, onClose, rootNodes, projectName }: ExportModalProps) {
  const [exportScope, setExportScope] = useState<'all' | 'files-only'>('all');

  if (!isOpen) return null;

  // Helper: flatten tree to files/folders
  const flattenTree = (nodes: TreeItem[]): TreeItem[] => {
    const list: TreeItem[] = [];
    const recurse = (item: TreeItem) => {
      list.push(item);
      if (item.contents) {
        item.contents.forEach(recurse);
      }
    };
    nodes.forEach(recurse);
    return list;
  };

  // 1. Export JSON
  const handleExportJson = () => {
    const cleanNodes = JSON.parse(JSON.stringify(rootNodes));
    // Remove computed tree view states
    const removeState = (nodes: any[]) => {
      nodes.forEach(n => {
        delete n.treeSourceId;
        if (n.contents) removeState(n.contents);
      });
    };
    removeState(cleanNodes);

    const blob = new Blob([JSON.stringify(cleanNodes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '_')}_tree_report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 2. Export CSV
  const handleExportCsv = () => {
    const flat = flattenTree(rootNodes);
    const filtered = exportScope === 'files-only' ? flat.filter(n => n.type !== 'directory') : flat;

    const headers = ['Full Path', 'Name', 'Type', 'Size (Bytes)', 'Permissions', 'Owner', 'Modified Time'];
    const rows = filtered.map(node => [
      `"${node.id}"`,
      `"${node.name}"`,
      `"${node.type}"`,
      node.size !== undefined ? node.size : '',
      `"${node.prot || ''}"`,
      `"${node.user || ''}"`,
      `"${node.time || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '_')}_structure_table.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 3. Export Interactive HTML Report
  const handleExportHtml = () => {
    const flat = flattenTree(rootNodes);
    
    // Generate native HTML detail tree structure recursively
    const renderHtmlFolder = (item: TreeItem): string => {
      const isDir = item.type === 'directory';
      const sizeStr = item.size !== undefined ? `(${Math.round(item.size / 1024 * 10) / 10} KB)` : '';
      
      if (isDir) {
        const childrenHtml = item.contents 
          ? item.contents.map(renderHtmlFolder).join('') 
          : '';
        return `
          <details open class="folder-group" style="margin-left: 15px;">
            <summary class="folder-title">
              📁 <strong>${item.name}</strong> <span class="size-label">${sizeStr}</span>
            </summary>
            <div class="folder-contents">
              ${childrenHtml}
            </div>
          </details>
        `;
      } else {
        return `
          <div class="file-row" style="margin-left: 30px;">
            📄 <span>${item.name}</span> <span class="size-label">${sizeStr}</span>
            <span class="meta-label">${item.prot || ''} • ${item.time || ''}</span>
          </div>
        `;
      }
    };

    const treeHtml = rootNodes.map(renderHtmlFolder).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - Interactive Directory Tree Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1f2937;
      background-color: #f9fafb;
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      padding: 24px;
    }
    header {
      border-bottom: 2px solid #f3f4f6;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      color: #111827;
    }
    p.sub {
      margin: 4px 0 0 0;
      font-size: 12px;
      color: #6b7280;
    }
    .stats-grid {
      display: grid;
      grid-template-cols: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background-color: #f3f4f6;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .stat-card .label {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      font-weight: 600;
    }
    .stat-card .val {
      font-size: 16px;
      font-weight: 700;
      margin-top: 4px;
    }
    .search-box {
      width: 100%;
      padding: 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      margin-bottom: 20px;
      box-sizing: border-box;
      outline: none;
    }
    .search-box:focus {
      border-color: #10b981;
    }
    summary {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      list-style: none;
      outline: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary:hover {
      background-color: #f3f4f6;
    }
    .folder-title {
      font-size: 13px;
      user-select: none;
    }
    .file-row {
      font-family: monospace;
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .file-row:hover {
      background-color: #f9fafb;
    }
    .size-label {
      font-size: 10px;
      color: #9ca3af;
      font-family: monospace;
    }
    .meta-label {
      font-size: 10px;
      color: #6b7280;
      margin-left: auto;
    }
    .folder-contents {
      border-left: 1px dashed #e5e7eb;
      margin-left: 6px;
      padding-left: 4px;
    }
  </style>
  <script>
    function filterTree() {
      const q = document.getElementById('search').value.toLowerCase();
      const files = document.querySelectorAll('.file-row');
      files.forEach(f => {
        const text = f.textContent.toLowerCase();
        if (text.includes(q)) {
          f.style.display = 'flex';
        } else {
          f.style.display = 'none';
        }
      });
    }
  </script>
</head>
<body>
  <div class="container">
    <header>
      <h1>📁 Interactive Directory Explorer</h1>
      <p class="sub">Generated from ${projectName} • Scanned structure report</p>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total Elements</div>
        <div class="val">${flat.length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Total Files</div>
        <div class="val">${flat.filter(f => f.type !== 'directory').length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Total Folders</div>
        <div class="val">${flat.filter(f => f.type === 'directory').length}</div>
      </div>
    </div>

    <input type="text" id="search" class="search-box" placeholder="Instant search files in report..." onkeyup="filterTree()">

    <div class="tree-container" style="font-family: monospace;">
      ${treeHtml}
    </div>
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '_')}_explorer.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 4. Trigger Native Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in font-sans">
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg max-w-md w-full flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-900 flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm font-semibold">Structured Export Options</h4>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-500 font-medium"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
            Export your merged active directory index into standard industrial formats for reviews, audits, presentations, or data pipelines.
          </p>

          {/* CSV Scope selection */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block">CSV Table Row Scope</span>
            <div className="grid grid-cols-2 gap-2 bg-neutral-100 dark:bg-neutral-900 p-1 rounded border border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setExportScope('all')}
                className={`py-1 px-2 rounded text-xs font-medium text-center ${
                  exportScope === 'all' 
                    ? 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-white shadow-xs' 
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                Include Folders
              </button>
              <button
                onClick={() => setExportScope('files-only')}
                className={`py-1 px-2 rounded text-xs font-medium text-center ${
                  exportScope === 'files-only' 
                    ? 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-white shadow-xs' 
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                Files Only
              </button>
            </div>
          </div>

          {/* Main Action Exporters Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* JSON */}
            <button
              onClick={handleExportJson}
              className="p-3 border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-lg flex flex-col items-center justify-center text-center gap-2 group transition-all"
            >
              <FileJson className="w-6 h-6 text-yellow-500 transition-transform group-hover:scale-110" />
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Clean JSON</span>
              <span className="text-[9px] text-neutral-400">Hierarchy structure</span>
            </button>

            {/* CSV */}
            <button
              onClick={handleExportCsv}
              className="p-3 border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-lg flex flex-col items-center justify-center text-center gap-2 group transition-all"
            >
              <FileSpreadsheet className="w-6 h-6 text-green-500 transition-transform group-hover:scale-110" />
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">CSV Table</span>
              <span className="text-[9px] text-neutral-400">Flat tabular spreadsheet</span>
            </button>

            {/* Interactive HTML */}
            <button
              onClick={handleExportHtml}
              className="p-3 border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-lg flex flex-col items-center justify-center text-center gap-2 group transition-all"
            >
              <Globe className="w-6 h-6 text-orange-500 transition-transform group-hover:scale-110" />
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">HTML Explorer</span>
              <span className="text-[9px] text-neutral-400">Offline interactive report</span>
            </button>

            {/* PDF Print */}
            <button
              onClick={handlePrint}
              className="p-3 border border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-lg flex flex-col items-center justify-center text-center gap-2 group transition-all"
            >
              <Printer className="w-6 h-6 text-blue-500 transition-transform group-hover:scale-110" />
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Print / PDF</span>
              <span className="text-[9px] text-neutral-400">Styled document printing</span>
            </button>
          </div>
        </div>

        <div className="p-3 border-t border-neutral-100 dark:border-neutral-900 bg-neutral-50 dark:bg-neutral-900/40 flex justify-end gap-2 shrink-0 text-xs font-medium">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded transition-colors"
          >
            Close Dialog
          </button>
        </div>
      </div>
    </div>
  );
}
