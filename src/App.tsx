import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Toast, { ToastMessage } from './components/Toast';
import Home from './pages/Home';
import Demo from './pages/Demo';
import About from './pages/About';
import Contact from './pages/Contact';

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
    <BrowserRouter>
      <ScrollHandler />
      <div className="flex min-h-screen flex-col bg-[#0F1419] text-[#CCCCCC] font-sans selection:bg-[#32FF00] selection:text-[#0F1419]">
        <Navbar />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/demo" element={<Demo onNotify={addNotification} />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact onNotify={addNotification} />} />
            {/* Fallback route */}
            <Route path="*" element={<Home />} />
          </Routes>
        </main>

        <Footer />
        <Toast toasts={toasts} onDismiss={dismissNotification} />
      </div>
    </BrowserRouter>
  );
}
