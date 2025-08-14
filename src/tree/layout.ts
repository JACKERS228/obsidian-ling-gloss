// src/tree/layout.ts
import type { Node } from "./parse";

export interface Positioned extends Node {
  x: number;
  y: number;
  width: number;
  height: number;
  parent?: Positioned | null;
  children: Positioned[]; // overwrite Node's children type
}

const NODE_W = 36;  // min width of a node box; text will expand this
const NODE_H = 22;
const H_GAP  = 14;
const V_GAP  = 28;

function measureLabel(n: Node): number {
  // crude width estimate (monospace-ish); Obsidian will use real fonts but this is fine for layout
  const label = n.label + (n.features.length ? " [" + n.features.map(f=>`${f.sign}${f.name}`).join(",") + "]" : "");
  return Math.max(NODE_W, 8 * label.length + 12);
}

export function layoutTree(root: Node): Positioned {
  function clone(n: Node, parent?: Positioned | null): Positioned {
    const p: Positioned = {
      ...n, x: 0, y: 0, width: measureLabel(n), height: NODE_H,
      parent: parent ?? null, children: [] as Positioned[]
    };
    p.children = n.children.map(c => clone(c, p));
    return p;
  }
  const r = clone(root, null);

  function firstWalk(n: Positioned): number {
    if (n.children.length === 0) {
      n.x = 0;
      return n.width;
    }
    let widthSum = 0;
    n.children.forEach((c,i) => {
      const w = firstWalk(c);
      widthSum += w;
      if (i < n.children.length - 1) widthSum += H_GAP;
    });
    n.x = widthSum / 2 - n.width / 2;
    return Math.max(n.width, widthSum);
  }

  function secondWalk(n: Positioned, ox: number, oy: number) {
    n.x += ox;
    n.y  = oy;
    let cx = n.children.length ? n.children[0].x : 0;
    n.children.forEach((c, idx) => {
      const shift = (idx === 0) ? 0 : (n.children[idx-1].x + n.children[idx-1].width + H_GAP - c.x);
      cx = c.x + shift;
      secondWalk(c, ox + c.x - c.x + (idx === 0 ? 0 : 0), oy + n.height + V_GAP);
    });
  }

  const totalW = firstWalk(r);
  secondWalk(r, 0, 0);

  // Normalize positions to start at 0
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  (function visit(n: Positioned) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
    n.children.forEach(visit);
  })(r);
  (function shift(n: Positioned, dx: number) {
    n.x -= dx;
    n.children.forEach(c => shift(c, dx));
  })(r, minX);

  return r;
}

export function collectPositions(root: Positioned): Map<string, Positioned[]> {
  const map = new Map<string, Positioned[]>();
  (function walk(n: Positioned) {
    if (n.id) {
      const arr = map.get(n.id) ?? [];
      arr.push(n);
      map.set(n.id, arr);
    }
    n.children.forEach(walk);
  })(root);
  return map;
}
