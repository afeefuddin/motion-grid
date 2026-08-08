import fixture from "./fixtures/world.json";
import { SimWorldSchema } from "./schema";

// JSON import is the fixture boundary; downstream adapters operate on validated data.
export const simWorld = SimWorldSchema.parse(fixture);
