/**
 * columnar.ts — the parameter log, stored by column.
 *
 * ## What this is for
 *
 * The asset graph (`core/hybrid.ts`) answers *structural* questions: what was
 * this derived from, where do two branches meet. It is the wrong shape for the
 * other half of the questions a generation project raises, which are
 * *analytical*: "every generation on Nano Banana v2.1 with guidance above 7",
 * "the slowest ten runs this week", "which seeds did I try on this prompt".
 * Those scan one or two fields across thousands of records and ignore the
 * rest, which is exactly the access pattern a column store exists for.
 *
 * So each field lives in its own typed array. A filter on `guidance_scale`
 * walks one `Float64Array` and never touches a prompt string; a filter on
 * `model_name` compares small integers, because strings are dictionary-encoded
 * — a project with ten thousand generations typically has four model names.
 *
 * ## The rule this file enforces
 *
 * **There is no update and no delete.** A record, once appended, is the
 * permanent account of what produced an asset. Changing a prompt is a *new*
 * record against a *new* asset, linked to its parent in the graph; it is never
 * an edit here. `append` refuses a record id it has already seen, rather than
 * overwriting, because a silent overwrite is how a lineage store loses the one
 * thing it was for.
 *
 * ## Schema evolution
 *
 * The first record to carry a field creates its column; earlier rows read as
 * null. A field that later arrives with a different kind (a number where a
 * string was) is refused with the column's name — coercing it would make every
 * numeric predicate on that column quietly wrong.
 */

/** Physical representation of one column. */
export type ColumnKind = "number" | "string" | "boolean";

/** A value as it enters or leaves the store. */
export type Cell = number | string | boolean | null;

/** One record. `record_id` and `asset_id` are required and always strings. */
export interface ColumnRecord {
  readonly record_id: string;
  readonly asset_id: string;
  readonly [field: string]: Cell;
}

export type Operator = "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "in" | "contains";

/** One predicate. Clauses in a query are ANDed. */
export type Clause = readonly [field: string, op: Operator, value: Cell | readonly Cell[]];

export interface QueryOptions {
  readonly where?: readonly Clause[];
  readonly orderBy?: { readonly field: string; readonly direction?: "asc" | "desc" };
  readonly limit?: number;
}

export interface ColumnStats {
  readonly field: string;
  readonly count: number;
  readonly nulls: number;
  readonly min: number | null;
  readonly max: number | null;
  readonly mean: number | null;
}

/** The on-disk form. Columns, not rows, so it stays compact and diffable. */
export interface ColumnarSnapshot {
  readonly format: "arstechnic.columnar/1";
  readonly rows: number;
  readonly columns: Readonly<
    Record<string, { readonly kind: ColumnKind; readonly values: readonly Cell[] }>
  >;
}

export class ColumnarError extends Error {
  override name = "ColumnarError";
}

const INITIAL_CAPACITY = 64;

function kindOf(value: Exclude<Cell, null>): ColumnKind {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

/**
 * One growable column.
 *
 * Numbers live in a `Float64Array` (a seed up to 2^53 survives exactly), strings
 * as `Uint32Array` codes into a per-column dictionary, booleans as a `Uint8Array`.
 * Validity is a separate byte per row rather than a NaN sentinel, because NaN is
 * a value someone can legitimately log and must not read back as "absent".
 */
class Column {
  readonly kind: ColumnKind;
  #numbers: Float64Array | null = null;
  #codes: Uint32Array | null = null;
  #bools: Uint8Array | null = null;
  #valid: Uint8Array;
  readonly #dictionary: string[] = [];
  readonly #codeOf = new Map<string, number>();

  constructor(kind: ColumnKind, capacity: number) {
    this.kind = kind;
    this.#valid = new Uint8Array(capacity);
    if (kind === "number") this.#numbers = new Float64Array(capacity);
    else if (kind === "string") this.#codes = new Uint32Array(capacity);
    else this.#bools = new Uint8Array(capacity);
  }

  grow(capacity: number): void {
    const valid = new Uint8Array(capacity);
    valid.set(this.#valid);
    this.#valid = valid;
    if (this.#numbers) {
      const next = new Float64Array(capacity);
      next.set(this.#numbers);
      this.#numbers = next;
    }
    if (this.#codes) {
      const next = new Uint32Array(capacity);
      next.set(this.#codes);
      this.#codes = next;
    }
    if (this.#bools) {
      const next = new Uint8Array(capacity);
      next.set(this.#bools);
      this.#bools = next;
    }
  }

  /** Intern a string, returning its code. */
  code(text: string): number {
    let code = this.#codeOf.get(text);
    if (code === undefined) {
      code = this.#dictionary.length;
      this.#dictionary.push(text);
      this.#codeOf.set(text, code);
    }
    return code;
  }

  /** The code for a string if the dictionary has it — used by predicates, never interns. */
  lookup(text: string): number | undefined {
    return this.#codeOf.get(text);
  }

  set(row: number, value: Cell): void {
    if (value === null) return; // validity stays 0
    this.#valid[row] = 1;
    if (this.#numbers) this.#numbers[row] = value as number;
    else if (this.#codes) this.#codes[row] = this.code(value as string);
    else this.#bools![row] = value ? 1 : 0;
  }

  get(row: number): Cell {
    if (!this.#valid[row]) return null;
    if (this.#numbers) return this.#numbers[row]!;
    if (this.#codes) return this.#dictionary[this.#codes[row]!]!;
    return this.#bools![row] === 1;
  }

  isValid(row: number): boolean {
    return this.#valid[row] === 1;
  }

  numbers(): Float64Array | null {
    return this.#numbers;
  }
  codes(): Uint32Array | null {
    return this.#codes;
  }
  bools(): Uint8Array | null {
    return this.#bools;
  }
  dictionary(): readonly string[] {
    return this.#dictionary;
  }
  cardinality(): number {
    return this.#dictionary.length;
  }
}

const RESERVED = ["record_id", "asset_id"] as const;

export class ColumnarStore {
  #rows = 0;
  #capacity = INITIAL_CAPACITY;
  readonly #columns = new Map<string, Column>();
  readonly #rowOfRecord = new Map<string, number>();
  readonly #rowsOfAsset = new Map<string, number[]>();

  constructor() {
    for (const field of RESERVED) this.#columns.set(field, new Column("string", this.#capacity));
  }

  get size(): number {
    return this.#rows;
  }

  /** Field names with their kinds, in first-seen order. */
  schema(): ReadonlyArray<{ readonly field: string; readonly kind: ColumnKind }> {
    return [...this.#columns.entries()].map(([field, col]) => ({ field, kind: col.kind }));
  }

  has(recordId: string): boolean {
    return this.#rowOfRecord.has(recordId);
  }

  /**
   * Append one record. Returns its row index.
   *
   * Refuses a duplicate `record_id` and a kind conflict *before* writing
   * anything, so a rejected record leaves no partial row behind.
   */
  append(record: ColumnRecord): number {
    if (typeof record.record_id !== "string" || record.record_id === "") {
      throw new ColumnarError("A record needs a non-empty string record_id.");
    }
    if (typeof record.asset_id !== "string" || record.asset_id === "") {
      throw new ColumnarError(`Record ${record.record_id} needs a non-empty string asset_id.`);
    }
    if (this.#rowOfRecord.has(record.record_id)) {
      throw new ColumnarError(
        `Record ${record.record_id} already exists. Parameter logs are append-only: ` +
          `log the change as a new record against a derived asset.`,
      );
    }

    // Validate every field first — all-or-nothing.
    const fresh: Array<[string, ColumnKind]> = [];
    for (const [field, value] of Object.entries(record)) {
      if (value === null || value === undefined) continue;
      if (typeof value === "object") {
        throw new ColumnarError(
          `Field ${field} holds an object. Columns take numbers, strings and booleans; ` +
            `flatten it or store it as a JSON string.`,
        );
      }
      const kind = kindOf(value);
      const existing = this.#columns.get(field);
      if (existing && existing.kind !== kind) {
        throw new ColumnarError(
          `Field ${field} is a ${existing.kind} column; record ${record.record_id} ` +
            `gives it a ${kind}.`,
        );
      }
      if (!existing) fresh.push([field, kind]);
    }

    if (this.#rows === this.#capacity) {
      this.#capacity *= 2;
      for (const col of this.#columns.values()) col.grow(this.#capacity);
    }
    for (const [field, kind] of fresh) this.#columns.set(field, new Column(kind, this.#capacity));

    const row = this.#rows++;
    for (const [field, value] of Object.entries(record)) {
      if (value === undefined) continue;
      this.#columns.get(field)!.set(row, value);
    }
    this.#rowOfRecord.set(record.record_id, row);
    const assetRows = this.#rowsOfAsset.get(record.asset_id) ?? [];
    assetRows.push(row);
    this.#rowsOfAsset.set(record.asset_id, assetRows);
    return row;
  }

  /** Materialise one row. Null fields are omitted. */
  row(index: number): ColumnRecord {
    if (index < 0 || index >= this.#rows) throw new ColumnarError(`No row ${index}.`);
    const out: Record<string, Cell> = {};
    for (const [field, col] of this.#columns) {
      const value = col.get(index);
      if (value !== null) out[field] = value;
    }
    return out as unknown as ColumnRecord;
  }

  record(recordId: string): ColumnRecord | null {
    const row = this.#rowOfRecord.get(recordId);
    return row === undefined ? null : this.row(row);
  }

  /** Every record logged against an asset, oldest first. */
  recordsOf(assetId: string): ColumnRecord[] {
    return (this.#rowsOfAsset.get(assetId) ?? []).map((r) => this.row(r));
  }

  /** One column, materialised. Nulls included, so indices line up with rows. */
  column(field: string): Cell[] {
    const col = this.#columns.get(field);
    if (!col) return new Array<Cell>(this.#rows).fill(null);
    const out: Cell[] = new Array(this.#rows);
    for (let r = 0; r < this.#rows; r++) out[r] = col.get(r);
    return out;
  }

  /**
   * Filter by column predicates. Returns matching row indices.
   *
   * Each clause narrows a selection mask by scanning a single typed array.
   * A row whose field is null never matches, for any operator including `ne`:
   * an absent value is unknown, not "not equal". A field that has never been
   * logged therefore matches nothing.
   */
  select(where: readonly Clause[] = []): number[] {
    const n = this.#rows;
    const mask = new Uint8Array(n).fill(1);
    for (const clause of where) this.#narrow(mask, clause);
    const out: number[] = [];
    for (let r = 0; r < n; r++) if (mask[r]) out.push(r);
    return out;
  }

  query(options: QueryOptions = {}): ColumnRecord[] {
    let rows = this.select(options.where ?? []);
    if (options.orderBy) {
      const col = this.#columns.get(options.orderBy.field);
      const sign = options.orderBy.direction === "desc" ? -1 : 1;
      if (col) {
        rows = rows.slice().sort((a, b) => {
          const va = col.get(a);
          const vb = col.get(b);
          // Nulls sort last regardless of direction.
          if (va === null) return vb === null ? a - b : 1;
          if (vb === null) return -1;
          if (va < vb) return -sign;
          if (va > vb) return sign;
          return a - b;
        });
      }
    }
    if (options.limit !== undefined) rows = rows.slice(0, Math.max(0, options.limit));
    return rows.map((r) => this.row(r));
  }

  /** Summary statistics over a numeric column, optionally restricted to rows. */
  stats(field: string, rows?: readonly number[]): ColumnStats {
    const col = this.#columns.get(field);
    const indices = rows ?? Array.from({ length: this.#rows }, (_, i) => i);
    if (!col || col.kind !== "number") {
      return { field, count: 0, nulls: indices.length, min: null, max: null, mean: null };
    }
    const values = col.numbers()!;
    let count = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const r of indices) {
      if (!col.isValid(r)) continue;
      const v = values[r]!;
      count++;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return {
      field,
      count,
      nulls: indices.length - count,
      min: count ? min : null,
      max: count ? max : null,
      mean: count ? sum / count : null,
    };
  }

  /** Distinct values of a string column, with their counts. */
  distinct(field: string): Array<{ value: string; count: number }> {
    const col = this.#columns.get(field);
    if (!col || col.kind !== "string") return [];
    const counts = new Uint32Array(col.cardinality());
    const codes = col.codes()!;
    for (let r = 0; r < this.#rows; r++) if (col.isValid(r)) counts[codes[r]!]!++;
    return col.dictionary()
      .map((value, code) => ({ value, count: counts[code]! }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }

  snapshot(): ColumnarSnapshot {
    const columns: Record<string, { kind: ColumnKind; values: Cell[] }> = {};
    for (const [field, col] of this.#columns) {
      columns[field] = { kind: col.kind, values: this.column(field) };
    }
    return { format: "arstechnic.columnar/1", rows: this.#rows, columns };
  }

  static fromSnapshot(snapshot: ColumnarSnapshot): ColumnarStore {
    if (snapshot.format !== "arstechnic.columnar/1") {
      throw new ColumnarError(`Unknown columnar format: ${String(snapshot.format)}`);
    }
    const store = new ColumnarStore();
    const fields = Object.entries(snapshot.columns);
    for (const [field, { values }] of fields) {
      if (values.length !== snapshot.rows) {
        throw new ColumnarError(
          `Column ${field} has ${values.length} values for ${snapshot.rows} rows.`,
        );
      }
    }
    for (let r = 0; r < snapshot.rows; r++) {
      const rec: Record<string, Cell> = {};
      for (const [field, { values }] of fields) {
        const v = values[r];
        if (v !== null && v !== undefined) rec[field] = v;
      }
      store.append(rec as unknown as ColumnRecord);
    }
    return store;
  }

  #narrow(mask: Uint8Array, [field, op, value]: Clause): void {
    const n = this.#rows;
    const col = this.#columns.get(field);
    if (!col) {
      mask.fill(0);
      return;
    }

    if (op === "in") {
      const wanted = Array.isArray(value) ? value : [value];
      if (col.kind === "string") {
        const codes = new Set(
          wanted.map((w) => (typeof w === "string" ? col.lookup(w) : undefined))
            .filter((c): c is number => c !== undefined),
        );
        const data = col.codes()!;
        for (let r = 0; r < n; r++) {
          if (mask[r] && !(col.isValid(r) && codes.has(data[r]!))) mask[r] = 0;
        }
      } else {
        const set = new Set(wanted);
        for (let r = 0; r < n; r++) {
          if (mask[r] && !(col.isValid(r) && set.has(col.get(r)))) mask[r] = 0;
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      throw new ColumnarError(`Operator ${op} on ${field} takes a single value, not a list.`);
    }
    const scalar = value as Cell;

    if (col.kind === "number") {
      if (typeof scalar !== "number") {
        throw new ColumnarError(
          `${field} is numeric; ${op} needs a number, got ${String(scalar)}.`,
        );
      }
      const data = col.numbers()!;
      for (let r = 0; r < n; r++) {
        if (!mask[r]) continue;
        if (!col.isValid(r)) {
          mask[r] = 0;
          continue;
        }
        const v = data[r]!;
        let keep: boolean;
        switch (op) {
          case "eq":
            keep = v === scalar;
            break;
          case "ne":
            keep = v !== scalar;
            break;
          case "lt":
            keep = v < scalar;
            break;
          case "lte":
            keep = v <= scalar;
            break;
          case "gt":
            keep = v > scalar;
            break;
          case "gte":
            keep = v >= scalar;
            break;
          default:
            throw new ColumnarError(`Operator ${op} does not apply to numeric ${field}.`);
        }
        if (!keep) mask[r] = 0;
      }
      return;
    }

    if (col.kind === "string") {
      if (typeof scalar !== "string") {
        throw new ColumnarError(`${field} is text; ${op} needs a string.`);
      }
      const data = col.codes()!;
      if (op === "eq" || op === "ne") {
        const code = col.lookup(scalar);
        for (let r = 0; r < n; r++) {
          if (!mask[r]) continue;
          const valid = col.isValid(r);
          const equal = valid && code !== undefined && data[r] === code;
          if (!valid || (op === "eq" ? !equal : equal)) mask[r] = 0;
        }
        return;
      }
      if (op === "contains") {
        // Resolve against the dictionary once, then compare codes.
        const needle = scalar.toLowerCase();
        const hits = new Uint8Array(col.cardinality());
        col.dictionary().forEach((s, i) => {
          if (s.toLowerCase().includes(needle)) hits[i] = 1;
        });
        for (let r = 0; r < n; r++) {
          if (mask[r] && !(col.isValid(r) && hits[data[r]!])) mask[r] = 0;
        }
        return;
      }
      // Lexicographic ordering on strings — useful for ISO timestamps.
      for (let r = 0; r < n; r++) {
        if (!mask[r]) continue;
        const v = col.get(r);
        if (v === null) {
          mask[r] = 0;
          continue;
        }
        const s = v as string;
        const keep = op === "lt"
          ? s < scalar
          : op === "lte"
          ? s <= scalar
          : op === "gt"
          ? s > scalar
          : op === "gte"
          ? s >= scalar
          : false;
        if (!keep) mask[r] = 0;
      }
      return;
    }

    // boolean
    if (op !== "eq" && op !== "ne") {
      throw new ColumnarError(`Operator ${op} does not apply to boolean ${field}.`);
    }
    if (typeof scalar !== "boolean") {
      throw new ColumnarError(`${field} is boolean; ${op} needs true or false.`);
    }
    const data = col.bools()!;
    const want = scalar ? 1 : 0;
    for (let r = 0; r < n; r++) {
      if (!mask[r]) continue;
      const keep = col.isValid(r) && (op === "eq" ? data[r] === want : data[r] !== want);
      if (!keep) mask[r] = 0;
    }
  }
}

/**
 * Parse a compact textual filter — the form the Console's query box takes.
 *
 *   model_name = "Nano Banana v2.1" and guidance_scale > 7
 *
 * Deliberately tiny: `and`-joined `field op value` terms, with `=`, `!=`, `<`,
 * `<=`, `>`, `>=` and `~` (contains). Anything it cannot read is an error that
 * quotes the term, not a partial query that silently drops it.
 */
export function parseFilter(text: string): Clause[] {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  const terms = trimmed.split(/\s+and\s+/i);
  const OPS: Record<string, Operator> = {
    "=": "eq",
    "==": "eq",
    "!=": "ne",
    "<": "lt",
    "<=": "lte",
    ">": "gt",
    ">=": "gte",
    "~": "contains",
  };
  return terms.map((term) => {
    const m = term.match(/^\s*([A-Za-z_][\w.]*)\s*(==|!=|<=|>=|=|<|>|~)\s*([^<>=!~\s].*?)\s*$/);
    if (!m) throw new ColumnarError(`Cannot read the filter term: ${term.trim()}`);
    const [, field, symbol, raw] = m;
    let value: Cell;
    if (/^".*"$|^'.*'$/.test(raw!)) value = raw!.slice(1, -1);
    else if (raw === "true" || raw === "false") value = raw === "true";
    else if (raw === "null") value = null;
    else if (raw !== "" && Number.isFinite(Number(raw))) value = Number(raw);
    else value = raw!;
    return [field!, OPS[symbol!]!, value] as const;
  });
}
