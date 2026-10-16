import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import ResetPassword from './components/ResetPassword.tsx';
import ForgotPassword from './components/ForgotPassword.tsx';
import 'lenis/dist/lenis.css';
import './index.css';
import { AuthProvider } from './lib/auth.tsx';
import { queryClient } from './lib/queryClient.ts';
import { ToastProvider } from './components/ui/Toast.tsx';
import SmoothScroll from './components/SmoothScroll.tsx';
import BackToTopButton from './components/ui/BackToTopButton.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <SmoothScroll>
                <BackToTopButton />
                <Routes>
                  {/* Public one-time password-reset page — must be outside the
                      main App state machine so the token URL is never swallowed
                      by the homepage redirect. */}
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  {/* Everything else goes to the main application. */}
                  <Route path="*" element={<App />} />
                </Routes>
              </SmoothScroll>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
);
