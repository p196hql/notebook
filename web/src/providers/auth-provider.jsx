import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AuthContext } from "@/contexts/auth-context";
import {
  fetchSession,
  login as loginRequest,
  logout as logoutRequest,
  signup as signupRequest,
} from "@/lib/auth";

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const data = await fetchSession();
        setUser(data.user);
      } catch (error) {
        if (error.status !== 401) {
          toast.error(error.message);
        }
      } finally {
        setIsReady(true);
      }
    }

    loadSession();
  }, []);

  async function handleLogin(values) {
    setAuthLoading(true);

    try {
      const data = await loginRequest(values);
      setUser(data.user);
      toast.success(data.message);
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignup(values) {
    setAuthLoading(true);

    try {
      const data = await signupRequest(values);
      setUser(data.user);
      toast.success(data.message);
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    setAuthLoading(true);

    try {
      const data = await logoutRequest();
      setUser(null);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  const value = useMemo(
    () => ({
      authLoading,
      isReady,
      onLogin: handleLogin,
      onLogout: handleLogout,
      onSignup: handleSignup,
      user,
    }),
    [authLoading, isReady, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthProvider };
