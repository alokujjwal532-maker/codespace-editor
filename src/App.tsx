
import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import "./App.css";

type FileType = "html" | "css" | "javascript";

type FileItem = {
  id: string;
  name: string;
  type: FileType;
  content: string;
  folder: string;
};

type Problem = {
  fileId: string;
  fileName: string;
  message: string;
  line: number;
};

const starterFiles: FileItem[] = [
  {
    id: "1",
    name: "index.html",
    type: "html",
    folder: "",
    content: `<div class="container">
  <h1>Hello CodeSpace!</h1>
  <p>Your online code editor is ready.</p>
  <button onclick="showMessage()">Click Me</button>
</div>`,
  },
  {
    id: "2",
    name: "style.css",
    type: "css",
    folder: "",
    content: `body {
  font-family: Arial, sans-serif;
  background: #f4f4f4;
}

.container {
  text-align: center;
  padding: 50px;
}

h1 {
  color: #2563eb;
}

button {
  padding: 10px 18px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}`,
  },
  {
    id: "3",
    name: "script.js",
    type: "javascript",
    folder: "",
    content: `function showMessage() {
  console.log("CodeSpace is working!");
  alert("Hello from CodeSpace!");
}

console.log("JavaScript is ready!");`,
  },
];

const getFileType = (name: string): FileType => {
  const ext = name.split(".").pop()?.toLowerCase();

  if (ext === "css") return "css";
  if (["js", "jsx", "ts", "tsx"].includes(ext || "")) return "javascript";
  return "html";
};

const getFileIcon = (type: FileType) =>
  type === "html" ? "5" : type === "css" ? "#" : "JS";

const getStoredProject = (): FileItem[] => {
  try {
    const data = localStorage.getItem("codespace-files");
    if (!data) return starterFiles;

    const parsed = JSON.parse(data);

    return Array.isArray(parsed) && parsed.length
      ? parsed
      : starterFiles;
  } catch {
    return starterFiles;
  }
};

export default function App() {
  const [files, setFiles] = useState<FileItem[]>(getStoredProject);

  const [folders, setFolders] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("codespace-folders") || "[]"
      );
    } catch {
      return [];
    }
  });

  const [activeId, setActiveId] = useState("1");
  const [tabs, setTabs] = useState<string[]>(["1", "2", "3"]);

  const [showExplorer, setShowExplorer] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showPanel, setShowPanel] = useState(true);

  const [preview, setPreview] = useState("");
  const [panelTab, setPanelTab] = useState("TERMINAL");

  const [terminal, setTerminal] = useState<string[]>([
    "CodeSpace terminal output",
    "Ready to run your project.",
  ]);

  const [problems, setProblems] = useState<Problem[]>([]);
  const [saved, setSaved] = useState(true);

  const [expandedFolders, setExpandedFolders] = useState<string[]>([""]);

  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");
  const [showReplace, setShowReplace] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  const [draggedId, setDraggedId] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("my-project");

  const importRef = useRef<HTMLInputElement>(null);

  const activeFile = files.find(file => file.id === activeId);

  // PERSIST PROJECT
  useEffect(() => {
    try {
      localStorage.setItem("codespace-files", JSON.stringify(files));
      localStorage.setItem("codespace-folders", JSON.stringify(folders));
      setSaved(true);
    } catch {
      setTerminal(old => [...old, "Could not save project storage."]);
    }
  }, [files, folders]);

  // JAVASCRIPT SYNTAX CHECK
  useEffect(() => {
    const found: Problem[] = [];

    files.forEach(file => {
      if (file.type !== "javascript" || !file.content.trim()) return;

      try {
        new Function(file.content);
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "JavaScript syntax error";

        const match = message.match(/line\s+(\d+)/i);

        found.push({
          fileId: file.id,
          fileName: file.name,
          message,
          line: match ? Number(match[1]) : 1,
        });
      }
    });

    setProblems(found);
  }, [files]);

  // RECEIVE PREVIEW CONSOLE OUTPUT
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const data = event.data;

      if (!data || !String(data.type || "").startsWith("CODESPACE_")) {
        return;
      }

      if (data.type === "CODESPACE_LOG") {
        setTerminal(old => [...old, `› ${data.message}`]);
      }

      if (data.type === "CODESPACE_ERROR") {
        setTerminal(old => [...old, `✕ ${data.message}`]);
      }
    };

    window.addEventListener("message", receive);

    return () => window.removeEventListener("message", receive);
  }, []);

  // KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen(true);
        setPaletteQuery("");
      }

      if (modifier && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setShowExplorer(true);
        setSearch("");
        setPanelTab("SEARCH");
      }

      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveProject();
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeys);

    return () => window.removeEventListener("keydown", handleKeys);
  }, [files, folders]);

  // SAVE PROJECT
  const saveProject = () => {
    try {
      localStorage.setItem("codespace-files", JSON.stringify(files));
      localStorage.setItem("codespace-folders", JSON.stringify(folders));
      setSaved(true);
      setTerminal(old => [...old, "✓ Project saved successfully."]);
    } catch {
      setTerminal(old => [...old, "✕ Could not save project."]);
    }
  };

  // OPEN FILE
  const openFile = (id: string) => {
    setActiveId(id);

    setTabs(old =>
      old.includes(id) ? old : [...old, id]
    );
  };

  // UPDATE EDITOR CONTENT
  const updateCode = (value: string) => {
    setFiles(old =>
      old.map(file =>
        file.id === activeId
          ? { ...file, content: value }
          : file
      )
    );

    setSaved(false);
  };

  // CREATE FILE
  const createFile = () => {
    const name = window.prompt("Enter file name:", "new-file.js");

    if (!name?.trim()) return;

    const cleanName = name.trim();

    const folder = activeFile?.folder || "";

    const duplicate = files.some(
      file => file.name === cleanName && file.folder === folder
    );

    if (duplicate) {
      alert("A file with this name already exists in this folder.");
      return;
    }

    const newFile: FileItem = {
      id: crypto.randomUUID(),
      name: cleanName,
      type: getFileType(cleanName),
      content: "",
      folder,
    };

    setFiles(old => [...old, newFile]);
    setTabs(old => [...old, newFile.id]);
    setActiveId(newFile.id);
    setSaved(false);
  };

  // CREATE FOLDER
  const createFolder = () => {
    const name = window.prompt("Enter folder name:");

    if (!name?.trim()) return;

    const cleanName = name.trim().replaceAll("/", "");
    const parent = activeFile?.folder || "";
    const folderPath = parent
      ? `${parent}/${cleanName}`
      : cleanName;

    if (folders.includes(folderPath)) {
      alert("This folder already exists.");
      return;
    }

    setFolders(old => [...old, folderPath]);
    setExpandedFolders(old => [...old, folderPath]);
    setSaved(false);
  };

  // RENAME FILE
  const renameFile = (id: string) => {
    const file = files.find(item => item.id === id);
    if (!file) return;

    const name = window.prompt("Enter new file name:", file.name);

    if (!name?.trim()) return;

    const cleanName = name.trim();

    if (files.some(item =>
      item.id !== id &&
      item.name === cleanName &&
      item.folder === file.folder
    )) {
      alert("A file with this name already exists.");
      return;
    }

    setFiles(old =>
      old.map(item =>
        item.id === id
          ? {
              ...item,
              name: cleanName,
              type: getFileType(cleanName),
            }
          : item
      )
    );

    setSaved(false);
  };

  // DELETE FILE
  const deleteFile = (id: string) => {
    const file = files.find(item => item.id === id);
    if (!file) return;

    if (!window.confirm(`Delete ${file.name}?`)) return;

    const remaining = files.filter(item => item.id !== id);

    setFiles(remaining);
    setTabs(old => old.filter(tab => tab !== id));

    if (activeId === id) {
      setActiveId(remaining[0]?.id || "");
    }

    setSaved(false);
  };

  // DELETE FOLDER
  const deleteFolder = (folder: string) => {
    if (!window.confirm(`Delete folder "${folder}" and its contents?`)) {
      return;
    }

    const affected = files.filter(
      file => file.folder === folder || file.folder.startsWith(`${folder}/`)
    );

    const affectedIds = affected.map(file => file.id);

    setFiles(old => old.filter(file => !affectedIds.includes(file.id)));

    setTabs(old => old.filter(id => !affectedIds.includes(id)));

    if (affectedIds.includes(activeId)) {
      const remaining = files.filter(file => !affectedIds.includes(file.id));
      setActiveId(remaining[0]?.id || "");
    }

    setFolders(old => old.filter(
      item => item !== folder && !item.startsWith(`${folder}/`)
    ));

    setSaved(false);
  };

  // RENAME FOLDER
  const renameFolder = (folder: string) => {
    const newName = window.prompt("Enter new folder name:", folder.split("/").pop());

    if (!newName?.trim()) return;

    const parent = folder.includes("/")
      ? folder.substring(0, folder.lastIndexOf("/"))
      : "";

    const newPath = parent
      ? `${parent}/${newName.trim()}`
      : newName.trim();

    if (folders.includes(newPath)) {
      alert("This folder already exists.");
      return;
    }

    const replacePath = (path: string) =>
      path === folder
        ? newPath
        : path.startsWith(`${folder}/`)
          ? newPath + path.slice(folder.length)
          : path;

    setFolders(old => old.map(replacePath));
    setFiles(old => old.map(file => ({
      ...file,
      folder: replacePath(file.folder),
    })));

    setSaved(false);
  };

  // MOVE FILE INTO FOLDER
  const moveFileToFolder = (folder: string) => {
    if (!draggedId) return;

    const file = files.find(item => item.id === draggedId);
    if (!file) return;

    if (file.folder === folder) {
      setDraggedId(null);
      return;
    }

    const duplicate = files.some(
      item =>
        item.id !== draggedId &&
        item.name === file.name &&
        item.folder === folder
    );

    if (duplicate) {
      alert("A file with this name already exists in this folder.");
      setDraggedId(null);
      return;
    }

    setFiles(old => old.map(item =>
      item.id === draggedId
        ? { ...item, folder }
        : item
    ));

    setDraggedId(null);
    setSaved(false);
  };

  // CLOSE TAB
  const closeTab = (id: string) => {
    const remaining = tabs.filter(tab => tab !== id);

    setTabs(remaining);

    if (activeId === id) {
      setActiveId(remaining[remaining.length - 1] || "");
    }
  };

  // TOGGLE FOLDER
  const toggleFolder = (folder: string) => {
    setExpandedFolders(old =>
      old.includes(folder)
        ? old.filter(item => item !== folder)
        : [...old, folder]
    );
  };

  // GET DIRECT CHILD FOLDERS
  const getChildFolders = (parent: string) => {
    return folders.filter(folder => {
      const parentPath = folder.includes("/")
        ? folder.substring(0, folder.lastIndexOf("/"))
        : "";

      return parentPath === parent;
    });
  };

  // BUILD PREVIEW DOCUMENT
  const buildOutput = () => {
    const html =
      files.find(file => file.name.endsWith(".html"))?.content || "";

    const css =
      files.find(file => file.name.endsWith(".css"))?.content || "";

    const js =
      files.find(file => file.name.endsWith(".js"))?.content || "";

    const safeJs = js.replace(/<\/script/gi, "<\\/script");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>
${html}
<script>
(function() {
  const send = (type, message) => {
    window.parent.postMessage({
      type,
      message: String(message)
    }, "*");
  };

  console.log = (...args) => {
    send("CODESPACE_LOG", args.map(arg =>
      typeof arg === "object" ? JSON.stringify(arg) : String(arg)
    ).join(" "));
  };

  console.error = (...args) => {
    send("CODESPACE_ERROR", args.join(" "));
  };

  window.onerror = (message) => {
    send("CODESPACE_ERROR", message);
  };

  try {
    ${safeJs}
  } catch(error) {
    send("CODESPACE_ERROR", error.message);
  }
})();
<\/script>
</body>
</html>`;
  };

  // RUN PROJECT
  const runCode = () => {
    if (problems.length > 0) {
      setPanelTab("PROBLEMS");
      setShowPanel(true);
      return;
    }

    setTerminal(["▶ Running project..."]);
    setPreview(buildOutput());
    setShowPreview(true);
    setPanelTab("TERMINAL");
    setShowPanel(true);
  };

  // AUTOMATIC LIVE PREVIEW
  useEffect(() => {
    if (!preview) return;

    const timer = window.setTimeout(() => {
      setPreview(buildOutput());
    }, 700);

    return () => window.clearTimeout(timer);
  }, [files]);

  // OPEN IN BROWSER
  const openInBrowser = () => {
    const url = URL.createObjectURL(
      new Blob([buildOutput()], { type: "text/html" })
    );

    const newTab = window.open(url, "_blank");

    if (newTab) {
      setTerminal(old => [...old, "✓ Website opened in a new browser tab."]);
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      URL.revokeObjectURL(url);
      setTerminal(old => [...old, "✕ Allow pop-ups to open the website."]);
    }
  };

  // GLOBAL SEARCH
  const searchResults = files.flatMap(file =>
    search.trim()
      ? file.content.split("\n").flatMap((line, index) =>
          line.toLowerCase().includes(search.toLowerCase())
            ? [{
                fileId: file.id,
                fileName: file.name,
                line: index + 1,
                text: line.trim(),
              }]
            : []
        )
      : []
  );

  // REPLACE ALL
  const replaceAll = () => {
    if (!search.trim()) return;

    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    setFiles(old => old.map(file => ({
      ...file,
      content: file.content.replace(new RegExp(escaped, "gi"), replace),
    })));

    setSaved(false);
    setTerminal(old => [...old, "✓ Replace operation completed."]);
  };

  // EXPORT PROJECT
  const exportProject = () => {
    const data = JSON.stringify({
      projectName,
      files,
      folders,
    }, null, 2);

    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName}.codespace.json`;
    link.click();

    URL.revokeObjectURL(url);

    setTerminal(old => [...old, "✓ Project exported."]);
  };

  // IMPORT PROJECT
  const importProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = JSON.parse(await file.text());

      if (!Array.isArray(data.files)) {
        throw new Error("Invalid project file.");
      }

      const imported = data.files as FileItem[];

      setFiles(imported);
      setFolders(Array.isArray(data.folders) ? data.folders : []);
      setTabs(imported.slice(0, 3).map(item => item.id));
      setActiveId(imported[0]?.id || "");
      setProjectName(data.projectName || "imported-project");

      setTerminal(old => [...old, "✓ Project imported successfully."]);
    } catch {
      alert("Invalid CodeSpace project file.");
    }

    event.target.value = "";
  };

  // COMMAND PALETTE
  const commands = [
    { name: "New File", action: createFile },
    { name: "New Folder", action: createFolder },
    { name: "Save Project", action: saveProject },
    { name: "Run Code", action: runCode },
    { name: "Open in Browser", action: openInBrowser },
    { name: "Export Project", action: exportProject },
    { name: "Import Project", action: () => importRef.current?.click() },
    { name: "Show Explorer", action: () => setShowExplorer(true) },
    { name: "Hide Explorer", action: () => setShowExplorer(false) },
    { name: "Toggle Preview", action: () => setShowPreview(old => !old) },
    { name: "Toggle Terminal", action: () => setShowPanel(old => !old) },
    { name: "Show Problems", action: () => { setPanelTab("PROBLEMS"); setShowPanel(true); } },
    { name: "Show Search", action: () => { setPanelTab("SEARCH"); setShowPanel(true); } },
    { name: "Clear Terminal", action: () => setTerminal([]) },
  ];

  const visibleCommands = commands.filter(command =>
    command.name.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  // RENDER FOLDER TREE
  const renderFolder = (folder: string, depth = 0): React.ReactNode => {
    const children = getChildFolders(folder);

    const folderFiles = files.filter(file => file.folder === folder);

    const expanded = expandedFolders.includes(folder);

    return (
      <div key={folder}>
        <div
          className="explorer-file folder-item"
          style={{
            paddingLeft: 12 + depth * 15,
            cursor: "pointer",
          }}
          onClick={() => toggleFolder(folder)}
          onDragOver={event => event.preventDefault()}
          onDrop={() => moveFileToFolder(folder)}
          onContextMenu={event => {
            event.preventDefault();
            const action = window.prompt("Type rename or delete:");
            if (action === "rename") renameFolder(folder);
            if (action === "delete") deleteFolder(folder);
          }}
        >
          <span>{expanded ? "⌄" : "›"}</span>
          <span>📁</span>
          <span>{folder.split("/").pop()}</span>
        </div>

        {expanded && (
          <>
            {children.map(child => renderFolder(child, depth + 1))}

            {folderFiles.map(file => renderFile(file, depth + 1))}
          </>
        )}
      </div>
    );
  };

  const renderFile = (file: FileItem, depth = 0) => (
    <button
      key={file.id}
      type="button"
      draggable
      className={`explorer-file ${activeId === file.id ? "selected" : ""}`}
      style={{ paddingLeft: 15 + depth * 15 }}
      onClick={() => openFile(file.id)}
      onDragStart={() => setDraggedId(file.id)}
      onDragOver={event => event.preventDefault()}
      onDrop={() => {
        if (draggedId && draggedId !== file.id) {
          const dragged = files.find(item => item.id === draggedId);
          if (dragged) moveFileToFolder(file.folder);
        }
      }}
      onDragEnd={() => setDraggedId(null)}
      onContextMenu={event => {
        event.preventDefault();
        const action = window.prompt("Type rename or delete:");
        if (action === "rename") renameFile(file.id);
        if (action === "delete") deleteFile(file.id);
      }}
    >
      <span className={`file-icon ${file.type}`}>
        {getFileIcon(file.type)}
      </span>

      <span className="explorer-file-name">{file.name}</span>

      <span className="explorer-actions">
        <span
          role="button"
          tabIndex={0}
          title="Rename"
          onClick={event => {
            event.stopPropagation();
            renameFile(file.id);
          }}
          onKeyDown={event => {
            if (event.key === "Enter") renameFile(file.id);
          }}
        >
          ✎
        </span>

        <span
          role="button"
          tabIndex={0}
          title="Delete"
          onClick={event => {
            event.stopPropagation();
            deleteFile(file.id);
          }}
          onKeyDown={event => {
            if (event.key === "Enter") deleteFile(file.id);
          }}
        >
          ×
        </span>
      </span>
    </button>
  );

  return (
    <div className="app">

      {/* TOP BAR */}
      <header className="title-bar">
        <div className="title-brand">
          <div className="brand-icon">{"</>"}</div>
          <span>CodeSpace</span>
          <span className="project-label">{projectName}</span>
        </div>

        <div className="title-actions">
          <span className="save-status">
            {saved ? "● Saved" : "● Unsaved"}
          </span>

          <button className="toolbar-button" onClick={saveProject}>
            Save
          </button>

          <button className="toolbar-button" onClick={exportProject}>
            Export
          </button>

          <button
            className="toolbar-button"
            onClick={() => importRef.current?.click()}
          >
            Import
          </button>

          <button className="toolbar-button" onClick={openInBrowser}>
            ↗ Browser
          </button>

          <button className="run-button" onClick={runCode}>
            ▶ Run
          </button>
        </div>
      </header>

      <input
        ref={importRef}
        type="file"
        accept=".json,.codespace.json"
        hidden
        onChange={importProject}
      />

      {/* MAIN WORKSPACE */}
      <div className="workspace">

        {/* ACTIVITY BAR */}
        <aside className="activity-bar">
          <button
            className={showExplorer ? "activity-active" : ""}
            title="Explorer"
            onClick={() => setShowExplorer(old => !old)}
          >
            ▤
          </button>

          <button
            title="Search"
            onClick={() => {
              setPanelTab("SEARCH");
              setShowPanel(true);
            }}
          >
            ⌕
          </button>

          <div className="activity-spacer" />

          <button
            title="Settings"
            onClick={() => alert("CodeSpace settings will be added in a future upgrade.")}
          >
            ⚙
          </button>
        </aside>

        {/* EXPLORER */}
        {showExplorer && (
          <aside className="sidebar">
            <div className="sidebar-heading">
              <span>EXPLORER</span>

              <div>
                <button type="button" title="New File" onClick={createFile}>
                  ＋
                </button>

                <button type="button" title="New Folder" onClick={createFolder}>
                  ▣
                </button>
              </div>
            </div>

            <div className="folder-heading">
              ⌄ {projectName.toUpperCase()}
            </div>

            {getChildFolders("").map(folder =>
              renderFolder(folder)
            )}

            {files
              .filter(file => !file.folder)
              .map(file => renderFile(file))}

            {files.length === 0 && folders.length === 0 && (
              <div className="empty-explorer">
                No files yet. Click + to create a file.
              </div>
            )}
          </aside>
        )}

        {/* EDITOR */}
        <main className="main-editor">

          <div className="editor-tabs">
            {tabs.map(id => {
              const file = files.find(item => item.id === id);
              if (!file) return null;

              return (
                <div
                  key={id}
                  className={`editor-tab ${activeId === id ? "active" : ""}`}
                >
                  <button
                    className="tab-name"
                    onClick={() => setActiveId(id)}
                  >
                    <span className={`file-icon ${file.type}`}>
                      {getFileIcon(file.type)}
                    </span>
                    {file.name}
                    {!saved && activeId === id
                      ? <span className="unsaved-dot">●</span>
                      : null}
                  </button>

                  <button
                    className="tab-close"
                    onClick={() => closeTab(id)}
                    title="Close tab"
                  >
                    ×
                  </button>
                </div>
              );
            })}

            <button className="new-tab-button" onClick={createFile}>
              +
            </button>
          </div>

          <div className="editor-breadcrumb">
            {projectName}　›　{activeFile?.folder
              ? `${activeFile.folder}　›　`
              : ""}
            {activeFile?.name || "No file selected"}
          </div>

          <div className="editor-content">
            {activeFile ? (
              <Editor
                key={activeFile.id}
                path={activeFile.id}
                height="100%"
                language={activeFile.type}
                theme="vs-dark"
                value={activeFile.content}
                onChange={value => updateCode(value || "")}
                options={{
                  fontSize: 14,
                  fontFamily: "Consolas, monospace",
                  minimap: { enabled: true },
                  automaticLayout: true,
                  padding: { top: 15 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  tabSize: 2,
                  wordWrap: "off",
                  bracketPairColorization: { enabled: true },
                  renderValidationDecorations: "on",
                }}
              />
            ) : (
              <div className="welcome-screen">
                <div className="welcome-logo">{"</>"}</div>
                <h2>Welcome to CodeSpace</h2>
                <p>Create a new file to start coding.</p>
                <button onClick={createFile}>Create New File</button>
              </div>
            )}
          </div>

          {/* BOTTOM PANEL */}
          {showPanel && (
            <div className="bottom-panel">
              <div className="panel-header">
                <div className="panel-tabs">
                  {["PROBLEMS", "OUTPUT", "TERMINAL", "SEARCH"].map(tab => (
                    <button
                      key={tab}
                      className={`panel-tab ${panelTab === tab ? "active" : ""}`}
                      onClick={() => setPanelTab(tab)}
                    >
                      {tab}
                      {tab === "PROBLEMS" && problems.length
                        ? ` ${problems.length}`
                        : ""}
                    </button>
                  ))}
                </div>

                <button
                  className="panel-close"
                  onClick={() => setShowPanel(false)}
                >
                  ×
                </button>
              </div>

              <div className="panel-content">

                {(panelTab === "TERMINAL" || panelTab === "OUTPUT") &&
                  terminal.map((line, index) => (
                    <div key={index}>{line}</div>
                  ))}

                {panelTab === "PROBLEMS" && (
                  problems.length === 0
                    ? <div className="problem-success">
                        ✓ No JavaScript syntax errors found.
                      </div>
                    : problems.map((problem, index) => (
                        <button
                          key={index}
                          className="problem-item"
                          onClick={() => openFile(problem.fileId)}
                        >
                          <span className="error-line">
                            ✕ {problem.fileName}: {problem.message}
                          </span>
                          <span>Line {problem.line}</span>
                        </button>
                      ))
                )}

                {panelTab === "SEARCH" && (
                  <div className="search-panel">
                    <input
                      className="search-field"
                      placeholder="Search in files..."
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                    />

                    <button
                      className="replace-toggle"
                      onClick={() => setShowReplace(old => !old)}
                    >
                      {showReplace ? "⌄" : "›"} Replace
                    </button>

                    {showReplace && (
                      <>
                        <input
                          className="search-field"
                          placeholder="Replace with..."
                          value={replace}
                          onChange={event => setReplace(event.target.value)}
                        />

                        <button
                          className="replace-button"
                          onClick={replaceAll}
                        >
                          Replace All
                        </button>
                      </>
                    )}

                    {searchResults.map((result, index) => (
                      <button
                        key={index}
                        className="search-result"
                        onClick={() => openFile(result.fileId)}
                      >
                        <strong>
                          {result.fileName}:{result.line}
                        </strong>
                        <span>{result.text}</span>
                      </button>
                    ))}

                    {search.trim() && searchResults.length === 0 && (
                      <p>No matching results found.</p>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

        </main>

        {/* PREVIEW */}
        {showPreview && (
          <section className="preview-section">
            <div className="preview-toolbar">
              <span>LIVE PREVIEW</span>

              <button onClick={runCode} title="Refresh Preview">
                ↻
              </button>

              <button onClick={openInBrowser} title="Open in Browser">
                ↗
              </button>

              <button
                onClick={() => setShowPreview(false)}
                title="Close Preview"
              >
                ×
              </button>
            </div>

            <iframe
              title="CodeSpace Preview"
              className="preview-frame"
              srcDoc={preview}
              sandbox="allow-scripts allow-modals"
            />
          </section>
        )}

      </div>

      {/* STATUS BAR */}
      <footer className="status-bar">
        <div>
          <span>◈ CodeSpace</span>
          <span>main</span>
          <span>{saved ? "✓ Saved" : "● Unsaved"}</span>
          <span>Errors: {problems.length}</span>
        </div>

        <div>
          <span>{activeFile?.type.toUpperCase() || "EDITOR"}</span>
          <span>UTF-8</span>
          <span>Spaces: 2</span>
        </div>
      </footer>

      {/* COMMAND PALETTE */}
      {paletteOpen && (
        <div
          className="palette-overlay"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="command-palette"
            onClick={event => event.stopPropagation()}
          >
            <input
              autoFocus
              placeholder="Type a command..."
              value={paletteQuery}
              onChange={event => setPaletteQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && visibleCommands[0]) {
                  visibleCommands[0].action();
                  setPaletteOpen(false);
                }
              }}
            />

            <div className="command-list">
              {visibleCommands.map(command => (
                <button
                  key={command.name}
                  onClick={() => {
                    command.action();
                    setPaletteOpen(false);
                  }}
                >
                  {command.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
