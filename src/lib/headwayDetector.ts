const HEADWAY_PATTERN = /\b(?:https?:\/\/)?(?:app\.)?headway\.co\/[^\s"'<>)]+/gi;

export interface HeadwayLink {
  url: string;
  label: string;
}

function normalizeUrl(raw: string): string {
  // Strip trailing punctuation that isn't part of the URL
  const stripped = raw.replace(/[.,;:!?)]+$/, "");
  // Ensure scheme is present
  return stripped.startsWith("http") ? stripped : `https://${stripped}`;
}

export function extractHeadwayLinks(text: string): HeadwayLink[] {
  const matches = text.match(HEADWAY_PATTERN);
  if (!matches) return [];
  const urls = [...new Set(matches.map(normalizeUrl))];
  return urls.map((url) => ({
    url,
    label: url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  }));
}

export function hasHeadwayLink(text: string): boolean {
  HEADWAY_PATTERN.lastIndex = 0;
  return HEADWAY_PATTERN.test(text);
}

export function isValidHeadwayUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === "headway.co" || parsed.hostname === "app.headway.co") &&
      (parsed.protocol === "http:" || parsed.protocol === "https:")
    );
  } catch {
    return false;
  }
}
