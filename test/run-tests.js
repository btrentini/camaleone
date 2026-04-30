const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const commands = new Map();
const informationMessages = [];
const errorMessages = [];
const panelMessages = [];
const updates = [];
const configValues = new Map();
const inputBoxResponses = [];
const inputBoxRequests = [];
const quickPickResponses = [];
const quickPickRequests = [];

function createMemento(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get(key, fallback) {
      return store.has(key) ? store.get(key) : fallback;
    },
    async update(key, value) {
      if (value === undefined) {
        store.delete(key);
      } else {
        store.set(key, value);
      }
    },
    dump() {
      return Object.fromEntries(store);
    }
  };
}

const configuration = {
  get(key, fallback) {
    return configValues.has(key) ? configValues.get(key) : fallback;
  },
  inspect(key) {
    return configValues.has(key) ? { globalValue: configValues.get(key) } : undefined;
  },
  async update(key, value, target) {
    updates.push({ key, value, target });
    if (value === undefined) {
      configValues.delete(key);
    } else {
      configValues.set(key, value);
    }
  }
};

const vscodeMock = {
  commands: {
    registerCommand(id, handler) {
      commands.set(id, handler);
      return { dispose() {} };
    },
    executeCommand() {}
  },
  window: {
    activeColorTheme: { kind: 2 },
    createWebviewPanel() {
      const panel = {
        webview: {
          cspSource: "vscode-webview:",
          html: "",
          onDidReceiveMessage() {},
          postMessage(message) {
            panelMessages.push(message);
            return Promise.resolve(true);
          }
        },
        reveal() {},
        onDidDispose() {}
      };
      return panel;
    },
    showInformationMessage(message) {
      informationMessages.push(message);
      return Promise.resolve(undefined);
    },
    showErrorMessage(message) {
      errorMessages.push(message);
      return Promise.resolve(undefined);
    },
    showInputBox(options) {
      inputBoxRequests.push(options);
      return Promise.resolve(inputBoxResponses.shift());
    },
    showQuickPick(items, options) {
      quickPickRequests.push({ items, options });
      const response = quickPickResponses.shift();
      if (typeof response === "function") {
        return Promise.resolve(response(items, options));
      }
      if (Number.isInteger(response)) {
        return Promise.resolve(items[response]);
      }
      return Promise.resolve(response);
    }
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: repoRoot } }],
    getConfiguration() {
      return configuration;
    }
  },
  ViewColumn: { One: 1 },
  ConfigurationTarget: { Global: 1, Workspace: 2 },
  ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 }
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "vscode") {
    return vscodeMock;
  }
  return originalLoad.call(this, request, parent, isMain);
};

const extension = require(path.join(repoRoot, "extension.js"));
const testApi = extension.__test;

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function resetState() {
  commands.clear();
  informationMessages.length = 0;
  errorMessages.length = 0;
  panelMessages.length = 0;
  updates.length = 0;
  inputBoxResponses.length = 0;
  inputBoxRequests.length = 0;
  quickPickResponses.length = 0;
  quickPickRequests.length = 0;
  configValues.clear();
  vscodeMock.window.activeColorTheme = { kind: 2 };
}

function textFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function nonSoberChoices(overrides = {}) {
  return {
    ...testApi.DEFAULT_CHOICES,
    sober: false,
    ...overrides
  };
}

test("activates Camaleone commands", () => {
  resetState();
  extension.activate({
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  });

  for (const commandId of [
    "camaleone.openPicker",
    "camaleone.quickApply",
    "camaleone.applyConfigured",
    "camaleone.clear",
    "camaleone.resetToDefault",
    "camaleone.surpriseMe",
    "camaleone.saveFavorite",
    "camaleone.applyFavorite"
  ]) {
    assert.equal(commands.has(commandId), true, `${commandId} should be registered`);
  }
});

test("sanitizes invalid choices and preserves defaults", () => {
  const choices = testApi.sanitizeChoices({
    startColor: "abc",
    endColor: "not-a-color",
    intensity: 999,
    applyTo: "global",
    includeEditorAccent: true,
    monochromatic: true,
    colorRelationship: "unknown",
    panelHarmony: "complementary",
    surfaceOverrides: {
      titleBar: "ff00ff",
      unknown: "#ffffff"
    }
  });

  assert.equal(choices.startColor, "#aabbcc");
  assert.equal(choices.endColor, testApi.DEFAULT_CHOICES.endColor);
  assert.equal(choices.intensity, 100);
  assert.equal(choices.applyTo, "global");
  assert.equal(choices.includeEditorAccent, true);
  assert.equal(choices.monochromatic, true);
  assert.equal(choices.sober, true);
  assert.equal(choices.colorRelationship, "manual");
  assert.equal(choices.panelHarmony, "complementary");
  assert.deepEqual(choices.surfaceOverrides, { titleBar: "#ff00ff" });
});

test("defaults use manual relationship with compact title activity and panel samples", () => {
  assert.equal(testApi.DEFAULT_CHOICES.colorRelationship, "manual");
  assert.equal(testApi.DEFAULT_CHOICES.panelHarmony, "manual");
  assert.equal(testApi.DEFAULT_CHOICES.sober, true);

  const samples = Object.fromEntries(testApi.SURFACE_CONFIGS.map((surface) => [surface.id, surface.sample]));
  assert.equal(samples.titleBar, 0);
  assert.equal(samples.activityBar, 0.12);
  assert.equal(samples.panel, 0.34);
  assert.ok(samples.activityBar - samples.titleBar < samples.panel - samples.activityBar);
  assert.ok(samples.panel < 0.5);
});

test("intensity affects custom surface overrides", () => {
  resetState();
  vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Dark };

  const full = testApi.createColorCustomizations(nonSoberChoices({
    intensity: 100,
    surfaceOverrides: { titleBar: "#ff0000" }
  }));
  const muted = testApi.createColorCustomizations(nonSoberChoices({
    intensity: 50,
    surfaceOverrides: { titleBar: "#ff0000" }
  }));

  assert.equal(full["titleBar.activeBackground"], "#ff0000");
  assert.notEqual(muted["titleBar.activeBackground"], "#ff0000");
  assert.match(muted["titleBar.activeBackground"], /^#[0-9a-f]{6}$/);
});

test("top command center text contrasts with selected title bar color", () => {
  resetState();
  vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Dark };

  const darkTitle = testApi.createColorCustomizations(nonSoberChoices({
    intensity: 100,
    surfaceOverrides: { titleBar: "#000000" }
  }));
  assert.equal(darkTitle["titleBar.activeBackground"], "#000000");
  assert.equal(darkTitle["titleBar.activeForeground"], "#ffffff");
  assert.equal(darkTitle["commandCenter.background"], "#000000");
  assert.equal(darkTitle["commandCenter.foreground"], "#ffffff");
  assert.equal(darkTitle["commandCenter.activeForeground"], "#ffffff");
  assert.match(darkTitle["commandCenter.activeBackground"], /^#[0-9a-f]{6}$/);

  const lightTitle = testApi.createColorCustomizations(nonSoberChoices({
    intensity: 100,
    surfaceOverrides: { titleBar: "#ffffff" }
  }));
  assert.equal(lightTitle["titleBar.activeBackground"], "#ffffff");
  assert.equal(lightTitle["titleBar.activeForeground"], "#000000");
  assert.equal(lightTitle["commandCenter.background"], "#ffffff");
  assert.equal(lightTitle["commandCenter.foreground"], "#000000");
});

test("button text contrasts with selected button and side bar colors", () => {
  resetState();
  vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Dark };

  const darkButtons = testApi.createColorCustomizations(nonSoberChoices({
    intensity: 100,
    surfaceOverrides: {
      buttons: "#000000",
      sideBar: "#000000"
    }
  }));

  assert.equal(darkButtons["button.background"], "#000000");
  assert.equal(darkButtons["button.foreground"], "#ffffff");
  assert.equal(darkButtons["sideBar.background"], `${darkButtons["button.secondaryBackground"]}94`);
  assert.equal(darkButtons["button.secondaryForeground"], "#ffffff");
  assert.equal(darkButtons["activityBarBadge.foreground"], "#ffffff");

  const lightButtons = testApi.createColorCustomizations(nonSoberChoices({
    intensity: 100,
    surfaceOverrides: {
      buttons: "#ffffff",
      sideBar: "#ffffff"
    }
  }));

  assert.equal(lightButtons["button.background"], "#ffffff");
  assert.equal(lightButtons["button.foreground"], "#000000");
  assert.equal(lightButtons["sideBar.background"], `${lightButtons["button.secondaryBackground"]}94`);
  assert.equal(lightButtons["button.secondaryForeground"], "#000000");
  assert.equal(lightButtons["activityBarBadge.foreground"], "#000000");
});

test("non-sober side bar uses translucent palette colors", () => {
  resetState();
  vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Dark };

  const generated = testApi.createColorCustomizations(nonSoberChoices({
    startColor: "#3366cc",
    endColor: "#cc6633",
    intensity: 100
  }));

  assert.match(generated["sideBar.background"], /^#[0-9a-f]{8}$/);
  assert.equal(generated["sideBar.background"].slice(-2), "94");
  assert.notEqual(generated["sideBar.background"].slice(0, 7), "#1e1e1e");
  assert.equal(generated["button.secondaryBackground"], generated["sideBar.background"].slice(0, 7));

  const customized = testApi.createColorCustomizations(nonSoberChoices({
    startColor: "#3366cc",
    endColor: "#cc6633",
    intensity: 100,
    surfaceOverrides: {
      sideBar: "#ffffff"
    }
  }));

  assert.notEqual(customized["sideBar.background"], "#1e1e1e");
  assert.match(customized["sideBar.background"], /^#[0-9a-f]{8}$/);
  assert.equal(customized["sideBar.background"].slice(-2), "94");
  assert.equal(customized["button.secondaryBackground"], customized["sideBar.background"].slice(0, 7));
});

test("default sober surprise palettes keep the side bar neutral", () => {
  resetState();
  const palette = testApi.createSurprisePalette();
  const colors = testApi.createColorCustomizations({
    ...testApi.DEFAULT_CHOICES,
    startColor: palette.startColor,
    endColor: palette.endColor,
    colorRelationship: palette.relationship,
    panelHarmony: palette.relationship,
    surfaceOverrides: {}
  });

  assert.equal(colors["sideBar.background"], "#1e1e1e");
});

test("non-sober surprise palettes use a translucent side bar", () => {
  resetState();
  const palette = testApi.createSurprisePalette();
  const colors = testApi.createColorCustomizations(nonSoberChoices({
    startColor: palette.startColor,
    endColor: palette.endColor,
    colorRelationship: palette.relationship,
    panelHarmony: palette.relationship,
    surfaceOverrides: {}
  }));

  assert.match(colors["sideBar.background"], /^#[0-9a-f]{8}$/);
  assert.equal(colors["sideBar.background"].slice(-2), "94");
  assert.notEqual(colors["sideBar.background"].slice(0, 7), "#1e1e1e");
});

test("monochromatic mode uses harmony colors instead of a straight gradient", () => {
  resetState();
  const gradient = testApi.createColorCustomizations(nonSoberChoices({
    startColor: "#3366cc",
    endColor: "#cc6633",
    monochromatic: false
  }));
  const mono = testApi.createColorCustomizations(nonSoberChoices({
    startColor: "#3366cc",
    endColor: "#cc6633",
    monochromatic: true,
    panelHarmony: "complementary"
  }));

  assert.notEqual(mono["statusBar.background"], gradient["statusBar.background"]);
  assert.match(mono["statusBar.background"], /^#[0-9a-f]{6}$/);
});

test("color relationship changes the palette path without replacing selected colors", () => {
  resetState();
  const manual = testApi.createColorCustomizations(nonSoberChoices({
    startColor: "#3366cc",
    endColor: "#cc6633",
    colorRelationship: "manual",
    monochromatic: false
  }));
  const complementary = testApi.createColorCustomizations(nonSoberChoices({
    startColor: "#3366cc",
    endColor: "#cc6633",
    colorRelationship: "complementary",
    monochromatic: false
  }));

  assert.equal(complementary["titleBar.activeBackground"], "#3366cc");
  assert.equal(complementary["statusBar.background"], "#cc6633");
  assert.equal(manual["titleBar.activeBackground"], "#3366cc");
  assert.equal(manual["statusBar.background"], "#cc6633");
  assert.notEqual(complementary["panel.border"], manual["panel.border"]);
});

test("sober mode neutralizes managed surfaces except title activity and status", () => {
  resetState();
  const sober = testApi.createColorCustomizations({
    ...testApi.DEFAULT_CHOICES,
    startColor: "#112233",
    endColor: "#445566",
    intensity: 25,
    includeEditorAccent: true,
    monochromatic: true,
    sober: true,
    surfaceOverrides: {
      sideBar: "#ffffff",
      panel: "#ffffff",
      buttons: "#ffffff"
    }
  });

  assert.equal(sober["titleBar.activeBackground"], "#112233");
  assert.equal(sober["activityBar.background"], "#172839");
  assert.equal(sober["statusBar.background"], "#445566");
  assert.equal(sober["sideBar.background"], "#1e1e1e");
  assert.equal(sober["panel.border"], "#1e1e1e");
  assert.equal(sober["button.background"], "#1e1e1e");
  assert.equal(sober["tab.activeBorderTop"], "#1e1e1e");
  assert.equal(sober["editor.selectionBackground"], undefined);
});

test("IDE default picker state uses equal active-theme colors", () => {
  resetState();
  vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Dark };

  const darkChoices = testApi.createIdeDefaultChoices({ applyTo: "global" });
  const darkColors = testApi.createColorCustomizations(darkChoices);

  assert.equal(darkChoices.startColor, "#1e1e1e");
  assert.equal(darkChoices.endColor, "#1e1e1e");
  assert.equal(darkChoices.applyTo, "global");
  assert.equal(darkChoices.sober, true);
  assert.deepEqual(darkChoices.surfaceOverrides, {});
  assert.equal(darkColors["titleBar.activeBackground"], "#1e1e1e");
  assert.equal(darkColors["statusBar.background"], "#1e1e1e");

  vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Light };
  const lightChoices = testApi.createIdeDefaultChoices();

  assert.equal(lightChoices.startColor, "#f3f3f3");
  assert.equal(lightChoices.endColor, "#f3f3f3");
  assert.equal(lightChoices.applyTo, "workspace");
  assert.equal(lightChoices.sober, true);
});

test("surprise palette returns valid distinct colors and relationship metadata", () => {
  for (let index = 0; index < 25; index += 1) {
    const palette = testApi.createSurprisePalette();
    assert.match(palette.startColor, /^#[0-9a-f]{6}$/);
    assert.match(palette.endColor, /^#[0-9a-f]{6}$/);
    assert.notEqual(palette.startColor, palette.endColor);
    assert.ok(["analogous", "complementary"].includes(palette.relationship));
  }
});

test("applying colors only updates extension state and workbench color customizations by default", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  };
  configValues.set("workbench.colorCustomizations", {
    "editorRuler.foreground": "#123456"
  });

  await testApi.applyColors(context, nonSoberChoices({
    startColor: "#112233",
    endColor: "#445566",
    applyTo: "workspace",
    surfaceOverrides: { titleBar: "#336699" }
  }));

  const updatedColors = configValues.get("workbench.colorCustomizations");
  assert.equal(updatedColors["editorRuler.foreground"], "#123456");
  assert.equal(updatedColors["titleBar.activeBackground"], "#336699");
  assert.equal(configValues.has("camaleone.startColor"), false);
  assert.equal(Object.keys(context.globalState.dump()).length > 0, true);
  assert.ok(updates.every((entry) => entry.key === "workbench.colorCustomizations"));
});

test("favourite commands save and apply stored color profiles", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  };
  extension.activate(context);

  configValues.set("camaleone.startColor", "#112233");
  configValues.set("camaleone.endColor", "#445566");
  configValues.set("camaleone.intensity", 100);
  configValues.set("camaleone.applyTo", "workspace");
  configValues.set("camaleone.sober", false);
  configValues.set("camaleone.surfaceOverrides", {
    titleBar: "#336699",
    buttons: "#010203"
  });
  inputBoxResponses.push("Critical Favourite");

  await commands.get("camaleone.saveFavorite")();

  const saved = context.globalState.get("camaleone.favorites", []);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, "Critical Favourite");
  assert.equal(saved[0].startColor, "#112233");
  assert.equal(saved[0].endColor, "#445566");
  assert.equal(saved[0].sober, false);
  assert.deepEqual(saved[0].surfaceOverrides, {
    titleBar: "#336699",
    buttons: "#010203"
  });

  configValues.set("camaleone.startColor", "#000000");
  configValues.set("camaleone.endColor", "#ffffff");
  configValues.set("camaleone.surfaceOverrides", {
    titleBar: "#ffffff",
    buttons: "#ffffff"
  });
  quickPickResponses.push(0);

  await commands.get("camaleone.applyFavorite")();

  const appliedColors = configValues.get("workbench.colorCustomizations");
  assert.equal(appliedColors["titleBar.activeBackground"], "#336699");
  assert.equal(appliedColors["button.background"], "#010203");
  assert.equal(appliedColors["statusBar.background"], "#445566");
  assert.equal(context.globalState.get("camaleone.lastChoices").startColor, "#112233");
  assert.equal(quickPickRequests[0].items[0].label, "Critical Favourite");
  assert.ok(informationMessages.some((message) => message.includes("Camaleone applied #112233 to #445566")));
});

test("reset to default removes Camaleone-managed color keys and keeps unrelated customizations", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  };
  configValues.set("workbench.colorCustomizations", {
    "titleBar.activeBackground": "#111111",
    "statusBar.background": "#222222",
    "editorRuler.foreground": "#333333",
    "[Cursor Dark Midnight]": {
      "titleBar.activeBackground": "#111111",
      "editorIndentGuide.background1": "#444444"
    }
  });

  await testApi.resetWorkbenchDefaults(context, {
    id: "workspace",
    label: "workspace",
    configurationTarget: vscodeMock.ConfigurationTarget.Workspace,
    state: "workspace"
  });

  assert.deepEqual(configValues.get("workbench.colorCustomizations"), {
    "editorRuler.foreground": "#333333",
    "[Cursor Dark Midnight]": {
      "editorIndentGuide.background1": "#444444"
    }
  });
});

test("restore previous can return to colors removed by reset to default", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  };
  const target = {
    id: "workspace",
    label: "workspace",
    configurationTarget: vscodeMock.ConfigurationTarget.Workspace,
    state: "workspace"
  };
  configValues.set("workbench.colorCustomizations", {
    "editorRuler.foreground": "#123456"
  });

  await testApi.applyColors(context, nonSoberChoices({
    startColor: "#112233",
    endColor: "#445566",
    applyTo: "workspace",
    surfaceOverrides: { titleBar: "#336699" }
  }));

  const appliedColors = { ...configValues.get("workbench.colorCustomizations") };
  await testApi.resetWorkbenchDefaults(context, target);

  const defaultColors = configValues.get("workbench.colorCustomizations");
  assert.equal(defaultColors["titleBar.activeBackground"], undefined);
  assert.equal(defaultColors["editorRuler.foreground"], "#123456");
  assert.equal(context.workspaceState.get("camaleone.workspace.active", true), false);
  assert.ok(context.workspaceState.get("camaleone.workspace.resetPrevious"));

  const restored = await testApi.restoreWorkbenchColors(context, target);
  const restoredColors = configValues.get("workbench.colorCustomizations");

  assert.equal(restored, true);
  assert.equal(restoredColors["editorRuler.foreground"], "#123456");
  assert.equal(restoredColors["titleBar.activeBackground"], appliedColors["titleBar.activeBackground"]);
  assert.equal(restoredColors["statusBar.background"], appliedColors["statusBar.background"]);
  assert.equal(context.workspaceState.get("camaleone.workspace.active", false), true);
  assert.equal(context.workspaceState.get("camaleone.workspace.resetPrevious", "cleared"), "cleared");
});

test("reset to IDE defaults removes empty color customizations setting", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  };
  configValues.set("workbench.colorCustomizations", {
    "titleBar.activeBackground": "#111111",
    "statusBar.background": "#222222",
    "[Cursor Dark Midnight]": {
      "activityBar.background": "#333333"
    }
  });

  await testApi.resetWorkbenchDefaults(context, {
    id: "workspace",
    label: "workspace",
    configurationTarget: vscodeMock.ConfigurationTarget.Workspace,
    state: "workspace"
  });

  assert.equal(configValues.has("workbench.colorCustomizations"), false);
  assert.deepEqual(updates.at(-1), {
    key: "workbench.colorCustomizations",
    value: undefined,
    target: vscodeMock.ConfigurationTarget.Workspace
  });
});

test("reset IDE defaults clears Camaleone colors from workspace and global scopes", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento({ "camaleone.global.active": true }),
    workspaceState: createMemento({ "camaleone.workspace.active": true })
  };
  configValues.set("workbench.colorCustomizations", {
    "titleBar.activeBackground": "#111111"
  });

  await testApi.resetIdeDefaults(context);

  const targets = updates
    .filter((entry) => entry.key === "workbench.colorCustomizations")
    .map((entry) => entry.target);

  assert.deepEqual(targets, [
    vscodeMock.ConfigurationTarget.Workspace,
    vscodeMock.ConfigurationTarget.Global
  ]);
  assert.equal(context.globalState.get("camaleone.global.active", true), false);
  assert.equal(context.workspaceState.get("camaleone.workspace.active", true), false);
});

test("picker html contains the simplified workflow controls", () => {
  const html = testApi.getPickerHtml({ cspSource: "vscode-webview:" }, {
    ...testApi.DEFAULT_CHOICES,
    favorites: [],
    surfaces: testApi.SURFACE_CONFIGS,
    defaultChoices: testApi.DEFAULT_CHOICES,
    baseColor: "#1e1e1e",
    hasWorkspace: true,
    pickerIcons: {
      title: "vscode-webview://icons/camaleone-sil-2.png",
      saveFavorite: "vscode-webview://icons/camaleone-sil-3.png"
    }
  });

  for (const text of [
    "Apply colors",
    "Surprise me",
    "Sober",
    "Customize",
    "Save as favourite...",
    "Options",
    "Monochromatic",
    "Colour relationship",
    "Manual",
    "Analogous",
    "Complementary",
    "Revert",
    "Tint editor selection/cursor",
    "Reset IDE defaults"
  ]) {
    assert.ok(html.includes(text), `picker should include ${text}`);
  }

  assert.equal(html.includes("surface-toggle"), false);
  assert.equal(html.includes("<h2>Palette</h2>"), false);
  assert.equal(html.includes('textContent = "Custom"'), false);
  assert.equal(html.includes("Panel harmony"), false);
  assert.equal(html.includes(">Save favourite<"), false);
  assert.ok(html.includes("panel-grid"));
  assert.ok(html.includes("button-icon"));
  assert.ok(html.includes("--vscode-button-secondaryForeground"));
  assert.ok(html.includes("--vscode-sideBar-foreground"));
  assert.ok(html.includes("primary-action"));
  assert.ok(html.includes("options-grid"));
  assert.ok(html.includes("option-item"));
  assert.ok(html.includes("options-actions"));
  assert.ok(html.includes("save-favorite-row"));
  assert.ok(html.includes("img-src vscode-webview:;"));
  assert.ok(html.includes("brand-lockup"));
  assert.ok(html.includes("title-icon"));
  assert.ok(html.includes("camaleone-sil-2.png"));
  assert.ok(html.includes("save-favorite-icon"));
  assert.ok(html.includes("camaleone-sil-3.png"));
  assert.ok(html.includes("align-items: stretch;"));
  assert.ok(html.includes("grid-template-rows: 46px 1fr;"));
  assert.ok(html.includes("min-height: 46px;"));
  assert.ok(html.includes("grid-template-columns: 1fr;"));
  assert.ok(html.includes("border-bottom: 1px solid var(--vscode-panel-border);"));
  assert.equal(html.includes('<section class="shell"'), false);
  assert.equal(html.includes("extras-grid"), false);
  assert.equal(html.includes("option-row"), false);
  assert.ok(html.includes("revertSurfaceOverride"));
  assert.ok(html.includes('color.addEventListener("change"'));
  assert.ok(html.includes('text.addEventListener("change"'));
  assert.ok(html.includes('color.addEventListener("input", () =>'));
  assert.ok(html.includes("updatePreviewAndApply(120);"));
  assert.ok(html.includes("updatePreviewAndApply(180);"));
  assert.ok(html.includes("const suggested = solidHex(getGeneratedSurfaceColors({}, true)[surfaceId])"));
  assert.ok(html.includes("resetButton.innerHTML"));
  assert.ok(html.includes("let applyTimer;"));
  assert.ok(html.includes('elements.intensity.addEventListener("input", () => updatePreviewAndApply(120));'));
  assert.ok(html.includes('elements.intensity.addEventListener("change", () => updatePreviewAndApply(0));'));
  assert.ok(html.includes('elements.applyTo.addEventListener("change", () => updatePreviewAndApply(0));'));
  assert.ok(html.includes('elements.includeEditorAccent.addEventListener("change", () => updatePreviewAndApply(0));'));
  assert.ok(html.includes('elements.sober.addEventListener("change", () => updatePreviewAndApply(0));'));
  assert.ok(html.includes('elements.panelHarmony.addEventListener("change", () => updatePreviewAndApply(0));'));
  assert.ok(html.includes('vscode.postMessage({ type: "applyFavorite", favoriteId: favorite.id });'));
  assert.equal(html.includes("Click Apply colors to write it."), false);
  assert.ok(html.includes("function scheduleApply(delay)"));
  assert.equal(html.includes("syncEndFromRelationship"), false);
  assert.equal(html.includes("getEffectiveEndColor"), false);
  assert.equal(html.includes("relatedEndColor"), false);

  assert.ok(html.indexOf('id="surprise"') < html.indexOf('id="apply"'));

  const customizeIndex = html.indexOf('<div class="customize-head">');
  const saveIndex = html.indexOf('id="saveFavorite"');
  const resetIndex = html.indexOf('id="resetDefault"');
  const optionsIndex = html.indexOf('<section class="extras"');
  const colorsIndex = html.indexOf('<section class="controls" aria-label="Color picker">');
  const soberIndex = html.indexOf('id="sober"');
  const paletteIndex = html.indexOf('<section class="preview" aria-label="Color palette preview">');
  const customizePanelIndex = html.indexOf('<section class="customize" aria-label="Customize colors">');
  assert.ok(customizeIndex >= 0 && customizeIndex < optionsIndex);
  assert.ok(colorsIndex >= 0);
  assert.ok(soberIndex > colorsIndex && soberIndex < paletteIndex);
  assert.ok(paletteIndex > colorsIndex);
  assert.ok(customizePanelIndex > paletteIndex);
  assert.ok(optionsIndex > customizePanelIndex);
  assert.ok(saveIndex > optionsIndex);
  assert.ok(saveIndex > resetIndex);
  assert.ok(html.indexOf('id="surpriseNote"') > colorsIndex && html.indexOf('id="surpriseNote"') < paletteIndex);
});

test("manifest and generated icon assets use the organized paths", () => {
  const manifest = JSON.parse(textFile("package.json"));
  assert.equal(manifest.icon, "assets/icons/store/camaleone.png");
  assert.equal(manifest.contributes.configuration.properties["camaleone.sober"].default, true);

  for (const relativePath of [
    "assets/icons/store/camaleone.png",
    "assets/icons/png/camaleone.png",
    "assets/icons/png/camaleone_transparent.png",
    "assets/icons/png/camaleone-sil-0.png",
    "assets/icons/png/camaleone-sil-1.png",
    "assets/icons/png/camaleone-sil-2.png",
    "assets/icons/png/camaleone-sil-3.png",
    "assets/icons/ico/camaleone.ico",
    "assets/icons/ico/camaleone_transparent.ico",
    "assets/icons/ico/camaleone-sil-0.ico",
    "assets/icons/ico/camaleone-sil-1.ico",
    "assets/icons/ico/camaleone-sil-2.ico",
    "assets/icons/ico/camaleone-sil-3.ico",
    "assets/screenshots/marketplace/camaleone-0.png",
    "assets/screenshots/marketplace/camaleone-1.png",
    "assets/screenshots/marketplace/camaleone-2.png",
    "assets/screenshots/marketplace/camaleone-3.png",
    "assets/screenshots/marketplace/camaleone-4.png",
    "assets/screenshots/marketplace/camaleone-5.png",
    "assets/screenshots/marketplace/camaleone-6.png",
    "assets/screenshots/marketplace/camaleone-7.png"
  ]) {
    assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), true, `${relativePath} should exist`);
  }

  const readme = textFile("README.md");
  for (let index = 0; index <= 7; index += 1) {
    assert.ok(readme.includes(`assets/screenshots/marketplace/camaleone-${index}.png`));
  }
});

test("save favourite placeholder uses the requested example name", () => {
  const source = textFile("extension.js");
  assert.ok(source.includes("e.g., 'Bruno Brown Chicken Bron Cow'"));
  assert.equal(source.includes("Bruno Blue"), false);
});

test("README includes marketplace how-to-use instructions", () => {
  const readme = textFile("README.md");
  assert.ok(readme.includes("## How To Use"));
  assert.ok(readme.includes("Install Camaleone in VS Code or Cursor."));
  assert.ok(readme.includes("Run `Camaleone: Open Color Picker`."));
  assert.ok(readme.includes("Click `Apply colors` to write the current palette."));
  assert.ok(readme.includes("Click `Save as favourite...` to store a palette"));
  assert.ok(readme.includes("Use `Restore previous`"));
  assert.ok(readme.indexOf("## How To Use") < readme.indexOf("## Local Development"));
});

test("webview script is syntactically valid after state injection", () => {
  const html = testApi.getPickerHtml({ cspSource: "vscode-webview:" }, {
    ...testApi.DEFAULT_CHOICES,
    favorites: [],
    surfaces: testApi.SURFACE_CONFIGS,
    defaultChoices: testApi.DEFAULT_CHOICES,
    baseColor: "#1e1e1e",
    hasWorkspace: true,
    pickerIcons: {}
  });
  const match = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/);
  assert.ok(match, "webview script should exist");
  new Function(match[1]);
});

test("debug configuration isolates the extension without suppressing warnings", () => {
  const launch = JSON.parse(textFile(".vscode/launch.json"));
  const args = launch.configurations[0].args;

  assert.ok(args.includes("--user-data-dir=${workspaceFolder}/.vscode-test/user-data"));
  assert.ok(args.includes("--extensions-dir=${workspaceFolder}/.vscode-test/extensions"));
  assert.ok(args.includes("--extensionDevelopmentPath=${workspaceFolder}"));
  assert.ok(args.includes("${workspaceFolder}/test/workspace"));
  assert.equal(args.includes("--disable-extensions"), false);
  assert.equal(JSON.stringify(launch).includes("NODE_NO_WARNINGS"), false);
  assert.equal(JSON.stringify(launch).includes("--no-warnings"), false);
});

test("workspace guards the known third-party GPU Monitor startup warning", () => {
  const settingsPath = path.join(repoRoot, ".vscode", "settings.json");
  assert.equal(fs.existsSync(settingsPath), true);

  const settings = JSON.parse(textFile(".vscode/settings.json"));
  assert.match(settings["gpu-monitor.binaryPath"], /^\/bin\/echo 'No NVIDIA GPU,/);
  assert.equal(settings["gpu-monitor.updateInterval"], 600000);

  const projectText = [
    ".vscode/launch.json",
    ".vscode/settings.json",
    "package.json",
    "extension.js",
    "README.md"
  ].map(textFile).join("\n");
  const executableText = [
    ".vscode/launch.json",
    "package.json",
    "extension.js"
  ].map(textFile).join("\n");

  assert.equal(projectText.includes("restoreTerminals.runOnStartup"), false);
  assert.equal(executableText.includes("NODE_NO_WARNINGS"), false);
});

test("extension does not import host warning modules", () => {
  const runtimeFiles = [
    "extension.js",
    "package.json"
  ].map(textFile).join("\n");

  assert.equal(/require\(["']punycode["']\)/.test(runtimeFiles), false);
  assert.equal(/from ["']punycode["']/.test(runtimeFiles), false);
  assert.equal(/require\(["'](?:node:)?sqlite/.test(runtimeFiles), false);
  assert.equal(/from ["'](?:node:)?sqlite/.test(runtimeFiles), false);
});

(async () => {
  let failed = 0;
  for (const entry of tests) {
    try {
      await entry.fn();
      console.log(`ok - ${entry.name}`);
    } catch (error) {
      failed += 1;
      console.error(`not ok - ${entry.name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
    return;
  }

  console.log(`${tests.length} tests passed`);
})();
