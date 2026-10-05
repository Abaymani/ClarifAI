# Admin interface requirements

This document records the established functional scope for the researcher-facing admin interface. It is a shared reference for future design and implementation work; it does not change the student workflow described in the product brief and system architecture.

**Status:** Functional scope and the integrated portal architecture are approved. Access-control details remain to be decided.

## Terminology

- **Participant:** A student identified only by their pseudonymous participant code.
- **Lesson:** One of lessons 1–4.
- **Researcher:** An authorized user of the admin interface.
- **AI coding:** The prompt and sequence codes produced by the existing analysis.
- **Researcher coding:** Notes and codes entered manually by a researcher.
- **Started:** A session record exists but the session is not completed.
- **Completed:** The session has reached its completed state.
- **Missing:** No session record exists for that participant and lesson.

The definitions of started and missing make the requested three-state overview testable. They should be confirmed during interface design, particularly for failed and currently processing sessions.

## Overall constraint

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| ADMIN-FR-010 | The admin interface shall not generate, regenerate, transform, or request any AI output. | No action in the admin interface calls an AI API or consumes model tokens. The interface only reads already stored transcripts and AI analysis, and reads or writes researcher-authored notes and coding. Search, filtering, navigation, and presentation are deterministic application functions. |

## Session overview and transcript navigation

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| ADMIN-FR-001 | The system shall provide researchers with a matrix showing the session status for every lesson and participant. | Each participant has one row and each lesson has one column. Every participant/lesson cell shows exactly one of started, completed, or missing according to the definitions above. |
| ADMIN-FR-002 | The system shall allow a researcher to select a participant and lesson and view the corresponding transcript. | Selecting a participant/lesson session with a transcript opens that transcript. Sessions without a transcript show an explicit empty state rather than fabricated or stale transcript content. |
| ADMIN-FR-003 | While viewing a transcript, the system shall let the researcher navigate to the preceding or following lesson for the same participant. | Previous and next navigation keeps the selected participant unchanged, moves by one lesson, and is unavailable beyond lessons 1 and 4. A lesson without a transcript shows its appropriate empty state. |

## Admin analysis view

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| ADMIN-FR-004 | While viewing a transcript, the researcher shall be able to toggle the visibility of the AI coding beside the transcript. | AI coding is hidden by default. Enabling it shows prompt codes and sequence codes aligned with the relevant transcript content; disabling it hides them without changing the stored result. |
| ADMIN-FR-005 | The system shall allow a researcher to add notes and researcher coding for each participant prompt. | Notes and selected codes are stored against the relevant participant, lesson, prompt, and researcher. Editing one prompt does not alter another prompt or the AI coding. |
| ADMIN-FR-006 | The system shall keep each researcher's activity separate so that both researchers can independently code the same lesson. | Each saved note and code identifies its researcher. One researcher's work neither overwrites nor implicitly changes the other researcher's work. |
| ADMIN-FR-007 | The system shall allow a researcher to choose whose researcher coding is displayed for a lesson. | The view clearly identifies the selected researcher and displays only that researcher's coding unless a future comparison view is explicitly selected. |
| ADMIN-FR-009 | The system shall allow a researcher to expand an AI-assigned prompt or sequence code to inspect why it was assigned. | Each AI code is compact by default. Expanding it shows the stored justification and supporting transcript excerpt; collapsing it hides those details again. Viewing the explanation does not recompute or modify the AI coding. |

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

The decision is recorded as DL-058 in the decision log.

## Decisions required before implementation

- Researcher identity provider and account lifecycle, including how the two researcher accounts are created and revoked.
- The exact meaning and display treatment of failed and processing sessions in the three-state matrix.
- Whether researcher coding uses the framework version stored with the session, the current framework, or a selectable version.
- How simultaneous edits and unsaved changes are handled when two researchers work on the same lesson.
- Whether a researcher may edit or delete submitted notes and codes, and what audit history must be retained.
- Whether researchers need a side-by-side comparison view in addition to selecting one researcher's coding.
