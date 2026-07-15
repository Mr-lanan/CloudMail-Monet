# CloudMail Monet Full Mailbox Edition

CloudMail Monet is a full Cloudflare-based mailbox system derived from `cloud-mail`. It retains inbound email routing, mailbox accounts, D1/KV/R2 storage, attachments, users and permissions, while adding encrypted per-domain configuration and automatic failover across Resend, MailerSend, Brevo, Postmark and Amazon SES.

The default `wrangler.toml` creates isolated test resources and does not change an existing `cloud-mail` deployment, DNS records or Email Routing rules.

Please refer to [README.md](./README.md) for the complete Chinese deployment and migration guide.

## Derivative Work Notice

CloudMail Monet is an independent derivative of the open-source project [`maillab/cloud-mail`](https://github.com/maillab/cloud-mail). The original MIT license and copyright notice are preserved. CloudMail Monet is not affiliated with, sponsored by, or officially maintained by the original project's authors or maintainers.

Original project: <https://github.com/maillab/cloud-mail>

