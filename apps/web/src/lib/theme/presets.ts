import type { ThemePreset, ThemePresetId } from '@/domain/theme'
import { hexToOklch } from '@/lib/color'

// Cada preset declara as PRÓPRIAS candidatas de texto, em vez de herdarem um
// neutro comum. A tentativa de compartilhar foi feita e não serviu: o cinza
// que funciona sobre creme fica sujo sobre rosa, e o que funciona sobre rosa
// fica doce sobre preto. Texto secundário é parte do tema, não sobra dele.
export const PRESETS: Record<ThemePresetId, ThemePreset> = {
  brasa: {
    id: 'brasa',
    label: 'Brasa',
    segments: [
      'Hamburgueria', 'Churrascaria', 'Steakhouse', 'Parrilla', 'Americano',
      'Churrasco coreano', 'Fast-food', 'Food truck', 'Dark kitchen',
    ],
    displayFont: 'var(--tf-anton), sans-serif',
    textFont: 'var(--tf-inter), sans-serif',
    radius: { block: '4px', photo: '4px' },
    baseRange: { l: [0.08, 0.22], c: [0, 0.04] },
    light: {
      base: '#0d0c0b', accent: '#f0a154',
      ink: ['#12100e', '#f7f4ee'], muted: ['#4a443c', '#b8afa2'], line: ['#d9d2c8', '#241f1a'],
    },
    dark: {
      base: '#0a0908', accent: '#f0a154',
      ink: ['#12100e', '#f7f4ee'], muted: ['#4a443c', '#b8afa2'], line: ['#d9d2c8', '#201c18'],
    },
  },

  forno: {
    id: 'forno',
    label: 'Forno',
    segments: [
      'Pizzaria', 'Cantina italiana', 'Casa de massas', 'Comida mineira',
      'Comida nordestina', 'Pastelaria', 'Tapiocaria', 'Rotisserie',
      'Self-service por quilo', 'Buffet e rodízio', 'Casual dining',
      'Mexicano', 'Árabe', 'Indiano',
    ],
    displayFont: 'var(--tf-bitter), serif',
    textFont: 'var(--tf-inter), sans-serif',
    radius: { block: '8px', photo: '8px' },
    baseRange: { l: [0.9, 0.99], c: [0, 0.05] },
    light: {
      base: '#fdf6e8', accent: '#a82e1a',
      ink: ['#2e1b12', '#fdf6e8'], muted: ['#634b39', '#c9b39c'], line: ['#efe1c9', '#3a2a1e'],
    },
    dark: {
      base: '#17110d', accent: '#e0603f',
      ink: ['#2e1b12', '#fbf1e2'], muted: ['#634b39', '#bfaa97'], line: ['#efe1c9', '#2b2019'],
    },
  },

  grao: {
    id: 'grao',
    label: 'Grão',
    segments: [
      'Cafeteria', 'Padaria artesanal', 'Creperia', 'Brunch',
      'Restaurante de hotel',
    ],
    displayFont: 'var(--tf-fraunces), serif',
    textFont: 'var(--tf-inter), sans-serif',
    radius: { block: '14px', photo: '999px' },
    baseRange: { l: [0.92, 0.99], c: [0, 0.04] },
    light: {
      base: '#faf5ec', accent: '#7a5c3d',
      ink: ['#33291d', '#faf5ec'], muted: ['#5f5346', '#b9ab98'], line: ['#e8ddcb', '#39302a'],
    },
    dark: {
      base: '#17140f', accent: '#c59a6d',
      ink: ['#33291d', '#f6f1e7'], muted: ['#5f5346', '#b0a293'], line: ['#e8ddcb', '#2a2520'],
    },
  },

  sal: {
    id: 'sal',
    label: 'Sal',
    segments: [
      'Alta gastronomia', 'Bistrô francês', 'Wine bar', 'Mediterrâneo',
      'Peruano', 'Cevicheria',
    ],
    displayFont: 'var(--tf-cormorant), serif',
    textFont: 'var(--tf-inter), sans-serif',
    radius: { block: '0px', photo: '0px' },
    baseRange: { l: [0.93, 1], c: [0, 0.02] },
    light: {
      base: '#fbfbfa', accent: '#5f5d57',
      ink: ['#1e1e1c', '#fbfbfa'], muted: ['#57554f', '#a8a59e'], line: ['#eae8e3', '#2e2d2a'],
    },
    dark: {
      base: '#131312', accent: '#b5b1a8',
      ink: ['#1e1e1c', '#f2f1ee'], muted: ['#57554f', '#a4a19a'], line: ['#eae8e3', '#242321'],
    },
  },

  horta: {
    id: 'horta',
    label: 'Horta',
    segments: [
      'Açaí', 'Saladeria', 'Casa de sucos', 'Vegetariano', 'Vegano',
      'Fit e saudável', 'Sem glúten', 'Poke', 'Kosher', 'Halal',
    ],
    displayFont: 'var(--tf-outfit), sans-serif',
    textFont: 'var(--tf-outfit), sans-serif',
    radius: { block: '22px', photo: '999px' },
    baseRange: { l: [0.93, 1], c: [0, 0.05] },
    light: {
      base: '#f4faf3', accent: '#19703c',
      ink: ['#16301f', '#f4faf3'], muted: ['#42604c', '#9fbba9'], line: ['#dceadf', '#23392b'],
    },
    dark: {
      base: '#0f1a13', accent: '#4ec988',
      ink: ['#16301f', '#eef7f0'], muted: ['#42604c', '#a6bdad'], line: ['#dceadf', '#1d2c22'],
    },
  },

  neon: {
    id: 'neon',
    label: 'Neon',
    segments: ['Bar', 'Boteco', 'Pub', 'Gastrobar', 'Cachaçaria', 'Izakaya'],
    displayFont: 'var(--tf-space), sans-serif',
    textFont: 'var(--tf-space), sans-serif',
    radius: { block: '2px', photo: '2px' },
    baseRange: { l: [0.05, 0.2], c: [0, 0.06] },
    light: {
      base: '#08080c', accent: '#16e0a3',
      ink: ['#0d0d12', '#eef0f6'], muted: ['#3a3a48', '#9a9eb0'], line: ['#d5d7e0', '#191922'],
    },
    dark: {
      base: '#05050a', accent: '#16e0a3',
      ink: ['#0d0d12', '#eef0f6'], muted: ['#3a3a48', '#9a9eb0'], line: ['#d5d7e0', '#15151d'],
    },
  },

  nori: {
    id: 'nori',
    label: 'Nori',
    segments: ['Japonês', 'Chinês', 'Tailandês', 'Coreano', 'Vietnamita'],
    displayFont: 'var(--tf-zen), sans-serif',
    textFont: 'var(--tf-inter), sans-serif',
    radius: { block: '2px', photo: '2px' },
    baseRange: { l: [0.9, 0.99], c: [0, 0.03] },
    light: {
      base: '#f6f5f2', accent: '#a81f28',
      ink: ['#17171a', '#f6f5f2'], muted: ['#55554f', '#a5a5a0'], line: ['#e4e2dc', '#2b2b2e'],
    },
    dark: {
      base: '#131314', accent: '#e04a52',
      ink: ['#17171a', '#f1f0ed'], muted: ['#55554f', '#a3a39e'], line: ['#e4e2dc', '#232326'],
    },
  },

  confeito: {
    id: 'confeito',
    label: 'Confeito',
    segments: ['Doceria', 'Confeitaria', 'Sorveteria', 'Gelateria', 'Churros'],
    displayFont: 'var(--tf-quicksand), sans-serif',
    textFont: 'var(--tf-quicksand), sans-serif',
    radius: { block: '24px', photo: '18px' },
    baseRange: { l: [0.93, 1], c: [0, 0.05] },
    light: {
      base: '#fff8fa', accent: '#b02a55',
      ink: ['#3a2430', '#fff8fa'], muted: ['#6b4f5b', '#d4b2be'], line: ['#f6e2e8', '#3c2c33'],
    },
    dark: {
      base: '#171013', accent: '#f07fa4',
      ink: ['#3a2430', '#fbeef2'], muted: ['#6b4f5b', '#c2a9b2'], line: ['#f6e2e8', '#251a1f'],
    },
  },
}

// A faixa vive no preset; a checagem vive aqui, para o servidor e o seletor
// de cor terem UMA função para chamar e nenhuma chance de divergirem.
export function isBaseInRange(presetId: ThemePresetId, hex: string): boolean {
  const { baseRange } = PRESETS[presetId]
  const { l, c } = hexToOklch(hex)
  return (
    l >= baseRange.l[0] &&
    l <= baseRange.l[1] &&
    c >= baseRange.c[0] &&
    c <= baseRange.c[1]
  )
}
