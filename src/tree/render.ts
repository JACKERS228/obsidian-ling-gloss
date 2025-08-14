// src/tree/render.ts
import type { Node } from "./parse";
import { layoutTree, collectPositions, type Positioned } from "./layout";

export function renderTree(root: Node): SVGElement {
  const pos = layoutTree(root);
  const w = computeExtent(pos).w + 8;
  const h = computeExtent(pos).h + 8;

  const svg = svgEl("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, class: "ling-tree-svg" });
  const defs = svgEl("defs", {});
  defs.appendChild(arrowDef());
  svg.appendChild(defs);

  // edges (parent → child)
  drawEdges(svg, pos);

  // node boxes
  drawNodes(svg, pos);

  // movement lines (id pairs between node with label 't#id' and origin node '#id')
  drawMovement(svg, pos);

  return svg;
}

function computeExtent(n: Positioned) {
  let w = 0, h = 0;
  (function visit(x: Positioned) {
    w = Math.max(w, x.x + x.width);
    h = Math.max(h, x.y + x.height);
    x.children.forEach(visit);
  })(n);
  return { w, h };
}

function svgEl<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string,string|number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, String(v)));
  return el;
}

function drawEdges(svg: SVGElement, n: Positioned) {
  n.children.forEach(c => {
    const x1 = n.x + n.width / 2, y1 = n.y + n.height;
    const x2 = c.x + c.width / 2, y2 = c.y;
    const path = svgEl("path", {
      d: `M ${x1} ${y1} V ${(y1+y2)/2} H ${x2} V ${y2}`,
      class: "ling-tree-edge"
    });
    svg.appendChild(path);
    drawEdges(svg, c);
  });
}

function drawNodes(svg: SVGElement, n: Positioned) {
  // box
  const group = svgEl("g", { class: "ling-tree-node" });
  const rect = svgEl("rect", { x: n.x, y: n.y, width: n.width, height: n.height, rx: 6, ry: 6 });
  group.appendChild(rect);

  // label
  const label = n.label + (n.id ? `#${n.id}` : "");
  const text = svgEl("text", { x: n.x + 8, y: n.y + 15 });
  text.textContent = label;
  group.appendChild(text);

  // features as badges
  if (n.features.length) {
    let off = n.x + n.width - 8;
    n.features.forEach(f => {
      const g = svgEl("g", { class: "ling-tree-feature" });
      const badgeText = `[${f.sign}${f.name}]`;
      const t = svgEl("text", { x: off - 8, y: n.y + 15 });
      t.textContent = badgeText;
      g.appendChild(t);
      group.appendChild(g);
      off -= badgeText.length * 6 + 10;
    });
  }

  svg.appendChild(group);
  n.children.forEach(c => drawNodes(svg, c));
}

function arrowDef(): SVGMarkerElement {
  const marker = svgEl("marker", {
    id: "ling-tree-arrow",
    markerWidth: 10, markerHeight: 10, refX: 9, refY: 3, orient: "auto",
    markerUnits: "strokeWidth"
  }) as SVGMarkerElement;
  const path = svgEl("path", { d: "M0,0 L9,3 L0,6 Z" });
  marker.appendChild(path);
  return marker;
}

function drawMovement(svg: SVGElement, root: Positioned) {
  // Any node with id X that has label 't' is a trace; draw from origin (non-'t') to trace.
  const map = new Map<string, { origin?: Positioned; traces: Positioned[] }>();
  (function walk(n: Positioned) {
    if (n.id) {
      const isTrace = n.label === "t";
      const rec = map.get(n.id) ?? { traces: [] };
      if (isTrace) rec.traces.push(n);
      else rec.origin = n;
      map.set(n.id, rec);
    }
    n.children.forEach(walk);
  })(root);

  map.forEach(({ origin, traces }) => {
    if (!origin) return;
    traces.forEach(t => {
      const x1 = origin.x + origin.width / 2;
      const y1 = origin.y;
      const x2 = t.x + t.width / 2;
      const y2 = t.y + t.height;
      const c1x = x1, c1y = y1 - 40;
      const c2x = x2, c2y = y2 + 40;
      const path = svgEl("path", {
        d: `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`,
        class: "ling-tree-move",
        "marker-end": "url(#ling-tree-arrow)"
      });
      svg.appendChild(path);
    });
  });
}
