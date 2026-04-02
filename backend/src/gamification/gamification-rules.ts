
export const POINT_RULES = {
  /** Publier une annonce de don (gratuit, statut publié) */
  GIVE_LISTING: 5,
  /** Confirmer la remise / passage à « confirmé par le donneur » */
  CONFIRM_DONATION: 10,
  /** Clôture transaction don gratuit : donneur / accepteur */
  DONOR_ON_COMPLETE: 20,
  RECEIVER_ON_COMPLETE_FREE: 10,
  /** Clôture vente payante : vendeur / acheteur */
  SELL_ON_COMPLETE: 15,
  BUY_ON_COMPLETE: 15,
} as const;

export type PointActionCode = keyof typeof POINT_RULES;
