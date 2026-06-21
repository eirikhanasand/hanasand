import { hashContent } from "../utils.ts";
import { ADAPTERS, MODE_ORDER } from "./adapterRepairTriageConfig.ts";

export const orderedModes = (values: string[]) => [...new Set(values)].sort((a, b) => MODE_ORDER.indexOf(a) - MODE_ORDER.indexOf(b));
export const orderedAdapters = (values: string[]) => [...new Set(values)].sort((a, b) => ADAPTERS.indexOf(a) - ADAPTERS.indexOf(b));
export const pOrder = (priority: string) => ({ p0: 0, p1: 1, p2: 2, p3: 3 } as Record<string, number>)[priority];
export const count = (items: any[], key: string, value: string) => items.filter((item) => item[key] === value).length;
export const countBy = (values: string[]) => values.reduce((out, value) => ({ ...out, [value]: (out[value] ?? 0) + 1 }), {} as Record<string, number>);
export const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
export const round = (value: number) => Math.round(value * 1000) / 1000;
export const hash = (value: string) => hashContent(value).slice(0, 16);
export const family = (adapter: string) => ({ static_html: "static_html", rss_feed: "rss_feed", dynamic_public_browser: "dynamic_page", pdf_report: "pdf_report", public_channel_handoff: "public_channel", advisory_signal: "advisory_signal", multilingual_handoff: "multilingual_handoff" } as Record<string, string>)[adapter];
