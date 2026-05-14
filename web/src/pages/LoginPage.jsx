import { useRef, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { AuthLayout } from "@/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { usePageTitle } from "@/lib/page-title";

const loginInitialState = {
  email: "",
  password: "",
};

function validateLogin(values) {
  const errors = {};

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  }

  return errors;
}

function LoginPage() {
  usePageTitle("Log in");

  const navigate = useNavigate();
  const { authLoading, onLogin } = useAuth();
  const [form, setForm] = useState(loginInitialState);
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateLogin(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const didLogin = await onLogin(form);

    if (didLogin) {
      navigate("/");
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function focusFirstMissingField() {
    if (!form.email.trim()) {
      emailRef.current?.focus();
      return;
    }

    if (!form.password) {
      passwordRef.current?.focus();
    }
  }

  function handleFieldEnter(event, nextRef) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    if (nextRef) {
      nextRef.current?.focus();
      return;
    }

    if (form.email.trim() && form.password) {
      formRef.current?.requestSubmit();
      return;
    }

    focusFirstMissingField();
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to continue to your notebooks."
      footer={
        <p className="text-sm text-muted-foreground">
          New here?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            to="/signup"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form ref={formRef} className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.email) || undefined}>
            <FieldLabel htmlFor="login-email">Email</FieldLabel>
            <FieldContent>
              <Input
                ref={emailRef}
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                onKeyDown={(event) => handleFieldEnter(event, passwordRef)}
                aria-invalid={Boolean(errors.email)}
                className="h-11"
              />
              <FieldError>{errors.email}</FieldError>
            </FieldContent>
          </Field>

          <Field data-invalid={Boolean(errors.password) || undefined}>
            <FieldLabel htmlFor="login-password">Password</FieldLabel>
            <FieldContent>
              <Input
                ref={passwordRef}
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
                onKeyDown={(event) => handleFieldEnter(event)}
                aria-invalid={Boolean(errors.password)}
                className="h-11"
              />
              <FieldError>{errors.password}</FieldError>
            </FieldContent>
          </Field>
        </FieldGroup>

        <Button
          type="submit"
          disabled={authLoading}
          className="h-11 w-full bg-gradient-primary text-base font-medium text-primary-foreground shadow-elegant hover:opacity-90"
        >
          {authLoading ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <LogIn data-icon="inline-start" />
          )}
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}

export { LoginPage };
