import type { BatchImpact } from "@/lib/api";

const labels = { courses: 'Course', assignments: 'Assignment', resources: 'Resource' };
function impactKey(item: BatchImpact) { return `${item.kind ?? 'courses'}:${item.id ?? item.course_id}`; }
export function mergeBatchImpacts(groups: BatchImpact[][]): BatchImpact[] {
  return [...new Map(groups.flat().map(item => [impactKey(item), item])).values()];
}
export function BatchImpactNotice({ items }: { items: BatchImpact[] }) {
  if (!items.length) return <p style={{ fontSize: 12, color: '#067a45' }}>No programme content loses edit access.</p>;
  return <div style={{ border: '1px solid #f59e0b', borderRadius: 8, padding: 12, fontSize: 13, background: 'rgba(245,158,11,0.06)' }}>
    <strong>This removes edit rights from another programme.</strong>{' '}
    Attaching these batches shares {items.length} content {items.length === 1 ? 'item' : 'items'} across programmes.
    Their owners keep ownership and lose editing:
    <ul style={{ margin: '8px 0 0 18px' }}>
      {items.map(item => <li key={impactKey(item)}>{labels[item.kind ?? 'courses']}: {item.title} <span style={{ opacity: 0.7 }}>— {item.owner_programme}</span></li>)}
    </ul>
  </div>;
}
