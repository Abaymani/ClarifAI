import { redirect } from "next/navigation";

import { AdminLogin } from "@/app/admin/admin-login";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { firebaseWebAuthConfig, getCurrentResearcher } from "@/lib/admin/auth";

export default async function AdminLoginPage() {
  if (await getCurrentResearcher()) redirect("/admin/overview");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center p-6">
      <Card>
        <CardHeader className="text-center">
          <p className="text-sm font-medium text-muted-foreground">ClarifAI</p>
          <h1 className="font-heading text-2xl leading-snug font-semibold">
            Forskarportal
          </h1>
          <p className="text-sm text-muted-foreground">
            Logga in med ditt godkända Google-konto.
          </p>
        </CardHeader>
        <CardContent>
          <AdminLogin config={firebaseWebAuthConfig()} />
        </CardContent>
      </Card>
    </main>
  );
}
