import { z } from "zod";

export const ProviderCreateSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export type ProviderCreateInput = z.infer<typeof ProviderCreateSchema>;

export const ProviderUpdateSchema = z.object({
  name: z.string().optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

export type ProviderUpdateInput = z.infer<typeof ProviderUpdateSchema>;

export const ProviderSwitchSchema = z.object({
  providerId: z.string().min(1),
});

export type ProviderSwitchInput = z.infer<typeof ProviderSwitchSchema>;

export const ProviderModelsResponseSchema = z.object({
  data: z.array(z.object({ id: z.string() })).default([]),
});
