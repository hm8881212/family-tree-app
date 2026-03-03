/**
 * Relationship path computation via recursive CTE
 * Traverses the family graph to compute the actual relationship between two persons
 * Supports Indian (masi, mama, chacha, etc.) and International labeling
 */

import { pool } from '../db';

export type RelMode = 'indian' | 'international';

interface PathStep {
  type: string;       // parent_of, spouse_of, sibling_of, adopted_by
  direction: 'forward' | 'reverse';
  subtype?: string;
  gender?: string;    // gender of the person at this step (for Indian labels)
}

/**
 * Compute the relationship label between two persons using BFS traversal
 */
export async function computeRelationshipLabel(
  fromPersonId: string,
  toPersonId: string,
  mode: RelMode
): Promise<string> {
  // Use recursive CTE to find shortest path between two persons
  const result = await pool.query<{ path: string[] }>(
    `WITH RECURSIVE rel_path AS (
      -- Base case: direct relationships from source
      SELECT
        CASE WHEN from_person_id = $1 THEN to_person_id ELSE from_person_id END AS current_id,
        CASE WHEN from_person_id = $1 THEN 'forward' ELSE 'reverse' END AS dir,
        type,
        subtype,
        ARRAY[CASE WHEN from_person_id = $1 THEN 'forward' ELSE 'reverse' END || ':' || type] AS path,
        1 AS depth
      FROM relationships
      WHERE (from_person_id = $1 OR to_person_id = $1)
        AND status = 'approved'

      UNION ALL

      -- Recursive: traverse one more step
      SELECT
        CASE WHEN r.from_person_id = rp.current_id THEN r.to_person_id ELSE r.from_person_id END,
        CASE WHEN r.from_person_id = rp.current_id THEN 'forward' ELSE 'reverse' END,
        r.type,
        r.subtype,
        rp.path || (CASE WHEN r.from_person_id = rp.current_id THEN 'forward' ELSE 'reverse' END || ':' || r.type),
        rp.depth + 1
      FROM relationships r, rel_path rp
      WHERE (r.from_person_id = rp.current_id OR r.to_person_id = rp.current_id)
        AND r.status = 'approved'
        AND rp.depth < 6
        AND NOT (rp.path @> ARRAY[
          CASE WHEN r.from_person_id = rp.current_id THEN 'forward' ELSE 'reverse' END || ':' || r.type
        ])
    )
    SELECT path FROM rel_path WHERE current_id = $2 ORDER BY depth LIMIT 1`,
    [fromPersonId, toPersonId]
  );

  if (!result.rows.length) return 'related';

  const path = result.rows[0].path;
  return pathToLabel(path, mode);
}

/**
 * Convert a path array like ['forward:parent_of', 'forward:sibling_of'] to a human label
 * This is a simplified but practical mapping
 */
function pathToLabel(path: string[], mode: RelMode): string {
  const key = path.join('→');

  if (mode === 'international') {
    return intlLabel(path) ?? `${path.length}-step relative`;
  }
  return indianLabel(path) ?? intlLabel(path) ?? `${path.length}-step relative`;
}

function intlLabel(path: string[]): string | null {
  const k = path.join('→');
  const map: Record<string, string> = {
    'forward:parent_of': 'parent',
    'reverse:parent_of': 'child',
    'forward:spouse_of': 'spouse',
    'reverse:spouse_of': 'spouse',
    'forward:sibling_of': 'sibling',
    'reverse:sibling_of': 'sibling',
    'forward:adopted_by': 'adoptive parent',
    'reverse:adopted_by': 'adoptee',
    // 2-step
    'forward:parent_of→forward:parent_of': 'grandparent',
    'reverse:parent_of→reverse:parent_of': 'grandchild',
    'forward:parent_of→forward:sibling_of': 'aunt/uncle',
    'forward:parent_of→reverse:sibling_of': 'aunt/uncle',
    'reverse:parent_of→forward:sibling_of': 'sibling',
    'forward:parent_of→forward:spouse_of': 'parent-in-law',
    'forward:spouse_of→forward:parent_of': 'parent-in-law',
    'forward:spouse_of→reverse:parent_of': 'child-in-law',
    // 3-step
    'forward:parent_of→forward:sibling_of→reverse:parent_of': 'cousin',
    'forward:parent_of→reverse:sibling_of→reverse:parent_of': 'cousin',
    'forward:parent_of→forward:parent_of→forward:sibling_of': 'great-aunt/uncle',
    'forward:parent_of→forward:parent_of→forward:parent_of': 'great-grandparent',
    'reverse:parent_of→reverse:parent_of→reverse:parent_of': 'great-grandchild',
  };
  return map[k] ?? null;
}

function indianLabel(path: string[]): string | null {
  const k = path.join('→');
  // Indian kinship terms (gender-neutral approximations — full impl needs gender at each node)
  const map: Record<string, string> = {
    'forward:parent_of': 'mata/pita (parent)',
    'reverse:parent_of': 'beta/beti (child)',
    'forward:spouse_of': 'pati/patni (spouse)',
    'reverse:spouse_of': 'pati/patni (spouse)',
    'forward:sibling_of': 'bhai/behen (sibling)',
    'reverse:sibling_of': 'bhai/behen (sibling)',
    // 2-step
    'forward:parent_of→forward:parent_of': 'dada/dadi/nana/nani (grandparent)',
    'reverse:parent_of→reverse:parent_of': 'pota/poti/nati/natin (grandchild)',
    'forward:parent_of→forward:sibling_of': 'chacha/chachi/mama/mami/bua/mausi (parent sibling)',
    'forward:parent_of→reverse:sibling_of': 'chacha/chachi/mama/mami/bua/mausi (parent sibling)',
    'forward:parent_of→forward:spouse_of': 'sasur/saas (parent-in-law)',
    'forward:spouse_of→forward:parent_of': 'sasur/saas (parent-in-law)',
    'forward:spouse_of→reverse:parent_of': 'damaad/bahu (child-in-law)',
    // 3-step
    'forward:parent_of→forward:sibling_of→reverse:parent_of': 'cousin (chacha/mama ka beta/beti)',
    'forward:parent_of→reverse:sibling_of→reverse:parent_of': 'cousin (chacha/mama ka beta/beti)',
    'forward:parent_of→forward:parent_of→forward:parent_of': 'pardada/pardadi (great-grandparent)',
    'forward:parent_of→forward:parent_of→forward:sibling_of': 'taya/tayi/bade chacha (great-aunt/uncle)',
  };
  return map[k] ?? null;
}

export { pathToLabel };
