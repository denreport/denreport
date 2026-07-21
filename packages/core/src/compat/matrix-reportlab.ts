import { getMessages } from "../i18n/messages/index.js";
import type { TargetCompatMatrix } from "./types.js";

export const reportlabCompatMatrix = {
  target: "reportlab",
  displayName: "ReportLab",
  elements: {
    text: {
      element: {
        level: "approximated",
        note: "Wrapping, line-start prohibition (kinsoku), and justification are computed by the compiler and match both targets. Only vertical-overflow behavior is unspecified by the IR and follows the generated code's rendering.",
        userMessage: (locale) =>
          getMessages(locale).compat.reportlab.textElement,
      },
      attributes: {
        color: { level: "supported" },
        rotate: { level: "supported" },
        underline: {
          level: "approximated",
          note: "The underline's position and thickness are unspecified by the IR and follow the generated code's line rendering.",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.textUnderline,
        },
      },
    },
    line: {
      element: { level: "supported" },
      attributes: {
        color: { level: "supported" },
        strokeStyle: { level: "supported" },
        thickness: {
          level: "approximated",
          note: "Which side of the baseline the thickness fill lands on is unspecified by the IR and follows the target's rendering.",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.lineThickness,
        },
        rotate: { level: "supported" },
      },
    },
    rect: {
      element: { level: "supported" },
      attributes: {
        borderColor: { level: "supported" },
        fillColor: { level: "supported" },
        borderStyle: { level: "supported" },
        borderWidth: {
          level: "approximated",
          note: "The position of the border-thickness fill is unspecified by the IR and follows the target's rendering.",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.rectBorderWidth,
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
        userMessage: (locale) =>
          getMessages(locale).compat.reportlab.tableElement,
      },
      attributes: {
        stripeColor: { level: "supported" },
        frameStyle: { level: "supported" },
        gridStyle: { level: "supported" },
        frameWidth: {
          level: "approximated",
          note: "The position of the border-thickness fill is unspecified by the IR and follows the target's rendering.",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.tableFrameWidth,
        },
        gridWidth: {
          level: "approximated",
          note: "Which side of the baseline the thickness fill lands on is unspecified by the IR and follows the target's rendering.",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.tableGridWidth,
        },
      },
    },
    image: {
      element: { level: "supported" },
      attributes: {
        src: {
          level: "approximated",
          note: "Rendering the image requires Pillow in the generated code's execution environment (stated as a runtime requirement at the top of the generated code). PNG can only be rendered if the environment's Pillow has the PNG codec.",
          userMessage: (locale) =>
            getMessages(locale).compat.reportlab.imageSrc,
        },
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
          getMessages(locale).compat.reportlab.pageNumberElement,
      },
      attributes: {
        color: { level: "supported" },
        rotate: { level: "supported" },
      },
    },
    barcode: {
      element: {
        level: "approximated",
        note: "Formats are qrcode / code39 / code128 / ean13. The IR only specifies scaling to w×h; details such as bar thickness, quiet zone, and human-readable text (ean13 only) follow the target's rendering. Value format compliance (e.g. check digits) is not validated. EAN-13 auto-completes the check digit when given a 12-digit input.",
        userMessage: (locale) =>
          getMessages(locale).compat.reportlab.barcodeElement,
      },
      attributes: {
        rotate: { level: "supported" },
      },
    },
  },
} satisfies TargetCompatMatrix;
