/**
 * Analyzes usernames for suspicious bot-like patterns.
 * Returns a score 0.0 (normal) to 1.0 (very suspicious).
 */

const BOT_PREFIXES = ["follow", "f4f", "like4like", "l4l", "gain", "promo", "dm_for", "free_"];
const BOT_SUFFIXES = ["_official", "_real", "_backup", "_spam", "_bot", "_promo"];
const SUSPICIOUS_WORDS = ["follow", "followback", "gainwithus", "shoutout", "promo", "free", "money", "crypto", "forex"];

export interface UsernameAnalysis {
  score: number;
  flags: string[];
}

/**
 * Analyze a username for bot-like patterns.
 */
export function analyzeUsername(username: string): UsernameAnalysis {
  const lower = username.toLowerCase();
  const flags: string[] = [];
  let score = 0;

  // Check excessive consecutive digits
  const digitMatch = lower.match(/\d{5,}/);
  if (digitMatch) {
    flags.push("excessive_digits");
    score += 0.3;
  } else if (/\d{3,}/.test(lower)) {
    flags.push("trailing_digits");
    score += 0.1;
  }

  // Check excessive underscores
  const underscoreCount = (lower.match(/_/g) ?? []).length;
  if (underscoreCount >= 4) {
    flags.push("excessive_underscores");
    score += 0.2;
  }

  // Check very long usernames (>25 chars)
  if (lower.length > 25) {
    flags.push("very_long");
    score += 0.15;
  }

  // Check bot prefixes
  for (const prefix of BOT_PREFIXES) {
    if (lower.startsWith(prefix)) {
      flags.push(`bot_prefix:${prefix}`);
      score += 0.25;
      break;
    }
  }

  // Check bot suffixes
  for (const suffix of BOT_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      flags.push(`bot_suffix:${suffix}`);
      score += 0.2;
      break;
    }
  }

  // Check suspicious words in username
  for (const word of SUSPICIOUS_WORDS) {
    if (lower.includes(word)) {
      flags.push(`suspicious_word:${word}`);
      score += 0.15;
      break;
    }
  }

  // Check random-looking patterns: no vowels in 5+ char sequences
  const noVowelMatch = lower.replace(/[_\d]/g, "").match(/[^aeiou]{5,}/);
  if (noVowelMatch) {
    flags.push("random_chars");
    score += 0.2;
  }

  return { score: Math.min(1.0, score), flags };
}
