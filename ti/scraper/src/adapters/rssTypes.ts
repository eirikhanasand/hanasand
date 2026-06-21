import type { AdapterHttpCache } from "./staticWeb.ts";

export type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface RssAdapterOptions {
  fetcher?: Fetcher;
  cache?: AdapterHttpCache;
}

export type RssItem = {
  title: string;
  link: string;
  description: string;
  publishedAt?: string;
};
