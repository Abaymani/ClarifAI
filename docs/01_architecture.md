# System Architecture
This document is an overview of the suggested technical stack for the project aswell as the use-case scenario.

## Use-case
For the use-case description, see [[00_product_brief]]

## Tech-Stack
|Concern|Tool|Comments|
|---|---|---|
|Frontend|NextJS|Also use typescript.|
|Styling|shadcn/ui|Use shadcn/ui components for styling wherever possible as to not reinvent the wheel.|
|"Backend"|NextJS (Route handlers)|The use-case is simple, and as service providers we are not doing any real logic, only routing between the AI API, our database and the UI. This can all be done with just NextJS.|
|LLM Provider|OpenAI ChatGPT|Analysis will be done through API calls to ChatGPT. The scraped transcript, with names redacted, will be submitted together with the coding schemes and instructions. The transcript link is only stored as a fallback for researchers.|
|Database|Google Firebase|Cloud Firestore is a document (NoSQL) database. There will be at most 60 users, with a maximum of 4 sessions each. Each session is self-contained. A document based system for storage is therefore likely more than enough for our purposes.|
|Hosting|Vercel|Vercel makes it trivial to host NextJS projects and has a generous free hosting tier.|
|Auth|N/A (Participant code + PIN)|Each student recieves a `participant_code` (pseudonym) and a 4-digit PIN from their teacher; both are generated together. No names, emails or any other identifiable information should be stored under any circumstance due to ethical concerns.|

## Session Lifecycle
Every submission and completed reflection is counted as one **session**.

There are two types of sessions.
1. Student submits their transcript but there is no reflection **(lessons 1 & 4)**.
2. Student submits their transcript, which is analysed, coded and used as the reflection object for the scaffolded reflection **(lessons 2 & 3)**.

**State overview: Case #1**
```
Session creation (S0)
        |
        v
Submission & Scraping (S1) --error--> FAILURE (with error code!) --retry--> back to S1
        |
        | student confirms the transcript
        v
Session completed
```

**State overview: Case #2**
```
Session creation (S0)
        |
        v
Submission & Scraping (S1) --error--> FAILURE (with error code!) --retry--> back to S1
        |
        | student confirms the transcript
        v
Analysis (S2) ---------------error--> FAILURE (with error code!) --retry--> back to S2
        |
        v
Scaffolded reflection (S3) --error--> FAILURE (with error code!) --retry--> back to S3
        |
        v
Session completed
```
- `FAILURE` is not a final state. It should show the student a friendly message, keep the error code for researchers, and let the student retry the step that failed. Data saved in earlier steps is kept. Each state should handle errors in an appropriate manner.

**`Session creation (S0)`**
Students must sumbit their `participant_code` to start a session. Since the research projects aims to look for session-to-session changes in prompting tendencies **within** each student, it is imperitive that this is saved in the database.

Each `participant_code` is handed out together with a 4-digit PIN that is generated with it. Students need both their code and their PIN to start or resume any of their sessions. The PIN is stored in clear text so researchers can tell a student who forgets it. Since 4 digits are quick to guess, repeated failed attempts are temporarily blocked.

A session is identified by the participant code together with the lesson, so a student has at most one session per lesson. Logging in again with the same code and lesson resumes that session, and a completed lesson cannot be reopened. The browser keeps the session in a cookie holding a random token; only a hash of the token is stored, so access to the database alone does not let anyone resume a student's session. A session starts in the state `awaiting_transcript`, waiting for the link that `S1` collects.

**`Submission & Scraping (S1)`**
Students submit a link to their Gemini transcript. One important thing to note is that while the chat is static once the link is created, it will cease to function if the underlying chat is deleted. Since the transcript is **important research data**, it must be scraped and saved to the database. This should be done in a format readable to both an LLM and a human encoder.

Transcripts may include multimedia, mostly images. Images are not saved: each one is replaced with the placeholder `[PICTURE]` in the stored transcript, so no identifiable image content is kept and no image recognition is needed. As a fallback in case of faliures, the transcript link should always be saved aswell. 

After scraping, the student is shown a preview of the retrieved transcript and asked to confirm that it is their conversation ("Is this your transcript?"). If it is not, they can submit another link, which replaces the previous one. The session only moves on once the student has confirmed the transcript.

In case of lesson **1** or lesson **4**, the session is considered completed as soon as the transcript has successfully been scraped and the student has confirmed it.

**`Analysis (S2)`**
Student transcripts are fed to the AI encoding agent through the API. The AI should be prepared with the [[analysis_guidelines]] and the two coding schemas (prompt_coding.JSON, sequence_coding.JSON).

The analysis is done according to the guidelines, and saved to the database. It should be in a format where it's apparent what prompt/sequence-level behaviour was observed, as well as what part of the transcript the observation was made.

**`Scaffolded reflection (S3)`**
The completed analysis of the transcript should then be used as a foundation in `S3` to build a scaffolded reflection. The relevant reflection human-authored template depending on the observed behaviour should be chosen as a base and adapted to the specific situation. The number of reflection points is capped by a configurable maximum (default: 3) so that reflection doesn't take too much time.

The student's answers to the reflection questions/prompts must also be logged to the database. 

**`Session completed`**
Once the student has answered all reflection questions and marked the reflection as completed (`case #2`), or once the data has been successfully scraped and the student has confirmed the transcript (`case #1`), the session is considered completed. 

### Disconnection or unexpected faliures
If a session has not been marked as completed but the user dissconnects, the session should be able to be resumed. A completed session cannot be resumed or viewed by the user again.
