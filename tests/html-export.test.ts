import { describe, expect, test } from "bun:test";
import {
  neutralizeRemoteImages,
  renderMarkdown,
  contentToText,
  fmtTs,
  paletteToCss,
  renderSessionHtml,
  type ExportShape,
} from "../src/export/html-export";

/* ─── palette sanitisation ─── */

describe("paletteToCss", () => {
  test("accepts benign hex color", () => {
    const out = paletteToCss({ "--accent": "#5a8ab0" });
    expect(out).toContain("--accent: #5a8ab0;");
    expect(out).toContain(":root {");
  });

  test("accepts color-mix and rgb", () => {
    const out = paletteToCss({
      "--a": "color-mix(in srgb, red, blue)",
      "--b": "rgb(255, 128, 0)",
    });
    expect(out).toContain("--a: color-mix(in srgb, red, blue);");
    expect(out).toContain("--b: rgb(255, 128, 0);");
  });

  test("drops malicious name with braces", () => {
    const out = paletteToCss({ "}body{background:red}": "#fff" });
    expect(out).not.toContain("}body{");
    expect(out).toBe("");
  });

  test("drops malicious value with url()", () => {
    const out = paletteToCss({ "--accent": "url(https://x/x)" });
    expect(out).not.toContain("url(");
    expect(out).toBe("");
  });

  test("drops malicious value with expression()", () => {
    const out = paletteToCss({ "--accent": "expression(alert(1))" });
    expect(out).not.toContain("expression(");
    expect(out).toBe("");
  });

  test("handles empty palette", () => {
    expect(paletteToCss({})).toBe("");
    expect(paletteToCss({ "": "" })).toBe("");
  });

  test("caps name and value length", () => {
    const longName = "a".repeat(200);
    const longValue = "b".repeat(600);
    const out = paletteToCss({ [longName]: longValue });
    expect(out).toBe("");
  });

  test("drops value with colon", () => {
    const out = paletteToCss({ "--x": "red; background: blue" });
    expect(out).toBe("");
  });

  test("drops value with slash", () => {
    const out = paletteToCss({ "--x": "url/https://x" });
    expect(out).toBe("");
  });

  test("drops value with quotes", () => {
    const out = paletteToCss({ "--x": '"red"' });
    expect(out).toBe("");
  });
});

/* ─── theme override order ─── */

describe("renderSessionHtml theme", () => {
  const minimalShape: ExportShape = {
    title: "Test",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    messages: [],
  };

  test("dark theme adds html class", () => {
    const out = renderSessionHtml(minimalShape, "dark");
    expect(out).toContain('<html lang="en" class="dark">');
    expect(out).toContain(":root.dark {");
  });

  test("light theme omits dark class and dark block", () => {
    const out = renderSessionHtml(minimalShape, "light");
    expect(out).toContain('<html lang="en">');
    expect(out).not.toContain('class="dark"');
    expect(out).toContain(":root {");
    expect(out).not.toContain(":root.dark {");
  });

  test("palette override injected after builtin", () => {
    const out = renderSessionHtml(minimalShape, "dark", { "--accent": "#ff0000" });
    const builtinIdx = out.indexOf(":root {");
    const paletteIdx = out.indexOf("--accent: #ff0000;");
    expect(paletteIdx).toBeGreaterThan(builtinIdx);
  });

  test("hostile palette is dropped in full render", () => {
    const out = renderSessionHtml(minimalShape, "dark", { "--x": "url(https://x)" });
    expect(out).not.toContain("url(");
  });
});

/* ─── image neutralisation ─── */

describe("neutralizeRemoteImages", () => {
  test("flattens remote img tag", () => {
    const html = '<img src="https://example.com/x.png">';
    const out = neutralizeRemoteImages(html);
    expect(out).toContain("<code>[image: https://example.com/x.png]</code>");
    expect(out).not.toContain("<img");
  });

  test("preserves data URI img tag", () => {
    const html = '<img src="data:image/png;base64,abc123">';
    const out = neutralizeRemoteImages(html);
    expect(out).toContain('<img src="data:image/png;base64,abc123">');
  });

  test("no live img in full HTML output", () => {
    const shape: ExportShape = {
      title: "Img Test",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      messages: [{ role: "assistant", content: '<img src="https://evil.com/x.png">' }],
    };
    const out = renderSessionHtml(shape, "dark");
    expect(out).not.toContain('<img src="https://evil.com/x.png">');
    expect(out).toContain("[image: https://evil.com/x.png]");
  });

  test("neutralises markdown remote image", () => {
    const md = "![alt](https://example.com/x.png)";
    const out = renderMarkdown(md);
    expect(out).not.toContain('<img src="https://example.com/x.png">');
    expect(out).toContain("[image: https://example.com/x.png]");
  });

  test("preserves markdown data URI image", () => {
    const md = "![alt](data:image/png;base64,abc123)";
    const out = renderMarkdown(md);
    expect(out).toContain("data:image/png;base64,abc123");
    expect(out).not.toContain("[image:");
  });

  test("handles single quotes and uppercase IMG", () => {
    const html = "<IMG src='https://example.com/x.png'>";
    const out = neutralizeRemoteImages(html);
    expect(out).toContain("<code>[image: https://example.com/x.png]</code>");
    expect(out).not.toContain("<IMG");
  });

  test("end-to-end no active remote images", () => {
    const shape: ExportShape = {
      title: "E2E",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      messages: [
        { role: "user", content: "Look at this: ![img](https://x.com/a.png)" },
        { role: "assistant", content: "Here: <img src=\"https://y.com/b.png\">" },
      ],
    };
    const out = renderSessionHtml(shape, "dark");
    expect(out).not.toContain('<img src="https://x.com/a.png">');
    expect(out).not.toContain('<img src="https://y.com/b.png">');
    expect(out).toContain("[image: https://x.com/a.png]");
    expect(out).toContain("[image: https://y.com/b.png]");
  });
});

/* ─── contentToText ─── */

describe("contentToText", () => {
  test("returns plain string unchanged", () => {
    expect(contentToText("hello")).toBe("hello");
  });

  test("flattens mixed OpenAI content", () => {
    const content = [
      { type: "text", text: "hello" },
      { type: "image_url", image_url: { url: "https://x.com/a.png" } },
    ];
    const out = contentToText(content);
    expect(out).toContain("hello");
    expect(out).toContain("[image: https://x.com/a.png]");
  });
});

/* ─── fmtTs ─── */

describe("fmtTs", () => {
  test("formats unix ms correctly", () => {
    expect(fmtTs(1700000000000)).toBe("2023-11-14 22:13:20");
  });
});

/* ─── renderMarkdown ─── */

describe("renderMarkdown", () => {
  test("renders headings and code blocks", () => {
    const out = renderMarkdown("## Title\n\n`code`");
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<code>code</code>");
  });

  test("escapes raw HTML in markdown source", () => {
    const out = renderMarkdown("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  test("linkifies bare URLs", () => {
    const out = renderMarkdown("https://example.com");
    expect(out).toContain('<a href="https://example.com">https://example.com</a>');
  });
});

/* ─── renderSessionHtml security ─── */

describe("renderSessionHtml security", () => {
  const base: ExportShape = {
    title: "Security",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    messages: [],
  };

  test("contains no script tag", () => {
    const shape: ExportShape = {
      ...base,
      title: "<script>alert(1)</script>",
      messages: [{ role: "user", content: "<script>alert(2)</script>" }],
    };
    const out = renderSessionHtml(shape, "dark");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  test("contains no link or import", () => {
    const out = renderSessionHtml(base, "dark");
    expect(out).not.toContain("<link");
    expect(out).not.toContain("@import");
  });

  test("palette breakout attempt is dropped", () => {
    const out = renderSessionHtml(base, "dark", { "--x": "}body{background:red}" });
    expect(out).not.toContain("}body{");
  });

  test("remote image in message is inert", () => {
    const shape: ExportShape = {
      ...base,
      messages: [
        { role: "user", content: "![img](https://example.com/x.png)" },
      ],
    };
    const out = renderSessionHtml(shape, "dark");
    expect(out).not.toContain('<img src="https://example.com/x.png">');
    expect(out).toContain("[image: https://example.com/x.png]");
  });
});

/* ─── empty run handling ─── */

describe("renderSessionHtml empty run", () => {
  test("produces valid HTML with no messages placeholder", () => {
    const shape: ExportShape = {
      title: "Empty",
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      messages: [],
    };
    const out = renderSessionHtml(shape, "dark");
    expect(out).toContain("<!DOCTYPE html>");
    expect(out).toContain("No messages in this run.");
  });
});
