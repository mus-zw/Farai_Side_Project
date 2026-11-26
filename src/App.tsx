import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Toast, { ToastMessage } from './components/Toast';
import Home from './pages/Home';
import DemoGate from './components/DemoGate';
// The demo is loaded on demand, only once the gate lets a visitor through.
const Demo = lazy(() => import('./pages/Demo'));
import About from './pages/About';
import Contact from './pages/Contact';
import FitnessGate from './components/fitness/FitnessGate';
// The fitness app is loaded on demand, and only once the gate lets a visitor through, so someone
// holding an old link gets the Launching Soon page without downloading the app.
const FitnessLayout = lazy(() => import('./components/fitness/FitnessLayout'));
const TodayPage = lazy(() => import('./pages/fitness/TodayPage'));
const ProgressPage = lazy(() => import('./pages/fitness/ProgressPage'));
const ProfilePage = lazy(() => import('./pages/fitness/ProfilePage'));
const AppLoading = () => <div className="min-h-screen" style={{ background: '#0a0c0f' }} aria-busy="true" />;
import { ProfileProvider } from './components/ProfileProvider';
import { ConsentProvider } from './components/ConsentProvider';
import { EntitlementProvider } from './components/pro/EntitlementProvider';
import ProfileModal from './components/ProfileModal';
import SpokeLayout from './components/SpokeLayout';
import Privacy from './pages/Privacy';
import { APP_MODE } from './utils/site';

/**
 * Handles smooth scrolling on navigation:
 * - If URL contains a #hash (e.g. /about#research), scrolls smoothly to the target element with header offset.
 * - Otherwise, resets scroll position to the top of the page.
 */
function ScrollHandler() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      const timer = setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
      return () => clearTimeout(timer);
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, [pathname, hash]);

  return null;
}

export default function App() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addNotification = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const dismissNotification = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ProfileProvider>
    <BrowserRouter>
    <ConsentProvider>
    <EntitlementProvider>
      <ScrollHandler />
      <div className="flex min-h-screen flex-col bg-[#0F1419] text-[#CCCCCC] font-sans selection:bg-[#32FF00] selection:text-[#0F1419]">
        <Routes>
          {/* The fitness area is its own app: no portfolio navbar or footer. */}
          {APP_MODE !== 'lab' && (
            <Route
              path="/fitness"
              element={
                <FitnessGate>
                  <Suspense fallback={<AppLoading />}>
                    <FitnessLayout onNotify={addNotification} />
                  </Suspense>
                </FitnessGate>
              }
            >
              <Route index element={<TodayPage />} />
              <Route path="progress" element={<ProgressPage />} />
              {/* Train and Nutrition became "Today", and the Form Coach moved into Progress. */}
              <Route path="nutrition" element={<Navigate to="/fitness" replace />} />
              <Route path="coach" element={<Navigate to="/fitness/progress#coach" replace />} />
              <Route path="profile" element={<ProfilePage />} />
              {/* The old name for the profile screen. */}
              <Route path="more" element={<Navigate to="/fitness/profile" replace />} />
            </Route>
          )}

          {APP_MODE === 'hub' && (
            <Route
              element={
                <>
                  <Navbar />
                  <main className="flex-1">
                    <Outlet />
                  </main>
                  <Footer />
                </>
              }
            >
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route
                path="/demo"
                element={
                  <DemoGate>
                    <Suspense fallback={<AppLoading />}>
                      <Demo onNotify={addNotification} />
                    </Suspense>
                  </DemoGate>
                }
              />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact onNotify={addNotification} />} />
              <Route path="/privacy" element={<Privacy />} />
              {/* Fallback route */}
              <Route path="*" element={<Home />} />
            </Route>
          )}

          {/* Standalone Auto-Labeler (lab.<domain>): `/` is the tool. */}
          {APP_MODE === 'lab' && (
            <Route element={<SpokeLayout title="CV Auto-Labeler" />}>
              <Route path="/" element={<Navigate to="/demo" replace />} />
              <Route
                path="/demo"
                element={
                  <DemoGate>
                    <Suspense fallback={<AppLoading />}>
                      <Demo onNotify={addNotification} />
                    </Suspense>
                  </DemoGate>
                }
              />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<Navigate to="/demo" replace />} />
            </Route>
          )}

          {/* Standalone fitness app: `/` is the app. */}
          {APP_MODE === 'fitness' && (
            <>
              <Route element={<SpokeLayout title="Fitness" />}>
                <Route path="/privacy" element={<Privacy />} />
              </Route>
              <Route path="*" element={<Navigate to="/fitness" replace />} />
            </>
          )}
        </Routes>

        <ProfileModal />
        <Toast toasts={toasts} onDismiss={dismissNotification} />
      </div>
    </EntitlementProvider>
    </ConsentProvider>
    </BrowserRouter>
    </ProfileProvider>
  );
}
