// lib/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GenerateResult } from '@/types';

interface AppState {
  results: GenerateResult[];
  currentResult: string;
  isGenerating: boolean;
  
  addResult: (result: GenerateResult) => void;
  setCurrentResult: (result: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  clearResults: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      results: [],
      currentResult: '',
      isGenerating: false,
      
      addResult: (result) =>
        set((state) => ({
          results: [result, ...state.results].slice(0, 50),
        })),
      
      setCurrentResult: (result) =>
        set({ currentResult: result }),
      
      setIsGenerating: (isGenerating) =>
        set({ isGenerating }),
      
      clearResults: () =>
        set({ results: [] }),
    }),
    {
      name: 'xiaosong-storage',
      partialize: (state) => ({ results: state.results }),
    }
  )
);
