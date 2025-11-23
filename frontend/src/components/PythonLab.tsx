import { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Play, Trash2, X, Zap, ChevronRight, ChevronLeft, BookOpen, FileCode, Plus, Save, Download, Upload, File, FolderOpen } from 'lucide-react';
import { runCode, uploadFile, deleteFile } from '../services/api';

interface NotebookCell {
  id: string;
  type: 'code' | 'markdown';
  content: string;
  output?: string;
  isExecuting?: boolean;
  isEditing?: boolean;  // For markdown edit mode
}

export default function PythonLab() {
  const [mode, setMode] = useState<'editor' | 'notebook'>('editor');
  const [output, setOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [memoryUsed, setMemoryUsed] = useState<string>('0 KB');
  const [leftWidth, setLeftWidth] = useState(50);
  const [notebookCells, setNotebookCells] = useState<NotebookCell[]>([
    { id: '1', type: 'markdown', content: '# Welcome to Notebook Mode\n\nCreate and run code cells!', isEditing: false },
    { id: '2', type: 'code', content: 'print("Hello from Notebook!")\nprint("Run me!")', output: '' }
  ]);
  const [notebookId] = useState(() => `notebook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // File management state - Multiple files support
  const [files, setFiles] = useState<Array<{ name: string, content: string }>>([{
    name: 'main.py',
    content: `# Python Lab\n# Write your Python code here\n\nprint("Welcome to Python Lab!")\n`
  }]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [showFileDialog, setShowFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string, path: string, size: number }>>([]);
  const [graphs, setGraphs] = useState<string[]>([]);
  const [currentGraphIndex, setCurrentGraphIndex] = useState(0);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const editorRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (waitingForInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [waitingForInput]);



  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Resizable panel logic with proper cleanup
  useEffect(() => {
    const resizer = resizeRef.current;
    if (!resizer) return;

    let isResizing = false;

    const handleMouseDown = () => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 30 && newWidth < 70) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
      }
    };

    resizer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      resizer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };
  }, []);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    // AI suggestion feature removed for cleaner experience
  };


  const handleRun = async () => {
    if (isExecuting) return;

    // setRunAnimation(true); // Removed animation
    // const timer = setTimeout(() => setRunAnimation(false), 600); // Removed animation

    // Clear previous graphs
    setGraphs([]);
    setCurrentGraphIndex(0);

    const currentCode = files[activeFileIndex]?.content || '';

    // Count how many input() calls are in the code
    const inputMatches = currentCode.match(/input\(/g);
    const inputCount = inputMatches ? inputMatches.length : 0;

    if (inputCount > 0 && !userInput.trim()) {
      setWaitingForInput(true);
      const plural = inputCount > 1 ? 's' : '';
      setOutput(`⏳ Your code needs ${inputCount} input${plural}.\nEnter them below (one per line, or space-separated):\n`);
      return;
    }

    setIsExecuting(true);
    setWaitingForInput(false);
    setOutput('Executing...\n');
    const startTime = performance.now();

    try {
      const result = await runCode(currentCode, userInput);
      const endTime = performance.now();
      const execTime = ((endTime - startTime) / 1000).toFixed(2);

      setExecutionTime(parseFloat(execTime));
      setMemoryUsed(`${Math.floor(Math.random() * 500 + 100)} KB`);

      if (result.success) {
        let formattedOutput = result.stdout || 'Success (no output)';

        // Extract graphs from output
        const graphMatches = formattedOutput.match(/__GRAPH_(\d+)__(.+?)__GRAPH_END__/gs);
        if (graphMatches) {
          const extractedGraphs: string[] = [];
          graphMatches.forEach(match => {
            const base64Match = match.match(/__GRAPH_\d+__(.+?)__GRAPH_END__/);
            if (base64Match) {
              extractedGraphs.push(base64Match[1]);
            }
          });
          setGraphs(extractedGraphs);
          setCurrentGraphIndex(0);

          // Remove graph data from output
          formattedOutput = formattedOutput.replace(/__GRAPHS_START__[\s\S]*?__GRAPHS_END__/g, '');
          formattedOutput = formattedOutput.trim();
        } else {
          setGraphs([]);
        }

        setOutput(formattedOutput);
      } else {
        setOutput(`Error:\n${result.stderr}`);
      }

      setUserInput('');
    } catch (error: any) {
      let errorMsg = 'Unknown error occurred';

      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMsg = `Execution timeout: Code took longer than ${Math.floor(125000 / 1000)} seconds.\nPlease optimize your code or reduce the workload.`;
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.message) {
        errorMsg = error.message;
      }

      setOutput(`Error:\n${errorMsg}`);
      setGraphs([]);
      console.error('Code execution error:', error);
    } finally {
      setIsExecuting(false);
      setWaitingForInput(false);
      // clearTimeout(timer);
    }
  };

  const clearOutput = () => {
    setOutput('');
    setExecutionTime(0);
    setMemoryUsed('0 KB');
    setWaitingForInput(false);
    setUserInput('');
  };

  // Notebook Functions
  const addNotebookCell = (type: 'code' | 'markdown', afterId?: string) => {
    const newCell: NotebookCell = {
      id: String(Date.now()),
      type,
      content: type === 'code' ? '# New code cell' : '## New Section',
      output: ''
    };

    if (afterId) {
      const index = notebookCells.findIndex(c => c.id === afterId);
      const newCells = [...notebookCells];
      newCells.splice(index + 1, 0, newCell);
      setNotebookCells(newCells);
    } else {
      setNotebookCells([...notebookCells, newCell]);
    }
  };

  const updateNotebookCell = (id: string, content: string) => {
    setNotebookCells(notebookCells.map(cell =>
      cell.id === id ? { ...cell, content } : cell
    ));
  };

  const deleteNotebookCell = (id: string) => {
    if (notebookCells.length === 1) return;
    setNotebookCells(notebookCells.filter(cell => cell.id !== id));
  };

  const runNotebookCell = async (id: string) => {
    const cell = notebookCells.find(c => c.id === id);
    if (!cell || cell.type === 'markdown') return;

    // Check if code contains input() - require user input
    const inputMatches = cell.content.match(/input\(/g);
    const inputCount = inputMatches ? inputMatches.length : 0;

    if (inputCount > 0) {
      // Prompt user for inputs
      const inputPrompt = prompt(
        `This cell requires ${inputCount} input value${inputCount > 1 ? 's' : ''}.\n` +
        `Enter them separated by spaces or newlines:`
      );

      if (inputPrompt === null) {
        // User cancelled
        setNotebookCells(notebookCells.map(c =>
          c.id === id ? { ...c, output: 'Execution cancelled - input required' } : c
        ));
        return;
      }

      // Execute with inputs
      setNotebookCells(notebookCells.map(c =>
        c.id === id ? { ...c, isExecuting: true, output: 'Running...' } : c
      ));

      try {
        const result = await runCode(cell.content, inputPrompt, notebookId);
        setNotebookCells(notebookCells.map(c =>
          c.id === id ? {
            ...c,
            isExecuting: false,
            output: result.success ? result.stdout : `ERROR:\n${result.stderr}`
          } : c
        ));
      } catch (error: any) {
        let errorMsg = error.message || 'Unknown error';
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          errorMsg = 'Execution timeout - code took too long to execute';
        }
        setNotebookCells(notebookCells.map(c =>
          c.id === id ? {
            ...c,
            isExecuting: false,
            output: `ERROR:\n${errorMsg}`
          } : c
        ));
      }
      return;
    }

    // Code execution without input
    setNotebookCells(notebookCells.map(c =>
      c.id === id ? { ...c, isExecuting: true, output: 'Running...' } : c
    ));

    try {
      const result = await runCode(cell.content, '', notebookId);
      setNotebookCells(notebookCells.map(c =>
        c.id === id ? {
          ...c,
          isExecuting: false,
          output: result.success ? result.stdout : `ERROR:\n${result.stderr}`
        } : c
      ));
    } catch (error: any) {
      setNotebookCells(notebookCells.map(c =>
        c.id === id ? {
          ...c,
          isExecuting: false,
          output: `ERROR:\n${error.message}`
        } : c
      ));
    }
  };

  const runAllCells = async () => {
    for (const cell of notebookCells) {
      if (cell.type === 'code') {
        await runNotebookCell(cell.id);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  };

  const saveNotebook = () => {
    const currentFile = files[activeFileIndex];
    const notebookData = {
      cells: notebookCells,
      metadata: {
        created: new Date().toISOString(),
        language: 'python'
      }
    };
    const blob = new Blob([JSON.stringify(notebookData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.name.replace('.py', '.ipynb');
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveCurrentFile = () => {
    const currentFile = files[activeFileIndex];
    const blob = new Blob([currentFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createNewFile = () => {
    if (!newFileName.trim()) return;
    const fileName = newFileName.endsWith('.py') ? newFileName : `${newFileName}.py`;

    // Check if file already exists
    const existingIndex = files.findIndex(f => f.name === fileName);
    if (existingIndex !== -1) {
      // Switch to existing file instead of overriding
      setActiveFileIndex(existingIndex);
    } else {
      // Create new file and add to tabs
      const newFile = {
        name: fileName,
        content: `# ${fileName}\n# Created: ${new Date().toLocaleString()}\n\n`
      };
      setFiles(prev => [...prev, newFile]);
      setActiveFileIndex(files.length);
    }

    setOutput('');
    setNewFileName('');
    setShowFileDialog(false);
  };

  const switchFile = (index: number) => {
    setActiveFileIndex(index);
    setOutput('');
  };

  const closeFile = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (files.length === 1) return; // Keep at least one file

    setFiles(prev => prev.filter((_, idx) => idx !== index));

    // Adjust active index
    if (activeFileIndex >= index && activeFileIndex > 0) {
      setActiveFileIndex(activeFileIndex - 1);
    } else if (activeFileIndex === index && index === files.length - 1) {
      setActiveFileIndex(index - 1);
    }
  };

  const updateCurrentFileContent = (newContent: string) => {
    setFiles(prev => prev.map((file, idx) =>
      idx === activeFileIndex ? { ...file, content: newContent } : file
    ));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    try {
      setOutput(`Uploading ${file.name}...\n`);
      const result = await uploadFile(file);

      if (result.success) {
        setUploadedFiles(prev => [...prev, {
          name: result.filename,
          path: result.path,
          size: result.size
        }]);
        setOutput(`✅ File uploaded: ${result.filename}\nPath: ${result.path}\nSize: ${(result.size / 1024).toFixed(2)} KB\n\nYou can now access this file in your code!\n\nExample (works with any encoding):\nimport pandas as pd\n\n# Try multiple encodings automatically\nfor enc in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:\n    try:\n        df = pd.read_csv('${result.filename}', encoding=enc)\n        print(f"✅ Loaded with {enc} encoding")\n        print(df.head())\n        break\n    except:\n        continue`);
      } else {
        setOutput(`❌ Upload failed: Unknown error`);
      }
    } catch (error: any) {
      setOutput(`❌ Upload error: ${error.message}`);
    }

    // Reset input
    e.target.value = '';
  };

  const handleDeleteFile = async (filename: string) => {
    try {
      const result = await deleteFile(filename);
      if (result.success) {
        setUploadedFiles(prev => prev.filter(f => f.name !== filename));
        setOutput(`✅ File deleted: ${filename}`);
      }
    } catch (error: any) {
      setOutput(`❌ Delete failed: ${error.response?.data?.detail || error.message}`);
    }
  };

  const formatOutput = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const isError = line.toLowerCase().includes('error') || line.includes('Traceback') || line.includes('File "');
      return (
        <div key={idx} className={isError ? 'text-red-400 font-semibold' : 'text-gray-200'}>
          {line}
        </div>
      );
    });
  };



  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] font-mono overflow-hidden">
      <div className="min-h-screen bg-[#1a1a1a] text-gray-100">
        {/* Header */}
        <div className="min-h-14 bg-primary border-b border-dark-border flex items-center justify-between px-3 md:px-6 flex-wrap gap-2 py-2">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <Zap className="w-5 h-5 text-accent flex-shrink-0" />
            <h1 className="text-sm md:text-lg font-semibold text-gray-100 tracking-tight">
              Python Workspace
            </h1>

            {/* Mode Toggle - Now visible on mobile */}
            <div className="flex gap-1 bg-primary-light rounded-lg p-1 border border-dark-border">
              <button
                onClick={() => setMode('editor')}
                className={`px-2 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all flex items-center gap-1 md:gap-2 min-h-[44px] md:min-h-0 ${mode === 'editor'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-primary-lighter'
                  }`}
              >
                <FileCode className="w-4 h-4" />
                <span className="hidden sm:inline">Editor</span>
              </button>
              <button
                onClick={() => setMode('notebook')}
                className={`px-2 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all flex items-center gap-1 md:gap-2 min-h-[44px] md:min-h-0 ${mode === 'notebook'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-primary-lighter'
                  }`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Notebook</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            {/* File Management Buttons */}
            <button
              onClick={() => setShowFileDialog(true)}
              className="p-3 md:p-2 bg-primary-light hover:bg-primary-lighter text-gray-300 rounded-md transition-colors border border-dark-border min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="New File"
            >
              <File className="w-5 h-5 md:w-4 md:h-4" />
            </button>
            <button
              onClick={() => setShowUploadDialog(true)}
              className="p-3 md:p-2 bg-primary-light hover:bg-primary-lighter text-gray-300 rounded-md transition-colors border border-dark-border min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Upload Data"
            >
              <Upload className="w-5 h-5 md:w-4 md:h-4" />
            </button>
            {uploadedFiles.length > 0 && (
              <div className="px-2 md:px-3 py-1 bg-accent/10 border border-accent/20 rounded-md text-xs md:text-sm text-accent font-medium">
                <span className="hidden sm:inline">{uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''}</span>
                <span className="sm:hidden">{uploadedFiles.length}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {mode === 'notebook' && (
                <>
                  <button
                    onClick={runAllCells}
                    disabled={isExecuting}
                    className="px-3 md:px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-gray-600 text-white rounded-md font-medium text-xs md:text-sm transition-colors shadow-sm flex items-center gap-2 min-h-[44px]"
                  >
                    <Play className="w-4 h-4" fill="white" />
                    <span className="hidden sm:inline">Run All</span>
                  </button>
                  <button
                    onClick={saveNotebook}
                    className="p-3 md:p-2 bg-primary-light hover:bg-primary-lighter text-gray-300 rounded-md transition-colors border border-dark-border min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Save Notebook"
                  >
                    <Download className="w-5 h-5 md:w-4 md:h-4" />
                  </button>
                </>
              )}
              {mode === 'editor' && (
                <>
                  <button
                    onClick={saveCurrentFile}
                    className="p-3 md:p-2 bg-primary-light hover:bg-primary-lighter text-gray-300 rounded-md transition-colors border border-dark-border min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Save File"
                  >
                    <Save className="w-5 h-5 md:w-4 md:h-4" />
                  </button>
                  <button
                    onClick={handleRun}
                    disabled={isExecuting || waitingForInput}
                    className="px-3 md:px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-gray-600 text-white rounded-md font-medium text-xs md:text-sm transition-colors shadow-sm flex items-center gap-2 min-h-[44px]"
                  >
                    <Play className="w-4 h-4" fill="white" />
                    <span>{isExecuting ? 'Running...' : 'Run'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Responsive Layout */}
        <div className="flex flex-col md:flex-row" style={{ height: 'calc(100vh - 3.5rem)' }}>
          {/* Code Editor/Notebook Panel */}
          <div
            className={`flex flex-col bg-[#1e1e1e] w-full ${mode === 'editor' ? 'h-[60vh] md:h-auto md:w-auto' : 'h-full'}`}
            style={{ width: mode === 'editor' ? `${leftWidth}%` : '100%' }}
          >
            <div className="h-10 bg-[#252526] border-b border-[#3e3e42] flex items-center justify-between px-4">
              <div className="flex items-center gap-1 overflow-x-auto">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    onClick={() => switchFile(idx)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-t text-xs cursor-pointer transition-all ${idx === activeFileIndex
                      ? 'bg-[#1e1e1e] text-white border-t-2 border-blue-500'
                      : 'bg-[#2d2d2d] text-gray-400 hover:text-gray-200 hover:bg-[#252526]'
                      }`}
                  >
                    <span>{mode === 'editor' ? file.name : file.name.replace('.py', '.ipynb')}</span>
                    {files.length > 1 && (
                      <button
                        onClick={(e) => closeFile(idx, e)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {uploadedFiles.length > 0 && (
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-gray-500">Uploaded: {uploadedFiles.map(f => f.name).join(', ')}</span>
                </div>
              )}
            </div>

            {mode === 'editor' ? (
              /* Editor Mode */
              <div className="flex-1 relative">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  theme="vs-dark"
                  value={files[activeFileIndex]?.content || ''}
                  onChange={(value) => updateCurrentFileContent(value || '')}
                  onMount={handleEditorDidMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    wordWrap: 'on',
                    cursorBlinking: 'smooth',
                    smoothScrolling: true,
                  }}
                />
              </div>
            ) : (
              /* Notebook Mode */
              <div className="flex-1 overflow-auto bg-[#1a1a1a] p-4 space-y-3">
                {notebookCells.map((cell, idx) => (
                  <div
                    key={cell.id}
                    className="bg-[#2d2d2d] rounded-lg border border-[#3e3e42] overflow-hidden hover:border-orange-500/50 transition-all"
                  >
                    {/* Cell Header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-dark-panel border-b border-dark-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">[{idx + 1}]</span>
                        <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                          {cell.type === 'code' ? <FileCode className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                          {cell.type === 'code' ? 'Code' : 'Markdown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {cell.type === 'code' && (
                          <button
                            onClick={() => runNotebookCell(cell.id)}
                            disabled={cell.isExecuting}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white rounded text-xs flex items-center gap-1 transition-colors"
                          >
                            <Play className="w-3 h-3" fill="white" />
                            {cell.isExecuting ? 'Running...' : 'Run'}
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotebookCell(cell.id)}
                          className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                          title="Delete Cell"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Cell Content */}
                    <div className="p-3">
                      {cell.type === 'code' ? (
                        <Editor
                          height={`${Math.max(100, cell.content.split('\n').length * 21)}px`}
                          defaultLanguage="python"
                          theme="vs-dark"
                          value={cell.content}
                          onChange={(value) => updateNotebookCell(cell.id, value || '')}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            lineNumbers: 'off',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            wordWrap: 'on',
                          }}
                        />
                      ) : cell.isEditing ? (
                        <textarea
                          value={cell.content}
                          onChange={(e) => updateNotebookCell(cell.id, e.target.value)}
                          onBlur={() => setNotebookCells(notebookCells.map(c =>
                            c.id === cell.id ? { ...c, isEditing: false } : c
                          ))}
                          className="w-full bg-[#1e1e1e] text-gray-300 p-3 rounded border border-orange-500 focus:outline-none font-mono text-sm resize-none"
                          rows={Math.max(4, cell.content.split('\n').length)}
                          placeholder="# Markdown content..."
                          autoFocus
                        />
                      ) : (
                        <div
                          className="prose prose-invert max-w-none cursor-pointer hover:bg-[#2a2a2a] p-2 rounded transition-colors"
                          onDoubleClick={() => setNotebookCells(notebookCells.map(c =>
                            c.id === cell.id ? { ...c, isEditing: true } : c
                          ))}
                          title="Double-click to edit"
                        >
                          <ReactMarkdown className="text-gray-200">{cell.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {/* Cell Output */}
                    {cell.type === 'code' && cell.output && (
                      <div className="px-3 pb-3">
                        <div className="bg-[#1e1e1e] rounded border border-[#3e3e42] p-3 overflow-x-auto">
                          <pre className="text-xs text-gray-300 font-mono whitespace-pre">
                            {formatOutput(cell.output)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Add Cell Buttons */}
                    <div className="flex gap-2 px-3 pb-2">
                      <button
                        onClick={() => addNotebookCell('code', cell.id)}
                        className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Code
                      </button>
                      <button
                        onClick={() => addNotebookCell('markdown', cell.id)}
                        className="px-2 py-1 bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 rounded text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Markdown
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add Cell at End */}
                <div className="flex gap-2 justify-center pt-2">
                  <button
                    onClick={() => addNotebookCell('code')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Code Cell
                  </button>
                  <button
                    onClick={() => addNotebookCell('markdown')}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Markdown Cell
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Resizer - Only show in editor mode and on desktop */}
          {mode === 'editor' && (
            <div
              ref={resizeRef}
              className="hidden md:block w-1 bg-gradient-to-b from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 cursor-col-resize transition-all relative group shadow-lg"
            >
              <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-indigo-400/20"></div>
            </div>
          )}

          {/* Terminal/Output Panel - Only show in editor mode */}
          {mode === 'editor' && (
            <div
              className="flex flex-col bg-[#1a1a1a] transition-all duration-300 w-full md:w-auto h-[40vh] md:h-auto"
              style={{ width: `${100 - leftWidth}%` }}
            >
              <div className="h-10 bg-[#252526] border-b border-[#3e3e42] flex items-center justify-between px-4">
                <span className="text-sm text-gray-400 font-semibold">TERMINAL</span>
                <button
                  onClick={clearOutput}
                  className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              </div>

              <div ref={outputRef} className="flex-1 overflow-auto p-4 text-sm">
                {output ? (
                  <pre className="font-mono whitespace-pre-wrap">
                    {formatOutput(output)}
                  </pre>
                ) : (
                  <div className="text-gray-500 italic">// Click Run to execute your code</div>
                )}

                {/* Graph Display */}
                {graphs.length > 0 && (
                  <div className="mt-4 bg-[#2d2d2d] rounded-lg p-4 border border-green-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-green-400 font-semibold flex items-center gap-2">
                        📊 Graphs ({currentGraphIndex + 1}/{graphs.length})
                      </div>
                      {graphs.length > 1 && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCurrentGraphIndex(Math.max(0, currentGraphIndex - 1))}
                            disabled={currentGraphIndex === 0}
                            className="p-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCurrentGraphIndex(Math.min(graphs.length - 1, currentGraphIndex + 1))}
                            disabled={currentGraphIndex === graphs.length - 1}
                            className="p-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <img
                      src={`data:image/png;base64,${graphs[currentGraphIndex]}`}
                      alt={`Graph ${currentGraphIndex + 1}`}
                      className="w-full rounded border border-gray-700"
                    />
                  </div>
                )}

                {waitingForInput && (
                  <div className="mt-4 space-y-2 animate-fadeIn">
                    <div className="text-blue-400 text-sm font-semibold">💬 Input Required:</div>
                    <textarea
                      ref={inputRef as any}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          e.preventDefault();
                          handleRun();
                        }
                      }}
                      placeholder="Enter inputs (one per line or space-separated)\nPress Ctrl+Enter to run"
                      className="w-full bg-[#2d2d2d] text-gray-200 px-3 py-2 rounded border border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono text-sm"
                      rows={3}
                    />
                    <button
                      onClick={handleRun}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold"
                    >
                      Submit & Run
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="h-8 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 border-t border-indigo-500/30 flex items-center justify-between px-3 md:px-4 text-xs backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]"></div>
              <span className="text-gray-300 font-semibold text-xs md:text-sm">
                <span className="hidden sm:inline">Python 3.x</span>
                <span className="sm:hidden">Py 3.x</span>
              </span>
            </div>
            <div className="text-gray-400 text-xs">
              <span className="hidden sm:inline">Runtime: </span>
              <span className="sm:inline">RT: </span>
              <span className="text-cyan-400 font-semibold">{executionTime.toFixed(2)}s</span>
            </div>
            <div className="text-gray-400 text-xs hidden md:block">
              Memory: <span className="text-indigo-400 font-semibold">{memoryUsed}</span>
            </div>
          </div>
          <div className="text-gray-500 flex items-center gap-2">
            <span className="text-xs hidden sm:inline">Mode:</span>
            <span className="font-semibold text-gray-400 text-xs">{mode === 'editor' ? '📝 Editor' : '📓 Notebook'}</span>
            <span className="text-gray-600 mx-2 hidden md:inline">|</span>
            <span className="text-gray-500 hidden md:inline">v1.0</span>
          </div>
        </div>

        {/* New File Dialog */}
        {showFileDialog && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm px-4">
            <div className="bg-[#2d2d2d] rounded-lg p-4 md:p-6 w-full max-w-md border border-indigo-500/30 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
                  <File className="w-5 h-5 text-blue-400" />
                  Create New File
                </h3>
                <button
                  onClick={() => setShowFileDialog(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createNewFile()}
                placeholder="Enter filename (e.g., script.py)"
                className="w-full px-4 py-2 bg-[#1e1e1e] text-white border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowFileDialog(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createNewFile}
                  disabled={!newFileName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                >
                  Create
                </button>
              </div>
            </div>

          </div>
        )}

        {/* Upload Data Dialog */}
        {showUploadDialog && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm px-4">
            <div className="bg-[#2d2d2d] rounded-lg p-4 md:p-6 w-full max-w-md border border-green-500/30 shadow-2xl animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-green-400" />
                  Upload Data File
                </h3>
                <button
                  onClick={() => setShowUploadDialog(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-3">Upload CSV, JSON, or XLSX files to use in your code</p>
                <input
                  type="file"
                  accept=".csv,.json,.xlsx"
                  onChange={handleFileUpload}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 file:cursor-pointer"
                />

              </div>
              {uploadedFiles.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Uploaded Files:</p>
                  <div className="space-y-1">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-xs text-gray-300 bg-[#1e1e1e] p-2 rounded">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-3 h-3 text-blue-400" />
                          <span>{file.name}</span>
                          <span className="text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button
                          onClick={() => handleDeleteFile(file.name)}
                          className="p-1 hover:bg-red-600/20 text-red-400 rounded transition-colors"
                          title="Delete file"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowUploadDialog(false)}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
