import { useRef, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
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

const signupInitialState = {
  fullName: "",
  email: "",
  password: "",
};

function validateSignup(values) {
  const errors = {};

  if (!values.fullName.trim()) {
    errors.fullName = "Name is required.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Use at least 8 characters.";
  }

  return errors;
}

function SignupPage() {
  usePageTitle("Sign up");

  const navigate = useNavigate();
  const { authLoading, onSignup } = useAuth();
  const [form, setForm] = useState(signupInitialState);
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);
  const fullNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateSignup(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const didSignup = await onSignup(form);

    if (didSignup) {
      navigate("/");
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function focusFirstMissingField() {
    if (!form.fullName.trim()) {
      fullNameRef.current?.focus();
      return;
    }

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

    if (form.fullName.trim() && form.email.trim() && form.password) {
      formRef.current?.requestSubmit();
      return;
    }

    focusFirstMissingField();
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Start building your research workspace in seconds."
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            to="/login"
          >
            Log in
          </Link>
        </p>
      }
    >
      <form
        ref={formRef}
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <FieldGroup>
          <Field data-invalid={Boolean(errors.fullName) || undefined}>
            <FieldLabel htmlFor="signup-name">Full name</FieldLabel>
            <FieldContent>
              <Input
                ref={fullNameRef}
                id="signup-name"
                type="text"
                placeholder="Ada Lovelace"
                value={form.fullName}
                onChange={(event) =>
                  updateField("fullName", event.target.value)
                }
                onKeyDown={(event) => handleFieldEnter(event, emailRef)}
                aria-invalid={Boolean(errors.fullName)}
                className="h-11"
              />
              <FieldError>{errors.fullName}</FieldError>
            </FieldContent>
          </Field>

          <Field data-invalid={Boolean(errors.email) || undefined}>
            <FieldLabel htmlFor="signup-email">Email</FieldLabel>
            <FieldContent>
              <Input
                ref={emailRef}
                id="signup-email"
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
            <FieldLabel htmlFor="signup-password">Password</FieldLabel>
            <FieldContent>
              <Input
                ref={passwordRef}
                id="signup-password"
                type="password"
                placeholder="At least 8 characters"
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
            <UserPlus data-icon="inline-start" />
          )}
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

export { SignupPage };
