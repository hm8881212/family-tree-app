import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface TreePerson {
  id: string;
  first_name: string;
  last_name: string;
  gender?: string;
  dob?: string;
  dod?: string;
  photo_url?: string;
  is_unknown: boolean;
}

export interface TreeRelationship {
  id: string;
  from_person_id: string;
  to_person_id: string;
  type: string;
  subtype?: string;
}

export interface FamilyTreeHandle {
  exportPng: () => void;
}

interface Props {
  persons: TreePerson[];
  relationships: TreeRelationship[];
  onPersonClick?: (person: TreePerson) => void;
  highlightIds?: Set<string>;
}

interface NodePos {
  x: number;
  y: number;
  person: TreePerson;
}

const NODE_W = 140;
const NODE_H = 64;
const H_GAP = 180;
const V_GAP = 120;

function layoutNodes(persons: TreePerson[], relationships: TreeRelationship[]): NodePos[] {
  if (persons.length === 0) return [];

  const genMap = new Map<string, number>();
  const childOf = new Map<string, string[]>();

  for (const r of relationships) {
    if (r.type === 'parent_of') {
      if (!childOf.has(r.from_person_id)) childOf.set(r.from_person_id, []);
      childOf.get(r.from_person_id)!.push(r.to_person_id);
    }
  }

  const roots = persons.filter((p) => !relationships.some((r) => r.type === 'parent_of' && r.to_person_id === p.id));
  const queue = roots.map((r) => ({ id: r.id, gen: 0 }));
  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    if (genMap.has(id)) continue;
    genMap.set(id, gen);
    for (const childId of childOf.get(id) ?? []) {
      queue.push({ id: childId, gen: gen + 1 });
    }
  }
  for (const p of persons) {
    if (!genMap.has(p.id)) genMap.set(p.id, 0);
  }

  const byGen = new Map<number, TreePerson[]>();
  for (const p of persons) {
    const g = genMap.get(p.id) ?? 0;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(p);
  }

  const nodes: NodePos[] = [];
  const sortedGens = Array.from(byGen.keys()).sort((a, b) => a - b);
  for (const gen of sortedGens) {
    const row = byGen.get(gen)!;
    const totalW = row.length * (NODE_W + H_GAP) - H_GAP;
    row.forEach((person, i) => {
      nodes.push({
        x: i * (NODE_W + H_GAP) - totalW / 2,
        y: gen * (NODE_H + V_GAP),
        person,
      });
    });
  }
  return nodes;
}

const GENDER_COLORS: Record<string, string> = {
  male: '#3B82F6',
  female: '#EC4899',
  other: '#8B5CF6',
  unknown: '#9CA3AF',
};

const FamilyTree = forwardRef<FamilyTreeHandle, Props>(function FamilyTree(
  { persons, relationships, onPersonClick, highlightIds },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const nodesRef = useRef<NodePos[]>([]);
  const lastTouchDistRef = useRef<number | null>(null);

  const highlightIdsRef = useRef<Set<string>>(new Set());
  highlightIdsRef.current = highlightIds ?? new Set();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = canvas.width / dpr / 2 + offsetRef.current.x;
    const cy = (canvas.height / dpr) * 0.3 + offsetRef.current.y;
    ctx.translate(cx, cy);
    ctx.scale(scaleRef.current, scaleRef.current);

    const nodes = nodesRef.current;
    const posById = new Map(nodes.map((n) => [n.person.id, n]));

    for (const r of relationships) {
      const from = posById.get(r.from_person_id);
      const to = posById.get(r.to_person_id);
      if (!from || !to) continue;

      ctx.beginPath();
      ctx.strokeStyle = r.type === 'spouse_of' ? '#F59E0B' : r.type === 'sibling_of' ? '#10B981' : '#6B7280';
      ctx.lineWidth = r.type === 'spouse_of' ? 2 : 1.5;
      ctx.setLineDash(r.type === 'spouse_of' ? [6, 3] : []);
      const fx = from.x + NODE_W / 2;
      const fy = from.y + NODE_H / 2;
      const tx = to.x + NODE_W / 2;
      const ty = to.y + NODE_H / 2;
      if (r.type === 'parent_of') {
        ctx.moveTo(fx, fy + NODE_H / 2);
        ctx.bezierCurveTo(fx, (fy + ty) / 2, tx, (fy + ty) / 2, tx, ty - NODE_H / 2);
      } else {
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const { x, y, person } of nodes) {
      const color = GENDER_COLORS[person.gender ?? 'unknown'] ?? GENDER_COLORS.unknown;

      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;

      const isHighlighted = highlightIdsRef.current.size > 0 && highlightIdsRef.current.has(person.id);
      ctx.beginPath();
      ctx.roundRect(x, y, NODE_W, NODE_H, 10);
      ctx.fillStyle = isHighlighted ? '#FEF08A' : person.is_unknown ? '#F3F4F6' : '#FFFFFF';
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.beginPath();
      ctx.roundRect(x, y, 5, NODE_H, [10, 0, 0, 10]);
      ctx.fillStyle = person.is_unknown ? '#D1D5DB' : color;
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(x, y, NODE_W, NODE_H, 10);
      ctx.strokeStyle = isHighlighted ? '#EAB308' : '#E5E7EB';
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.stroke();

      ctx.fillStyle = person.is_unknown ? '#9CA3AF' : '#1F2937';
      ctx.font = `${person.is_unknown ? 'italic ' : ''}600 12px Inter, sans-serif`;
      ctx.textAlign = 'left';
      const name = person.is_unknown ? 'Unknown' : `${person.first_name} ${person.last_name}`;
      ctx.fillText(name.length > 14 ? name.slice(0, 13) + '…' : name, x + 14, y + 26);

      if (person.dob) {
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '400 10px Inter, sans-serif';
        const year = new Date(person.dob).getFullYear();
        ctx.fillText(`b. ${year}`, x + 14, y + 44);
      }
    }

    ctx.restore();
  }, [relationships]);

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = 'family-tree.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    },
  }));

  useEffect(() => {
    nodesRef.current = layoutNodes(persons, relationships);
    draw();
  }, [persons, relationships, draw]);

  // Redraw when highlight set changes (search)
  useEffect(() => {
    draw();
  }, [highlightIds, draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio ?? 1;
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    resize();
    return () => ro.disconnect();
  }, [draw]);

  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current) return;
    offsetRef.current = { x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y };
    draw();
  };
  const onMouseUp = () => { draggingRef.current = false; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    scaleRef.current = Math.max(0.3, Math.min(3, scaleRef.current * (e.deltaY > 0 ? 0.9 : 1.1)));
    draw();
  };

  const onClick = (e: React.MouseEvent) => {
    if (!onPersonClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio ?? 1;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = canvas.width / dpr / 2 + offsetRef.current.x;
    const cy = (canvas.height / dpr) * 0.3 + offsetRef.current.y;
    const wx = (mx - cx) / scaleRef.current;
    const wy = (my - cy) / scaleRef.current;

    for (const { x, y, person } of nodesRef.current) {
      if (wx >= x && wx <= x + NODE_W && wy >= y && wy <= y + NODE_H) {
        onPersonClick(person);
        break;
      }
    }
  };

  // Touch support
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      draggingRef.current = true;
      dragStartRef.current = {
        x: e.touches[0].clientX - offsetRef.current.x,
        y: e.touches[0].clientY - offsetRef.current.y,
      };
      lastTouchDistRef.current = null;
    } else if (e.touches.length === 2) {
      draggingRef.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && draggingRef.current) {
      offsetRef.current = {
        x: e.touches[0].clientX - dragStartRef.current.x,
        y: e.touches[0].clientY - dragStartRef.current.y,
      };
      draw();
    } else if (e.touches.length === 2 && lastTouchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / lastTouchDistRef.current;
      scaleRef.current = Math.max(0.3, Math.min(3, scaleRef.current * ratio));
      lastTouchDistRef.current = dist;
      draw();
    }
  };

  const onTouchEnd = () => {
    draggingRef.current = false;
    lastTouchDistRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ cursor: 'grab', display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    />
  );
});

export default FamilyTree;
