import { z } from "zod";

const GeoSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const ContactSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.email(),
  phone: z.string().regex(/^\+91 \d{5} \d{5}$/),
});

const ReviewSchema = z.object({
  id: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1),
  occurredAt: z.iso.datetime(),
});

const MoneySchema = z.object({
  amountPaise: z.number().int().nonnegative(),
  currency: z.literal("INR"),
});

const SplitSchema = z.record(z.string(), z.number().min(0).max(1));

export const BusinessSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  locality: z.string().min(1),
  address: z.string().min(1),
  geo: GeoSchema,
  rating: z.number().min(1).max(5),
  reviewCount: z.number().int().nonnegative(),
  reviews: z.array(ReviewSchema).min(6).max(10),
  website: z.object({
    url: z.url(),
    tier: z.enum(["bad", "mid", "good"]),
    html: z.string().min(1),
    capturedAt: z.iso.datetime(),
  }),
  contacts: z.array(ContactSchema).min(1).max(3),
});

export const CreatorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  bio: z.string().min(1),
  handle: z.string().min(1),
  platform: z.enum(["instagram", "youtube"]),
  followers: z.number().int().nonnegative(),
  engagementRate: z.number().min(0).max(1),
  viewToFollowerRatio: z.number().min(0),
  audience: z.object({
    geography: SplitSchema,
    age: SplitSchema,
    interests: SplitSchema,
  }),
  fakeFollowerEstimate: z.number().min(0).max(1),
  contentCategories: z.array(z.string().min(1)).min(1),
  brandSafetyFlags: z.array(z.string().min(1)),
  pastCollaborations: z.array(z.string().min(1)),
  rateCard: z.object({
    reel: MoneySchema,
    story: MoneySchema,
    staticPost: MoneySchema,
  }),
  reachability: z.object({
    dm: z.boolean(),
    email: z.email().nullable(),
    agency: z.string().min(1).nullable(),
  }),
  posts: z.array(
    z.object({
      id: z.string().min(1),
      caption: z.string().min(1),
      occurredAt: z.iso.datetime(),
    }),
  ),
});

export const SimWorldSchema = z.object({
  seed: z.number().int(),
  generatedAt: z.iso.datetime(),
  businesses: z.array(BusinessSchema).length(60),
  creators: z.array(CreatorSchema).length(24),
});

export type Business = z.infer<typeof BusinessSchema>;
export type Creator = z.infer<typeof CreatorSchema>;
export type SimWorld = z.infer<typeof SimWorldSchema>;
