import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../../core/errors/app-error";
import { assertDraftVoiceGuardPassed, evaluateDraftVoiceGuard } from "./draft-voice-guard";

test("evaluateDraftVoiceGuard fails repeated AI-style builder formulas", () => {
  const summary = evaluateDraftVoiceGuard(
    "Markets panic again. While Bitcoin debates, TRON builds unstoppable infrastructure. Real utility wins. Keep building. 继续建设！",
  );

  assert.equal(summary.status, "failed");
  assert.deepEqual(summary.issues.map((issue) => issue.code), [
    "formulaic_contrast",
    "generic_builder_slogan",
    "generic_utility_slogan",
    "generic_resilience_slogan",
    "bilingual_slogan",
  ]);
});

test("assertDraftVoiceGuardPassed allows concrete non-template posts", () => {
  const summary = assertDraftVoiceGuardPassed({
    topic: "Stablecoin settlement",
    content: "Stablecoin volume is not a vibes metric anymore. The useful question is which rails settle reliably when liquidity thins, not which ticker gets the loudest rotation.",
  });

  assert.equal(summary.status, "passed");
});

test("assertDraftVoiceGuardPassed throws a model-output error for failed voice checks", () => {
  assert.throws(() => {
    assertDraftVoiceGuardPassed({
      topic: "Generic crypto take",
      content: "While banks stall, TRON builds. Real utility wins. Keep building.",
    });
  }, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "MODEL_INVALID_OUTPUT");
    assert.match(error.message, /voice quality guard/);
    return true;
  });
});
