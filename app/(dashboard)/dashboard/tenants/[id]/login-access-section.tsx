"use client";

import { AlertTriangle, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/api";
import {
  useAuthMethods,
  useSetAuthMethod,
  useTenantAuthPolicy,
  useTenantIntegrations,
  useUpdateAuthPolicy,
} from "@/hooks/useApi";
import type { AuthMethodCatalogEntry, AuthPolicyRule } from "@/types";

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

const OTP_CHANNEL_LABELS: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
};

function methodLabel(key: string): string {
  return METHOD_LABELS[key] ?? key.replace(/_/g, " ");
}

function surfaceLabel(surface: string): string | null {
  return surface === "any" ? null : surface;
}

function channelLabel(channel: string): string {
  return OTP_CHANNEL_LABELS[channel] ?? channel;
}

/** One row the card renders: always the catalog's shape, with state read
 *  from a matching rule when one exists.
 *
 *  Nothing here declares which subject kinds a method applies to — the
 *  strategy registry this catalog comes from doesn't declare that either
 *  (see `modules/auth/strategies/base.py`), so every method is offered to
 *  every subject kind rather than guessing at a restriction nobody wrote
 *  down. */
function mergeMethodsForSubject(
  subjectKind: string,
  catalog: AuthMethodCatalogEntry[],
  rules: AuthPolicyRule[]
): AuthPolicyRule[] {
  return catalog.map((method) => {
    const existing = rules.find(
      (rule) => rule.subjectKind === subjectKind && rule.methodKey === method.key
    );
    return (
      existing ?? {
        subjectKind,
        surface: "any",
        methodKey: method.key,
        isEnabled: false,
        enabledAt: null,
        notes: null,
      }
    );
  });
}

/**
 * Which ways in this school allows — and, from this phase on, the controls
 * that change it. Switching a method on or off, or changing family access,
 * the student credential policy, or the OTP channel, now calls the platform
 * API directly; there is no longer a Python shell in the loop.
 */
export function LoginAccessSection({ tenantId }: { tenantId: string }) {
  const { data: policy, isLoading, error } = useTenantAuthPolicy(tenantId);
  const { data: integrations } = useTenantIntegrations(tenantId);
  const { data: authMethods } = useAuthMethods();
  const setMethod = useSetAuthMethod(tenantId);
  const updatePolicy = useUpdateAuthPolicy(tenantId);

  const rules = policy?.rules ?? [];
  const catalog = authMethods ?? [];
  const isPaidMethod = (methodKey: string): boolean =>
    catalog.find((method) => method.key === methodKey)?.isPaid ?? false;
  // Every method the build has, for this subject kind, whether or not a
  // rule exists yet — see `mergeMethodsForSubject` above.
  const rulesFor = (subjectKind: string): AuthPolicyRule[] =>
    mergeMethodsForSubject(subjectKind, catalog, rules);

  async function handleToggleMethod(rule: AuthPolicyRule, enabled: boolean) {
    try {
      await setMethod.mutateAsync({
        methodKey: rule.methodKey,
        subjectKind: rule.subjectKind,
        enabled,
        surface: rule.surface,
      });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleFamilyAccessChange(value: string) {
    try {
      await updatePolicy.mutateAsync({ familyAccessMode: value });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleCredentialPolicyChange(value: string) {
    try {
      await updatePolicy.mutateAsync({ studentCredentialPolicy: value });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleOtpChannelChange(value: string) {
    try {
      await updatePolicy.mutateAsync({ otpDeliveryChannel: value });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  const mobileOtpEnabledAnywhere = rules.some(
    (rule) => rule.methodKey === "mobile_otp" && rule.isEnabled
  );

  const paidMethodEnabled = rules.some(
    (rule) => isPaidMethod(rule.methodKey) && rule.isEnabled
  );
  const channel = policy?.otpDeliveryChannel || "sms";
  const channelIntegration = (integrations ?? []).find(
    (integration) => integration.capability === channel
  );
  const channelReady = Boolean(channelIntegration?.health.ready);
  const showReadinessWarning = paidMethodEnabled && !channelReady;

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

            {showReadinessWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  No working {channelLabel(channel)} provider is configured for
                  this school&apos;s chosen OTP channel. A method that sends a
                  message will fail silently until one is. Configure one in the{" "}
                  <a href="#integrations" className="underline underline-offset-2">
                    Integrations
                  </a>{" "}
                  section below.
                </p>
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-3">
              {SUBJECT_KINDS.map(({ key, label, hint }) => {
                const subjectRules = rulesFor(key);
                return (
                  <div key={key}>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
                    {subjectRules.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No sign-in method
                      </p>
                    ) : (
                      <ul className="space-y-2.5">
                        {subjectRules.map((rule) => (
                          <li
                            key={`${rule.subjectKind}-${rule.surface}-${rule.methodKey}`}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <Switch
                              checked={rule.isEnabled}
                              disabled={setMethod.isPending}
                              // The catalog now offers every method to every
                              // subject kind (see `mergeMethodsForSubject`),
                              // so the method name alone names three
                              // identical switches, one per column. The
                              // column label disambiguates them.
                              aria-label={`${methodLabel(rule.methodKey)} — ${label}`}
                              onCheckedChange={(checked) =>
                                handleToggleMethod(rule, checked)
                              }
                            />
                            <span className="text-sm">
                              {methodLabel(rule.methodKey)}
                            </span>
                            {surfaceLabel(rule.surface) && (
                              <span className="text-xs text-muted-foreground">
                                {surfaceLabel(rule.surface)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Family access</p>
                <Select
                  value={policy.familyAccessMode}
                  onValueChange={handleFamilyAccessChange}
                  disabled={updatePolicy.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FAMILY_ACCESS_LABELS).map(([value, text]) => (
                      <SelectItem key={value} value={value}>
                        {text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  School-issued student password
                </p>
                <Select
                  value={policy.studentCredentialPolicy}
                  onValueChange={handleCredentialPolicyChange}
                  disabled={updatePolicy.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CREDENTIAL_POLICY_LABELS).map(([value, text]) => (
                      <SelectItem key={value} value={value}>
                        {text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mobileOtpEnabledAnywhere && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    OTP delivery channel
                  </p>
                  <Select
                    value={policy.otpDeliveryChannel}
                    onValueChange={handleOtpChannelChange}
                    disabled={updatePolicy.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OTP_CHANNEL_LABELS).map(([value, text]) => (
                        <SelectItem key={value} value={value}>
                          {text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
