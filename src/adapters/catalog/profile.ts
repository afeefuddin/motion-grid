import type { AdapterProfile } from "../../capabilities/adapter";

/** Database catalog coverage grows with imported and generated market records. */
export function catalogProfile(profile: AdapterProfile): AdapterProfile {
  return {
    ...profile,
    coverage: { geographies: ["*"], categories: ["*"] },
    productionPath: "MotionGrid market catalog",
  };
}
