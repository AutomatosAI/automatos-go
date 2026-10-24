# Auto's bundled files — sources

The 12 states' clips (HEVC with alpha, `hvc1`, 512 x 512, 24 fps, 5.04 s) and stills (512 x 512
RGBA PNG) that Automatos Go ships (PRD-001 §4.6, D-MASCOT, KS6). Each file is copied byte for byte
from the automatos-ai repository at commit `630fc1c85` (`630fc1c85af06c5c76e70c74e9653ee1804fdf41`)
with `git cat-file blob 630fc1c85:frontend/public/auto/<file>`: never re-encoded, never opened in
an editor. The web's `.webm` clips are not copied (the phone plays HEVC on iOS and stills on
Android). `src/styles/mascot/__tests__/assets.test.ts` holds every file to the sha256 below.

Rights: the mascot clips come from automatos-ai `frontend/public/auto/`, rights confirmed
20 Oct 2026 (PRD-001 §8, 'Fonts and media').

| File | Source @ 630fc1c85 | sha256 | Bytes |
| --- | --- | --- | --- |
| hello.mp4 | frontend/public/auto/hello.mp4 | 7c1d432cd2acf76dbf33255513a0fcb2d4f60e083d826bf69bc9eaa9b2dc9d66 | 130358 |
| hello.png | frontend/public/auto/hello.png | a5b209ee5f967816e27ee3701082e856e45cb3dc4d3aa12bcb5c18673e48d52a | 97654 |
| idle.mp4 | frontend/public/auto/idle.mp4 | bfe423e3b9f87c8f97367fb28d634abc966fa5759b3d7aaba01c906f815c2629 | 155792 |
| idle.png | frontend/public/auto/idle.png | 7acc84e05ca2e8162549727028222f28c113e125889b0cdc120af447d5159136 | 97637 |
| listening.mp4 | frontend/public/auto/listening.mp4 | 1c646f1b849b66b0a5c6c2e85ec2960add52291cc08353939d279d17a5528372 | 111424 |
| listening.png | frontend/public/auto/listening.png | 96a83254d8934178435bae7ac53f971447aa334ed2e4db810a7a6e1899828ae0 | 97881 |
| thinking.mp4 | frontend/public/auto/thinking.mp4 | 6063bce593cae44f8fc3687828f1aea72a306b3c0cce647555702e2ca790bfe2 | 115250 |
| thinking.png | frontend/public/auto/thinking.png | 349dd919fa8c297b440b458be91520829ee3bef4afefa32201a32db5e0a083f7 | 97727 |
| working.mp4 | frontend/public/auto/working.mp4 | a115fb4321c255b6c6c00c028405b211c1f141851430265053a85700ccf30bee | 222932 |
| working.png | frontend/public/auto/working.png | 6f0ded732a22c039b3173a856c1d589f0f1d786121f1961d88dbddd953e2a57f | 99246 |
| searching.mp4 | frontend/public/auto/searching.mp4 | d7e05fbb81e79bcab18dfc4d1ec4ddce195f81a49db660004c6fd303156cec46 | 182668 |
| searching.png | frontend/public/auto/searching.png | a8f7c97a100f91f86d9641a2ce0b89ee8d13c8b1207a7c22d59c4be4c2d73a8d | 97697 |
| reading.mp4 | frontend/public/auto/reading.mp4 | 600f7a5adc56151da2a0cd674395f6a5333a67124d6c1b2f6ecef3f995f0a0db | 111086 |
| reading.png | frontend/public/auto/reading.png | 27cfd175ad8a20232f1e82065ae72aa344754976d3a40b75c2accc770be71770 | 97923 |
| celebrate.mp4 | frontend/public/auto/celebrate.mp4 | 5972c0c7f7c0f28337dab8d7646da22f09fcf2fac7c9dcdb021dec1ab1f7f9cf | 277691 |
| celebrate.png | frontend/public/auto/celebrate.png | a750be0966ba718db6cb36870cc40553fabd706954e851ba3205007fa026c21d | 97997 |
| oops.mp4 | frontend/public/auto/oops.mp4 | 38f478f5370ff29da4e63a2cc608bf17d9310bee692dd089abc712788e6acf49 | 117228 |
| oops.png | frontend/public/auto/oops.png | 5db546668b0a91e26196dbc4d608c4330fa14378633c881e30e4e64167edb46d | 97738 |
| sleeping.mp4 | frontend/public/auto/sleeping.mp4 | fc3743cc778df27178c2b901065ea05af8abc45b85e3c3b48c61981e3a0798f0 | 104174 |
| sleeping.png | frontend/public/auto/sleeping.png | 55178a8f85bc62269fd74410ab2986322292ff9525cc7b883c56e64458c1a96d | 97773 |
| lost.mp4 | frontend/public/auto/lost.mp4 | f8ed9af30e88ba3faa4bee795f11e4f530e9ded4e8d796c14c09e39bf8f2bc93 | 182593 |
| lost.png | frontend/public/auto/lost.png | 15012fee0ce873c1e0f21d686214c645da5265ecb79bf05cdeb9dd46ffcd4b26 | 97819 |
| loading.mp4 | frontend/public/auto/loading.mp4 | 93af5a55cd92dc7232a813b1a5060173c7b574821aa50c2da2a7e283e8615a79 | 259823 |
| loading.png | frontend/public/auto/loading.png | 48f1aead8fee117d341783edc8aa782e2af95d3ecc4188bca53fcee584f519a0 | 97699 |
