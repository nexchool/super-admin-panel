"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Inbox, Plug, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useConfigureIntegration,
  useIntegrationCapabilities,
  useIntegrationOutbox,
  useSetIntegrationStatus,
  useTenantIntegrations,
  useTestSend,
} from "@/hooks/useApi";
import type {
  IntegrationCapability,
  IntegrationProvider,
  TenantIntegration,
} from "@/types";

/** What a credential reference has to look like, mirrored from the server's
 *  own rule (`server/modules/integrations/credentials.py`). Checked here so
 *  an operator who pastes an actual key is told immediately, in the same
 *  words the server would refuse it with — not after a round trip. */
const REFERENCE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

/** Non-secret settings per capability. Sender id and phone-number id are
 *  identifiers a provider's client reads off `configuration` (see
 *  `msg91.py` / `meta_whatsapp.py`) — never a place a secret belongs. */
const SETTINGS_FIELDS: Record<
  string,
  { key: string; label: string; placeholder: string }[]
> = {
  sms: [{ key: "sender_id", label: "Sender ID", placeholder: "e.g. NEXSCH" }],
  whatsapp: [
    {
      key: "phone_number_id",
      label: "Phone number ID",
      placeholder: "Meta phone number ID",
    },
    { key: "language", label: "Template language code", placeholder: "en" },
  ],
};

/** Purposes this build actually looks a template up for — `authentication_otp`
 *  (mobile OTP sign-in) and `integration_test` (the button below). An
 *  operator may still type a different purpose; these are suggestions, not
 *  the only valid values, since `templates.py` accepts any string key. */
const KNOWN_TEMPLATE_PURPOSES = [
  { value: "authentication_otp", label: "Sign-in code (OTP)" },
  { value: "integration_test", label: "Test message" },
];

type TemplateRow = { purpose: string; id: string; variables: string };

/** Reads whatever shape `templates.py` accepts a school's row as — a bare
 *  string (no named variables) or `{id, variables}` — into editable rows. */
function templateRowsFrom(configuration: Record<string, unknown> | undefined): TemplateRow[] {
  const templates = (configuration?.templates ?? {}) as Record<string, unknown>;
  return Object.entries(templates).map(([purpose, entry]) => {
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      const variables = Array.isArray(e.variables) ? e.variables.map(String) : [];
      return { purpose, id: String(e.id ?? ""), variables: variables.join(", ") };
    }
    return { purpose, id: String(entry ?? ""), variables: "" };
  });
}

/** Why a credential value can't be saved as-is, or `null` when it's fine.
 *  Exported shape kept plain (a string, not a boolean) because the whole
 *  point is that the operator sees the reason, not just a red border. */
function credentialReferenceError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Required — the name of an environment variable.";
  if (!REFERENCE_PATTERN.test(trimmed)) {
    return (
      "Must be an environment variable name: uppercase letters, digits and " +
      "underscores only, starting with a letter (e.g. MSG91_AUTH_KEY) — " +
      "not the secret's value."
    );
  }
  return null;
}

function statusVariant(status: string): "success" | "secondary" | "destructive" {
  if (status === "enabled") return "success";
  if (status === "failed") return "destructive";
  return "secondary";
}

/**
 * Where a platform operator points one school's messaging capabilities at a
 * vendor, configures per-vendor settings and templates, and — separately,
 * and only on purpose — sends one real message to prove it works.
 *
 * Two things this form exists to get right: a credential field only ever
 * takes the *name* of a server environment variable, never a secret's value
 * (refused client-side before the server has to); and the test-send control
 * never reads as a free "test connection" — it says plainly that it costs
 * money and rings a real phone, and asks before it does either.
 */
export function IntegrationsSection({ tenantId }: { tenantId: string }) {
  const { data: integrations, isLoading } = useTenantIntegrations(tenantId);
  const { data: capabilities } = useIntegrationCapabilities();
  const configureIntegration = useConfigureIntegration(tenantId);
  const setStatus = useSetIntegrationStatus(tenantId);
  const testSend = useTestSend(tenantId);

  const byCapability = new Map((integrations ?? []).map((i) => [i.capability, i]));
  const catalog: IntegrationCapability[] =
    capabilities ??
    // Before the catalog loads, at least the known messaging capabilities
    // render (with no providers to pick yet) rather than an empty card.
    [
      { capability: "sms", label: "SMS", providers: [] },
      { capability: "whatsapp", label: "WhatsApp", providers: [] },
    ];

  return (
    <Card id="integrations" className="mt-6 rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-4" />
          Integrations
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Which vendor carries this school&apos;s SMS and WhatsApp messages.
          Configuring a provider never turns it on by itself — enable it
          separately once its credentials check out below.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading integrations…</p>
        )}
        {!isLoading &&
          catalog.map((capability) => (
            <CapabilityPanel
              key={capability.capability}
              capability={capability}
              integration={byCapability.get(capability.capability)}
              configureIntegration={configureIntegration}
              setStatus={setStatus}
              testSend={testSend}
            />
          ))}
        <OutboxCard />
      </CardContent>
    </Card>
  );
}

type MutationLike<TInput> = {
  mutateAsync: (input: TInput) => Promise<unknown>;
  isPending: boolean;
};

function CapabilityPanel({
  capability,
  integration,
  configureIntegration,
  setStatus,
  testSend,
}: {
  capability: IntegrationCapability;
  integration: TenantIntegration | undefined;
  configureIntegration: MutationLike<{
    capability: string;
    providerKey: string;
    configuration: Record<string, unknown>;
    credentialReferences: Record<string, string>;
  }>;
  setStatus: MutationLike<{ capability: string; status: "enabled" | "disabled" }>;
  testSend: MutationLike<{ capability: string; destination: string }>;
}) {
  const [editing, setEditing] = useState(!integration);
  const [providerKey, setProviderKey] = useState(
    integration?.providerKey ?? capability.providers[0]?.key ?? ""
  );
  const settingsFields = SETTINGS_FIELDS[capability.capability] ?? [];
  const [settings, setSettings] = useState<Record<string, string>>(() => {
    const config = integration?.configuration ?? {};
    return Object.fromEntries(
      settingsFields.map((f) => [f.key, String(config[f.key] ?? "")])
    );
  });
  const [templateRows, setTemplateRows] = useState<TemplateRow[]>(() =>
    templateRowsFrom(integration?.configuration)
  );
  const provider = capability.providers.find((p) => p.key === providerKey);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (provider?.requiredCredentials ?? []).map((name) => [
        name,
        integration?.credentials?.[name]?.reference ?? name,
      ])
    )
  );
  const [credentialErrors, setCredentialErrors] = useState<Record<string, string>>({});

  // Reseed credential rows when the operator switches providers mid-edit —
  // a different vendor needs a different environment variable, and leaving
  // the old provider's field on screen would save a name that means nothing
  // to the newly selected client.
  useEffect(() => {
    setCredentialValues(
      Object.fromEntries(
        (provider?.requiredCredentials ?? []).map((name) => [
          name,
          integration?.credentials?.[name]?.reference ?? name,
        ])
      )
    );
    setCredentialErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerKey]);

  function addTemplateRow() {
    setTemplateRows((rows) => [...rows, { purpose: "", id: "", variables: "" }]);
  }

  function updateTemplateRow(index: number, patch: Partial<TemplateRow>) {
    setTemplateRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function removeTemplateRow(index: number) {
    setTemplateRows((rows) => rows.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const errors: Record<string, string> = {};
    for (const name of provider?.requiredCredentials ?? []) {
      const reason = credentialReferenceError(credentialValues[name] ?? "");
      if (reason) errors[name] = reason;
    }
    setCredentialErrors(errors);
    // The whole point of the client-side check: a value that looks pasted
    // rather than named never reaches the mutation, let alone the server.
    if (Object.keys(errors).length > 0 || !providerKey) return;

    const configuration: Record<string, unknown> = {};
    for (const field of settingsFields) {
      const value = settings[field.key]?.trim();
      if (value) configuration[field.key] = value;
    }
    const templates: Record<string, { id: string; variables: string[] }> = {};
    for (const row of templateRows) {
      const purpose = row.purpose.trim();
      const id = row.id.trim();
      if (!purpose || !id) continue;
      templates[purpose] = {
        id,
        variables: row.variables
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      };
    }
    if (Object.keys(templates).length > 0) configuration.templates = templates;

    const credentialReferences: Record<string, string> = {};
    for (const name of provider?.requiredCredentials ?? []) {
      credentialReferences[name] = credentialValues[name].trim();
    }

    try {
      await configureIntegration.mutateAsync({
        capability: capability.capability,
        providerKey,
        configuration,
        credentialReferences,
      });
      toast.success(
        `${capability.label} provider saved — disabled until you switch it on.`
      );
      setEditing(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleStatusChange(enabled: boolean) {
    try {
      await setStatus.mutateAsync({
        capability: capability.capability,
        status: enabled ? "enabled" : "disabled",
      });
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{capability.label}</p>
          {integration ? (
            <Badge variant={statusVariant(integration.status)}>{integration.status}</Badge>
          ) : (
            <Badge variant="outline">Not configured</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {integration && (
            <div className="flex items-center gap-2">
              <Switch
                checked={integration.status === "enabled"}
                disabled={setStatus.isPending}
                aria-label={`Enable ${capability.label}`}
                onCheckedChange={handleStatusChange}
              />
              <span className="text-xs text-muted-foreground">Enabled</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {integration ? "Edit configuration" : "Configure"}
          </Button>
        </div>
      </div>

      {integration && (
        <div className="mt-2 flex items-start gap-2 text-sm">
          {integration.health.ready ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          )}
          <div>
            <p>{integration.health.ready ? "Ready" : "Not ready"}</p>
            {integration.health.detail && (
              <p className="text-xs text-muted-foreground">{integration.health.detail}</p>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-4 space-y-4 border-t pt-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${capability.capability}-provider`}>Provider</Label>
            <Select value={providerKey} onValueChange={setProviderKey}>
              <SelectTrigger id={`${capability.capability}-provider`}>
                <SelectValue placeholder="Choose a provider" />
              </SelectTrigger>
              <SelectContent>
                {capability.providers.map((p: IntegrationProvider) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {settingsFields.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Settings</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {settingsFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`${capability.capability}-${field.key}`}>
                      {field.label}
                    </Label>
                    <Input
                      id={`${capability.capability}-${field.key}`}
                      placeholder={field.placeholder}
                      value={settings[field.key] ?? ""}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, [field.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Templates</p>
              <Button variant="outline" size="sm" onClick={addTemplateRow}>
                Add template
              </Button>
            </div>
            {templateRows.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No templates registered yet. Sign-in codes and the test message
                below both need one.
              </p>
            )}
            {templateRows.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Input
                  list={`${capability.capability}-known-purposes`}
                  placeholder="Purpose (e.g. authentication_otp)"
                  value={row.purpose}
                  onChange={(e) => updateTemplateRow(index, { purpose: e.target.value })}
                />
                <Input
                  placeholder="Vendor template id"
                  value={row.id}
                  onChange={(e) => updateTemplateRow(index, { id: e.target.value })}
                />
                <Input
                  placeholder="Variable names, comma-separated (optional)"
                  value={row.variables}
                  onChange={(e) => updateTemplateRow(index, { variables: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTemplateRow(index)}
                  aria-label={`Remove template row ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
            ))}
            <datalist id={`${capability.capability}-known-purposes`}>
              {KNOWN_TEMPLATE_PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </datalist>
          </div>

          {(provider?.requiredCredentials.length ?? 0) > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Credentials</p>
              <p className="text-xs text-muted-foreground">
                Name the environment variable on this server that holds each
                secret — never the secret itself. This field is refused if it
                looks like a value rather than a name.
              </p>
              {(provider?.requiredCredentials ?? []).map((name) => {
                const isSet = integration?.credentials?.[name]?.isSet;
                return (
                  <div key={name} className="space-y-1.5">
                    <Label htmlFor={`${capability.capability}-cred-${name}`}>
                      Environment variable name for {name}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`${capability.capability}-cred-${name}`}
                        value={credentialValues[name] ?? ""}
                        onChange={(e) =>
                          setCredentialValues((v) => ({ ...v, [name]: e.target.value }))
                        }
                        onBlur={() =>
                          setCredentialErrors((errs) => {
                            const reason = credentialReferenceError(
                              credentialValues[name] ?? ""
                            );
                            const next = { ...errs };
                            if (reason) next[name] = reason;
                            else delete next[name];
                            return next;
                          })
                        }
                      />
                      {isSet !== undefined && (
                        <span
                          className={
                            "whitespace-nowrap text-xs " +
                            (isSet ? "text-emerald-600" : "text-amber-600")
                          }
                        >
                          {isSet ? "Resolves on this server" : "Not set on this server"}
                        </span>
                      )}
                    </div>
                    {credentialErrors[name] && (
                      <p className="text-xs text-destructive">{credentialErrors[name]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            provider && (
              <p className="text-xs text-muted-foreground">
                {provider.name} needs no credentials on this server.
              </p>
            )
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={configureIntegration.isPending}>
              Save
            </Button>
          </div>
        </div>
      )}

      {integration && (
        <TestSendControl
          capability={capability.capability}
          label={capability.label}
          enabled={integration.status === "enabled"}
          testSend={testSend}
        />
      )}
    </div>
  );
}

function TestSendControl({
  capability,
  label,
  enabled,
  testSend,
}: {
  capability: string;
  label: string;
  enabled: boolean;
  testSend: MutationLike<{ capability: string; destination: string }>;
}) {
  const [destination, setDestination] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleClickSend() {
    if (!destination.trim()) {
      setValidationError("Enter a phone number to send the test message to.");
      return;
    }
    setValidationError(null);
    setConfirming(true);
  }

  async function handleConfirm() {
    setConfirming(false);
    try {
      const result = await testSend.mutateAsync({ capability, destination });
      if (result && typeof result === "object" && "sent" in result) {
        const r = result as { sent: boolean; errorMessage: string | null; status: string };
        if (r.sent) toast.success(`Test message sent to ${destination} (${r.status}).`);
        else toast.error(r.errorMessage || "The provider did not accept the test message.");
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  return (
    <div className="mt-4 space-y-2 border-t pt-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Send className="size-3.5" />
        Test send
      </p>
      <p className="text-xs text-muted-foreground">
        This sends a real, billable {label} message to the number below right
        now — it is not a connection check, and it will ring that phone.
        Limited to 5 sends per hour.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="+919876543210"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          disabled={!enabled}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleClickSend}
          disabled={!enabled || testSend.isPending}
        >
          Send test message
        </Button>
        {!enabled && (
          <span className="text-xs text-muted-foreground">
            Enable this integration first.
          </span>
        )}
      </div>
      {validationError && <p className="text-xs text-destructive">{validationError}</p>}
      {confirming && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p>
            This will send a real, billable message to <strong>{destination}</strong> right
            now. Are you sure?
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={handleConfirm} disabled={testSend.isPending}>
              Yes, send it
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Development-only: what a test-double provider pretended to send. Absent —
 *  not an error — the moment the endpoint reports unavailable, which is the
 *  ordinary answer in production (see `read_integration_outbox`'s 404). */
function OutboxCard() {
  const { data } = useIntegrationOutbox();
  if (!data?.available) return null;

  return (
    <Card className="rounded-lg border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Inbox className="size-4" />
          Outbox (development only)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No messages sent by a test provider yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.messages.map((m, index) => (
              <li key={index} className="rounded-md border p-2 text-sm">
                <p className="font-medium">
                  {m.channel} → {m.destination}
                </p>
                <p className="text-muted-foreground">{m.body}</p>
                <p className="text-xs text-muted-foreground">
                  {m.purpose} · {m.sentAt}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
