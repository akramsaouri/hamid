import { describe, it, expect } from "vitest";
import { toNotionBlock, type SimpleBlock } from "../src/notion.js";

describe("toNotionBlock", () => {
  it("converts heading blocks", () => {
    const block: SimpleBlock = { type: "heading_1", text: "Hello" };
    expect(toNotionBlock(block)).toEqual({
      type: "heading_1",
      heading_1: {
        rich_text: [{ type: "text", text: { content: "Hello" } }],
      },
    });
  });

  it("converts paragraph", () => {
    expect(toNotionBlock({ type: "paragraph", text: "Some text" })).toEqual({
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: "Some text" } }],
      },
    });
  });

  it("converts bulleted_list_item", () => {
    const result = toNotionBlock({
      type: "bulleted_list_item",
      text: "Item",
    });
    expect(result.type).toBe("bulleted_list_item");
    expect((result as any).bulleted_list_item.rich_text[0].text.content).toBe(
      "Item",
    );
  });

  it("converts numbered_list_item", () => {
    const result = toNotionBlock({
      type: "numbered_list_item",
      text: "Step",
    });
    expect(result.type).toBe("numbered_list_item");
  });

  it("converts to_do with defaults", () => {
    const result = toNotionBlock({ type: "to_do", text: "Task" });
    expect(result).toEqual({
      type: "to_do",
      to_do: {
        rich_text: [{ type: "text", text: { content: "Task" } }],
        checked: false,
      },
    });
  });

  it("converts to_do checked", () => {
    const result = toNotionBlock({
      type: "to_do",
      text: "Done",
      checked: true,
    });
    expect((result as any).to_do.checked).toBe(true);
  });

  it("converts code with language", () => {
    const result = toNotionBlock({
      type: "code",
      text: "const x = 1;",
      language: "typescript",
    });
    expect(result).toEqual({
      type: "code",
      code: {
        rich_text: [{ type: "text", text: { content: "const x = 1;" } }],
        language: "typescript",
      },
    });
  });

  it("converts code with default language", () => {
    const result = toNotionBlock({ type: "code", text: "hello" });
    expect((result as any).code.language).toBe("plain text");
  });

  it("converts quote", () => {
    const result = toNotionBlock({ type: "quote", text: "Wise words" });
    expect(result.type).toBe("quote");
    expect((result as any).quote.rich_text[0].text.content).toBe("Wise words");
  });

  it("converts callout with emoji", () => {
    const result = toNotionBlock({
      type: "callout",
      text: "Warning",
      emoji: "⚠️",
    });
    expect(result).toEqual({
      type: "callout",
      callout: {
        rich_text: [{ type: "text", text: { content: "Warning" } }],
        icon: { type: "emoji", emoji: "⚠️" },
      },
    });
  });

  it("converts callout with default emoji", () => {
    const result = toNotionBlock({ type: "callout", text: "Note" });
    expect((result as any).callout.icon.emoji).toBe("💡");
  });

  it("converts divider", () => {
    expect(toNotionBlock({ type: "divider" })).toEqual({
      type: "divider",
      divider: {},
    });
  });

  it("converts toggle without children", () => {
    const result = toNotionBlock({ type: "toggle", text: "Expand" });
    expect(result).toEqual({
      type: "toggle",
      toggle: {
        rich_text: [{ type: "text", text: { content: "Expand" } }],
      },
    });
    expect(result).not.toHaveProperty("children");
  });

  it("converts toggle with children", () => {
    const result = toNotionBlock({
      type: "toggle",
      text: "Expand",
      children: [{ type: "paragraph", text: "Inner" }],
    });
    expect((result as any).children).toHaveLength(1);
    expect((result as any).children[0].type).toBe("paragraph");
  });

  it("converts table with headers and rows", () => {
    const result = toNotionBlock({
      type: "table",
      headers: ["A", "B"],
      rows: [
        ["1", "2"],
        ["3", "4"],
      ],
    });

    expect(result.type).toBe("table");
    const table = (result as any).table;
    expect(table.table_width).toBe(2);
    expect(table.has_column_header).toBe(true);
    expect(table.has_row_header).toBe(false);
    expect(table.children).toHaveLength(3); // 1 header + 2 data rows

    // Check header row
    const headerCells = table.children[0].table_row.cells;
    expect(headerCells[0][0].text.content).toBe("A");
    expect(headerCells[1][0].text.content).toBe("B");

    // Check data row
    const dataCells = table.children[1].table_row.cells;
    expect(dataCells[0][0].text.content).toBe("1");
    expect(dataCells[1][0].text.content).toBe("2");
  });
});
