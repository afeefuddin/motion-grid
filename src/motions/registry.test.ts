import assert from "node:assert/strict";
import test from "node:test";
import { capabilityRegistry } from "../capabilities/registry";
import { motionIds } from "../contracts/enums";
import { declaredCapabilities, motionRegistry } from "./registry";

test("registers every frozen motion exactly once", () => {
  assert.deepEqual(Object.keys(motionRegistry), [...motionIds]);
  for (const [id, motion] of Object.entries(motionRegistry)) {
    assert.equal(motion.id, id);
    assert.ok(motion.rubric.length > 0);
  }
});

test("every motion capability exists in the frozen capability registry", () => {
  for (const capabilityId of declaredCapabilities()) {
    assert.ok(capabilityId in capabilityRegistry, capabilityId);
  }
});

test("local business motion is WhatsApp-first and grounded in observable defects", () => {
  const motion = motionRegistry["business.local"];
  assert.deepEqual(motion.channels, ["whatsapp", "email"]);
  assert.deepEqual(
    motion.rubric.map((criterion) => criterion.id),
    [
      "booking_gap",
      "stale_site",
      "mobile_gap",
      "unanswered_calls",
      "rating_trend",
      "instagram_booking",
    ],
  );
  assert.equal(
    motion.rubric.reduce((total, criterion) => total + criterion.weight, 0),
    1,
  );
});

test("online business motion collects both sources required by its rubric", () => {
  const motion = motionRegistry["business.online"];

  assert.deepEqual(motion.observation, ["web.fetch", "reviews.fetch"]);
  assert.deepEqual(
    motion.rubric.map((criterion) => criterion.sources),
    [["website"], ["reviews"]],
  );
});

test("triggered and no-contact motions stay declarative", () => {
  assert.equal(
    motionRegistry["consumer.email"].discoveryTrigger,
    "customer_base",
  );
  assert.deepEqual(motionRegistry["consumer.email"].discovery, []);
  assert.equal(motionRegistry["consumer.ads"].contactModel, "none");
});
