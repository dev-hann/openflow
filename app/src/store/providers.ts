import { create } from "zustand";
import type { ProviderInfo } from "../types/protocol";

interface ProvidersState {
  providers: ProviderInfo[];
  activeProviderId: string;
  setProviders: (providers: ProviderInfo[], activeProviderId: string) => void;
  setActiveProviderId: (id: string) => void;
  updateProvider: (
    id: string,
    patch: Partial<Omit<ProviderInfo, "id">>,
  ) => void;
}

export const useProvidersStore = create<ProvidersState>((set) => ({
  providers: [],
  activeProviderId: "",

  setProviders: (providers, activeProviderId) =>
    set({ providers, activeProviderId }),
  setActiveProviderId: (id) =>
    set((state) => ({
      activeProviderId: id,
      providers: state.providers.map((p) => ({ ...p, isActive: p.id === id })),
    })),
  updateProvider: (id, patch) =>
    set((state) => ({
      providers: state.providers.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    })),
}));
