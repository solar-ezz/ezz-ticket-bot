# Ezz Tickets - Future Improvements & Feature Roadmap

## Bugs & Incomplete Features

- [ ] **Settings validation is broken** (`src/schemas/settings.js`) — references undefined `joi`, not even a dependency. Guild settings API has zero server-side validation
- [ ] **Module reload is non-functional** (`src/stdin/reload.js`) — component reloading is commented out, only client reinitializes
- [ ] **OAuth2 permissions not validated** (`src/routes/auth/callback.js:23`) — callback accepts whatever scopes come back without verification
- [ ] **MENU-type questions can't be edited** — Discord modals don't support select menus, so users with menu questions are stuck
- [ ] **`/console` command hardcodes a role ID** (`1488215073460850740`) — should use the configurable super/staff system
- [ ] **`/force-close` requires Administrator** — inconsistent with other commands that use `isStaff()` checks
- [ ] **Avatar archival not implemented** (`src/lib/tickets/archiver.js:74`) — stores avatar strings but never saves images to disk
- [ ] **Export has no integrity verification** (`src/routes/api/admin/guilds/[guild]/export.js:66`) — no cryptographic signing, imported data can't be verified
- [ ] **No rate limiting on API routes** — Fastify HTTP endpoints have no rate limiting middleware

## Performance & Reliability

- [ ] **Batch ticket imports** — currently inserts one-by-one; batch 100 per query for large imports
- [ ] **Add unit/integration tests** — only i18n consistency is tested; no code tests exist
- [ ] **Guild name caching** — `Guild` model has no `name` field; web panel/export must hit Discord API (fails when bot leaves guild)
- [ ] **Redis/Memcached cache backend** — Keyv is in-memory only; switching to Redis would survive restarts and support multi-process
- [ ] **Database indexing** — add indexes on `Ticket.guildId`, `Ticket.createdById`, `Ticket.open`, `ArchivedMessage.ticketId`, `ArchivedMessage.createdAt` for common query patterns
- [ ] **WebSocket support** — replace HTTP polling on the web console with real-time WebSocket push
- [ ] **Graceful shutdown** — ensure all worker threads complete before process exits during restart
- [ ] **Attachment CDN** — uploaded attachments are stored locally; serve via S3/CDN for scalability and reliability

## New Features

### Ticket System
- [ ] **Ticket forms / custom fields** — let admins define custom metadata fields on tickets (dropdown, text, number) searchable via API
- [ ] **Internal notes** — staff-only messages within tickets (ephemeral or hidden channel threads) that don't appear in transcripts
- [ ] **Ticket merging** — merge duplicate tickets into one, carrying over messages and metadata
- [ ] **Ticket splitting** — split a ticket conversation into a new ticket when the topic diverges
- [ ] **SLA tracking** — configurable response time targets with escalation alerts and breach notifications
- [ ] **Ticket assignment round-robin** — auto-assign incoming tickets to available staff in rotation
- [ ] **Scheduled auto-close** — let users schedule a ticket to close at a specific date/time
- [ ] **Ticket bookmarks/pinning** — let staff pin important tickets for quick access via a dashboard
- [ ] **Canned responses / snippets** — quick-insert pre-written responses with template variables (more powerful than tags)
- [ ] **Multi-step ticket flows** — conditional question logic (show question B only if answer to A is X)

### Web Dashboard
- [ ] **Real-time analytics dashboard** — ticket volume, response times, resolution times, staff activity charts (Chart.js/D3)
- [ ] **Staff performance metrics** — average response time, tickets claimed, tickets closed, ratings per staff member
- [ ] **Bulk operations UI** — select multiple tickets to close/archive/export from the web panel
- [ ] **Audit log viewer** — searchable, filterable admin activity log in the web panel
- [ ] **Custom transcript themes** — let admins customize transcript HTML/CSS per guild
- [ ] **Dark mode** — web console and settings panel dark theme toggle

### Discord Integration
- [ ] **Forum channel support** — create tickets as forum posts instead of regular channels
- [ ] **Thread-based tickets** — option to create tickets as threads within a parent channel (saves channel slots)
- [ ] **Slash command permissions UI** — granular control over who can use which commands
- [ ] **Auto-role on ticket creation** — assign a temporary role to the ticket creator while the ticket is open
- [ ] **Webhook notifications** — send ticket events (created, claimed, closed) to external webhooks (Zapier, n8n, etc.)
- [ ] **Button panels in DMs** — allow users to create tickets via DM with category selection
- [ ] **Emoji reaction ticket creation** — react to a message with a specific emoji to open a ticket
- [ ] **Voice channel tickets** — create private voice channels for voice-based support

### Integrations & API
- [ ] **REST API documentation** — OpenAPI/Swagger docs for the admin API
- [ ] **Public API key system** — let third-party tools read ticket stats and create tickets programmatically
- [ ] **Discord webhook relay** — forward ticket events to a configurable Discord channel via webhooks
- [ ] **Email integration** — receive ticket notifications via email, or create tickets by sending an email
- [ ] ** Zapier/n8n/Make connector** — pre-built integration templates for automation platforms
- [ ] **GraphQL API** — alternative to REST for complex queries (ticket + messages + user in one request)

### User Experience
- [ ] **Ticket satisfaction survey** — post-close survey with customizable questions beyond just 1-5 rating
- [ ] **Multi-language ticket routing** — auto-detect message language and route to staff who speak it
- [ ] **Staff availability status** — let staff set themselves as available/busy/away, affecting auto-assignment and offline messages
- [ ] **Ticket templates** — pre-built category/question templates for common use cases (support, bug report, feature request)
- [ ] **Quick actions context menu** — right-click a message in a ticket for quick actions (pin, tag staff, set priority, add note)
- [ ] **Onboarding wizard** — guided setup flow for new guilds (create first category, panel, staff role)

### Security & Compliance
- [ ] **Data retention policies** — auto-purge archived tickets/transcripts after configurable period (GDPR compliance)
- [ ] **PII redaction** — automatically detect and redact personal data (emails, phone numbers) from transcripts
- [ ] **Two-factor auth** — require 2FA for admin panel access
- [ ] **API rate limiting with Redis** — per-user, per-guild rate limiting with sliding windows
- [ ] **Audit log export** — export full audit logs for compliance reporting
- [ ] **IP logging opt-in** — optional IP address logging for web panel access with GDPR notice

## Code Quality & DevEx
- [ ] **Migrate to TypeScript** — type safety across the entire codebase, especially Prisma models and Discord.js interactions
- [ ] **ESLint + Prettier** — enforce consistent code style
- [ ] **Husky pre-commit hooks** — lint, typecheck, and run i18n checks before commits
- [ ] **Docker multi-stage builds** — smaller production images (separate build deps from runtime)
- [ ] **CI/CD pipeline** — GitHub Actions for lint, test, build, and automated deployments
- [ ] **Environment-based config validation** — fail fast with clear errors on missing/invalid env vars at startup
- [ ] **Health check endpoint improvements** — include DB connectivity, Discord gateway status, worker thread health
- [ ] **Structured logging** — JSON-structured logs for easier parsing by log aggregation tools (Loki, ELK)
