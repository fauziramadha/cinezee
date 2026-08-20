/**
 * src/components/badge/avatar-ring.tsx
 * Return CSS class untuk border avatar berdasarkan badge
 */

export function getAvatarRingClass(slug: string | undefined): string {
  if (!slug) return "";
  return `cs-badge-ring-${slug}`;
}
