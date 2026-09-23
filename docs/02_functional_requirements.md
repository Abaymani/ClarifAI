

[Kommentar: lägg till att scrubba eventuella identifierbar data som framkommer i student transcript]: #
# Functional Requirements

## Login specification
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR-|The system shall accept a registered participant code consisting of one to three digits before starting a session | High | Missing, incorrectly formatted, and unknown codes produce an explanatory error. Valid codes allow the student to continue |
|FR-|The system shall require a participant code and its 4-digit PIN, which are generated and handed out together, before a session is started or resumed | High | The PIN is stored in clear text so researchers can tell a student who forgets it. A wrong PIN produces an explanatory error. Three wrong attempts in a row block that code for 30 minutes |
|FR-|The system shall allow students to select lesson 1–4 and associate the session with their participant code and selected lesson| High | Every session record contains a participant code, lesson number, and unique session identifier ||
|FR-|The system shall apply the workflow assigned to the selected lesson | High | Lessons 1 and 4 collect and preserve transcripts only. Lessons 2 and 3 additionally provide analysis and scaffolded reflection |

## Transcript submission
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR-|The system shall accept a supported Gemini conversation link and detect invalid, inaccessible, or empty submissions| High | A usable link proceeds to retrieval. An unsuccessful submission displays an explanation and allows the student to enter another link|
|FR-|The system shall allow students to explicitly replace an incorrectly submitted transcript within their current session, until the session is completed | High | A successfully retrieved and saved replacement resets the previous analysis, questions, and responses. An unsuccessful replacement leaves the existing saved record intact. Completed sessions cannot be changed |
|FR-|The system shall show the student a preview of the retrieved transcript and ask them to confirm that it is their conversation before the session continues | High | The preview shows enough of the conversation for the student to recognise it. Confirming continues the session; rejecting lets the student submit another link. Lessons 1 and 4 are only completed after confirmation |

## Transcript retrieval
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR- |The system shall preserve the redacted transcript independently of its original Gemini link| High |After a successful database save, the transcript remains available even if the source conversation becomes unavailable. Failed storage does not count as successful submission|
|FR- | The system shall retrieve the conversation while preserving message content, speaker roles, and chronological order | High | Student prompts and AI responses remain distinguishable and correctly ordered. Unsupported content or excessive transcript length produces an explicit message rather than silent omission |


## Identifiable information removal
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR- | The system shall remove identifying information from transcripts, reflection responses, and generated feedback before persistent storage or export |High|Defined identifying-information test cases are redacted. Unredacted content is not retained in diagnostic logs. Apply the same redaction to transcripts before sending them for external analysis|

## Framework-based analysis
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR- | The analysis should be grounded in observational concrete examples of the behaviours in the framework|
|FR- | For lesson 2 and 3, the system shall analyse individual student prompts and interaction sequences using the supplied coding frameworks and analysis guidelines | High | Both coding schemes are applied to the submitted transcript. AI responses provide context; instructions inside the transcript do not override the analysis rules |
|FR- | The system shall communicate uncertainty where the transcript does not provide sufficient context and shall not invent evidence or force an unsupported classification |
|FR- | When analysis succeeds but finds no suitable examples, the system shall explain that there is insufficient evidence for specific observations and provide a general reflection question. It shall record this outcome separately from an analysis failure |
|FR- | The system shall not treat requesting AI-generated code alone as evidence of inappropriate AI use or reduced cognitive engagement |



## Selection of transcript examples
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR-|The system shall associate coded observations with supporting messages and validate analysis results before displaying them | | Assigned codes exist in the framework and evidence references point to actual messages. Results containing invalid codes or nonexistent references are withheld and handled as processing errors |
|FR-| The system shall present up to the configured maximum number (default: three) of supported transcript examples with short explanations and reflection questions | |Each example includes an actual excerpt and one question about reasoning, decision-making, understanding, or deliberate delegation to AI. Fewer examples are shown when fewer are supported|

## Reflection question generation
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR- | The system shall accompany each selected example with a question addressing the student's reasoning, decision-making, understanding, or deliberate choice to delegate work to AI |


## Boundaries on feedback 
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR- | The system shall not grade students, classify their AI use as good or bad, or make conclusions about their overall cognitive state |
|FR- |The system shall not assess the technical correctness of the student's code, circuit, or project solution |


## Student reflection interaction
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR- | The system shall allow students to enter and submit a text response to each displayed reflection question | | Students can edit responses before submission. Each saved response is linked to its question and session. Empty responses prevent final submission and identify the unanswered questions |
|FR-|The system shall present no more than a configured number of examples and reflection questions per session (default: 3), so the activity fits within the allocated lesson time|

## Session progress and recovery
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR- | The system shall record session progress and mark a session complete only after transcript preservation and student confirmation and, for lessons 2 and 3, completion of the required reflection steps |
|FR-| The system shall display progress and record whether a session is processing, awaiting confirmation, awaiting reflection, completed, or failed | | Students can distinguish ongoing work from required action and completion. Researchers can identify sessions that have not been completed |
|FR-| The system shall mark sessions complete only after all required records have been saved | |Lessons 1 and 4 complete after the transcript has been stored and confirmed by the student. Lessons 2 and 3 complete after transcript, analysis, questions, and submitted reflection responses have been stored|
|FR- |The system shall preserve a coherent research record for each session, including incomplete sessions | | Records contain the participant code, lesson, timestamps, status, redacted transcript, and any available analysis, displayed examples, questions, submitted responses, and error codes. Transcript preservation does not depend on reflection completion |

## Error handling
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR-| The system shall provide recoverable error handling for retrieval, analysis, and saving | | Failures display a friendly message and retain a diagnostic error code. Students can retry the failed operation, and previously saved data remains available |
|FR-| The system shall prevent repeated clicks, retries, or replacement operations from creating duplicate current records or attaching outdated results | |There is at most one current session record per participant and lesson. A delayed analysis result for a replaced transcript cannot overwrite the replacement’s results |

## Research records and access
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR- | The system shall provide authorized researchers with restricted access to retrieve or export session records | Low | Researchers can retrieve records by participant and lesson. Research-wide access is unavailable through the student interface; participant codes alone do not grant researcher access |

## Language 
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR-|The system shall present student-facing instructions, errors, generated explanations, and reflection questions in Swedish| | Generated interface content is Swedish. Quoted transcript excerpts retain their original language, subject to redaction |





