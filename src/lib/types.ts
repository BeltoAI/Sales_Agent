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

export type MailboxStatus = "active" | "paused" | "error";

/** Mailbox columns the browser/user client may read (no credentials). */
export type Mailbox = {
  id: string;
  user_id: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  username: string;
  daily_cap: number;
  status: MailboxStatus;
  status_reason: string | null;
  last_error: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export const MAILBOX_PUBLIC_COLUMNS =
  "id, user_id, email, smtp_host, smtp_port, imap_host, imap_port, username, daily_cap, status, status_reason, last_error, last_checked_at, created_at, updated_at";

export type CampaignStatus = "draft" | "running" | "paused" | "done";

export type Campaign = {
  id: string;
  user_id: string;
  mailbox_id: string | null;
  name: string;
  description: string;
  icp_json: unknown;
  search_plan_json: unknown;
  icp_approved_at: string | null;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
};

export type EmailStatus = "unchecked" | "valid" | "invalid" | "risky" | "unknown";

export type ProspectStatus =
  | "new"
  | "ready"
  | "active"
  | "paused"
  | "replied"
  | "completed"
  | "unsubscribed"
  | "bounced"
  | "excluded";

export type Prospect = {
  id: string;
  user_id: string;
  campaign_id: string;
  name: string;
  first_name: string | null;
  title: string | null;
  company: string | null;
  domain: string | null;
  linkedin_url: string | null;
  location: string | null;
  timezone: string | null;
  email: string | null;
  email_status: EmailStatus;
  email_checked_at: string | null;
  email_check_provider: string | null;
  research_notes: string | null;
  personal_detail: string | null;
  research_source_url: string | null;
  researched_at: string | null;
  source: "apollo" | "demo" | "manual";
  source_ref: string | null;
  is_demo: boolean;
  status: ProspectStatus;
  resume_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageStatus = "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled";

export type Message = {
  id: string;
  user_id: string;
  prospect_id: string;
  campaign_id: string;
  mailbox_id: string | null;
  step: 1 | 2 | 3;
  subject: string;
  body: string;
  status: MessageStatus;
  scheduled_at: string | null;
  claimed_at: string | null;
  sent_at: string | null;
  message_id: string | null;
  attempts: number;
  error: string | null;
  bounced_at: string | null;
  fact_check: unknown;
  created_at: string;
  updated_at: string;
};

export type ReplyCategory = "interested" | "not_now" | "not_interested" | "unsubscribe" | "out_of_office";

export type Reply = {
  id: string;
  user_id: string;
  prospect_id: string;
  message_id: string | null;
  mailbox_id: string | null;
  email_message_id: string;
  from_email: string | null;
  subject: string | null;
  received_at: string;
  snippet: string | null;
  category: ReplyCategory | null;
  classified_at: string | null;
  ooo_return_date: string | null;
  draft_reply: string | null;
  draft_sent_at: string | null;
  handled: boolean;
  created_at: string;
};

export type EventRow = {
  id: number;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
};
