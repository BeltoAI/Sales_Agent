"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { profileSchema, type ProfileField } from "@/lib/validation/profile";

export type ProfileFormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Partial<Record<ProfileField, string>>;
  values?: Record<string, string>;
};

const FIELDS: ProfileField[] = [
  "company_name",
  "website",
  "what_they_sell",
  "sender_name",
  "mailing_address",
  "calendly_url",
  "timezone",
];

export async function saveProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  const mode = formData.get("mode") === "settings" ? "settings" : "onboarding";

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: ProfileFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as ProfileField;
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors, values, message: "Please fix the highlighted fields." };
  }

  // Re-check the session on the server; never trust the form for who the user is.
  const { supabase, user } = await requireUser();

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("user_id, onboarded_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return { values, message: "Could not save your profile. Please try again." };

  // Insert or update explicitly (an upsert would try to update user_id, which users may not change).
  const { error } = existing
    ? await supabase
        .from("profiles")
        .update({ ...parsed.data, onboarded_at: existing.onboarded_at ?? new Date().toISOString() })
        .eq("user_id", user.id)
    : await supabase.from("profiles").insert({ ...parsed.data, user_id: user.id, onboarded_at: new Date().toISOString() });

  if (error) return { values, message: "Could not save your profile. Please try again." };

  revalidatePath("/dashboard", "layout");
  if (mode === "onboarding") redirect("/dashboard");
  return { ok: true, message: "Saved.", values };
}
