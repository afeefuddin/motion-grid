export interface StructuredAgentResult<Output> {
  readonly object: Output;
}

export interface StructuredAgent<Output> {
  generate(messages: string): Promise<StructuredAgentResult<Output>>;
}
