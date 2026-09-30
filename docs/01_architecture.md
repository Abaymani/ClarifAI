# System Architecture
This document is an overview of the suggested technical stack for the project aswell as the use-case scenario.

## Use-case
For the use-case description, see [[00_product_brief]]

## Tech-Stack
|Concern|Tool|Comments|
|---|---|---|
|Frontend|NextJS|Also use typescript.|
|Styling|shadcn/ui|Use shadcn/ui components for styling wherever possible as to not reinvent the wheel.|
|"Backend"|NextJS (Server Actions)|The use-case is simple, and as service providers we are not doing any real logic, only routing between the AI API, our database and the UI. This can all be done with just NextJS.|
|LLM Provider|OpenAI ChatGPT|Analysis will be done through API calls to ChatGPT. The scraped transcript, with names redacted, will be submitted together with the coding schemes and instructions. The transcript link is only stored as a fallback for researchers.|
|Database|Google Firebase|Cloud Firestore is a document (NoSQL) database. There will be at most 60 users, with a maximum of 4 sessions each. Each session is self-contained. A document based system for storage is therefore likely more than enough for our purposes.|
|Hosting|Vercel|Vercel makes it trivial to host NextJS projects and has a generous free hosting tier.|
|Auth|N/A (Participant code + PIN)|Each student recieves a `participant_code` (pseudonym) and a 4-digit PIN from their teacher; both are generated together. No names, emails or any other identifiable information should be stored under any circumstance due to ethical concerns.|

## Session Lifecycle
Every submission and completed reflection is counted as one **session**.

There are two lesson workflows. In either one, the student can instead state that they did not use Gemini during the lesson.
1. The student submits their transcript but there is no reflection **(lessons 1 & 4)**. If there is no transcript, that fact is recorded and the session completes.
2. The student submits their transcript, which is analysed, coded and used as the reflection object for the scaffolded reflection **(lessons 2 & 3)**. If there is no transcript, scraping and analysis are skipped and the student receives the researchers' R01 reflection.

**State overview: Case #1**
```
Session creation (S0)
        |
        v
Submission choice (S1)
        |-- Gemini used --> Scraping --error--> FAILURE --retry--> back to S1
        |                         |
        |                         | student confirms the transcript
        |                         v
        |                  Session completed
        |
        `-- Gemini not used --> record no transcript --> Session completed
```

**State overview: Case #2**
```
Session creation (S0)
        |
        v
Submission choice (S1)
        |-- Gemini used --> Scraping --error--> FAILURE --retry--> back to S1
        |                         |
        |                         | student confirms the transcript
        |                         v
        |                  Analysis (S2) --error--> FAILURE --retry--> back to S2
        |                         |
        |                         v
        |                  Scaffolded reflection (S3)
        |
        `-- Gemini not used --> R01 reflection (S3)
                                  |
                                  v
                         save reflection --error--> FAILURE --retry--> back to S3
                                  |
                                  v
                         Session completed
```
- `FAILURE` is not a final state. It should show the student a friendly message, keep the error code for researchers, and let the student retry the step that failed. Data saved in earlier steps is kept. Each state should handle errors in an appropriate manner.

**`Session creation (S0)`**
Students must sumbit their `participant_code` to start a session. Since the research projects aims to look for session-to-session changes in prompting tendencies **within** each student, it is imperitive that this is saved in the database.

Each `participant_code` is handed out together with a 4-digit PIN that is generated with it. Students need both their code and their PIN to start or resume any of their sessions. The PIN is stored in clear text so researchers can tell a student who forgets it. Since 4 digits are quick to guess, repeated failed attempts are temporarily blocked.

A session is identified by the participant code together with the lesson, so a student has at most one session per lesson. Logging in again with the same code and lesson resumes that session, and a completed lesson cannot be reopened. The browser keeps the session in a cookie holding a random token; only a hash of the token is stored, so access to the database alone does not let anyone resume a student's session. A session starts in the state `awaiting_transcript`; despite the historical name, this screen now accepts either a transcript link or an explicit statement that Gemini was not used.

**`Submission & Scraping (S1)`**
Students submit a link to their Gemini transcript. One important thing to note is that while the chat is static once the link is created, it will cease to function if the underlying chat is deleted. Since the transcript is **important research data**, it must be scraped and saved to the database. This should be done in a format readable to both an LLM and a human encoder.

On the same screen, a student can instead state that they did not use Gemini during the lesson. The session record then sets the transcript submission to `no_gemini` and stores no transcript or link. Any unconfirmed scrape attempt is superseded so that it cannot later overwrite this choice. Lessons **1** and **4** complete after this choice. Lessons **2** and **3** skip scraping and analysis and continue directly to the R01 reflection, whose intro, questions and tip are shown exactly as the researchers wrote them.

Transcripts may include multimedia, mostly images. Images are not saved: each one is replaced with the placeholder `[PICTURE]` in the stored transcript, so no identifiable image content is kept and no image recognition is needed. As a fallback in case of faliures, the transcript link should always be saved aswell. 

After scraping, the student is shown a preview of the retrieved transcript and asked to confirm that it is their conversation ("Is this your transcript?"). If it is not, they can submit another link, which replaces the previous one. The session only moves on once the student has confirmed the transcript.

In case of lesson **1** or lesson **4**, the session is considered completed as soon as the transcript has successfully been scraped and the student has confirmed it.

**`Analysis (S2)`**
As soon as a student in lesson **2** or **3** has confirmed their transcript, it is fed to the AI encoding agent through the API. The analysis runs in the background: the student sees that it is in progress and gets the result when it is done, also after closing the page and logging in again.

The analysis is done in two steps.

1. **Coding.** The AI is prepared with the [[analysis_guidelines]] and the two coding schemas (prompt_coding.JSON, sequence_coding.JSON). It codes every student prompt and identifies sequences. A prompt can get several codes, in the priority order the guidelines define. The coding is **research data**: it is saved to the database in a format where it's apparent what prompt/sequence-level behaviour was observed, as well as what part of the transcript the observation was made. It is only saved if every code exists in the schemas and every quoted part really is in the transcript.
2. **Reflection points.** The AI then chooses which observations the student reflects on, guided by general guidelines rather than fixed rules. The number of reflection points is capped by a configurable maximum (default: 3) so that reflection doesn't take too much time. Every observation belongs to a behaviour group (behaviour_grouping.JSON) with human-authored texts: an intro, questions and a tip. The texts are used as written, and only their marked parts (in square brackets) are filled in to fit the specific situation. If nothing in the transcript is suitable, the student gets the general questions instead.

The coding is done without the reflection texts, so that it is not influenced by them. If the analysis fails, the student can start it again and it continues from the step that failed.

**`Scaffolded reflection (S3)`**
The reflection points from `S2` are shown to the student as examples from their own transcript: the prompt in question together with the messages right before and after it, the intro, and the questions. Examples that reinforce a behaviour and examples that ask the student to reflect on one are told apart by a light colour (green and pink).

The student writes one free-text answer per example. The questions are suggestions to get the thinking started, not a list to be answered one by one. For every concrete transcript analysis, the student must also say whether they recognise themselves in it (`yes`, `partly`, or `no`). The analysis is presented as a possible interpretation that may lack context. Choosing `partly` or `no` displays a prompt to explain why in the same free-text answer; it does not add a second answer field or change the researchers' questions. General reflection (R0) and no-transcript reflection (R01) contain no analysis to agree with and therefore omit this choice.

The student's answers and any agreement choices are redacted and stored together, linked to the displayed reflection item. All required answers and agreement choices are saved atomically before the session completes.

**`Session completed`**
Once the student has answered all reflection questions and submitted the reflection (`case #2`), or once the data has been successfully scraped and the student has confirmed the transcript (`case #1`), the session is considered completed. A no-Gemini session completes immediately in lessons 1 and 4, and after the saved R01 response in lessons 2 and 3.

### Disconnection or unexpected faliures
If a session has not been marked as completed but the user dissconnects, the session should be able to be resumed. A completed session cannot be resumed or viewed by the user again.
