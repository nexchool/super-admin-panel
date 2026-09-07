/**
 * The login-access card used to be read-only and said so at the bottom of
 * the card — a sentence that has been false since Phase 8 shipped the write
 * endpoints. These tests pin down that the card now actually drives them:
 * a switch calls the method endpoint with the right shape, a paid method
 * with no working channel is called out rather than left silent, and a
 * refusal from the server reaches the operator instead of being swallowed.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { AuthPolicyRule, TenantAuthPolicy, TenantIntegration } from "@/types";

// `vi.hoisted` runs before `vi.mock` factories are hoisted above the imports,
// so these are safe to close over below without a "used before initialized"
// error — unlike a plain `const` at module scope.
const mocks = vi.hoisted(() => ({
  policyData: undefined as TenantAuthPolicy | undefined,
  integrationsData: [] as TenantIntegration[],
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
    // mutation asking to turn that exact rule off.
    await userEvent.click(screen.getByRole("switch", { name: /email/i }));

    expect(mocks.setMethod).toHaveBeenCalledWith({
      methodKey: "email_password",
      subjectKind: "student",
      enabled: false,
      surface: "any",
    });
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
      screen.getByRole("switch", { name: /mobile number \+ otp/i })
    );

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(serverMessage));
  });
});
