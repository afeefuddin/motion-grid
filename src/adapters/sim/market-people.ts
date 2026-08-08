import type { z } from "zod";
import type {
  PeopleFindInputSchema,
  PeopleFindOutputSchema,
} from "../../contracts/capabilities";
import { simWorld } from "../../sim/world";
import { unitCost, watchableDelay } from "./shared";

type Input = z.infer<typeof PeopleFindInputSchema>;
type Output = z.infer<typeof PeopleFindOutputSchema>;

export const marketPeopleSimAdapter = {
  adapterId: "market.people",
  capability: "people.find",
  unitCost: unitCost("record", 1.1),
  async execute(input: Input): Promise<Output> {
    await watchableDelay(input);
    const business = simWorld.businesses.find(
      (candidate) => candidate.id === input.externalRef,
    );
    const wantsEmail = input.channels.includes("email");
    const wantsWhatsapp = input.channels.includes("whatsapp");
    return {
      people:
        business === undefined
          ? []
          : business.contacts.map((contact) => ({
              name: contact.name,
              role: contact.role,
              email: wantsEmail ? contact.email : null,
              phone: wantsWhatsapp ? contact.phone : null,
              confidence: contact.role === "Owner" ? 0.94 : 0.86,
            })),
    };
  },
};
