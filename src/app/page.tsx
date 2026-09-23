import { LoginForm } from "@/app/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { sv } from "@/lib/sv";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center p-6">
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
