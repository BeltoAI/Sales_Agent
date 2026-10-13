/** Common provider settings, so most users only type their email and app password. */
export type MailPreset = {
  id: string;
  label: string;
  smtpHost: string;
  smtpPort: 465 | 587;
  imapHost: string;
  help: string;
};

export const MAIL_PRESETS: MailPreset[] = [
  {
    id: "google",
    label: "Gmail / Google Workspace",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    imapHost: "imap.gmail.com",
    help: "Turn on 2-Step Verification, then create an app password at myaccount.google.com/apppasswords. IMAP must be enabled in Gmail settings.",
  },
  {
    id: "microsoft",
    label: "Outlook / Microsoft 365",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    imapHost: "outlook.office365.com",
    help: "Your admin must allow 'Authenticated SMTP' and IMAP for this mailbox. Use an app password if MFA is on.",
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    smtpHost: "smtp.zoho.com",
    smtpPort: 465,
    imapHost: "imap.zoho.com",
    help: "Enable IMAP in Zoho settings and use an application-specific password. EU accounts use smtp.zoho.eu / imap.zoho.eu.",
  },
  {
    id: "fastmail",
    label: "Fastmail",
    smtpHost: "smtp.fastmail.com",
    smtpPort: 465,
    imapHost: "imap.fastmail.com",
    help: "Create an app password with IMAP and SMTP access under Settings → Privacy & Security.",
  },
  {
    id: "custom",
    label: "Other provider",
    smtpHost: "",
    smtpPort: 465,
    imapHost: "",
    help: "Ask your provider for the SMTP (port 465 or 587) and IMAP (port 993) server names.",
  },
];
