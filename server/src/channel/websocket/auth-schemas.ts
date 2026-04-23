import { z } from "zod";

export const PairVerifySchema = z.object({
  pin: z.string().min(1),
  label: z.string().optional(),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
