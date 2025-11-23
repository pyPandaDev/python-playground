# Python Playground

A modern, feature-rich Python development environment with both a code editor and Jupyter-style notebook interface. Perfect for data science, learning Python, and quick prototyping.

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-green.svg)
![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg)

## ✨ Features

### 🚀 Dual Mode Interface
- **Editor Mode**: Traditional code editor with file management
- **Notebook Mode**: Jupyter-style notebook with persistent execution context

### 📓 Jupyter-Like Notebook
- **Persistent Variables**: Variables, functions, and imports persist across cells (just like Jupyter!)
- **Markdown Support**: Create formatted documentation with auto-rendering markdown cells
- **Double-Click Editing**: Edit markdown cells by double-clicking
- **Code & Markdown Cells**: Mix executable code with rich documentation

### 📊 Data Science Ready
- **File Upload**: Drag & drop CSV, Excel, and JSON files
- **Pandas Integration**: Pre-configured pandas with complete DataFrame display
- **Full Data Output**: No truncation - see all rows and columns
- **Matplotlib Support**: Create and display plots inline

### 💻 Code Execution
- **Real-time Execution**: Run Python code with instant feedback
- **Input() Support**: Interactive input prompts
- **Error Handling**: Clear error messages with syntax highlighting
- **Unicode Support**: Full support for emojis and international characters

### 🎨 User Experience
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Theme**: Professional dark UI optimized for coding
- **Multi-File Support**: Create and manage multiple Python files
- **Monospaced Output**: Perfectly aligned tabular data display

## 🛠️ Technology Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **Uvicorn**: Lightning-fast ASGI server
- **Pandas**: Data manipulation and analysis
- **Matplotlib**: Plotting and visualization
- **NumPy**: Numerical computing

### Frontend
- **React 18**: Modern UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Next-generation build tool
- **TailwindCSS**: Utility-first CSS framework
- **Monaco Editor**: VS Code's editor component

## � Quick Start

### Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd playground
```

2. **Backend Setup**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

pip install -r requirements.txt
```

3. **Frontend Setup**
```bash
cd frontend
npm install
```

### Running the Application

**Option 1: Start All (Recommended)**
```bash
# From project root
.\start-all.bat  # Windows
```

**Option 2: Manual Start**

Terminal 1 - Backend:
```bash
cd backend
.\start.bat  # Windows
# or
python -m uvicorn main:app --reload --port 8000  # Any OS
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

## 📖 Usage Guide

### Editor Mode
1. Write Python code in the editor
2. Click "Run" or press the keyboard shortcut
3. View output in the terminal panel
4. Upload data files using the upload button

### Notebook Mode
1. Switch to "Notebook" mode from the header
2. **Code Cells**:
   - Write Python code
   - Click "Run" to execute
   - Variables persist to next cells
3. **Markdown Cells**:
   - Auto-render on creation
   - Double-click to edit
   - Click outside to save
4. Use "+ Code" / "+ Markdown" to add new cells

### Working with Data Files

**Upload Files:**
1. Click the upload icon
2. Select CSV, Excel, or JSON file
3. Access in code:
```python
import pandas as pd
df = pd.read_csv('your_file.csv')
print(df.describe())
```

**Persistent Context (Notebook Mode):**
```python
# Cell 1
import pandas as pd
df = pd.read_csv('data.csv')

# Cell 2 - df is still available!
print(df.head())
print(df.info())
```

## 🎯 Key Features Explained

### Persistent Notebook Context
Unlike running separate scripts, notebook cells share the same Python session:
- Variables defined in one cell are available in all subsequent cells
- Import statements persist
- Function and class definitions remain in memory
- Perfect for iterative data analysis

### Complete DataFrame Output
Pandas is pre-configured to show complete data:
- All rows displayed (no truncation)
- All columns visible
- Full column content
- Properly aligned in monospaced font

### Responsive Design
The interface adapts to your screen:
- **Desktop**: Side-by-side editor and output
- **Tablet**: Stacked layout with full-width panels
- **Mobile**: Optimized controls and compact UI

## 🔧 Configuration

### Backend
Edit `backend/main.py` to customize:
- Execution timeout (default: 120 seconds)
- Upload directory
- Pandas display options
- CORS settings

### Frontend
Edit `frontend/src/components/PythonLab.tsx` to customize:
- Editor themes
- UI colors
-Panel sizes

## 🐛 Troubleshooting

### Backend won't start
- Ensure virtual environment is activated
- Check if port 8000 is available
- Verify all dependencies are installed: `pip install -r requirements.txt`

### Frontend won't start
- Delete `node_modules` and run `npm install` again
- Check if port 5173 is available
- Clear npm cache: `npm cache clean --force`

### Notebook variables not persisting
- Ensure you're in "Notebook" mode
- Check that each cell shows "Run" button (not just code cells)
- Verify backend is running on port 8000

### DataFrame output truncated
- This has been fixed! All data should display
- If issues persist, check browser console for errors

## 📁 Project Structure

```
playground/
├── backend/
│   ├── venv/              # Python virtual environment
│   ├── main.py            # FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── start.bat         # Backend startup script
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   └── services/     # API client
│   ├── package.json
│   └── vite.config.ts
├── docs/                 # Documentation
├── .gitignore
├── README.md
└── start-all.bat        # Start both frontend and backend
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Monaco Editor by Microsoft
- FastAPI framework
- React and the amazing React ecosystem
- Tailwind CSS for the beautiful UI

---

**Happy Coding! 🚀**
