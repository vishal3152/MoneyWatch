# Money Watch brand

Display name for the product (repo/package remain `paisa-watch`).

## Positioning

Independent balance verification across institutions and currencies. The **Verified Monogram** combines an ink M with a Wealth Blue verification stroke, taken directly from the selected logo concept.

## Logo

| Asset | Use |
| --- | --- |
| `public/brand/logo-mark.svg` | Transparent header mark |
| `public/brand/logo-lockup.svg` | README, docs, marketing width |
| `public/brand/logo-mark.png` / `logo-lockup.png` | Contexts that require raster (regenerate from SVG when the mark changes); `logo-mark.png` is the blue-tile desktop app icon; `src/app/icon.svg` is its favicon counterpart. The desktop PNG is 1024×1024 (`package.json` `build.icon`) |

### Mark

- **Header:** Ink Strong `#17191c` M and Wealth Blue `#387ed1` verification stroke, with a transparent background.
- **App icon / favicon:** White monogram on a rounded Wealth Blue tile.
- **Source:** The owner-selected Verified Monogram concept. The SVG files embed transparent raster artwork extracted from that concept; they are not resolution-independent vector paths.
- Keep the original proportions. Do not stretch, rotate, add gradients, or substitute a currency symbol.

### Wordmark

- **Spelling:** `Money Watch` (two words)
- **Color:** Ink Strong `#17191c`.
- **Type:** Bold sans serif; the header uses the app's Inter font. The standalone lockup preserves the selected concept's original lettering.
- No underline.

## UI tokens

Unchanged from [DESIGN.md](../../DESIGN.md): paper `#f2f2f2`, Wealth Blue actions `#387ed1`, ink `#141c2e`. The rebrand is name + mark, not a new palette.

## Tagline (optional)

*Your balances. Independently verified.*
