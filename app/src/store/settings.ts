import { create } from "zustand";

interface SettingsState {
  serverUrl: string;
  currentModel: string;
  availableModels: string[];
  serverVersion: string;

  setServerUrl: (url: string) => void;
  setCurrentModel: (model: string) => void;
  setAvailableModels: (models: string[]) => void;
  setServerVersion: (version: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  serverUrl: "",
  currentModel: "",
  availableModels: [],
  serverVersion: "",

  setServerUrl: (url) => set({ serverUrl: url }),
  setCurrentModel: (model) => set({ currentModel: model }),
  setAvailableModels: (models) => set({ availableModels: models }),
  setServerVersion: (version) => set({ serverVersion: version }),
}));
