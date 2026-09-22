import { Button } from "@/components/ui/button";

// Placeholder until session creation (S0) is built.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">ClarifAI</h1>
      <p className="text-muted-foreground">
        Här kommer du snart att kunna lämna in din Gemini-konversation och
        reflektera över hur du har använt AI.
      </p>
      <Button disabled className="self-start">
        Kommer snart
      </Button>
    </main>
  );
}
