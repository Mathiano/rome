// Writes the base map's layout guide: npm run basemap:guide
import { writeFileSync } from 'node:fs';
import { renderGuide } from './guide';

writeFileSync('docs/basemap-v2-geometry.svg', renderGuide());
console.log('wrote docs/basemap-v2-geometry.svg');
