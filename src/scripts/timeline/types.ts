export type Side = 'invention' | 'product';
export type Impact = 'xl' | 'l' | 'm' | 's';
export type Status = 'inuse' | 'revived' | 'niche' | 'obsolete';
export type Kind = 'built' | 'enabled' | 'replaced';

export interface Item {
  id: string;
  label: string;
  title: string;
  ds: string;
  date: string;
  year: number;
  range?: [number, number];
  end?: number;
  fam: string;
  side: Side;
  impact: Impact;
  status: Status;
  summary: string;
  today: string;
  parents: { id: string; kind: Kind }[];
  makers: string[];
  thumb?: string;
  thumbAlt?: string;
  href: string;
}
export interface Milestone { id: string; year: number; label: string; when: string; note: string; href: string }
export interface Era { name: string; short: string; a: number; b: number }
export interface Family { id: string; name: string; short: string }
export interface Payload { items: Item[]; milestones: Milestone[]; eras: Era[]; families: Family[]; now: number }

export interface Pos { x: number; y: number; r: number; anchor: 'start' | 'end'; row: number; side?: 'up' | 'down' }
export interface Frame { W: number; H: number; x0: number; mainW: number; s: number; pos: Record<string, Pos>; axisY?: number; lanes?: { fam: string; top: number; h: number }[] }
