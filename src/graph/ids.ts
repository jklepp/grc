// Branded id types for every entity in the graph.
//
// A plain `string` field for `systemId`/`controlId`/`assetId` compiles fine
// with the wrong id swapped in — `assetId = "SYS-003"` is legal TypeScript
// even though it can never be correct. Branding each id space stops that at
// the call site, which is exactly where a swapped argument tends to happen.
//
// The brand is a WEAK one — the marker property is optional
// (`{ readonly __brand?: B }`), not a required `unique symbol`. That is
// deliberate: a required brand would force a cast at every one of the
// hundreds of id literals in graph/nodes and graph/edges just to construct
// the mock data, which is the "gigantic generic type framework" this
// migration is explicitly avoiding. An optional brand lets a plain string
// literal satisfy a branded type with zero casts (TypeScript treats the
// missing optional property as satisfied), while still rejecting a value
// that already carries a DIFFERENT brand — so a `SystemId` handed to a
// function expecting `AssetId` is still a compile error. What it does not
// catch is a raw, freshly-typed `string` variable passed where a branded id
// is expected; that's the real remaining gap, and closing it needs the
// stronger `unique symbol` form plus a cast at every literal.
type Brand<B extends string> = { readonly __brand?: B };

export type AssetId = string & Brand<"AssetId">;
export type SystemId = string & Brand<"SystemId">;
export type ControlId = string & Brand<"ControlId">;
export type OrgId = string & Brand<"OrgId">;
export type RiskId = string & Brand<"RiskId">;
export type DataTypeId = string & Brand<"DataTypeId">;
export type EvidenceId = string & Brand<"EvidenceId">;
export type FindingId = string & Brand<"FindingId">;
export type EvidenceSourceId = string & Brand<"EvidenceSourceId">;

// Ownership and implementation records key some maps by system id OR the
// literal sentinel "program" for enterprise-wide defaults. Named so that
// union shows up in signatures instead of a bare `string`.
export type SystemScope = SystemId | "program";
