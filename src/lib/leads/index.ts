import "server-only";

import { apolloProvider } from "./apollo";
import { demoProvider } from "./demo";
import type { LeadProvider } from "./types";

export type { Lead, LeadProvider } from "./types";
export { LeadProviderError } from "./types";

/** Apollo when APOLLO_API_KEY is set, otherwise the labelled demo provider. */
export function getLeadProvider(): LeadProvider {
  const key = process.env.APOLLO_API_KEY?.trim();
  return key ? apolloProvider(key) : demoProvider;
}
