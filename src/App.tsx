import { AppShell } from '@/components/layout/app-shell'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { ThemeProvider } from '@/hooks/use-theme'
import { isSupabaseConfigured } from '@/lib/supabase'
import { FoodsPage } from '@/pages/foods'
import { HistoryPage } from '@/pages/history'
import { LoginPage } from '@/pages/login'
import { SettingsPage } from '@/pages/settings'
import { SetupRequiredPage } from '@/pages/setup-required'
import { StatsPage } from '@/pages/stats'
import { TodayPage } from '@/pages/today'
import { WorkoutsPage } from '@/pages/workouts'
import { Loader2 } from 'lucide-react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (session) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <ThemeProvider>
        <SetupRequiredPage />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <LoginPage />
                </RedirectIfAuthed>
              }
            />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route index element={<TodayPage />} />
              <Route path="gym" element={<WorkoutsPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="foods" element={<FoodsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </ThemeProvider>
  )
}
