// Link checks for values typed into data.json by hand.

/** Only https:// URLs from data.json become links (blocks javascript:, data:, http:). */
export function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** A plain email address -> mailto link, anything else -> null. */
export function safeMailto(value) {
  const email = String(value ?? '').trim();
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(email) ? `mailto:${email}` : null;
}
