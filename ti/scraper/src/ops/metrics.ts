export type MetricKind = "counter" | "gauge";

export interface MetricSample {
  name: string;
  kind: MetricKind;
  value: number;
  labels: Record<string, string>;
  updatedAt: string;
}

export class MetricsRegistry {
  private readonly samples = new Map<string, MetricSample>();

  increment(name: string, value = 1, labels: Record<string, string> = {}): MetricSample {
    const previous = this.getOrCreate(name, "counter", labels);
    previous.value += value;
    previous.updatedAt = new Date().toISOString();
    return previous;
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}): MetricSample {
    const sample = this.getOrCreate(name, "gauge", labels);
    sample.value = value;
    sample.updatedAt = new Date().toISOString();
    return sample;
  }

  snapshot(): MetricSample[] {
    return [...this.samples.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  toPrometheus(): string {
    return this.snapshot()
      .map((sample) => `${sample.name}${formatLabels(sample.labels)} ${sample.value}`)
      .join("\n") + "\n";
  }

  private getOrCreate(name: string, kind: MetricKind, labels: Record<string, string>): MetricSample {
    const key = `${name}:${JSON.stringify(Object.entries(labels).sort())}`;
    const previous = this.samples.get(key);
    if (previous) return previous;
    const sample: MetricSample = {
      name,
      kind,
      value: 0,
      labels,
      updatedAt: new Date().toISOString()
    };
    this.samples.set(key, sample);
    return sample;
  }
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels).sort();
  if (entries.length === 0) return "";
  return `{${entries.map(([key, value]) => `${key}="${value.replaceAll("\"", "\\\"")}"`).join(",")}}`;
}
