import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/toaster";
import { AppLayout } from "@/layouts/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            {/* Protected — wrapped in AppLayout */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/calendar"
                element={<PlaceholderPage title="Calendar" />}
              />
              <Route
                path="/tasks"
                element={<PlaceholderPage title="Tasks" />}
              />
              <Route
                path="/chat"
                element={<PlaceholderPage title="Chat" />}
              />
              <Route
                path="/mail"
                element={<PlaceholderPage title="Mail" />}
              />
              <Route
                path="/phone"
                element={<PlaceholderPage title="Phone" />}
              />
              <Route
                path="/contacts"
                element={<PlaceholderPage title="Contacts" />}
              />
              <Route
                path="/settings"
                element={<PlaceholderPage title="Settings" />}
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
