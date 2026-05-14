import { apiFetch } from "@/lib/api";

export async function fetchSession() {
  return apiFetch("/auth/me");
}

export async function login(values) {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export async function signup(values) {
  return apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify(values),
  });
}

export async function logout() {
  return apiFetch("/auth/logout", {
    method: "POST",
  });
}
