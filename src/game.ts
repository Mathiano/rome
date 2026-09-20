// Player-facing actions. Village actions are real-time; political actions
// trigger a round (DESIGN §3.2). Every action mutates the state in place and
// the caller persists afterwards.
import type { GameState } from './state/types';
import { createInitialState } from './state/store';
import { tick } from './village/clock';
import { startBuild, rush } from './village/construction';
import { rushResearch, startResearch } from './village/research';
import { appoint, appointLesser, dismiss, dismissLesser } from './politics/posts';
import { assassinate, bribe, denounce, exile, expose, marry, marryTribe, seekRomeBacking, setBodyguards } from './politics/intrigue';
import { playerCallChallenge } from './politics/challenge';
import { runRound } from './politics/rounds';
import { dispatchEnvoy, trade } from './tribes/envoys';
import { appease } from './tribes/turn';
import { acceptDemand, refuseDemand } from './politics/families';
import { resolveChoice } from './politics/events';
import { claimSite, dispatchScout, releaseSite, setGarrison } from './map/sites';
import { spareMilitia } from './combat/militia';
import { deliver, sendRecruits, hostOfficial, decline } from './rome/requests';

export type Political =
  | { type: 'appoint'; postId: string; characterId: string }
  | { type: 'dismiss'; postId: string }
  | { type: 'appoint_lesser'; postId: string; characterId: string }
  | { type: 'dismiss_lesser'; postId: string }
  | { type: 'bribe'; familyId: string }
  | { type: 'rome_backing' }
  | { type: 'rome_deliver' }
  | { type: 'rome_recruits' }
  | { type: 'rome_host' }
  | { type: 'rome_decline' }
  | { type: 'accept_demand'; familyId: string }
  | { type: 'refuse_demand'; familyId: string }
  | { type: 'appease'; tribeId: string }
  | { type: 'claim'; hex: string }
  | { type: 'release'; hex: string }
  | { type: 'garrison'; hex: string; men: number }
  | { type: 'call_challenge' }
  | { type: 'expose'; familyId: string }
  | { type: 'denounce'; familyId: string }
  | { type: 'exile'; characterId: string }
  | { type: 'marry'; aId: string; bId: string }
  | { type: 'marry_tribe'; characterId: string; tribeId: string }
  | { type: 'assassinate'; targetId: string }
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
  /** Research is village business: real time, no round (DESIGN §3.1, §4.6). */
  research(id: string, now = Date.now()): void {
    this.tick(now);
    startResearch(this.state, id, now);
  }
  rushResearch(id: string, now = Date.now()): void {
    this.tick(now);
    rushResearch(this.state, id, now);
  }
  trade(tribeId: string, amount: number, now = Date.now()): void {
    this.tick(now);
    trade(this.state, tribeId, amount);
  }
  /** Answering an event is not a move against anyone: no round runs. */
  choose(choiceId: string, now = Date.now()): void {
    this.tick(now);
    resolveChoice(this.state, choiceId);
  }
  // --- preparation (no round) ---
  dispatchEnvoy(tribeId: string, envoyId: string, now = Date.now()): void {
    this.tick(now);
    dispatchEnvoy(this.state, tribeId, envoyId);
  }
  /** Scouts are prepared like an envoy and report at the next round. */
  scout(hex: string, now = Date.now()): void {
    this.tick(now);
    dispatchScout(this.state, hex);
  }
  /**
   * Standing men over your own kin is household business, not a move against
   * another actor, so it runs no round (DESIGN §3.2). The cost is real all the
   * same: every guard is a man off the walls.
   */
  guards(characterId: string, men: number, now = Date.now()): void {
    this.tick(now);
    setBodyguards(this.state, characterId, men, spareMilitia(this.state));
  }
  // --- politics (each runs a round) ---
  act(a: Political, now = Date.now()): void {
    this.tick(now);
    const s = this.state;
    switch (a.type) {
      case 'appoint': appoint(s, a.postId, a.characterId); break;
      case 'dismiss': dismiss(s, a.postId); break;
      case 'appoint_lesser': appointLesser(s, a.postId, a.characterId); break;
      case 'dismiss_lesser': dismissLesser(s, a.postId); break;
      case 'bribe': bribe(s, a.familyId); break;
      case 'rome_backing': seekRomeBacking(s); break;
      case 'rome_deliver': deliver(s); break;
      case 'rome_recruits': sendRecruits(s); break;
      case 'rome_host': hostOfficial(s); break;
      case 'rome_decline': decline(s); break;
      case 'accept_demand': acceptDemand(s, a.familyId); break;
      case 'refuse_demand': refuseDemand(s, a.familyId); break;
      case 'appease': appease(s, a.tribeId); break;
      case 'claim': claimSite(s, a.hex); break;
      case 'release': releaseSite(s, a.hex); break;
      case 'garrison': setGarrison(s, a.hex, a.men, spareMilitia(s)); break;
      case 'call_challenge': playerCallChallenge(s); break;
      case 'expose': expose(s, a.familyId); break;
      case 'denounce': denounce(s, a.familyId); break;
      case 'exile': exile(s, a.characterId); break;
      case 'marry': marry(s, a.aId, a.bId); break;
      case 'marry_tribe': marryTribe(s, a.characterId, a.tribeId); break;
      case 'assassinate': assassinate(s, a.targetId); break;
      case 'convene': break;
    }
    runRound(s, now);
  }
}
