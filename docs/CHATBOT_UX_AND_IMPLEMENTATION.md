# Chatbot UX & Implementation — AI Maintainer Guide

This document describes **UX principles**, **token handling**, and **where to change what** so another AI (or human) can safely modify the portfolio chatbot without breaking behavior.

See also: `docs/AI_ASSISTANT_SPEC.md` for RAG/API architecture.

---

## 1. UX Principles (What We Optimized For)

- **Say it, then do it**: When the user asks to "go there" or "call" or "download", the assistant both replies in natural language and triggers the action (navigation, `tel:`, `mailto:`, PDF download). Internal tokens are never shown.
- **Only offer what exists**: Resume PDF is offered only for languages that have a non-empty URL in `data/resume.json` (`availableResumeLangs`). No "한국어 이력서 다운로드할까요?" when Korean resume is not configured.
- **Resume = download only**: There is no "resume page" to open. Resume is PDF download only. Do not use `[OPEN_LINK: /resume]` or "이력서 페이지로 이동".
- **Contact clarity**: For phone/email, "번호/주소만 알려줘" → show info then ask "걸어드릴까요?"; "전화 걸어줘" / "이메일 보내줘" → act immediately. In UI, never show "Mailto:" — only the raw address (e.g. `biancaroh0424@gmail.com`).
- **Where am I / where did I go**: Anchor navigation scrolls to the section and highlights it; ChapterStatus stays in sync with `window.location.hash`. Language is preserved via `?lang=` when opening projects.
- **Sources are clickable**: `[Source: TITLE]` becomes a chip/link — on project detail page to section (with anchor), on list page to project.

---

## 2. LLM Output Tokens (Client Must Parse and Strip)

The LLM may output these **internal tokens**. The client must (1) perform the action, (2) **remove the token from all content shown to the user**. Tokens must never appear in the final rendered message.

| Token | Meaning | Client action (ChatBot.tsx) |
|-------|---------|----------------------------|
| `[OFFERED_LINK: /portfolio/ID]` or `[OFFERED_LINK: /portfolio/ID#anchor]` | Offer to navigate; user may confirm later | Set `pendingOpenRef` for portfolio only; strip from display. For `/resume` only strip (no page). |
| `[OFFERED_LINK: /resume...]` | Invalid (no resume page) | Strip only; do not navigate. |
| `[OPEN_LINK: /portfolio/ID]` or `[OPEN_LINK: /portfolio/ID#heading-N]` or `...?lang=ko` | Navigate now | `window.location` or `location.hash`; on mobile (≤743px) close chatbot; strip from display. |
| `[OPEN_TEL: +82-10-2852-9692]` | Open dialer | `window.location.href = \`tel:${tel}\``; strip. |
| `[OPEN_MAILTO: email]` | Open mail app | `window.location.href = \`mailto:${email}\``; strip. |
| `[DOWNLOAD_RESUME: en]` (or `ko`, `it`) | Start resume PDF download | Open `/api/resume/download?lang=XX` in **new tab** (do not navigate main window); strip token **before** updating message state so it never appears in UI. |

**Critical**: Strip tokens in **two** places so they never show regardless of timing:
1. **On stream completion** (when building `finalContent` before `setMessages`) — remove tokens and run the action.
2. **On display** (when rendering assistant message) — `content` used for markdown must be passed through replaces that remove any remaining `[OFFERED_LINK: ...]`, `[OPEN_LINK: ...]`, `[OPEN_TEL: ...]`, `[OPEN_MAILTO: ...]`, `[DOWNLOAD_RESUME: ...]` (and optional `<p>...</p>` wrappers).

---

## 3. Mailto: and Email Display

- **Rule**: The user must never see the string "Mailto:" or "mailto:" (or "MAILTO:") in the chat. Only the email address (e.g. `biancaroh0424@gmail.com`) may appear.
- **Implementation**:
  - In **plain text**: replace `(?:Mailto|mailto|MAILTO)\s*[:\uFF1A]\s*` + email pattern with just the email (support fullwidth colon `：`).
  - In **markdown link text**: e.g. `[Mailto:biancaroh0424@gmail.com](mailto:...)` → replace to `[biancaroh0424@gmail.com](mailto:...)`.
  - For **mailto `<a>` tags**: when building chip text for links with `href` starting with `mailto:`, use only the email (e.g. extract with regex `[a-zA-Z0-9._%+-]+@...` from `href`), never `getChipTextFromHref`’s default (which would capitalize and show "Mailto:...").
  - **DOM fallback**: `stripMailtoFromTextNodes(doc.body)` walks all text nodes and removes "Mailto:" / "mailto:" / "MAILTO:" (with ASCII or fullwidth colon) so that any remaining occurrence in `<strong>`, `<p>`, etc. is removed.

---

## 4. Resume: No Page, Download Only

- **Data**: `data/resume.json` has shape `{ en?: string, ko?: string, it?: string }` (URLs per language). Empty or missing = not available.
- **API**: Chat API reads this file and computes `availableResumeLangs` (e.g. `['en']`). Pass to `generateAIResponseStream(..., availableResumeLangs)`.
- **RAG prompt** (`lib/rag-stream.ts`): Section `[Resume — 이력서]` must state that resume is **PDF download only**, no page. It must say: "Available resume languages: {availableResumeLangs}. Only offer/suggest download for these; if user asks for a language not in the list, say it's only available in [list] and do NOT output [DOWNLOAD_RESUME] for that language."
- **Download**: Client parses `[DOWNLOAD_RESUME: lang]`, strips it from content, then opens ` /api/resume/download?lang=XX` in a **new tab** (e.g. create `<a target="_blank">`, click, remove). Do not use `window.location.href` for the main window (so the chat UI and state update stay visible).
- **Public API**: `GET /api/resume/download?lang=en|ko|it` reads `data/resume.json`, returns 302 redirect to the PDF URL for that lang, or 404 if not available.

---

## 5. Key File and Section Reference

| Concern | File | Where / what |
|---------|------|--------------|
| Token parsing, strip, actions (OPEN_LINK, TEL, MAILTO, DOWNLOAD_RESUME, OFFERED_LINK) | `components/ChatBot.tsx` | Stream completion block: match tokens, run action, replace in `finalContent`; order: strip DOWNLOAD_RESUME from content first, then trigger new-tab download. |
| Display-time strip of all tokens + Mailto | `components/ChatBot.tsx` | Same file: assistant message render path; `content` chain: `.replace(...OFFERED_LINK...)`, `.replace(...OPEN_LINK...)`, `.replace(...OPEN_TEL...)`, `.replace(...OPEN_MAILTO...)`, `.replace(...DOWNLOAD_RESUME...)`, plus Mailto and link-text replacements. |
| Mailto in link chip text | `components/ChatBot.tsx` | When building `chipText` for `<a href="mailto:...">`, use email-only from `href` (regex extract), not `getChipTextFromHref`. |
| DOM text node Mailto strip | `components/ChatBot.tsx` | `stripMailtoFromTextNodes(doc.body)` before `finalHtml = doc.body.innerHTML`. |
| RAG system prompt (contact, resume, tokens) | `lib/rag-stream.ts` | `[Contact & Creator]`, `[Phone]`, `[Email]`, `[Resume — 이력서]`; use `availableResumeLangs` in the prompt. |
| Available resume languages | `app/api/chat/route.ts` | `getAvailableResumeLangs()` reads `data/resume.json`, returns `['en','ko','it'].filter(lang => resume[lang]?.trim())`; pass to `generateAIResponseStream`. |
| Resume download API | `app/api/resume/download/route.ts` | GET, `lang` query, redirect to `resume[lang]` URL or 404. |
| OPEN_LINK for /resume | Do not implement | Resume has no page; only portfolio OPEN_LINK is handled. |

---

## 6. Small UX Details (For Consistency)

- **Tooltip (close button)**: Wrapper uses `inline-flex shrink-0` so the tooltip positions under the button, not the whole panel.
- **Chatbot font**: 14px base; no forced 16px on mobile (per product preference).
- **Console ASCII art**: Logged once per load using a `window` flag to avoid duplicate in React Strict Mode.
- **Mixpanel**: CSP allows `https://api-js.mixpanel.com` and `https://*.mixpanel.com`; dev may use `connect-src ... https:`. Init options: `autocapture: true`, `record_sessions_percent: 100`, `debug` in development.
- **Source chips**: On project detail page, link to `#heading-N` and show section title; on list page, link to project and show project title.

---

## 7. What Not to Do

- Do not show internal tokens (`[OPEN_LINK: ...]`, `[DOWNLOAD_RESUME: en]`, etc.) in the chat UI under any path (streaming or saved message).
- Do not offer "이력서 페이지로 이동" or add `[OPEN_LINK: /resume]`; resume is download only.
- Do not offer resume download for a language not in `availableResumeLangs` (e.g. do not ask "한국어 이력서 다운로드할까요?" when only `en` is configured).
- Do not show "Mailto:" (or "mailto:", "MAILTO:") anywhere; only the email address.
- Do not use main-window navigation for resume download (use new tab so the chat state and UI stay).

---

*Last updated to reflect: token stripping (all paths), resume download-only + availableResumeLangs, Mailto stripping (incl. DOM and link chip), OPEN_LINK only for portfolio.*
