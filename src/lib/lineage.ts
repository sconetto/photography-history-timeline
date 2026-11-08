/** Ancestors and descendants over the "parents" graph. */
export interface Node { id: string; parents: { id: string; kind: string }[] }

export function childrenMap(nodes: Node[]) {
  const kids = new Map<string, { id: string; kind: string }[]>();
  for (const n of nodes) kids.set(n.id, []);
  for (const n of nodes) for (const p of n.parents) kids.get(p.id)?.push({ id: n.id, kind: p.kind });
  return kids;
}

export function lineage(nodes: Node[], id: string) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kids = childrenMap(nodes);
  const up = new Set<string>();
  const down = new Set<string>();
  const climb = (x: string) => { if (up.has(x)) return; up.add(x); byId.get(x)?.parents.forEach((p) => climb(p.id)); };
  const descend = (x: string) => { if (down.has(x)) return; down.add(x); kids.get(x)?.forEach((k) => descend(k.id)); };
  climb(id);
  descend(id);
  return { up, down };
}

/** Returns the ids on a cycle, or [] if the graph is acyclic. */
export function findCycle(nodes: Node[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  let found: string[] = [];
  const visit = (id: string): boolean => {
    state.set(id, 1); stack.push(id);
    for (const p of byId.get(id)?.parents ?? []) {
      const s = state.get(p.id);
      if (s === 1) { found = stack.slice(stack.indexOf(p.id)).concat(p.id); return true; }
      if (!s && visit(p.id)) return true;
    }
    state.set(id, 2); stack.pop();
    return false;
  };
  for (const n of nodes) if (!state.has(n.id) && visit(n.id)) break;
  return found;
}
