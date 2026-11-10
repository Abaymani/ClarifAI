import { DemoStart } from "@/app/demo-start";
import { LoginForm } from "@/app/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { demoMode } from "@/lib/demo";
import { sv } from "@/lib/sv";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const submitted = (await searchParams).submitted;
  const receipt =
    submitted === "1"
      ? sv.session.submittedSuccess
      : submitted === "no-gemini"
        ? sv.session.noGeminiSuccess
        : null;

  if (demoMode()) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 p-6">
        <Card>
          <CardHeader>
            <h1 className="font-heading text-2xl leading-snug font-medium">
              {sv.demo.title}
            </h1>
            <CardDescription>{sv.demo.intro}</CardDescription>
          </CardHeader>
          <CardContent>
            <DemoStart />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 p-6">
      {receipt ? (
        <Alert>
          <AlertDescription>{receipt}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <h1 className="font-heading text-2xl leading-snug font-medium">
            {sv.login.title}
          </h1>
          <CardDescription>{sv.login.intro}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
