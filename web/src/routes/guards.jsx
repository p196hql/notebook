import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({ isReady, user, children }) {
  const location = useLocation();

  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function GuestRoute({ isReady, user, children }) {
  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </main>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export { GuestRoute, ProtectedRoute };
