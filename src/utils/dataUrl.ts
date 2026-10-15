/**
 * Helpers for the annotated images the backend returns as data: URLs.
 * The backend currently encodes JPEG, but nothing here assumes a format.
 */

export function dataUrlExtension(dataUrl: string): string {
  const match = /^data:image\/([a-z0-9.+-]+);base64,/i.exec(dataUrl);
  const subtype = match?.[1]?.toLowerCase() ?? 'png';
  return subtype === 'jpeg' ? 'jpg' : subtype;
}

export function dataUrlBase64Payload(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}
