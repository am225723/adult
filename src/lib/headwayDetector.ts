// Headway link detection utilities
// Headway URLs appear as headway.co/... or app.headway.co/...

const HEADWAY_PATTERN = /https?:\/\/(?:app\.)?headway\.co\/[^\s"'<>)]+/gi;

export interface HeadwayLink {
  url: string;
  label: string;
}

export function extractHeadwayLinks(text: string): HeadwayLink[] {
  const matches = text.match(HEADWAY_PATTERN);
  if (!matches) return [];
  return [...new Set(matches)].map((url) => ({
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
      parsed.protocol.startsWith("http")
    );
  } catch {
    return false;
  }
}
