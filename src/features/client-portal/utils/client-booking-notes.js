export const PROJECT_TYPE_OPTIONS = Object.freeze([
  { id: 'single', label: 'Single' },
  { id: 'ep', label: 'EP' },
  { id: 'album', label: 'Album' },
  { id: 'other', label: 'Other' },
]);

export const MAX_COMPOSITE_NOTES_LENGTH = 600;

export function buildProjectMetadataPrefix({ projectType = '', trackCount = '' } = {}) {
  const parts = [];
  if (projectType) {
    const matched = PROJECT_TYPE_OPTIONS.find((item) => item.id === projectType);
    parts.push(`Project Type: ${matched ? matched.label : projectType}`);
  }
  const parsedCount = Number.parseInt(String(trackCount || ''), 10);
  if (Number.isInteger(parsedCount) && parsedCount > 0) {
    parts.push(`Tracks: ${parsedCount}`);
  }
  return parts.length > 0 ? `[${parts.join(' • ')}]` : '';
}

export function composePostProductionNotes({ projectType = '', trackCount = '', brief = '' } = {}) {
  const prefix = buildProjectMetadataPrefix({ projectType, trackCount });
  const cleanBrief = String(brief || '').trim();
  const combined = prefix && cleanBrief ? `${prefix}\n${cleanBrief}` : prefix || cleanBrief;
  return combined.slice(0, MAX_COMPOSITE_NOTES_LENGTH);
}
