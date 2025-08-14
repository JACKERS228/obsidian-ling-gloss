// src/tree/parse.ts
export type Feature = { sign: "+" | "-"; name: string };
export type Node = {
  label: string;            // e.g., "DP" or "t"
  features: Feature[];      // e.g., [{sign:"+", name:"WH"}]
  id?: string;              // movement anchor: "wh"
  children: Node[];
};

type Tok = { kind: "sym" | "lbr" | "rbr" | "quote"; value: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const push = (k: Tok["kind"], v: string) => out.push({ kind: k, value: v });

  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "[") { push("lbr", c); i++; continue; }
    if (c === "]") { push("rbr", c); i++; continue; }
    if (c === '"') {
      // quoted symbol (allows spaces)
      let j = i + 1, buf = "";
      while (j < src.length && src[j] !== '"') { buf += src[j++]; }
      if (src[j] !== '"') throw new Error("Unclosed quote");
      push("sym", buf);
      i = j + 1;
      continue;
    }
    // symbol run
    let j = i, buf = "";
    while (j < src.length && !/\s|\[|\]/.test(src[j])) buf += src[j++];
    push("sym", buf);
    i = j;
  }
  return out;
}

/** Parse Node ::= '[' Label Features* Children* ']' | Symbol */
export function parseTree(src: string): Node {
  const toks = tokenize(src);
  let p = 0;

  function peek(): Tok | undefined { return toks[p]; }
  function eat(kind?: Tok["kind"]): Tok {
    const t = toks[p++];
    if (!t) throw new Error("Unexpected end of input");
    if (kind && t.kind !== kind) throw new Error(`Expected ${kind}, got ${t.kind}`);
    return t;
  }

  function parseFeaturesPart(sym: string): { base: string; features: Feature[]; id?: string } {
    // Accept forms like:  DP[+WH][-Q]#wh   or   DP#wh[+WH]
    // We split off an optional "#id" that may be appended to the first symbol.
    let base = sym;
    let id: string | undefined;
    const hash = base.indexOf("#");
    if (hash >= 0) {
      id = base.slice(hash + 1);
      base = base.slice(0, hash);
    }
    const features: Feature[] = [];
    // features are parsed at the same level by the caller (after label) as bracketed [+X] or [-Y]
    return { base, features, id };
  }

  function parseNode(): Node {
    const t = peek();
    if (!t) throw new Error("Unexpected end");
    if (t.kind === "lbr") {
      eat("lbr");
      // next is label symbol
      const labelTok = eat("sym");
      const head = parseFeaturesPart(labelTok.value);
      // After label, accept zero or more feature groups written as [+X] or [-Y] (each in its own [...] pair)
      const features: Feature[] = [];
      let children: Node[] = [];
      // Look-ahead loop; features must come first if they appear (before first child '[' or sym)
      while (true) {
        const t2 = peek();
        if (!t2) throw new Error("Unclosed '['");
        if (t2.kind === "lbr") {
          // Need to look ahead: if next token after lbr is a +/-feature and then rbr,
          // treat it as a feature group; else it's a child node
          const save = p;
          eat("lbr");
          const maybe = peek();
          if (maybe?.kind === "sym" && (/^[+-]/.test(maybe.value))) {
            const featTok = eat("sym");
            const sign = featTok.value.startsWith("+") ? "+" : "-";
            const name = featTok.value.replace(/^[+-]/, "");
            features.push({ sign, name });
            eat("rbr");
          } else {
            // rewind and parse child
            p = save;
            children.push(parseNode());
          }
        } else if (t2.kind === "sym") {
          // bare symbol child (leaf)
          const leaf = eat("sym");
          children.push({
            label: leaf.value.replace(/^"|"$/g, ""),
            features: [],
            children: []
          });
        } else if (t2.kind === "rbr") {
          break;
        } else break;
      }
      eat("rbr");
      return {
        label: head.base,
        features,
        id: head.id,
        children
      };
    } else if (t.kind === "sym") {
      const s = eat("sym").value;
      const head = parseFeaturesPart(s);
      return { label: head.base, features: [], id: head.id, children: [] };
    }
    throw new Error("Bad token");
  }

  const root = parseNode();
  if (p !== toks.length) throw new Error("Extra input after tree");
  return root;
}
