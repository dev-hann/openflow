import type { DatabaseSync } from "node:sqlite";

import { createLogger } from "../utils/logger.js";
import { wrapDb, generateId, nowMs, runMigrations } from "./store.js";

const log = createLogger("memory/provider");

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AddProviderParams {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault?: boolean;
}

export interface ProviderStore {
  listProviders(): Provider[];
  getProvider(id: string): Provider | null;
  getDefaultProvider(): Provider | null;
  addProvider(params: AddProviderParams): Provider;
  updateProvider(id: string, params: Partial<Pick<Provider, "name" | "baseUrl" | "apiKey" | "model">>): Provider | null;
  deleteProvider(id: string): void;
  setDefault(id: string): Provider | null;
}

function rowToProvider(row: Record<string, unknown>): Provider {
  return {
    id: row.id as string,
    name: row.name as string,
    baseUrl: row.base_url as string,
    apiKey: row.api_key as string,
    model: row.model as string,
    isDefault: (row.is_default as number) === 1,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function createProviderStore(db: DatabaseSync): ProviderStore {
  runMigrations(db);

  const stmts = {
    listProviders: db.prepare(
      "SELECT id, name, base_url, api_key, model, is_default, created_at, updated_at FROM providers ORDER BY created_at ASC",
    ),
    getProvider: db.prepare(
      "SELECT id, name, base_url, api_key, model, is_default, created_at, updated_at FROM providers WHERE id = ?",
    ),
    getDefaultProvider: db.prepare(
      "SELECT id, name, base_url, api_key, model, is_default, created_at, updated_at FROM providers WHERE is_default = 1 LIMIT 1",
    ),
    insertProvider: db.prepare(
      "INSERT INTO providers (id, name, base_url, api_key, model, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ),
    updateProviderPartial: db.prepare(
      "UPDATE providers SET name = COALESCE(?, name), base_url = COALESCE(?, base_url), api_key = COALESCE(?, api_key), model = COALESCE(?, model), updated_at = ? WHERE id = ?",
    ),
    deleteProvider: db.prepare("DELETE FROM providers WHERE id = ?"),
    clearDefault: db.prepare("UPDATE providers SET is_default = 0"),
    setDefault: db.prepare("UPDATE providers SET is_default = 1, updated_at = ? WHERE id = ?"),
    getUpdatedProvider: db.prepare(
      "SELECT id, name, base_url, api_key, model, is_default, created_at, updated_at FROM providers WHERE id = ?",
    ),
  };

  return {
    listProviders(): Provider[] {
      return wrapDb("listProviders", () =>
        (stmts.listProviders.all() as Array<Record<string, unknown>>).map(rowToProvider),
      );
    },

    getProvider(id: string): Provider | null {
      return wrapDb("getProvider", () => {
        const row = stmts.getProvider.get(id) as Record<string, unknown> | undefined;
        return row ? rowToProvider(row) : null;
      });
    },

    getDefaultProvider(): Provider | null {
      return wrapDb("getDefaultProvider", () => {
        const row = stmts.getDefaultProvider.get() as Record<string, unknown> | undefined;
        return row ? rowToProvider(row) : null;
      });
    },

    addProvider(params: AddProviderParams): Provider {
      const id = generateId();
      const now = nowMs();
      const isDefault = params.isDefault ? 1 : 0;
      wrapDb("addProvider", () =>
        stmts.insertProvider.run(id, params.name, params.baseUrl, params.apiKey, params.model, isDefault, now, now),
      );
      log.info({ providerId: id, name: params.name }, "provider added");
      return {
        id,
        name: params.name,
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
        model: params.model,
        isDefault: params.isDefault ?? false,
        createdAt: now,
        updatedAt: now,
      };
    },

    updateProvider(id: string, params: Partial<Pick<Provider, "name" | "baseUrl" | "apiKey" | "model">>): Provider | null {
      const now = nowMs();
      wrapDb("updateProvider", () =>
        stmts.updateProviderPartial.run(
          params.name ?? null,
          params.baseUrl ?? null,
          params.apiKey ?? null,
          params.model ?? null,
          now,
          id,
        ),
      );
      const row = wrapDb("updateProvider:get", () =>
        stmts.getUpdatedProvider.get(id) as Record<string, unknown> | undefined,
      );
      if (!row) return null;
      log.info({ providerId: id }, "provider updated");
      return rowToProvider(row);
    },

    deleteProvider(id: string): void {
      wrapDb("deleteProvider", () => stmts.deleteProvider.run(id));
      log.info({ providerId: id }, "provider deleted");
    },

    setDefault(id: string): Provider | null {
      const now = nowMs();
      wrapDb("setDefault", () => {
        stmts.clearDefault.run();
        stmts.setDefault.run(now, id);
      });
      const row = wrapDb("setDefault:get", () =>
        stmts.getUpdatedProvider.get(id) as Record<string, unknown> | undefined,
      );
      if (!row) return null;
      log.info({ providerId: id }, "provider set as default");
      return rowToProvider(row);
    },
  };
}
