import test from "node:test";
import assert from "node:assert/strict";
import {
  assertXPostWithinLimit,
  getXPostLengthDiagnostics,
  MAX_X_POST_WEIGHTED_LENGTH,
  SHORTENED_X_URL_LENGTH,
  truncateXPostToLimit,
} from "./x-post-length";
import { AppError } from "../../../core/errors/app-error";

test("getXPostLengthDiagnostics counts ASCII against the 280-character X limit", () => {
  const withinLimit = getXPostLengthDiagnostics("A".repeat(280));
  const aboveLimit = getXPostLengthDiagnostics("A".repeat(281));

  assert.equal(withinLimit.weighted_length, MAX_X_POST_WEIGHTED_LENGTH);
  assert.equal(withinLimit.overflow_by, 0);
  assert.equal(aboveLimit.weighted_length, MAX_X_POST_WEIGHTED_LENGTH + 1);
  assert.equal(aboveLimit.overflow_by, 1);
});

test("getXPostLengthDiagnostics counts CJK characters with double weight", () => {
  const withinLimit = getXPostLengthDiagnostics("你".repeat(140));
  const aboveLimit = getXPostLengthDiagnostics("你".repeat(141));

  assert.equal(withinLimit.weighted_length, MAX_X_POST_WEIGHTED_LENGTH);
  assert.equal(aboveLimit.weighted_length, MAX_X_POST_WEIGHTED_LENGTH + 2);
});

test("getXPostLengthDiagnostics counts URLs as a fixed shortened length", () => {
  const diagnostics = getXPostLengthDiagnostics("Read https://example.com/a/very/long/path right now");

  assert.equal(diagnostics.url_count, 1);
  assert.equal(
    diagnostics.weighted_length,
    "Read ".length + SHORTENED_X_URL_LENGTH + " right now".length,
  );
});

test("getXPostLengthDiagnostics counts composed emoji as a single two-weight grapheme", () => {
  const diagnostics = getXPostLengthDiagnostics(`Launch now 👍🏽 ${"A".repeat(10)}`);

  assert.equal(diagnostics.weighted_length, "Launch now ".length + 2 + 1 + 10);
});

test("assertXPostWithinLimit throws a validation error with diagnostics when text is too long", () => {
  assert.throws(() => {
    assertXPostWithinLimit("A".repeat(281), {
      message: "draft content exceeds X weighted length limit and cannot be scheduled",
      details: { draft_id: "draft_1" },
    });
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.equal(error.message, "draft content exceeds X weighted length limit and cannot be scheduled");
    assert.equal(error.details?.draft_id, "draft_1");
    assert.equal(error.details?.weighted_length, 281);
    assert.equal(error.details?.max_weighted_length, 280);
    return true;
  });
});

test("truncateXPostToLimit shortens over-limit ASCII content and appends a suffix", () => {
  const result = truncateXPostToLimit("A".repeat(300));

  assert.equal(result.truncated, true);
  assert.equal(result.original_diagnostics.weighted_length, 300);
  assert.equal(result.diagnostics.weighted_length, 280);
  assert.equal(result.text.endsWith("..."), true);
});

test("truncateXPostToLimit preserves whole URLs while shortening", () => {
  const url = "https://example.com/a/very/long/path";
  const result = truncateXPostToLimit(`${"A".repeat(230)} ${url} ${"B".repeat(120)}`);

  assert.equal(result.truncated, true);
  assert.equal(result.text.includes(url), true);
  assert.equal(result.diagnostics.weighted_length <= MAX_X_POST_WEIGHTED_LENGTH, true);
});
