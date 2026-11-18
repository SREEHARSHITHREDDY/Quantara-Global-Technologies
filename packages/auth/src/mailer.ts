export interface MailMessage { to: string; subject: string; text: string; kind: "verify-email" | "reset-password" | "invitation" | "other" }
export interface Mailer { readonly name: string; readonly configured: boolean; send(msg: MailMessage): Promise<void> }

export class EmailNotConfiguredError extends Error {
  constructor() { super("Email delivery is not configured. Set RESEND_API_KEY (see .env.example)."); }
}
/** Production default when no provider is configured: fails loudly instead of pretending an email was sent. */
export class DisabledMailer implements Mailer {
  readonly name = "disabled"; readonly configured = false;
  async send(): Promise<void> { throw new EmailNotConfiguredError(); }
}
/** DEV/TEST only: keeps messages in memory (and optionally logs). Never used when NODE_ENV=production. */
export class OutboxMailer implements Mailer {
  readonly name = "dev-outbox"; readonly configured = true; readonly outbox: MailMessage[] = [];
  constructor(private readonly log = false) {}
  async send(msg: MailMessage) { this.outbox.push(msg); if (this.log) console.log(`[dev-outbox] to=${msg.to} :: ${msg.subject}\n${msg.text}`); }
  last(kind?: MailMessage["kind"]) { return [...this.outbox].reverse().find((m) => !kind || m.kind === kind); }
}
