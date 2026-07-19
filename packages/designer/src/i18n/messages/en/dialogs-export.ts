export const dialogsExportEn = {
  export: {
    title: "Export",
    close: "Close",
    run: "Export",
    blockedByErrors: (count: number): string =>
      `Export is blocked: ${count} validation error${count === 1 ? "" : "s"} found.`,
    warningsNote: "Warnings don't block export. Validation errors do.",
    targetDescriptions: {
      pdfme: "Template + inputs (JSON)",
      reportlab: "Generated code (.py + fonts, zip)",
    },
    fullEmbedFont: "Embed the whole font (no subsetting)",
    fullEmbedFontNote:
      "pdfme embeds only the characters in use by default, which can garble text in some Japanese fonts. Turn this on if that happens.",
    compatWarnings: "Compatibility warnings",
    compatOk: "✓ All elements can be exported for the selected target.",
    compatLevel: {
      approximated: "Approximated",
      unsupported: "Unsupported",
    },
    findingCount: (count: number): string =>
      `${count} location${count === 1 ? "" : "s"}`,
    templateModeNote:
      "No sample data was entered, so this exports a template. pdfme produces a template with empty bound values, and ReportLab produces a build(output path, data) function.",
    running: "Exporting…",
    noArtifact: "No file was created.",
    fontFetchFailed: "Couldn't fetch the bundled font. Please try again.",
    fontMissing: (slotLabel: string, name: string): string =>
      `The ${slotLabel} font "${name}" has no data. Choose it again in "Select from PC fonts" in the document settings.`,
    failed: "Couldn't export.",
    warningsProduced:
      "The file was created. The following keys were missing from the sample data, so text was left empty and tables used empty rows (per minRows).",
    jsonParseError:
      "Couldn't parse the sample data as JSON. You can enter or generate it in the preview's sample data field.",
    notObjectError:
      "The sample data's top level isn't an object. You can enter or generate it in the preview's sample data field.",
  },
  preview: {
    title: "Preview",
    close: "Close",
    pageCount: (count: number): string =>
      `${count} page${count === 1 ? "" : "s"}`,
    validationErrorsNote: (count: number): string =>
      `There ${count === 1 ? "is" : "are"} ${count} validation error${count === 1 ? "" : "s"}. Please resolve them.`,
    cannotDisplay: "Preview isn't available.",
    loadingFont: "Loading font…",
    fontLoadFailed:
      "Couldn't load the bundled font, showing the system font instead",
    fontMissing: (slotLabel: string, name: string): string =>
      `The ${slotLabel} font "${name}" has no data, so the bundled font is shown instead. You can choose it again in "Select from PC fonts" in the document settings`,
    jsonParseError: (detail: string): string =>
      `Couldn't parse as JSON: ${detail}`,
    removeScenario: {
      ariaLabel: "Delete scenario",
      heading: "Delete scenario",
      body: "This deletes the current scenario. Continue?",
      cancel: "Cancel",
      confirm: "Delete",
    },
    regenerateSample: {
      ariaLabel: "Overwrite sample data",
      heading: "Overwrite sample data",
      body: "This replaces the current sample data with newly generated content. Continue?",
      cancel: "Cancel",
      confirm: "Replace",
    },
  },
  fonts: {
    slotLabels: {
      regular: "Regular",
      bold: "Bold",
      italic: "Italic",
      boldItalic: "Bold italic",
    },
    selectTitle: (slotLabel: string): string =>
      `Choose the ${slotLabel.toLowerCase()} font`,
    licenseNote:
      "The selected font will be embedded in the exported file. Please check its license.",
    cancel: "Cancel",
    useThisFont: "Use this font",
    revertToEmbedded: (name: string): string =>
      `Revert to bundled font (${name})`,
    clearToDefault: "Clear (falls back to the regular font)",
    loadingList: "Loading font list…",
    retry: "Retry",
    searchPlaceholder: "Search by font name",
    loadDataFailed: "Couldn't fetch the font data.",
    metricsUnreadable:
      "Couldn't read the font's metrics (head / hhea tables), so the text baseline can't be determined. Please use a different TTF font.",
    reasons: {
      unsupported:
        "Your browser doesn't support listing fonts installed on this PC (supported in Chromium-based browsers)",
      denied:
        "Font access wasn't granted. You can allow it from your browser's site settings",
      error: "Couldn't fetch the font list.",
    },
  },
};
