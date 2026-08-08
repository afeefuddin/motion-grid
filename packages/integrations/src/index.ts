export interface CapabilityEstimate {
  provider: string;
  estimatedRecords: number;
  estimatedCostUsd: number;
  confidence: number;
}

export interface CapabilityAdapter<TInput, TOutput> {
  readonly capability: string;
  validateConnection(): Promise<void>;
  estimate(input: TInput): Promise<CapabilityEstimate>;
  execute(input: TInput): Promise<TOutput>;
}

export interface LocalBusinessResult {
  providerId: string;
  name: string;
  location: string;
  website?: string;
  evidence: Array<{ source: string; observedAt: string }>;
}

export * from "./resend-email";
export * from "./twilio-whatsapp";
