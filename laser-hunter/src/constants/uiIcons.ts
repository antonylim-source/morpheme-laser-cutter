import { publicAsset } from '../utils/publicAsset'

/** UI용 카툰 아이콘 PNG (이모지 대체) */
export const UI_ICONS = {
  lightning: publicAsset('images/ui/lightning.png'),
  star: publicAsset('images/ui/star.png'),
  fire: publicAsset('images/ui/fire.png'),
  explosion: publicAsset('images/ui/explosion.png'),
  monster: publicAsset('images/ui/monster.png'),
  chick: publicAsset('images/ui/chick.png'),
  target: publicAsset('images/ui/target.png'),
  rocket: publicAsset('images/ui/rocket.png'),
  hourglass: publicAsset('images/ui/hourglass.png'),
  map: publicAsset('images/ui/map.png'),
  sound: publicAsset('images/ui/sound.png'),
  mute: publicAsset('images/ui/mute.png'),
  party: publicAsset('images/ui/party.png'),
  refresh: publicAsset('images/ui/refresh.png'),
} as const
