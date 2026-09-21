# System Architecture
This document is an overview of the suggested technical stack for the project aswell as the use-case scenario.

## Use-case
For the use-case description, see [[00_product_brief]]

## Tech-Stack
|Concern|Tool|Comments|
|---|---|---|
|Frontend|NextJS|Also use typescript.|
|"Backend"|NextJS (Route handlers)|The use-case is simple, and as service providers we are not doing any real logic, only routing between the AI API, our database and the UI. This can all be done with just NextJS.|
|LLM Provider|OpenAI ChatGPT|Analysis will be done through API calls to ChatGPT. A link to the student transcript will be submitted together with the coding schemes and instructions.|
|Database|Google Firebase|Cloud Firestore is a document (NoSQL) database. There will be at most 60 users, with a maximum of 4 sessions each. Each session is self-contained. A document based system for storage is therefore likely more than enough for our purposes.|
|Hosting|Vercel|Vercel makes it trivial to host NextJS projects and has a generous free hosting tier.|
|Auth|Participant code|Each student recieves a `participant_code` (pseudonym) from their teacher. No names, emails or any other identifiable information should be stored under any circumstance due to ethical concerns.|

## Session Lifecycle
Every submission and completed reflection is counted as one **session**.

There are two types of sessions.
1. Student submits their transcript but there is no reflection **(lessons 1 & 4)**.
2. Student submits their transcript, which is analysed, coded and used as a tool for scaffolded reflection **(lessons 2 & 3)**.

**State overview: Case #1**
```
Session creation (S0) --> Upload (S1) --> Scraping (S2) --> Completed 
                            |               |
                            └───────────────└────────────────FAILURE (with error code!)
```

**State overview: Case #2**
```
Session creation (S0) --> Upload (S1) --> Scraping (S2) --> Analysis (S3) --> Scaffolded reflection (S4) --> Completed 
                            |               |                 |                 |
                            └───────────────└─────────────────└─────────────────└───────────FAILURE (with error code!)
```
- `FAILURE` should show the student a friendly message and keep the error code for researchers. 

**`Session creation (S0)`**
Students must sumbit their `participant_code` to start a session. Since the research projects aims to look for session-to-session changes in prompting tendencies **within** each student, it is imperitive that this is saved in the database.

**`Upload (S1)`**
Students submit a link to their Gemini transcript. One important thing to note is that while the chat is static once the link is created, it will cease to function if the underlying chat is deleted. Since the transcript is **important research data**, it must be scraped and saved to the database.