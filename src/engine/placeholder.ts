/** Writes a placeholder, e.g. formatPlaceholder("EMAIL", 1) → "[EMAIL_1]". */
export function formatPlaceholder(type: string, n: number): string {
  return `[${type}_${n}]`;
}

/** One placeholder-shaped token found in some text. */
export interface Token {
  start: number;
  end: number;
  /** Upper-case type, e.g. "EMAIL" or "BANK_ACCOUNT". */
  type: string;
  /** The digits exactly as written (so "01" stays "01"). */
  number: string;
  /** Mapping key, e.g. "EMAIL_1". */
  key: string;
  /** In [ ] or { }, or written bare in ALL CAPS. `file_2` is not. */
  looksLikePlaceholder: boolean;
}

// Horizontal spaces only, so a token never swallows a line break.
const SPACE = String.raw`[ \t ]*`;
// [ ] and { } count as placeholder brackets; < > and ( ) are left as prose.
const TOKEN = new RegExp(
  String.raw`(?:([\[{]+)(${SPACE}))?` +
    String.raw`(?<![A-Za-z0-9_])([A-Za-z]+(?:_[A-Za-z]+)*)_(\d+)(?![A-Za-z0-9_])` +
    String.raw`(?:(${SPACE})([\]}]+))?`,
  "g",
);

/**
 * Finds every TYPE_N-shaped token, with any surrounding [ ] or { } brackets.
 * A bracket on one side only is included when it touches the token, so
 * "[EMAIL_1" counts but the "[ " in "[ EMAIL_1 and …" does not.
 */
export function findTokens(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const [whole, open = "", openSpace = "", rawType, number, closeSpace = "", close = ""] = m;
    let start = m.index;
    let end = m.index + whole.length;
    if (open && !close && openSpace) start += open.length + openSpace.length;
    if (close && !open && closeSpace) end -= closeSpace.length + close.length;
    const bracketed = (open !== "" && start === m.index) || (close !== "" && end === m.index + whole.length);
    const type = rawType.toUpperCase();
    out.push({
      start,
      end,
      type,
      number,
      key: `${type}_${number}`,
      looksLikePlaceholder: bracketed || rawType === type,
    });
  }
  return out;
}
