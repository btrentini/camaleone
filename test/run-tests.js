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
const treeDataProviders = new Map();
const webviewViewProviders = new Map();
const webviewPanels = [];

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

function createMockWebview() {
  const webview = {
    cspSource: "vscode-webview:",
    html: "",
    options: {},
    onDidReceiveMessage(handler) {
      webview.messageHandler = handler;
      return { dispose() {} };
    },
    postMessage(message) {
      panelMessages.push(message);
      return Promise.resolve(true);
    }
  };
  return webview;
}

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
        webview: createMockWebview(),
        reveal() {},
        onDidDispose() {}
      };
      webviewPanels.push(panel);
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
    },
    registerTreeDataProvider(id, provider) {
      treeDataProviders.set(id, provider);
      return { dispose() {} };
    },
    registerWebviewViewProvider(id, provider, options) {
      webviewViewProviders.set(id, { provider, options });
      return { dispose() {} };
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
  treeDataProviders.clear();
  webviewViewProviders.clear();
  webviewPanels.length = 0;
  configValues.clear();
  vscodeMock.window.activeColorTheme = { kind: 2 };
}

function textFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function binaryFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath));
}

function nonSoberChoices(overrides = {}) {
  return {
    ...testApi.DEFAULT_CHOICES,
    sober: false,
    ...overrides
  };
}

test("activates Camaleone commands and renders the picker in the Activity Bar", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  };
  extension.activate(context);

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

  assert.equal(treeDataProviders.has("camaleone.controls"), false);
  assert.equal(webviewViewProviders.has("camaleone.controls"), true);
  const registration = webviewViewProviders.get("camaleone.controls");
  assert.deepEqual(registration.options, { webviewOptions: { retainContextWhenHidden: true } });

  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    await commands.get("camaleone.openPicker")();
    const panelHtml = webviewPanels[0].webview.html;
    const activityWebview = createMockWebview();

    registration.provider.resolveWebviewView({ webview: activityWebview });

    assert.notEqual(activityWebview.html, panelHtml);
    assert.ok(panelHtml.includes('<body class="standard-pane">'));
    assert.ok(panelHtml.includes('<section class="customize" aria-label="Customize colors">'));
    assert.ok(activityWebview.html.includes('<body class="activity-pane">'));
    assert.equal(activityWebview.html.includes('<section class="customize" aria-label="Customize colors">'), false);
    assert.ok(activityWebview.html.includes('"layout":"activityBar"'));
    assert.ok(activityWebview.html.includes("Apply colors"));
    assert.ok(activityWebview.html.includes("Save as favourite..."));
    assert.ok(activityWebview.html.includes("surface-control-inline"));
    assert.equal(activityWebview.html.includes("Open Camaleone Setup"), false);
    assert.equal(typeof activityWebview.messageHandler, "function");
  } finally {
    Math.random = originalRandom;
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
  assert.equal(choices.applyTo, "workspace");
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
  assert.equal(samples.remoteIndicator, 0.08);
  assert.equal(samples.activityBar, 0.12);
  assert.equal(samples.panel, 0.34);
  assert.ok(samples.remoteIndicator > samples.titleBar && samples.remoteIndicator < samples.activityBar);
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

test("sober intensity affects active identity surfaces", () => {
  resetState();
  vscodeMock.window.activeColorTheme = { kind: vscodeMock.ColorThemeKind.Dark };

  const full = testApi.createColorCustomizations({
    ...testApi.DEFAULT_CHOICES,
    startColor: "#112233",
    endColor: "#445566",
    intensity: 100,
    sober: true
  });
  const muted = testApi.createColorCustomizations({
    ...testApi.DEFAULT_CHOICES,
    startColor: "#112233",
    endColor: "#445566",
    intensity: 25,
    sober: true
  });

  assert.equal(full["titleBar.activeBackground"], "#112233");
  assert.equal(full["statusBar.background"], "#445566");
  assert.notEqual(muted["titleBar.activeBackground"], full["titleBar.activeBackground"]);
  assert.notEqual(muted["activityBar.background"], full["activityBar.background"]);
  assert.notEqual(muted["statusBar.background"], full["statusBar.background"]);
  assert.equal(muted["sideBar.background"], "#1e1e1e");
});

test("tint editor adds active editor accents in sober mode", () => {
  resetState();
  const chromeOnly = testApi.createColorCustomizations({
    ...testApi.DEFAULT_CHOICES,
    startColor: "#112233",
    endColor: "#445566",
    includeEditorAccent: false,
    sober: true
  });
  const tintedEditor = testApi.createColorCustomizations({
    ...testApi.DEFAULT_CHOICES,
    startColor: "#112233",
    endColor: "#445566",
    includeEditorAccent: true,
    sober: true
  });

  assert.equal(chromeOnly["editor.selectionBackground"], undefined);
  assert.match(tintedEditor["editor.selectionBackground"], /^#[0-9a-f]{8}$/);
  assert.match(tintedEditor["editorCursor.foreground"], /^#[0-9a-f]{6}$/);
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

test("remote host indicator uses dedicated status bar item colors", () => {
  resetState();
  const sober = testApi.createColorCustomizations({
    ...testApi.DEFAULT_CHOICES,
    startColor: "#112233",
    endColor: "#445566",
    intensity: 100,
    sober: true
  });

  assert.match(sober["statusBarItem.remoteBackground"], /^#[0-9a-f]{6}$/);
  assert.match(sober["statusBarItem.remoteHoverBackground"], /^#[0-9a-f]{6}$/);
  assert.ok(["#000000", "#ffffff"].includes(sober["statusBarItem.remoteForeground"]));
  assert.ok(["#000000", "#ffffff"].includes(sober["statusBarItem.remoteHoverForeground"]));
  assert.notEqual(sober["statusBarItem.remoteBackground"], "#1e1e1e");

  const customized = testApi.createColorCustomizations(nonSoberChoices({
    startColor: "#112233",
    endColor: "#445566",
    intensity: 100,
    surfaceOverrides: {
      remoteIndicator: "#ffffff"
    }
  }));

  assert.equal(customized["statusBarItem.remoteBackground"], "#ffffff");
  assert.equal(customized["statusBarItem.remoteForeground"], "#000000");
});

test("sober mode neutralizes generated surfaces but allows explicit custom surfaces", () => {
  resetState();
  const sober = testApi.createColorCustomizations({
    ...testApi.DEFAULT_CHOICES,
    startColor: "#112233",
    endColor: "#445566",
    intensity: 100,
    includeEditorAccent: false,
    monochromatic: false,
    sober: true,
    surfaceOverrides: {
      sideBar: "#ffffff",
      panel: "#ffffff",
      remoteIndicator: "#ffffff",
      buttons: "#ffffff"
    }
  });

  assert.equal(sober["titleBar.activeBackground"], "#112233");
  assert.equal(sober["activityBar.background"], "#172839");
  assert.equal(sober["statusBar.background"], "#445566");
  assert.notEqual(sober["sideBar.background"], "#1e1e1e");
  assert.notEqual(sober["panel.border"], "#1e1e1e");
  assert.equal(sober["statusBarItem.remoteBackground"], "#ffffff");
  assert.equal(sober["button.background"], "#ffffff");
  assert.notEqual(sober["tab.activeBorderTop"], "#1e1e1e");
  assert.equal(sober["editor.selectionBackground"], undefined);
});

test("default sober mode keeps generated secondary surfaces neutral", () => {
  resetState();
  const sober = testApi.createColorCustomizations({
    ...testApi.DEFAULT_CHOICES,
    startColor: "#112233",
    endColor: "#445566",
    intensity: 25,
    includeEditorAccent: false,
    monochromatic: true,
    sober: true,
    surfaceOverrides: {}
  });

  assert.equal(sober["sideBar.background"], "#1e1e1e");
  assert.equal(sober["panel.border"], "#1e1e1e");
  assert.notEqual(sober["statusBarItem.remoteBackground"], "#1e1e1e");
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
  assert.equal(darkChoices.applyTo, "workspace");
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

test("surprise palette favors distinctive combinations eighty percent of the time", () => {
  const originalRandom = Math.random;
  let callIndex = 0;

  Math.random = () => {
    const callInPalette = callIndex % 8;
    const paletteIndex = Math.floor(callIndex / 8);
    callIndex += 1;

    if (callInPalette === 0) {
      return paletteIndex < 80 ? 0.2 : 0.95;
    }

    return 0.5;
  };

  try {
    let complementaryCount = 0;
    let analogousCount = 0;

    for (let index = 0; index < 100; index += 1) {
      const palette = testApi.createSurprisePalette();
      if (palette.relationship === "complementary") {
        complementaryCount += 1;
      } else if (palette.relationship === "analogous") {
        analogousCount += 1;
      }
    }

    assert.equal(complementaryCount, 80);
    assert.equal(analogousCount, 20);
    assert.equal(callIndex, 800);
  } finally {
    Math.random = originalRandom;
  }
});

test("applying colors saves the workspace profile and workbench colors", async () => {
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
  assert.equal(configValues.get("camaleone.startColor"), "#112233");
  assert.equal(configValues.get("camaleone.endColor"), "#445566");
  assert.equal(configValues.get("camaleone.intensity"), 100);
  assert.equal(configValues.get("camaleone.sober"), false);
  assert.equal(context.workspaceState.get("camaleone.lastChoices").startColor, "#112233");
  assert.equal(context.globalState.get("camaleone.lastChoices"), undefined);
  assert.ok(updates.some((entry) => entry.key === "camaleone.startColor" && entry.target === vscodeMock.ConfigurationTarget.Workspace));
  assert.deepEqual(updates.at(-1), {
    key: "workbench.colorCustomizations",
    value: updatedColors,
    target: vscodeMock.ConfigurationTarget.Workspace
  });
});

test("activation reapplies an active saved workspace profile", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento({
      "camaleone.workspace.active": true,
      "camaleone.lastChoices": {
        ...testApi.DEFAULT_CHOICES,
        startColor: "#112233",
        endColor: "#445566",
        sober: false,
        surfaceOverrides: { titleBar: "#336699" }
      }
    })
  };

  const replayed = await testApi.applySavedWorkspaceProfileOnActivation(context);
  const colors = configValues.get("workbench.colorCustomizations");

  assert.equal(replayed, true);
  assert.equal(colors["titleBar.activeBackground"], "#336699");
  assert.equal(colors["statusBar.background"], "#445566");
  assert.equal(configValues.get("camaleone.startColor"), "#112233");
  assert.equal(context.workspaceState.get("camaleone.workspace.active"), true);
});

test("applying colors replaces stale managed workspace settings", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  };
  configValues.set("workbench.colorCustomizations", {
    "titleBar.activeBackground": "#111111",
    "statusBarItem.remoteBackground": "#999999",
    "editor.selectionBackground": "#222222",
    "editorRuler.foreground": "#333333",
    "[Cursor Dark Midnight]": {
      "titleBar.activeBackground": "#444444",
      "editorIndentGuide.background1": "#555555"
    }
  });

  await testApi.applyColors(context, {
    ...testApi.DEFAULT_CHOICES,
    startColor: "#112233",
    endColor: "#445566",
    applyTo: "workspace",
    includeEditorAccent: false,
    sober: true
  });

  const colors = configValues.get("workbench.colorCustomizations");
  assert.equal(colors["titleBar.activeBackground"], "#112233");
  assert.notEqual(colors["statusBarItem.remoteBackground"], "#999999");
  assert.match(colors["statusBarItem.remoteBackground"], /^#[0-9a-f]{6}$/);
  assert.equal(colors["editor.selectionBackground"], undefined);
  assert.equal(colors["editorRuler.foreground"], "#333333");
  assert.deepEqual(colors["[Cursor Dark Midnight]"], {
    "editorIndentGuide.background1": "#555555"
  });
  assert.deepEqual(updates.at(-1), {
    key: "workbench.colorCustomizations",
    value: colors,
    target: vscodeMock.ConfigurationTarget.Workspace
  });
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
  assert.equal(context.workspaceState.get("camaleone.lastChoices").startColor, "#112233");
  assert.equal(quickPickRequests[0].items[0].label, "Critical Favourite");
  assert.ok(informationMessages.some((message) => message.includes("Camaleone applied #112233 to #445566")));
});

test("default favourites include grouped Magnificent 7, QS, and World Cup palettes", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  };

  const favorites = testApi.getFavorites(context);
  assert.equal(favorites.length, 32);
  assert.equal(favorites.every((favorite) => favorite.builtin), true);
  assert.equal(favorites.filter((favorite) => favorite.presetGroup === "magnificent-7").length, 7);
  assert.equal(favorites.filter((favorite) => favorite.presetGroup === "qs-world-top-10").length, 10);
  assert.equal(favorites.filter((favorite) => favorite.presetGroup === "world-cup").length, 15);

  const names = favorites.map((favorite) => favorite.name);
  for (const name of [
    "Apple",
    "Microsoft",
    "Alphabet",
    "Amazon",
    "Meta",
    "NVIDIA",
    "Tesla",
    "Massachusetts Institute of Technology (MIT)",
    "Imperial College London",
    "Stanford University",
    "University of Oxford",
    "Harvard University",
    "University of Cambridge",
    "ETH Zurich",
    "National University of Singapore (NUS)",
    "UCL",
    "California Institute of Technology (Caltech)",
    "France",
    "Spain",
    "Argentina",
    "England",
    "Portugal",
    "Brazil",
    "Netherlands",
    "Morocco",
    "Belgium",
    "Germany",
    "Croatia",
    "Italy",
    "Colombia",
    "Senegal",
    "Mexico"
  ]) {
    assert.ok(names.includes(name), `${name} should be a default favourite`);
  }

  const nvidia = favorites.find((favorite) => favorite.name === "NVIDIA");
  const stanford = favorites.find((favorite) => favorite.name === "Stanford University");
  const france = favorites.find((favorite) => favorite.name === "France");
  assert.equal(nvidia.startColor, "#76b900");
  assert.equal(stanford.startColor, "#8c1515");
  assert.equal(stanford.endColor, "#dad7cb");
  assert.equal(france.startColor, "#002654");
  assert.equal(france.endColor, "#ed2939");

  const result = await testApi.applyFavoriteById(context, nvidia.id);
  const colors = configValues.get("workbench.colorCustomizations");
  assert.equal(result.startColor, "#76b900");
  assert.equal(colors["titleBar.activeBackground"], "#76b900");
  assert.equal(colors["statusBar.background"], "#000000");
});

test("saved favourites override default favourites by name", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento({
      "camaleone.favorites": [{
        id: "custom-nvidia",
        name: "NVIDIA",
        startColor: "#123456",
        endColor: "#654321",
        sober: false
      }]
    }),
    workspaceState: createMemento()
  };

  const favorites = testApi.getFavorites(context);
  const nvidiaEntries = favorites.filter((favorite) => favorite.name === "NVIDIA");
  assert.equal(nvidiaEntries.length, 1);
  assert.equal(nvidiaEntries[0].id, "custom-nvidia");
  assert.equal(nvidiaEntries[0].builtin, false);
  assert.equal(nvidiaEntries[0].presetGroup, "magnificent-7");
  assert.equal(nvidiaEntries[0].startColor, "#123456");
  assert.equal(favorites.length, 32);
});

test("preloaded favourites can be edited by saving over their preset name", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  };
  inputBoxResponses.push("NVIDIA");

  const favorites = await testApi.saveFavorite(context, nonSoberChoices({
    favoriteName: "NVIDIA",
    startColor: "#123456",
    endColor: "#654321",
    surfaceOverrides: {
      titleBar: "#abcdef"
    }
  }));

  assert.equal(inputBoxRequests[0].value, "NVIDIA");
  const stored = context.globalState.get("camaleone.favorites", []);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].name, "NVIDIA");
  assert.equal(stored[0].startColor, "#123456");
  assert.equal(stored[0].surfaceOverrides.titleBar, "#abcdef");

  const nvidiaEntries = favorites.filter((favorite) => favorite.name === "NVIDIA");
  assert.equal(nvidiaEntries.length, 1);
  assert.equal(nvidiaEntries[0].builtin, false);
  assert.equal(nvidiaEntries[0].startColor, "#123456");
  assert.equal(favorites.length, 32);
});

test("webview save favourite uses provided modal name without native input", async () => {
  resetState();
  const context = {
    subscriptions: [],
    globalState: createMemento(),
    workspaceState: createMemento()
  };

  const favorites = await testApi.saveFavorite(context, nonSoberChoices({
    favoriteName: "Centered Modal Favourite",
    startColor: "#123456",
    endColor: "#654321"
  }), { promptForName: false });

  assert.equal(inputBoxRequests.length, 0);
  assert.equal(favorites[0].name, "Centered Modal Favourite");
  assert.equal(context.globalState.get("camaleone.favorites", [])[0].name, "Centered Modal Favourite");
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
  const workbenchUpdate = updates.find((entry) => entry.key === "workbench.colorCustomizations");
  assert.deepEqual(workbenchUpdate, {
    key: "workbench.colorCustomizations",
    value: undefined,
    target: vscodeMock.ConfigurationTarget.Workspace
  });
});

test("reset IDE defaults clears Camaleone colors from workspace scope", async () => {
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
    vscodeMock.ConfigurationTarget.Workspace
  ]);
  assert.equal(context.globalState.get("camaleone.global.active", true), true);
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
      saveFavorite: "vscode-webview://icons/camaleone-sil-3.png",
      colorPicker: "vscode-webview://icons/color-picker.png",
      undo: "vscode-webview://icons/undo.png"
    }
  });

  for (const text of [
    "Apply colors",
    "Surprise me",
    "Sober",
    "Customize",
    "Save as favourite...",
    "Save as favourite",
    "Options",
    "Color behavior",
    "Presets",
    "Magnificent 7",
    "Top 10 QS World",
    "World Cup",
    "Actions",
    "Monochromatic",
    "Colour relationship",
    "Manual",
    "Analogous",
    "Complementary",
    "Remote Host",
    "Bottom-left Remote/SSH indicator",
    "Revert",
    "Tint editor selection/cursor",
    "Uses the start color as the anchor",
    "Adds the active palette color to editor selection",
    "Reset IDE defaults"
  ]) {
    assert.ok(html.includes(text), `picker should include ${text}`);
  }

  assert.equal(html.includes("surface-toggle"), false);
  assert.equal(html.includes("<h2>Palette</h2>"), false);
  assert.equal(html.includes('textContent = "Custom"'), false);
  assert.equal(html.includes("Panel harmony"), false);
  assert.equal(html.includes("<div class=\"options-section-title\">Target</div>"), false);
  assert.equal(html.includes('id="applyTo"'), false);
  assert.equal(html.includes("Global settings"), false);
  assert.equal(html.includes(">Save favourite<"), false);
  assert.ok(html.includes('data-preset-filter="magnificent-7"'));
  assert.ok(html.includes('data-preset-filter="qs-world-top-10"'));
  assert.ok(html.includes('data-preset-filter="world-cup"'));
  assert.ok(html.includes("panel-grid"));
  assert.ok(html.includes("button-icon"));
  assert.ok(html.includes("button-icon icon-svg icon-reset"));
  assert.ok(html.includes("button-icon icon-image-mask icon-revert"));
  assert.ok(html.includes("--icon-mask: url('vscode-webview://icons/undo.png');"));
  assert.ok(html.includes(".button-icon.icon-image-mask"));
  assert.ok(html.includes("-webkit-mask: var(--icon-mask) center / contain no-repeat;"));
  assert.ok(html.includes("mask: var(--icon-mask) center / contain no-repeat;"));
  assert.ok(html.includes('id="clear" class="secondary" type="button"><span class="button-icon icon-image-mask icon-revert"'));
  assert.ok(html.includes('id="resetDefault" class="secondary" type="button"><svg class="button-icon icon-svg icon-reset"'));
  assert.ok(html.includes('resetButton.innerHTML = "<span class=\\"button-icon icon-image-mask icon-revert\\"'));
  assert.ok(html.includes(".button-icon.icon-svg"));
  assert.equal(html.includes("&#8630;"), false);
  assert.equal(html.includes("&#8634;"), false);
  assert.equal(html.includes("&#8635;"), false);
  assert.ok(html.includes("--vscode-button-secondaryForeground"));
  assert.ok(html.includes("--vscode-sideBar-foreground"));
  assert.ok(html.includes("primary-action"));
  assert.ok(html.includes("button.primary-action,\n    button.secondary"));
  assert.ok(html.includes("button.primary-action:hover,\n    button.secondary:hover"));
  assert.equal(html.includes("color-mix(in srgb, var(--vscode-button-background)"), false);
  assert.ok(html.includes("primary-apply-row"));
  assert.ok(html.includes("colors-divider"));
  assert.ok(html.includes("colors-secondary-row"));
  assert.ok(html.includes("sober-toggle"));
  assert.ok(html.includes("options-grid"));
  assert.ok(html.includes("option-item"));
  assert.ok(html.includes("option-checkbox-group"));
  assert.ok(html.includes("option-help-wrap"));
  assert.ok(html.includes("help-trigger"));
  assert.ok(html.includes("option-help-panel"));
  assert.ok(html.includes('data-help-target="monochromaticHelp"'));
  assert.ok(html.includes('data-help-target="editorAccentHelp"'));
  assert.ok(html.includes("options-stack"));
  assert.ok(html.includes("options-section"));
  assert.ok(html.includes("options-section-title"));
  assert.ok(html.includes('<section class="actions" aria-label="Actions">'));
  assert.ok(html.includes("actions-head"));
  assert.ok(html.includes("actions-container"));
  assert.equal(html.includes("options-actions"), false);
  assert.ok(html.includes("choose from the list..."));
  assert.ok(html.includes("No presets in this group"));
  assert.ok(html.includes("select.placeholder"));
  assert.ok(html.includes("let selectedFavoriteName;"));
  assert.ok(html.includes('let activePresetFilter = "all";'));
  assert.ok(html.includes("syncPresetFilterButtons"));
  assert.ok(html.includes('id="favoriteModal"'));
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('id="favoriteNameInput"'));
  assert.ok(html.includes("openSaveFavoriteModal"));
  assert.ok(html.includes("confirmSaveFavorite"));
  assert.ok(html.includes("closeSaveFavoriteModal"));
  assert.ok(html.includes("favoriteName,"));
  assert.ok(html.includes("selectedFavoriteName = favorite.name;"));
  assert.ok(html.includes('elements.favorites.addEventListener("change", () =>'));
  assert.equal(html.includes('id="applyFavorite"'), false);
  assert.equal(html.includes(">Apply favourite<"), false);
  assert.ok(html.includes("img-src vscode-webview:;"));
  assert.ok(html.includes("brand-lockup"));
  assert.ok(html.includes("title-icon"));
  assert.ok(html.includes("camaleone-sil-2.png"));
  assert.ok(html.includes("save-favorite-icon"));
  assert.ok(html.includes("camaleone-sil-3.png"));
  assert.ok(html.includes("color-picker.png"));
  assert.ok(html.includes("undo.png"));
  assert.ok(html.includes("const colorPickerIconSrc = state.pickerIcons && state.pickerIcons.colorPicker"));
  assert.ok(html.includes("const surpriseDistinctProbability = 0.8;"));
  assert.ok(html.includes("const surpriseDistinctHueMin = 135;"));
  assert.ok(html.includes("const surpriseSimilarHueMax = 42;"));
  assert.ok(html.includes("function createSurpriseEndHsl(startHsl, distinctive)"));
  assert.ok(html.includes("Generated a distinctive color pair."));
  assert.ok(html.includes("surface-picker-icon-image"));
  assert.ok(html.includes("filter: var(--surface-picker-filter, brightness(0));"));
  assert.ok(html.includes('element.style.setProperty("--surface-picker-filter", useLightInk ? "brightness(0) invert(1)" : "brightness(0)");'));
  assert.ok(html.includes('pickerIcon.src = colorPickerIconSrc;'));
  assert.ok(html.includes('id="saveFavorite" class="secondary"'));
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
  assert.ok(html.includes("updatePreviewAndApply(60)"));
  assert.ok(html.includes("updatePreviewAndApply(80);"));
  assert.ok(html.includes("updatePreviewAndApply(120);"));
  assert.ok(html.includes("updatePreviewAndApply(180);"));
  assert.ok(html.includes("registerHelpPopups"));
  assert.ok(html.includes("toggleHelpPopup"));
  assert.ok(html.includes("closeHelpPopups"));
  assert.ok(html.includes("const suggested = solidHex(getGeneratedSurfaceColors({}, true)[surfaceId])"));
  assert.ok(html.includes("resetButton.innerHTML"));
  assert.ok(html.includes("let applyTimer;"));
  assert.ok(html.includes('elements.intensity.addEventListener("input", () => updatePreviewAndApply(60));'));
  assert.ok(html.includes('elements.intensity.addEventListener("change", () => updatePreviewAndApply(0));'));
  assert.equal(html.includes("elements.applyTo"), false);
  assert.ok(html.includes('elements.includeEditorAccent.addEventListener("change", () => updatePreviewAndApply(0));'));
  assert.ok(html.includes('elements.sober.addEventListener("change", () => updatePreviewAndApply(0));'));
  assert.ok(html.includes('elements.panelHarmony.addEventListener("change", () => updatePreviewAndApply(0));'));
  assert.ok(html.includes('updatePreviewAndApply(0);'));
  assert.ok(html.includes('applyTo: "workspace"'));
  assert.ok(html.includes('vscode.postMessage({ type: "applyFavorite", favoriteId: favorite.id });'));
  assert.equal(html.includes("Click Apply colors to write it."), false);
  assert.ok(html.includes("function scheduleApply(delay)"));
  assert.equal(html.includes("syncEndFromRelationship"), false);
  assert.equal(html.includes("getEffectiveEndColor"), false);
  assert.equal(html.includes("relatedEndColor"), false);

  assert.ok(html.indexOf('id="apply"') < html.indexOf('class="colors-divider"'));
  assert.ok(html.indexOf('class="colors-divider"') < html.indexOf('id="surprise"'));
  assert.ok(html.indexOf('id="surprise"') < html.indexOf('id="sober"'));

  const customizeIndex = html.indexOf('<div class="customize-head">');
  const saveIndex = html.indexOf('id="saveFavorite"');
  const resetIndex = html.indexOf('id="resetDefault"');
  const optionsIndex = html.indexOf('<section class="extras"');
  const optionsStackIndex = html.indexOf('<div class="options-stack">');
  const actionsIndex = html.indexOf('<section class="actions"');
  const colorsIndex = html.indexOf('<section class="controls" aria-label="Color picker">');
  const soberIndex = html.indexOf('id="sober"');
  const paletteIndex = html.indexOf('<section class="preview" aria-label="Color palette preview">');
  const customizePanelIndex = html.indexOf('<section class="customize" aria-label="Customize colors">');
  assert.ok(customizeIndex >= 0 && customizeIndex < optionsIndex);
  assert.ok(colorsIndex >= 0);
  assert.ok(soberIndex > colorsIndex && soberIndex < paletteIndex);
  assert.ok(paletteIndex > colorsIndex);
  assert.ok(customizePanelIndex > paletteIndex);
  assert.ok(optionsStackIndex > customizePanelIndex);
  assert.ok(optionsIndex > optionsStackIndex);
  assert.ok(actionsIndex > optionsIndex);
  assert.ok(saveIndex > actionsIndex);
  assert.ok(saveIndex > resetIndex);
  assert.ok(html.indexOf('id="surpriseNote"') > colorsIndex && html.indexOf('id="surpriseNote"') < paletteIndex);
});

test("activity bar picker keeps surface customization in the first preview cards", () => {
  const baseState = {
    ...testApi.DEFAULT_CHOICES,
    favorites: [],
    surfaces: testApi.SURFACE_CONFIGS,
    defaultChoices: testApi.DEFAULT_CHOICES,
    baseColor: "#1e1e1e",
    hasWorkspace: true,
    pickerIcons: {
      colorPicker: "vscode-webview://icons/color-picker.png",
      undo: "vscode-webview://icons/undo.png"
    }
  };
  const standardHtml = testApi.getPickerHtml({ cspSource: "vscode-webview:" }, baseState);
  const activityHtml = testApi.getPickerHtml({ cspSource: "vscode-webview:" }, {
    ...baseState,
    layout: "activityBar"
  });

  assert.ok(standardHtml.includes('<body class="standard-pane">'));
  assert.ok(standardHtml.includes('<section class="customize" aria-label="Customize colors">'));
  assert.ok(activityHtml.includes('<body class="activity-pane">'));
  assert.equal(activityHtml.includes('<section class="customize" aria-label="Customize colors">'), false);
  assert.ok(activityHtml.includes("surface-control-inline"));
  assert.ok(activityHtml.includes("surface-inline-head"));
  assert.ok(activityHtml.includes("surface-inline-actions"));
  assert.ok(activityHtml.includes("field-label surface-color-title"));
  assert.ok(activityHtml.includes("body.activity-pane .preview"));
  assert.ok(activityHtml.includes("grid-template-columns: repeat(2, minmax(0, 1fr));"));
  assert.ok(activityHtml.includes("grid-auto-rows: 78px;"));
  assert.ok(activityHtml.includes("gap: 1px;"));
  assert.ok(activityHtml.includes("column-gap: 1px;"));
  assert.ok(activityHtml.includes("row-gap: 3px;"));
  assert.ok(activityHtml.includes("align-items: stretch;"));
  assert.ok(activityHtml.includes("grid-template-rows: minmax(0, 1fr) auto;"));
  assert.ok(activityHtml.includes("grid-template-rows: 18px 22px;"));
  assert.ok(activityHtml.includes("grid-template-columns: minmax(0, 1fr) 22px;"));
  assert.ok(activityHtml.includes("background: rgba(127, 127, 127, 0.16);"));
  assert.ok(activityHtml.includes("background: rgba(127, 127, 127, 0.14);"));
  assert.ok(activityHtml.includes("height: 46px;"));
  assert.ok(activityHtml.includes("height: 100%;"));
  assert.ok(activityHtml.includes("height: 22px;"));
  assert.ok(activityHtml.includes("min-height: 0;"));
  assert.ok(activityHtml.includes("width: 14px;"));
  assert.ok(activityHtml.includes("font-size: 9.5px;"));
  assert.ok(activityHtml.includes("min-height: 12px;"));
  assert.ok(activityHtml.includes("text-overflow: ellipsis;"));
  assert.ok(activityHtml.includes("white-space: nowrap;"));
  assert.ok(activityHtml.includes("overflow: hidden;"));
  assert.ok(activityHtml.includes("@media (max-width: 320px)"));
  assert.ok(activityHtml.includes("surface-color-button"));
  assert.ok(activityHtml.includes("surface-picker-icon"));
  assert.ok(activityHtml.includes("surface-picker-icon-image"));
  assert.ok(activityHtml.includes("color-picker.png"));
  assert.ok(activityHtml.includes("undo.png"));
  assert.ok(activityHtml.includes("brightness(0) invert(1)"));
  assert.ok(activityHtml.includes("brightness(0)"));
  assert.ok(activityHtml.includes("surface-native-color"));
  assert.ok(activityHtml.includes("surface-hidden-text"));
  assert.ok(activityHtml.includes("surface-preview-generated"));
  assert.ok(activityHtml.includes("setActivityPaneActionContrast"));
  assert.ok(activityHtml.includes("--surface-action-foreground"));
  assert.ok(activityHtml.includes("--surface-action-border"));
  assert.ok(activityHtml.includes("rgba(255, 255, 255, 0.62)"));
  assert.ok(activityHtml.includes("rgba(0, 0, 0, 0.48)"));
  assert.ok(activityHtml.includes("border-color: transparent;"));
  assert.ok(activityHtml.includes("opacity: 0.18;"));
  assert.ok(activityHtml.includes("opacity: 0.92;"));
  assert.ok(activityHtml.includes("surface-reset-icon"));
  assert.ok(activityHtml.includes("resetButton.classList.add(\"surface-reset-icon\");"));
  assert.ok(activityHtml.includes("actions.append(pickerButton, resetButton);"));
  assert.ok(activityHtml.includes("color.click();"));
  assert.ok(activityHtml.indexOf("inlineHead.append(label);") < activityHtml.indexOf("actions.append(pickerButton, resetButton);"));
  assert.equal(activityHtml.includes("surface-color-label"), false);
  const resetRuleStart = activityHtml.indexOf("body.activity-pane .surface-reset {");
  const resetRuleEnd = activityHtml.indexOf("body.activity-pane .surface-reset:hover {");
  const resetRule = activityHtml.slice(resetRuleStart, resetRuleEnd);
  assert.ok(resetRuleStart >= 0 && resetRuleEnd > resetRuleStart);
  assert.equal(resetRule.includes("position: absolute"), false);
  assert.equal(resetRule.includes("top: 8px"), false);
  assert.equal(resetRule.includes("right: 8px"), false);
  assert.ok(activityHtml.includes('const isActivityPane = state && state.layout === "activityBar";'));
  assert.ok(activityHtml.indexOf('<div class="gradient-strip"></div>') < activityHtml.indexOf('<div id="surfacePreview" class="surface-grid"></div>'));
  assert.ok(activityHtml.indexOf('<section class="preview" aria-label="Color palette preview">') < activityHtml.indexOf('<div class="options-stack">'));
  assert.ok(standardHtml.indexOf('<section class="customize" aria-label="Customize colors">') < standardHtml.indexOf('<div class="options-stack">'));
});

test("manifest and generated icon assets use the organized paths", () => {
  const manifest = JSON.parse(textFile("package.json"));
  assert.equal(manifest.version, "0.1.11");
  assert.equal(manifest.publisher, "trentinium");
  assert.equal(manifest.icon, "assets/icons/ico/camaleone_transparent.ico");
  assert.equal(manifest.repository.url, "https://github.com/btrentini/camaleone.git");
  assert.equal(manifest.homepage, "https://www.trentini.fyi/camaleone/");
  assert.equal(manifest.description.length, 94);
  assert.deepEqual(manifest.activationEvents, [
    "onStartupFinished",
    "onView:camaleone.controls"
  ]);
  assert.ok(manifest.description.includes("VS Code Marketplace"));
  assert.ok(manifest.description.includes("Open VSX"));
  assert.ok(manifest.description.includes("Cursor"));
  assert.ok(manifest.description.includes("compatible IDE"));
  assert.ok(manifest.categories.includes("Themes"));
  assert.ok(manifest.categories.includes("Visualization"));
  assert.ok(manifest.keywords.includes("sober-mode"));
  assert.ok(manifest.keywords.includes("visual-controls"));
  assert.ok(manifest.keywords.includes("remote-ssh"));
  assert.equal(manifest.contributes.configuration.properties["camaleone.sober"].default, true);
  assert.equal(manifest.contributes.configuration.properties["camaleone.applyTo"], undefined);
  assert.equal(manifest.contributes.configuration.properties["camaleone.persistChoices"], undefined);
  assert.deepEqual(manifest.contributes.viewsContainers.activitybar[0], {
    id: "camaleone",
    title: "Camaleone",
    icon: "assets/icons/png/camaleone-activity.png"
  });
  assert.equal(manifest.contributes.views.camaleone[0].id, "camaleone.controls");
  assert.equal(manifest.contributes.views.camaleone[0].name, "Setup");
  assert.equal(manifest.contributes.views.camaleone[0].type, "webview");
  assert.equal(manifest.contributes.views.camaleone[0].icon, "assets/icons/ico/camaleone-activity-compact.ico");
  assert.equal(manifest.contributes.views.camaleone[0].visibility, "visible");
  assert.equal(manifest.contributes.views.camaleone[0].when, undefined);
  assert.equal(manifest.contributes.viewsWelcome, undefined);

  const openPickerCommand = manifest.contributes.commands.find((entry) => entry.command === "camaleone.openPicker");
  assert.equal(openPickerCommand.icon.light, "assets/icons/ico/camaleone-activity-compact-light.ico");
  assert.equal(openPickerCommand.icon.dark, "assets/icons/ico/camaleone-activity-compact-dark.ico");
  assert.equal(JSON.stringify(manifest).includes(".svg"), false);

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
    "assets/icons/ico/camaleone-bar-0.ico",
    "assets/icons/ico/camaleone-bar-1.ico",
    "assets/icons/ico/camaleone-activity.ico",
    "assets/icons/ico/camaleone-activity-dark.ico",
    "assets/icons/ico/camaleone-activity-light.ico",
    "assets/icons/ico/camaleone-activity-compact.ico",
    "assets/icons/ico/camaleone-activity-compact-dark.ico",
    "assets/icons/ico/camaleone-activity-compact-light.ico",
    "assets/icons/png/camaleone-activity.png",
    "assets/icons/png/camaleone-activity-dark.png",
    "assets/icons/png/camaleone-activity-light.png",
    "assets/icons/png/color-picker.png",
    "assets/icons/png/undo.png",
    "assets/screenshots/marketplace/camaleone-0.png",
    "assets/screenshots/marketplace/camaleone-1.png",
    "assets/screenshots/marketplace/camaleone-2.png",
    "assets/screenshots/marketplace/camaleone-3.png",
    "assets/screenshots/marketplace/camaleone-4.png",
    "assets/screenshots/marketplace/camaleone-5.png",
    "assets/screenshots/marketplace/camaleone-6.png",
    "assets/screenshots/marketplace/camaleone-7.png",
    "assets/screenshots/marketplace/camaleone-8.png",
    "assets/screenshots/marketplace/camaleone-9.png"
  ]) {
    assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), true, `${relativePath} should exist`);
  }

  for (const relativePath of [
    "assets/icons/ico/camaleone-activity.ico",
    "assets/icons/ico/camaleone-activity-dark.ico",
    "assets/icons/ico/camaleone-activity-light.ico",
    "assets/icons/ico/camaleone-activity-compact.ico",
    "assets/icons/ico/camaleone-activity-compact-dark.ico",
    "assets/icons/ico/camaleone-activity-compact-light.ico"
  ]) {
    const header = binaryFile(relativePath).subarray(0, 4);
    assert.deepEqual([...header], [0, 0, 1, 0], `${relativePath} should be an ICO file`);
  }
  for (const relativePath of [
    "assets/icons/png/camaleone-activity.png",
    "assets/icons/png/camaleone-activity-dark.png",
    "assets/icons/png/camaleone-activity-light.png",
    "assets/icons/png/color-picker.png",
    "assets/icons/png/undo.png"
  ]) {
    const png = binaryFile(relativePath);
    assert.equal(png[25], 6, `${relativePath} should be an RGBA PNG with transparency`);
  }

  const readme = textFile("README.md");
  const websiteScreenshotBase = "https://trentini.fyi/camaleone/assets/screenshots/marketplace";
  const websiteScreenshots = [
    "camaleone-feature-flow.gif",
    "camaleone-v04-6.png",
    "camaleone-v04-1.png",
    "camaleone-v04-3.png",
    "camaleone-v04-4.png",
    "camaleone-v04-5.png"
  ];
  assert.ok(readme.includes("## Screenshots"));
  assert.ok(readme.indexOf("## Screenshots") < readme.indexOf("## How To Use"));
  assert.ok(readme.includes("<td colspan=\"4\">"));
  assert.ok(readme.includes("Camaleone Activity Bar side pane open beside an active editor workspace"));
  assert.ok(readme.includes("https://trentini.fyi/camaleone/"));
  for (const filename of websiteScreenshots) {
    assert.ok(readme.includes(`${websiteScreenshotBase}/${filename}`));
  }
  assert.equal(readme.includes("](assets/screenshots/marketplace/"), false);
  assert.equal(readme.includes("postimg.cc"), false);
});

test("save favourite placeholder uses a non-personal example name", () => {
  const source = textFile("extension.js");
  assert.ok(source.includes("e.g., 'Project Green Focus'"));
  assert.equal(source.includes("Brown Chicken"), false);
});

test("README includes marketplace how-to-use instructions", () => {
  const readme = textFile("README.md");
  assert.ok(readme.includes("## How To Use"));
  assert.ok(readme.includes("Install Camaleone from the VS Code Marketplace or Open VSX"));
  assert.ok(readme.includes("VS Code, Cursor, or a compatible VS Code-based IDE"));
  assert.ok(readme.includes("Fast Activity Bar side-panel flow:"));
  assert.ok(readme.includes("Full picker flow:"));
  assert.ok(readme.includes("Click the Camaleone icon in the Activity Bar"));
  assert.ok(readme.includes("usually located on the left side bar"));
  assert.ok(readme.includes("Run `Camaleone: Open Colour Picker`"));
  assert.ok(readme.includes("for the full picker pane"));
  assert.ok(readme.includes("Use the compact two-column tiles"));
  assert.ok(readme.includes("Click the small revert icon on a tile"));
  assert.ok(readme.includes("favors distinctive color pairs"));
  assert.ok(readme.includes("remote host, buttons, and editor accents"));
  assert.ok(readme.includes("Click `Apply colors` to write the current palette to workspace settings."));
  assert.ok(readme.includes("saves the workspace profile automatically"));
  assert.equal(readme.includes("Global settings"), false);
  assert.ok(readme.includes("Click `Save as favourite...` to store a palette"));
  assert.ok(readme.includes("choose it from the favourites list to apply it later"));
  assert.ok(readme.includes("Use `Restore previous`"));
  assert.ok(readme.indexOf("## How To Use") < readme.indexOf("## Preloaded Favourites"));
});

test("command titles rely on category for the Camaleone prefix", () => {
  const manifest = JSON.parse(textFile("package.json"));
  const command = manifest.contributes.commands.find((entry) => entry.command === "camaleone.openPicker");

  assert.equal(command.category, "Camaleone");
  assert.equal(command.title, "Open Colour Picker");

  for (const entry of manifest.contributes.commands) {
    assert.equal(entry.category, "Camaleone");
    assert.equal(entry.title.startsWith("Camaleone:"), false);
  }
});

test("README includes official overview, info links, and feature copy", () => {
  const readme = textFile("README.md");
  assert.ok(readme.includes("Camaleone is a VS Code Marketplace and Open VSX extension"));
  assert.ok(readme.includes("VS Code, Cursor, and compatible VS Code-based IDE workspaces"));
  assert.ok(readme.includes("the VSIX package works in VS Code, Cursor, and compatible VS Code-based IDEs"));
  assert.ok(readme.includes("Users of this extension have a big deal of freedom!"));
  assert.ok(readme.includes("## More info"));
  assert.ok(readme.includes("## Overview"));
  assert.ok(readme.includes("distinct identity"));
  assert.ok(readme.includes("default `Sober` mode"));
  assert.ok(readme.includes("customize individual surfaces"));
  assert.ok(readme.includes("Activity Bar side pane, visible by default"));
  assert.ok(readme.includes("Automatic workspace profile saving"));
  assert.ok(readme.includes("Save favourite palettes"));
  assert.ok(readme.includes("README media is intentionally loaded from the live website"));
  assert.ok(readme.includes("## Feature Highlights"));
  assert.ok(readme.includes("## What Users Say"));
  assert.ok(readme.includes("> \"Loving it! Installed and in use!!\""));
  assert.ok(readme.includes("> \"easy to use. great interface\""));
  assert.ok(readme.includes("> \"It's just beautiful\""));
  assert.ok(readme.includes("Main command:"));
  assert.ok(readme.includes("Secondary commands:"));
  assert.ok(readme.includes("opens the customization interface for choosing colors"));
  assert.ok(readme.includes("[Get in touch](https://trentini.fyi/camaleone/)"));
  assert.ok(readme.includes("[Buy me a coffee](https://trentini.fyi/camaleone/#support)"));
  assert.ok(readme.indexOf("## Overview") < readme.indexOf("## How To Use"));
  assert.equal(readme.includes("## Settings"), false);
  assert.equal(readme.includes("## Customization Notes"), false);
});

test("README lists default Magnificent 7, university, and World Cup favourites", () => {
  const readme = textFile("README.md");
  assert.ok(readme.includes("## Preloaded Favourites"));
  assert.ok(readme.includes("Magnificent 7"));
  assert.ok(readme.includes("NVIDIA (`#76b900`)"));
  assert.ok(readme.includes("QS 2026 top 10 universities"));
  assert.ok(readme.includes("Stanford University (`#8c1515` and `#dad7cb`)"));
  assert.ok(readme.includes("National University of Singapore (NUS)"));
  assert.ok(readme.includes("top 15 FIFA men's national teams"));
  assert.ok(readme.includes("World Cup: France (`#002654` and `#ed2939`)"));
  assert.ok(readme.includes("Mexico"));
  assert.ok(readme.includes("To edit a preloaded favourite"));
  assert.ok(readme.includes("prefilled with the preset name"));
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

  assert.ok(args.includes("--new-window"));
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
