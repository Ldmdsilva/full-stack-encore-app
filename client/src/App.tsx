import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AdminShell } from '@/components/layout/AdminShell'
import { ToastProvider } from '@/components/ui/toast'
import { StoreProvider, useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { HomePage } from '@/pages/HomePage'
import { EventListPage } from '@/pages/EventListPage'
import { EventDetailPage } from '@/pages/EventDetailPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { ConfirmationPage } from '@/pages/ConfirmationPage'
import { MyBookingsPage } from '@/pages/MyBookingsPage'
import { LoginPage } from '@/pages/LoginPage'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { AdminEventsPage } from '@/pages/admin/AdminEventsPage'
import { AdminEventFormPage } from '@/pages/admin/AdminEventFormPage'
import { AdminBookingsPage } from '@/pages/admin/AdminBookingsPage'
import { AdminVenuesPage } from '@/pages/admin/AdminVenuesPage'
import { AdminVenueFormPage } from '@/pages/admin/AdminVenueFormPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { useNavigate } from 'react-router-dom'

// Client-side route guard is UX only — a real server authorises every write.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useStore()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useStore()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-xl px-5 py-28 text-center">
      <p className="eyebrow text-stamp-red">404</p>
      <h1 className="mt-3 font-voice text-[40px] font-medium tracking-[-0.02em]">
        This page isn't on the bill.
      </h1>
      <p className="mt-2 text-text-secondary">
        The link may have expired or the show has moved on.
      </p>
      <Button className="mt-6" onClick={() => navigate('/events')}>
        Back to concerts
      </Button>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ToastProvider>
          <Routes>
            {/* Public / customer shell */}
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/events" element={<EventListPage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route
                path="/checkout/:eventId"
                element={
                  <ProtectedRoute>
                    <CheckoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/confirmation/:bookingId"
                element={
                  <ProtectedRoute>
                    <ConfirmationPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/bookings" element={<MyBookingsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* Admin shell — ink sidebar, no footer */}
            <Route
              element={
                <AdminRoute>
                  <AdminShell />
                </AdminRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/events" element={<AdminEventsPage />} />
              <Route path="/admin/events/new" element={<AdminEventFormPage />} />
              <Route path="/admin/events/:id/edit" element={<AdminEventFormPage />} />
              <Route path="/admin/bookings" element={<AdminBookingsPage />} />
              <Route path="/admin/venues" element={<AdminVenuesPage />} />
              <Route path="/admin/venues/new" element={<AdminVenueFormPage />} />
              <Route path="/admin/venues/:id/edit" element={<AdminVenueFormPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  )
}
