// src/notion.ts
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
var NOTION_API = "https://api.notion.com";
var NOTION_VERSION = "2022-06-28";
var CONFIG_PATH = join(homedir(), ".dsh", "notion.json");
function readConfig() {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function writeConfig(config) {
  mkdirSync(join(homedir(), ".dsh"), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 384 });
  chmodSync(CONFIG_PATH, 384);
}
function clearConfig() {
  rmSync(CONFIG_PATH, { force: true });
}
var NotionError = class extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "NotionError";
  }
};
async function notionRequest(token, method, path, body, signal) {
  const response = await fetch(NOTION_API + path, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    },
    body: body === void 0 ? void 0 : JSON.stringify(body)
  });
  const text2 = await response.text();
  let data = null;
  if (text2 !== "") {
    try {
      data = JSON.parse(text2);
    } catch {
      data = { raw: text2 };
    }
  }
  if (!response.ok) {
    const message = data !== null && typeof data.message === "string" ? data.message : `HTTP ${response.status}`;
    const code = data !== null && typeof data.code === "string" ? data.code : void 0;
    throw new NotionError(message, response.status, code);
  }
  return data;
}
async function notionCall(method, path, body, signal) {
  const token = (readConfig().token ?? "").trim();
  if (token === "") {
    throw new NotionError(
      "Notion \u5C1A\u672A\u914D\u7F6E\uFF1A\u8BF7\u5728 \u8BBE\u7F6E \u2192 Notion \u4E2D\u7C98\u8D34 Integration Token\uFF08\u5728 https://www.notion.so/my-integrations \u521B\u5EFA\uFF09\u3002"
    );
  }
  return notionRequest(token, method, path, body, signal);
}
function friendlyNotionError(error) {
  if (error instanceof NotionError) {
    const message = error.message || "\u672A\u77E5\u9519\u8BEF";
    switch (error.status) {
      case 401:
        return `Notion token \u65E0\u6548\u6216\u5DF2\u88AB\u64A4\u9500\uFF08401\uFF09\uFF1A${message}`;
      case 404:
        return `Notion \u8D44\u6E90\u4E0D\u5B58\u5728\uFF08404\uFF09\uFF1A${message}\u3002\u8BF7\u786E\u8BA4\u9875\u9762/\u6570\u636E\u5E93\u5DF2\u5206\u4EAB\u7ED9\u8BE5 Integration\uFF0C\u4E14 id \u6B63\u786E\u3002`;
      case 400:
        return `Notion \u8BF7\u6C42\u53C2\u6570\u9519\u8BEF\uFF08400 ${error.code ?? ""}\uFF09\uFF1A${message}`;
      case 409:
        return `Notion \u51B2\u7A81\uFF08409\uFF09\uFF1A${message}`;
      case 429:
        return `Notion \u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF08429\uFF09\uFF1A${message}`;
      default:
        return `Notion API \u9519\u8BEF [${error.status ?? "?"}]\uFF1A${message}`;
    }
  }
  return error instanceof Error ? error.message : String(error);
}
function normalizeId(raw) {
  let s = String(raw ?? "").trim();
  if (s.includes("/")) {
    s = (s.split("/").pop() ?? "").split("?")[0].split("#")[0];
  }
  s = s.replace(/-/g, "");
  if (/^[0-9a-fA-F]{32}$/.test(s)) {
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  }
  return s;
}
function plainText(rich) {
  if (!Array.isArray(rich)) return "";
  let out = "";
  for (const r of rich) {
    if (r !== null && typeof r === "object" && typeof r.plain_text === "string") {
      out += r.plain_text;
    }
  }
  return out;
}
function propValue(p) {
  if (p === null || p === void 0) return null;
  switch (p.type) {
    case "title":
      return plainText(p.title);
    case "rich_text":
      return plainText(p.rich_text);
    case "number":
      return p.number;
    case "select":
      return p.select ? p.select.name : null;
    case "status":
      return p.status ? p.status.name : null;
    case "multi_select":
      return (p.multi_select ?? []).map((s) => s.name);
    case "date":
      return p.date ? p.date.start + (p.date.end ? ` \u2192 ${p.date.end}` : "") : null;
    case "checkbox":
      return p.checkbox;
    case "url":
      return p.url;
    case "email":
      return p.email;
    case "phone_number":
      return p.phone_number;
    case "people":
      return (p.people ?? []).map((u) => u.name ?? u.id);
    case "relation":
      return (p.relation ?? []).map((r) => r.id);
    case "formula":
      return p.formula ? p.formula[p.formula.type] : null;
    case "rollup":
      return p.rollup ? p.rollup.type === "number" ? p.rollup.number : (p.rollup.array ?? []).map(propValue) : null;
    case "created_by":
      return p.created_by ? p.created_by.name : null;
    case "last_edited_by":
      return p.last_edited_by ? p.last_edited_by.name : null;
    case "created_time":
      return p.created_time;
    case "last_edited_time":
      return p.last_edited_time;
    default:
      return JSON.stringify(p);
  }
}
function simplifyProperties(props) {
  const out = {};
  if (props !== null && typeof props === "object") {
    for (const key of Object.keys(props)) out[key] = propValue(props[key]);
  }
  return out;
}
function trimSearchResult(r) {
  let title = "";
  if (r.object === "database") title = plainText(r.title);
  else if (r.properties !== null && r.properties !== void 0 && r.properties.title !== void 0) {
    title = plainText(r.properties.title.title);
  }
  return {
    id: r.id,
    type: r.object,
    title: title || r.id,
    url: r.url ?? null,
    edited: r.last_edited_time ?? null,
    databaseId: (r.parent && r.parent.database_id) ?? null
  };
}
function blockText(b) {
  const t = b.type;
  if (t === "child_page") return b.child_page ? b.child_page.title : "";
  if (t === "child_database") return b.child_database ? b.child_database.title : "";
  if (t === "divider") return "---";
  if (t === "table_row") return (b.table_row.cells ?? []).map((c) => plainText(c)).join(" | ");
  if (t === "equation") return b.equation ? b.equation.expression : "";
  if (t === "synced_block") return "";
  const inner = b[t];
  if (inner !== null && inner !== void 0 && Array.isArray(inner.rich_text)) return plainText(inner.rich_text);
  if (inner !== null && inner !== void 0 && typeof inner.url === "string") {
    const caption = plainText(inner.caption ?? []);
    return inner.url + (caption.length > 0 ? ` ${caption}` : "");
  }
  return "";
}
var NESTED_TYPES = {
  toggle: true,
  bulleted_list_item: true,
  numbered_list_item: true,
  quote: true,
  callout: true,
  paragraph: true,
  synced_block: true,
  template: true,
  table: true
};
async function fetchBlocksRecursive(blockId, depth, cap, signal) {
  const out = [];
  let cursor = null;
  for (; ; ) {
    let path = `/v1/blocks/${encodeURIComponent(normalizeId(blockId))}/children?page_size=100`;
    if (cursor !== null) path += `&start_cursor=${encodeURIComponent(cursor)}`;
    const res = await notionCall("GET", path, void 0, signal);
    const list = res.results ?? [];
    for (const b of list) {
      if (out.length >= cap) return out;
      const item = { id: b.id, type: b.type, text: blockText(b) };
      if (depth > 0 && b.has_children === true && NESTED_TYPES[b.type] === true) {
        try {
          const kids = await fetchBlocksRecursive(b.id, depth - 1, cap - out.length, signal);
          if (kids.length > 0) item.children = kids;
        } catch (error) {
          item.childrenError = friendlyNotionError(error);
        }
      }
      out.push(item);
    }
    if (res.has_more !== true || typeof res.next_cursor !== "string") return out;
    cursor = res.next_cursor;
  }
}
async function readPage(pageIdRaw, includeChildren, depth, signal) {
  const pageId = normalizeId(pageIdRaw);
  const page = await notionCall("GET", `/v1/pages/${encodeURIComponent(pageId)}`, void 0, signal);
  let title = "";
  if (page.properties !== null && page.properties !== void 0 && page.properties.title !== void 0) {
    title = plainText(page.properties.title.title);
  }
  const result = {
    id: page.id,
    url: page.url ?? null,
    title,
    properties: simplifyProperties(page.properties)
  };
  if (includeChildren) result.blocks = await fetchBlocksRecursive(pageId, depth, 200, signal);
  return { ok: true, page: result };
}
async function queryDatabase(args, signal) {
  const body = { page_size: Math.min(Math.max(args.pageSize ?? 20, 1), 100) };
  if (args.filter !== void 0) body.filter = args.filter;
  if (args.sorts !== void 0) body.sorts = args.sorts;
  if (args.startCursor !== void 0) body.start_cursor = args.startCursor;
  const res = await notionCall(
    "POST",
    `/v1/databases/${encodeURIComponent(normalizeId(args.databaseId))}/query`,
    body,
    signal
  );
  return {
    ok: true,
    count: (res.results ?? []).length,
    hasMore: res.has_more === true,
    nextCursor: res.has_more === true ? res.next_cursor : null,
    results: (res.results ?? []).map((r) => ({
      id: r.id,
      url: r.url ?? null,
      properties: simplifyProperties(r.properties)
    }))
  };
}

// src/routes.ts
var NOTION_API_PREFIX = "/api/dsh-notion";
var MAX_JSON_BODY_BYTES = 64 * 1024;
function isLoopbackRequest(request) {
  const address = request.socket.remoteAddress;
  if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
  const host = request.headers.host;
  if (typeof host !== "string") return false;
  let hostUrl;
  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}
function writeJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        reject(new Error("body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid json"));
      }
    });
    request.on("error", reject);
  });
}
function makeRoutes() {
  return [
    {
      kind: "exact",
      path: `${NOTION_API_PREFIX}/status`,
      handler: async (req, res) => {
        if (req.method !== "GET" && req.method !== "POST" || !isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        const cfg = readConfig();
        writeJson(res, 200, {
          configured: (cfg.token ?? "").trim() !== "",
          workspaceName: cfg.workspaceName ?? "",
          workspaceIcon: cfg.workspaceIcon ?? ""
        });
      }
    },
    {
      kind: "exact",
      path: `${NOTION_API_PREFIX}/token`,
      handler: async (req, res) => {
        if (req.method !== "POST" || !isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        let body;
        try {
          body = await readJsonBody(req);
        } catch {
          writeJson(res, 400, { ok: false, error: "\u8BF7\u6C42\u4F53\u65E0\u6548" });
          return;
        }
        const token = typeof body.token === "string" ? body.token.trim() : "";
        if (token === "") {
          writeJson(res, 400, { ok: false, error: "token \u4E0D\u80FD\u4E3A\u7A7A" });
          return;
        }
        try {
          const me = await notionRequest(token, "GET", "/v1/users/me");
          const bot = me !== null && typeof me === "object" && me.bot || {};
          const workspaceName = typeof bot.workspace_name === "string" ? bot.workspace_name : "";
          let icon = "";
          if (bot.workspace_icon !== null && bot.workspace_icon !== void 0) {
            icon = String(bot.workspace_icon.emoji ?? bot.workspace_icon.file?.url ?? "");
          }
          writeConfig({ token, workspaceName, workspaceIcon: icon });
          writeJson(res, 200, { ok: true, workspaceName, workspaceIcon: icon });
        } catch (error) {
          writeJson(res, 200, { ok: false, error: friendlyNotionError(error) });
        }
      }
    },
    {
      kind: "exact",
      path: `${NOTION_API_PREFIX}/clear`,
      handler: async (req, res) => {
        if (req.method !== "POST" || !isLoopbackRequest(req)) {
          writeJson(res, 403, { error: "forbidden: loopback-only" });
          return;
        }
        clearConfig();
        writeJson(res, 200, { ok: true });
      }
    }
  ];
}

// src/tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
function text(value) {
  return [{ type: "text", text: value }];
}
function renderJson(_args, value) {
  return text(JSON.stringify(value, null, 2));
}
function notionSearchTool() {
  return defineTool({
    name: "notion_search",
    description: "\u5728\u5DF2\u914D\u7F6E\u7684 Notion \u5DE5\u4F5C\u533A\u641C\u7D22\u9875\u9762\u4E0E\u6570\u636E\u5E93\u3002\u8FD4\u56DE\u6BCF\u4E2A\u7ED3\u679C\u7684 id\u3001\u7C7B\u578B\u3001\u6807\u9898\u3001URL \u4E0E\u6700\u540E\u7F16\u8F91\u65F6\u95F4\u3002Triggers: Notion, \u641C\u7D22 Notion, \u5728 Notion \u91CC\u627E.",
    parameters: {
      query: { type: "string", description: "\u641C\u7D22\u5173\u952E\u8BCD\uFF1B\u7701\u7565\u5219\u8FD4\u56DE\u5DE5\u4F5C\u533A\u6700\u8FD1\u66F4\u65B0\u7684\u5185\u5BB9" },
      objectType: { type: "string", enum: ["page", "database"], description: "\u4EC5\u8FD4\u56DE\u8BE5\u7C7B\u578B\u7684\u5BF9\u8C61" },
      limit: { type: "integer", description: "\u8FD4\u56DE\u6761\u6570\u4E0A\u9650\uFF0C\u9ED8\u8BA4 10\uFF0C\u6700\u5927 50" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    timeoutMs: 6e4,
    async execute(args) {
      const body = { page_size: Math.min(Math.max(args.limit ?? 10, 1), 50) };
      if (args.query !== void 0 && args.query !== "") body.query = args.query;
      if (args.objectType !== void 0) body.filter = { value: args.objectType, property: "object" };
      const res = await notionCall("POST", "/v1/search", body);
      return {
        ok: true,
        count: (res.results ?? []).length,
        hasMore: res.has_more === true,
        results: (res.results ?? []).map(trimSearchResult)
      };
    }
  });
}
function notionReadPageTool() {
  return defineTool({
    name: "notion_read_page",
    description: "\u8BFB\u53D6 Notion \u9875\u9762\u7684\u6807\u9898\u3001\u5C5E\u6027\u4E0E\u5185\u5BB9\u5757\u3002pageId \u53EF\u4F20\u9875\u9762 id\uFF08\u5F62\u5982 8ab3e1c2-xxxx-...\uFF09\u6216\u5B8C\u6574\u9875\u9762 URL\u3002Triggers: \u8BFB\u53D6 Notion \u9875\u9762, \u67E5\u770B Notion \u5185\u5BB9.",
    parameters: {
      pageId: { type: "string", required: true, description: "\u9875\u9762 id \u6216\u5B8C\u6574\u9875\u9762 URL" },
      includeChildren: { type: "boolean", description: "\u662F\u5426\u540C\u65F6\u8BFB\u53D6\u9875\u9762\u5185\u5BB9\u5757\uFF08\u9ED8\u8BA4 true\uFF09" },
      depth: { type: "integer", description: "\u5D4C\u5957\u5757\u9012\u5F52\u6DF1\u5EA6\uFF08\u9ED8\u8BA4 2\uFF0C\u6700\u5927 3\uFF09" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    timeoutMs: 6e4,
    async execute(args) {
      const depth = args.depth === void 0 ? 2 : Math.min(Math.max(args.depth, 0), 3);
      return readPage(String(args.pageId), args.includeChildren !== false, depth);
    }
  });
}
function notionQueryDatabaseTool() {
  return defineTool({
    name: "notion_query_database",
    description: "\u67E5\u8BE2 Notion \u6570\u636E\u5E93\u6761\u76EE\u3002filter \u4E0E sorts \u4F7F\u7528 Notion API \u539F\u751F\u7ED3\u6784\uFF08\u89C1 https://developers.notion.com/reference/post-database-query\uFF09\u3002Triggers: \u67E5\u8BE2 Notion \u6570\u636E\u5E93, \u6570\u636E\u5E93\u6761\u76EE.",
    parameters: {
      databaseId: { type: "string", required: true, description: "\u6570\u636E\u5E93 id \u6216 URL" },
      filter: { type: "json", description: '\u8FC7\u6EE4\u6761\u4EF6\uFF08Notion \u539F\u751F filter \u5BF9\u8C61\uFF0C\u5982 {"property":"\u72B6\u6001","select":{"equals":"\u8FDB\u884C\u4E2D"}}\uFF09' },
      sorts: { type: "json", description: "\u6392\u5E8F\u6570\u7EC4\uFF08Notion \u539F\u751F sorts\uFF09" },
      pageSize: { type: "integer", description: "\u6BCF\u9875\u6761\u6570\uFF0C\u9ED8\u8BA4 20\uFF0C\u6700\u5927 100" },
      startCursor: { type: "string", description: "\u7FFB\u9875\u6E38\u6807\uFF08\u4E0A\u4E00\u6B21\u7ED3\u679C\u7684 nextCursor\uFF09" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    timeoutMs: 6e4,
    async execute(args) {
      return queryDatabase(args);
    }
  });
}
function notionCreatePageTool() {
  return defineTool({
    name: "notion_create_page",
    description: "\u5728 Notion \u4E2D\u521B\u5EFA\u9875\u9762\u3002properties \u4E0E children \u4F7F\u7528 Notion API \u539F\u751F\u7ED3\u6784\uFF08\u89C1 https://developers.notion.com/reference/post-page\uFF09\u3002Triggers: \u521B\u5EFA Notion \u9875\u9762, \u5199\u5165 Notion, \u4FDD\u5B58\u5230 Notion.",
    parameters: {
      parentType: { type: "string", enum: ["page", "database"], required: true, description: "\u7236\u5BF9\u8C61\u7C7B\u578B" },
      parentId: { type: "string", required: true, description: "\u7236\u9875\u9762\u6216\u7236\u6570\u636E\u5E93\u7684 id / URL" },
      properties: { type: "json", description: '\u9875\u9762\u5C5E\u6027\u5BF9\u8C61\uFF0C\u5982 {"Name": {"title": [{"text": {"content": "\u6807\u9898"}}]}}' },
      children: { type: "json", description: "\u9875\u9762\u5185\u5BB9\u5757\u6570\u7EC4\uFF08Notion block \u5BF9\u8C61\uFF09" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    timeoutMs: 6e4,
    async execute(args) {
      const parent = args.parentType === "database" ? { database_id: normalizeId(args.parentId) } : { page_id: normalizeId(args.parentId) };
      const body = { parent, properties: args.properties ?? {} };
      if (args.children !== void 0) body.children = args.children;
      const res = await notionCall("POST", "/v1/pages", body);
      return { ok: true, id: res.id, url: res.url };
    }
  });
}
function notionUpdatePageTool() {
  return defineTool({
    name: "notion_update_page",
    description: "\u66F4\u65B0 Notion \u9875\u9762\u7684\u5C5E\u6027\u6216\u5F52\u6863\u72B6\u6001\u3002properties \u4F7F\u7528 Notion API \u539F\u751F\u7ED3\u6784\u3002Triggers: \u66F4\u65B0 Notion \u9875\u9762, \u4FEE\u6539 Notion \u5C5E\u6027.",
    parameters: {
      pageId: { type: "string", required: true, description: "\u9875\u9762 id / URL" },
      properties: { type: "json", description: "\u8981\u66F4\u65B0\u7684\u5C5E\u6027\uFF08Notion \u539F\u751F\u7ED3\u6784\uFF09" },
      archived: { type: "boolean", description: "true \u5F52\u6863\u9875\u9762\uFF0Cfalse \u6062\u590D\u9875\u9762" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    timeoutMs: 6e4,
    async execute(args) {
      const body = {};
      if (args.properties !== void 0) body.properties = args.properties;
      if (typeof args.archived === "boolean") body.archived = args.archived;
      if (Object.keys(body).length === 0) throw new Error("\u8BF7\u81F3\u5C11\u63D0\u4F9B properties \u6216 archived");
      const res = await notionCall("PATCH", `/v1/pages/${normalizeId(args.pageId)}`, body);
      return { ok: true, id: res.id, url: res.url, archived: res.archived === true };
    }
  });
}
function notionAppendBlocksTool() {
  return defineTool({
    name: "notion_append_blocks",
    description: "\u5411 Notion \u9875\u9762\u6216\u5757\u8FFD\u52A0\u5185\u5BB9\u5757\u3002children \u4E3A Notion block \u5BF9\u8C61\u6570\u7EC4\uFF08Notion \u539F\u751F\u7ED3\u6784\uFF09\u3002Triggers: \u8FFD\u52A0 Notion \u5185\u5BB9, \u5F80 Notion \u9875\u9762\u6DFB\u52A0\u5185\u5BB9.",
    parameters: {
      blockId: { type: "string", required: true, description: "\u76EE\u6807\u9875\u9762/\u5757 id \u6216 URL" },
      children: { type: "json", required: true, description: "\u8981\u8FFD\u52A0\u7684\u5757\u6570\u7EC4\uFF08Notion \u539F\u751F\u7ED3\u6784\uFF09" },
      after: { type: "string", description: "\u5728\u6B64\u5757\u4E4B\u540E\u63D2\u5165" }
    },
    output: { schema: { type: "json" }, render: renderJson },
    timeoutMs: 6e4,
    async execute(args) {
      const body = { children: args.children };
      if (args.after !== void 0) body.after = normalizeId(args.after);
      const res = await notionCall("PATCH", `/v1/blocks/${normalizeId(args.blockId)}/children`, body);
      return { ok: true, inserted: (res.results ?? []).map((b) => b.id) };
    }
  });
}
function notionTools() {
  return [
    notionSearchTool(),
    notionReadPageTool(),
    notionQueryDatabaseTool(),
    notionCreatePageTool(),
    notionUpdatePageTool(),
    notionAppendBlocksTool()
  ];
}

// src/index.ts
var name = "notion";
var inject = ["webServer", "tools", "systemPrompt"];
var SECTION_ORDER = 150;
var NOTION_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-notion \u63D2\u4EF6\uFF08Notion \u8FDE\u63A5\uFF09\uFF1A\u914D\u7F6E\u4E00\u6B21 Integration Token \u540E\u53EF\u7528 notion_search \u641C\u7D22\u9875\u9762/\u6570\u636E\u5E93\u3001notion_read_page \u8BFB\u53D6\u9875\u9762\u5185\u5BB9\u3001notion_query_database \u67E5\u8BE2\u6570\u636E\u5E93\u6761\u76EE\u3001notion_create_page \u521B\u5EFA\u9875\u9762\u3001notion_update_page \u66F4\u65B0\u5C5E\u6027/\u5F52\u6863\u3001notion_append_blocks \u8FFD\u52A0\u5185\u5BB9\u5757\u3002Token \u5B58 ~/.dsh/notion.json\uFF08\u6743\u9650 0600\uFF09\uFF0C\u5728 GUI \u8BBE\u7F6E \u2192 Notion \u914D\u7F6E\uFF1B\u9875\u9762/\u6570\u636E\u5E93\u9700\u5148\u5206\u4EAB\u7ED9\u8BE5 Integration\u3002\u7528\u6237\u63D0\u5230\u300CNotion / \u6D6E\u58A8 / \u77E5\u8BC6\u5E93 / \u7B14\u8BB0\u300D\u65F6\u5373\u6307\u672C\u63D2\u4EF6\uFF0C\u8BF7\u636E\u6B64\u534F\u4F5C\u3002";
function apply(ctx) {
  ctx.effect(
    () => {
      const disposers = notionTools().map((tool) => ctx.tools.register(tool));
      return () => {
        for (const dispose of disposers) dispose();
      };
    },
    "dsh-notion: tools"
  );
  ctx.effect(
    () => {
      const disposers = makeRoutes().map((route) => ctx.webServer.register(route));
      return () => {
        for (const dispose of disposers) dispose();
      };
    },
    "dsh-notion: routes"
  );
  ctx.effect(
    () => ctx.systemPrompt.section({ name: "plugin:dsh-notion", order: SECTION_ORDER, text: NOTION_GUIDANCE }),
    "dsh-notion: announcement"
  );
}
export {
  NOTION_GUIDANCE,
  apply,
  inject,
  name
};
