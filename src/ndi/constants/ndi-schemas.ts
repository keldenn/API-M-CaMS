export const DEFAULT_PROOF_NAME = 'Custom Verification Name';

/** Schema 1: Foundational ID credential */
export const IDENTITY_SCHEMA_FALLBACK =
  'https://schema.ngotag.com/schemas/fb675203-b317-4675-a657-be7f5d1d57fb';

/** Schema 2: Address / census credential */
export const ADDRESS_SCHEMA_FALLBACK =
  'https://schema.ngotag.com/schemas/cf51e93c-d8e7-450b-860e-e4d20d4fd549';

export const IDENTITY_ATTRIBUTES = [
  'ID Number',
  'Full Name',
  'Gender',
  'Date of Birth',
];

export const ADDRESS_ATTRIBUTES = ['Dzongkhag', 'Gewog', 'Village'];

export function buildProofAttributes(
  identitySchema: string,
  addressSchema: string,
): Array<{ name: string; schemaName: string }> {
  return [
    ...IDENTITY_ATTRIBUTES.map((name) => ({ name, schemaName: identitySchema })),
    ...ADDRESS_ATTRIBUTES.map((name) => ({ name, schemaName: addressSchema })),
  ];
}

/** Every attribute name the API knows how to resolve a schema for. */
export const SUPPORTED_ATTRIBUTES = [
  ...IDENTITY_ATTRIBUTES,
  ...ADDRESS_ATTRIBUTES,
];

/** Attribute names the Swagger example sends, without schema URLs. */
export const DEFAULT_PROOF_ATTRIBUTES_EXAMPLE = SUPPORTED_ATTRIBUTES;

const CANONICAL_BY_LOOKUP = new Map(
  SUPPORTED_ATTRIBUTES.map((name) => [normalizeAttributeName(name), name]),
);

function normalizeAttributeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolves a caller-supplied attribute name to the exact name NDI reveals.
 * Returns undefined when the name is not part of either credential schema.
 */
export function canonicalizeAttributeName(name: string): string | undefined {
  return CANONICAL_BY_LOOKUP.get(normalizeAttributeName(name));
}

/** Which configured schema an attribute belongs to. */
export function schemaForAttribute(
  canonicalName: string,
  identitySchema: string,
  addressSchema: string,
): string | undefined {
  if (IDENTITY_ATTRIBUTES.includes(canonicalName)) return identitySchema;
  if (ADDRESS_ATTRIBUTES.includes(canonicalName)) return addressSchema;
  return undefined;
}
