// Auto's bundled files on Android (KS6, D-MASCOT): the stills only. Android shows Auto as a still
// in every state, so its bundle carries none of the clips. Metro needs each require() spelled out.

import type { BundledMascot } from './bundled';

export const BUNDLED_MASCOT: BundledMascot = Object.freeze({
  clips: null,
  stills: Object.freeze({
    hello: require('../../../assets/mascot/hello.png'),
    idle: require('../../../assets/mascot/idle.png'),
    listening: require('../../../assets/mascot/listening.png'),
    thinking: require('../../../assets/mascot/thinking.png'),
    working: require('../../../assets/mascot/working.png'),
    searching: require('../../../assets/mascot/searching.png'),
    reading: require('../../../assets/mascot/reading.png'),
    celebrate: require('../../../assets/mascot/celebrate.png'),
    oops: require('../../../assets/mascot/oops.png'),
    sleeping: require('../../../assets/mascot/sleeping.png'),
    lost: require('../../../assets/mascot/lost.png'),
    loading: require('../../../assets/mascot/loading.png'),
  }),
});
