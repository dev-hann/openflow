import { z } from "zod";

export const ErrorReportSchema = z.object({
  platform: z.enum(["server", "app", "web"]),
  version: z.string().optional(),
  errorCode: z.string().min(1),
  message: z.string().min(1),
  stackTrace: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
