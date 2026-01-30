export function getPanelWp(panelName: string): number {
  if (!panelName) {
    return 0;
  }
  // Regex for å finne tall etter W eller w (f.eks. "Premium 415 W" → 415)
  const match = panelName.match(/(\d+)\s*[Ww]/);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Fallback om regex ikke matcher
  console.warn(`Kunne ikke finne watt for panel: ${panelName}`);
  return 0;
}
