import assert from "node:assert/strict";
import {
  DbQueryOutputSchema,
  DbQueryUnitCostSchema,
  GeoQueryOutputSchema,
  GeoQueryUnitCostSchema,
  PeopleFindOutputSchema,
  PeopleFindUnitCostSchema,
  ReviewsFetchOutputSchema,
  ReviewsFetchUnitCostSchema,
  SegmentBuildOutputSchema,
  SegmentBuildUnitCostSchema,
  WebFetchOutputSchema,
  WebFetchUnitCostSchema,
} from "../../contracts/capabilities";
import { formatInr } from "../../sim/format-inr";
import { simWorld } from "../../sim/world";
import {
  cohortSegmentSimAdapter,
  indexDbSimAdapter,
  marketGeoSimAdapter,
  marketPeopleSimAdapter,
  marketReviewsSimAdapter,
  marketWebSimAdapter,
} from "./index";

async function run(): Promise<void> {
  assert.equal(simWorld.businesses.length, 60);
  assert.equal(simWorld.creators.length, 24);
  assert.equal(
    simWorld.businesses.filter((business) => business.website.tier === "bad")
      .length,
    24,
  );
  assert.equal(
    simWorld.businesses.filter((business) => business.website.tier === "mid")
      .length,
    12,
  );
  assert.equal(
    simWorld.businesses.filter((business) => business.website.tier === "good")
      .length,
    24,
  );
  assert.equal(JSON.stringify(simWorld).includes('"signal"'), false);
  assert.equal(formatInr(15_000_000), "₹1,50,000");

  GeoQueryUnitCostSchema.parse(marketGeoSimAdapter.unitCost);
  DbQueryUnitCostSchema.parse(indexDbSimAdapter.unitCost);
  WebFetchUnitCostSchema.parse(marketWebSimAdapter.unitCost);
  ReviewsFetchUnitCostSchema.parse(marketReviewsSimAdapter.unitCost);
  PeopleFindUnitCostSchema.parse(marketPeopleSimAdapter.unitCost);
  SegmentBuildUnitCostSchema.parse(cohortSegmentSimAdapter.unitCost);

  const [geo, creators, companies, website, reviews, people, segment] =
    await Promise.all([
      marketGeoSimAdapter.execute({
        query: "salons & spas",
        latitude: 12.9716,
        longitude: 77.5946,
        radiusKm: 30,
        limit: 10,
      }),
      indexDbSimAdapter.execute({
        entityKind: "creator",
        filters: { category: "beauty", minimumFollowers: 5_000 },
        limit: 10,
      }),
      indexDbSimAdapter.execute({
        entityKind: "company",
        filters: { category: "dental", locality: "HSR" },
        limit: 10,
      }),
      marketWebSimAdapter.execute({
        externalRef: "business-01",
        url: "https://aarohi-salon-spa.example/",
      }),
      marketReviewsSimAdapter.execute({ externalRef: "business-01", limit: 6 }),
      marketPeopleSimAdapter.execute({
        externalRef: "business-01",
        channels: ["email", "whatsapp"],
      }),
      cohortSegmentSimAdapter.execute({
        name: "Bengaluru wellness explorers",
        description:
          "Adults interested in local wellness and self-care experiences.",
        geography: "Bengaluru",
        criteria: { age: "25-44", interests: ["wellness", "beauty"] },
      }),
    ]);

  GeoQueryOutputSchema.parse(geo);
  DbQueryOutputSchema.parse(creators);
  DbQueryOutputSchema.parse(companies);
  WebFetchOutputSchema.parse(website);
  ReviewsFetchOutputSchema.parse(reviews);
  PeopleFindOutputSchema.parse(people);
  SegmentBuildOutputSchema.parse(segment);

  assert.ok(geo.targets.length > 0);
  assert.ok(creators.targets.length > 0);
  assert.ok(companies.targets.length > 0);
  assert.match(website.content, /width:2000px/);
  assert.ok(people.people.length > 0);
  assert.ok(segment.payload.estimatedSize > 0);
  assert.deepEqual(
    reviews.reviews.map((review) => review.rating),
    reviews.reviews
      .map((review) => review.rating)
      .sort((left, right) => left - right),
  );
}

void run();
