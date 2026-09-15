// Player-facing actions. Village actions are real-time; political actions
// trigger a round (DESIGN §3.2). Every action mutates the state in place and
// the caller persists afterwards.
import type { GameState } from './state/types';
import { createInitialState } from './state/store';
import { tick } from './village/clock';
import { startBuild, rush } from './village/construction';
import { appoint, dismiss } from './politics/posts';
import { bribe, seekRomeBacking } from './politics/intrigue';
import { runRound } from './politics/rounds';
import { dispatchEnvoy, trade } from './tribes/envoys';
import { deliver, sendRecruits, hostOfficial, decline } from './rome/requests';

export type Political =
  | { type: 'appoint'; postId: string; characterId: string }
  | { type: 'dismiss'; postId: string }
  | { type: 'bribe'; familyId: string }
  | { type: 'rome_backing' }
  | { type: 'rome_deliver' }
  | { type: 'rome_recruits' }
  | { type: 'rome_host' }
  | { type: 'rome_decline' }
  | { type: 'convene' };

export class Game {
  state: GameState;
  constructor(state?: GameState) {
    this.state = state ?? createInitialState();
  }
  tick(now = Date.now()): void {
    tick(this.state, now);
  }
  // --- village (real time) ---
  build(slotId: string, buildingId: string, now = Date.now()): void {
    this.tick(now);
    startBuild(this.state, slotId, buildingId, now);
  }
  rush(slotId: string, now = Date.now()): void {
    this.tick(now);
    rush(this.state, slotId, now);
  }
  trade(amount: number, now = Date.now()): void {
    this.tick(now);
    trade(this.state, amount);
  }
  // --- preparation (no round) ---
  dispatchEnvoy(envoyId: string, now = Date.now()): void {
    this.tick(now);
    dispatchEnvoy(this.state, envoyId);
  }
  // --- politics (each runs a round) ---
  act(a: Political, now = Date.now()): void {
    this.tick(now);
    const s = this.state;
    switch (a.type) {
      case 'appoint': appoint(s, a.postId, a.characterId); break;
      case 'dismiss': dismiss(s, a.postId); break;
      case 'bribe': bribe(s, a.familyId); break;
      case 'rome_backing': seekRomeBacking(s); break;
      case 'rome_deliver': deliver(s); break;
      case 'rome_recruits': sendRecruits(s); break;
      case 'rome_host': hostOfficial(s); break;
      case 'rome_decline': decline(s); break;
      case 'convene': break;
    }
    runRound(s, now);
  }
}
