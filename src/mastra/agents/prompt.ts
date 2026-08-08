export function agentInput(label: string, input: object): string {
  return `${label}\n${JSON.stringify(input)}`;
}
