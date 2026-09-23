export function modelProofPayload(proof: Record<string, unknown>): string;
export function signModelProof(proof: Record<string, unknown>, key: string): string;
export function createModelProbe(options?: { key?: string; directory?: string; now?: () => number }): {
    probe(baseUrl: string, model: string): Promise<{ ok: boolean; status: number; body: unknown }>;
    state(): { configured: boolean; lastProofAt: number | null };
};
