import type { z } from "zod";
import {
  type TargetCandidateSchema,
  UnitCostSchema,
} from "../../contracts/capabilities";
import type { Business, Creator } from "../../sim/schema";

export type TargetCandidate = z.infer<typeof TargetCandidateSchema>;

export function deterministicNumber(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export async function watchableDelay(input: object): Promise<void> {
  const milliseconds = 50 + (deterministicNumber(JSON.stringify(input)) % 101);
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export function unitCost(unit: "request" | "record", operatingCents: number) {
  return UnitCostSchema.parse({
    unit,
    operatingCents,
    commitCents: 0,
    projected: true,
  });
}

export function organizationTarget(business: Business): TargetCandidate {
  const primaryContact = business.contacts.find(() => true);
  return {
    kind: "organization",
    externalRef: business.id,
    name: business.name,
    payload: {
      address: business.address,
      locality: business.locality,
      categories: [business.category],
      websiteUrl: business.website.url,
      phone: primaryContact === undefined ? null : primaryContact.phone,
    },
  };
}

export function personTarget(creator: Creator): TargetCandidate {
  return {
    kind: "person",
    externalRef: creator.id,
    name: creator.name,
    payload: {
      platform: creator.platform,
      handle: creator.handle,
      followerCount: creator.followers,
      rateCardCommitCents: creator.rateCard.reel.amountPaise,
      profile: {
        audienceGeography: creator.audience.geography,
        audienceInterests: creator.audience.interests,
        contentCategories: creator.contentCategories,
        engagementRate: creator.engagementRate,
        viewToFollowerRatio: creator.viewToFollowerRatio,
        fakeFollowerEstimate: creator.fakeFollowerEstimate,
      },
      contentTags: creator.contentCategories,
      audienceGeographies: Object.keys(creator.audience.geography),
      audienceInterests: Object.keys(creator.audience.interests),
      engagementRate: creator.engagementRate,
      fakeFollowerEstimate: creator.fakeFollowerEstimate,
      brandSafetyFlags: creator.brandSafetyFlags,
      selection: null,
    },
  };
}

export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const startLatitude = radians(from.latitude);
  const endLatitude = radians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
