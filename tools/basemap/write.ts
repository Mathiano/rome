// Writes the base map's spec and its layout guide: npm run basemap:spec
import { writeFileSync } from 'node:fs';
import { renderGuide } from './guide';
import { renderSpec } from './spec';

writeFileSync('docs/BASEMAP-V2-SPEC.md', renderSpec());
writeFileSync('docs/basemap-v2-geometry.svg', renderGuide());
console.log('wrote docs/BASEMAP-V2-SPEC.md and docs/basemap-v2-geometry.svg');
