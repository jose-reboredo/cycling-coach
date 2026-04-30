/**
 * @deprecated Marco's saved routes — Zürich-area, varied surfaces.
 * Used only as a DEV-mode fallback while /api/routes/saved is unavailable.
 * Production code in RoutesPicker uses the live endpoint.
 */

export type Surface = 'paved' | 'gravel' | 'mixed';

export interface MockRoute {
  id: number;
  name: string;
  distanceKm: number;
  elevationM: number;
  surface: Surface;
  starred: boolean;
  /** dominant zones the route invites — used for matching */
  zones: number[];
  blurb: string;
}

export const MOCK_ROUTES: MockRoute[] = [
  {
    id: 11,
    name: 'Albis Loop · classic',
    distanceKm: 62,
    elevationM: 1140,
    surface: 'paved',
    starred: true,
    zones: [2, 3, 4],
    blurb: 'Steady tempo with a single sustained climb over Albispass.',
  },
  {
    id: 12,
    name: 'Üetliberg + Ringlikon',
    distanceKm: 28,
    elevationM: 680,
    surface: 'paved',
    starred: true,
    zones: [3, 4, 5],
    blurb: 'Short and brutal. Drag-strip climbs, tight descents.',
  },
  {
    id: 13,
    name: 'Greifensee — easy spin',
    distanceKm: 45,
    elevationM: 220,
    surface: 'paved',
    starred: false,
    zones: [1, 2],
    blurb: 'Pancake flat lake circuit. Pure Z2 territory.',
  },
  {
    id: 14,
    name: 'Albulapass + Bergün',
    distanceKm: 105,
    elevationM: 2400,
    surface: 'paved',
    starred: true,
    zones: [2, 3, 4],
    blurb: 'A-day. 1,800 m climb, alpine descents, take a real lunch.',
  },
  {
    id: 15,
    name: 'Sihlwald gravel',
    distanceKm: 38,
    elevationM: 510,
    surface: 'gravel',
    starred: false,
    zones: [2, 3],
    blurb: 'Forest gravel. Soft underwheel, technical in the wet.',
  },
  {
    id: 16,
    name: 'Lägern ridge mixed',
    distanceKm: 56,
    elevationM: 920,
    surface: 'mixed',
    starred: false,
    zones: [2, 3, 4],
    blurb: 'Tarmac out, gravel through Lägern, tarmac home.',
  },
];
