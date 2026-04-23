import { z } from "zod";

export const SessionCreateSchema = z.object({
  title: z.string().optional(),
});

export const PushTokenRegisterSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]),
  label: z.string().optional(),
});

export const PushTokenUnregisterSchema = z.object({
  token: z.string().min(1),
});
