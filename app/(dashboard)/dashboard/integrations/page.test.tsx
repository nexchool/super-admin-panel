/**
 * The platform-wide integrations catalog answers "can we offer WhatsApp at
 * all yet?" without opening a school — it is read from the provider
 * registry, not from any tenant's configuration. These tests pin down the
 * three things that make that distinction hold on screen: every registered
 * provider actually shows up under its capability, a test double
 * (`is_test_double`) is visibly labelled as one so an operator does not
 * mistake it for a real option, and a credential is only ever named — never
 * valued, even if a future response shape smuggled a value in.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationCapability } from "@/types";

const mocks = vi.hoisted(() => ({
  data: undefined as IntegrationCapability[] | undefined,
  isLoading: false,
  error: null as unknown,
}));

vi.mock("@/hooks/useApi", () => ({
  useIntegrationCapabilities: () => ({
    data: mocks.data,
    isLoading: mocks.isLoading,
    error: mocks.error,
  }),
}));

function smsCapability(
  overrides: Partial<IntegrationCapability> = {}
): IntegrationCapability {
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
      {
        key: "fake_sms",
        name: "Fake SMS",
        supportsIdempotency: true,
        isBillable: false,
        isTestDouble: true,
        requiredCredentials: [],
      },
    ],
    ...overrides,
  };
}

function whatsappCapability(
  overrides: Partial<IntegrationCapability> = {}
): IntegrationCapability {
  return {
    capability: "whatsapp",
    label: "WhatsApp",
    providers: [
      {
        key: "meta_whatsapp",
        name: "Meta WhatsApp Cloud API",
        supportsIdempotency: true,
        isBillable: true,
        isTestDouble: false,
        requiredCredentials: ["META_WHATSAPP_ACCESS_TOKEN"],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.data = [smsCapability(), whatsappCapability()];
  mocks.isLoading = false;
  mocks.error = null;
});

describe("IntegrationsCatalogPage", () => {
  it("lists each capability with its registered providers", async () => {
    const { default: IntegrationsCatalogPage } = await import("./page");
    render(<IntegrationsCatalogPage />);

    expect(screen.getByText("SMS")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("MSG91")).toBeInTheDocument();
    expect(screen.getByText("Fake SMS")).toBeInTheDocument();
    expect(screen.getByText("Meta WhatsApp Cloud API")).toBeInTheDocument();
  });

  it("labels a test-double provider as a test double, and a real provider not", async () => {
    const { default: IntegrationsCatalogPage } = await import("./page");
    render(<IntegrationsCatalogPage />);

    expect(screen.getByText(/test double/i)).toBeInTheDocument();
    // MSG91 is a real vendor and must not pick up the same label.
    const msg91Row = screen.getByText("MSG91").closest("div");
    expect(msg91Row?.parentElement?.textContent ?? "").not.toMatch(/test double/i);
  });

  it("shows billing and idempotency support per provider", async () => {
    const { default: IntegrationsCatalogPage } = await import("./page");
    render(<IntegrationsCatalogPage />);

    // MSG91 and Meta WhatsApp are both billable; Fake SMS is free — so
    // "Billable" appears more than once.
    expect(screen.getAllByText("Billable").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getAllByText("Supports idempotency").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("No idempotency support")).toBeInTheDocument();
  });

  it("shows only credential names, never a value — even one smuggled onto the provider", async () => {
    // Simulate a future response shape that started attaching a value
    // somewhere on the provider object. The component must read nothing
    // but `requiredCredentials` (a list of names), so this must never reach
    // the screen no matter what else the API response carries.
    const poisoned = smsCapability();
    (poisoned.providers[0] as unknown as Record<string, unknown>).credentialValue =
      "sk_live_should_never_render";
    mocks.data = [poisoned];

    const { default: IntegrationsCatalogPage } = await import("./page");
    render(<IntegrationsCatalogPage />);

    expect(screen.getByText("MSG91_AUTH_KEY")).toBeInTheDocument();
    expect(screen.queryByText(/sk_live_should_never_render/)).not.toBeInTheDocument();
  });

  it("renders without crashing while the request is loading", async () => {
    mocks.data = undefined;
    mocks.isLoading = true;

    const { default: IntegrationsCatalogPage } = await import("./page");
    render(<IntegrationsCatalogPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders without crashing on an empty response", async () => {
    mocks.data = [];
    mocks.isLoading = false;

    const { default: IntegrationsCatalogPage } = await import("./page");
    render(<IntegrationsCatalogPage />);

    expect(screen.getByText(/no capabilities are registered/i)).toBeInTheDocument();
  });
});
