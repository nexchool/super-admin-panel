/**
 * The login-access card used to be read-only and said so at the bottom of
 * the card — a sentence that has been false since Phase 8 shipped the write
 * endpoints. These tests pin down that the card now actually drives them:
 * a switch calls the method endpoint with the right shape, a paid method
 * with no working channel is called out rather than left silent, and a
 * refusal from the server reaches the operator instead of being swallowed.
 *
 * Task 13b adds a second source: `useAuthMethods` reports every sign-in
 * method the build can execute, independent of whether this school has a
 * policy rule for it. `ensure_default_policy` seeds a rule only for
 * `email_password`, and that table's semantics are "absence means denied" —
 * so before this task, `admission_id_password` and `mobile_pin` had no rule
 * on a fresh school and therefore no switch at all, and could never be
 * turned on from here. The card now merges the catalog with the rules; a
 * method with no rule gets a switch, defaulted off.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type {
  AuthMethodCatalogEntry,
  AuthPolicyRule,
  TenantAuthPolicy,
  TenantIntegration,
} from "@/types";

// `vi.hoisted` runs before `vi.mock` factories are hoisted above the imports,
// so these are safe to close over below without a "used before initialized"
// error — unlike a plain `const` at module scope.
const mocks = vi.hoisted(() => ({
  policyData: undefined as TenantAuthPolicy | undefined,
  integrationsData: [] as TenantIntegration[],
  authMethodsData: [] as AuthMethodCatalogEntry[],
  setMethod: vi.fn(),
  updatePolicy: vi.fn(),
}));

vi.mock("@/hooks/useApi", () => ({
  useTenantAuthPolicy: () => ({
    data: mocks.policyData,
    isLoading: false,
    error: null,
  }),
  useTenantIntegrations: () => ({ data: mocks.integrationsData, isLoading: false }),
  useAuthMethods: () => ({ data: mocks.authMethodsData, isLoading: false }),
  useSetAuthMethod: () => ({ mutateAsync: mocks.setMethod, isPending: false }),
  useUpdateAuthPolicy: () => ({ mutateAsync: mocks.updatePolicy, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function rule(overrides: Partial<AuthPolicyRule>): AuthPolicyRule {
  return {
    subjectKind: "student",
    surface: "any",
    methodKey: "email_password",
    isEnabled: true,
    enabledAt: null,
    notes: null,
    ...overrides,
  };
}

function policy(rules: AuthPolicyRule[]): TenantAuthPolicy {
  return {
    tenantId: "t1",
    familyAccessMode: "shared_with_student",
    studentCredentialPolicy: "force_change_on_first_login",
    otpDeliveryChannel: "sms",
    isConfigured: true,
    updatedAt: null,
    rules,
  };
}

function authMethod(overrides: Partial<AuthMethodCatalogEntry> = {}): AuthMethodCatalogEntry {
  return {
    key: "email_password",
    identifierType: "email",
    credentialType: "password",
    requiresTenant: false,
    isPaid: false,
    countsTowardAccountLockout: true,
    ...overrides,
  };
}

const CATALOG: AuthMethodCatalogEntry[] = [
  authMethod({ key: "email_password", identifierType: "email", requiresTenant: false }),
  authMethod({
    key: "admission_id_password",
    identifierType: "admission_id",
    requiresTenant: true,
  }),
  authMethod({
    key: "mobile_otp",
    identifierType: "mobile",
    credentialType: null,
    requiresTenant: true,
    isPaid: true,
    countsTowardAccountLockout: false,
  }),
  authMethod({
    key: "mobile_pin",
    identifierType: "mobile",
    credentialType: "pin",
    requiresTenant: true,
    countsTowardAccountLockout: false,
  }),
];

function readyIntegration(overrides: Partial<TenantIntegration> = {}): TenantIntegration {
  return {
    id: "integration-1",
    capability: "sms",
    providerKey: "twilio",
    status: "enabled",
    health: {
      ready: true,
      configured: true,
      credentialsPresent: true,
      providerSupported: true,
      providerReachable: null,
      detail: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.policyData = policy([
    rule({ methodKey: "email_password", isEnabled: true }),
    rule({ methodKey: "mobile_otp", isEnabled: false }),
  ]);
  mocks.integrationsData = [];
  mocks.authMethodsData = CATALOG;
  mocks.setMethod.mockResolvedValue(undefined);
  mocks.updatePolicy.mockResolvedValue(undefined);
});

describe("LoginAccessSection", () => {
  it("no longer claims the policy does not control sign-in", async () => {
    const { LoginAccessSection } = await import("./login-access-section");
    render(<LoginAccessSection tenantId="t1" />);

    expect(
      screen.queryByText(/does not yet control who may sign in/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^read-only\.?$/i)).not.toBeInTheDocument();
  });

  it("switches a method through the policy endpoint with the right key, subject and state", async () => {
    const { LoginAccessSection } = await import("./login-access-section");
    render(<LoginAccessSection tenantId="t1" />);

    // email_password starts enabled for students; flipping it calls the
    // mutation asking to turn that exact rule off. The catalog now offers
    // every method to every subject kind, so "Email + password" alone would
    // match three switches (one per column) — the name must pin down which.
    await userEvent.click(
      screen.getByRole("switch", { name: /email.*students/i })
    );

    expect(mocks.setMethod).toHaveBeenCalledWith({
      methodKey: "email_password",
      subjectKind: "student",
      enabled: false,
      surface: "any",
    });
  });

  it("shows a switch, off, for a method this school has no rule for, and switching it on calls the mutation", async () => {
    // Neither `admission_id_password` nor `mobile_pin` has a rule in
    // `mocks.policyData` — exactly the fresh-school state `ensure_default_policy`
    // leaves behind, which is the bug this task fixes: the catalog must still
    // offer them.
    const { LoginAccessSection } = await import("./login-access-section");
    render(<LoginAccessSection tenantId="t1" />);

    const toggle = screen.getByRole("switch", {
      name: /admission number \+ password.*students/i,
    });
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);

    expect(mocks.setMethod).toHaveBeenCalledWith({
      methodKey: "admission_id_password",
      subjectKind: "student",
      enabled: true,
      surface: "any",
    });
  });

  it("falls back to a readable label for a catalog method with no entry in METHOD_LABELS", async () => {
    mocks.authMethodsData = [...CATALOG, authMethod({ key: "employer_badge_scan" })];

    const { LoginAccessSection } = await import("./login-access-section");
    render(<LoginAccessSection tenantId="t1" />);

    expect(screen.getAllByText("employer badge scan").length).toBeGreaterThan(0);
  });

  it("warns when a paid method is enabled and its channel has no ready integration", async () => {
    mocks.policyData = policy([
      rule({ methodKey: "mobile_otp", isEnabled: true }),
    ]);
    mocks.integrationsData = []; // no sms integration at all

    const { LoginAccessSection } = await import("./login-access-section");
    render(<LoginAccessSection tenantId="t1" />);

    expect(screen.getByText(/no working sms provider/i)).toBeInTheDocument();
  });

  it("does not warn when the chosen channel already has a ready integration", async () => {
    mocks.policyData = policy([
      rule({ methodKey: "mobile_otp", isEnabled: true }),
    ]);
    mocks.integrationsData = [readyIntegration({ capability: "sms" })];

    const { LoginAccessSection } = await import("./login-access-section");
    render(<LoginAccessSection tenantId="t1" />);

    expect(screen.queryByText(/no working sms provider/i)).not.toBeInTheDocument();
  });

  it("surfaces a server refusal to the operator instead of swallowing it", async () => {
    const serverMessage =
      "This method sends a message, and this school has no working sms provider. No sms provider is configured for this school.";
    mocks.setMethod.mockRejectedValueOnce(new ApiError(serverMessage, 400));

    const { LoginAccessSection } = await import("./login-access-section");
    render(<LoginAccessSection tenantId="t1" />);

    await userEvent.click(
      screen.getByRole("switch", { name: /mobile number \+ otp.*students/i })
    );

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(serverMessage));
  });
});
