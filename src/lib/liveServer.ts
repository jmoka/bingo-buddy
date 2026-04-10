const rawConfiguredUrl = import.meta.env.VITE_LIVE_SERVER_URL as string | undefined;

function normalizeUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function getLiveServerUrl() {
  if (rawConfiguredUrl && rawConfiguredUrl.trim()) {
    return normalizeUrl(rawConfiguredUrl.trim());
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${window.location.hostname}:8082`;
}
