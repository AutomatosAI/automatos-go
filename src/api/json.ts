/** JSON.parse that answers null instead of throwing: off the wire, a body may be anything. */
export function parseJson(text: string): { readonly value: unknown } | null {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return null; // not JSON: the caller decides what that means (no detail, an invalid response)
  }
}
