import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { navigationTarget } from "./page-path.ts";

describe("navigation target", () => {
  it("keeps the result query when the open page already ends with a slash", () => {
    assert.equal(navigationTarget("/prepare?imported=1&skipped=0&lyrics=0", "/prepare/"), "/prepare/?imported=1&skipped=0&lyrics=0");
    assert.equal(navigationTarget("/prepare?error=file&detail=x", "/prepare/"), "/prepare/?error=file&detail=x");
    assert.equal(navigationTarget("/prepare?imported=1#week", "/prepare/"), "/prepare/?imported=1#week");
  });

  it("leaves the path alone when the open page has no trailing slash", () => {
    assert.equal(navigationTarget("/prepare?imported=1", "/prepare"), "/prepare?imported=1");
    assert.equal(navigationTarget("/services/abc", "/services"), "/services/abc");
  });

  it("adds a slash from the site root, whose path is already a directory", () => {
    assert.equal(navigationTarget("/services/abc", "/"), "/services/abc/");
  });
});
