---
applyTo: "frontend/src/schema/**"
---

Read `AGENTS.md` and `.ai/instructions/schema-protocol.md` before editing these files.

Rules:
- Every component protocol must include `aiHints` array.
- Protocol `type` field must match `ComponentType` union value.
- New protocols must be registered in `protocols/index.ts` componentProtocols map.
- AI-facing documentation belongs in protocol `aiHints`, not scattered in comments.
- `customHtml` protocol uses ScadaBridge methods (readTag/writeTag/subscribe/query/assetUrl), not standard Ctx methods.
- `customHtml` aiHints must describe ScadaBridge.onReady() initialization pattern.
