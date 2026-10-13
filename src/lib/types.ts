/** Row shapes for the tables in supabase/migrations. Kept by hand; update alongside the SQL. */

export type Profile = {
  user_id: string;
  company_name: string;
  website: string | null;
  what_they_sell: string;
  sender_name: string;
  mailing_address: string;
  calendly_url: string | null;
  timezone: string;
  sending_paused: boolean;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};
