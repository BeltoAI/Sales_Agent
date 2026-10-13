import { Badge, type BadgeTone } from "@/ui";
import type { CampaignStatus, EmailStatus, MessageStatus, ProspectStatus, ReplyCategory } from "@/lib/types";

const CAMPAIGN: Record<CampaignStatus, BadgeTone> = { draft: "neutral", running: "success", paused: "warning", done: "info" };
const PROSPECT: Record<ProspectStatus, BadgeTone> = {
  new: "neutral",
  ready: "info",
  active: "success",
  paused: "warning",
  replied: "accent",
  completed: "neutral",
  unsubscribed: "danger",
  bounced: "danger",
  excluded: "neutral",
};
const EMAIL: Record<EmailStatus, BadgeTone> = { unchecked: "neutral", valid: "success", invalid: "danger", risky: "warning", unknown: "warning" };
const MESSAGE: Record<MessageStatus, BadgeTone> = {
  draft: "neutral",
  scheduled: "info",
  sending: "warning",
  sent: "success",
  failed: "danger",
  cancelled: "neutral",
};
const REPLY: Record<ReplyCategory, BadgeTone> = {
  interested: "success",
  not_now: "info",
  not_interested: "neutral",
  unsubscribe: "danger",
  out_of_office: "warning",
};

const label = (s: string) => s.replaceAll("_", " ");

export const CampaignBadge = ({ status }: { status: CampaignStatus }) => <Badge tone={CAMPAIGN[status]}>{label(status)}</Badge>;
export const ProspectBadge = ({ status }: { status: ProspectStatus }) => <Badge tone={PROSPECT[status]}>{label(status)}</Badge>;
export const EmailStatusBadge = ({ status }: { status: EmailStatus }) => <Badge tone={EMAIL[status]}>{label(status)}</Badge>;
export const MessageBadge = ({ status }: { status: MessageStatus }) => <Badge tone={MESSAGE[status]}>{label(status)}</Badge>;
export const ReplyBadge = ({ category }: { category: ReplyCategory | null }) =>
  category ? <Badge tone={REPLY[category]}>{label(category)}</Badge> : <Badge tone="neutral">unclassified</Badge>;
export const DemoBadge = () => <Badge tone="warning">demo</Badge>;
