import { z } from "zod";

/** True if the string is an IANA timezone this runtime understands (e.g. "Europe/Berlin"). */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Accept "acme.com" or "https://acme.com"; store a full https URL. */
function normalizeUrl(value: string): string {
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const profileSchema = z.object({
  company_name: z.string().trim().min(1, "Enter your company name.").max(200),
  website: optionalText(500)
    .transform((v) => (v ? normalizeUrl(v) : null))
    .refine((v) => v === null || isHttpUrl(v), "Enter a valid website, like acme.com."),
  what_they_sell: z
    .string()
    .trim()
    .min(10, "Describe what you sell in a sentence or two.")
    .max(2000, "Keep it under 2000 characters."),
  sender_name: z.string().trim().min(1, "Enter the name emails are sent from.").max(120),
  mailing_address: z
    .string()
    .trim()
    .min(5, "A physical mailing address is required by anti-spam law (it goes in every email footer).")
    .max(500),
  calendly_url: optionalText(500)
    .transform((v) => (v ? normalizeUrl(v) : null))
    .refine((v) => v === null || (v.startsWith("https://") && isHttpUrl(v)), "Enter a valid https:// booking link."),
  timezone: z.string().trim().refine(isValidTimezone, "Pick a timezone from the list."),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfileField = keyof ProfileInput;
