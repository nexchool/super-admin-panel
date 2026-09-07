/**
 * The Integrations section is where a platform operator points a school's
 * SMS/WhatsApp capability at a vendor. Two mistakes it exists to prevent:
 * pasting a secret's value into the credential field (which the server
 * refuses, but the point is to catch it before the round trip), and firing
 * a "test connection" that quietly sends a real, billable message. These
 * tests pin both down, plus the health report and the dev-only outbox card.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type {
  IntegrationCapability,
  TenantIntegration,
} from "@/types";

// `vi.hoisted` runs before `vi.mock` factories are hoisted above the
// imports, so these are safe to close over below — see
// `login-access-section.test.tsx` for the same shape.
const mocks = vi.hoisted(() => ({
  integrationsData: [] as TenantIntegration[],
  capabilitiesData: [] as IntegrationCapability[],
  outboxData: { available: false, messages: [] as unknown[] },
  configureIntegration: vi.fn(),
  setStatus: vi.fn(),
  testSend: vi.fn(),
}));

vi.mock("@/hooks/useApi", () => ({
  useTenantIntegrations: () => ({ data: mocks.integrationsData, isLoading: false }),
  useIntegrationCapabilities: () => ({ data: mocks.capabilitiesData }),
  useIntegrationOutbox: () => ({ data: mocks.outboxData, isLoading: false }),
  useConfigureIntegration: () => ({
    mutateAsync: mocks.configureIntegration,
    isPending: false,
  }),
  useSetIntegrationStatus: () => ({ mutateAsync: mocks.setStatus, isPending: false }),
  useTestSend: () => ({ mutateAsync: mocks.testSend, isPending: false }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function smsCapability(overrides: Partial<IntegrationCapability> = {}): IntegrationCapability {
  return {
    capability: "sms",
    label: "SMS",
    providers: [
      {
        key: "msg91",
        name: "MSG91",
        supportsIdempotency: false,
        isBillable: true,
        isTestDouble: false,
        requiredCredentials: ["MSG91_AUTH_KEY"],
      },
    ],
    ...overrides,
  };
}

function smsIntegration(overrides: Partial<TenantIntegration> = {}): TenantIntegration {
  return {
    id: "integration-1",
    capability: "sms",
    providerKey: "msg91",
    status: "enabled",
    configuration: { sender_id: "NEXSCH" },
    credentials: { MSG91_AUTH_KEY: { reference: "MSG91_AUTH_KEY", isSet: true } },
    health: {
      ready: true,
      configured: true,
      credentialsPresent: true,
      providerSupported: true,
      providerReachable: null,
      detail:
        "Configuration readiness only; MSG91 was not contacted. " +
        "Delivery was not verified — checking that would cost a message.",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.integrationsData = [];
  // Scoped to `sms` alone in most tests: `whatsapp` has no integration yet,
  // so its panel opens for configuration by default (see `IntegrationsSection`),
  // which would otherwise put a second "Save"/"Edit configuration" button on
  // screen and make `getByRole` ambiguous.
  mocks.capabilitiesData = [smsCapability()];
  mocks.outboxData = { available: false, messages: [] };
  mocks.configureIntegration.mockResolvedValue(undefined);
  mocks.setStatus.mockResolvedValue(undefined);
  mocks.testSend.mockResolvedValue({ sent: true, status: "accepted", errorMessage: null });
});

describe("IntegrationsSection", () => {
  it("renders a health report, including the case where delivery was never verified", async () => {
    mocks.integrationsData = [smsIntegration()];

    const { IntegrationsSection } = await import("./integrations-section");
    render(<IntegrationsSection tenantId="t1" />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText(/delivery was not verified/i)).toBeInTheDocument();
  });

  it("refuses a value-looking credential client-side, shows the reason, and never calls the mutation", async () => {
    mocks.integrationsData = [smsIntegration()];

    const { IntegrationsSection } = await import("./integrations-section");
    render(<IntegrationsSection tenantId="t1" />);

    await userEvent.click(screen.getByRole("button", { name: /edit configuration/i }));

    const credentialField = screen.getByLabelText(/environment variable name for msg91_auth_key/i);
    await userEvent.clear(credentialField);
    await userEvent.type(credentialField, "sk_live_abcdef123456");

    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(
      screen.getByText(/not the secret's value|must be an environment variable name/i)
    ).toBeInTheDocument();
    expect(mocks.configureIntegration).not.toHaveBeenCalled();
  });

  it("accepts a well-formed credential name and calls the mutation with it", async () => {
    mocks.integrationsData = [smsIntegration()];

    const { IntegrationsSection } = await import("./integrations-section");
    render(<IntegrationsSection tenantId="t1" />);

    await userEvent.click(screen.getByRole("button", { name: /edit configuration/i }));

    const credentialField = screen.getByLabelText(/environment variable name for msg91_auth_key/i);
    await userEvent.clear(credentialField);
    await userEvent.type(credentialField, "MSG91_AUTH_KEY");

    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(mocks.configureIntegration).toHaveBeenCalledWith(
        expect.objectContaining({
          capability: "sms",
          providerKey: "msg91",
          credentialReferences: { MSG91_AUTH_KEY: "MSG91_AUTH_KEY" },
        })
      )
    );
  });

  it("states the test-send control sends a real billable message and confirms before firing", async () => {
    mocks.integrationsData = [smsIntegration({ status: "enabled" })];

    const { IntegrationsSection } = await import("./integrations-section");
    render(<IntegrationsSection tenantId="t1" />);

    expect(screen.getByText(/real, billable/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /test connection/i })).not.toBeInTheDocument();

    const destinationInput = screen.getByPlaceholderText("+919876543210");
    await userEvent.type(destinationInput, "+919876543210");
    await userEvent.click(screen.getByRole("button", { name: /send test message/i }));

    // The mutation must not fire on the first click — only after the
    // operator explicitly confirms the follow-up warning.
    expect(mocks.testSend).not.toHaveBeenCalled();
    expect(screen.getByText(/this will send a real, billable message/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /yes, send it/i }));

    await waitFor(() =>
      expect(mocks.testSend).toHaveBeenCalledWith({
        capability: "sms",
        destination: "+919876543210",
      })
    );
  });

  it("disables the test-send control until the integration is enabled", async () => {
    mocks.integrationsData = [smsIntegration({ status: "disabled" })];

    const { IntegrationsSection } = await import("./integrations-section");
    render(<IntegrationsSection tenantId="t1" />);

    expect(screen.getByRole("button", { name: /send test message/i })).toBeDisabled();
  });

  it("omits the outbox card when the endpoint is unavailable", async () => {
    mocks.outboxData = { available: false, messages: [] };

    const { IntegrationsSection } = await import("./integrations-section");
    render(<IntegrationsSection tenantId="t1" />);

    expect(screen.queryByText(/outbox/i)).not.toBeInTheDocument();
  });

  it("renders the outbox card when the endpoint is available", async () => {
    mocks.outboxData = {
      available: true,
      messages: [
        {
          tenantId: "t1",
          channel: "sms",
          destination: "+919876543210",
          body: "This is a NexSchool test message. No action is needed.",
          purpose: "integration_test",
          sentAt: "2026-09-07T10:00:00Z",
        },
      ],
    };

    const { IntegrationsSection } = await import("./integrations-section");
    render(<IntegrationsSection tenantId="t1" />);

    expect(screen.getByText(/outbox/i)).toBeInTheDocument();
    expect(screen.getByText(/nexschool test message/i)).toBeInTheDocument();
  });

  it("shows the server's own refusal wording when saving a configuration is rejected", async () => {
    mocks.integrationsData = [smsIntegration()];
    const serverMessage =
      "'auth_key' must name an environment variable (uppercase letters, digits and underscores) — not a value.";
    mocks.configureIntegration.mockRejectedValueOnce(new ApiError(serverMessage, 400));

    const { IntegrationsSection } = await import("./integrations-section");
    render(<IntegrationsSection tenantId="t1" />);

    await userEvent.click(screen.getByRole("button", { name: /edit configuration/i }));
    const credentialField = screen.getByLabelText(/environment variable name for msg91_auth_key/i);
    await userEvent.clear(credentialField);
    await userEvent.type(credentialField, "MSG91_AUTH_KEY");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(serverMessage));
  });

  it("shows the server's own refusal wording when disabling is rejected", async () => {
    mocks.integrationsData = [smsIntegration({ status: "enabled" })];
    const serverMessage =
      "This school signs people in with mobile_otp, which needs sms. Turn the method off first.";
    mocks.setStatus.mockRejectedValueOnce(new ApiError(serverMessage, 400));

    const { IntegrationsSection } = await import("./integrations-section");
    render(<IntegrationsSection tenantId="t1" />);

    await userEvent.click(screen.getByRole("switch", { name: /enable sms/i }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(serverMessage));
  });
});
