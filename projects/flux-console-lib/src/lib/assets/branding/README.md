# Flux Console — Branding Assets

This directory contains placeholder assets for the Flux Console rebrand.
Replace each placeholder with final artwork before production deployment.

## Required Assets

| File | Size/Format | Used In | Notes |
|------|-------------|---------|-------|
| `flux-logo.svg` | SVG, ~40×40px viewBox | Header bar icon, login page logo | Replace `ziti-logo.svg`. ⚡ bolt motif recommended. |
| `flux-banner.jpg` | 1200×400px JPG | Banner display (replaces `ZAC.jpg`) | Flux Console branding with Embernet/Fireball theming. |
| `embernet-logo.svg` | SVG | About dialog, footer attribution | Embernet product logo. |
| `favicon.ico` | Multi-size ICO (16, 32, 48) | Browser tab icon | Also need PNG variants — see icons/ dir. |
| `favicon-16x16.png` | 16×16 PNG | `<link>` in index.html | |
| `favicon-32x32.png` | 32×32 PNG | `<link>` in index.html | |
| `favicon-96x96.png` | 96×96 PNG | `<link>` in index.html | |
| `apple-icon-*.png` | Various sizes | iOS home screen icons | Sizes: 57, 60, 72, 76, 114, 120, 144, 152, 180 |
| `android-icon-192x192.png` | 192×192 PNG | Android home screen | |
| `ms-icon-144x144.png` | 144×144 PNG | Windows tile | |

## Brand Guidelines

- **Product:** Flux Console (part of the Flux zero-trust overlay network)
- **Company:** Fireball Industries — https://fireballz.ai
- **Parent Product:** Embernet — https://embernet.ai
- **Motto:** "Ignite your factory efficiency"
- **Motif:** ⚡ bolt / flame / industrial
- **Color Palette:** See `../../shared-assets/styles/_variables.scss` for CSS custom properties

## How to Replace

1. Drop your final artwork files into this directory (or the appropriate subdirectory)
2. SVGs: The build references `flux-logo.svg` by path in SCSS — keep the filename exact
3. Favicons: Copy to `projects/flux-console/src/` (app-level) AND `../icons/` (lib-level)
4. Banner: Replaces `../banners/ZAC.jpg` — referenced via `flux-banner.jpg` in templates

## License

Original ZAC assets are © NetFoundry Inc., Apache-2.0.
New Flux/Embernet assets are © 2026 Fireball Industries. All rights reserved.
