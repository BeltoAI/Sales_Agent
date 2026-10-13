import type { SenderContext } from "@/lib/ai";
import type { Profile } from "@/lib/types";

/** The parts of the user's profile the AI agents may use when writing. */
export function senderFromProfile(p: Pick<Profile, "company_name" | "website" | "what_they_sell" | "sender_name">): SenderContext {
  return {
    company_name: p.company_name,
    website: p.website,
    what_they_sell: p.what_they_sell,
    sender_name: p.sender_name,
  };
}
