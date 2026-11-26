import { secureRandomInt, type RandomInt } from './random.js';
import { ROOM_CODE_LENGTH } from '@parlor/game-types';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = ROOM_CODE_LENGTH, randomInt: RandomInt = secureRandomInt): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[randomInt(CHARS.length)];
  }
  return code;
}
