const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// --- Simplified block types ---

export type SimpleBlock =
  | { type: "heading_1"; text: string }
  | { type: "heading_2"; text: string }
  | { type: "heading_3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bulleted_list_item"; text: string }
  | { type: "numbered_list_item"; text: string }
  | { type: "to_do"; text: string; checked?: boolean }
  | { type: "code"; text: string; language?: string }
  | { type: "quote"; text: string }
  | { type: "callout"; text: string; emoji?: string }
  | { type: "divider" }
  | { type: "toggle"; text: string; children?: SimpleBlock[] }
  | { type: "table"; headers: string[]; rows: string[][] };

function richText(text: string) {
  return [{ type: "text" as const, text: { content: text } }];
}

export function toNotionBlock(block: SimpleBlock): Record<string, unknown> {
  switch (block.type) {
    case "heading_1":
    case "heading_2":
    case "heading_3":
    case "paragraph":
    case "bulleted_list_item":
    case "numbered_list_item":
    case "quote":
      return {
        type: block.type,
        [block.type]: { rich_text: richText(block.text) },
      };

    case "to_do":
      return {
        type: "to_do",
        to_do: {
          rich_text: richText(block.text),
          checked: block.checked ?? false,
        },
      };

    case "code":
      return {
        type: "code",
        code: {
          rich_text: richText(block.text),
          language: block.language ?? "plain text",
        },
      };

    case "callout":
      return {
        type: "callout",
        callout: {
          rich_text: richText(block.text),
          icon: { type: "emoji", emoji: block.emoji ?? "💡" },
        },
      };

    case "divider":
      return { type: "divider", divider: {} };

    case "toggle": {
      const obj: Record<string, unknown> = {
        type: "toggle",
        toggle: { rich_text: richText(block.text) },
      };
      if (block.children?.length) {
        obj.children = block.children.map(toNotionBlock);
      }
      return obj;
    }

    case "table": {
      const width = block.headers.length;
      const headerRow = {
        type: "table_row",
        table_row: { cells: block.headers.map((h) => richText(h)) },
      };
      const dataRows = block.rows.map((row) => ({
        type: "table_row",
        table_row: { cells: row.map((cell) => richText(cell)) },
      }));
      return {
        type: "table",
        table: {
          table_width: width,
          has_column_header: true,
          has_row_header: false,
          children: [headerRow, ...dataRows],
        },
      };
    }
  }
}

// --- Nesting helpers ---
// The Notion API doesn't accept nested `children` on block objects during
// creation. Blocks like toggles that have children need a two-step process:
// create the parent block first, then append children to it.

interface DeferredChildren {
  index: number;
  children: SimpleBlock[];
}

function extractDeferredChildren(blocks: SimpleBlock[]): {
  flat: Record<string, unknown>[];
  deferred: DeferredChildren[];
} {
  const flat: Record<string, unknown>[] = [];
  const deferred: DeferredChildren[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === "toggle" && block.children?.length) {
      // Create toggle without children
      flat.push(toNotionBlock({ type: "toggle", text: block.text }));
      deferred.push({ index: i, children: block.children });
    } else {
      flat.push(toNotionBlock(block));
    }
  }

  return { flat, deferred };
}

// --- API helpers ---

async function notionFetch(
  token: string,
  method: "POST" | "PATCH" | "GET",
  path: string,
  body?: unknown,
) {
  const res = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Notion API ${res.status}: ${(data as any).message ?? JSON.stringify(data)}`,
    );
  }
  return data as Record<string, unknown>;
}

async function appendDeferredChildren(
  token: string,
  parentId: string,
  deferred: DeferredChildren[],
) {
  if (!deferred.length) return;

  // Fetch children of the parent to get block IDs
  const children = await notionFetch(token, "GET", `/blocks/${parentId}/children`);
  const results = (children.results as any[]) ?? [];

  for (const d of deferred) {
    const toggleBlock = results[d.index];
    if (!toggleBlock?.id) continue;
    await notionFetch(token, "PATCH", `/blocks/${toggleBlock.id}/children`, {
      children: d.children.map(toNotionBlock),
    });
  }
}

// --- Public API ---

export interface CreatePageInput {
  parent_id: string;
  title: string;
  blocks: SimpleBlock[];
  icon?: string;
}

export async function createPage(token: string, input: CreatePageInput) {
  const { flat, deferred } = extractDeferredChildren(input.blocks);

  const body: Record<string, unknown> = {
    parent: { page_id: input.parent_id },
    properties: {
      title: [{ type: "text", text: { content: input.title } }],
    },
    children: flat,
  };
  if (input.icon) {
    body.icon = { type: "emoji", emoji: input.icon };
  }
  const page = await notionFetch(token, "POST", "/pages", body);
  await appendDeferredChildren(token, page.id as string, deferred);
  return page;
}

export interface CreateDatabasePageInput {
  database_id: string;
  properties: Record<string, unknown>;
  blocks?: SimpleBlock[];
}

export async function createDatabasePage(
  token: string,
  input: CreateDatabasePageInput,
) {
  const { flat, deferred } = extractDeferredChildren(input.blocks ?? []);

  const body: Record<string, unknown> = {
    parent: { database_id: input.database_id },
    properties: input.properties,
  };
  if (flat.length) {
    body.children = flat;
  }
  const page = await notionFetch(token, "POST", "/pages", body);
  await appendDeferredChildren(token, page.id as string, deferred);
  return page;
}

export interface AppendBlocksInput {
  page_id: string;
  blocks: SimpleBlock[];
}

export async function appendBlocks(token: string, input: AppendBlocksInput) {
  const { flat, deferred } = extractDeferredChildren(input.blocks);

  const result = await notionFetch(
    token,
    "PATCH",
    `/blocks/${input.page_id}/children`,
    { children: flat },
  );

  // For append, the response includes created block IDs directly
  if (deferred.length) {
    const results = (result.results as any[]) ?? [];
    for (const d of deferred) {
      const toggleBlock = results[d.index];
      if (!toggleBlock?.id) continue;
      await notionFetch(token, "PATCH", `/blocks/${toggleBlock.id}/children`, {
        children: d.children.map(toNotionBlock),
      });
    }
  }

  return result;
}
