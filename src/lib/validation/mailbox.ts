import { z } from "zod";

const host = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Enter the server name.")
  .max(253)
  .regex(/^[a-z0-9.-]+$/, "Server names contain only letters, numbers, dots and dashes.");

export const connectMailboxSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  username: z
    .string()
    .trim()
    .max(254)
    .transform((v) => v || null),
  password: z.string().min(1, "Enter the app password.").max(500),
  smtp_host: host,
  smtp_port: z.coerce.number().refine((p) => p === 465 || p === 587, "SMTP port must be 465 or 587."),
  imap_host: host,
  daily_cap: z.coerce.number().int().min(1, "At least 1.").max(50, "The maximum is 50 per day.").default(30),
});

export type ConnectMailboxInput = z.infer<typeof connectMailboxSchema>;

export const dailyCapSchema = z.coerce.number().int().min(1).max(50);
