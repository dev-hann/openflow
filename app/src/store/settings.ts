import { create } from "zustand";

interface SettingsState {
  serverUrl: string;
  currentModel: string;
  availableModels: string[];

  setServerUrl: (url: string) => void;
  setCurrentModel: (model: string) => void;
  setAvailableModels: (models: string[]) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  serverUrl: "",
  currentModel: "",
  availableModels: [],

  setServerUrl: (url) => set({ serverUrl: url }),
  setCurrentModel: (model) => set({ currentModel: model }),
  setAvailableModels: (models) => set({ availableModels: models }),
}));
