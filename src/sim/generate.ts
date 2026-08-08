import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { faker } from "@faker-js/faker";
import { type Business, type Creator, SimWorldSchema } from "./schema";

const SEED = 20_260_808;
const GENERATED_AT = "2026-08-08T00:00:00.000Z";

const localities = [
  { name: "Indiranagar", latitude: 12.9784, longitude: 77.6408 },
  { name: "Koramangala", latitude: 12.9352, longitude: 77.6245 },
  { name: "HSR Layout", latitude: 12.9116, longitude: 77.6389 },
  { name: "Jayanagar", latitude: 12.925, longitude: 77.5938 },
  { name: "Whitefield", latitude: 12.9698, longitude: 77.75 },
  { name: "JP Nagar", latitude: 12.9063, longitude: 77.5857 },
];

const categoryBusinesses = [
  {
    category: "salon & spa",
    names: [
      "Aarohi Salon & Spa",
      "Namma Glow Studio",
      "Kaveri Hair Atelier",
      "Saundarya Family Salon",
      "Mogra Beauty Room",
      "Tattva Cuts & Colour",
      "Anika Skin & Hair Lounge",
      "The Champi House",
      "Rangoli Salon Studio",
      "Sukoon Day Spa",
    ],
  },
  {
    category: "skin & derma clinic",
    names: [
      "Tvacha Skin Clinic",
      "Drishti Derma Care",
      "Nirmal Skin Studio",
      "Ananya Aesthetics Clinic",
      "Aarogya Dermatology",
      "Kaya Kalp Skin Centre",
      "Sparsh Derma Clinic",
      "Prakriti Skin Lab",
      "Veda Aesthetics",
      "Clear Canvas Dermatology",
    ],
  },
  {
    category: "dental clinic",
    names: [
      "Hamsa Dental Care",
      "Namma Smiles Clinic",
      "Pearl Bengaluru Dental",
      "Danta Mitra Clinic",
      "Sanjeevini Dental Studio",
      "White Arc Dental Care",
      "Jeevan Dental Lounge",
      "Orchid Smiles",
      "Aster Tooth Care",
      "Vismaya Dental Clinic",
    ],
  },
  {
    category: "boutique gym & yoga studio",
    names: [
      "Akhada 27 Fitness",
      "Namma Flow Yoga",
      "Prana Courtyard",
      "Oorja Movement Studio",
      "Breathe Bengaluru",
      "Aarambh Strength Lab",
      "Yogavriksha Studio",
      "Kinetic Adda",
      "Sattva Pilates House",
      "Mudra & Muscle",
    ],
  },
  {
    category: "pet clinic",
    names: [
      "Mane Pet Clinic",
      "Pawna Veterinary Care",
      "Namma Paws Hospital",
      "Karuna Pet Clinic",
      "Cauvery Vet Care",
      "Happy Tails Bengaluru",
      "Jeeva Pet Wellness",
      "Bark & Purr Clinic",
      "Anu's Pet Practice",
      "Companion Care Vet",
    ],
  },
  {
    category: "speciality café",
    names: [
      "Kaapi Katte Roasters",
      "Malgudi Bean Room",
      "Filter Stories Café",
      "Namma Brew Lab",
      "Monsoon Coffee House",
      "Bili Hu Coffee Works",
      "Third Wave Adda",
      "Cubbon Roast Room",
      "Bengaluru Beanery",
      "Halli Coffee Project",
    ],
  },
];

const contactNames = [
  "Aditi Rao",
  "Ananya Iyer",
  "Arjun Shetty",
  "Deepa Nair",
  "Harish Gowda",
  "Kavya Hegde",
  "Meera Krishnan",
  "Nikhil Kulkarni",
  "Pooja Reddy",
  "Pranav Bhat",
  "Rahul Menon",
  "Rashmi Acharya",
  "Rohan Kamath",
  "Sanjana Murthy",
  "Shruti Pai",
  "Siddharth Rao",
  "Sneha Patil",
  "Varun Kumar",
];

const praise = [
  "Very warm team and the service was handled with proper attention. Will visit again.",
  "Clean place, polite staff and no unnecessary upselling. Good experience overall.",
  "Really liked the personal attention here. They explained everything patiently.",
  "One of the better neighbourhood places in Bengaluru. Neat setup and friendly people.",
  "Value for money and the staff remembered my preferences from the last visit.",
];

const websiteComplaints = [
  "Booked on their site, but when I reached they had no record of it. Staff asked me to WhatsApp the screenshot.",
  "No online booking at all, had to DM on Instagram and wait till next morning for confirmation.",
  "Called 4 times on the listed number, no response. Finally got a slot only after messaging on WhatsApp.",
  "Website timing is wrong. Google says open till 8, but shutters were down at 7 when I reached.",
  "The website looks old on mobile and the contact number is inside an image, so I could not tap to call.",
  "Clicked book appointment and it opened an email draft. Please add a proper slot booking option yaar.",
];

const operationalComplaints = [
  "Good service, but had to wait almost 35 minutes despite having an appointment.",
  "Instagram response was quick, though the confirmed time changed twice on the same day.",
  "The work was good but parking instructions should be shared before the appointment.",
  "Staff is nice, but the reception was crowded and billing took longer than expected.",
];

const creatorNames = [
  "Aishwarya Prabhu",
  "Akshaya Rao",
  "Amulya Gowda",
  "Anjali Nair",
  "Anusha Hegde",
  "Bhavana Reddy",
  "Chaitra Shetty",
  "Deepthi Pai",
  "Divya Menon",
  "Harini Bhat",
  "Ishita Krishnan",
  "Kavya Murthy",
  "Keerthana Kamath",
  "Meghana Iyer",
  "Nandini Kulkarni",
  "Neha Acharya",
  "Pallavi Rao",
  "Rhea Patil",
  "Ritika Kumar",
  "Sahana Prasad",
  "Shreya Nair",
  "Tanvi Reddy",
  "Vaishnavi Gowda",
  "Varsha Shetty",
];

const creatorBios = [
  "Bengaluru beauty creator sharing practical skincare, salon finds and honest wear tests.",
  "Yoga teacher and slow-living storyteller exploring movement, food and mindful city life.",
  "Your neighbourhood guide to cafés, self-care and small homegrown brands in Bengaluru.",
  "Dermatology-aware beauty reviews, ingredient explainers and realistic routines for Indian skin.",
  "Fitness, fashion and weekend discoveries from a Bengaluru girl who reads every label.",
  "Pet parent documenting vet care, dog-friendly spaces and everyday life with an indie pup.",
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function phoneNumber(): string {
  return `+91 ${faker.string.numeric(5)} ${faker.string.numeric(5)}`;
}

function dateFor(businessIndex: number, reviewIndex: number): string {
  const dayOffset = businessIndex * 7 + reviewIndex * 19;
  return new Date(
    Date.UTC(2025, dayOffset % 12, (dayOffset % 27) + 1, 8, 30),
  ).toISOString();
}

function websiteHtml(
  businessName: string,
  tier: "bad" | "mid" | "good",
): string {
  if (tier === "bad") {
    return `<!doctype html><html><head><title>${businessName}</title></head><body style="margin:0;width:2000px"><img src="/assets/hero.jpg" alt="${businessName}" style="width:2000px;height:900px"><h1>${businessName}</h1><p>Premium care in Bengaluru.</p><img src="/assets/contact-number.png" alt="Contact number"><footer>© 2019 ${businessName}</footer></body></html>`;
  }

  if (tier === "mid") {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${businessName}</title></head><body><main><h1>${businessName}</h1><p>Thoughtful local care, now in your neighbourhood.</p><a href="mailto:appointments@${slug(businessName)}.example?subject=Booking request">Book an appointment</a></main><footer>© 2022 ${businessName}</footer></body></html>`;
  }

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${businessName}</title><style>body{max-width:72rem;margin:auto;padding:1rem;font-family:system-ui}img{max-width:100%;height:auto}</style></head><body><main><h1>${businessName}</h1><p>Thoughtful local care, now in your neighbourhood.</p><a data-booking-widget="calendly" href="https://calendly.com/${slug(businessName)}/appointment">Choose a live slot</a></main><footer>© 2026 ${businessName}</footer></body></html>`;
}

function buildBusinesses(): Business[] {
  return categoryBusinesses.flatMap((definition, categoryIndex) =>
    definition.names.map((name, nameIndex) => {
      const index = categoryIndex * 10 + nameIndex;
      const locality = faker.helpers.arrayElement(
        localities.filter(
          (_, localityIndex) => localityIndex === index % localities.length,
        ),
      );
      const tier = index < 24 ? "bad" : index < 36 ? "mid" : "good";
      const reviewTotal = 6 + (index % 5);
      const reviews = Array.from({ length: reviewTotal }, (_, reviewIndex) => {
        const complaint =
          tier === "good"
            ? faker.helpers.arrayElement(operationalComplaints)
            : faker.helpers.arrayElement(websiteComplaints);
        const text =
          reviewIndex < 2 || reviewIndex % 4 === 0
            ? complaint
            : faker.helpers.arrayElement(praise);
        const rating =
          text === complaint ? 2 + (reviewIndex % 2) : 4 + (reviewIndex % 2);
        return {
          id: `review-${String(index + 1).padStart(2, "0")}-${reviewIndex + 1}`,
          rating,
          text,
          occurredAt: dateFor(index, reviewIndex),
        };
      });
      const contactTotal = 1 + (index % 3);
      const contacts = Array.from(
        { length: contactTotal },
        (_, contactIndex) => {
          const contactName = faker.helpers.arrayElement(contactNames);
          return {
            name: contactName,
            role:
              contactIndex === 0
                ? "Owner"
                : contactIndex === 1
                  ? "Studio Manager"
                  : "Front Desk",
            email: `${slug(contactName)}@${slug(name)}.example`,
            phone: phoneNumber(),
          };
        },
      );
      const id = `business-${String(index + 1).padStart(2, "0")}`;
      return {
        id,
        name,
        category: definition.category,
        locality: locality.name,
        address: `${18 + index}, ${faker.location.street()}, ${locality.name}, Bengaluru, Karnataka 560${String(10 + (index % 90)).padStart(3, "0")}`,
        geo: {
          latitude:
            locality.latitude +
            faker.number.float({ min: -0.012, max: 0.012, fractionDigits: 5 }),
          longitude:
            locality.longitude +
            faker.number.float({ min: -0.012, max: 0.012, fractionDigits: 5 }),
        },
        rating: faker.number.float({ min: 3.5, max: 4.8, fractionDigits: 1 }),
        reviewCount: faker.number.int({ min: 28, max: 860 }),
        reviews,
        website: {
          url: `https://${slug(name)}.example/`,
          tier,
          html: websiteHtml(name, tier),
          capturedAt: GENERATED_AT,
        },
        contacts,
      };
    }),
  );
}

function creatorFollowers(index: number): number {
  if (index < 8) {
    return faker.number.int({ min: 6_000, max: 19_000 });
  }
  if (index < 18) {
    return faker.number.int({ min: 22_000, max: 95_000 });
  }
  return faker.number.int({ min: 120_000, max: 410_000 });
}

function reelRatePaise(index: number): number {
  if (index < 8) {
    return faker.number.int({ min: 30, max: 80 }) * 10_000;
  }
  if (index < 18) {
    return faker.number.int({ min: 150, max: 400 }) * 10_000;
  }
  return faker.number.int({ min: 600, max: 1_500 }) * 10_000;
}

function plantedCaption(index: number): string | undefined {
  if (index === 2) {
    return "Fresh layers and the nicest head massage at Aarohi Salon & Spa. A proper Indiranagar reset ✨ #BengaluruBeauty";
  }
  if (index === 11) {
    return "My sensitive-skin consult at Tvacha Skin Clinic was detailed and never rushed. Sharing the full routine soon.";
  }
  if (index === 19) {
    return "Sunday mobility session at Prana Courtyard followed by filter coffee — my ideal Bengaluru morning.";
  }
  return undefined;
}

function buildCreators(): Creator[] {
  return creatorNames.map((name, index) => {
    const followers = creatorFollowers(index);
    const reel = reelRatePaise(index);
    const platform = index % 4 === 0 ? "youtube" : "instagram";
    const handle = `@${slug(name).replaceAll("-", "")}${index % 3 === 0 ? "blr" : ""}`;
    const caption = plantedCaption(index);
    return {
      id: `creator-${String(index + 1).padStart(2, "0")}`,
      name,
      bio: faker.helpers.arrayElement(creatorBios),
      handle,
      platform,
      followers,
      engagementRate: faker.number.float({
        min: 0.018,
        max: 0.082,
        fractionDigits: 3,
      }),
      viewToFollowerRatio: faker.number.float({
        min: 0.18,
        max: 1.24,
        fractionDigits: 2,
      }),
      audience: {
        geography: {
          Bengaluru: 0.48,
          "Tier-1 India": 0.34,
          "Rest of India": 0.18,
        },
        age: { "18-24": 0.31, "25-34": 0.46, "35-44": 0.17, "45+": 0.06 },
        interests: {
          beauty: 0.31,
          wellness: 0.27,
          lifestyle: 0.24,
          food: 0.18,
        },
      },
      fakeFollowerEstimate: faker.number.float({
        min: 0.02,
        max: 0.19,
        fractionDigits: 3,
      }),
      contentCategories: faker.helpers.arrayElements(
        ["beauty", "wellness", "lifestyle", "fitness", "cafés", "pet care"],
        3,
      ),
      brandSafetyFlags:
        index === 7 ? ["occasional unverified supplement claims"] : [],
      pastCollaborations: faker.helpers.arrayElements(
        [
          "Plum",
          "Minimalist",
          "Cult.fit",
          "Third Wave Coffee",
          "Heads Up For Tails",
          "Foxtale",
        ],
        2,
      ),
      rateCard: {
        reel: { amountPaise: reel, currency: "INR" },
        story: {
          amountPaise: Math.round((reel * 0.3) / 100) * 100,
          currency: "INR",
        },
        staticPost: {
          amountPaise: Math.round((reel * 0.65) / 100) * 100,
          currency: "INR",
        },
      },
      reachability: {
        dm: index % 6 !== 0,
        email: index % 5 === 0 ? null : `${slug(name)}@creator.example`,
        agency: index >= 18 ? "South Social Collective" : null,
      },
      posts: caption
        ? [
            {
              id: `post-${String(index + 1).padStart(2, "0")}-1`,
              caption,
              occurredAt: "2026-07-18T12:00:00.000Z",
            },
          ]
        : [],
    };
  });
}

async function generate(): Promise<void> {
  faker.seed(SEED);
  const world = SimWorldSchema.parse({
    seed: SEED,
    generatedAt: GENERATED_AT,
    businesses: buildBusinesses(),
    creators: buildCreators(),
  });
  const outputPath = fileURLToPath(
    new URL("./fixtures/world.json", import.meta.url),
  );
  await writeFile(outputPath, `${JSON.stringify(world, null, 2)}\n`, "utf8");
}

void generate();
