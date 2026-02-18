---
name: scaffold-integration
description: Manual command: design a reusable integration module (Email, WhatsApp, etc.) using ports/adapters + mock provider.
disable-model-invocation: true
---
Design a reusable integration module.

ARGUMENTS: $ARGUMENTS

## Output format
1) **Integration goal**
2) **Capabilities**
   - Inbound events (webhooks / polling)
   - Outbound actions (send message/email, create conversation, etc.)
3) **Port interfaces**
   - Define app-facing interfaces and data contracts
4) **Adapters**
   - List providers (at least: Mock adapter + 1 real provider candidate)
   - Auth strategy
   - Rate limiting / retries
   - Error mapping
5) **Data model**
   - Minimal entities stored by the app
6) **Security & privacy**
   - Secrets handling
   - PII concerns
   - Audit logging
7) **UI touchpoints**
   - Where it plugs into pages (mail, activity, contact/company detail, etc.)
8) **Acceptance criteria**

Rules:
- UI must not talk to providers directly.
- Provide a mock adapter so the app is usable without real credentials.
- Keep the module portable so it can be copied into another app.
