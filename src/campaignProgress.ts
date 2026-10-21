// Earned campaign progress is scoped to this tab. Direct chapter URLs remain previews.
export const CAMPAIGN_KEY = 'ov-campaign-v1';
export type CampaignPhase = 'day1' | 'day2' | 'ch2' | 'ch3' | 'ended';
export type CampaignProgress = {
  version: 1;
  phase: CampaignPhase;
  prologueComplete: true;
  day1: { omarHeard: boolean; medicalCheckComplete: boolean; morenoHeard: boolean };
  day2: { eliaPhotosHeard: boolean; omarWatcherHeard: boolean };
  ch2: { hallFootage: boolean };
};

export function newCampaignProgress(): CampaignProgress {
  return { version: 1, phase: 'day1', prologueComplete: true,
    day1: { omarHeard: false, medicalCheckComplete: false, morenoHeard: false },
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
