export interface BossConfig {
  id: string;
  name: string;
  hp: number;
  radius: number;
  speed: number;
  color: string;
  phase1Pool: string[];
  phase2Pool: string[];
  phase3Pool: string[];
  phase4Pool: string[];
}

export const BOSS_DATA: Record<string, BossConfig> = {
  overseer: {
    id: 'overseer',
    name: 'THE OVERSEER',
    hp: 4000,
    radius: 60,
    speed: 80,
    color: '#f00',
    phase1Pool: ['CHASE', 'HEAVY_SHOT', 'SPREAD', 'PREP_DASH'],
    phase2Pool: ['LASER_CAGE', 'SPIRAL', 'MINEFIELD', 'HOMING', 'BURST', 'ULT_NOVA'],
    phase3Pool: ['BLACK_HOLE', 'CROSS_STRIKE', 'PHANTOM_DASH', 'ULT_RAY', 'ULT_NUKE'],
    phase4Pool: ['COMBO_HELL', 'OMNI_LASER', 'FRENZY_DASH', 'ULT_OBLITERATION']
  }
};
