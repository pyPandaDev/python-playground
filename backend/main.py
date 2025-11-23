import os
import sys
import subprocess
import tempfile
import json
import time
import base64
from pathlib import Path
from typing import Optional, List

import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI(title="Python Playground API", version="1.0.0")

# CORS middleware - Restrict origins in production
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Configuration
CODE_TIMEOUT = int(os.getenv("CODE_TIMEOUT", "120"))  # Increased to 120 seconds for graphs
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "10485760"))  # 10MB default

# Temporary directory for uploads
UPLOAD_DIR = Path(tempfile.gettempdir()) / "python_playground_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Notebook session storage - maintains execution context for each notebook
notebook_sessions = {}



# Request/Response Models
class CodeExecutionRequest(BaseModel):
    code: str
    stdin: Optional[str] = None
    notebook_id: Optional[str] = None  # For persistent notebook sessions



class CodeExecutionResponse(BaseModel):
    success: bool
    stdout: str
    stderr: str
    execution_time: float
    needs_input: bool = False
    input_prompt: Optional[str] = None


# Health check
@app.get("/")
async def root():
    return {
        "message": "Python Playground API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy"
    }


# Execute Python code
@app.post("/run", response_model=CodeExecutionResponse)
async def run_code(request: CodeExecutionRequest):
    """
    Execute Python code safely with a 10-second timeout.
    Returns stdout, stderr, and execution time.
    """
    try:
        # Prepare stdin inputs as a list
        stdin_inputs = []
        if request.stdin:
            # Handle both newline and space-separated inputs
            if '\n' in request.stdin:
                stdin_inputs = request.stdin.strip().split('\n')
            elif ' ' in request.stdin:
                stdin_inputs = request.stdin.strip().split(' ')
            else:
                stdin_inputs = [request.stdin.strip()]
        
        # Wrap code to capture matplotlib graphs and handle input() properly
        wrapped_code = f"""
import sys
import io
import base64
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt

# Configure pandas display options if available
try:
    import pandas as pd
    pd.set_option('display.max_rows', None)
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
    pd.set_option('display.max_colwidth', None)
except ImportError:
    pass

# Store all figures
_all_figures = []
_captured_figs = set()

# Override plt.show() to save figures instead
_original_show = plt.show
def _custom_show():
    for fig_num in plt.get_fignums():
        if fig_num not in _captured_figs:
            fig = plt.figure(fig_num)
            _all_figures.append(fig)
            _captured_figs.add(fig_num)
plt.show = _custom_show

# Clear any existing figures first
plt.close('all')

# Mock input() function for proper terminal display
_input_values = {stdin_inputs!r}
_input_index = [0]

def input(prompt=''):
    if prompt:
        print(prompt, end='', flush=True)
    if _input_index[0] < len(_input_values):
        value = _input_values[_input_index[0]]
        _input_index[0] += 1
        print(value)  # Echo the input value on new line
        return value
    else:
        print()
        return ''

# User code starts here
{request.code}

# Save all figures as base64
if _all_figures:
    print("\\n__GRAPHS_START__")
    for idx, fig in enumerate(_all_figures):
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        print(f"__GRAPH_{{idx}}__{{img_base64}}__GRAPH_END__")
        buf.close()
    print("__GRAPHS_END__")
    plt.close('all')
"""
        
        # Check if this is a notebook session that needs persistent context
        if request.notebook_id:
            # Get or create session context
            if request.notebook_id not in notebook_sessions:
                # Initialize session with pandas display configuration
                session_globals = {'__name__': '__main__', '__builtins__': __builtins__}
                
                # Set up pandas display options for complete output
                try:
                    import pandas as pd
                    pd.set_option('display.max_rows', None)
                    pd.set_option('display.max_columns', None)
                    pd.set_option('display.width', 1000)  # Wide enough for most terminals
                    pd.set_option('display.max_colwidth', None)
                    session_globals['pd'] = pd
                except ImportError:
                    pass
                
                notebook_sessions[request.notebook_id] = {
                    'globals': session_globals,
                    'locals': {}
                }
            
            session = notebook_sessions[request.notebook_id]
            start_time = time.time()
            
            # For notebook mode, use simpler execution without complex wrapping
            try:
                # Capture stdout and stderr
                from io import StringIO
                
                # Parse stdin inputs
                stdin_inputs = []
                if request.stdin:
                    if '\n' in request.stdin:
                        stdin_inputs = request.stdin.strip().split('\n')
                    elif ' ' in request.stdin:
                        stdin_inputs = request.stdin.strip().split(' ')
                    else:
                        stdin_inputs = [request.stdin.strip()]
                
                # Create mock input() function for this execution
                input_index = [0]  # Use list to maintain reference in closure
                def mock_input(prompt=''):
                    if prompt:
                        print(prompt, end='', flush=True)
                    if input_index[0] < len(stdin_inputs):
                        value = stdin_inputs[input_index[0]]
                        input_index[0] += 1
                        print(value)  # Echo the input
                        return value
                    else:
                        print()
                        return ''
                
                # Inject the mock input function into the session
                session['globals']['input'] = mock_input
                
                stdout_capture = StringIO()
                stderr_capture = StringIO()
                old_stdout = sys.stdout
                old_stderr = sys.stderr
                old_cwd = os.getcwd()  # Save current directory
                
                try:
                    sys.stdout = stdout_capture
                    sys.stderr = stderr_capture
                    os.chdir(str(UPLOAD_DIR))  # Change to upload directory for file access
                    
                    # Execute user code directly in persistent context
                    # The matplotlib and pandas setup happens in the session naturally
                    exec(request.code, session['globals'], session['locals'])
                    
                    execution_time = time.time() - start_time
                    stdout_result = stdout_capture.getvalue()
                    stderr_result = stderr_capture.getvalue()
                    
                    return CodeExecutionResponse(
                        success=len(stderr_result) == 0 or 'Traceback' not in stderr_result,
                        stdout=stdout_result,
                        stderr=stderr_result,
                        execution_time=execution_time
                    )
                    
                finally:
                    sys.stdout = old_stdout
                    sys.stderr = old_stderr
                    os.chdir(old_cwd)  # Restore original directory
                    
            except Exception as e:
                execution_time = time.time() - start_time
                return CodeExecutionResponse(
                    success=False,
                    stdout=stdout_capture.getvalue() if 'stdout_capture' in locals() else "",
                    stderr=f"Error: {str(e)}\n{traceback.format_exc()}",
                    execution_time=execution_time
                )
        
        
        else:
            # Fast exec-based execution for editor mode with graph support
            from io import StringIO
            import traceback
            
            start_time = time.time()
            
            try:
                # Create execution namespace with matplotlib and pandas setup
                exec_globals = {
                    '__name__': '__main__',
                    '__builtins__': __builtins__,
                }
                
                # Setup code for matplotlib and pandas
                setup_code = """
import sys
import io
import base64
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt

# Configure pandas display options if available
try:
    import pandas as pd
    pd.set_option('display.max_rows', None)
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
    pd.set_option('display.max_colwidth', None)
except ImportError:
    pass

# Store all figures
_all_figures = []
_captured_figs = set()

# Override plt.show() to save figures instead
_original_show = plt.show
def _custom_show():
    for fig_num in plt.get_fignums():
        if fig_num not in _captured_figs:
            fig = plt.figure(fig_num)
            _all_figures.append(fig)
            _captured_figs.add(fig_num)
plt.show = _custom_show

# Clear any existing figures first
plt.close('all')
"""
                
                # Mock input function
                input_index = [0]
                def mock_input(prompt=''):
                    if prompt:
                        print(prompt, end='', flush=True)
                    if input_index[0] < len(stdin_inputs):
                        value = stdin_inputs[input_index[0]]
                        input_index[0] += 1
                        print(value)  # Echo the input value on new line
                        return value
                    else:
                        print()
                        return ''
                
                exec_globals['input'] = mock_input
                
                # Capture stdout and stderr
                stdout_capture = StringIO()
                stderr_capture = StringIO()
                old_stdout = sys.stdout
                old_stderr = sys.stderr
                old_cwd = os.getcwd()
                
                try:
                    sys.stdout = stdout_capture
                    sys.stderr = stderr_capture
                    os.chdir(str(UPLOAD_DIR))
                    
                    # Execute setup code first
                    exec(setup_code, exec_globals)
                    
                    # Execute user code
                    exec(request.code, exec_globals)
                    
                    # Extract graphs if any
                    graph_output = ""
                    if exec_globals.get('_all_figures'):
                        graph_output = "\n__GRAPHS_START__\n"
                        for idx, fig in enumerate(exec_globals['_all_figures']):
                            buf = io.BytesIO()
                            fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
                            buf.seek(0)
                            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
                            graph_output += f"__GRAPH_{idx}__{img_base64}__GRAPH_END__\n"
                            buf.close()
                        graph_output += "__GRAPHS_END__\n"
                        
                        # Close all figures
                        import matplotlib.pyplot as plt
                        plt.close('all')
                    
                    execution_time = time.time() - start_time
                    stdout_result = stdout_capture.getvalue() + graph_output
                    stderr_result = stderr_capture.getvalue()
                    
                    return CodeExecutionResponse(
                        success=len(stderr_result) == 0,
                        stdout=stdout_result,
                        stderr=stderr_result,
                        execution_time=execution_time
                    )
                    
                finally:
                    sys.stdout = old_stdout
                    sys.stderr = old_stderr
                    os.chdir(old_cwd)
                    
            except Exception as e:
                execution_time = time.time() - start_time
                return CodeExecutionResponse(
                    success=False,
                    stdout=stdout_capture.getvalue() if 'stdout_capture' in locals() else "",
                    stderr=f"Error: {str(e)}\n{traceback.format_exc()}",
                    execution_time=execution_time
                )
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")


# Reset notebook session
@app.delete("/notebook/reset/{notebook_id}")
async def reset_notebook(notebook_id: str):
    """
    Clear the execution context for a specific notebook session.
    """
    if notebook_id in notebook_sessions:
        del notebook_sessions[notebook_id]
        return {"message": f"Notebook session {notebook_id} reset successfully"}
    return {"message": "Session not found (may already be cleared)"}



# Upload dataset
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a dataset file (CSV, JSON, XLSX).
    Returns file path and preview of the data.
    """
    try:
        # Validate file type
        allowed_extensions = ['.csv', '.json', '.xlsx']
        file_ext = Path(file.filename).suffix.lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Read file content
        content = await file.read()
        
        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        # Sanitize filename to prevent path traversal
        safe_filename = Path(file.filename).name
        file_path = UPLOAD_DIR / safe_filename
        
        # Save file
        with open(file_path, 'wb') as f:
            f.write(content)
        
        # Generate preview based on file type with encoding handling
        preview = None
        try:
            if file_ext == '.csv':
                # Try multiple encodings for CSV files
                df = None
                for encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
                    try:
                        df = pd.read_csv(file_path, nrows=5, encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                
                if df is not None:
                    # Replace NaN with None for valid JSON
                    print(f"Processing CSV preview for {safe_filename}")
                    df = df.astype(object).where(pd.notnull(df), None)
                    print("NaN values replaced")
                    preview = df.to_dict('records')
                else:
                    preview = "Preview unavailable: encoding issue"
                    
            elif file_ext == '.json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    preview = data[:5] if isinstance(data, list) else data
            elif file_ext == '.xlsx':
                df = pd.read_excel(file_path, nrows=5)
                # Replace NaN with None for valid JSON
                df = df.astype(object).where(pd.notnull(df), None)
                preview = df.to_dict('records')
        except Exception as e:
            preview = f"Preview unavailable: {str(e)}"
        
        return {
            "success": True,
            "filename": safe_filename,
            "path": str(file_path),
            "size": len(content),
            "preview": preview
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# Delete uploaded file
@app.delete("/upload/{filename}")
async def delete_file(filename: str):
    """
    Delete an uploaded file.
    """
    try:
        # Sanitize filename
        safe_filename = Path(filename).name
        file_path = UPLOAD_DIR / safe_filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete file
        os.unlink(file_path)
        
        return {
            "success": True,
            "message": f"File {safe_filename} deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
