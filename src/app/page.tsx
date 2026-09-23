import { LoginForm } from "@/app/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { sv } from "@/lib/sv";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const submitted = (await searchParams).submitted === "1";

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 p-6">
      {submitted ? (
        <Alert>
          <AlertDescription>{sv.session.submittedSuccess}</AlertDescription>
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
