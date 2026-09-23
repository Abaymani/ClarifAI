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
  },
  session: {
    heading: "Sessionen är igång",
    participant: (code: string, lesson: number) =>
      `Deltagare ${code} · Lektion ${lesson}`,
    intro:
      "Nästa steg är att lämna in länken till din Gemini-chatt. Du kan stänga fönstret och fortsätta senare med samma deltagarkod och PIN-kod.",
    statusAwaitingTranscript: "Väntar på transkript",
    transcriptHeading: "Lämna in transkript",
    transcriptLabel: "Länk till din Gemini-chatt",
    transcriptPlaceholder: "https://share.gemini.google/...",
    transcriptSubmit: "Lämna in",
    transcriptComingSoon:
      "Det här steget byggs i nästa del och är avstängt än så länge.",
    logout: "Logga ut",
  },
} as const;
