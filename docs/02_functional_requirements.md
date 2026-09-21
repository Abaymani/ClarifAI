

[Kommentar: lägg till att scrubba eventuella identifierbar data som framkommer i student transcript]: #
# Functional Requirements

## Login specification
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR-|Pseudonym login||A user should be able to login using their number and the identifying number should be stored to associate the submitted transcripts across lessons||
|FR-|The student gets to chose which lesson the submission is for||The user is allowed to chose which lesson the transcript is from, and the different lessons has different scaffolding connected to them||
|FR-|When the student submits for lesson 1 & 4 only a submission of transcript is asked for||||
|FR-|When the student submits for lesson 2 & 3, the submission of transcript is followed by scaffolded reflection||||
|FR-|Invalid pseudonym login gets flagged and is instructed to provide a correct pseudonym||When submitted a pseudonym that isn't in the system, the user should be given an error message that the tag doesn't exist and asked to enter a new pseudonym||

## Transcript submission
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR-|The tool asks for and accepts a link to a Google Gemini transcript||||
|FR-|Check whether the link to Google Gemini transcript is valid, if not, ask for resubmission||||
|FR-|Scrape the transcript and store a copy for research preservation||||
|FR-|The student should be able to re-upload a link to transcript if the link was wrong||||
|FR- | The system shall detect inaccessible or empty transcripts and prevent the session from proceeding as a successful submission|


## Transcript retrieval
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR- |The transcript is read and stored in the database|
|FR- |The storage of the transcript in the database should preserve who said what and in which order|
|FR- | If the transcript can't be read, then an error message should be shown|


## Identifiable information removal
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR- | When storing the transcripts, identifiable data should be removed |
|FR- | 

## Framework-based analysis
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|
|FR - | The analysis should be grounded in observational concrete examples of the behaviours in the framework|


## Selection of transcript examples
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|

## Reflection question generation
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|

## Boundaries on feedback 
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|

## Student reflection interaction
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|

## Session progress and recovery
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|

## Research records and access
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|

## Language 
|Reference|Requirement|Priority|Acceptance Criteria|Status|
|---|---|---|---|---|





