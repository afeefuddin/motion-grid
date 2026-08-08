import type { RubricCriterion } from "./types";

export const creatorRubric: readonly RubricCriterion[] = [
  {
    id: "audience_fit",
    description:
      "Audience geography and content categories match the campaign.",
    sources: ["profile"],
    weight: 0.35,
  },
  {
    id: "commercial_fit",
    description: "The rate card fits the motion commitment budget.",
    sources: ["profile"],
    weight: 0.35,
  },
  {
    id: "credible_reach",
    description: "Follower reach is sufficient for the requested outcome.",
    sources: ["profile"],
    weight: 0.3,
  },
];

export const localB2BRubric: readonly RubricCriterion[] = [
  {
    id: "booking_gap",
    description: "No reliable online booking path is visible.",
    sources: ["website", "reviews"],
    weight: 0.24,
  },
  {
    id: "stale_site",
    description:
      "The website has clearly stale content or an outdated copyright year.",
    sources: ["website"],
    weight: 0.16,
  },
  {
    id: "mobile_gap",
    description:
      "The website lacks a mobile viewport or usable mobile experience.",
    sources: ["website"],
    weight: 0.16,
  },
  {
    id: "unanswered_calls",
    description: "Reviews report repeated calls that were not answered.",
    sources: ["reviews"],
    weight: 0.18,
  },
  {
    id: "rating_trend",
    description:
      "Recent ratings deteriorate relative to the earlier review baseline.",
    sources: ["reviews"],
    weight: 0.12,
  },
  {
    id: "instagram_booking",
    description:
      "Customers report arranging bookings through Instagram direct messages.",
    sources: ["reviews"],
    weight: 0.14,
  },
];

export const onlineB2BRubric: readonly RubricCriterion[] = [
  {
    id: "digital_conversion_gap",
    description:
      "The site exposes a concrete conversion or customer-experience defect.",
    sources: ["website"],
    weight: 0.5,
  },
  {
    id: "buyer_pain",
    description:
      "Public customer evidence describes a problem the campaign can solve.",
    sources: ["reviews"],
    weight: 0.5,
  },
];

export const consumerAdsRubric: readonly RubricCriterion[] = [
  {
    id: "segment_relevance",
    description: "The audience criteria directly match the campaign objective.",
    sources: ["segment"],
    weight: 0.5,
  },
  {
    id: "addressable_scale",
    description:
      "The estimated segment is large enough for a meaningful media plan.",
    sources: ["segment"],
    weight: 0.5,
  },
];

export const consumerEmailRubric: readonly RubricCriterion[] = [
  {
    id: "consented_relationship",
    description:
      "The person is an existing customer with explicit email opt-in.",
    sources: ["customer_data"],
    weight: 0.6,
  },
  {
    id: "lifecycle_relevance",
    description:
      "Recent first-party behavior supports the proposed lifecycle message.",
    sources: ["customer_data"],
    weight: 0.4,
  },
];
