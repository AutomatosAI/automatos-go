// Auto's bundled files on iOS (KS6): each state's HEVC-alpha clip, played through expo-video,
// and its still (the poster, and Reduce Motion's frame). Metro needs each require() spelled out.

import type { BundledMascot } from './bundled';

export const BUNDLED_MASCOT: BundledMascot = Object.freeze({
  clips: Object.freeze({
    hello: require('../../../assets/mascot/hello.mp4'),
    idle: require('../../../assets/mascot/idle.mp4'),
    listening: require('../../../assets/mascot/listening.mp4'),
    thinking: require('../../../assets/mascot/thinking.mp4'),
    working: require('../../../assets/mascot/working.mp4'),
    searching: require('../../../assets/mascot/searching.mp4'),
    reading: require('../../../assets/mascot/reading.mp4'),
    celebrate: require('../../../assets/mascot/celebrate.mp4'),
    oops: require('../../../assets/mascot/oops.mp4'),
    sleeping: require('../../../assets/mascot/sleeping.mp4'),
    lost: require('../../../assets/mascot/lost.mp4'),
    loading: require('../../../assets/mascot/loading.mp4'),
  }),
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
