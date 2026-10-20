# Brand asset sources

The app icon, the Android adaptive icon and the splash image, all composed from the Studio
brand mark (PRD-001 §4.1, K7). `src/config/__tests__/brand-assets.test.ts` reads each PNG's
header and checks the files against `app.json`.

## Source

automatos-ai `frontend/public/brand/automatos-mark-hi.png` at
`630fc1c85af06c5c76e70c74e9653ee1804fdf41` (the read-only `core-pin-630fc1c85` worktree, HEAD
630fc1c85), sha256 `23ef339101e679f420829df75a35509f5cff746c20da415a29b5c68242455548`:
333x396 RGBA, the burnt-orange sail mark, the largest master in that repository. Its opaque
pixels span 321x394 (alpha bounding box `(9, 0, 330, 394)`).

The icon mark is that PNG scaled up 1.52x and the adaptive-icon mark 1.18x (Lanczos), so the
edges are softer than a vector master would give. A vector or 1024 px master is owner follow-up
OT-8.

## How the files were produced

The source was copied into an empty work directory and composed there with Pillow 13.0.0, run
through `uvx` (nothing installed). Running the commands again gives byte-identical files
(checked: two runs, same sha256).

```sh
cp <automatos-ai>/frontend/public/brand/automatos-mark-hi.png brand-src/
uvx --with pillow==13.0.0 python -I compose.py brand-src/automatos-mark-hi.png brand-out
cp brand-out/icon.png brand-out/icon-dark.png brand-out/adaptive-icon.png brand-out/splash.png assets/brand/
```

`compose.py`:

```python
# Composes the Automatos Go icon and splash PNGs from the Studio brand mark.
# Usage: python -I compose.py <automatos-mark-hi.png> <out-dir>
import sys
from pathlib import Path

from PIL import Image

CANVAS = 1024
CREAM = (0xF4, 0xEE, 0xE2)  # Studio --background, hsl(38 50% 92%)
DARK = (0x1A, 0x18, 0x14)  # Studio Dark --background, hsl(30 12% 9%)
ICON_MARK_HEIGHT = 600  # 58.6% of the canvas: inside the central ~60% safe area
ADAPTIVE_MARK_DIAGONAL = 600  # Android safe zone: a 66/108 circle, 626 px across


def trimmed_mark(source: Path) -> Image.Image:
    mark = Image.open(source).convert("RGBA")
    return mark.crop(mark.getchannel("A").getbbox())


def scaled(mark: Image.Image, factor: float) -> Image.Image:
    size = (round(mark.width * factor), round(mark.height * factor))
    return mark.resize(size, Image.Resampling.LANCZOS)


def centred(mark: Image.Image, ground: tuple[int, int, int, int]) -> Image.Image:
    canvas = Image.new("RGBA", (CANVAS, CANVAS), ground)
    layer = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    layer.paste(mark, ((CANVAS - mark.width) // 2, (CANVAS - mark.height) // 2))
    return Image.alpha_composite(canvas, layer)


def main(source: Path, out: Path) -> None:
    mark = trimmed_mark(source)
    icon_mark = scaled(mark, ICON_MARK_HEIGHT / mark.height)
    diagonal = (mark.width**2 + mark.height**2) ** 0.5
    adaptive_mark = scaled(mark, ADAPTIVE_MARK_DIAGONAL / diagonal)

    centred(icon_mark, (*CREAM, 255)).convert("RGB").save(out / "icon.png")
    centred(icon_mark, (*DARK, 255)).convert("RGB").save(out / "icon-dark.png")
    centred(adaptive_mark, (0, 0, 0, 0)).save(out / "adaptive-icon.png")
    mark.save(out / "splash.png")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
```

`convert("RGB")` drops the alpha channel itself: an RGBA PNG that is fully opaque still fails
App Store processing (ITMS-90717).

## Files

| File                | Size      | PNG colour type   | Mark                                                                                | sha256                                                             |
| ------------------- | --------- | ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `icon.png`          | 1024x1024 | 2 (RGB, no alpha) | 489x600 at (267, 212) on Studio cream `#f4eee2`: inside the central 60% (205–819)   | `c31e92b1ec37cc24a256f43b99bab5fd2b4e3a203f1e45a325f2d0d82498de57` |
| `icon-dark.png`     | 1024x1024 | 2 (RGB, no alpha) | the same on Studio Dark `#1a1814`                                                   | `e36583081e52c03b4fa5116ac7cdce5133a5d6a10fa94424bdb63b218a9f97a2` |
| `adaptive-icon.png` | 1024x1024 | 6 (RGBA)          | 379x465 at (322, 279), diagonal 600 px: inside the 66/108 safe-zone circle (626 px) | `94afd8ae95fa37e679aaf6871aa4f3591378e789d01baec45381d58f12df75bb` |
| `splash.png`        | 321x394   | 6 (RGBA)          | the trimmed mark at its source resolution, transparent around it                    | `f1263936b05a68a9ba1e4c25bf0d8477dd98608ba77527e41ce894bba01f3747` |

## Where app.json uses them

- `icon` → `icon.png` (the default and Android legacy icon).
- `ios.icon` → `{ light: icon.png, dark: icon-dark.png }`. The installed `@expo/config-types`
  54.0.10 types it `icon?: string | IOSIcons;` with `light`, `dark` and `tinted`.
- `android.adaptiveIcon` → `foregroundImage: adaptive-icon.png`, `backgroundColor: #f4eee2`.
- `expo-splash-screen` plugin → `image: splash.png`, `imageWidth: 220` (as the academy
  template), `backgroundColor: #f4eee2`, `dark.backgroundColor: #1a1814`; the same mark in
  both appearances. The plugin renders the image at 220 pt per screen scale at build time.
