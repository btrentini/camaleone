# Camaleone Development Notes

## Implementation Notes

- VS Code and Cursor do not expose an API for painting a literal CSS gradient on the main workbench chrome. Camaleone samples a gradient into individual `workbench.colorCustomizations` keys instead.
- The extension has no runtime dependencies and does not use CUDA, Metal, WebGPU, SQLite, or GPU APIs.
- Cursor uses the VS Code extension API, so the same extension package can run in both editors.
- The marketplace icon is `assets/icons/ico/camaleone_transparent.ico`. Source PNG and ICO variants live under `assets/icons/png/` and `assets/icons/ico/`.

## Local Development

1. Open this folder in VS Code or Cursor.
2. Run `npm test` before packaging or publishing.
3. Press `F5` and choose the `Run Extension` launch configuration. It starts a clean Extension Development Host with a separate user-data directory and an empty extensions directory.
4. In the Extension Development Host, run `Camaleone: Open Color Picker`.
5. Choose colors, customize surfaces, and click `Apply colors`.

To build a local VSIX package:

```sh
npx --yes @vscode/vsce package --no-dependencies
```

To publish to both the VS Code Marketplace and Cursor's Open VSX-backed marketplace, run:

```sh
npm run publish:marketplaces -- --version patch
```

The script runs the marketplace commands step by step: it validates and packages the extension, runs `vsce login`, lets you enter the VS Code Marketplace token, runs `vsce publish`, runs `vsce logout`, then repeats the same login, publish, and logout flow with `ovsx` for Cursor/Open VSX. Login credentials are written only to temporary credential stores created by the script and those stores are deleted before the script exits. Use `--dry-run` to validate and build without publishing:

```sh
npm run publish:marketplaces -- --version current --dry-run
```

## Potential Warnings

- If VS Code shows `Extensions have been modified on disk. Please reload the window.`, reload the Extension Development Host after changing extension files.
- The errors `nvidia-smi: command not found` and `Could not find GPU with index 0 make sure you have a GPU available` come from the installed `maimonator.gpu-monitor` extension, not Camaleone. This workspace sets `gpu-monitor.binaryPath` to a harmless no-GPU response in `.vscode/settings.json` for local development on macOS.
- Warnings such as `DEP0040` for `punycode` or `ExperimentalWarning: SQLite is an experimental feature` are emitted by the VS Code/Cursor host process or bundled editor services, not by Camaleone. Camaleone does not import `punycode` or SQLite.
- The `Run Extension` launch profile isolates the development host with `--user-data-dir` and `--extensions-dir`. It does not suppress Node warnings, so real extension failures remain visible during development.

## Validate

```sh
npm test
```
