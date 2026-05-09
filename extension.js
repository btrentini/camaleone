/**
 * Camaleone VS Code/Cursor extension entry point.
 *
 * This file owns command registration, palette generation, favorite storage,
 * workbench color patching, and the picker webview.
 */
const vscode = require("vscode");

const EXTENSION_PREFIX = "camaleone";
const ACTIVITY_VIEW_ID = "camaleone.controls";

const LAST_CHOICES_KEY = `${EXTENSION_PREFIX}.lastChoices`;
const FAVORITES_KEY = `${EXTENSION_PREFIX}.favorites`;
const PROFILE_ACTIVE_KEY = `${EXTENSION_PREFIX}.profileActive`;
const SOBER_SIDE_BAR_GENERATED_COLOR_WEIGHT = 0.42;
const SURPRISE_DISTINCT_PROBABILITY = 0.8;
const SURPRISE_DISTINCT_HUE_MIN = 135;
const SURPRISE_DISTINCT_HUE_MAX = 225;
const SURPRISE_SIMILAR_HUE_MIN = 18;
const SURPRISE_SIMILAR_HUE_MAX = 42;
const WORKSPACE_PROFILE_SETTING_KEYS = [
  "startColor",
  "endColor",
  "intensity",
  "includeEditorAccent",
  "monochromatic",
  "sober",
  "colorRelationship",
  "panelHarmony",
  "surfaceOverrides",
  "profileActive"
];

/**
 * Workbench color customization keys managed by Camaleone.
 *
 * Restore and reset operations only touch these keys so unrelated user theme
 * customizations remain in place.
 */
const EXTENSION_COLOR_KEYS = [
  "activityBar.background",
  "activityBar.foreground",
  "activityBar.inactiveForeground",
  "activityBarBadge.background",
  "activityBarBadge.foreground",
  "badge.background",
  "badge.foreground",
  "button.background",
  "button.foreground",
  "button.hoverBackground",
  "button.secondaryBackground",
  "button.secondaryForeground",
  "button.secondaryHoverBackground",
  "commandCenter.activeBackground",
  "commandCenter.activeBorder",
  "commandCenter.activeForeground",
  "commandCenter.background",
  "commandCenter.border",
  "commandCenter.debuggingBackground",
  "commandCenter.foreground",
  "commandCenter.inactiveBorder",
  "commandCenter.inactiveForeground",
  "editorGroup.border",
  "focusBorder",
  "list.activeSelectionBackground",
  "list.activeSelectionForeground",
  "list.hoverBackground",
  "list.inactiveSelectionBackground",
  "panel.border",
  "panelTitle.activeBorder",
  "sideBar.background",
  "sideBar.foreground",
  "sideBarSectionHeader.background",
  "sideBarSectionHeader.foreground",
  "sideBarTitle.foreground",
  "statusBar.background",
  "statusBar.debuggingBackground",
  "statusBar.foreground",
  "statusBar.noFolderBackground",
  "statusBarItem.hoverBackground",
  "statusBarItem.remoteBackground",
  "statusBarItem.remoteForeground",
  "statusBarItem.remoteHoverBackground",
  "statusBarItem.remoteHoverForeground",
  "tab.activeBorderTop",
  "terminalCursor.foreground",
  "titleBar.activeBackground",
  "titleBar.activeForeground",
  "titleBar.inactiveBackground",
  "titleBar.inactiveForeground",
  "editor.findMatchBackground",
  "editor.lineHighlightBackground",
  "editor.selectionBackground",
  "editorCursor.foreground",
  "editorLink.activeForeground"
];

/**
 * User-facing surfaces that the picker can preview and customize.
 *
 * The sample value is the position along the start-to-end palette, and strength
 * controls how strongly the generated color is blended into the active theme.
 */
const SURFACE_CONFIGS = [
  {
    id: "titleBar",
    label: "Title Bar",
    sample: 0,
    strength: 1,
    description: "Top window chrome. This is the fastest way to identify a project."
  },
  {
    id: "activityBar",
    label: "Activity Bar",
    sample: 0.12,
    strength: 1,
    description: "Left icon rail for Explorer, Search, Source Control, and extensions."
  },
  {
    id: "sideBar",
    label: "Side Bar",
    sample: 0.34,
    strength: 1,
    description: "Explorer and side-panel background."
  },
  {
    id: "panel",
    label: "Panel and Borders",
    sample: 0.34,
    strength: 0.9,
    description: "Panel lines, active tab accents, focus rings, and selections."
  },
  {
    id: "statusBar",
    label: "Status Bar",
    sample: 1,
    strength: 1,
    description: "Bottom bar. Usually the strongest end-color signal."
  },
  {
    id: "remoteIndicator",
    label: "Remote Host",
    sample: 0.08,
    strength: 1,
    description: "Bottom-left Remote/SSH indicator that shows the connected machine name."
  },
  {
    id: "buttons",
    label: "Buttons and Badges",
    sample: 0.86,
    strength: 1,
    description: "Primary buttons, badges, and small action surfaces."
  },
  {
    id: "editorAccent",
    label: "Editor Accents",
    sample: 0.5,
    strength: 1,
    description: "Cursor, links, selection, line highlight, and find match color."
  }
];

/**
 * Baseline picker state used for fresh installs, reset flows, and tests.
 */
const DEFAULT_CHOICES = {
  startColor: "#0ea5e9",
  endColor: "#f97316",
  intensity: 100,
  applyTo: "workspace",
  includeEditorAccent: false,
  monochromatic: false,
  sober: true,
  colorRelationship: "manual",
  panelHarmony: "manual",
  surfaceOverrides: {}
};

const PRESET_GROUPS = {
  MAGNIFICENT_7: "magnificent-7",
  QS_WORLD_TOP_10: "qs-world-top-10",
  WORLD_CUP: "world-cup"
};

const PRESET_FILTERS = [
  { id: "all", label: "All presets" },
  { id: PRESET_GROUPS.MAGNIFICENT_7, label: "Magnificent 7" },
  { id: PRESET_GROUPS.QS_WORLD_TOP_10, label: "QS Top 10 Universities" },
  { id: PRESET_GROUPS.WORLD_CUP, label: "World Cup" }
];

/**
 * Built-in editable presets exposed in the favorites list.
 */
const DEFAULT_FAVORITES = [
  defaultFavorite("magnificent-7-apple", "Apple", "#000000", "#a2aaad"),
  defaultFavorite("magnificent-7-microsoft", "Microsoft", "#f25022", "#00a4ef", {
    panel: "#ffb900",
    buttons: "#7fba00"
  }),
  defaultFavorite("magnificent-7-alphabet", "Alphabet", "#4285f4", "#34a853", {
    panel: "#ea4335",
    buttons: "#fbbc05"
  }),
  defaultFavorite("magnificent-7-amazon", "Amazon", "#ff9900", "#146eb4"),
  defaultFavorite("magnificent-7-meta", "Meta", "#0866ff", "#1c2b33"),
  defaultFavorite("magnificent-7-nvidia", "NVIDIA", "#76b900", "#000000"),
  defaultFavorite("magnificent-7-tesla", "Tesla", "#e82127", "#171a20"),
  defaultFavorite("qs-2026-mit", "Massachusetts Institute of Technology (MIT)", "#750014", "#8b959e"),
  defaultFavorite("qs-2026-imperial", "Imperial College London", "#002147", "#003e74"),
  defaultFavorite("qs-2026-stanford", "Stanford University", "#8c1515", "#dad7cb"),
  defaultFavorite("qs-2026-oxford", "University of Oxford", "#002147", "#ffffff"),
  defaultFavorite("qs-2026-harvard", "Harvard University", "#a41034", "#1e1e1e"),
  defaultFavorite("qs-2026-cambridge", "University of Cambridge", "#85b09a", "#1f4e5f"),
  defaultFavorite("qs-2026-eth-zurich", "ETH Zurich", "#215caf", "#000000"),
  defaultFavorite("qs-2026-nus", "National University of Singapore (NUS)", "#ef7c00", "#003d7c"),
  defaultFavorite("qs-2026-ucl", "UCL", "#000000", "#00a3e0"),
  defaultFavorite("qs-2026-caltech", "California Institute of Technology (Caltech)", "#ff6c0c", "#1d1d1d"),
  defaultFavorite("world-cup-france", "France", "#002654", "#ed2939", {
    panel: "#ffffff",
    buttons: "#ed2939"
  }),
  defaultFavorite("world-cup-spain", "Spain", "#ad1519", "#fabd00"),
  defaultFavorite("world-cup-argentina", "Argentina", "#75aadb", "#fcbf49", {
    panel: "#ffffff",
    buttons: "#843511"
  }),
  defaultFavorite("world-cup-england", "England", "#c8102e", "#ffffff"),
  defaultFavorite("world-cup-portugal", "Portugal", "#046a38", "#da291c", {
    panel: "#ffe900",
    buttons: "#002d72"
  }),
  defaultFavorite("world-cup-brazil", "Brazil", "#009c3b", "#ffdf00", {
    panel: "#002776",
    buttons: "#ffffff"
  }),
  defaultFavorite("world-cup-netherlands", "Netherlands", "#ae1c28", "#21468b", {
    panel: "#ffffff"
  }),
  defaultFavorite("world-cup-morocco", "Morocco", "#c1272d", "#006233"),
  defaultFavorite("world-cup-belgium", "Belgium", "#000000", "#fdda24", {
    panel: "#ef3340",
    buttons: "#fdda24"
  }),
  defaultFavorite("world-cup-germany", "Germany", "#000000", "#c1121c", {
    panel: "#ff9b00",
    buttons: "#c1121c"
  })
];

let pickerPanel;

/**
 * Creates one built-in favorite entry using the same shape as saved favorites.
 */
function defaultFavorite(id, name, startColor, endColor, surfaceOverrides = {}) {
  return {
    ...DEFAULT_CHOICES,
    id: `default-${id}`,
    name,
    createdAt: "built-in",
    builtin: true,
    startColor,
    endColor,
    sober: false,
    colorRelationship: "manual",
    panelHarmony: "manual",
    presetGroup: presetGroupForFavoriteId(id),
    surfaceOverrides
  };
}

function presetGroupForFavoriteId(id) {
  if (id.startsWith(`${PRESET_GROUPS.MAGNIFICENT_7}-`)) {
    return PRESET_GROUPS.MAGNIFICENT_7;
  }
  if (id.startsWith("qs-2026-")) {
    return PRESET_GROUPS.QS_WORLD_TOP_10;
  }
  if (id.startsWith(`${PRESET_GROUPS.WORLD_CUP}-`)) {
    return PRESET_GROUPS.WORLD_CUP;
  }
  return "";
}

/**
 * Builds a neutral picker state that lets the active editor theme take over.
 */
function createIdeDefaultChoices() {
  const baseColor = baseColorForTheme();
  return {
    ...DEFAULT_CHOICES,
    startColor: baseColor,
    endColor: baseColor,
    applyTo: DEFAULT_CHOICES.applyTo,
    includeEditorAccent: false,
    monochromatic: false,
    sober: DEFAULT_CHOICES.sober,
    colorRelationship: "manual",
    panelHarmony: "manual",
    surfaceOverrides: {}
  };
}

/**
 * Registers all extension commands when VS Code activates Camaleone.
 */
function activate(context) {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ACTIVITY_VIEW_ID,
      createActivityBarWebviewProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand("camaleone.openPicker", () => openPicker(context)),
    vscode.commands.registerCommand("camaleone.quickApply", () => quickApply(context)),
    vscode.commands.registerCommand("camaleone.applyConfigured", () => applyConfigured(context)),
    vscode.commands.registerCommand("camaleone.clear", () => clearGradient(context)),
    vscode.commands.registerCommand("camaleone.resetToDefault", () => resetToDefault(context)),
    vscode.commands.registerCommand("camaleone.surpriseMe", () => surpriseMeCommand(context)),
    vscode.commands.registerCommand("camaleone.saveFavorite", () => saveCurrentFavoriteCommand(context)),
    vscode.commands.registerCommand("camaleone.applyFavorite", () => applyFavoriteCommand(context))
  );

  void applySavedWorkspaceProfileOnActivation(context);
}

/**
 * VS Code deactivate hook. Camaleone has no long-lived disposables outside the
 * subscriptions registered during activation.
 */
function deactivate() {}

/**
 * Reapplies a saved workspace profile on activation when durable settings say
 * Camaleone should own the workspace colors.
 */
async function applySavedWorkspaceProfileOnActivation(context) {
  if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders.length) {
    return false;
  }

  const target = resolveTarget();
  if (!shouldReplaySavedWorkspaceProfile(context, target)) {
    return false;
  }

  await applyColors(context, getCurrentChoices(context));
  return true;
}

/**
 * Decides whether a saved workspace profile should be replayed on activation.
 */
function shouldReplaySavedWorkspaceProfile(context, target) {
  const config = vscode.workspace.getConfiguration();
  const hasProfile = hasSavedWorkspaceProfile(context);
  if (!hasProfile) {
    return false;
  }

  const activeInspection = config.inspect(PROFILE_ACTIVE_KEY);
  if (hasConfiguredValue(activeInspection)) {
    return Boolean(config.get(PROFILE_ACTIVE_KEY, false));
  }

  const state = getMemento(context, target);
  if (state.get(stateKey(target, "active"), false)) {
    return true;
  }

  return hasConfiguredWorkspaceProfile(config);
}

/**
 * Checks whether this workspace has a saved Camaleone profile to replay.
 */
function hasSavedWorkspaceProfile(context) {
  const remembered = context.workspaceState.get(LAST_CHOICES_KEY, {});
  if (isPlainObject(remembered) && (remembered.startColor || remembered.endColor)) {
    return true;
  }

  return hasConfiguredWorkspaceProfile(vscode.workspace.getConfiguration());
}

/**
 * Checks whether durable workspace settings contain a Camaleone profile.
 */
function hasConfiguredWorkspaceProfile(config) {
  return ["startColor", "endColor"].some((key) => hasConfiguredValue(config.inspect(`${EXTENSION_PREFIX}.${key}`)));
}

/**
 * Provides the same picker inside the Activity Bar container.
 */
function createActivityBarWebviewProvider(context) {
  return {
    resolveWebviewView(webviewView) {
      renderPickerWebview(context, webviewView.webview, {
        ...createPickerInitialState(context),
        layout: "activityBar"
      });
      registerPickerMessageHandler(context, webviewView.webview);
    }
  };
}

/**
 * Opens the full webview picker and wires browser messages back to extension
 * commands.
 */
async function openPicker(context) {
  if (pickerPanel) {
    pickerPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  pickerPanel = vscode.window.createWebviewPanel(
    "camaleonePicker",
    "Camaleone",
    vscode.ViewColumn.One,
    createPickerPanelOptions(context)
  );

  renderPickerWebview(context, pickerPanel.webview);
  pickerPanel.onDidDispose(() => {
    pickerPanel = undefined;
  }, null, context.subscriptions);

  registerPickerMessageHandler(context, pickerPanel.webview);
}

/**
 * Builds the current picker state shared by panel and Activity Bar webviews.
 */
function createPickerInitialState(context) {
  const choices = getCurrentChoices(context);
  return {
    ...choices,
    favorites: getFavorites(context),
    presetFilters: PRESET_FILTERS,
    surfaces: SURFACE_CONFIGS,
    defaultChoices: DEFAULT_CHOICES,
    baseColor: baseColorForTheme(),
    hasWorkspace: Boolean(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length)
  };
}

/**
 * Renders the shared picker UI into the provided webview.
 */
function renderPickerWebview(context, webview, state = createPickerInitialState(context)) {
  webview.options = createPickerWebviewOptions(context);
  webview.html = getPickerHtml(webview, {
    ...state,
    pickerIcons: createPickerIconUris(context, webview)
  });
}

/**
 * Wires picker browser messages from either the panel or the Activity Bar view.
 */
function registerPickerMessageHandler(context, webview) {
  webview.onDidReceiveMessage(async (message) => {
    if (!message || typeof message.type !== "string") {
      return;
    }

    // Applying writes generated workbench colors and the workspace profile.
    if (message.type === "apply") {
      try {
        const result = await applyColors(context, message);
        postWebviewStatus(webview, "ok", `Applied ${result.startColor} to ${result.endColor} in workspace settings.`);
      } catch (error) {
        postWebviewStatus(webview, "error", error instanceof Error ? error.message : String(error));
      }
    }

    if (message.type === "clear") {
      await clearGradient(context);
      postWebviewStatus(webview, "ok", "Restored the previous Camaleone-tracked colors.");
    }

    // Reset removes Camaleone-managed color keys and then refreshes local picker state.
    if (message.type === "resetDefault") {
      const targets = await resetIdeDefaults(context);
      const resetChoices = createIdeDefaultChoices();
      await context.workspaceState.update(LAST_CHOICES_KEY, resetChoices);
      postWebviewStatus(webview, "ok", `Reset ${formatTargetLabels(targets)} colors to IDE defaults.`);
      webview.postMessage({ type: "resetLocal", choices: resetChoices });
    }

    // Favorite actions round-trip through extension state so built-ins and saved overrides stay consistent.
    if (message.type === "saveFavorite") {
      try {
        const favorites = await saveFavorite(context, message, { promptForName: false });
        webview.postMessage({ type: "favorites", favorites });
        postWebviewStatus(webview, "ok", "Saved favourite color set.");
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        if (text !== "cancelled") {
          postWebviewStatus(webview, "error", text);
        }
      }
    }

    if (message.type === "deleteFavorite") {
      const favorites = await deleteFavorite(context, message.favoriteId);
      webview.postMessage({ type: "favorites", favorites });
      postWebviewStatus(webview, "ok", "Deleted favourite color set.");
    }

    if (message.type === "applyFavorite") {
      try {
        const result = await applyFavoriteById(context, message.favoriteId);
        postWebviewStatus(webview, "ok", `Applied ${result.startColor} to ${result.endColor} in workspace settings.`);
      } catch (error) {
        postWebviewStatus(webview, "error", error instanceof Error ? error.message : String(error));
      }
    }
  }, null, context.subscriptions);
}

/**
 * Sends a status line to the picker webview that originated the action.
 */
function postWebviewStatus(webview, level, text) {
  if (!webview || typeof webview.postMessage !== "function") {
    return;
  }
  webview.postMessage({ type: "status", level, text });
}

/**
 * Runs a minimal native input flow for users who cannot or do not want to open
 * the webview picker.
 */
async function quickApply(context) {
  const current = getCurrentChoices(context);
  const startColor = await vscode.window.showInputBox({
    title: "Camaleone",
    prompt: "Start color",
    value: current.startColor,
    validateInput: validateHexInput
  });

  if (!startColor) {
    return;
  }

  const endColor = await vscode.window.showInputBox({
    title: "Camaleone",
    prompt: "End color",
    value: current.endColor,
    validateInput: validateHexInput
  });

  if (!endColor) {
    return;
  }

  const intensityInput = await vscode.window.showInputBox({
    title: "Camaleone",
    prompt: "Intensity from 0 to 100",
    value: String(current.intensity),
    validateInput: (value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100
        ? undefined
        : "Use a number from 0 to 100.";
    }
  });

  if (!intensityInput) {
    return;
  }

  await applyColorsWithMessage(context, {
    ...current,
    startColor,
    endColor,
    intensity: Number(intensityInput)
  });
}

/**
 * Applies the currently remembered/configured choices.
 */
async function applyConfigured(context) {
  await applyColorsWithMessage(context, getCurrentChoices(context));
}

/**
 * Generates a random readable palette and applies it immediately.
 */
async function surpriseMeCommand(context) {
  const current = getCurrentChoices(context);
  const palette = createSurprisePalette();
  await applyColorsWithMessage(context, {
    ...current,
    startColor: palette.startColor,
    endColor: palette.endColor,
    monochromatic: false,
    colorRelationship: palette.relationship,
    panelHarmony: palette.relationship,
    surfaceOverrides: {}
  });
}

/**
 * Saves the current choices as a named favorite from a command-palette flow.
 */
async function saveCurrentFavoriteCommand(context) {
  try {
    await saveFavorite(context, getCurrentChoices(context));
    vscode.window.showInformationMessage("Camaleone saved the current colors as a favourite.");
  } catch (error) {
    if ((error instanceof Error ? error.message : String(error)) !== "cancelled") {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * Lets users pick and apply a favorite without opening the webview picker.
 */
async function applyFavoriteCommand(context) {
  const favorites = getFavorites(context);
  if (!favorites.length) {
    vscode.window.showInformationMessage("Camaleone has no saved favourites yet.");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    favorites.map((favorite) => ({
      label: favorite.name,
      description: `${favorite.startColor} -> ${favorite.endColor}`,
      favorite
    })),
    { placeHolder: "Choose a Camaleone favourite" }
  );

  if (!picked) {
    return;
  }

  try {
    const result = await applyFavoriteById(context, picked.favorite.id);
    vscode.window.showInformationMessage(
      `Camaleone applied ${result.startColor} to ${result.endColor} in workspace settings.`
    );
  } catch (error) {
    vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Applies colors and reports the outcome through VS Code notifications.
 */
async function applyColorsWithMessage(context, options) {
  try {
    const result = await applyColors(context, options);
    vscode.window.showInformationMessage(
      `Camaleone applied ${result.startColor} to ${result.endColor} in workspace settings.`
    );
  } catch (error) {
    vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Sanitizes incoming choices, generates workbench colors, and persists them to
 * workspace settings.
 */
async function applyColors(context, options) {
  const choices = sanitizeChoices(options);
  const target = resolveTarget();
  const generatedColors = createColorCustomizations(choices);

  await saveExtensionSettings(context, choices, target);
  await patchWorkbenchColors(context, generatedColors, target);

  return {
    startColor: choices.startColor,
    endColor: choices.endColor,
    targetLabel: target.label
  };
}

/**
 * Restores the colors that existed before Camaleone last patched a target.
 */
async function clearGradient(context) {
  const target = resolveTarget();
  const didClear = await restoreWorkbenchColors(context, target);
  if (didClear || hasSavedWorkspaceProfile(context)) {
    await setWorkspaceProfileActive(target, false);
  }
  vscode.window.showInformationMessage(
    didClear
      ? "Camaleone restored colors from workspace settings."
      : "Camaleone did not find tracked colors in workspace settings."
  );
}

/**
 * Removes Camaleone-managed color customizations so the editor theme defaults
 * become visible again.
 */
async function resetToDefault(context) {
  const targets = await resetIdeDefaults(context);
  await context.workspaceState.update(LAST_CHOICES_KEY, createIdeDefaultChoices());
  vscode.window.showInformationMessage(`Camaleone reset ${formatTargetLabels(targets)} colors to IDE defaults.`);
}

/**
 * Resets the current workspace target.
 */
async function resetIdeDefaults(context) {
  const targets = getResetTargets();

  for (const target of targets) {
    await resetWorkbenchDefaults(context, target);
  }

  return targets;
}

/**
 * Returns the settings scopes that can be reset in the current window.
 */
function getResetTargets() {
  return [resolveTarget()];
}

/**
 * Formats target labels for short user-facing status messages.
 */
function formatTargetLabels(targets) {
  const labels = targets.map((target) => target.label);
  if (labels.length <= 1) {
    return labels[0] || "IDE";
  }
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * Merges remembered choices with explicit extension settings.
 */
function getCurrentChoices(context) {
  const config = vscode.workspace.getConfiguration();
  const remembered = context.workspaceState.get(LAST_CHOICES_KEY, {});

  return sanitizeChoices({
    startColor:
      remembered.startColor
      || getConfiguredValue(config, "startColor", DEFAULT_CHOICES.startColor),
    endColor:
      remembered.endColor
      || getConfiguredValue(config, "endColor", DEFAULT_CHOICES.endColor),
    intensity:
      remembered.intensity
      ?? getConfiguredValue(config, "intensity", DEFAULT_CHOICES.intensity),
    applyTo: DEFAULT_CHOICES.applyTo,
    includeEditorAccent:
      remembered.includeEditorAccent
      ?? getConfiguredValue(config, "includeEditorAccent", DEFAULT_CHOICES.includeEditorAccent),
    monochromatic:
      remembered.monochromatic
      ?? getConfiguredValue(config, "monochromatic", DEFAULT_CHOICES.monochromatic),
    sober:
      remembered.sober
      ?? getConfiguredValue(config, "sober", DEFAULT_CHOICES.sober),
    panelHarmony:
      remembered.panelHarmony
      || getConfiguredValue(config, "panelHarmony", DEFAULT_CHOICES.panelHarmony),
    colorRelationship:
      remembered.colorRelationship
      || getConfiguredValue(config, "colorRelationship", DEFAULT_CHOICES.colorRelationship),
    surfaceOverrides:
      remembered.surfaceOverrides
      || getConfiguredValue(config, "surfaceOverrides", DEFAULT_CHOICES.surfaceOverrides)
  });
}

/**
 * Reads a contributed setting only when the user has actually configured it.
 */
function getConfiguredValue(config, key, defaultValue) {
  const inspection = config.inspect(`${EXTENSION_PREFIX}.${key}`);
  if (hasConfiguredValue(inspection)) {
    return config.get(`${EXTENSION_PREFIX}.${key}`, defaultValue);
  }

  return defaultValue;
}

/**
 * Checks whether VS Code inspection data contains any configured scope value.
 */
function hasConfiguredValue(inspection) {
  if (!inspection) {
    return false;
  }
  return [
    "globalValue",
    "workspaceValue",
    "workspaceFolderValue",
    "globalLanguageValue",
    "workspaceLanguageValue",
    "workspaceFolderLanguageValue"
  ].some((key) => inspection[key] !== undefined);
}

/**
 * Normalizes arbitrary payloads into a valid Camaleone choice object.
 */
function sanitizeChoices(options) {
  const startColor = normalizeHex(options && options.startColor) || DEFAULT_CHOICES.startColor;
  const endColor = normalizeHex(options && options.endColor) || DEFAULT_CHOICES.endColor;

  return {
    startColor,
    endColor,
    intensity: clampNumber(
      options && options.intensity !== undefined ? options.intensity : DEFAULT_CHOICES.intensity,
      0,
      100
    ),
    applyTo: DEFAULT_CHOICES.applyTo,
    includeEditorAccent: Boolean(options && options.includeEditorAccent),
    monochromatic: Boolean(options && options.monochromatic),
    sober: options && options.sober !== undefined ? Boolean(options.sober) : DEFAULT_CHOICES.sober,
    colorRelationship: sanitizeColorRelationship(options && options.colorRelationship),
    panelHarmony: sanitizePanelHarmony(options && options.panelHarmony),
    surfaceOverrides: sanitizeSurfaceOverrides(options && options.surfaceOverrides)
  };
}

/**
 * Keeps relationship values inside the supported palette interpolation modes.
 */
function sanitizeColorRelationship(value) {
  return value === "analogous" || value === "complementary" ? value : "manual";
}

/**
 * Keeps legacy panel harmony values inside the supported modes.
 */
function sanitizePanelHarmony(value) {
  if (value === "manual" || value === "analogous" || value === "complementary") {
    return value;
  }
  return DEFAULT_CHOICES.panelHarmony;
}

function sanitizePresetGroup(value) {
  return PRESET_FILTERS.some((filter) => filter.id === value && filter.id !== "all") ? value : "";
}

/**
 * Filters per-surface overrides to known surfaces with valid hex colors.
 */
function sanitizeSurfaceOverrides(overrides) {
  if (!isPlainObject(overrides)) {
    return {};
  }

  const allowedIds = new Set(SURFACE_CONFIGS.map((surface) => surface.id));
  const clean = {};
  for (const [key, value] of Object.entries(overrides)) {
    const normalized = normalizeHex(value);
    if (allowedIds.has(key) && normalized) {
      clean[key] = normalized;
    }
  }
  return clean;
}

/**
 * Resolves the current workspace to a concrete VS Code configuration target.
 */
function resolveTarget() {
  const hasWorkspace = Boolean(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length);

  if (!hasWorkspace) {
    throw new Error("Open a workspace folder before applying Camaleone colors.");
  }

  return {
    id: "workspace",
    label: "workspace",
    configurationTarget: vscode.ConfigurationTarget.Workspace,
    state: "workspace"
  };
}

/**
 * Remembers the last picker choices and writes them as workspace profile
 * settings so the same palette is available the next time the workspace opens.
 */
async function saveExtensionSettings(context, choices, target) {
  const config = vscode.workspace.getConfiguration();
  const rememberedChoices = {
    ...choices,
    applyTo: DEFAULT_CHOICES.applyTo
  };

  await context.workspaceState.update(LAST_CHOICES_KEY, rememberedChoices);

  await config.update(`${EXTENSION_PREFIX}.startColor`, choices.startColor, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.endColor`, choices.endColor, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.intensity`, choices.intensity, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.includeEditorAccent`, choices.includeEditorAccent, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.monochromatic`, choices.monochromatic, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.sober`, choices.sober, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.colorRelationship`, choices.colorRelationship, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.panelHarmony`, choices.panelHarmony, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.surfaceOverrides`, choices.surfaceOverrides, target.configurationTarget);
  await config.update(PROFILE_ACTIVE_KEY, true, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.applyTo`, undefined, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.persistChoices`, undefined, target.configurationTarget);
}

/**
 * Persists whether the saved workspace profile should be replayed on startup.
 */
async function setWorkspaceProfileActive(target, active) {
  const config = vscode.workspace.getConfiguration();
  await config.update(PROFILE_ACTIVE_KEY, Boolean(active), target.configurationTarget);
}

/**
 * Applies generated workbench colors while preserving a backup of pre-existing
 * values for later restore.
 */
async function patchWorkbenchColors(context, generatedColors, target) {
  const config = vscode.workspace.getConfiguration();
  const currentColors = config.get("workbench.colorCustomizations", {});
  const currentObject = isPlainObject(currentColors) ? currentColors : {};
  const state = getMemento(context, target);
  const activeKey = stateKey(target, "active");
  const backupKey = stateKey(target, "backup");
  const lastGeneratedKey = stateKey(target, "lastGenerated");
  const isActive = state.get(activeKey, false);
  let backup = state.get(backupKey, {});

  // Capture original user/theme overrides only on the first active Camaleone write.
  if (!isActive) {
    backup = {};
    for (const key of EXTENSION_COLOR_KEYS) {
      if (Object.prototype.hasOwnProperty.call(currentObject, key)) {
        backup[key] = currentObject[key];
      }
    }
    await state.update(backupKey, backup);
  }

  const nextColors = removeManagedWorkbenchColorKeys(currentObject);

  // Replace the complete managed key set with the current generated palette.
  for (const [key, value] of Object.entries(generatedColors)) {
    if (EXTENSION_COLOR_KEYS.includes(key)) {
      nextColors[key] = value;
    }
  }

  await config.update("workbench.colorCustomizations", nextColors, target.configurationTarget);
  await state.update(activeKey, true);
  await state.update(lastGeneratedKey, generatedColors);
}

/**
 * Replays the saved backup for a target without clobbering user edits made
 * after Camaleone applied colors.
 */
async function restoreWorkbenchColors(context, target) {
  const config = vscode.workspace.getConfiguration();
  const currentColors = config.get("workbench.colorCustomizations", {});
  const currentObject = isPlainObject(currentColors) ? currentColors : {};
  const state = getMemento(context, target);
  const activeKey = stateKey(target, "active");
  const backupKey = stateKey(target, "backup");
  const lastGeneratedKey = stateKey(target, "lastGenerated");
  const resetPreviousKey = stateKey(target, "resetPrevious");
  const isActive = state.get(activeKey, false);
  const backup = state.get(backupKey, {});
  const lastGenerated = state.get(lastGeneratedKey, {});
  const resetPrevious = state.get(resetPreviousKey, {});

  // Reset flows keep a separate snapshot so Restore Previous can undo a reset.
  if (hasObjectEntries(resetPrevious)) {
    const nextColors = mergeManagedWorkbenchColorKeys(currentObject, resetPrevious);
    await updateWorkbenchColorCustomizations(config, nextColors, target.configurationTarget);
    await state.update(activeKey, true);
    await state.update(lastGeneratedKey, collectTopLevelManagedWorkbenchColorKeys(resetPrevious));
    await state.update(resetPreviousKey, undefined);
    return true;
  }

  if (!isActive && Object.keys(backup).length === 0 && Object.keys(lastGenerated).length === 0) {
    return false;
  }

  const nextColors = { ...currentObject };

  // If the user manually changed a generated key, preserve that newer manual edit.
  for (const key of EXTENSION_COLOR_KEYS) {
    if (
      Object.prototype.hasOwnProperty.call(lastGenerated, key)
      && currentObject[key] !== lastGenerated[key]
    ) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(backup, key)) {
      nextColors[key] = backup[key];
    } else {
      delete nextColors[key];
    }
  }

  await updateWorkbenchColorCustomizations(config, nextColors, target.configurationTarget);
  await clearTrackedState(state, target);
  return true;
}

/**
 * Removes managed keys from workbench.colorCustomizations and records enough
 * state for Restore Previous to bring them back.
 */
async function resetWorkbenchDefaults(context, target) {
  const config = vscode.workspace.getConfiguration();
  const currentColors = config.get("workbench.colorCustomizations", {});
  const previousColors = collectManagedWorkbenchColorKeys(currentColors);
  const nextColors = removeManagedWorkbenchColorKeys(currentColors);

  await updateWorkbenchColorCustomizations(config, nextColors, target.configurationTarget);
  await clearSavedWorkspaceProfileSettings(context, target);
  await rememberResetPreviousState(getMemento(context, target), target, previousColors);
  return true;
}

/**
 * Clears the saved workspace profile when the user explicitly resets Camaleone.
 */
async function clearSavedWorkspaceProfileSettings(context, target) {
  const config = vscode.workspace.getConfiguration();
  for (const key of WORKSPACE_PROFILE_SETTING_KEYS) {
    await config.update(`${EXTENSION_PREFIX}.${key}`, undefined, target.configurationTarget);
  }
  await config.update(`${EXTENSION_PREFIX}.applyTo`, undefined, target.configurationTarget);
  await config.update(`${EXTENSION_PREFIX}.persistChoices`, undefined, target.configurationTarget);
  await context.workspaceState.update(LAST_CHOICES_KEY, createIdeDefaultChoices());
}

/**
 * Stores the pre-reset colors when a reset removed any Camaleone-managed keys.
 */
async function rememberResetPreviousState(state, target, previousColors) {
  const resetPreviousKey = stateKey(target, "resetPrevious");

  if (!hasObjectEntries(previousColors)) {
    await clearTrackedState(state, target);
    return;
  }

  await state.update(stateKey(target, "active"), false);
  await state.update(resetPreviousKey, previousColors);
}

/**
 * Collects managed color keys from top-level and theme-specific settings blocks.
 */
function collectManagedWorkbenchColorKeys(currentColors) {
  if (!isPlainObject(currentColors)) {
    return {};
  }

  const snapshot = collectTopLevelManagedWorkbenchColorKeys(currentColors);

  for (const [key, value] of Object.entries(currentColors)) {
    if (!isThemeSpecificCustomizationKey(key) || !isPlainObject(value)) {
      continue;
    }

    const nestedSnapshot = collectTopLevelManagedWorkbenchColorKeys(value);
    if (hasObjectEntries(nestedSnapshot)) {
      snapshot[key] = nestedSnapshot;
    }
  }

  return snapshot;
}

/**
 * Collects only top-level managed color keys from a color customization object.
 */
function collectTopLevelManagedWorkbenchColorKeys(currentColors) {
  if (!isPlainObject(currentColors)) {
    return {};
  }

  const snapshot = {};
  for (const key of EXTENSION_COLOR_KEYS) {
    if (Object.prototype.hasOwnProperty.call(currentColors, key)) {
      snapshot[key] = currentColors[key];
    }
  }
  return snapshot;
}

/**
 * Merges managed keys back into current settings, including theme-specific
 * nested customizations.
 */
function mergeManagedWorkbenchColorKeys(currentColors, managedColors) {
  const nextColors = isPlainObject(currentColors) ? { ...currentColors } : {};

  for (const key of EXTENSION_COLOR_KEYS) {
    if (Object.prototype.hasOwnProperty.call(managedColors, key)) {
      nextColors[key] = managedColors[key];
    }
  }

  for (const [key, value] of Object.entries(managedColors)) {
    if (!isThemeSpecificCustomizationKey(key) || !isPlainObject(value)) {
      continue;
    }

    const currentThemeColors = isPlainObject(nextColors[key]) ? nextColors[key] : {};
    nextColors[key] = mergeManagedWorkbenchColorKeys(currentThemeColors, value);
  }

  return nextColors;
}

/**
 * Removes Camaleone-managed keys while keeping unrelated customization keys.
 */
function removeManagedWorkbenchColorKeys(currentColors) {
  if (!isPlainObject(currentColors)) {
    return {};
  }

  const nextColors = { ...currentColors };

  for (const key of EXTENSION_COLOR_KEYS) {
    delete nextColors[key];
  }

  for (const [key, value] of Object.entries(nextColors)) {
    if (!isThemeSpecificCustomizationKey(key) || !isPlainObject(value)) {
      continue;
    }

    const nestedColors = { ...value };
    for (const colorKey of EXTENSION_COLOR_KEYS) {
      delete nestedColors[colorKey];
    }

    if (Object.keys(nestedColors).length > 0) {
      nextColors[key] = nestedColors;
    } else {
      delete nextColors[key];
    }
  }

  return nextColors;
}

/**
 * Detects VS Code theme-specific customization blocks such as [Default Dark+].
 */
function isThemeSpecificCustomizationKey(key) {
  return typeof key === "string" && key.startsWith("[") && key.endsWith("]");
}

/**
 * Writes workbench.colorCustomizations or removes the setting when empty.
 */
async function updateWorkbenchColorCustomizations(config, colors, target) {
  const nextValue = Object.keys(colors).length > 0 ? colors : undefined;
  await config.update("workbench.colorCustomizations", nextValue, target);
}

/**
 * Clears all per-target restore bookkeeping from the chosen memento.
 */
async function clearTrackedState(state, target) {
  await state.update(stateKey(target, "active"), false);
  await state.update(stateKey(target, "backup"), undefined);
  await state.update(stateKey(target, "lastGenerated"), undefined);
  await state.update(stateKey(target, "resetPrevious"), undefined);
}

/**
 * Builds a stable memento key for one target and state bucket.
 */
function stateKey(target, key) {
  return `${EXTENSION_PREFIX}.${target.id}.${key}`;
}

/**
 * Returns workspaceState or globalState for the chosen target.
 */
function getMemento(context, target) {
  return target.state === "workspace" ? context.workspaceState : context.globalState;
}

/**
 * Reads user-saved favorites from global state.
 */
function getSavedFavorites(context) {
  const favorites = context.globalState.get(FAVORITES_KEY, []);
  if (!Array.isArray(favorites)) {
    return [];
  }

  return favorites
    .filter((favorite) => favorite && typeof favorite.name === "string")
    .map((favorite) => normalizeFavorite(favorite, false));
}

/**
 * Combines saved favorites with built-in presets, allowing saved entries to
 * override built-ins by name.
 */
function getFavorites(context) {
  const defaultGroupsByName = new Map(
    DEFAULT_FAVORITES.map((favorite) => [favorite.name.toLowerCase(), favorite.presetGroup])
  );
  const savedFavorites = getSavedFavorites(context).map((favorite) => ({
    ...favorite,
    presetGroup: favorite.presetGroup || defaultGroupsByName.get(favorite.name.toLowerCase()) || ""
  }));
  const savedNames = new Set(savedFavorites.map((favorite) => favorite.name.toLowerCase()));
  const defaultFavorites = DEFAULT_FAVORITES
    .filter((favorite) => !savedNames.has(favorite.name.toLowerCase()))
    .map((favorite) => normalizeFavorite(favorite, true));
  return [...savedFavorites, ...defaultFavorites];
}

/**
 * Normalizes one favorite to the current choice schema.
 */
function normalizeFavorite(favorite, builtin) {
  return {
    id: String(favorite.id || `saved-${slugFavoriteName(favorite.name)}`),
    name: favorite.name,
    createdAt: favorite.createdAt || new Date().toISOString(),
    ...sanitizeChoices(favorite),
    builtin: Boolean(builtin || favorite.builtin),
    presetGroup: sanitizePresetGroup(favorite.presetGroup)
  };
}

/**
 * Validates and normalizes a favorite display name.
 */
function normalizeFavoriteName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("Give the favourite a name.");
  }
  if (trimmed.length > 48) {
    throw new Error("Use 48 characters or fewer.");
  }
  return trimmed;
}

/**
 * Prompts for or accepts a favorite name and stores the current color choices.
 */
async function saveFavorite(context, payload, options = {}) {
  const choices = sanitizeChoices(payload);
  const suggestedName = payload && typeof payload.favoriteName === "string" ? payload.favoriteName.trim() : "";
  let name = suggestedName;

  if (options.promptForName !== false) {
    name = await vscode.window.showInputBox({
      title: "Camaleone",
      prompt: "Name this favourite color set",
      placeHolder: "e.g., 'Project Green Focus'",
      value: suggestedName,
      validateInput: (value) => {
        try {
          normalizeFavoriteName(value);
          return undefined;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }
    });

    if (!name) {
      throw new Error("cancelled");
    }
  }

  const normalizedName = normalizeFavoriteName(name);

  const favorites = getSavedFavorites(context);
  const nextFavorite = {
    id: createFavoriteId(),
    name: normalizedName,
    createdAt: new Date().toISOString(),
    ...choices
  };
  const nextFavorites = [
    nextFavorite,
    ...favorites.filter((favorite) => favorite.name.toLowerCase() !== nextFavorite.name.toLowerCase())
  ].slice(0, 40);

  await context.globalState.update(FAVORITES_KEY, nextFavorites);
  return getFavorites(context);
}

/**
 * Deletes a saved favorite and returns the refreshed favorite list.
 */
async function deleteFavorite(context, favoriteId) {
  const favorites = getSavedFavorites(context).filter((favorite) => favorite.id !== favoriteId);
  await context.globalState.update(FAVORITES_KEY, favorites);
  return getFavorites(context);
}

/**
 * Applies a favorite by id from either saved or built-in favorite lists.
 */
async function applyFavoriteById(context, favoriteId) {
  const favorite = getFavorites(context).find((entry) => entry.id === favoriteId);
  if (!favorite) {
    throw new Error("Saved favourite color set not found.");
  }
  return applyColors(context, {
    ...favorite,
    applyTo: DEFAULT_CHOICES.applyTo
  });
}

/**
 * Creates a short collision-resistant id for user-saved favorites.
 */
function createFavoriteId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Builds a deterministic fallback id fragment from a favorite name.
 */
function slugFavoriteName(name) {
  return String(name || "favorite")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "favorite";
}

/**
 * Creates a random readable palette biased toward distinctive color movement.
 */
function createSurprisePalette() {
  const distinctive = Math.random() < SURPRISE_DISTINCT_PROBABILITY;
  const startColor = randomReadableColor();
  const startHsl = hexToHsl(startColor);
  const endHsl = createSurpriseEndHsl(startHsl, distinctive);
  const endColor = hslToHex({
    h: endHsl.h,
    s: Math.max(46, Math.min(88, startHsl.s + randomBetween(-8, 8))),
    l: Math.max(38, Math.min(64, startHsl.l + randomBetween(-7, 7)))
  });
  return { startColor, endColor, relationship: distinctive ? "complementary" : "analogous" };
}

/**
 * Picks the end hue for a surprise palette.
 */
function createSurpriseEndHsl(startHsl, distinctive) {
  const direction = Math.random() < 0.5 ? -1 : 1;
  const hueDistance = distinctive
    ? randomBetween(SURPRISE_DISTINCT_HUE_MIN, SURPRISE_DISTINCT_HUE_MAX)
    : randomBetween(SURPRISE_SIMILAR_HUE_MIN, SURPRISE_SIMILAR_HUE_MAX);

  return { ...startHsl, h: rotateHue(startHsl.h, direction * hueDistance) };
}

/**
 * Derives a monochromatic harmony color from one base color.
 */
function harmonyColor(baseColor, position, harmonyMode) {
  const base = hexToHsl(baseColor);
  if (harmonyMode === "complementary") {
    return hslToHex({
      h: rotateHue(base.h, 180 * position),
      s: Math.max(46, Math.min(88, base.s + (position - 0.5) * 10)),
      l: Math.max(36, Math.min(66, base.l + (position - 0.5) * 12))
    });
  }

  return hslToHex({
    h: rotateHue(base.h, (position - 0.5) * 58),
    s: Math.max(42, Math.min(86, base.s + (position - 0.5) * 8)),
    l: Math.max(36, Math.min(66, base.l + (position - 0.5) * 10))
  });
}

/**
 * Samples the selected palette relationship at a normalized position.
 */
function paletteColor(startColor, endColor, position, relationship) {
  const mode = sanitizeColorRelationship(relationship);
  if (mode === "manual") {
    return interpolateColor(startColor, endColor, position);
  }

  return interpolateHslColor(startColor, endColor, position, mode === "complementary");
}

/**
 * Interpolates two colors in HSL space.
 */
function interpolateHslColor(startColor, endColor, position, useLongHuePath) {
  const start = hexToHsl(startColor);
  const end = hexToHsl(endColor);
  const ratio = clampNumber(position, 0, 1);
  const hueDelta = hueDeltaBetween(start.h, end.h, useLongHuePath);

  return hslToHex({
    h: rotateHue(start.h, hueDelta * ratio),
    s: start.s + (end.s - start.s) * ratio,
    l: start.l + (end.l - start.l) * ratio
  });
}

/**
 * Returns the signed hue delta for short-path or long-path interpolation.
 */
function hueDeltaBetween(startHue, endHue, useLongHuePath) {
  const shortest = ((endHue - startHue + 540) % 360) - 180;
  if (!useLongHuePath) {
    return shortest;
  }

  if (shortest === 0) {
    return 360;
  }

  return shortest > 0 ? shortest - 360 : shortest + 360;
}

/**
 * Generates a random HSL color within readable saturation/lightness bounds.
 */
function randomReadableColor() {
  return hslToHex({
    h: Math.floor(Math.random() * 360),
    s: randomBetween(54, 86),
    l: randomBetween(40, 61)
  });
}

/**
 * Returns a random integer in the inclusive range.
 */
function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/**
 * Rotates a hue into the 0-359 degree range.
 */
function rotateHue(hue, amount) {
  return ((hue + amount) % 360 + 360) % 360;
}

/**
 * Converts a hex color to HSL components.
 */
function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) {
      h = (g - b) / delta + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

/**
 * Converts HSL components to a normalized hex color.
 */
function hslToHex(hsl) {
  const h = rotateHue(hsl.h, 0) / 360;
  const s = Math.max(0, Math.min(100, hsl.s)) / 100;
  const l = Math.max(0, Math.min(100, hsl.l)) / 100;

  if (s === 0) {
    return rgbToHex({ r: l * 255, g: l * 255, b: l * 255 });
  }

  const hueToRgb = (p, q, tInput) => {
    let t = tInput;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgbToHex({
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255
  });
}

/**
 * Maps sanitized choices to VS Code workbench.colorCustomizations.
 */
function createColorCustomizations(choices) {
  const startColor = normalizeHex(choices.startColor) || DEFAULT_CHOICES.startColor;
  const endColor = normalizeHex(choices.endColor) || DEFAULT_CHOICES.endColor;
  const intensity = clampNumber(choices.intensity, 0, 100);
  const overrides = sanitizeSurfaceOverrides(choices.surfaceOverrides);
  const colorRelationship = sanitizeColorRelationship(choices.colorRelationship);
  const harmonyMode = colorRelationship === "manual"
    ? (choices.panelHarmony === "complementary" ? "complementary" : "analogous")
    : colorRelationship;
  const base = baseColorForTheme();
  const blendAmount = (strength = 1) => (intensity / 100) * strength;
  const generatedSurfaceColor = (position) => (
    choices.monochromatic
      ? harmonyColor(startColor, position, harmonyMode)
      : paletteColor(startColor, endColor, position, colorRelationship)
  );
  const sample = (position, strength = 1) => {
    const color = generatedSurfaceColor(position);
    return blendColor(base, color, blendAmount(strength));
  };
  const surface = (id) => {
    const config = SURFACE_CONFIGS.find((entry) => entry.id === id);
    if (!config) {
      return sample(0.5);
    }
    const source = overrides[id] || generatedSurfaceColor(config.sample);
    return blendColor(base, source, blendAmount(config.strength));
  };

  if (choices.sober) {
    return createSoberColorCustomizations(startColor, endColor, colorRelationship, {
      includeEditorAccent: choices.includeEditorAccent,
      intensity,
      monochromatic: choices.monochromatic,
      harmonyMode,
      surfaceOverrides: overrides
    });
  }

  // Non-sober mode applies the sampled palette path broadly with an opaque side
  // bar, so generated sidebar colours can use the full selected spectrum.
  const title = surface("titleBar");
  const activity = surface("activityBar");
  const side = surface("sideBar");
  const sideForeground = contrastColor(side);
  const panel = surface("panel");
  const status = surface("statusBar");
  const remoteIndicator = surface("remoteIndicator");
  const remoteHoverBackground = adjustForHover(remoteIndicator);
  const buttons = surface("buttons");
  const editorAccent = surface("editorAccent");
  const mutedTitle = blendColor(base, title, 0.68);
  const mutedStatus = blendColor(base, status, 0.68);
  const commandCenterBackground = title;
  const commandCenterActiveBackground = adjustForHover(commandCenterBackground);
  const commandCenterInactiveBackground = mutedTitle;
  const secondaryButtonBackground = side;

  const colors = {
    "activityBar.background": activity,
    "activityBar.foreground": contrastColor(activity),
    "activityBar.inactiveForeground": withAlpha(contrastColor(activity), 0.68),
    "activityBarBadge.background": buttons,
    "activityBarBadge.foreground": contrastColor(buttons),
    "badge.background": buttons,
    "badge.foreground": contrastColor(buttons),
    "button.background": buttons,
    "button.foreground": contrastColor(buttons),
    "button.hoverBackground": adjustForHover(buttons),
    "button.secondaryBackground": secondaryButtonBackground,
    "button.secondaryForeground": contrastColor(secondaryButtonBackground),
    "button.secondaryHoverBackground": adjustForHover(secondaryButtonBackground),
    "commandCenter.activeBackground": commandCenterActiveBackground,
    "commandCenter.activeBorder": panel,
    "commandCenter.activeForeground": contrastColor(commandCenterActiveBackground),
    "commandCenter.background": commandCenterBackground,
    "commandCenter.border": panel,
    "commandCenter.debuggingBackground": panel,
    "commandCenter.foreground": contrastColor(commandCenterBackground),
    "commandCenter.inactiveBorder": panel,
    "commandCenter.inactiveForeground": withAlpha(contrastColor(commandCenterInactiveBackground), 0.74),
    "editorGroup.border": panel,
    "focusBorder": panel,
    "list.activeSelectionBackground": withAlpha(panel, 0.42),
    "list.activeSelectionForeground": contrastColor(panel),
    "list.hoverBackground": withAlpha(panel, 0.22),
    "list.inactiveSelectionBackground": withAlpha(panel, 0.28),
    "panel.border": panel,
    "panelTitle.activeBorder": panel,
    "sideBar.background": side,
    "sideBar.foreground": sideForeground,
    "sideBarSectionHeader.background": withAlpha(panel, 0.22),
    "sideBarSectionHeader.foreground": sideForeground,
    "sideBarTitle.foreground": sideForeground,
    "statusBar.background": status,
    "statusBar.debuggingBackground": panel,
    "statusBar.foreground": contrastColor(status),
    "statusBar.noFolderBackground": mutedStatus,
    "statusBarItem.hoverBackground": withAlpha(contrastColor(status), 0.16),
    "statusBarItem.remoteBackground": remoteIndicator,
    "statusBarItem.remoteForeground": contrastColor(remoteIndicator),
    "statusBarItem.remoteHoverBackground": remoteHoverBackground,
    "statusBarItem.remoteHoverForeground": contrastColor(remoteHoverBackground),
    "tab.activeBorderTop": panel,
    "terminalCursor.foreground": status,
    "titleBar.activeBackground": title,
    "titleBar.activeForeground": contrastColor(title),
    "titleBar.inactiveBackground": mutedTitle,
    "titleBar.inactiveForeground": withAlpha(contrastColor(mutedTitle), 0.74)
  };

  // Editor accents are opt-in because selection/cursor colors affect readability most.
  if (choices.includeEditorAccent) {
    colors["editor.findMatchBackground"] = withAlpha(editorAccent, 0.52);
    colors["editor.lineHighlightBackground"] = withAlpha(editorAccent, 0.18);
    colors["editor.selectionBackground"] = withAlpha(editorAccent, 0.42);
    colors["editorCursor.foreground"] = editorAccent;
    colors["editorLink.activeForeground"] = editorAccent;
  }

  return colors;
}

/**
 * Creates the restrained default color map: mostly neutral chrome with the
 * title bar, activity bar, status bar, and dark-biased side bar carrying the
 * identity colors.
 */
function createSoberColorCustomizations(startColor, endColor, colorRelationship, options = {}) {
  const neutral = "#1e1e1e";
  const intensity = clampNumber(options.intensity, 0, 100) / 100;
  const overrides = sanitizeSurfaceOverrides(options.surfaceOverrides);
  const generatedSurfaceColor = (position) => (
    options.monochromatic
      ? harmonyColor(startColor, position, options.harmonyMode || "analogous")
      : paletteColor(startColor, endColor, position, colorRelationship)
  );
  const blendSurface = (id, fallback) => {
    const config = SURFACE_CONFIGS.find((entry) => entry.id === id);
    const strength = config ? config.strength : 1;
    const source = overrides[id] || fallback;
    return blendColor(neutral, source, Math.max(0, Math.min(1, intensity * strength)));
  };
  const title = blendSurface("titleBar", generatedSurfaceColor(0));
  const activity = blendSurface("activityBar", generatedSurfaceColor(surfaceSample("activityBar", 0.12)));
  const side = blendSurface(
    "sideBar",
    soberGeneratedSideBarColor(generatedSurfaceColor(surfaceSample("sideBar", 0.34)))
  );
  const panel = blendSurface("panel", neutral);
  const status = blendSurface("statusBar", generatedSurfaceColor(1));
  const remoteIndicator = blendSurface("remoteIndicator", generatedSurfaceColor(surfaceSample("remoteIndicator", 0.08)));
  const remoteHoverBackground = adjustForHover(remoteIndicator);
  const buttons = blendSurface("buttons", neutral);
  const editorAccent = blendSurface("editorAccent", generatedSurfaceColor(surfaceSample("editorAccent", 0.5)));
  const sideForeground = contrastColor(side);
  const panelForeground = contrastColor(panel);
  const buttonForeground = contrastColor(buttons);
  const mutedTitle = blendColor(neutral, title, 0.68);
  const mutedStatus = blendColor(neutral, status, 0.68);

  const colors = {
    "activityBar.background": activity,
    "activityBar.foreground": contrastColor(activity),
    "activityBar.inactiveForeground": withAlpha(contrastColor(activity), 0.68),
    "activityBarBadge.background": buttons,
    "activityBarBadge.foreground": buttonForeground,
    "badge.background": buttons,
    "badge.foreground": buttonForeground,
    "button.background": buttons,
    "button.foreground": buttonForeground,
    "button.hoverBackground": adjustForHover(buttons),
    "button.secondaryBackground": buttons,
    "button.secondaryForeground": buttonForeground,
    "button.secondaryHoverBackground": adjustForHover(buttons),
    "commandCenter.activeBackground": adjustForHover(title),
    "commandCenter.activeBorder": panel,
    "commandCenter.activeForeground": contrastColor(adjustForHover(title)),
    "commandCenter.background": title,
    "commandCenter.border": panel,
    "commandCenter.debuggingBackground": panel,
    "commandCenter.foreground": contrastColor(title),
    "commandCenter.inactiveBorder": panel,
    "commandCenter.inactiveForeground": withAlpha(contrastColor(mutedTitle), 0.74),
    "editorGroup.border": panel,
    "focusBorder": panel,
    "list.activeSelectionBackground": withAlpha(panel, 0.42),
    "list.activeSelectionForeground": panelForeground,
    "list.hoverBackground": withAlpha(panel, 0.22),
    "list.inactiveSelectionBackground": withAlpha(panel, 0.28),
    "panel.border": panel,
    "panelTitle.activeBorder": panel,
    "sideBar.background": side,
    "sideBar.foreground": sideForeground,
    "sideBarSectionHeader.background": panel,
    "sideBarSectionHeader.foreground": sideForeground,
    "sideBarTitle.foreground": sideForeground,
    "statusBar.background": status,
    "statusBar.debuggingBackground": panel,
    "statusBar.foreground": contrastColor(status),
    "statusBar.noFolderBackground": mutedStatus,
    "statusBarItem.hoverBackground": withAlpha(contrastColor(status), 0.16),
    "statusBarItem.remoteBackground": remoteIndicator,
    "statusBarItem.remoteForeground": contrastColor(remoteIndicator),
    "statusBarItem.remoteHoverBackground": remoteHoverBackground,
    "statusBarItem.remoteHoverForeground": contrastColor(remoteHoverBackground),
    "tab.activeBorderTop": panel,
    "terminalCursor.foreground": status,
    "titleBar.activeBackground": title,
    "titleBar.activeForeground": contrastColor(title),
    "titleBar.inactiveBackground": mutedTitle,
    "titleBar.inactiveForeground": withAlpha(contrastColor(mutedTitle), 0.74)
  };

  if (options.includeEditorAccent) {
    colors["editor.findMatchBackground"] = withAlpha(editorAccent, 0.52);
    colors["editor.lineHighlightBackground"] = withAlpha(editorAccent, 0.18);
    colors["editor.selectionBackground"] = withAlpha(editorAccent, 0.42);
    colors["editorCursor.foreground"] = editorAccent;
    colors["editorLink.activeForeground"] = editorAccent;
  }

  return colors;
}

/**
 * Looks up a configured surface sample position.
 */
function surfaceSample(id, fallback) {
  const config = SURFACE_CONFIGS.find((entry) => entry.id === id);
  return config ? config.sample : fallback;
}

/**
 * Keeps generated sober side bars tied to the palette while biasing them dark.
 */
function soberGeneratedSideBarColor(color) {
  return blendColor("#000000", color, SOBER_SIDE_BAR_GENERATED_COLOR_WEIGHT);
}

/**
 * Chooses a neutral base color from the active VS Code theme kind.
 */
function baseColorForTheme() {
  const kind = vscode.window.activeColorTheme && vscode.window.activeColorTheme.kind;
  if (kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight) {
    return "#f3f3f3";
  }
  if (kind === vscode.ColorThemeKind.HighContrast) {
    return "#000000";
  }
  return "#1e1e1e";
}

/**
 * Parses 3- or 6-digit hex input into lower-case #rrggbb form.
 */
function normalizeHex(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
  if (!match) {
    return undefined;
  }
  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
  }
  return `#${hex}`.toLowerCase();
}

/**
 * Converts a normalized hex color to RGB channels.
 */
function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    throw new Error(`Invalid color: ${hex}`);
  }
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
}

/**
 * Converts RGB channels to a normalized hex color.
 */
function rgbToHex(rgb) {
  const toHex = (channel) => clampNumber(Math.round(channel), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Linearly interpolates two hex colors in RGB space.
 */
function interpolateColor(startColor, endColor, position) {
  const start = hexToRgb(startColor);
  const end = hexToRgb(endColor);
  const ratio = clampNumber(position, 0, 1);
  return rgbToHex({
    r: start.r + (end.r - start.r) * ratio,
    g: start.g + (end.g - start.g) * ratio,
    b: start.b + (end.b - start.b) * ratio
  });
}

/**
 * Blends an overlay color into a base color by amount.
 */
function blendColor(baseColor, overlayColor, amount) {
  const base = hexToRgb(baseColor);
  const overlay = hexToRgb(overlayColor);
  const ratio = clampNumber(amount, 0, 1);
  return rgbToHex({
    r: base.r + (overlay.r - base.r) * ratio,
    g: base.g + (overlay.g - base.g) * ratio,
    b: base.b + (overlay.b - base.b) * ratio
  });
}

/**
 * Returns black or white text for readable contrast against a background.
 */
function contrastColor(hex) {
  const rgb = hexToRgb(hex);
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.42 ? "#000000" : "#ffffff";
}

/**
 * Appends an alpha channel to a hex color.
 */
function withAlpha(hex, alpha) {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    throw new Error(`Invalid color: ${hex}`);
  }
  const alphaHex = clampNumber(Math.round(clampNumber(alpha, 0, 1) * 255), 0, 255)
    .toString(16)
    .padStart(2, "0");
  return `${normalized}${alphaHex}`;
}

/**
 * Creates a subtle hover color against the active theme base.
 */
function adjustForHover(hex) {
  const base = baseColorForTheme();
  const contrast = contrastColor(base) === "#ffffff" ? "#ffffff" : "#000000";
  return blendColor(hex, contrast, 0.12);
}

/**
 * Clamps numeric input into an inclusive range.
 */
function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, numeric));
}

/**
 * Checks for ordinary object values used as JSON settings/state.
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks whether a plain object contains any own keys.
 */
function hasObjectEntries(value) {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

/**
 * Validates native input-box hex color input.
 */
function validateHexInput(value) {
  return normalizeHex(value) ? undefined : "Use a valid hex color such as #0ea5e9.";
}

/**
 * Generates a Content Security Policy nonce for the picker webview.
 */
function getNonce() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return nonce;
}

/**
 * Builds panel options with local asset roots when extensionUri is available.
 */
function createPickerPanelOptions(context) {
  return {
    ...createPickerWebviewOptions(context),
    retainContextWhenHidden: true
  };
}

/**
 * Builds webview options with local asset roots when extensionUri is available.
 */
function createPickerWebviewOptions(context) {
  const options = {
    enableScripts: true
  };

  if (context && context.extensionUri && vscode.Uri && typeof vscode.Uri.joinPath === "function") {
    options.localResourceRoots = [vscode.Uri.joinPath(context.extensionUri, "assets")];
  }

  return options;
}

/**
 * Resolves picker icon asset URIs for use inside the webview.
 */
function createPickerIconUris(context, webview) {
  return {
    title: getWebviewAssetUri(context, webview, "assets", "icons", "png", "camaleone-sil-2.png"),
    saveFavorite: getWebviewAssetUri(context, webview, "assets", "icons", "png", "camaleone-sil-3.png"),
    colorPicker: getWebviewAssetUri(context, webview, "assets", "icons", "png", "color-picker.png"),
    undo: getWebviewAssetUri(context, webview, "assets", "icons", "png", "undo.png")
  };
}

/**
 * Converts an extension-relative asset path to a webview-safe URI.
 */
function getWebviewAssetUri(context, webview, ...segments) {
  if (
    !context ||
    !context.extensionUri ||
    !webview ||
    typeof webview.asWebviewUri !== "function" ||
    !vscode.Uri ||
    typeof vscode.Uri.joinPath !== "function"
  ) {
    return "";
  }

  return String(webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, ...segments)));
}

/**
 * Escapes values inserted into HTML attributes in the generated webview.
 */
function escapeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Generates the picker HTML, CSS, and browser-side script.
 */
function getPickerHtml(webview, state) {
  const nonce = getNonce();
  const safeState = JSON.stringify(state).replace(/</g, "\\u003c");
  const pickerIcons = state && state.pickerIcons ? state.pickerIcons : {};
  const isActivityBarLayout = state && state.layout === "activityBar";
  const bodyClass = isActivityBarLayout ? "activity-pane" : "standard-pane";
  const titleIconHtml = pickerIcons.title
    ? `<img class="title-icon" src="${escapeHtmlAttribute(pickerIcons.title)}" alt="" aria-hidden="true">`
    : "";
  const saveFavoriteIconHtml = pickerIcons.saveFavorite
    ? `<img class="button-image-icon save-favorite-icon" src="${escapeHtmlAttribute(pickerIcons.saveFavorite)}" alt="" aria-hidden="true">`
    : '<span class="button-icon" aria-hidden="true">&#9733;</span>';
  const revertIconHtml = pickerIcons.undo
    ? `<span class="button-icon icon-image-mask icon-revert" style="--icon-mask: url('${escapeHtmlAttribute(pickerIcons.undo)}');" aria-hidden="true"></span>`
    : '<svg class="button-icon icon-svg icon-revert" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.25 3.25H3.25V.25"></path><path d="M3.45 3.25A5.4 5.4 0 1 1 2.6 8"></path><path d="M3.25 3.25 6.7 6.7"></path></svg>';
  const resetIconHtml = '<svg class="button-icon icon-svg icon-reset" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.75 2.25h3v3"></path><path d="M12.55 2.25A5.4 5.4 0 1 0 13.4 8"></path><path d="M12.75 2.25 9.3 5.7"></path></svg>';
  const surfaceRevertButtonHtml = JSON.stringify(`${revertIconHtml}<span>Revert</span>`);
  const surfaceRevertIconOnlyHtml = JSON.stringify(revertIconHtml);
  const presetFilters = Array.isArray(state && state.presetFilters) ? state.presetFilters : PRESET_FILTERS;
  const presetFilterButtonsHtml = presetFilters
    .filter((filter) => filter && typeof filter.id === "string" && typeof filter.label === "string")
    .map((filter) => {
      const active = filter.id === "all";
      return `<button class="preset-filter${active ? " active" : ""}" type="button" data-preset-filter="${escapeHtmlAttribute(filter.id)}" aria-pressed="${active ? "true" : "false"}">${escapeHtmlAttribute(filter.label)}</button>`;
    })
    .join("");
  const customizeSectionHtml = isActivityBarLayout
    ? ""
    : `
      <section class="customize" aria-label="Customize colors">
        <div class="customize-head">
          <h2>Customize</h2>
        </div>
        <div id="surfaceControls" class="surface-controls"></div>
      </section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Camaleone</title>
  <style>
    :root {
      color-scheme: light dark;
    }

    body {
      margin: 0;
      padding: 18px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    h1,
    h2,
    p {
      margin: 0;
    }

    .page {
      display: grid;
      gap: 14px;
      max-width: 1120px;
    }

    .intro {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .brand-lockup {
      display: inline-flex;
      min-width: 0;
      align-items: center;
      gap: 9px;
    }

    .title-icon {
      width: 32px;
      height: 32px;
      flex: 0 0 32px;
      object-fit: contain;
    }

    .intro h1 {
      font-size: 21px;
      line-height: 1.2;
      font-weight: 700;
    }

    .intro p,
    .help {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.35;
    }

    .panel-grid {
      display: grid;
      grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.4fr);
      gap: 14px;
      align-items: stretch;
    }

    .controls,
    .preview,
    .customize,
    .extras,
    .actions {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background: var(--vscode-sideBar-background);
    }

    .controls {
      display: grid;
      gap: 14px;
      padding: 16px;
    }

    .group {
      display: grid;
      gap: 10px;
    }

    .group h2 {
      font-size: 13px;
      line-height: 1.3;
      font-weight: 700;
    }

    .field {
      display: grid;
      gap: 6px;
    }

    label,
    .field-label {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 600;
    }

    .color-row {
      display: grid;
      grid-template-columns: 46px 1fr;
      gap: 8px;
      align-items: center;
    }

    input,
    select {
      box-sizing: border-box;
      width: 100%;
      min-height: 31px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      padding: 4px 8px;
      font: inherit;
    }

    select.placeholder {
      color: var(--vscode-descriptionForeground);
    }

    input[type="color"] {
      height: 34px;
      padding: 0;
      border: 0;
      background: transparent;
    }

    input[type="range"] {
      padding: 0;
    }

    .checkbox-row {
      display: flex;
      gap: 8px;
      align-items: center;
      color: var(--vscode-foreground);
    }

    .checkbox-row input {
      width: auto;
      min-height: auto;
    }

    .button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .button-row.compact {
      gap: 6px;
    }

    .primary-apply-row {
      display: grid;
    }

    .primary-apply-row button {
      width: 100%;
    }

    .colors-divider {
      height: 1px;
      background: var(--vscode-panel-border);
    }

    .colors-secondary-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
    }

    .sober-toggle {
      justify-self: end;
      min-height: 31px;
      padding: 0 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-height: 31px;
      border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
      border-radius: 4px;
      padding: 0 11px;
      color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
      background: transparent;
      font: inherit;
      cursor: pointer;
    }

    button:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-toolbar-hoverBackground, rgba(127, 127, 127, 0.12));
    }

    button.primary-action,
    button.secondary {
      color: var(--vscode-button-secondaryForeground, var(--vscode-sideBar-foreground, var(--vscode-foreground)));
      border-color: var(--vscode-button-border, var(--vscode-panel-border));
      background: transparent;
    }

    button.primary-action:hover,
    button.secondary:hover {
      color: var(--vscode-button-secondaryForeground, var(--vscode-sideBar-foreground, var(--vscode-foreground)));
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-toolbar-hoverBackground, rgba(127, 127, 127, 0.12));
    }

    .button-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
      border-radius: 999px;
      border: 1px solid currentColor;
      opacity: 0.78;
    }

    .button-icon.icon-svg {
      width: 17px;
      height: 17px;
      flex-basis: 17px;
      border: 0;
      border-radius: 0;
      opacity: 0.9;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .button-icon.icon-image-mask {
      width: 17px;
      height: 17px;
      flex-basis: 17px;
      border: 0;
      border-radius: 0;
      opacity: 0.9;
      background: currentColor;
      -webkit-mask: var(--icon-mask) center / contain no-repeat;
      mask: var(--icon-mask) center / contain no-repeat;
    }

    .button-image-icon {
      width: 18px;
      height: 18px;
      flex: 0 0 18px;
      object-fit: contain;
    }

    button:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .surface-reset {
      min-height: 26px;
      padding: 0 8px;
      font-size: 12px;
    }

    .surface-controls {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      padding: 12px;
    }

    .surface-control {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .surface-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }

    .surface-title {
      display: block;
      min-width: 0;
    }

    .favorite-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
    }

    .preset-filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .preset-filter {
      min-height: 28px;
      padding: 3px 8px;
      font-size: 12px;
      line-height: 1.2;
      white-space: normal;
    }

    .preset-filter.active {
      border-color: var(--vscode-focusBorder);
      color: var(--vscode-button-foreground, var(--vscode-foreground));
      background: var(--vscode-button-background, rgba(127, 127, 127, 0.18));
    }

    .preview {
      overflow: hidden;
    }

    .gradient-strip {
      height: 118px;
      background: linear-gradient(90deg, var(--start), var(--end));
    }

    .surface-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      min-height: 196px;
    }

    .surface-preview {
      display: grid;
      grid-template-rows: 1fr auto auto;
      gap: 4px;
      padding: 14px;
      min-width: 0;
    }

    .surface-preview strong {
      align-self: end;
      overflow-wrap: anywhere;
      font-size: 12px;
      line-height: 1.25;
    }

    .surface-preview span {
      color: currentColor;
      opacity: 0.76;
      font-size: 11px;
      line-height: 1.3;
    }

    .surface-preview-generated {
      color: currentColor;
      opacity: 0.78;
      font-size: 11px;
      line-height: 1.3;
    }

    .customize-head,
    .extras-head,
    .actions-head {
      display: grid;
      grid-template-columns: 1fr;
      align-items: center;
      gap: 12px;
      min-height: 46px;
      padding: 0 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .customize-head h2,
    .extras-head h2,
    .actions-head h2 {
      font-size: 13px;
      line-height: 1.3;
      font-weight: 700;
    }

    .customize,
    .extras,
    .actions {
      display: grid;
      grid-template-rows: 46px 1fr;
      padding: 0;
      align-self: stretch;
    }

    .options-stack {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      gap: 10px;
      align-self: stretch;
      min-height: 0;
    }

    .options-container {
      display: grid;
      gap: 16px;
      padding: 16px;
    }

    .options-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(150px, 1fr));
      gap: 12px;
      align-items: stretch;
    }

    .option-item {
      display: grid;
      gap: 8px;
      align-content: center;
      min-height: 72px;
      padding: 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-editor-background);
    }

    .option-wide {
      grid-column: span 2;
    }

    .option-toggle {
      align-items: center;
      justify-content: start;
    }

    .option-checkbox-group {
      display: grid;
      gap: 10px;
      align-content: center;
    }

    .option-checkbox-group .checkbox-row {
      min-height: 31px;
    }

    .option-help-wrap {
      position: relative;
      display: grid;
      gap: 6px;
    }

    .option-toggle-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
    }

    .help-trigger {
      width: 20px;
      min-width: 20px;
      height: 20px;
      min-height: 20px;
      padding: 0;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
    }

    .option-help-panel {
      position: absolute;
      z-index: 20;
      top: calc(100% + 6px);
      right: 0;
      width: min(280px, calc(100vw - 48px));
      padding: 10px;
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 6px;
      color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
      background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.32);
      font-size: 12px;
      line-height: 1.4;
    }

    .option-help-panel[hidden] {
      display: none;
    }

    .options-section {
      display: grid;
      gap: 8px;
    }

    .options-section-title {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    .actions-container {
      display: grid;
      gap: 12px;
      padding: 16px;
    }

    .options-buttons {
      justify-content: start;
    }

    .status {
      min-height: 20px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.4;
    }

    .status.ok {
      color: var(--vscode-testing-iconPassed);
    }

    .status.error {
      color: var(--vscode-testing-iconFailed);
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(0, 0, 0, 0.48);
    }

    .modal-backdrop[hidden] {
      display: none;
    }

    .modal {
      display: grid;
      gap: 14px;
      width: min(420px, 100%);
      padding: 16px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      box-shadow: 0 18px 54px rgba(0, 0, 0, 0.38);
    }

    .modal h2 {
      font-size: 14px;
      line-height: 1.3;
      font-weight: 700;
    }

    .modal-actions {
      justify-content: end;
    }

    body.activity-pane {
      padding: 10px;
    }

    body.activity-pane .page {
      max-width: none;
      gap: 10px;
    }

    body.activity-pane .intro {
      display: none;
    }

    body.activity-pane .panel-grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    body.activity-pane .controls,
    body.activity-pane .preview,
    body.activity-pane .extras,
    body.activity-pane .actions {
      border-radius: 6px;
    }

    body.activity-pane .controls {
      padding: 12px;
    }

    body.activity-pane .preview {
      display: grid;
      gap: 1px;
      background: rgba(127, 127, 127, 0.16);
    }

    body.activity-pane .gradient-strip {
      height: 46px;
    }

    body.activity-pane .surface-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: 78px;
      gap: 1px;
      column-gap: 1px;
      row-gap: 3px;
      align-items: stretch;
      min-height: 0;
      background: rgba(127, 127, 127, 0.14);
    }

    body.activity-pane .surface-preview {
      grid-template-rows: minmax(0, 1fr) auto;
      box-sizing: border-box;
      height: 100%;
      min-height: 0;
      gap: 3px;
      padding: 7px;
      overflow: hidden;
      box-shadow: inset 0 0 18px rgba(255, 255, 255, 0.035);
    }

    body.activity-pane .surface-control-inline {
      display: grid;
      grid-template-rows: 18px 22px;
      gap: 3px;
      align-content: start;
      min-width: 0;
      min-height: 0;
    }

    body.activity-pane .surface-inline-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: center;
      height: 18px;
      min-width: 0;
    }

    body.activity-pane .surface-inline-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 22px;
      gap: 4px;
      align-items: stretch;
      min-width: 0;
      height: 22px;
    }

    body.activity-pane .surface-color-title {
      min-width: 0;
      color: var(--surface-action-foreground, currentColor);
      opacity: 0.9;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 9.5px;
      line-height: 1.2;
      font-weight: 600;
    }

    body.activity-pane .surface-color-button {
      display: grid;
      grid-template-columns: auto;
      align-items: center;
      justify-content: center;
      height: 22px;
      min-height: 0;
      width: 100%;
      padding: 0;
      color: var(--surface-action-foreground, currentColor);
      border-color: var(--surface-action-border, currentColor);
      background: var(--surface-action-background, transparent);
    }

    body.activity-pane .surface-color-button:hover {
      color: var(--surface-action-foreground, currentColor);
      border-color: var(--surface-action-border, currentColor);
      background: var(--surface-action-hoverBackground, rgba(127, 127, 127, 0.18));
    }

    body.activity-pane .surface-picker-icon {
      position: relative;
      width: 14px;
      height: 14px;
      flex: 0 0 14px;
      border: 1px solid currentColor;
      border-radius: 4px;
      opacity: 0.88;
    }

    body.activity-pane .surface-picker-icon-image {
      width: 14px;
      height: 14px;
      flex: 0 0 14px;
      object-fit: contain;
      opacity: 0.9;
      filter: var(--surface-picker-filter, brightness(0));
    }

    body.activity-pane .surface-picker-icon::before {
      content: "";
      position: absolute;
      inset: 3px;
      border-radius: 2px;
      background: currentColor;
      opacity: 0.24;
    }

    body.activity-pane .surface-picker-icon::after {
      content: "";
      position: absolute;
      right: -2px;
      bottom: -3px;
      width: 8px;
      height: 2px;
      border-radius: 999px;
      background: currentColor;
      transform: rotate(-45deg);
      transform-origin: center;
    }

    body.activity-pane .surface-native-color,
    body.activity-pane .surface-hidden-text {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }

    body.activity-pane .surface-reset {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      min-height: 0;
      padding: 0;
      font-size: 9.5px;
      color: var(--surface-action-foreground, currentColor);
      border-color: var(--surface-action-border, currentColor);
      background: var(--surface-action-background, transparent);
      opacity: 0.92;
    }

    body.activity-pane .surface-reset .button-icon {
      width: 13px;
      height: 13px;
      flex-basis: 13px;
    }

    body.activity-pane .surface-reset .button-icon + span {
      display: none;
    }

    body.activity-pane .surface-preview-generated {
      align-self: end;
      min-height: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 9.5px;
      line-height: 1.2;
    }

    body.activity-pane .surface-reset:hover {
      color: var(--surface-action-foreground, currentColor);
      border-color: var(--surface-action-border, currentColor);
      background: var(--surface-action-hoverBackground, rgba(127, 127, 127, 0.18));
    }

    body.activity-pane .surface-reset:disabled {
      color: var(--surface-action-foreground, currentColor);
      border-color: transparent;
      background: transparent;
      opacity: 0.18;
    }

    body.activity-pane .options-stack {
      grid-template-rows: auto auto;
    }

    @media (max-width: 860px) {
      body {
        padding: 16px;
      }

      body.activity-pane {
        padding: 10px;
      }

      .panel-grid {
        grid-template-columns: 1fr;
      }

      .surface-grid {
        grid-template-columns: 1fr;
      }

      body.activity-pane .surface-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .surface-controls,
      .options-stack,
      .options-grid {
        grid-template-columns: 1fr;
      }

      .option-wide {
        grid-column: auto;
      }

      .options-buttons {
        justify-content: start;
      }
    }

    @media (max-width: 320px) {
      body.activity-pane .surface-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body class="${bodyClass}">
  <main class="page">
    <header class="intro">
      <div class="brand-lockup">
        ${titleIconHtml}
        <h1>Camaleone</h1>
      </div>
      <p>Two colors, one window identity.</p>
    </header>

    <section class="panel-grid">
      <section class="controls" aria-label="Color picker">
        <div class="group">
          <h2>Colors</h2>

          <div class="field">
            <label for="startText">Start color</label>
            <div class="color-row">
              <input id="startColor" type="color" aria-label="Start color picker">
              <input id="startText" type="text" spellcheck="false" inputmode="text">
            </div>
          </div>

          <div class="field">
            <label for="endText">End color</label>
            <div class="color-row">
              <input id="endColor" type="color" aria-label="End color picker">
              <input id="endText" type="text" spellcheck="false" inputmode="text">
            </div>
          </div>

          <div class="primary-apply-row">
            <button id="apply" class="primary-action" type="button"><span class="button-icon" aria-hidden="true">&#10003;</span><span>Apply colors</span></button>
          </div>

          <div class="colors-divider" aria-hidden="true"></div>

          <div class="colors-secondary-row">
            <button id="surprise" class="secondary" type="button"><span class="button-icon" aria-hidden="true">&#10022;</span><span>Surprise me</span></button>
            <label class="checkbox-row sober-toggle">
              <input id="sober" type="checkbox">
              <span>Sober</span>
            </label>
          </div>

          <div id="status" class="status" role="status"></div>
          <p id="surpriseNote" class="help"></p>
        </div>
      </section>

      <section class="preview" aria-label="Color palette preview">
        <div class="gradient-strip"></div>
        <div id="surfacePreview" class="surface-grid"></div>
      </section>

${customizeSectionHtml}

      <div class="options-stack">
        <section class="extras" aria-label="Options">
          <div class="extras-head">
            <h2>Options</h2>
          </div>

          <div class="options-container">
            <div class="options-section">
              <div class="options-section-title">Color behavior</div>
              <div class="options-grid">
                <div class="field option-item option-wide">
                  <label for="intensity">Intensity <span id="intensityValue"></span></label>
                  <input id="intensity" type="range" min="0" max="100" step="1">
                </div>

                <div class="option-item option-checkbox-group">
                  <div class="option-help-wrap">
                    <div class="option-toggle-row">
                      <label class="checkbox-row option-toggle">
                        <input id="monochromatic" type="checkbox">
                        <span>Monochromatic</span>
                      </label>
                      <button class="help-trigger" type="button" aria-label="Explain monochromatic mode" aria-expanded="false" aria-controls="monochromaticHelp" data-help-target="monochromaticHelp">?</button>
                    </div>
                    <div id="monochromaticHelp" class="option-help-panel" role="dialog" aria-label="Monochromatic mode explanation" hidden>
                      Uses the start color as the anchor and derives related active surface colors from it. It keeps the current palette state instead of generating a new random scheme.
                    </div>
                  </div>

                  <div class="option-help-wrap">
                    <div class="option-toggle-row">
                      <label class="checkbox-row option-toggle">
                        <input id="includeEditorAccent" type="checkbox">
                        <span>Tint editor selection/cursor</span>
                      </label>
                      <button class="help-trigger" type="button" aria-label="Explain editor tinting" aria-expanded="false" aria-controls="editorAccentHelp" data-help-target="editorAccentHelp">?</button>
                    </div>
                    <div id="editorAccentHelp" class="option-help-panel" role="dialog" aria-label="Editor tint explanation" hidden>
                      Adds the active palette color to editor selection, line highlight, cursor, find match, and active links. Leave it off when you only want the IDE chrome to change.
                    </div>
                  </div>
                </div>

                <div class="field option-item">
                  <label for="panelHarmony">Colour relationship</label>
                  <select id="panelHarmony">
                    <option value="manual">Manual</option>
                    <option value="analogous">Analogous</option>
                    <option value="complementary">Complementary</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="options-section">
              <div class="options-section-title">Presets</div>
              <div class="preset-filter-row" aria-label="Preset filters">
                ${presetFilterButtonsHtml}
              </div>
              <div class="favorite-row">
                <select id="favorites" aria-label="Favourite color sets"></select>
                <button id="deleteFavorite" class="secondary" type="button"><span class="button-icon" aria-hidden="true">&#10005;</span><span>Delete</span></button>
              </div>
            </div>
          </div>
        </section>

        <section class="actions" aria-label="Actions">
          <div class="actions-head">
            <h2>Actions</h2>
          </div>

          <div class="actions-container">
            <div class="button-row compact options-buttons">
              <button id="clear" class="secondary" type="button">${revertIconHtml}<span>Restore previous</span></button>
              <button id="resetDefault" class="secondary" type="button">${resetIconHtml}<span>Reset IDE defaults</span></button>
              <button id="saveFavorite" class="secondary" type="button">${saveFavoriteIconHtml}<span>Save as favourite...</span></button>
            </div>
          </div>
        </section>
      </div>
    </section>
  </main>

  <div id="favoriteModal" class="modal-backdrop" hidden>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="favoriteModalTitle">
      <h2 id="favoriteModalTitle">Save as favourite</h2>
      <div class="field">
        <label for="favoriteNameInput">Name</label>
        <input id="favoriteNameInput" type="text" maxlength="48" spellcheck="false" placeholder="e.g., 'Project Green Focus'">
      </div>
      <div id="favoriteNameError" class="status error" role="alert"></div>
      <div class="button-row compact modal-actions">
        <button id="favoriteCancel" class="secondary" type="button">Cancel</button>
        <button id="favoriteConfirm" class="primary-action" type="button">${saveFavoriteIconHtml}<span>Save</span></button>
      </div>
    </section>
  </div>

  <script nonce="${nonce}">
    /**
     * Browser-side picker controller.
     *
     * The webview keeps preview state locally and sends normalized messages to
     * the extension host for actual settings writes.
     */
    const vscode = acquireVsCodeApi();
    const state = ${safeState};
    const isActivityPane = state && state.layout === "activityBar";
    const colorPickerIconSrc = state.pickerIcons && state.pickerIcons.colorPicker ? state.pickerIcons.colorPicker : "";
    const surpriseDistinctProbability = ${SURPRISE_DISTINCT_PROBABILITY};
    const surpriseDistinctHueMin = ${SURPRISE_DISTINCT_HUE_MIN};
    const surpriseDistinctHueMax = ${SURPRISE_DISTINCT_HUE_MAX};
    const surpriseSimilarHueMin = ${SURPRISE_SIMILAR_HUE_MIN};
    const surpriseSimilarHueMax = ${SURPRISE_SIMILAR_HUE_MAX};

    const elements = {
      startColor: document.getElementById("startColor"),
      startText: document.getElementById("startText"),
      endColor: document.getElementById("endColor"),
      endText: document.getElementById("endText"),
      intensity: document.getElementById("intensity"),
      intensityValue: document.getElementById("intensityValue"),
      includeEditorAccent: document.getElementById("includeEditorAccent"),
      monochromatic: document.getElementById("monochromatic"),
      sober: document.getElementById("sober"),
      panelHarmony: document.getElementById("panelHarmony"),
      surfaceControls: document.getElementById("surfaceControls"),
      surfacePreview: document.getElementById("surfacePreview"),
      favorites: document.getElementById("favorites"),
      presetFilters: Array.from(document.querySelectorAll("[data-preset-filter]")),
      deleteFavorite: document.getElementById("deleteFavorite"),
      saveFavorite: document.getElementById("saveFavorite"),
      surprise: document.getElementById("surprise"),
      surpriseNote: document.getElementById("surpriseNote"),
      apply: document.getElementById("apply"),
      clear: document.getElementById("clear"),
      resetDefault: document.getElementById("resetDefault"),
      favoriteModal: document.getElementById("favoriteModal"),
      favoriteNameInput: document.getElementById("favoriteNameInput"),
      favoriteNameError: document.getElementById("favoriteNameError"),
      favoriteCancel: document.getElementById("favoriteCancel"),
      favoriteConfirm: document.getElementById("favoriteConfirm"),
      status: document.getElementById("status")
    };

    const surfaces = Array.isArray(state.surfaces) ? state.surfaces : [];
    const surfaceControlMap = new Map();
    const surfacePreviewMap = new Map();
    let favorites = Array.isArray(state.favorites) ? state.favorites : [];
    let selectedFavoriteName;
    let activePresetFilter = "all";
    const soberSideBarGeneratedColorWeight = ${SOBER_SIDE_BAR_GENERATED_COLOR_WEIGHT};
    let applyTimer;

    /**
     * Creates dynamic controls, loads initial state, and registers UI events.
     */
    function initialize() {
      if (isActivityPane) {
        createSurfacePreview();
      } else {
        createSurfaceControls();
        createSurfacePreview();
      }
      renderFavorites();
      setChoices(state);
      registerHelpPopups();

      elements.startColor.addEventListener("input", () => syncFromColor(elements.startColor, elements.startText));
      elements.endColor.addEventListener("input", () => {
        syncFromColor(elements.endColor, elements.endText);
      });
      elements.startText.addEventListener("input", () => syncFromText(elements.startText, elements.startColor));
      elements.endText.addEventListener("input", () => {
        syncFromText(elements.endText, elements.endColor);
      });
      elements.intensity.addEventListener("input", () => updatePreviewAndApply(60));
      elements.intensity.addEventListener("change", () => updatePreviewAndApply(0));
      elements.includeEditorAccent.addEventListener("change", () => updatePreviewAndApply(0));
      elements.sober.addEventListener("change", () => updatePreviewAndApply(0));
      elements.monochromatic.addEventListener("change", () => {
        if (elements.monochromatic.checked && elements.panelHarmony.value === "manual") {
          elements.panelHarmony.value = "analogous";
        }
        updatePreviewAndApply(0);
      });
      elements.panelHarmony.addEventListener("change", () => updatePreviewAndApply(0));
      elements.apply.addEventListener("click", postApply);
      elements.clear.addEventListener("click", postClear);
      elements.resetDefault.addEventListener("click", postResetDefault);
      elements.surprise.addEventListener("click", surpriseMe);
      elements.saveFavorite.addEventListener("click", openSaveFavoriteModal);
      elements.favoriteConfirm.addEventListener("click", confirmSaveFavorite);
      elements.favoriteCancel.addEventListener("click", closeSaveFavoriteModal);
      elements.favoriteModal.addEventListener("click", (event) => {
        if (event.target === elements.favoriteModal) {
          closeSaveFavoriteModal();
        }
      });
      elements.favoriteNameInput.addEventListener("input", () => {
        elements.favoriteNameError.textContent = "";
      });
      elements.favoriteNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          confirmSaveFavorite();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeSaveFavoriteModal();
        }
      });
      elements.favorites.addEventListener("change", () => {
        syncFavoriteActions();
        applySelectedFavorite();
      });
      for (const button of elements.presetFilters) {
        button.addEventListener("click", () => {
          activePresetFilter = button.dataset.presetFilter || "all";
          renderFavorites();
        });
      }
      elements.deleteFavorite.addEventListener("click", postDeleteFavorite);

      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message && message.type === "status") {
          setStatus(message.text, message.level);
        }
        if (message && message.type === "favorites") {
          favorites = Array.isArray(message.favorites) ? message.favorites : [];
          renderFavorites();
        }
        if (message && message.type === "resetLocal") {
          selectedFavoriteName = undefined;
          setChoices(message.choices || state.defaultChoices);
        }
      });

      updatePreview();
    }

    /**
     * Builds one editable color row for a surface definition.
     */
    function createSurfaceControl(surface, options = {}) {
      const row = document.createElement("div");
      row.className = options.inline ? "surface-control surface-control-inline" : "surface-control";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";

      const resetButton = document.createElement("button");
      resetButton.type = "button";
      resetButton.className = "secondary surface-reset";
      resetButton.innerHTML = ${surfaceRevertButtonHtml};
      resetButton.disabled = true;
      resetButton.setAttribute("aria-label", "Revert " + surface.label + " to suggested color");

      const colorRow = document.createElement("div");
      colorRow.className = "color-row";
      const color = document.createElement("input");
      color.type = "color";
      color.setAttribute("aria-label", surface.label + " color picker");
      const text = document.createElement("input");
      text.type = "text";
      text.spellcheck = false;
      text.inputMode = "text";

      let pickerButton;
      if (options.inline) {
        const inlineHead = document.createElement("div");
        inlineHead.className = "surface-inline-head";

        const label = document.createElement("div");
        label.className = "field-label surface-color-title";
        label.textContent = surface.label;

        pickerButton = document.createElement("button");
        pickerButton.type = "button";
        pickerButton.className = "surface-color-button";
        pickerButton.setAttribute("aria-label", surface.label + " color picker");

        const pickerIcon = colorPickerIconSrc ? document.createElement("img") : document.createElement("span");
        pickerIcon.className = colorPickerIconSrc ? "surface-picker-icon-image" : "surface-picker-icon";
        pickerIcon.setAttribute("aria-hidden", "true");
        if (colorPickerIconSrc) {
          pickerIcon.src = colorPickerIconSrc;
          pickerIcon.alt = "";
          pickerIcon.loading = "lazy";
        }

        color.className = "surface-native-color";
        text.className = "surface-hidden-text";
        resetButton.classList.add("surface-reset-icon");
        resetButton.innerHTML = ${surfaceRevertIconOnlyHtml};

        const actions = document.createElement("div");
        actions.className = "surface-inline-actions";

        inlineHead.append(label);
        pickerButton.append(pickerIcon);
        actions.append(pickerButton, resetButton);
        row.append(inlineHead, actions, color, text);
      } else {
        const head = document.createElement("div");
        head.className = "surface-head";

        const title = document.createElement("div");
        title.className = "surface-title";

        const label = document.createElement("div");
        label.className = "field-label";
        label.textContent = surface.label;

        title.append(label);
        head.append(title, resetButton);
        colorRow.append(color, text);
        row.append(head, colorRow);
      }

      checkbox.addEventListener("change", () => {
        color.disabled = !checkbox.checked;
        text.disabled = !checkbox.checked;
        checkbox.dataset.custom = checkbox.checked ? "true" : "false";
        resetButton.disabled = checkbox.dataset.custom !== "true";
        updatePreviewAndApply(0);
      });
      // Color edits immediately mark a surface as a user override.
      const markCustomSurface = () => {
        checkbox.checked = true;
        checkbox.dataset.custom = "true";
        color.disabled = false;
        text.disabled = false;
        resetButton.disabled = false;
      };

      color.addEventListener("input", () => {
        markCustomSurface();
        text.value = color.value;
        updatePreviewAndApply(120);
      });
      color.addEventListener("change", () => {
        markCustomSurface();
        text.value = color.value;
        updatePreviewAndApply(0);
      });
      text.addEventListener("input", () => {
        const normalized = normalizeHex(text.value);
        if (normalized) {
          markCustomSurface();
          color.value = normalized;
          updatePreviewAndApply(180);
          return;
        }
        updatePreview();
      });
      text.addEventListener("change", () => {
        const normalized = normalizeHex(text.value);
        if (!normalized) {
          return;
        }
        markCustomSurface();
        color.value = normalized;
          text.value = normalized;
          updatePreviewAndApply(0);
      });
      if (pickerButton) {
        pickerButton.addEventListener("click", () => {
          if (!color.disabled) {
            color.click();
          }
        });
      }
      resetButton.addEventListener("click", () => revertSurfaceOverride(surface.id));

      return {
        row,
        control: { checkbox, color, text, resetButton, pickerButton }
      };
    }

    /**
     * Builds one editable color row per surface definition.
     */
    function createSurfaceControls() {
      if (!elements.surfaceControls) {
        return;
      }

      elements.surfaceControls.textContent = "";
      for (const surface of surfaces) {
        const created = createSurfaceControl(surface);
        surfaceControlMap.set(surface.id, created.control);
        elements.surfaceControls.append(created.row);
      }
    }

    /**
     * Builds the palette preview tiles. In the Activity Bar pane the editable
     * color controls live directly on these first color cards.
     */
    function createSurfacePreview() {
      elements.surfacePreview.textContent = "";
      for (const surface of surfaces) {
        const preview = document.createElement("div");
        preview.className = "surface-preview";
        const hex = document.createElement("span");
        hex.textContent = "";

        if (isActivityPane) {
          const created = createSurfaceControl(surface, { inline: true });
          hex.className = "surface-preview-generated";
          surfaceControlMap.set(surface.id, created.control);
          preview.append(created.row, hex);
        } else {
          const strong = document.createElement("strong");
          strong.textContent = surface.label;
          preview.append(strong, hex);
        }

        surfacePreviewMap.set(surface.id, { preview, hex });
        elements.surfacePreview.append(preview);
      }
    }

    /**
     * Loads a complete choice object into form controls.
     */
    function setChoices(choices) {
      const next = choices || {};
      const startColor = normalizeHex(next.startColor) || state.defaultChoices.startColor;
      const endColor = normalizeHex(next.endColor) || state.defaultChoices.endColor;
      elements.startColor.value = startColor;
      elements.startText.value = startColor;
      elements.endColor.value = endColor;
      elements.endText.value = endColor;
      elements.intensity.value = String(Number.isFinite(Number(next.intensity)) ? next.intensity : state.defaultChoices.intensity);
      elements.includeEditorAccent.checked = Boolean(next.includeEditorAccent);
      elements.monochromatic.checked = Boolean(next.monochromatic);
      elements.sober.checked = Boolean(next.sober);
      elements.panelHarmony.value = getRelationshipValue(next);
      if (elements.monochromatic.checked && elements.panelHarmony.value === "manual") {
        elements.panelHarmony.value = "analogous";
      }
      setSurfaceOverrides(next.surfaceOverrides || {});
      updatePreview();
    }

    /**
     * Chooses the active relationship value from current and legacy choice keys.
     */
    function getRelationshipValue(choices) {
      if (choices.colorRelationship === "analogous" || choices.colorRelationship === "complementary") {
        return choices.colorRelationship;
      }
      if (choices.monochromatic && choices.panelHarmony === "complementary") {
        return "complementary";
      }
      if (choices.monochromatic && choices.panelHarmony === "analogous") {
        return "analogous";
      }
      return "manual";
    }

    /**
     * Applies saved per-surface overrides while keeping generated defaults visible.
     */
    function setSurfaceOverrides(overrides) {
      for (const surface of surfaces) {
        const control = surfaceControlMap.get(surface.id);
        const normalized = normalizeHex(overrides[surface.id]);
        const generated = solidHex(getGeneratedSurfaceColors({}, true)[surface.id]) || state.defaultChoices.startColor;
        control.checkbox.checked = true;
        control.checkbox.dataset.custom = normalized ? "true" : "false";
        control.color.value = normalized || generated;
        control.text.value = normalized || generated;
        control.color.disabled = false;
        control.text.disabled = false;
        control.resetButton.disabled = !normalized;
      }
    }

    /**
     * Clears one custom surface override and restores the generated suggestion.
     */
    function revertSurfaceOverride(surfaceId) {
      const control = surfaceControlMap.get(surfaceId);
      if (!control) {
        return;
      }

      const suggested = solidHex(getGeneratedSurfaceColors({}, true)[surfaceId]) || state.defaultChoices.startColor;
      control.checkbox.checked = true;
      control.checkbox.dataset.custom = "false";
      control.color.value = suggested;
      control.text.value = suggested;
      control.color.disabled = false;
      control.text.disabled = false;
      control.resetButton.disabled = true;
      updatePreviewAndApply(0);
    }

    /**
     * Collects the form into the message payload understood by the extension host.
     */
    function collectChoices() {
      return {
        startColor: normalizeHex(elements.startText.value) || elements.startColor.value,
        endColor: normalizeHex(elements.endText.value) || elements.endColor.value,
        intensity: Number(elements.intensity.value),
        applyTo: "workspace",
        includeEditorAccent: elements.includeEditorAccent.checked,
        monochromatic: elements.monochromatic.checked,
        sober: elements.sober.checked,
        colorRelationship: elements.panelHarmony.value,
        panelHarmony: selectedHarmonyRelationship(),
        surfaceOverrides: collectSurfaceOverrides()
      };
    }

    /**
     * Collects only surface rows explicitly marked as custom overrides.
     */
    function collectSurfaceOverrides() {
      const overrides = {};
      for (const surface of surfaces) {
        const control = surfaceControlMap.get(surface.id);
        const normalized = normalizeHex(control.text.value) || normalizeHex(control.color.value);
        if (control.checkbox.checked && control.checkbox.dataset.custom === "true" && normalized) {
          overrides[surface.id] = normalized;
        }
      }
      return overrides;
    }

    /**
     * Normalizes 3- or 6-digit hex input for browser-side previews.
     */
    function normalizeHex(value) {
      const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(String(value || "").trim());
      if (!match) {
        return undefined;
      }
      const hex = match[1];
      if (hex.length === 3) {
        return ("#" + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]).toLowerCase();
      }
      return ("#" + hex).toLowerCase();
    }

    /**
     * Converts a hex color to RGB channels for preview math.
     */
    function hexToRgb(hex) {
      const normalized = normalizeHex(hex) || "#000000";
      return {
        r: parseInt(normalized.slice(1, 3), 16),
        g: parseInt(normalized.slice(3, 5), 16),
        b: parseInt(normalized.slice(5, 7), 16)
      };
    }

    /**
     * Converts RGB channels to a preview hex color.
     */
    function rgbToHex(rgb) {
      const toHex = (channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0");
      return "#" + toHex(rgb.r) + toHex(rgb.g) + toHex(rgb.b);
    }

    /**
     * Mixes two RGB colors for generated preview colors.
     */
    function mix(startHex, endHex, ratio) {
      const start = hexToRgb(startHex);
      const end = hexToRgb(endHex);
      return rgbToHex({
        r: start.r + (end.r - start.r) * ratio,
        g: start.g + (end.g - start.g) * ratio,
        b: start.b + (end.b - start.b) * ratio
      });
    }

    /**
     * Keeps generated sober side bars tied to the palette while biasing them dark.
     */
    function soberGeneratedSideBarColor(color) {
      return mix("#000000", color, soberSideBarGeneratedColorWeight);
    }

    /**
     * Adds alpha to a preview color for translucent surfaces.
     */
    function withAlpha(hex, alpha) {
      const normalized = normalizeHex(hex) || "#000000";
      const alphaHex = Math.max(0, Math.min(255, Math.round(Math.max(0, Math.min(1, alpha)) * 255)))
        .toString(16)
        .padStart(2, "0");
      return normalized + alphaHex;
    }

    /**
     * Removes alpha when an input control needs a solid color.
     */
    function solidHex(hex) {
      const normalized = normalizeHex(hex);
      if (normalized) {
        return normalized;
      }
      const match = /^#([0-9a-fA-F]{8})$/.exec(String(hex || "").trim());
      return match ? ("#" + match[1].slice(0, 6)).toLowerCase() : undefined;
    }

    /**
     * Resolves translucent colors against the theme base for readable preview text.
     */
    function effectivePreviewColor(hex, baseHex) {
      const solid = solidHex(hex) || "#000000";
      const match = /^#([0-9a-fA-F]{8})$/.exec(String(hex || "").trim());
      if (!match) {
        return solid;
      }
      const alpha = parseInt(match[1].slice(6, 8), 16) / 255;
      return mix(baseHex, solid, alpha);
    }

    /**
     * Picks black or white preview text for a solid background.
     */
    function contrast(hex) {
      const rgb = hexToRgb(hex);
      const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
      return luminance > 0.54 ? "#000000" : "#ffffff";
    }

    /**
     * Mirrors native color input changes into the text field.
     */
    function syncFromColor(colorInput, textInput) {
      textInput.value = colorInput.value;
      updatePreviewAndApply(80);
    }

    /**
     * Mirrors valid text color edits into the native color input.
     */
    function syncFromText(textInput, colorInput) {
      const normalized = normalizeHex(textInput.value);
      if (normalized) {
        colorInput.value = normalized;
        updatePreviewAndApply(180);
        return;
      }
      updatePreview();
    }

    /**
     * Wires option help buttons to small floating explanations.
     */
    function registerHelpPopups() {
      for (const trigger of document.querySelectorAll("[data-help-target]")) {
        trigger.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleHelpPopup(trigger);
        });
      }

      document.addEventListener("click", (event) => {
        if (!event.target.closest(".option-help-wrap")) {
          closeHelpPopups();
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeHelpPopups();
        }
      });
    }

    /**
     * Opens the requested help popup and closes any other visible popup.
     */
    function toggleHelpPopup(trigger) {
      const panel = document.getElementById(trigger.dataset.helpTarget);
      if (!panel) {
        return;
      }

      const shouldOpen = panel.hidden;
      closeHelpPopups();
      panel.hidden = !shouldOpen;
      trigger.setAttribute("aria-expanded", String(shouldOpen));
    }

    /**
     * Hides every option help popup.
     */
    function closeHelpPopups() {
      for (const panel of document.querySelectorAll(".option-help-panel")) {
        panel.hidden = true;
      }
      for (const trigger of document.querySelectorAll("[data-help-target]")) {
        trigger.setAttribute("aria-expanded", "false");
      }
    }

    /**
     * Returns the legacy harmony relationship expected by monochromatic choices.
     */
    function selectedHarmonyRelationship() {
      return elements.panelHarmony.value === "complementary" ? "complementary" : "analogous";
    }

    /**
     * Derives a preview harmony color from one base color.
     */
    function harmonyColor(baseColor, position, harmonyMode) {
      const base = hexToHsl(baseColor);
      if (harmonyMode === "complementary") {
        return hslToHex({
          h: rotateHue(base.h, 180 * position),
          s: Math.max(46, Math.min(88, base.s + (position - 0.5) * 10)),
          l: Math.max(36, Math.min(66, base.l + (position - 0.5) * 12))
        });
      }

      return hslToHex({
        h: rotateHue(base.h, (position - 0.5) * 58),
        s: Math.max(42, Math.min(86, base.s + (position - 0.5) * 8)),
        l: Math.max(36, Math.min(66, base.l + (position - 0.5) * 10))
      });
    }

    /**
     * Samples the current preview palette relationship.
     */
    function paletteColor(startColor, endColor, position, relationship) {
      if (relationship === "manual") {
        return mix(startColor, endColor, position);
      }

      return mixHsl(startColor, endColor, position, relationship === "complementary");
    }

    /**
     * Mixes two preview colors in HSL space.
     */
    function mixHsl(startColor, endColor, position, useLongHuePath) {
      const start = hexToHsl(startColor);
      const end = hexToHsl(endColor);
      const ratio = Math.max(0, Math.min(1, position));
      const hueDelta = hueDeltaBetween(start.h, end.h, useLongHuePath);

      return hslToHex({
        h: rotateHue(start.h, hueDelta * ratio),
        s: start.s + (end.s - start.s) * ratio,
        l: start.l + (end.l - start.l) * ratio
      });
    }

    /**
     * Returns the short or long hue interpolation delta.
     */
    function hueDeltaBetween(startHue, endHue, useLongHuePath) {
      const shortest = ((endHue - startHue + 540) % 360) - 180;
      if (!useLongHuePath) {
        return shortest;
      }

      if (shortest === 0) {
        return 360;
      }

      return shortest > 0 ? shortest - 360 : shortest + 360;
    }

    /**
     * Generates the preview colors for every surface.
     */
    function getGeneratedSurfaceColors(overrideInput, ignoreCustom) {
      const start = normalizeHex(elements.startText.value) || elements.startColor.value;
      const end = normalizeHex(elements.endText.value) || elements.endColor.value;
      const intensity = Number(elements.intensity.value) / 100;
      const base = state.baseColor || "#1e1e1e";
      const overrides = overrideInput || collectSurfaceOverrides();
      const monochromatic = elements.monochromatic.checked;
      const sober = elements.sober.checked;
      const harmonyMode = selectedHarmonyRelationship();
      const colors = {};

      // Sober mode keeps secondary surfaces restrained; generated side bars stay
      // palette-tinted but dark-biased unless explicitly customized.
      for (const surface of surfaces) {
        const hasCustomOverride = !ignoreCustom && overrides[surface.id];

        if (sober) {
          const soberFallback = (() => {
            if (surface.id === "titleBar") {
              return monochromatic
                ? harmonyColor(start, 0, harmonyMode)
                : paletteColor(start, end, 0, elements.panelHarmony.value);
            }
            if (surface.id === "activityBar") {
              return monochromatic
                ? harmonyColor(start, surface.sample, harmonyMode)
                : paletteColor(start, end, surface.sample, elements.panelHarmony.value);
            }
            if (surface.id === "statusBar") {
              return monochromatic
                ? harmonyColor(start, 1, harmonyMode)
                : paletteColor(start, end, 1, elements.panelHarmony.value);
            }
            if (surface.id === "remoteIndicator") {
              return monochromatic
                ? harmonyColor(start, surface.sample, harmonyMode)
                : paletteColor(start, end, surface.sample, elements.panelHarmony.value);
            }
            if (surface.id === "sideBar") {
              const generated = monochromatic
                ? harmonyColor(start, surface.sample, harmonyMode)
                : paletteColor(start, end, surface.sample, elements.panelHarmony.value);
              return soberGeneratedSideBarColor(generated);
            }
            if (surface.id === "editorAccent" && elements.includeEditorAccent.checked) {
              return monochromatic
                ? harmonyColor(start, surface.sample, harmonyMode)
                : paletteColor(start, end, surface.sample, elements.panelHarmony.value);
            }
            return "#1e1e1e";
          })();
          const source = hasCustomOverride ? overrides[surface.id] : soberFallback;
          colors[surface.id] = mix("#1e1e1e", source, Math.max(0, Math.min(1, intensity * surface.strength)));
          continue;
        }

        const generated = monochromatic
          ? harmonyColor(start, surface.sample, harmonyMode)
          : paletteColor(start, end, surface.sample, elements.panelHarmony.value);
        const source = hasCustomOverride ? overrides[surface.id] : generated;
        const color = mix(base, source, Math.max(0, Math.min(1, intensity * surface.strength)));
        colors[surface.id] = color;
      }

      return colors;
    }

    /**
     * Sets per-card action colors so inline controls stay readable on both
     * light and dark generated surface colors.
     */
    function setActivityPaneActionContrast(element, foreground) {
      const useLightInk = foreground === "#ffffff";
      element.style.setProperty("--surface-action-foreground", foreground);
      element.style.setProperty("--surface-action-border", useLightInk ? "rgba(255, 255, 255, 0.62)" : "rgba(0, 0, 0, 0.48)");
      element.style.setProperty("--surface-action-background", useLightInk ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.10)");
      element.style.setProperty("--surface-action-hoverBackground", useLightInk ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.16)");
      element.style.setProperty("--surface-picker-filter", useLightInk ? "brightness(0) invert(1)" : "brightness(0)");
    }

    /**
     * Renders the gradient strip, surface cards, labels, and control defaults.
     */
    function updatePreview() {
      const start = normalizeHex(elements.startText.value) || elements.startColor.value;
      const end = normalizeHex(elements.endText.value) || elements.endColor.value;
      const colors = getGeneratedSurfaceColors();
      const base = state.baseColor || "#1e1e1e";
      document.body.style.setProperty("--start", start);
      document.body.style.setProperty("--end", !elements.sober.checked && elements.monochromatic.checked ? harmonyColor(start, 1, selectedHarmonyRelationship()) : end);
      elements.intensityValue.textContent = elements.intensity.value + "%";

      for (const surface of surfaces) {
        const control = surfaceControlMap.get(surface.id);
        const preview = surfacePreviewMap.get(surface.id);
        const color = colors[surface.id] || start;
        const controlColor = solidHex(color) || start;

        if (control && (!control.checkbox.checked || control.checkbox.dataset.custom !== "true")) {
          control.color.value = controlColor;
          control.text.value = controlColor;
          control.color.disabled = !control.checkbox.checked;
          control.text.disabled = !control.checkbox.checked;
        }
        if (control) {
          control.resetButton.disabled = control.checkbox.dataset.custom !== "true";
        }

        if (preview) {
          const foreground = contrast(effectivePreviewColor(color, base));
          preview.preview.style.background = color;
          preview.preview.style.color = foreground;
          if (isActivityPane) {
            setActivityPaneActionContrast(preview.preview, foreground);
          }
          preview.hex.textContent = color;
        }
      }
    }

    /**
     * Refreshes the preview and schedules an automatic apply.
     */
    function updatePreviewAndApply(delay) {
      updatePreview();
      scheduleApply(delay);
    }

    /**
     * Debounces settings writes while users drag sliders or type colors.
     */
    function scheduleApply(delay) {
      if (applyTimer) {
        clearTimeout(applyTimer);
      }

      applyTimer = setTimeout(() => {
        applyTimer = undefined;
        postApply();
      }, Math.max(0, Number(delay) || 0));
    }

    /**
     * Sends the current choices to the extension host for persistence.
     */
    function postApply() {
      if (applyTimer) {
        clearTimeout(applyTimer);
        applyTimer = undefined;
      }

      const choices = collectChoices();
      if (!choices.startColor || !choices.endColor) {
        setStatus("Use valid hex colors such as #0ea5e9.", "error");
        return;
      }

      vscode.postMessage({ type: "apply", ...choices });
    }

    /**
     * Requests restoration of the previous tracked workbench colors.
     */
    function postClear() {
      vscode.postMessage({ type: "clear" });
    }

    /**
     * Requests removal of Camaleone-managed color customizations.
     */
    function postResetDefault() {
      vscode.postMessage({ type: "resetDefault" });
    }

    /**
     * Creates a random preview palette without writing settings until applied.
     */
    function surpriseMe() {
      selectedFavoriteName = undefined;
      const distinctive = Math.random() < surpriseDistinctProbability;
      const start = randomReadableColor();
      const startHsl = hexToHsl(start);
      const endHsl = createSurpriseEndHsl(startHsl, distinctive);
      const end = hslToHex({
        h: endHsl.h,
        s: Math.max(46, Math.min(88, startHsl.s + randomBetween(-8, 8))),
        l: Math.max(38, Math.min(64, startHsl.l + randomBetween(-7, 7)))
      });

      elements.startColor.value = start;
      elements.startText.value = start;
      elements.endColor.value = end;
      elements.endText.value = end;
      elements.monochromatic.checked = false;
      elements.panelHarmony.value = distinctive ? "complementary" : "analogous";
      clearSurfaceOverrides();
      elements.surpriseNote.textContent = distinctive
        ? "Generated a distinctive color pair."
        : "Generated an analogous color pair.";
      updatePreviewAndApply(0);
    }

    /**
     * Picks the end hue for a surprise preview palette.
     */
    function createSurpriseEndHsl(startHsl, distinctive) {
      const direction = Math.random() < 0.5 ? -1 : 1;
      const hueDistance = distinctive
        ? randomBetween(surpriseDistinctHueMin, surpriseDistinctHueMax)
        : randomBetween(surpriseSimilarHueMin, surpriseSimilarHueMax);

      return { ...startHsl, h: rotateHue(startHsl.h, direction * hueDistance) };
    }

    /**
     * Marks all surface controls as generated rather than custom.
     */
    function clearSurfaceOverrides() {
      for (const surface of surfaces) {
        const control = surfaceControlMap.get(surface.id);
        control.checkbox.checked = true;
        control.checkbox.dataset.custom = "false";
        control.color.disabled = false;
        control.text.disabled = false;
        control.resetButton.disabled = true;
      }
    }

    /**
     * Generates a random readable color for surprise palettes.
     */
    function randomReadableColor() {
      return hslToHex({
        h: Math.floor(Math.random() * 360),
        s: randomBetween(54, 86),
        l: randomBetween(40, 61)
      });
    }

    /**
     * Returns a random integer in the inclusive range.
     */
    function randomBetween(min, max) {
      return Math.floor(min + Math.random() * (max - min + 1));
    }

    /**
     * Rotates a hue into the 0-359 degree range.
     */
    function rotateHue(hue, amount) {
      return ((hue + amount) % 360 + 360) % 360;
    }

    /**
     * Converts a preview hex color to HSL components.
     */
    function hexToHsl(hex) {
      const rgb = hexToRgb(hex);
      const r = rgb.r / 255;
      const g = rgb.g / 255;
      const b = rgb.b / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const delta = max - min;
        s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        if (max === r) {
          h = (g - b) / delta + (g < b ? 6 : 0);
        } else if (max === g) {
          h = (b - r) / delta + 2;
        } else {
          h = (r - g) / delta + 4;
        }
        h *= 60;
      }

      return { h, s: s * 100, l: l * 100 };
    }

    /**
     * Converts preview HSL components to a hex color.
     */
    function hslToHex(hsl) {
      const h = rotateHue(hsl.h, 0) / 360;
      const s = Math.max(0, Math.min(100, hsl.s)) / 100;
      const l = Math.max(0, Math.min(100, hsl.l)) / 100;

      if (s === 0) {
        return rgbToHex({ r: l * 255, g: l * 255, b: l * 255 });
      }

      const hueToRgb = (p, q, tInput) => {
        let t = tInput;
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      return rgbToHex({
        r: hueToRgb(p, q, h + 1 / 3) * 255,
        g: hueToRgb(p, q, h) * 255,
        b: hueToRgb(p, q, h - 1 / 3) * 255
      });
    }

    /**
     * Opens the in-window favorite naming modal.
     */
    function openSaveFavoriteModal() {
      elements.favoriteNameInput.value = selectedFavoriteName || "";
      elements.favoriteNameError.textContent = "";
      elements.favoriteModal.hidden = false;
      requestAnimationFrame(() => {
        elements.favoriteNameInput.focus();
        elements.favoriteNameInput.select();
      });
    }

    /**
     * Closes the in-window favorite naming modal.
     */
    function closeSaveFavoriteModal() {
      elements.favoriteModal.hidden = true;
      elements.favoriteNameError.textContent = "";
      elements.saveFavorite.focus();
    }

    /**
     * Returns a valid favorite name or shows an inline modal error.
     */
    function readFavoriteName() {
      const name = elements.favoriteNameInput.value.trim();
      if (!name) {
        elements.favoriteNameError.textContent = "Give the favourite a name.";
        return undefined;
      }
      if (name.length > 48) {
        elements.favoriteNameError.textContent = "Use 48 characters or fewer.";
        return undefined;
      }
      return name;
    }

    /**
     * Sends the current choices to be saved as a named favorite.
     */
    function confirmSaveFavorite() {
      const favoriteName = readFavoriteName();
      if (!favoriteName) {
        return;
      }
      selectedFavoriteName = favoriteName;
      closeSaveFavoriteModal();
      vscode.postMessage({
        type: "saveFavorite",
        favoriteName,
        ...collectChoices()
      });
    }

    /**
     * Renders the favorite selector with a disabled placeholder.
     */
    function renderFavorites() {
      elements.favorites.textContent = "";
      selectedFavoriteName = undefined;
      syncPresetFilterButtons();
      const visibleFavorites = activePresetFilter === "all"
        ? favorites
        : favorites.filter((favorite) => favorite.presetGroup === activePresetFilter);
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = visibleFavorites.length ? "choose from the list..." : "No presets in this group";
      placeholder.disabled = true;
      placeholder.selected = true;
      elements.favorites.append(placeholder);

      if (!visibleFavorites.length) {
        elements.favorites.classList.add("placeholder");
        elements.deleteFavorite.disabled = true;
        selectedFavoriteName = undefined;
        return;
      }

      for (const favorite of visibleFavorites) {
        const option = document.createElement("option");
        option.value = favorite.id;
        option.textContent = favorite.name;
        option.dataset.builtin = favorite.builtin ? "true" : "false";
        elements.favorites.append(option);
      }
      syncFavoriteActions();
    }

    /**
     * Keeps the preset filter buttons visually and semantically in sync.
     */
    function syncPresetFilterButtons() {
      for (const button of elements.presetFilters) {
        const active = button.dataset.presetFilter === activePresetFilter;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      }
    }

    /**
     * Enables or disables favorite actions based on the current selection.
     */
    function syncFavoriteActions() {
      const favorite = favorites.find((entry) => entry.id === elements.favorites.value);
      elements.favorites.classList.toggle("placeholder", !favorite);
      elements.deleteFavorite.disabled = !favorite || Boolean(favorite.builtin);
    }

    /**
     * Applies the selected favorite immediately and remembers its name for edit-over-save.
     */
    function applySelectedFavorite() {
      const favorite = favorites.find((entry) => entry.id === elements.favorites.value);
      if (!favorite) {
        return;
      }
      selectedFavoriteName = favorite.name;
      setChoices(favorite);
      vscode.postMessage({ type: "applyFavorite", favoriteId: favorite.id });
    }

    /**
     * Requests deletion of the currently selected saved favorite.
     */
    function postDeleteFavorite() {
      if (!elements.favorites.value) {
        return;
      }
      vscode.postMessage({
        type: "deleteFavorite",
        favoriteId: elements.favorites.value
      });
      selectedFavoriteName = undefined;
    }

    /**
     * Updates the visible status line from extension-host responses.
     */
    function setStatus(text, level) {
      elements.status.textContent = text;
      elements.status.className = "status " + (level || "");
    }

    initialize();
  </script>
</body>
</html>`;
}

module.exports = {
  activate,
  deactivate,
  __test: {
    DEFAULT_CHOICES,
    DEFAULT_FAVORITES,
    EXTENSION_COLOR_KEYS,
    PRESET_FILTERS,
    SURFACE_CONFIGS,
    applyColors,
    applyFavoriteById,
    applySavedWorkspaceProfileOnActivation,
    createColorCustomizations,
    createIdeDefaultChoices,
    createSurprisePalette,
    paletteColor,
    soberGeneratedSideBarColor,
    getFavorites,
    getPickerHtml,
    removeManagedWorkbenchColorKeys,
    resetIdeDefaults,
    resetWorkbenchDefaults,
    restoreWorkbenchColors,
    saveFavorite,
    sanitizeChoices,
    sanitizeSurfaceOverrides
  }
};
