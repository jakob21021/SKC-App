import { useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { api } from './data'
import { invalidateScope } from './state/queries'
import { SessionProvider, useMe } from './state/session'
import { ToastProvider } from './components/Toast'
import { AppShell } from './components/AppShell'
import { Splash } from './components/Splash'
import { Login } from './screens/Login'
import { RequestAccess } from './screens/RequestAccess'
import { Home } from './screens/Home'
import { Calendar } from './screens/Calendar'
import { EventDetail } from './screens/EventDetail'
import { EventEditor } from './screens/EventEditor'
import { LiveScorer } from './screens/LiveScorer'
import { Games } from './screens/Games'
import { PlayerStats } from './screens/PlayerStats'
import { Helpers, HelperListDetail } from './screens/Helpers'
import { HelperListEditor } from './screens/HelperListEditor'
import { More } from './screens/More'
import { NewsList, NewsDetail } from './screens/News'
import { NewsEditor } from './screens/NewsEditor'
import { Specials } from './screens/Specials'
import { Teams, TeamDetail } from './screens/Teams'
import { Venues, Contact, Privacy } from './screens/ClubInfo'
import { Profile } from './screens/Profile'
import { Settings } from './screens/Settings'
import { Notifications } from './screens/Notifications'
import { Admin } from './screens/Admin'

function RealtimeBridge() {
  const qc = useQueryClient()
  useEffect(() => api.subscribe((scope) => void invalidateScope(qc, scope)), [qc])
  return null
}

function RequireEntry({ children }: { children: ReactNode }) {
  const { me, guest, pending, loading } = useMe()
  if (loading) return <Splash />
  if (!me && !guest && !pending) return <Navigate to="/login" replace />
  return children
}

export function App() {
  return (
    <HashRouter>
      <SessionProvider>
        <ToastProvider>
          <RealtimeBridge />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/zugang" element={<RequestAccess />} />
            <Route path="/datenschutz" element={<Privacy />} />
            <Route path="/termine/:id/live" element={<RequireEntry><LiveScorer /></RequireEntry>} />
            <Route element={<RequireEntry><AppShell /></RequireEntry>}>
              <Route index element={<Home />} />
              <Route path="termine" element={<Calendar />} />
              <Route path="termine/neu" element={<EventEditor />} />
              <Route path="termine/:id" element={<EventDetail />} />
              <Route path="termine/:id/bearbeiten" element={<EventEditor />} />
              <Route path="spiele" element={<Games />} />
              <Route path="statistik/:memberId" element={<PlayerStats />} />
              <Route path="helfen" element={<Helpers />} />
              <Route path="helfen/neu" element={<HelperListEditor />} />
              <Route path="helfen/:id" element={<HelperListDetail />} />
              <Route path="mehr" element={<More />} />
              <Route path="news" element={<NewsList />} />
              <Route path="news/neu" element={<NewsEditor />} />
              <Route path="news/:id" element={<NewsDetail />} />
              <Route path="specials" element={<Specials />} />
              <Route path="teams" element={<Teams />} />
              <Route path="teams/:id" element={<TeamDetail />} />
              <Route path="hallen" element={<Venues />} />
              <Route path="kontakt" element={<Contact />} />
              <Route path="profil" element={<Profile />} />
              <Route path="einstellungen" element={<Settings />} />
              <Route path="benachrichtigungen" element={<Notifications />} />
              <Route path="verwaltung" element={<Admin />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </SessionProvider>
    </HashRouter>
  )
}
