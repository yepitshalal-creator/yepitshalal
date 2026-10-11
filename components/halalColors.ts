import type { HalalStatus } from '@/lib/types';

// Single source of truth for the halal-status colours, used by both
// the map pins and anywhere else that needs the raw colour (not the badge component).
export const HALAL_DOT_COLOR: Record<HalalStatus, string> = {
  fully_halal: '#1F7A45',
  halal_options: '#A8720F',
  unverified: '#6D766F',
  // Drawn hollow on the map: a ring, not a dot.
  unknown: '#8A918D',
};

// Map pins are imperative DOM, outside React, so they can't reuse HalalBadge,
// but a pin that announces only its colour is useless to a screen reader, and
// this keeps the wording identical to the badge.
export const HALAL_PIN_LABEL: Record<HalalStatus, string> = {
  fully_halal: 'Fully Halal',
  halal_options: 'Halal food available',
  unverified: 'Unverified',
  unknown: 'No halal info',
};
