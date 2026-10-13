/** Fixed messages for ?error= codes, so the URL can never inject arbitrary text into the page. */
const AUTH_ERRORS: Record<string, string> = {
  link_invalid: "That sign-in link is invalid or has expired. Request a new one below.",
  auth_failed: "Sign-in failed. Please try again.",
};

export function authErrorMessage(code: string | string[] | undefined): string | undefined {
  return typeof code === "string" ? AUTH_ERRORS[code] : undefined;
}
