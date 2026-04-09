---
applyTo: "**/*.ts,**/*.tsx,**/*.css,frontend/src/**"
---

Read `AGENTS.md` and `.ai/instructions/frontend-react.md` before editing these files.

Rules:
- One material component per file in `components/materials/`.
- New components require three files: render + protocol + catalog entry.
- State changes go through `editorStore` actions, never mutate schema directly.
- Mark uncertain decisions as `<!-- 待确认 -->`.
