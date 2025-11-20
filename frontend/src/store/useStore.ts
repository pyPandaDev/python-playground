import { create } from 'zustand';

// Lightweight store - most state is managed locally in PythonLab component
interface AppState {
  // Global app preferences (can be extended later)
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useStore = create<AppState>((set) => ({
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
}));
