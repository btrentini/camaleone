# Camaleone

Camaleone gives each IDE workspace more personality with gradient-inspired treatment, high customization, and presets.

VS Code's supported workbench color API accepts individual color values. Camaleone samples a start-to-end gradient and applies those samples across the title bar, activity bar, side bar, panel, status bar, buttons, borders, and optional editor accents. Users of this extension have a big deal of freedom!

## More info

- Website: [trentini.fyi/camaleone](https://trentini.fyi/camaleone/)
- VS Code Marketplace: [trentinium.camaleone](https://marketplace.visualstudio.com/items?itemName=trentinium.camaleone)
- Open VSX: [trentinium/camaleone](https://open-vsx.org/extension/trentinium/camaleone)
- Source: [github.com/btrentini/camaleone](https://github.com/btrentini/camaleone)

The website includes the animated feature walkthrough, current marketplace screenshots, user notes, and support links. README media is intentionally loaded from the live website so marketplace pages and GitHub always show the current visuals published on `github-pages`.

## Overview

Camaleone gives every VS Code and Cursor window a distinct identity **without forcing you to install a full theme**.

Pick a start and end color, generate palettes with `Surprise me`, keep the result restrained with default `Sober` mode, use presets, or customize individual surfaces such as the title bar, activity bar, side bar, panel, status bar, buttons, and editor accents.

It is built for people who work across many projects and want a fast visual cue for each window. Save favourite palettes, apply them again later, restore the colors Camaleone replaced, or reset cleanly to IDE defaults whenever you need to.

## Feature Highlights

- Gradient-inspired workbench identity without installing or switching full themes.
- Sober mode for restrained color on high-signal surfaces.
- Per-surface customization for title bar, activity bar, side bar, panel, status bar, buttons, borders, and editor accents.
- Built-in presets for Magnificent 7 companies and QS 2026 top universities.
- Favourite palettes for reusable workspace identities.
- Clean restore and reset commands for returning to previous colors or IDE defaults.

## What Users Say

> "Loving it! Installed and in use!!"
>
> "easy to use. great interface"
>
> "It's just beautiful"

## Screenshots

Click any image to open the Camaleone website. These images are loaded from `https://trentini.fyi/camaleone/`.

[![Camaleone animated walkthrough showing the picker, preview, customization, presets, and saved favourites](https://trentini.fyi/camaleone/assets/screenshots/marketplace/camaleone-feature-flow.gif)](https://trentini.fyi/camaleone/)

<table>
  <tr>
    <td colspan="4">
      <a href="https://trentini.fyi/camaleone/">
        <img src="https://trentini.fyi/camaleone/assets/screenshots/marketplace/camaleone-v04-2.png" alt="Camaleone marketplace hero showing the Oxford preset dropdown, blue workbench accents, and generated palette preview" width="100%">
      </a>
    </td>
  </tr>
  <tr>
    <td width="25%">
      <a href="https://trentini.fyi/camaleone/">
        <img src="https://trentini.fyi/camaleone/assets/screenshots/marketplace/camaleone-v04-1.png" alt="Camaleone orange and cyan palette with custom surface controls and options" width="100%">
      </a>
    </td>
    <td width="25%">
      <a href="https://trentini.fyi/camaleone/">
        <img src="https://trentini.fyi/camaleone/assets/screenshots/marketplace/camaleone-v04-3.png" alt="Camaleone green and white palette with the native color picker open" width="100%">
      </a>
    </td>
    <td width="25%">
      <a href="https://trentini.fyi/camaleone/">
        <img src="https://trentini.fyi/camaleone/assets/screenshots/marketplace/camaleone-v04-4.png" alt="Camaleone red and yellow palette with the native color picker open" width="100%">
      </a>
    </td>
    <td width="25%">
      <a href="https://trentini.fyi/camaleone/">
        <img src="https://trentini.fyi/camaleone/assets/screenshots/marketplace/camaleone-v04-5.png" alt="Camaleone muted yellow and blue palette with the save favourite dialog open" width="100%">
      </a>
    </td>
  </tr>
</table>

## How To Use

1. Install Camaleone in VS Code or Cursor.
2. Open the Command Palette with `Cmd+Shift+P` on macOS or `Ctrl+Shift+P` on Windows and Linux.
3. Run `Camaleone: Open Colour Picker`. This is the main command, and it opens the Camaleone customization interface.
4. Choose a `Start color` and `End color`, or click `Surprise me` to generate a palette.
5. Leave `Sober` enabled for a restrained window identity, or turn it off for a fuller palette across the workbench.
6. Choose whether to apply the colors to `Workspace settings` or `Global settings`.
7. Use `Customize` to tune individual surfaces such as the title bar, activity bar, side bar, panel, status bar, buttons, and editor accents. Surface changes apply automatically; `Revert` returns a surface to the generated palette color.
8. Click `Apply colors` to write the current palette.
9. Click `Save as favourite...` to store a palette, then choose it from the favourites list to apply it later. Preloaded presets can also be loaded and customized.
10. Use `Restore previous` to return to the colors Camaleone replaced, or `Reset IDE defaults` to remove Camaleone-managed colors.

## Preloaded Favourites

Camaleone ships with default favourites for the Magnificent 7 companies and the QS 2026 top 10 universities. These presets are brand-inspired two-color profiles, so they fit Camaleone's workbench model while keeping the names recognizable.

- Magnificent 7: Apple, Microsoft, Alphabet, Amazon, Meta, NVIDIA (`#76b900`), and Tesla.
- QS 2026 top 10 universities: Massachusetts Institute of Technology (MIT), Imperial College London, Stanford University (`#8c1515` and `#dad7cb`), University of Oxford, Harvard University, University of Cambridge, ETH Zurich, National University of Singapore (NUS), UCL, and California Institute of Technology (Caltech).
- To edit a preloaded favourite, choose it from the favourites list, adjust the colors or custom surfaces, then click `Save as favourite...`. The save prompt is prefilled with the preset name, and saving creates your editable override.

## Commands

Main command:

- `Camaleone: Open Colour Picker`: opens the customization interface for choosing colors, previewing the palette, tuning surfaces, applying changes, and saving favourites.

Secondary commands:

- `Camaleone: Quick Apply Without Webview`
- `Camaleone: Apply Configured Colors`
- `Camaleone: Restore Previous Colors`
- `Camaleone: Reset to IDE Defaults`
- `Camaleone: Surprise Me`
- `Camaleone: Save Current Colors as Favourite`
- `Camaleone: Apply Favourite Colors`

[Get in touch](https://trentini.fyi/camaleone/) | [Buy me a coffee](https://trentini.fyi/camaleone/#support)
