"use client";

import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantAuthPolicy } from "@/hooks/useApi";
import type { AuthPolicyRule } from "@/types";

/** The people a rule can be about, in the order a school thinks of them. */
const SUBJECT_KINDS: { key: string; label: string; hint: string }[] = [
  { key: "student", label: "Students", hint: "Children enrolled at the school" },
  { key: "staff", label: "Staff", hint: "Teachers, principals and administrators" },
  {
    key: "parent",
    label: "Parents",
    hint: "Only when the school issues separate parent logins",
  },
];

/** Method keys read as sentences, not identifiers. */
const METHOD_LABELS: Record<string, string> = {
  email_password: "Email + password",
  admission_id_password: "Admission number + password",
  employee_code_password: "Employee code + password",
  mobile_otp: "Mobile number + OTP",
  mobile_pin: "Mobile number + PIN",
};

const FAMILY_ACCESS_LABELS: Record<string, string> = {
  shared_with_student: "Shared with student",
  separate_parent_login: "Separate parent login",
};

const CREDENTIAL_POLICY_LABELS: Record<string, string> = {
  force_change_on_first_login: "Must be changed on first sign-in",
  no_forced_change: "May be kept as issued",
};

function methodLabel(key: string): string {
  return METHOD_LABELS[key] ?? key.replace(/_/g, " ");
}

function surfaceLabel(surface: string): string | null {
  return surface === "any" ? null : surface;
}

/**
 * Which ways in this school allows.
 *
 * Read-only, deliberately. The policy is configuration that nothing consults
 * yet, and an operator who could switch a method off here before the
 * authentication pipeline reads it would be setting a trap for themselves.
 * Editing arrives with the phase that gives the policy authority.
 */
export function LoginAccessSection({ tenantId }: { tenantId: string }) {
  const { data: policy, isLoading, error } = useTenantAuthPolicy(tenantId);

  const rulesFor = (subjectKind: string): AuthPolicyRule[] =>
    (policy?.rules ?? []).filter((rule) => rule.subjectKind === subjectKind);

  return (
    <Card className="mt-6 rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" />
          Login &amp; access
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading policy…</p>
        )}

        {error && (
          <p className="text-sm text-destructive">
            Could not load this school&apos;s login policy.
          </p>
        )}

        {policy && (
          <div className="space-y-6">
            {!policy.isConfigured && (
              <p className="text-sm text-muted-foreground">
                This school has no policy of its own yet; the platform defaults
                below apply.
              </p>
            )}

            <div className="grid gap-6 sm:grid-cols-3">
              {SUBJECT_KINDS.map(({ key, label, hint }) => {
                const rules = rulesFor(key);
                return (
                  <div key={key}>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
                    {rules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No sign-in method
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {rules.map((rule) => (
                          <li
                            key={`${rule.subjectKind}-${rule.surface}-${rule.methodKey}`}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span className="text-sm">
                              {methodLabel(rule.methodKey)}
                            </span>
                            {surfaceLabel(rule.surface) && (
                              <span className="text-xs text-muted-foreground">
                                {surfaceLabel(rule.surface)}
                              </span>
                            )}
                            <Badge
                              variant={rule.isEnabled ? "default" : "secondary"}
                            >
                              {rule.isEnabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Family access</p>
                <p className="text-sm">
                  {FAMILY_ACCESS_LABELS[policy.familyAccessMode] ??
                    policy.familyAccessMode}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  School-issued student password
                </p>
                <p className="text-sm">
                  {CREDENTIAL_POLICY_LABELS[policy.studentCredentialPolicy] ??
                    policy.studentCredentialPolicy}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Read-only. Sign-in still uses email and password for everyone;
              this policy is recorded for the authentication work in progress
              and does not yet control who may sign in.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
