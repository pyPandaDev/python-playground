import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 125000, // 125 seconds - slightly more than backend timeout (120s)
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface CodeExecutionResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  execution_time: number;
}

export interface UploadResponse {
  success: boolean;
  filename: string;
  path: string;
  size: number;
  preview: any;
}

export const runCode = async (code: string, stdin?: string, notebookId?: string): Promise<CodeExecutionResponse> => {
  const response = await api.post('/run', { code, stdin, notebook_id: notebookId });
  return response.data;
};

export const resetNotebook = async (notebookId: string) => {
  const response = await api.delete(`/notebook/reset/${notebookId}`);
  return response.data;
};

export const uploadFile = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const deleteFile = async (filename: string): Promise<{ success: boolean, message: string }> => {
  const response = await api.delete(`/upload/${filename}`);
  return response.data;
};

export default api;
