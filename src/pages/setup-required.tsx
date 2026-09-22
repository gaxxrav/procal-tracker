import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Shown when the app hasn't been pointed at a Supabase project yet. */
export function SetupRequiredPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Connect a Supabase project</CardTitle>
          <CardDescription>
            procal needs a database before it can store anything.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              Create a project at{' '}
              <a
                className="font-medium text-foreground underline underline-offset-4"
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
              >
                supabase.com/dashboard
              </a>
              .
            </li>
            <li>
              Run <code className="rounded bg-muted px-1 py-0.5">supabase/migrations/0001_init.sql</code>{' '}
              in the project&apos;s SQL editor.
            </li>
            <li>
              Copy <code className="rounded bg-muted px-1 py-0.5">.env.example</code> to{' '}
              <code className="rounded bg-muted px-1 py-0.5">.env.local</code> and fill in the
              project URL and anon key from Settings → API.
            </li>
            <li>Restart the dev server.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            On Vercel, set the same two variables under Settings → Environment Variables.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
