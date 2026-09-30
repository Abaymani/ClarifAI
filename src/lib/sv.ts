// All student-facing text, in Swedish, in one place so the researchers can review
// the wording without reading the components.
export const sv = {
  appName: "ClarifAI",
  login: {
    title: "Logga in",
    intro: "Använd deltagarkoden och PIN-koden du fick av din lärare.",
    code: "Deltagarkod",
    codeHint: "1–3 siffror",
    codePlaceholder: "t.ex. 12",
    pin: "PIN-kod",
    pinHint: "Har du tappat bort koden? Fråga din lärare.",
    pinPlaceholder: "4 siffror",
    lessonLegend: "Vilken lektion gäller inlämningen?",
    lesson: (lesson: number) => `Lektion ${lesson}`,
    submit: "Starta",
    submitting: "Startar …",
  },
  errors: {
    codeMissing: "Skriv din deltagarkod.",
    codeFormat: "Deltagarkoden ska vara 1–3 siffror.",
    codeUnknown:
      "Koden finns inte. Kontrollera att du skrivit rätt, eller fråga din lärare.",
    pinMissing: "Skriv din PIN-kod.",
    pinFormat: "PIN-koden ska vara 4 siffror.",
    pinWrong: (attemptsLeft: number) =>
      `Fel PIN-kod. Du har ${attemptsLeft} försök kvar. Tala med din lärare om du har glömt din PIN-kod.`,
    locked: (minutesLeft: number) =>
      `För många försök. Vänta ${minutesLeft} minuter och försök igen, eller fråga din lärare.`,
    lessonMissing: "Välj vilken lektion inlämningen gäller.",
    lessonCompleted: (lesson: number) =>
      `Lektion ${lesson} är redan inlämnad och kan inte öppnas igen.`,
    unexpected: (errorCode: string) =>
      `Något gick fel. Försök igen om en stund. Felkod: ${errorCode}.`,
    transcriptLinkMissing: "Klistra in länken till din Gemini-chatt.",
    transcriptInvalidLink: (errorCode: string) =>
      `Länken är inte en giltig Gemini-delning. Kopiera delningslänken från Gemini och försök igen. Felkod: ${errorCode}.`,
    transcriptNotFound: (errorCode: string) =>
      `Chatten kunde inte hittas. Kontrollera länken och att chatten inte har tagits bort. Felkod: ${errorCode}.`,
    transcriptNotAccessible: (errorCode: string) =>
      `Chatten går inte att öppna. Kontrollera att länken är offentligt delad och försök igen. Felkod: ${errorCode}.`,
    transcriptEmpty: (errorCode: string) =>
      `Chatten innehåller inga meddelanden att lämna in. Felkod: ${errorCode}.`,
    transcriptTooLarge: (errorCode: string) =>
      `Chatten är för stor för att lämnas in. Be din lärare om hjälp. Felkod: ${errorCode}.`,
    transcriptFetchFailed: (errorCode: string) =>
      `Gemini kunde inte nås just nu. Vänta en stund och försök igen. Felkod: ${errorCode}.`,
    transcriptUnexpectedFormat: (errorCode: string) =>
      `Gemini-chatten kunde inte läsas. Be din lärare om hjälp. Felkod: ${errorCode}.`,
    transcriptSuperseded:
      "En nyare inlämning har redan startats. Sidan visar det senaste resultatet.",
    transcriptNotReady:
      "Transkriptet är inte redo för detta steg. Ladda om sidan och försök igen.",
    sessionExpired: "Sessionen har gått ut. Logga in igen.",
    transcriptRetry: (errorCode: string) =>
      `Det förra försöket misslyckades. Kontrollera länken och försök igen. Felkod: ${errorCode}.`,
    analysisFailed: (errorCode: string) =>
      `Något gick fel under analysen. Försök igen. Felkod: ${errorCode}.`,
    analysisInterrupted: (errorCode: string) =>
      `Analysen blev avbruten innan den var klar. Försök igen. Felkod: ${errorCode}.`,
    analysisTooLong: (errorCode: string) =>
      `Chatten är för lång för att analyseras. Be din lärare om hjälp. Felkod: ${errorCode}.`,
    analysisUnavailable: (errorCode: string) =>
      `Analysen går inte att köra just nu. Be din lärare om hjälp. Felkod: ${errorCode}.`,
    analysisNotRetryable:
      "Analysen kan inte startas om just nu. Ladda om sidan och försök igen.",
  },
  session: {
    heading: "Sessionen är igång",
    participant: (code: string, lesson: number) =>
      `Deltagare ${code} · Lektion ${lesson}`,
    intro:
      "Nästa steg är att lämna in länken till din Gemini-chatt. Du kan stänga fönstret och fortsätta senare med samma deltagarkod och PIN-kod.",
    statusAwaitingTranscript: "Väntar på transkript",
    statusProcessing: "Hämtar transkript",
    statusAwaitingConfirmation: "Väntar på bekräftelse",
    statusTranscriptConfirmed: "Transkript bekräftat",
    transcriptHeading: "Lämna in transkript",
    transcriptLabel: "Länk till din Gemini-chatt",
    transcriptPlaceholder: "https://share.gemini.google/...",
    transcriptHelp:
      "Öppna chatten i Gemini, välj Dela och kopiera den offentliga länken.",
    transcriptSubmit: "Lämna in",
    transcriptSubmitting: "Hämtar …",
    previewHeading: "Är det här ditt transkript?",
    previewIntro:
      "Kontrollera att meddelandena kommer från rätt Gemini-chatt innan du fortsätter.",
    previewStudent: "Du",
    previewGemini: "Gemini",
    previewMessages: (count: number) =>
      `${count} meddelande${count === 1 ? "" : "n"}`,
    previewWarnings: "En del innehåll kunde inte visas i transkriptet.",
    confirm: "Ja, fortsätt",
    confirming: "Bekräftar …",
    reject: "Nej, välj en annan länk",
    rejecting: "Öppnar formuläret …",
    confirmedHeading: "Transkriptet är bekräftat",
    confirmedIntro: "Transkriptet är sparat.",
    submittedSuccess: "Tack! Ditt transkript har lämnats in.",
    logout: "Logga ut",
    statusAnalysing: "Analyseras",
    statusAnalysisFailed: "Analysen avbröts",
    statusAwaitingReflection: "Väntar på dina svar",
    analysingHeading: "Vi analyserar din chatt",
    analysingIntro:
      "Det kan ta en stund. Du kan stänga sidan och logga in igen senare, analysen fortsätter ändå.",
    analysingProgress: "Analyserar …",
    analysisFailedHeading: "Analysen blev inte klar",
    analysisFailedIntro:
      "Ditt transkript är sparat. Starta analysen igen, så fortsätter den där den slutade.",
    analysisRetry: "Försök igen",
    analysisRetrying: "Startar …",
    reflectionHeading: "Dags att reflektera",
    reflectionIntro:
      "Här är några exempel från din chatt, med en fråga till varje. Svara med egna ord.",
    reflectionIntroGeneral:
      "Chatten gav inte tillräckligt underlag för att peka ut enskilda exempel. Fundera i stället på frågan nedan.",
    reflectionExample: (position: number) => `Exempel ${position}`,
    reflectionGeneral: "Fråga",
    contextShowMore: "Visa mer",
    contextShowLess: "Visa mindre",
    reflectionAnswerLabel: "Ditt svar",
    reflectionAnswerSoon:
      "Här skriver du ditt svar. Den delen öppnas i nästa steg av bygget.",
    reflectionTest:
      "TEST: ramverket och frågorna är platshållare, inte studiens riktiga.",
    reflectionFake: "Testanalys utan AI: kodningen är påhittad.",
  },
} as const;
