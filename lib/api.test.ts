import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiError, getErrorMessage } from "./api";

describe("getErrorMessage", () => {
  it("returns the message carried by an ApiError", () => {
    const error = new ApiError("Your session has expired. Please sign in again.", 401);
    expect(getErrorMessage(error)).toBe("Your session has expired. Please sign in again.");
  });

  it("returns the message of a plain Error", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("falls back to a generic message for a non-Error value", () => {
    expect(getErrorMessage("just a string")).toBe("Something went wrong");
    expect(getErrorMessage(null)).toBe("Something went wrong");
  });
});

// This is where the bug actually lives: `extractApiErrorMessage` (private to
// this module) is what decides which string an operator sees, and it is
// only reachable through `apiRequest`'s real HTTP-error path — mocking
// `useSetAuthMethod` at the hook level, as the component test used to,
// bypasses this parsing entirely and asserts the mock instead of the
// system. These envelopes are copied verbatim from
// `server/shared/helpers.py`'s `validation_error_response` /
// `error_response`, as actually produced by
// `server/modules/platform/routes.py` (`set_tenant_auth_method`, 400 — not
// 422, which is what the routes actually return).
describe("apiRequest error parsing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetchOnce(body: unknown, init: { status: number; statusText?: string }) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: init.status,
          statusText: init.statusText ?? "",
          headers: { "content-type": "application/json" },
        })
      )
    );
  }

  it("surfaces the field-level detail, not the generic top-level message", async () => {
    // `validation_error_response({"method_key": "..."})` from
    // set_tenant_auth_method's messaging-provider refusal.
    mockFetchOnce(
      {
        success: false,
        error: "ValidationError",
        message: "Validation failed",
        details: {
          method_key:
            "This method sends a message, and this school has no working sms provider. No sms provider is configured for this school.",
        },
      },
      { status: 400, statusText: "Bad Request" }
    );

    await expect(
      apiRequest("/api/platform/tenants/t1/auth-policy/methods", { method: "PATCH" })
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message:
        "This method sends a message, and this school has no working sms provider. No sms provider is configured for this school.",
    });
  });

  it("joins multiple field-level details when more than one field failed", async () => {
    mockFetchOnce(
      {
        success: false,
        error: "ValidationError",
        message: "Validation failed",
        details: {
          method_key: "Method is not valid.",
          subject_kind: "Subject kind is required.",
        },
      },
      { status: 400 }
    );

    await expect(apiRequest("/api/platform/tenants/t1/auth-policy/methods")).rejects.toMatchObject(
      { message: "Method is not valid. Subject kind is required." }
    );
  });

  it("falls back to the generic message when there are no details", async () => {
    // `error_response('NotFound', 'Tenant not found', 404)` — no `details`
    // key at all. The fallback must still work once details is preferred.
    mockFetchOnce(
      { success: false, error: "NotFound", message: "Tenant not found" },
      { status: 404 }
    );

    await expect(apiRequest("/api/platform/tenants/missing")).rejects.toMatchObject({
      status: 404,
      message: "Tenant not found",
    });
  });
});

describe("ApiError", () => {
  it("carries status and an optional response body", () => {
    const body = { error: "Not found" };
    const error = new ApiError("Not found", 404, body);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(404);
    expect(error.body).toBe(body);
  });
});
