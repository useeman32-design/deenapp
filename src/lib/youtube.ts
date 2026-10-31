/** Extract only validated IDs from supported YouTube URLs or a bare ID. */
export function youtubeId(input: unknown): string | null {
  const raw = String(input ?? '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  const normalized = raw.replace(/^https?:\/\//i, '').replace(/^(?:www\.|m\.|music\.)/i, '');
  let candidate = '';
  const short = normalized.match(/^youtu\.be\/([A-Za-z0-9_-]{11})(?:[/?#&]|$)/i);
  const embed = normalized.match(/^(?:youtube\.com|youtube-nocookie\.com)\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:[/?#&]|$)/i);
  const watch = normalized.match(/^(?:youtube\.com|youtube-nocookie\.com)\/watch\?([^#]*)/i);
  if (short) candidate = short[1];
  else if (embed) candidate = embed[1];
  else if (watch) candidate = (watch[1].match(/(?:^|&)v=([A-Za-z0-9_-]{11})(?:&|$)/i) ?? [])[1] ?? '';
  return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
}
export function youtubeEmbedUrl(input: unknown): string | null {
  const id = youtubeId(input);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}
