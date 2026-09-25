/**
 * hash.ts — canonical serialisation and content addressing.
 *
 * The evaluation cache is keyed by *what a buffer is*, not by where it came
 * from: identical parameters over identical inputs must collide onto the same
 * cache entry, or the 2.5D loop stacks re-render every slice on every frame.
 *
 * Two properties matter and neither is negotiable:
 *
 *   1. **Key order must not matter.** `{a:1,b:2}` and `{b:2,a:1}` describe the
 *      same parameters. `JSON.stringify` disagrees with that, so we sort keys.
 *   2. **The hash must be synchronous.** Cache lookups happen inside the
 *      render loop. `crypto.subtle.digest` is async and would force the whole
 *      evaluator to become promise-coloured for no benefit.
 *
 * [AGENT-SECURITY] FNV-1a is *not* cryptographic. It is used here only to
 * dedupe locally-produced buffers, never to authenticate anything. An attacker
 * who could choose parameters could force a collision; the blast radius is a
 * wrong thumbnail in the local cache, and no code path grants trust based on a
 * hash match. If that ever changes, this must become SHA-256.
 */

/** Number of significant digits kept when hashing floats. */
const FLOAT_PRECISION = 6;

/**
 * Deterministic JSON: object keys sorted, floats rounded, `undefined` dropped.
 *
 * Float rounding exists because a slider that reports 0.30000000000000004 and
 * one that reports 0.3 are the same restoration decision, and must not produce
 * two cache entries.
 */
export function canonicalise(value: unknown): string {
  if (value === null) return "null";
  const kind = typeof value;
  if (kind === "number") {
    const n = value as number;
    if (!Number.isFinite(n)) return n > 0 ? '"+inf"' : Number.isNaN(n) ? '"nan"' : '"-inf"';
    if (Number.isInteger(n)) return String(n);
    return String(Number(n.toPrecision(FLOAT_PRECISION)));
  }
  if (kind === "boolean") return value ? "true" : "false";
  if (kind === "string") return JSON.stringify(value);
  if (kind === "bigint") return `"${(value as bigint).toString()}n"`;
  if (kind === "undefined" || kind === "function" || kind === "symbol") return "null";

  if (Array.isArray(value)) {
    return `[${value.map(canonicalise).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter((k) => record[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalise(record[k])}`).join(",")}}`;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** 64-bit FNV-1a over UTF-16 code units, returned as 16 lowercase hex digits. */
export function fnv1a64(text: string): string {
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Fold both bytes of the UTF-16 unit so that characters above U+00FF do
    // not alias onto their low byte.
    h = ((h ^ BigInt(code & 0xff)) * FNV_PRIME) & MASK_64;
    h = ((h ^ BigInt((code >> 8) & 0xff)) * FNV_PRIME) & MASK_64;
  }
  return h.toString(16).padStart(16, "0");
}

/**
 * Content address for any JSON-shaped value.
 *
 * @param value  anything canonicalisable — parameters, port maps, specs.
 * @param domain a short tag separating hash namespaces so that a *node* digest
 *               can never collide with a *buffer* digest of the same payload.
 */
export function digest(value: unknown, domain = "wiv"): string {
  return fnv1a64(`${domain} ${canonicalise(value)}`);
}

/**
 * Combine already-computed digests in order. Used to fold an input buffer's
 * address into the address of the buffer derived from it, which is what makes
 * a cache key describe an entire upstream history rather than one step.
 */
export function digestChain(domain: string, parts: readonly string[]): string {
  return fnv1a64(`${domain} ${parts.join("")}`);
}
