# Admin interface requirements

This document records the established functional scope for the researcher-facing admin interface. It is a shared reference for future design and implementation work; it does not change the student workflow described in the product brief and system architecture.

**Status:** Functional scope, integrated portal architecture, and access-control approach are approved and implemented.

## Terminology

- **Participant:** A student identified only by their pseudonymous participant code.
- **Lesson:** One of lessons 1–4.
- **Researcher:** An authorized user of the admin interface.
- **AI coding:** The prompt and sequence codes produced by the existing analysis.
- **Researcher coding:** Notes and codes entered manually by a researcher.
- **Started:** A session record exists but the session is not completed.
- **Completed:** The session has reached its completed state.
- **Missing:** No session record exists for that participant and lesson.

The definitions of started and missing make the requested three-state overview testable. Failed and processing sessions count as started; see the decisions at the end of this document.

## Overall constraint

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| ADMIN-FR-010 | Except for the one-time lesson 1 and 4 action in ADMIN-FR-015, the admin interface shall not generate, regenerate, transform, or request AI output. | Search, filtering, navigation, presentation, researcher coding, and comments do not call an AI API or change stored AI results. No admin action can regenerate or replace an existing analysis. |

## Session overview and transcript navigation

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| ADMIN-FR-001 | The system shall provide researchers with a matrix showing the session status for every lesson and participant. | Each participant has one row and each lesson has one column. Every participant/lesson cell shows exactly one of started, completed, or missing according to the definitions above. The status badge of a session with a submission also holds a symbol for a transcript or for the student's statement that Gemini was not used; the symbol has no visible label but is named on hover and for screen readers. |
| ADMIN-FR-002 | The system shall allow a researcher to select a participant and lesson and view the corresponding transcript. | Selecting a participant/lesson session with a transcript opens that transcript. Sessions without a transcript show an explicit empty state rather than fabricated or stale transcript content. |
| ADMIN-FR-003 | While viewing a transcript, the system shall let the researcher navigate to the preceding or following lesson for the same participant. | Previous and next navigation keeps the selected participant unchanged, moves by one lesson, and is unavailable beyond lessons 1 and 4. A lesson without a transcript shows its appropriate empty state. |
| ADMIN-FR-011 | The overview shall provide a separate researcher-coding view while keeping session status as the default. | The coding matrix shows a separate coded/not-coded status for Armin and Frida in every lesson with a transcript. A lesson without a transcript is marked as such rather than attributing missing work to either researcher. A researcher counts as having coded a lesson after saving at least one researcher note or code for it. |
| ADMIN-FR-012 | A researcher shall be able to hide participants who have no activity in any lesson. | The filter is off by default and exists only in client-side view state. When enabled, it hides a participant only when no session record exists for any of lessons 1–4. A participant with any started, failed, processing, completed, no-Gemini, or transcript-bearing session remains visible. The filter performs no database writes. |
| ADMIN-FR-016 | When the researchers have recorded that participants got new codes after lesson 1, the overview and transcript navigation shall show each lesson 1 under the participant's code from lessons 2–4. | The mapping is one database document kept by the researchers, outside the repository. A moved lesson 1 states the code it was handed in under, and a code whose lesson 1 belongs to another participant points to where it is shown. Stored sessions, coding and comments are never changed or moved, and saving always targets the session's own record. A mapping that is not one-to-one, or that would give a participant two lesson 1 sessions, is not applied, and the overview says why. |
| ADMIN-FR-017 | The overview shall provide a view with the number of AI prompt codes per ICAP level for each participant and lesson. | The view is a separate tab beside the researcher-coding view, with one short label per level from P to C, such as `2 P`. Every AI prompt code counts at its framework level, so a prompt with two codes counts twice, and NA codes and sequences are not counted. Interactive is left out, since the framework has no Interactive prompt codes. A lesson without AI coding shows an explicit empty state. The view reads only stored coding and never calls an AI API. |

## Admin analysis view

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| ADMIN-FR-004 | While viewing a transcript, the researcher shall be able to toggle the visibility of the AI coding beside the transcript and directly on participant prompts and sequences. | AI coding is hidden by default in both locations. Independent transcript controls for AI, Armin, and Frida show compact source-labelled prompt codes and sequence tracks. Overlapping sequences use parallel lanes, selecting a track opens its stored details, and hovering or focusing a code exposes its framework name. The source remains clear without relying only on colour, Gemini messages have no prompt-code labels, and toggling visibility never changes stored results. |
| ADMIN-FR-005 | The system shall allow a researcher to add notes and researcher coding for each participant prompt. | The entire participant message bubble selects the prompt by pointer or keyboard; Gemini bubbles are not selectable. The selected bubble has a strong outline, reinforced background and text-labelled check indicator without dimming the rest of the transcript. Notes and selected codes are stored against the relevant participant, lesson, prompt, and researcher. A code is saved as soon as it is chosen or removed; the note is saved with its own button, and saving a code never saves an unsaved note. Editing one prompt does not alter another prompt or the AI coding. |
| ADMIN-FR-006 | The system shall keep each researcher's activity separate so that both researchers can independently code the same lesson. | Each saved note and code identifies its researcher. One researcher's work neither overwrites nor implicitly changes the other researcher's work. |
| ADMIN-FR-007 | The system shall allow a researcher to choose whose researcher coding is displayed for a lesson. | The view consistently names `R1` as Armin and `R2` as Frida, clearly identifies the selected researcher, and displays only that researcher's coding unless the independent transcript overlays are enabled or a future comparison view is explicitly selected. |
| ADMIN-FR-009 | The system shall allow a researcher to expand an AI-assigned prompt or sequence code to inspect why it was assigned. | Each AI code is compact by default. Expanding it shows the stored justification and supporting transcript excerpt; collapsing it hides those details again. Viewing the explanation does not recompute or modify the AI coding. |
| ADMIN-FR-013 | The transcript detail page shall provide a reflection overview for the selected participant and lesson. | Lessons 1 and 4, where students do not reflect, have no reflection tab and show the transcript directly. In lessons 2 and 3, a separate reflection tab shows every stored reflection moment together, including its compact transcript excerpt with a full-message toggle, fitted analysis, reflection questions, submitted answer and Ja/Delvis/Nej response. Related AI, Armin and Frida coding uses the same source-labelled badges as the transcript. The view never changes stored student or AI data and never calls an AI API. |
| ADMIN-FR-014 | Each researcher shall be able to comment independently on a reflection moment while seeing both researchers' comments. | Armin's and Frida's comments are visible together for each reflection moment. The signed-in researcher can save or clear only their own comment. Comments are stored in researcher-owned records outside the session document, and saving one never changes the transcript, AI analysis, reflection questions, student response or the other researcher's comment. |
| ADMIN-FR-015 | An authorized researcher shall be able to request AI analysis once for a completed lesson 1 or 4 transcript. | Selecting the action starts the request directly. The information card shows progress, is removed after successful completion, and remains with the diagnostic code after a failure. A transaction permits at most one request per participant and lesson across both researchers, including simultaneous requests. The existing analysis pipeline stores coding and reflection questions in the same fields used for lessons 2 and 3. Request metadata records which researcher claimed the single attempt and any diagnostic failure. The action never changes or deletes the transcript, transcript submission kind, session status, completion timestamp, student responses, or researcher coding. Existing AI output also blocks a request so it cannot be overwritten. A failed request remains consumed and cannot be retried. |

## Coding tool

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| ADMIN-FR-008 | When coding a prompt-level behaviour or a sequence, the system shall provide a compact search popup for finding an appropriate code. | The researcher can search by code identifier, description, or example and select a result without leaving the transcript. The chosen code is added to the intended prompt or sequence only. |

## Approved architecture

Two deployment shapes were considered:

1. Add a protected researcher portal to the existing Next.js application.
2. Build and deploy a separate admin website that uses the same research database.

The approved choice is **a protected portal in the existing application**, with researcher-only routes, separate researcher authentication, and server-side authorization on every admin read and write. This keeps one data model and one implementation of transcript rendering, analysis types, framework codes, and Firestore access. It also avoids duplicating deployment configuration and database integration for a small number of researchers.

The portal should be separated logically from the student interface even if it shares the same deployment. Participant codes and PINs must never authorize admin access, and browsers must continue to have no direct Firestore access. A separate hostname or deployment can still be introduced later if operational or institutional security requirements demand stronger isolation.

Researchers authenticate with Google. Access is granted only when Google has verified the account email and it exactly matches one of the two addresses configured on the server. Those accounts are stored under the stable research identifiers `R1` and `R2` and displayed as Armin and Frida respectively; researcher emails are not stored with transcripts, notes, or coding. The portal has no link from the participant interface and is reached through its direct `/admin` address.

The portal, authentication, and researcher-display decisions are recorded as DL-058 through DL-060 in the decision log.

## Decisions settled during implementation

These questions were open before the portal was built. The portal answers them as follows (DL-071).

- **Failed and processing sessions in the status matrix:** every session record that is not completed shows as started (`Påbörjad`), including failed, processing and awaiting sessions. Hovering over the cell shows the stored status.
- **Framework version for researcher coding:** the current framework. Codes are checked against the framework files when they are saved, and each saved entry records that framework version. AI coding keeps the version it was made with.
- **Simultaneous edits and unsaved changes:** each researcher writes only their own records, so the two never overwrite each other. A researcher has one record per prompt and one per sequence, and the latest save wins, for example between two open tabs. Codes, and a stored sequence's range, are saved as soon as they change (DL-075); only a note waits for its button, and an unsaved note is discarded without a warning when the researcher chooses another prompt or sequence, switches researcher or leaves the page.
- **Editing, deleting and history:** a researcher can change or delete only their own notes, codes and reflection comments. An entry or comment left with neither a note nor a code is removed, and a sequence also has its own delete button. Only the latest version is kept, with the time it was saved; there is no audit history. Earlier versions survive only in database backups (DL-067).
- **Comparison view:** there is no separate side-by-side view. The independent AI, Armin and Frida controls above the transcript show the sources' prompt codes and sequence tracks together (ADMIN-FR-004), and the side panel shows one researcher's coding at a time, the other researcher's as read-only (ADMIN-FR-007).
