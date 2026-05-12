import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/layouts/AppShell";
import { CreateNotebookPage } from "@/pages/CreateNotebookPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { NotebookPage } from "@/pages/NotebookPage";
import { SignupPage } from "@/pages/SignupPage";
import { GuestRoute, ProtectedRoute } from "@/routes/guards";

function AppRoutes({
  authLoading,
  creatingNotebook,
  isReady,
  notebooks,
  onCreateNotebook,
  onDeleteConversation,
  onDeleteNotebook,
  onRenameConversation,
  onRenameNotebook,
  onLogin,
  onLogout,
  onSignup,
  user,
}) {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute isReady={isReady} user={user}>
            <LoginPage authLoading={authLoading} onLogin={onLogin} />
          </GuestRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestRoute isReady={isReady} user={user}>
            <SignupPage authLoading={authLoading} onSignup={onSignup} />
          </GuestRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute isReady={isReady} user={user}>
            <AppShell
              authLoading={authLoading}
              notebooks={notebooks}
              onDeleteConversation={onDeleteConversation}
              onDeleteNotebook={onDeleteNotebook}
              onRenameConversation={onRenameConversation}
              onRenameNotebook={onRenameNotebook}
              user={user}
              onLogout={onLogout}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage notebooks={notebooks} />} />
        <Route
          path="notebooks/new"
          element={
            <CreateNotebookPage
              creatingNotebook={creatingNotebook}
              onCreate={onCreateNotebook}
            />
          }
        />
        <Route path="notebooks/:notebookId" element={<NotebookPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export { AppRoutes };
