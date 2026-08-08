import { ApiErrorSchema } from "../../../src/contracts/api";

export async function readContractJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  const parsed: unknown = JSON.parse(raw, (_key, value: unknown) => {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return new Date(value);
    }
    return value;
  });
  if (!response.ok) {
    const error = ApiErrorSchema.safeParse(parsed);
    throw new Error(error.success ? error.data.error.message : "The request could not be completed.");
  }
  return parsed;
}
