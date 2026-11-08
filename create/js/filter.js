// The same word filter as GunnerVerse room chat (relay index.js): text that SCRIPTS put on the screen goes through it
// (the relay already filters the words saved in a published game). Links and phone numbers are dropped, bad words starred.
export const LINK_RE = /https?:|www\.|\.(com|net|org|io|gg|tv|me|co)(?![a-z])|discord|snap(chat)?\b|insta(gram)?\b|tiktok|(\d[\s.\-]*){7,}/i;
export const BAD_WORDS = ["fuck", "shit", "bitch", "asshole", "ass", "dick", "pussy", "cunt", "nigger", "nigga", "faggot", "fag", "retard",
  "whore", "slut", "bastard", "cock", "penis", "vagina", "porn", "sex", "boob", "wtf", "stfu", "kys", "damn", "crap", "hoe", "twat",
  "douche", "nazi", "hitler", "rape", "suicide", "kill yourself"];
export const LEET = { a: "[a@4*]", e: "[e3*]", i: "[i1!|*]", o: "[o0*]", s: "[s5$z]", t: "[t7+]", l: "[l1|]", u: "[uv]", g: "[g9]", b: "[b8]", c: "[c(k]", k: "[kc]" };
export const BAD_RE = new RegExp("(?<![a-z0-9])(?:" + BAD_WORDS.map((w) => [...w].map((ch) => ch === " " ? "\\s*" : (LEET[ch] || ch) + "+").join("[\\s._\\-]?")).join("|") + ")(?:es|s|ing|ed|er|y)?(?![a-z0-9])", "gi");
export function filterText(v, max) {
  let s = String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max || 200);
  if (LINK_RE.test(s)) s = s.replace(/\S*(https?:|www\.|\.(com|net|org|io|gg|tv|me|co)\b)\S*/gi, "").replace(new RegExp(LINK_RE.source, "gi"), "").trim();
  BAD_RE.lastIndex = 0;
  s = s.replace(BAD_RE, "***");
  BAD_RE.lastIndex = 0;
  return s;
}
