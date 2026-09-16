# Rome III

Single-player Roman colony-building game. Year 0, Germania. Real-time village economy, turn-based politics with a rival family, a tribe and Rome.

Design source of truth: `docs/DESIGN.md`. Working rules for the implementer: `CLAUDE.md`. Session capsules: `docs/CAPSULE-*.md`.

```
npm install
npm run dev        # Vite dev server
npm test           # vitest
npm run build      # typecheck + production build to dist/
npm run assets     # regenerate assets/buildings/*.svg from data/buildings.json (Python 3)
```

All balance and content lives in `data/*.json`. Game logic is in `src/`. The save is the serialised state store, kept in localStorage with export/import on the Save tab.
