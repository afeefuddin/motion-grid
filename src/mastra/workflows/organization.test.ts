import assert from "node:assert/strict";
import test from "node:test";
import { CampaignSpecSchema } from "../../contracts";
import { organizationDiscoveryQuery } from "./organization";

const campaignSpec = {
  name: "Bengaluru salon pipeline",
  goal: "Find Bengaluru salons without online booking.",
  geography: "Bengaluru",
  motions: ["business.local"],
  targetCriteria: ["salon", "no online booking"],
  budget: {
    operating: { currency: "USD", amountMinor: 100 },
    commit: { currency: "INR", amountMinor: 0 },
  },
  channels: ["whatsapp"],
  successMetric: "Qualified meetings",
};

test("organization discovery prefers its compiled category query and supports legacy specs", () => {
  const explicit = CampaignSpecSchema.parse({
    ...campaignSpec,
    discoveryQuery: "salon & spa",
  });
  const legacy = CampaignSpecSchema.parse(campaignSpec);

  assert.equal(organizationDiscoveryQuery(explicit), "salon & spa");
  assert.equal(organizationDiscoveryQuery(legacy), "salon");
});
