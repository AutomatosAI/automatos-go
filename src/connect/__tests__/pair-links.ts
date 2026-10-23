// Pairing links for the scanner and pairing-link tests: a server's /go/pair link, as its QR code
// carries it, with the canonical code.

export const CODE = 'ABCD-EFGH';
export const NEW_API = 'https://automatos.example.com';

export function serverLink(api: string, code = CODE): string {
  const query = `api=${encodeURIComponent(api)}&code=${encodeURIComponent(code)}`;
  return `https://studio.example.test/go/pair?${query}`;
}

export const VALID = serverLink(NEW_API);
