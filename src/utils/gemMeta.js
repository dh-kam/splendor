import portraitMerchantPlayer from '../assets/images/portrait_merchant_player_1795513975972.jpg';
import portraitAiLorenzo from '../assets/images/portrait_ai_lorenzo_1795513974870.jpg';
import portraitAiBeatrice from '../assets/images/portrait_ai_beatrice_1795513975429.jpg';
import portraitAiCosimo from '../assets/images/portrait_ai_cosimo_1795513976101.jpg';
import portraitNobleEmperor from '../assets/images/portrait_noble_emperor_1795513973761.jpg';
import cardBackTier1 from '../assets/images/card_back_tier1_1795516577384.jpg';
import cardBackTier2 from '../assets/images/card_back_tier2_1795516578799.jpg';
import cardBackTier3 from '../assets/images/card_back_tier3_1795516579159.jpg';

export const GEM_META = {
  white: { label: '다이아몬드', short: '다이아', en: 'Diamond' },
  blue: { label: '사파이어', short: '사파이어', en: 'Sapphire' },
  green: { label: '에메랄드', short: '에메랄드', en: 'Emerald' },
  red: { label: '루비', short: '루비', en: 'Ruby' },
  black: { label: '오닉스', short: '오닉스', en: 'Onyx' },
  gold: { label: '황금 조커', short: '황금', en: 'Gold' },
};

// Steam Splendor exact vertical chip column order (top -> bottom)
export const STEAM_TOKEN_ORDER = ['gold', 'black', 'red', 'green', 'blue', 'white'];
export const GEM_COLORS = ['white', 'blue', 'green', 'red', 'black'];
export const ALL_GEM_COLORS = ['white', 'blue', 'green', 'red', 'black', 'gold'];

export const PORTRAITS = {
  player: portraitMerchantPlayer,
  lorenzo: portraitAiLorenzo,
  beatrice: portraitAiBeatrice,
  cosimo: portraitAiCosimo,
  emperor: portraitNobleEmperor,
  duchess: '/images/noble.jpg',
};

const PLAYER_PORTRAIT_CYCLE = [
  portraitMerchantPlayer,
  portraitAiLorenzo,
  portraitAiBeatrice,
  portraitAiCosimo,
];

const NOBLE_PORTRAIT_CYCLE = [
  '/images/noble.jpg',
  portraitNobleEmperor,
  portraitAiBeatrice,
  portraitAiCosimo,
  portraitAiLorenzo,
];

export function getPlayerPortrait(player, index = 0) {
  if (!player) return portraitMerchantPlayer;
  if (!player.isAi) return portraitMerchantPlayer;
  if (player.name?.includes('로렌초') || player.id === 'sandbox_ai1') return portraitAiLorenzo;
  if (player.name?.includes('베아트리체') || player.id === 'sandbox_ai2') return portraitAiBeatrice;
  if (player.name?.includes('코시모') || player.id === 'sandbox_ai3') return portraitAiCosimo;
  return PLAYER_PORTRAIT_CYCLE[index % PLAYER_PORTRAIT_CYCLE.length];
}

export function getNoblePortrait(noble, index = 0) {
  // Always use the noble's visible table index first so all 4-5 nobles on screen are visually distinct
  if (typeof index === 'number' && index >= 0) {
    return NOBLE_PORTRAIT_CYCLE[index % NOBLE_PORTRAIT_CYCLE.length];
  }
  const numeric = parseInt(String(noble?.id || '0').replace(/\D/g, ''), 10);
  return NOBLE_PORTRAIT_CYCLE[(Number.isFinite(numeric) ? numeric : 0) % NOBLE_PORTRAIT_CYCLE.length];
}

const CARD_ART_MAP = {
  1: {
    white: { img: '/images/mine.jpg', pos: 'center 40%' },
    blue: { img: '/images/caravan.jpg', pos: 'center 45%' },
    green: { img: '/images/mine.jpg', pos: '75% 30%' },
    red: { img: '/images/caravan.jpg', pos: '20% 50%' },
    black: { img: '/images/gem_cutter.jpg', pos: 'center 35%' },
  },
  2: {
    white: { img: '/images/ship.jpg', pos: 'center 45%' },
    blue: { img: '/images/gem_cutter.jpg', pos: 'center 35%' },
    green: { img: '/images/caravan.jpg', pos: '65% 40%' },
    red: { img: '/images/gem_cutter.jpg', pos: '25% 40%' },
    black: { img: '/images/ship.jpg', pos: '80% 45%' },
  },
  3: {
    white: { img: '/images/jewelry_shop.jpg', pos: 'center 40%' },
    blue: { img: '/images/ship.jpg', pos: '35% 35%' },
    green: { img: '/images/jewelry_shop.jpg', pos: '75% 40%' },
    red: { img: '/images/gem_cutter.jpg', pos: '60% 35%' },
    black: { img: '/images/jewelry_shop.jpg', pos: '20% 45%' },
  },
};

const CARD_TINT_MAP = {
  white: 'rgba(226, 232, 240, 0.10)',
  blue: 'rgba(30, 82, 168, 0.18)',
  green: 'rgba(18, 118, 72, 0.16)',
  red: 'rgba(168, 32, 32, 0.16)',
  black: 'rgba(54, 30, 20, 0.22)',
};

export function getCardArtStyle(card) {
  if (!card || card.id === 'secret') return undefined;
  const entry = CARD_ART_MAP[card.level]?.[card.color] || {
    img: '/images/jewelry_shop.jpg',
    pos: 'center',
  };
  const tint = CARD_TINT_MAP[card.color] || 'rgba(16, 10, 14, 0.08)';
  return {
    backgroundImage: `linear-gradient(180deg, ${tint} 20%, rgba(16, 10, 14, 0.22) 72%, rgba(12, 7, 11, 0.66) 100%), url(${entry.img})`,
    backgroundPosition: entry.pos,
  };
}

export const CARD_BACK_ART = {
  1: {
    img: cardBackTier1,
    size: '125% 121%',
    pos: 'center center',
  },
  2: {
    img: cardBackTier2,
    size: '116% 112%',
    pos: 'center center',
  },
  3: {
    img: cardBackTier3,
    size: '133% 127%',
    pos: 'center center',
  },
};

export function getCardBackStyle(tier = 1) {
  const entry = CARD_BACK_ART[tier] || CARD_BACK_ART[1];
  return {
    backgroundImage: `url(${entry.img})`,
    backgroundSize: entry.size,
    backgroundPosition: entry.pos,
    backgroundRepeat: 'no-repeat',
  };
}
