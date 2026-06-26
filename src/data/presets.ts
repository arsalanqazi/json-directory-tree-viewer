import { TreeSource, TreeItem, NodeType } from '../types';

// Helper to generate IDs, depths, extensions, etc., for a preset tree
// ITERATIVE version to avoid stack overflow on deeply nested trees
export function processRawPresetNode(
  rootRaw: any,
  rootParentPath = '',
  rootDepth = 0,
  treeSourceId: string
): TreeItem {
  // We need to build the tree top-down. First create the root, then use a stack
  // to process children iteratively.
  type StackItem = {
    raw: any;
    parentPath: string;
    depth: number;
    parentContents: TreeItem[] | null; // null means this is the root
  };

  const createItem = (raw: any, parentPath: string, depth: number): TreeItem => {
    const name = (raw.name || 'unnamed').replace(/^\.\//, '');
    const id = parentPath ? `${parentPath}/${name}` : name;
    const extension = name.includes('.') ? name.split('.').pop() || 'no-ext' : 'no-ext';
    return {
      type: (raw.type || 'file') as NodeType,
      name,
      size: typeof raw.size === 'number' ? raw.size : undefined,
      mode: raw.mode || undefined,
      prot: raw.prot || undefined,
      uid: raw.uid || 1000,
      user: raw.user || 'developer',
      gid: raw.gid || 1000,
      group: raw.group || 'staff',
      time: raw.time || 'Jun 25 14:30',
      id,
      parentPath: parentPath || undefined,
      depth,
      extension: raw.type === 'directory' ? 'directory' : extension,
      treeSourceId,
    };
  };

  const root = createItem(rootRaw, rootParentPath, rootDepth);

  const stack: StackItem[] = [];

  // If root has children, seed the stack
  if (rootRaw.contents && Array.isArray(rootRaw.contents)) {
    root.contents = [];
    for (let i = rootRaw.contents.length - 1; i >= 0; i--) {
      stack.push({
        raw: rootRaw.contents[i],
        parentPath: root.id,
        depth: rootDepth + 1,
        parentContents: root.contents,
      });
    }
  }

  while (stack.length > 0) {
    const { raw, parentPath, depth, parentContents } = stack.pop()!;
    const item = createItem(raw, parentPath, depth);

    if (raw.contents && Array.isArray(raw.contents)) {
      item.contents = [];
      for (let i = raw.contents.length - 1; i >= 0; i--) {
        stack.push({
          raw: raw.contents[i],
          parentPath: item.id,
          depth: depth + 1,
          parentContents: item.contents,
        });
      }
    }

    parentContents!.push(item);
  }

  return root;
}

// ITERATIVE version of countNodes to avoid stack overflow
function countNodes(rootNode: TreeItem): { files: number; dirs: number; size: number } {
  let files = 0;
  let dirs = 0;
  let size = 0;

  const stack: TreeItem[] = [rootNode];

  while (stack.length > 0) {
    const node = stack.pop()!;
    size += node.size || 0;

    if (node.type === 'directory') {
      dirs++;
      if (node.contents) {
        for (let i = 0; i < node.contents.length; i++) {
          stack.push(node.contents[i]);
        }
      }
    } else {
      files++;
    }
  }

  return { files, dirs, size };
}

export function hydrateTreeNodes(rootNodes: TreeItem[], treeSourceId: string): void {
  // Stack items: { node, parentPath, depth }
  type StackItem = {
    node: TreeItem;
    parentPath: string;
    depth: number;
  };

  const stack: StackItem[] = [];
  for (let i = rootNodes.length - 1; i >= 0; i--) {
    stack.push({ node: rootNodes[i], parentPath: '', depth: 0 });
  }

  while (stack.length > 0) {
    const { node, parentPath, depth } = stack.pop()!;

    const name = (node.name || 'unnamed').replace(/^\.\//, '');
    const id = parentPath ? `${parentPath}/${name}` : name;
    const extension = name.includes('.') ? name.split('.').pop() || 'no-ext' : 'no-ext';

    node.id = id;
    node.parentPath = parentPath || undefined;
    node.depth = depth;
    node.extension = node.type === 'directory' ? 'directory' : extension;
    node.treeSourceId = treeSourceId;

    // Apply defaults if they are missing
    if (node.uid === undefined) node.uid = 1000;
    if (!node.user) node.user = 'developer';
    if (node.gid === undefined) node.gid = 1000;
    if (!node.group) node.group = 'staff';
    if (!node.time) node.time = 'Jun 25 14:30';

    if (node.contents && Array.isArray(node.contents)) {
      for (let i = node.contents.length - 1; i >= 0; i--) {
        stack.push({
          node: node.contents[i],
          parentPath: id,
          depth: depth + 1,
        });
      }
    }
  }
}

export function createTreeSourceFromRaw(id: string, name: string, rawData: any[]): TreeSource {
  // Remove report node if present
  const dataNodes = rawData.filter(node => node.type !== 'report');
  
  const rootNodes = dataNodes.map(node => processRawPresetNode(node, '', 0, id));
  
  let filesCount = 0;
  let directoriesCount = 0;
  let totalSize = 0;

  rootNodes.forEach(node => {
    const counts = countNodes(node);
    filesCount += counts.files;
    directoriesCount += counts.dirs;
    totalSize += counts.size;
  });

  return {
    id,
    name,
    importedAt: new Date().toLocaleString(),
    rawJson: JSON.stringify(rawData, null, 2),
    rootNodes,
    directoriesCount,
    filesCount,
    totalSize,
  };
}

// Preset 1: React + Vite Frontend Project
const reactProjectRaw = [
  {
    "type": "directory",
    "name": ".",
    "size": 4096,
    "mode": "0755",
    "prot": "drwxr-xr-x",
    "time": "Jun 25 18:22",
    "contents": [
      { "type": "file", "name": "package.json", "size": 1420, "mode": "0644", "prot": "-rw-r--r--", "time": "Jun 25 18:22" },
      { "type": "file", "name": "tsconfig.json", "size": 840, "mode": "0644", "prot": "-rw-r--r--", "time": "Jun 24 11:15" },
      { "type": "file", "name": "vite.config.ts", "size": 512, "mode": "0644", "prot": "-rw-r--r--", "time": "Jun 25 17:01" },
      { "type": "file", "name": "tailwind.config.js", "size": 384, "mode": "0644", "prot": "-rw-r--r--", "time": "Jun 20 09:45" },
      { "type": "file", "name": "index.html", "size": 412, "mode": "0644", "prot": "-rw-r--r--", "time": "Jun 25 18:22" },
      { "type": "file", "name": "README.md", "size": 2450, "mode": "0644", "prot": "-rw-r--r--" },
      { "type": "file", "name": ".env.local", "size": 180, "mode": "0600", "prot": "-rw-------" },
      { "type": "file", "name": ".gitignore", "size": 320, "mode": "0644", "prot": "-rw-r--r--" },
      {
        "type": "directory",
        "name": "public",
        "size": 4096,
        "mode": "0755",
        "prot": "drwxr-xr-x",
        "contents": [
          { "type": "file", "name": "favicon.ico", "size": 15400, "mode": "0644", "prot": "-rw-r--r--" },
          { "type": "file", "name": "logo.svg", "size": 3200, "mode": "0644", "prot": "-rw-r--r--" },
          { "type": "file", "name": "manifest.json", "size": 512, "mode": "0644", "prot": "-rw-r--r--" }
        ]
      },
      {
        "type": "directory",
        "name": "src",
        "size": 4096,
        "mode": "0755",
        "prot": "drwxr-xr-x",
        "contents": [
          { "type": "file", "name": "main.tsx", "size": 650, "mode": "0644", "prot": "-rw-r--r--", "time": "Jun 25 10:20" },
          { "type": "file", "name": "App.tsx", "size": 3800, "mode": "0644", "prot": "-rw-r--r--", "time": "Jun 25 18:15" },
          { "type": "file", "name": "index.css", "size": 1200, "mode": "0644", "prot": "-rw-r--r--" },
          { "type": "file", "name": "types.ts", "size": 2400, "mode": "0644", "prot": "-rw-r--r--" },
          {
            "type": "directory",
            "name": "components",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "TitleBar.tsx", "size": 5120, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "Sidebar.tsx", "size": 9300, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "TreeView.tsx", "size": 14200, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "QuickLook.tsx", "size": 11500, "mode": "0644", "prot": "-rw-r--r--" },
              {
                "type": "directory",
                "name": "ui",
                "size": 4096,
                "mode": "0755",
                "prot": "drwxr-xr-x",
                "contents": [
                  { "type": "file", "name": "button.tsx", "size": 2100, "mode": "0644", "prot": "-rw-r--r--" },
                  { "type": "file", "name": "dialog.tsx", "size": 3400, "mode": "0644", "prot": "-rw-r--r--" },
                  { "type": "file", "name": "input.tsx", "size": 1500, "mode": "0644", "prot": "-rw-r--r--" },
                  { "type": "file", "name": "badge.tsx", "size": 1200, "mode": "0644", "prot": "-rw-r--r--" }
                ]
              }
            ]
          },
          {
            "type": "directory",
            "name": "hooks",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "useKeyboardShortcuts.ts", "size": 4100, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "useLocalStorage.ts", "size": 1800, "mode": "0644", "prot": "-rw-r--r--" }
            ]
          },
          {
            "type": "directory",
            "name": "assets",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "bg-pattern.svg", "size": 48200, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "avatar.webp", "size": 14200, "mode": "0644", "prot": "-rw-r--r--" }
            ]
          }
        ]
      }
    ]
  },
  {
    "type": "report",
    "directories": 7,
    "files": 21
  }
];

// Preset 2: Express Node.js Backend API
const backendProjectRaw = [
  {
    "type": "directory",
    "name": ".",
    "size": 4096,
    "mode": "0755",
    "prot": "drwxr-xr-x",
    "time": "Jun 24 10:12",
    "contents": [
      { "type": "file", "name": "package.json", "size": 950, "mode": "0644", "prot": "-rw-r--r--" },
      { "type": "file", "name": "Dockerfile", "size": 620, "mode": "0644", "prot": "-rw-r--r--" },
      { "type": "file", "name": "docker-compose.yml", "size": 1100, "mode": "0644", "prot": "-rw-r--r--" },
      { "type": "file", "name": "server.ts", "size": 2400, "mode": "0644", "prot": "-rw-r--r--", "time": "Jun 24 09:44" },
      { "type": "file", "name": ".env.example", "size": 450, "mode": "0644", "prot": "-rw-r--r--" },
      {
        "type": "directory",
        "name": ".github",
        "size": 4096,
        "mode": "0755",
        "prot": "drwxr-xr-x",
        "contents": [
          {
            "type": "directory",
            "name": "workflows",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "deploy.yml", "size": 1820, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "ci.yml", "size": 1150, "mode": "0644", "prot": "-rw-r--r--" }
            ]
          }
        ]
      },
      {
        "type": "directory",
        "name": "src",
        "size": 4096,
        "mode": "0755",
        "prot": "drwxr-xr-x",
        "contents": [
          { "type": "file", "name": "index.ts", "size": 420, "mode": "0644", "prot": "-rw-r--r--" },
          {
            "type": "directory",
            "name": "config",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "db.ts", "size": 1540, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "logger.ts", "size": 1100, "mode": "0644", "prot": "-rw-r--r--" }
            ]
          },
          {
            "type": "directory",
            "name": "controllers",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "userController.ts", "size": 4800, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "treeController.ts", "size": 8900, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "authController.ts", "size": 6200, "mode": "0644", "prot": "-rw-r--r--" }
            ]
          },
          {
            "type": "directory",
            "name": "models",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "User.ts", "size": 2500, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "DirectoryTree.ts", "size": 3100, "mode": "0644", "prot": "-rw-r--r--" }
            ]
          },
          {
            "type": "directory",
            "name": "routes",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "api.ts", "size": 2100, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "auth.ts", "size": 1400, "mode": "0644", "prot": "-rw-r--r--" }
            ]
          },
          {
            "type": "directory",
            "name": "middleware",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "authHandler.ts", "size": 2800, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "errorHandler.ts", "size": 1500, "mode": "0644", "prot": "-rw-r--r--" }
            ]
          }
        ]
      },
      {
        "type": "directory",
        "name": "migrations",
        "size": 4096,
        "mode": "0750",
        "prot": "drwxr-x---",
        "contents": [
          { "type": "file", "name": "20260101_init.sql", "size": 4500, "mode": "0644", "prot": "-rw-r--r--" },
          { "type": "file", "name": "20260315_add_trees_table.sql", "size": 2200, "mode": "0644", "prot": "-rw-r--r--" }
        ]
      }
    ]
  },
  {
    "type": "report",
    "directories": 9,
    "files": 19
  }
];

// Preset 3: Corporate Full-stack Monorepo
const monorepoProjectRaw = [
  {
    "type": "directory",
    "name": ".",
    "size": 4096,
    "mode": "0755",
    "prot": "drwxr-xr-x",
    "time": "Jun 20 11:15",
    "contents": [
      { "type": "file", "name": "lerna.json", "size": 280, "mode": "0644", "prot": "-rw-r--r--" },
      { "type": "file", "name": "nx.json", "size": 680, "mode": "0644", "prot": "-rw-r--r--" },
      { "type": "file", "name": "package.json", "size": 2200, "mode": "0644", "prot": "-rw-r--r--" },
      { "type": "file", "name": "pnpm-workspace.yaml", "size": 320, "mode": "0644", "prot": "-rw-r--r--" },
      { "type": "file", "name": ".prettierrc", "size": 120, "mode": "0644", "prot": "-rw-r--r--" },
      {
        "type": "directory",
        "name": "apps",
        "size": 4096,
        "mode": "0755",
        "prot": "drwxr-xr-x",
        "contents": [
          {
            "type": "directory",
            "name": "admin-portal",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "package.json", "size": 1100, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "next.config.js", "size": 450, "mode": "0644", "prot": "-rw-r--r--" },
              {
                "type": "directory",
                "name": "pages",
                "size": 4096,
                "mode": "0755",
                "prot": "drwxr-xr-x",
                "contents": [
                  { "type": "file", "name": "_app.tsx", "size": 890, "mode": "0644", "prot": "-rw-r--r--" },
                  { "type": "file", "name": "index.tsx", "size": 2400, "mode": "0644", "prot": "-rw-r--r--" },
                  { "type": "file", "name": "dashboard.tsx", "size": 7500, "mode": "0644", "prot": "-rw-r--r--" }
                ]
              }
            ]
          },
          {
            "type": "directory",
            "name": "api-gateway",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "package.json", "size": 850, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "main.go", "size": 3400, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "go.mod", "size": 420, "mode": "0644", "prot": "-rw-r--r--" }
            ]
          }
        ]
      },
      {
        "type": "directory",
        "name": "packages",
        "size": 4096,
        "mode": "0755",
        "prot": "drwxr-xr-x",
        "contents": [
          {
            "type": "directory",
            "name": "ui-core",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "package.json", "size": 780, "mode": "0644", "prot": "-rw-r--r--" },
              { "type": "file", "name": "tsup.config.ts", "size": 320, "mode": "0644", "prot": "-rw-r--r--" },
              {
                "type": "directory",
                "name": "src",
                "size": 4096,
                "mode": "0755",
                "prot": "drwxr-xr-x",
                "contents": [
                  { "type": "file", "name": "Button.tsx", "size": 1800, "mode": "0644", "prot": "-rw-r--r--" },
                  { "type": "file", "name": "Card.tsx", "size": 2200, "mode": "0644", "prot": "-rw-r--r--" },
                  { "type": "file", "name": "index.ts", "size": 150, "mode": "0644", "prot": "-rw-r--r--" }
                ]
              }
            ]
          },
          {
            "type": "directory",
            "name": "utils-shared",
            "size": 4096,
            "mode": "0755",
            "prot": "drwxr-xr-x",
            "contents": [
              { "type": "file", "name": "package.json", "size": 520, "mode": "0644", "prot": "-rw-r--r--" },
              {
                "type": "directory",
                "name": "src",
                "size": 4096,
                "mode": "0755",
                "prot": "drwxr-xr-x",
                "contents": [
                  { "type": "file", "name": "date.ts", "size": 1400, "mode": "0644", "prot": "-rw-r--r--" },
                  { "type": "file", "name": "math.ts", "size": 980, "mode": "0644", "prot": "-rw-r--r--" },
                  { "type": "file", "name": "string.ts", "size": 1100, "mode": "0644", "prot": "-rw-r--r--" }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "type": "report",
    "directories": 10,
    "files": 19
  }
];

export function getPresetSources(): TreeSource[] {
  return [
    createTreeSourceFromRaw('react-preset', 'React + Vite Web Project', reactProjectRaw),
    createTreeSourceFromRaw('express-preset', 'Express API Service', backendProjectRaw),
    createTreeSourceFromRaw('monorepo-preset', 'Fullstack Workspace Monorepo', monorepoProjectRaw),
  ];
}
