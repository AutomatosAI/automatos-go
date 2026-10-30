// What the design kit's boot/prepaint.json paints for Candy, copied for the tests: Studio's tokens
// for each palette as the kit writes them ('H S% L%' triplets, some in hsl()), the card gradients'
// stops, --candy-g1a … --candy-g3c, for Mixed and One colour cards, the band's stops for each
// Gradient, the card layers' values and each Roundness key's corners. The phone paints the same
// from tokens/candy.ts and candy-paint.ts; candy.test.ts and candy-paint.test.ts hold them equal.
//
// Source: AutomatosAI/automatos-design-kit themes/candy/boot/prepaint.json at 3920359d5
// (3920359d5350960471aca1b7111f6243be537cc0), sha256
// 0e4be0b4c2ae5c1d6816bc5bb98dd242fc9a3c743be6526522d012db63ee91c5. Copied, never retuned.

import type { PaletteId } from '../candy-catalogue';

/** knobs.palette.<id>: every key that is not one of Candy's own (--candy-*). */
export const PREPAINT_STUDIO: Readonly<Record<PaletteId, Readonly<Record<string, string>>>> = {
  blush: {
    '--background': '338.18 57.89% 96.27%',
    '--foreground': '285 33.33% 14.12%',
    '--background-gradient-from': '338.18 57.89% 96.27%',
    '--background-gradient-to': '338.18 57.89% 96.27%',
    '--card': '0 0% 100%',
    '--card-foreground': '285 33.33% 14.12%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '285 33.33% 14.12%',
    '--secondary': '333 76.92% 94.9%',
    '--secondary-foreground': '285 33.33% 14.12%',
    '--muted': '333 76.92% 94.9%',
    '--muted-foreground': '295.38 13.13% 38.82%',
    '--primary': '333.08 67.24% 45.49%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '333.08 67.24% 45.49%',
    '--accent': '333 76.92% 94.9%',
    '--accent-foreground': '285 33.33% 14.12%',
    '--destructive': '353.08 68.42% 44.71%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '300 5% 92.16%',
    '--input': '300 5% 92.16%',
    '--glass-border-hover': '300 5% 92.16%',
    '--cc-hover': '333 76.92% 94.9%',
    '--cc-hover-border': '300 5% 92.16%',
    '--paper': 'hsl(0 0% 100%)',
    '--bg-1': 'hsl(338.18 57.89% 96.27%)',
    '--bg-2': 'hsl(0 0% 100%)',
    '--fg': 'hsl(285 33.33% 14.12%)',
    '--fg-2': 'hsl(295.38 13.13% 38.82%)',
    '--fg-3': 'hsl(295.38 13.13% 38.82%)',
    '--border-2': 'hsl(295.38 13.13% 38.82%)',
  },
  lilac: {
    '--background': '248.57 100% 97.25%',
    '--foreground': '246.67 40.91% 17.25%',
    '--background-gradient-from': '248.57 100% 97.25%',
    '--background-gradient-to': '248.57 100% 97.25%',
    '--card': '0 0% 100%',
    '--card-foreground': '246.67 40.91% 17.25%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '246.67 40.91% 17.25%',
    '--secondary': '251.43 100% 95.88%',
    '--secondary-foreground': '246.67 40.91% 17.25%',
    '--muted': '251.43 100% 95.88%',
    '--muted-foreground': '247.14 19.63% 41.96%',
    '--primary': '254.25 65.57% 52.16%',
    '--primary-foreground': '0 0% 100%',
    '--ring': '254.25 65.57% 52.16%',
    '--accent': '251.43 100% 95.88%',
    '--accent-foreground': '246.67 40.91% 17.25%',
    '--destructive': '353.08 68.42% 44.71%',
    '--destructive-foreground': '0 0% 100%',
    '--border': '270 10.53% 92.55%',
    '--input': '270 10.53% 92.55%',
    '--glass-border-hover': '270 10.53% 92.55%',
    '--cc-hover': '251.43 100% 95.88%',
    '--cc-hover-border': '270 10.53% 92.55%',
    '--paper': 'hsl(0 0% 100%)',
    '--bg-1': 'hsl(248.57 100% 97.25%)',
    '--bg-2': 'hsl(0 0% 100%)',
    '--fg': 'hsl(246.67 40.91% 17.25%)',
    '--fg-2': 'hsl(247.14 19.63% 41.96%)',
    '--fg-3': 'hsl(247.14 19.63% 41.96%)',
    '--border-2': 'hsl(247.14 19.63% 41.96%)',
  },
  nightbloom: {
    '--background': '270 47.62% 8.24%',
    '--foreground': '305 60% 96.08%',
    '--background-gradient-from': '270 47.62% 8.24%',
    '--background-gradient-to': '270 47.62% 8.24%',
    '--card': '271.11 40.3% 13.14%',
    '--card-foreground': '305 60% 96.08%',
    '--popover': '271.11 40.3% 13.14%',
    '--popover-foreground': '305 60% 96.08%',
    '--secondary': '279.38 33.33% 18.82%',
    '--secondary-foreground': '305 60% 96.08%',
    '--muted': '279.38 33.33% 18.82%',
    '--muted-foreground': '287.27 27.73% 76.67%',
    '--primary': '330.83 100% 71.76%',
    '--primary-foreground': '330 75% 9.41%',
    '--ring': '330.83 100% 71.76%',
    '--accent': '279.38 33.33% 18.82%',
    '--accent-foreground': '305 60% 96.08%',
    '--destructive': '353.68 100% 73.92%',
    '--destructive-foreground': '330 75% 9.41%',
    '--border': '270 21.43% 21.96%',
    '--input': '270 21.43% 21.96%',
    '--glass-border-hover': '270 21.43% 21.96%',
    '--cc-hover': '279.38 33.33% 18.82%',
    '--cc-hover-border': '270 21.43% 21.96%',
    '--paper': 'hsl(271.11 40.3% 13.14%)',
    '--bg-1': 'hsl(270 47.62% 8.24%)',
    '--bg-2': 'hsl(271.11 40.3% 13.14%)',
    '--fg': 'hsl(305 60% 96.08%)',
    '--fg-2': 'hsl(287.27 27.73% 76.67%)',
    '--fg-3': 'hsl(287.27 27.73% 76.67%)',
    '--border-2': 'hsl(287.27 27.73% 76.67%)',
  },
};

/** pairs[0] (palette × cards): --candy-g1a, g1b, g1c, g2a … g3c in that order. */
export const PREPAINT_CARDS: Readonly<
  Record<PaletteId, Readonly<Record<'mix' | 'single', readonly string[]>>>
> = {
  blush: {
    mix: [
      '#D73178',
      '#B01E5F',
      '#9C3BD0',
      '#8E4AE8',
      '#5B2BCB',
      '#3557D8',
      '#2675D3',
      '#0F5DAE',
      '#0B8FB0',
    ],
    single: [
      '#D73178',
      '#B01E5F',
      '#9C3BD0',
      '#D73178',
      '#B01E5F',
      '#9C3BD0',
      '#D73178',
      '#B01E5F',
      '#9C3BD0',
    ],
  },
  lilac: {
    mix: [
      '#8E4AE8',
      '#5B2BCB',
      '#3557D8',
      '#2675D3',
      '#0F5DAE',
      '#0B8FB0',
      '#D73178',
      '#B01E5F',
      '#9C3BD0',
    ],
    single: [
      '#8E4AE8',
      '#5B2BCB',
      '#3557D8',
      '#8E4AE8',
      '#5B2BCB',
      '#3557D8',
      '#8E4AE8',
      '#5B2BCB',
      '#3557D8',
    ],
  },
  nightbloom: {
    mix: [
      '#D73178',
      '#B01E5F',
      '#9C3BD0',
      '#8E4AE8',
      '#5B2BCB',
      '#3557D8',
      '#2675D3',
      '#0F5DAE',
      '#0B8FB0',
    ],
    single: [
      '#D73178',
      '#B01E5F',
      '#9C3BD0',
      '#D73178',
      '#B01E5F',
      '#9C3BD0',
      '#D73178',
      '#B01E5F',
      '#9C3BD0',
    ],
  },
};

type BandValues = {
  readonly angle: string;
  readonly from: string;
  readonly via: string;
  readonly viaAt: string;
  readonly to: string;
};

/** pairs[1] (palette × gradient): --candy-band-angle, -from, -via, -via-at and -to. */
export const PREPAINT_BANDS: Readonly<
  Record<PaletteId, Readonly<Record<'soft' | 'rich' | 'vivid', BandValues>>>
> = {
  blush: {
    soft: { angle: '160deg', from: '#FFD9E8', via: '#FFC2DA', viaAt: '100%', to: '#FFC2DA' },
    rich: { angle: '120deg', from: '#FFC6E0', via: '#F2C9FF', viaAt: '52%', to: '#FFD9C2' },
    vivid: { angle: '120deg', from: '#FFC6E0', via: '#F2C9FF', viaAt: '52%', to: '#FFD9C2' },
  },
  lilac: {
    soft: { angle: '160deg', from: '#E2DCFF', via: '#D3E3FF', viaAt: '100%', to: '#D3E3FF' },
    rich: { angle: '120deg', from: '#D9CCFF', via: '#C9DBFF', viaAt: '52%', to: '#F6D2F0' },
    vivid: { angle: '120deg', from: '#D9CCFF', via: '#C9DBFF', viaAt: '52%', to: '#F6D2F0' },
  },
  nightbloom: {
    soft: { angle: '160deg', from: '#43123F', via: '#2A1250', viaAt: '100%', to: '#2A1250' },
    rich: { angle: '120deg', from: '#5A1450', via: '#3A1670', viaAt: '52%', to: '#16335E' },
    vivid: { angle: '120deg', from: '#5A1450', via: '#3A1670', viaAt: '52%', to: '#16335E' },
  },
};

/** knobs.gradient: the card's layers for each Gradient choice. */
export const PREPAINT_LAYERS: Readonly<
  Record<'soft' | 'rich' | 'vivid', Readonly<Record<string, string>>>
> = {
  soft: {
    '--candy-hi-x': '88%',
    '--candy-hi-y': '8%',
    '--candy-hi-colour': 'rgba(255,255,255,.34)',
    '--candy-hi-reach': '46%',
    '--candy-glow-pink': 'transparent',
    '--candy-glow-cyan': 'transparent',
    '--candy-card-mid': '100%',
  },
  rich: {
    '--candy-hi-x': '88%',
    '--candy-hi-y': '8%',
    '--candy-hi-colour': 'rgba(255,255,255,.34)',
    '--candy-hi-reach': '46%',
    '--candy-glow-pink': 'transparent',
    '--candy-glow-cyan': 'transparent',
    '--candy-card-mid': '55%',
  },
  vivid: {
    '--candy-hi-x': '92%',
    '--candy-hi-y': '0%',
    '--candy-hi-colour': 'rgba(255,255,255,.5)',
    '--candy-hi-reach': '50%',
    '--candy-glow-pink': 'rgba(255,170,210,.4)',
    '--candy-glow-cyan': 'rgba(90,230,255,.35)',
    '--candy-card-mid': '55%',
  },
};

/** knobs.roundness: each key's --candy-r and --candy-rs, in px. */
export const PREPAINT_ROUNDNESS: Readonly<Record<string, readonly [string, string]>> = {
  '16': ['16px', '12px'],
  '17': ['17px', '12px'],
  '18': ['18px', '13px'],
  '19': ['19px', '14px'],
  '20': ['20px', '14px'],
  '21': ['21px', '15px'],
  '22': ['22px', '16px'],
  '23': ['23px', '17px'],
  '24': ['24px', '17px'],
  '25': ['25px', '18px'],
  '26': ['26px', '19px'],
  '27': ['27px', '19px'],
  '28': ['28px', '20px'],
  '29': ['29px', '21px'],
  '30': ['30px', '22px'],
  '31': ['31px', '22px'],
  '32': ['32px', '23px'],
  '33': ['33px', '24px'],
  '34': ['34px', '24px'],
  '35': ['35px', '25px'],
  '36': ['36px', '26px'],
  '37': ['37px', '27px'],
  '38': ['38px', '27px'],
  '39': ['39px', '28px'],
  '40': ['40px', '29px'],
};
