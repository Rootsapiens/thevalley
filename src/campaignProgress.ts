// Earned campaign progress is scoped to this tab. Direct chapter URLs remain previews.
import type { MaryamResume } from './npcTalk';
export const CAMPAIGN_KEY = 'ov-campaign-v1';
export type CampaignPhase = 'day1' | 'day2' | 'ch2' | 'ch3' | 'ended';
export type CampaignProgress = {
  version: 1;
  phase: CampaignPhase;
  prologueComplete: true;
  day1: { omarHeard: boolean; medicalCheckComplete: boolean; morenoHeard: boolean; maryam: MaryamResume };
  day2: { eliaPhotosHeard: boolean; omarWatcherHeard: boolean };
  ch2: { hallFootage: boolean };
};

export function newCampaignProgress(): CampaignProgress {
  return { version: 1, phase: 'day1', prologueComplete: true,
    day1: { omarHeard: false, medicalCheckComplete: false, morenoHeard: false,
      maryam: { stage: 'home', waypoint: 0, x: 74, z: 12 } },
    day2: { eliaPhotosHeard: false, omarWatcherHeard: false }, ch2: { hallFootage: false } };
}

export function readCampaignProgress(): CampaignProgress | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(CAMPAIGN_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const p = value as Partial<CampaignProgress>;
    if (p.version !== 1 || !['day1', 'day2', 'ch2', 'ch3', 'ended'].includes(p.phase ?? '') || p.prologueComplete !== true) return null;
    if (!p.day1 || !p.day2 || !p.ch2) return null;
    const bits = [p.day1.omarHeard, p.day1.medicalCheckComplete, p.day1.morenoHeard,
      p.day2.eliaPhotosHeard, p.day2.omarWatcherHeard, p.ch2.hallFootage];
    if (bits.some(bit => typeof bit !== 'boolean')) return null;
    // Older v1 records have no Maryam snapshot. Keep their earned phase and begin her Day 1 scene at home.
    if (!p.day1.maryam) p.day1.maryam = newCampaignProgress().day1.maryam;
    const m = p.day1.maryam;
    if (!['home', 'waited', 'confirmed-moving', 'square'].includes(m.stage)) return null;
    // A bad walk position is recovered on the route from its bounded waypoint, never inferred as confirmation.
    if (!Number.isInteger(m.waypoint) || m.waypoint < 0 || m.waypoint > 7) m.waypoint = 0;
    if (!Number.isFinite(m.x) || !Number.isFinite(m.z) || Math.abs(m.x) > 250 || Math.abs(m.z) > 250) {
      m.x = 74; m.z = 12;
    }
    if (p.day1.medicalCheckComplete && !p.day1.omarHeard) return null;
    if (p.day1.morenoHeard && !p.day1.medicalCheckComplete) return null;
    if (p.day2.omarWatcherHeard && !p.day2.eliaPhotosHeard) return null;
    if ((p.phase === 'day2' || p.phase === 'ch2' || p.phase === 'ch3' || p.phase === 'ended') && !p.day1.morenoHeard) return null;
    if ((p.phase === 'ch2' || p.phase === 'ch3' || p.phase === 'ended') && !p.day2.omarWatcherHeard) return null;
    if ((p.phase === 'ch3' || p.phase === 'ended') && !p.ch2.hallFootage) return null;
    return p as CampaignProgress;
  } catch { return null; }
}

export function writeCampaignProgress(progress: CampaignProgress): boolean {
  try { sessionStorage.setItem(CAMPAIGN_KEY, JSON.stringify(progress)); return true; }
  catch { return false; }
}
