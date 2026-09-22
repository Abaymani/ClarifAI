# System Architecture
This document is an overview of the suggested technical stack for the project aswell as the use-case scenario.

## Use-case
For the use-case description, see [[00_product_brief]]

## Tech-Stack
|Concern|Tool|Comments|
|---|---|---|
|Frontend|NextJS|Also use typescript.|
|Styling|Tailwind CSS|Use existing templates for styling wherever possible as to not reinvent the wheel.|
|"Backend"|NextJS (Route handlers)|The use-case is simple, and as service providers we are not doing any real logic, only routing between the AI API, our database and the UI. This can all be done with just NextJS.|
|LLM Provider|OpenAI ChatGPT|Analysis will be done through API calls to ChatGPT. A link to the student transcript will be submitted together with the coding schemes and instructions.|
|Database|Google Firebase|Cloud Firestore is a document (NoSQL) database. There will be at most 60 users, with a maximum of 4 sessions each. Each session is self-contained. A document based system for storage is therefore likely more than enough for our purposes.|
|Hosting|Vercel|Vercel makes it trivial to host NextJS projects and has a generous free hosting tier.|
|Auth|N/A (Participant code)|Each student recieves a `participant_code` (pseudonym) from their teacher. No names, emails or any other identifiable information should be stored under any circumstance due to ethical concerns.|

## Session Lifecycle
Every submission and completed reflection is counted as one **session**.

There are two types of sessions.
1. Student submits their transcript but there is no reflection **(lessons 1 & 4)**.
2. Student submits their transcript, which is analysed, coded and used as the reflection object for the scaffolded reflection **(lessons 2 & 3)**.

**State overview: Case #1**
```
Session creation (S0) --> Submission & Scraping (S1) --> Session completed 
                            |               
                            └────────────FAILURE (with error code!)
```

**State overview: Case #2**
```
Session creation (S0) --> Submission & Scraping (S1) --> Analysis (S2) --> Scaffolded reflection (S3) --> Session completed 
                            |                              |                 |
                            └──────────────────────────────└─────────────────└───────────FAILURE (with error code!)
```
- `FAILURE` should show the student a friendly message and keep the error code for researchers. Each state should handle errors in an appropriate manner.

**`Session creation (S0)`**
Students must sumbit their `participant_code` to start a session. Since the research projects aims to look for session-to-session changes in prompting tendencies **within** each student, it is imperitive that this is saved in the database.

**`Submission & Scraping (S1)`**
Students submit a link to their Gemini transcript. One important thing to note is that while the chat is static once the link is created, it will cease to function if the underlying chat is deleted. Since the transcript is **important research data**, it must be scraped and saved to the database. This should be done in a format readable to both an LLM and a human encoder.

Transcripts may include multimedia, mostly images. These must be saved. As a fallback in case of faliures, the transcript link should always be saved aswell. 

In case of lesson **1** or lesson **4**, The session is considered completed as soon as the transcript has successfully been scraped.

**`Analysis (S2)`**
Student transcripts are fed to the AI encoding agent through the API. The AI should be prepared with the [[analysis_guidelines]] and the two coding schemas (prompt_coding.JSON, sequence_coding.JSON).

The analysis is done according to the guidelines, and saved to the database. It should be in a format where it's apparent what prompt/sequence-level behaviour was observed, as well as what part of the transcript the observation was made.

**`Scaffolded reflection (S3)`**
The completed analysis of the transcript should then be used as a foundation in `S3` to build a scaffolded reflection. The relevant reflection human-authored template depending on the observed behaviour should be chosen as a base and adapted to the specific situation. At most, 3-4 reflection points should be chosen so that reflection doesn't take too much time.

The student's answers to the reflection questions/prompts must also be logged to the database. 

**`Session completed`**
Once the student has answered all reflection questions and marked the reflection as completed (`case #2`), or once the data has been successfully scraped (`case #1`), the session is considered completed. 

### Disconnection or unexpected faliures
If a session has not been marked as completed but the user dissconnects, the session should be able to be resumed. A completed session cannot be resumed or viewed by the user again.
