import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerDownload } from "./download";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("triggerDownload", () => {
  it("creates an a[download], clicks it, and revokes the Blob URL", () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:denreport-test");
    const revokeObjectURL = vi.fn();
    // jsdom's URL lacks createObjectURL / revokeObjectURL, so stub it
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    triggerDownload(
      document,
      "report-template.json",
      new Blob(['{"version":"1.0"}'], { type: "application/json" }),
    );

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls.at(0)?.at(0);
    expect(blob?.type).toBe("application/json");
    expect(clicked).toHaveLength(1);
    expect(clicked.at(0)?.getAttribute("download")).toBe(
      "report-template.json",
    );
    expect(clicked.at(0)?.getAttribute("href")).toBe("blob:denreport-test");
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:denreport-test",
    );
  });

  it("keeps the Blob, including its MIME type, as the saved object", async () => {
    let captured: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => {
        captured = blob;
        return "blob:denreport-test";
      },
      revokeObjectURL: () => {},
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    triggerDownload(
      document,
      "report-reportlab.zip",
      new Blob([new Uint8Array([80, 75])], { type: "application/zip" }),
    );

    expect(captured?.type).toBe("application/zip");
    expect(new Uint8Array((await captured?.arrayBuffer()) ?? [])).toEqual(
      new Uint8Array([80, 75]),
    );
  });
});
