export interface MetricSource {
  ready(): boolean;
  readMessage(): string;
}

/** A successful empty query is zero; an unresolved query is never a total. */
export function confirmedMetric(value: string, hint: string, ...sources: MetricSource[]): { value: string; hint: string } {
  const unresolved = sources.find(source => !source.ready());
  return unresolved ? { value: '—', hint: unresolved.readMessage() } : { value, hint };
}
