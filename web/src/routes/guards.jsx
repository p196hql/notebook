import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isReady, user } = useAuth();

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

function GuestRoute({ children }) {
  const { isReady, user } = useAuth();

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
