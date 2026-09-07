import { describe, expect, it } from "vitest";
import { ApiError, getErrorMessage } from "./api";

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
