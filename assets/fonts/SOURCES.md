# Font sources

The ten families every style uses, as static TTF instances embedded by the `expo-font`
config plugin (PRD-001 §4.6, D57, K6; Press Start 2P and Pixelify Sans for Arcade, D-ARC-4).
All ten are licensed under the SIL Open Font License 1.1; each family directory carries its
licence file. No font is fetched at runtime.

Each file is named after its PostScript name (nameID 6): iOS finds an embedded font by its
PostScript name and Android by its file name in `assets/fonts/`, so one `fontFamily` string
(`src/styles/fonts.ts`) works on both. The PostScript names are the sources' own, kept as they
are (the fontsource builds in automatos-ai name Newsreader `Newsreader16pt16pt-*`).
`src/styles/__tests__/fonts.test.ts` checks every file against the map.

## How the files were produced

- **automatos-ai** — `frontend/app/fonts/{core,play}` at
  `630fc1c85af06c5c76e70c74e9653ee1804fdf41` (each source's git blob matches that commit).
  The woff2 sources were copied into an empty work directory and converted there with
  fontTools 4.67.0, run through `uvx` (nothing installed). `SOURCE_DATE_EPOCH=1792520117`
  (the commit time of 630fc1c85, 2026-10-20T18:15:17Z) pins `head.modified`, so re-running
  the commands below reproduces these bytes. Licences are copied byte for byte.
- **google/fonts** — `ofl/rajdhani` and `ofl/chakrapetch` at
  `47d54ca1ebb14fd864695f1d39dc734f39017c33`, downloaded unchanged (each file's git blob
  matches that commit). Rajdhani 500/600/700 and Chakra Petch 500/600 are the weights
  `Automatos Command HUD.dc.html` loads and its font presets use.
- **google/fonts** — `ofl/pressstart2p` at `dbd72d6ef9ebea750d33c02c7189633e972d6a40`,
  downloaded unchanged (each file's git blob matches that commit). The TTF is the same bytes
  as the design kit's `themes/arcade/assets/fonts/mobile/press-start-2p-regular.ttf` at
  `034fa629c8ba79cff042559ca2d132f6d38f6d23` (AutomatosAI/automatos-design-kit).
- **eifetx/Pixelify-Sans** — the family's upstream repository at
  `39df74aba80df8157546034b878e8be1eb565ced`: the static instances in `fonts/ttf/` and the root
  `OFL.txt`, downloaded unchanged (each file's git blob matches that commit). Arcade sets its
  running text at 400 and 600 (the design kit's two Pixelify faces); the kit's phone file is the
  variable font, which the app does not bundle (static faces only, K6).

Every output was copied into `assets/fonts/<family>/` with `cp`. In the commands below:

```sh
export SOURCE_DATE_EPOCH=1792520117
FT="uvx --from fonttools[woff]==4.67.0 fonttools"
GF=https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl
PS=https://raw.githubusercontent.com/google/fonts/dbd72d6ef9ebea750d33c02c7189633e972d6a40/ofl/pressstart2p
PX=https://raw.githubusercontent.com/eifetx/Pixelify-Sans/39df74aba80df8157546034b878e8be1eb565ced
```

## Geist — `geist/`

Source `frontend/app/fonts/core/geist-latin-wght-normal.woff2` (variable, wght 100–900),
sha256 `19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1`, decompressed
once with `$FT ttLib.woff2 decompress geist-latin-wght-normal.woff2 -o geist-latin-wght-normal.ttf`,
then cut per weight:

| File                 | Command                                                                                               | sha256                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Geist-Regular.ttf`  | `$FT varLib.instancer geist-latin-wght-normal.ttf wght=400 --update-name-table -o Geist-Regular.ttf`  | `053bd1f390bc9d8a959044aba1992c5daf319ab97b8a20cadb27b8f5489860de` |
| `Geist-Medium.ttf`   | `$FT varLib.instancer geist-latin-wght-normal.ttf wght=500 --update-name-table -o Geist-Medium.ttf`   | `e2c5d343893d89fbced5d15f0b85655e1564dd563b9a3557bb9b82a2bb1db887` |
| `Geist-SemiBold.ttf` | `$FT varLib.instancer geist-latin-wght-normal.ttf wght=600 --update-name-table -o Geist-SemiBold.ttf` | `6c057f36c476065f1aee0f9cfe155a69e0f6d52e9df69930c25b443ffce3330d` |
| `LICENSE-geist.txt`  | `cp frontend/app/fonts/core/LICENSE-geist.txt` (source sha256 identical)                              | `71609cbb5c78b5870d712eab73a31d76622635c6ed034ab5cee3b9ecbda8685f` |

## Geist Mono — `geist-mono/`

Source `frontend/app/fonts/core/geist-mono-latin-wght-normal.woff2` (variable, wght 100–900),
sha256 `684ad5b531f81d43c1e8c7038262d5db7cdc1f68006e04d6c7769efa8d33c8cc`, decompressed
once with `$FT ttLib.woff2 decompress geist-mono-latin-wght-normal.woff2 -o geist-mono-latin-wght-normal.ttf`,
then cut per weight:

| File                     | Command                                                                                                        | sha256                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `GeistMono-Regular.ttf`  | `$FT varLib.instancer geist-mono-latin-wght-normal.ttf wght=400 --update-name-table -o GeistMono-Regular.ttf`  | `056aa0dcfb4a93e7008fe8611be830b968a0d6e88a1b7f3ce94605f939decdd4` |
| `GeistMono-Medium.ttf`   | `$FT varLib.instancer geist-mono-latin-wght-normal.ttf wght=500 --update-name-table -o GeistMono-Medium.ttf`   | `25431c1e279e9859a7c9be09bd0e9c3722da347fff030230db03e6e01e89e2ff` |
| `GeistMono-SemiBold.ttf` | `$FT varLib.instancer geist-mono-latin-wght-normal.ttf wght=600 --update-name-table -o GeistMono-SemiBold.ttf` | `e2f89573a68157fdb8672609f1bed9e20b47919b7f52ef42cefebd556e285cc9` |
| `LICENSE-geist-mono.txt` | `cp frontend/app/fonts/core/LICENSE-geist-mono.txt` (source sha256 identical)                                  | `cc815ed4fc045f0e991abb10395b7932bd028c6a067deb13316d6002105074e6` |

## Newsreader — `newsreader/`

Static woff2 sources in `frontend/app/fonts/core/`, one per face. The source's 600 italic is
not shipped: no style uses it.

| File                                  | Source (sha256)                                                                                          | Command                                                                                               | sha256                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Newsreader16pt16pt-Regular.ttf`      | `newsreader-latin-400-normal.woff2` (`e66067814f1c672d33a457e4f4d102c818b481420e2234cf685ebdbf2f443904`) | `$FT ttLib.woff2 decompress newsreader-latin-400-normal.woff2 -o Newsreader16pt16pt-Regular.ttf`      | `5b5e087a712a123675b7bf050af200021fc080bcb47997b717e83a2749608ea4` |
| `Newsreader16pt16pt-Medium.ttf`       | `newsreader-latin-500-normal.woff2` (`5613e2fc8377392c02e8ac9d55014689fb5320a5f2a7be55e8088a314728ac2c`) | `$FT ttLib.woff2 decompress newsreader-latin-500-normal.woff2 -o Newsreader16pt16pt-Medium.ttf`       | `2bd7da9844e3d3535e11802f165709dd90b0122b174c15034776c8935a2fd65d` |
| `Newsreader16pt16pt-SemiBold.ttf`     | `newsreader-latin-600-normal.woff2` (`05c91a26d19a61eafe7ce8e0b77eff3fd279ce994dc89f432f4cd06784935e84`) | `$FT ttLib.woff2 decompress newsreader-latin-600-normal.woff2 -o Newsreader16pt16pt-SemiBold.ttf`     | `19af0d9ee59f96c26082cf17f7f188552805eeef358e506d13b1a6af91ae07d4` |
| `Newsreader16pt16pt-Italic.ttf`       | `newsreader-latin-400-italic.woff2` (`fa9b900403949d9a723106752a5c8ad2797012a0c9057427b1da2db72d552148`) | `$FT ttLib.woff2 decompress newsreader-latin-400-italic.woff2 -o Newsreader16pt16pt-Italic.ttf`       | `4d3c989a963582b09d1512639fbef6036a50e4f920ada3d15a7a20e402e38b21` |
| `Newsreader16pt16pt-MediumItalic.ttf` | `newsreader-latin-500-italic.woff2` (`3d184d574e56fcb42f4c1920d4130db872ec0af6de9a0ad0f9e850444be44b7d`) | `$FT ttLib.woff2 decompress newsreader-latin-500-italic.woff2 -o Newsreader16pt16pt-MediumItalic.ttf` | `926c2f2848b44c62fe424a7484113b3f95bacdd6e80afe61bb3470d8d3349c93` |
| `LICENSE-newsreader.txt`              | `LICENSE-newsreader.txt` (`26028ec4e13b650065fa525a09532176f8a668b76ff849ea01c564a7480f91e7`)            | `cp frontend/app/fonts/core/LICENSE-newsreader.txt`                                                   | `26028ec4e13b650065fa525a09532176f8a668b76ff849ea01c564a7480f91e7` |

## Instrument Serif — `instrument-serif/`

| File                           | Source in `frontend/app/fonts/play/` (sha256)                                                                  | Command                                                                                             | sha256                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `InstrumentSerif-Regular.ttf`  | `instrument-serif-latin-400-normal.woff2` (`5eb09b5ac0e28b67c2f041c8ba6d244604ca0c0980d65912ab2d47fed84ddc31`) | `$FT ttLib.woff2 decompress instrument-serif-latin-400-normal.woff2 -o InstrumentSerif-Regular.ttf` | `99568fde50e90dffd7eccdc1adc17f88ebede748f6789d740ef8ea8be6672171` |
| `InstrumentSerif-Italic.ttf`   | `instrument-serif-latin-400-italic.woff2` (`5a51946dfffa82972bc98745359c46761515641fda557c25116459a9f83da4a7`) | `$FT ttLib.woff2 decompress instrument-serif-latin-400-italic.woff2 -o InstrumentSerif-Italic.ttf`  | `19a1e84ddd7448035886e42b06ee5f9908256a1c236a605f2f53fcf5d02b4d30` |
| `LICENSE-instrument-serif.txt` | `LICENSE-instrument-serif.txt` (`b6106a757902d2d412e09d94dc4a226fe3da80485208a98003969f1b8b6b1d74`)            | `cp frontend/app/fonts/play/LICENSE-instrument-serif.txt`                                           | `b6106a757902d2d412e09d94dc4a226fe3da80485208a98003969f1b8b6b1d74` |

## Bricolage Grotesque — `bricolage-grotesque/`

| File                                       | Source in `frontend/app/fonts/play/` (sha256)                                                                     | Command                                                                                                             | sha256                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `BricolageGrotesque96ptExtraBold-Bold.ttf` | `bricolage-grotesque-latin-700-normal.woff2` (`4c373ce3c1cca41c864eb3e27c059a59fc6310547ab9c9b6cd780d387ba24206`) | `$FT ttLib.woff2 decompress bricolage-grotesque-latin-700-normal.woff2 -o BricolageGrotesque96ptExtraBold-Bold.ttf` | `98445a67b4b04ede9ea7e5eaaa9866268492ff34ea85004de71273a62745f9c7` |
| `LICENSE-bricolage-grotesque.txt`          | `LICENSE-bricolage-grotesque.txt` (`923f4ddf0fd39f9b7794ab0df7332f3d95dc43e8ad7ec2289d6d9e8491177f51`)            | `cp frontend/app/fonts/play/LICENSE-bricolage-grotesque.txt`                                                        | `923f4ddf0fd39f9b7794ab0df7332f3d95dc43e8ad7ec2289d6d9e8491177f51` |

## Fredoka — `fredoka/`

| File                        | Source in `frontend/app/fonts/play/` (sha256)                                                         | Command                                                                                  | sha256                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `FredokaLight-SemiBold.ttf` | `fredoka-latin-600-normal.woff2` (`b62f2898de150f019961f4884a49f83dcd2ce74375be5e0992c594ebb8f30294`) | `$FT ttLib.woff2 decompress fredoka-latin-600-normal.woff2 -o FredokaLight-SemiBold.ttf` | `607d08f07e8a6fab9ae0a50ea3ef3bbcfc69735f37b49406f4c5af82abd53cfe` |
| `LICENSE-fredoka.txt`       | `LICENSE-fredoka.txt` (`9bbd4f5f107895d5a213579b73821fadd05105241cf4360e86050199fcfd6034`)            | `cp frontend/app/fonts/play/LICENSE-fredoka.txt`                                         | `9bbd4f5f107895d5a213579b73821fadd05105241cf4360e86050199fcfd6034` |

## Rajdhani — `rajdhani/`

Downloaded unchanged from google/fonts, so each file's sha256 equals its source's.

| File                    | Source (google/fonts @ 47d54ca1)                                                                                 | Command                                                                  | sha256                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `Rajdhani-Medium.ttf`   | https://github.com/google/fonts/blob/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/rajdhani/Rajdhani-Medium.ttf   | `curl -fsSL -o Rajdhani-Medium.ttf $GF/rajdhani/Rajdhani-Medium.ttf`     | `12ff7dcfe4c206e3875ac53b1762eab57de6a2fa7f5a86c26b97b88d6591eac2` |
| `Rajdhani-SemiBold.ttf` | https://github.com/google/fonts/blob/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/rajdhani/Rajdhani-SemiBold.ttf | `curl -fsSL -o Rajdhani-SemiBold.ttf $GF/rajdhani/Rajdhani-SemiBold.ttf` | `94bbd25a18ca665999feb05a537de9fd2b860dcfb78bbe9ca00270825bf235da` |
| `Rajdhani-Bold.ttf`     | https://github.com/google/fonts/blob/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/rajdhani/Rajdhani-Bold.ttf     | `curl -fsSL -o Rajdhani-Bold.ttf $GF/rajdhani/Rajdhani-Bold.ttf`         | `691470dd3286a14e9677940d0bf75796179841ba5215cbda1a2c8910a3226afd` |
| `OFL.txt`               | https://github.com/google/fonts/blob/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/rajdhani/OFL.txt               | `curl -fsSL -o OFL.txt $GF/rajdhani/OFL.txt`                             | `f62ef357d3a1c3d27edd35a6e1ba350e8a8d13499797964eeadefbf0b3b15d1f` |

## Chakra Petch — `chakra-petch/`

Downloaded unchanged from google/fonts, so each file's sha256 equals its source's.

| File                       | Source (google/fonts @ 47d54ca1)                                                                                       | Command                                                                           | sha256                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ChakraPetch-Medium.ttf`   | https://github.com/google/fonts/blob/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/chakrapetch/ChakraPetch-Medium.ttf   | `curl -fsSL -o ChakraPetch-Medium.ttf $GF/chakrapetch/ChakraPetch-Medium.ttf`     | `d480f4f97405fac3600652e2e14fd0b14339031c0af4da11582994878f04d919` |
| `ChakraPetch-SemiBold.ttf` | https://github.com/google/fonts/blob/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/chakrapetch/ChakraPetch-SemiBold.ttf | `curl -fsSL -o ChakraPetch-SemiBold.ttf $GF/chakrapetch/ChakraPetch-SemiBold.ttf` | `45264de3204ddbd5fb3e14a2402acd5c630d16650ae5fc221d2c52da46a6734b` |
| `OFL.txt`                  | https://github.com/google/fonts/blob/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/chakrapetch/OFL.txt                  | `curl -fsSL -o OFL.txt $GF/chakrapetch/OFL.txt`                                   | `13831d02389d917d22fcfa6c79f98f8acbf61d230add0e73a4d4dc5f3bfb9e56` |

## Press Start 2P — `press-start-2p/`

Downloaded unchanged from google/fonts, so each file's sha256 equals its source's. The one face
the family has (400); Arcade's titles, labels, counters, eyebrows and buttons.

| File                       | Source (google/fonts @ dbd72d6e)                                                                                        | Command                                                               | sha256                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `PressStart2P-Regular.ttf` | https://github.com/google/fonts/blob/dbd72d6ef9ebea750d33c02c7189633e972d6a40/ofl/pressstart2p/PressStart2P-Regular.ttf | `curl -fsSL -o PressStart2P-Regular.ttf $PS/PressStart2P-Regular.ttf` | `034c77f1f05ec89421e4a63f0e3a4ca1ecf852cc6d2bf611f126f275728e017d` |
| `OFL.txt`                  | https://github.com/google/fonts/blob/dbd72d6ef9ebea750d33c02c7189633e972d6a40/ofl/pressstart2p/OFL.txt                  | `curl -fsSL -o OFL.txt $PS/OFL.txt`                                   | `705960c3281a5765ecc0b59bd4ed7ca59eed165748076bc2fc3e8fdbfeb944b0` |

## Pixelify Sans — `pixelify-sans/`

Downloaded unchanged from eifetx/Pixelify-Sans, so each file's sha256 equals its source's. The
upstream file names are the PostScript names already (`PixelifySans-Regular`,
`PixelifySans-SemiBold`), so nothing is renamed. Arcade's running text.

| File                        | Source (eifetx/Pixelify-Sans @ 39df74ab)                                                                                  | Command                                                                           | sha256                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `PixelifySans-Regular.ttf`  | https://github.com/eifetx/Pixelify-Sans/blob/39df74aba80df8157546034b878e8be1eb565ced/fonts/ttf/PixelifySans-Regular.ttf  | `curl -fsSL -o PixelifySans-Regular.ttf $PX/fonts/ttf/PixelifySans-Regular.ttf`   | `5436d485d1713afa376e1744911cbbcc0849eae1eb55ec9bc34c0753993ffef9` |
| `PixelifySans-SemiBold.ttf` | https://github.com/eifetx/Pixelify-Sans/blob/39df74aba80df8157546034b878e8be1eb565ced/fonts/ttf/PixelifySans-SemiBold.ttf | `curl -fsSL -o PixelifySans-SemiBold.ttf $PX/fonts/ttf/PixelifySans-SemiBold.ttf` | `a4b54982991cd47450df317a451a7f066bf6b91aa033e105643aba2cf7bd35c3` |
| `OFL.txt`                   | https://github.com/eifetx/Pixelify-Sans/blob/39df74aba80df8157546034b878e8be1eb565ced/OFL.txt                             | `curl -fsSL -o OFL.txt $PX/OFL.txt`                                               | `b66ba46f511a851ab09998b5a5a9fdbb102545a3864cb993095e1745996873a7` |
