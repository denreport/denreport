import { getMessages } from "../i18n/messages/index.js";
import type { TargetCompatMatrix } from "./types.js";

export const pdfmeCompatMatrix = {
  target: "pdfme",
  displayName: "pdfme",
  elements: {
    text: {
      element: {
        level: "approximated",
        note: "Wrapping, line-start prohibition (kinsoku), and justification are computed by the compiler and match both targets. Only vertical-overflow behavior is unspecified by the IR and follows pdfme's rendering.",
        userMessage: (locale) => getMessages(locale).compat.pdfme.textElement,
      },
      attributes: {
        color: { level: "supported" },
        rotate: { level: "supported" },
        underline: {
          level: "approximated",
          note: "The underline's position and thickness are unspecified by the IR and follow the underline rendering of pdfme's text schema.",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.textUnderline,
        },
      },
    },
    line: {
      element: { level: "supported" },
      attributes: {
        color: { level: "supported" },
        thickness: {
          level: "approximated",
          note: "Which side of the baseline the thickness fill lands on is unspecified by the IR and follows the target's rendering.",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.lineThickness,
        },
        strokeStyle: {
          level: "approximated",
          note: "pdfme's schema has no dashed-line option, so it is approximated by statically expanding into a series of short solid segments (the pattern's fractional remainder and phase are target-approximated).",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.lineStrokeStyle,
        },
        rotate: { level: "supported" },
      },
    },
    rect: {
      element: { level: "supported" },
      attributes: {
        borderColor: { level: "supported" },
        fillColor: { level: "supported" },
        borderWidth: {
          level: "approximated",
          note: "The position of the border-thickness fill is unspecified by the IR and follows the target's rendering.",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.rectBorderWidth,
        },
        borderStyle: {
          level: "approximated",
          note: "pdfme's schema has no dashed-line option, so it is approximated by decomposing the four sides into line segments (the pattern does not continue across corners).",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.rectBorderStyle,
        },
        cornerRadius: { level: "supported" },
        rotate: { level: "supported" },
      },
    },
    ellipse: {
      element: { level: "supported" },
      attributes: {
        borderColor: { level: "supported" },
        fillColor: { level: "supported" },
        rotate: { level: "supported" },
      },
    },
    table: {
      element: {
        level: "approximated",
        note: "Row splitting and page assignment are supported since they're resolved at export time. Cell-string rendering (wrapping, line-start prohibition (kinsoku), and justification are supported; only vertical overflow is approximated) is handled the same as text.",
        userMessage: (locale) => getMessages(locale).compat.pdfme.tableElement,
      },
      attributes: {
        stripeColor: { level: "supported" },
        frameWidth: {
          level: "approximated",
          note: "The position of the border-thickness fill is unspecified by the IR and follows the target's rendering.",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.tableFrameWidth,
        },
        gridWidth: {
          level: "approximated",
          note: "Which side of the baseline the thickness fill lands on is unspecified by the IR and follows the target's rendering.",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.tableGridWidth,
        },
        frameStyle: {
          level: "approximated",
          note: "pdfme's schema has no dashed-line option, so it is approximated by decomposing the four sides into line segments (the pattern does not continue across corners).",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.tableFrameStyle,
        },
        gridStyle: {
          level: "approximated",
          note: "pdfme's schema has no dashed-line option, so it is approximated by statically expanding into a series of short solid segments (the pattern's fractional remainder and phase are target-approximated).",
          userMessage: (locale) =>
            getMessages(locale).compat.pdfme.tableGridStyle,
        },
      },
    },
    image: {
      element: { level: "supported" },
      attributes: {
        rotate: { level: "supported" },
      },
    },
    flex: {
      element: { level: "supported" },
    },
    pageNumber: {
      element: {
        level: "approximated",
        note: "Supported since it's expanded into a resolved string. String rendering (wrapping, line-start prohibition (kinsoku), and justification are supported; only vertical overflow is approximated) is handled the same as text.",
        userMessage: (locale) =>
          getMessages(locale).compat.pdfme.pageNumberElement,
      },
      attributes: {
        color: { level: "supported" },
        rotate: { level: "supported" },
      },
    },
    barcode: {
      element: {
        level: "approximated",
        note: "Formats are qrcode / code39 / code128 / ean13. The IR only specifies scaling to w×h; details such as bar thickness, quiet zone, and human-readable text (ean13 only) follow the target's rendering. Value format compliance (e.g. check digits) is not validated.",
        userMessage: (locale) =>
          getMessages(locale).compat.pdfme.barcodeElement,
      },
      attributes: {
        rotate: { level: "supported" },
      },
    },
  },
} satisfies TargetCompatMatrix;
