---
applyTo: "**/*.ts,**/*.tsx,**/*.css,frontend/src/**"
---

Read `AGENTS.md` and `.ai/instructions/frontend-react.md` before editing these files.

Rules:
- One material component per file in `components/materials/`.
- New components require three files: render + protocol + catalog entry.
- State changes go through `editorStore` actions, never mutate schema directly.
- `CustomHtmlMaterial` uses iframe srcdoc; never switch to Shadow DOM or dangerouslySetInnerHTML.
- ScadaBridge SDK source lives in `utils/scadaBridge.ts`; bridge manager in `utils/bridgeManager.ts`.
- Asset files served at `/assets/*/file` bypass JWT (permitAll for iframe access).
- Mark uncertain decisions as `<!-- 待确认 -->`.

Layout rules:
- `editor-workspace` uses `display: flex` (NOT CSS Grid). Left/right sidebars are fixed-width `flex-shrink: 0`; canvas is `flex: 1 1 0`.
- To hide a sidebar, use **conditional rendering** (`{!collapsed && <aside>}`), never `display: none` with inline style — flex needs the element absent to reclaim space.
- Collapsible panels: add a collapse button (icon button) in the panel heading. When collapsed, render a `position: fixed` floating button (`panel-float-btn` class) that supports drag-to-reposition. Drag vs click is distinguished by a `moved` ref (threshold 3px).

Preview rules:
- The "预览" button in `EditorToolbar` opens preview in a **new window** via `window.open('/preview/:id', '_blank')`.
- `PreviewPage` must not depend on router `navigate` for closing; use `window.close()` instead.
- `PreviewPage` exposes a resolution preset dropdown + W/H number inputs. Override is applied via a `displayPage` memo that patches `root.props.canvasWidth/canvasHeight`; do NOT mutate the original page object.

ConfigPanel rules:
- `customHtml` component shows only three tabs in the right config panel: **属性 / 资产 / 变量**. HTML/CSS/JS editing is exclusively in the floating script-workbench (opened by double-click).
- `PanelSection` type must not include `'html' | 'css' | 'js'`.

CSS / style rules:
- No `blur()`, `radial-gradient`, `conic-gradient` (except the canvas-node-selected rainbow `::before/::after`), or `border-radius > 12px` outside modal/dialog.
- Rainbow conic-gradient selection border on `.canvas-node-selected::before/::after` + `@property --ribbon-angle` + `@keyframes canvas-ribbon-flow` must never be removed.
- All default `borderRadius` values in schema/components should be `6`, not 16 or 24.
- Material components that use AntD controls (Input, Button, etc.) should pass `node.props.borderRadius` to the control's `style` when set, so users can override AntD defaults.
