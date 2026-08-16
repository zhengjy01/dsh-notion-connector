window.__ModuleLoader__.load({
	id: "dsh-notion-connector",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/client/index.ts
  var index_exports = {};
  __export(index_exports, {
    apply: () => apply,
    inject: () => inject
  });
  module.exports = __toCommonJS(index_exports);
  var import_react2 = require("react");

  // src/client/NotionSettings.tsx
  var import_react = require("react");
  var import_jsx_runtime = require("react/jsx-runtime");
  var API = "/api/dsh-notion";
  var styles = {
    page: { display: "flex", flexDirection: "column", gap: 12, fontSize: 13, lineHeight: 1.5, padding: "4px 2px" },
    title: { margin: 0, fontSize: 15 },
    status: { padding: "8px 10px", borderRadius: 6, background: "rgba(127,127,127,.12)" },
    row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
    input: { flex: 1, minWidth: 220, padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(127,127,127,.35)", background: "rgba(127,127,127,.1)", color: "inherit", font: "inherit" },
    button: { padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(127,127,127,.35)", background: "transparent", color: "inherit", font: "inherit", cursor: "pointer" },
    buttonPrimary: { padding: "5px 12px", borderRadius: 6, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", font: "inherit", cursor: "pointer" },
    buttonDisabled: { opacity: 0.5, cursor: "default" },
    ok: { color: "#22c55e" },
    err: { color: "#ef4444" },
    hint: { opacity: 0.75, fontSize: 12 },
    hintP: { margin: "4px 0" }
  };
  async function api(path, body) {
    const response = await fetch(API + path, {
      method: body === void 0 ? "GET" : "POST",
      headers: body === void 0 ? void 0 : { "Content-Type": "application/json" },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }
  function NotionSettings() {
    const [status, setStatus] = (0, import_react.useState)(null);
    const [token, setToken] = (0, import_react.useState)("");
    const [busy, setBusy] = (0, import_react.useState)(false);
    const [message, setMessage] = (0, import_react.useState)(null);
    (0, import_react.useEffect)(() => {
      api("/status").then(setStatus).catch((error) => {
        setMessage({ kind: "err", text: `\u8BFB\u53D6\u72B6\u6001\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}` });
      });
    }, []);
    const save = (0, import_react.useCallback)(() => {
      const value = token.trim();
      if (value === "") {
        setMessage({ kind: "err", text: "\u8BF7\u5148\u7C98\u8D34 Integration Token" });
        return;
      }
      setBusy(true);
      setMessage(null);
      api("/token", { token: value }).then((result) => {
        if (result.ok === true) {
          setToken("");
          setStatus({ configured: true, workspaceName: result.workspaceName ?? "", workspaceIcon: result.workspaceIcon ?? "" });
          setMessage({ kind: "ok", text: `\u8FDE\u63A5\u6210\u529F\uFF1A${result.workspaceName || "Notion \u5DE5\u4F5C\u533A"}` });
        } else {
          setMessage({ kind: "err", text: result.error ?? "\u4FDD\u5B58\u5931\u8D25" });
        }
      }).catch((error) => {
        setMessage({ kind: "err", text: `\u4FDD\u5B58\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}` });
      }).finally(() => setBusy(false));
    }, [token]);
    const clear = (0, import_react.useCallback)(() => {
      setBusy(true);
      api("/clear", {}).then(() => {
        setStatus({ configured: false, workspaceName: "", workspaceIcon: "" });
        setMessage({ kind: "ok", text: "\u5DF2\u6E05\u9664\u914D\u7F6E" });
      }).catch((error) => {
        setMessage({ kind: "err", text: `\u6E05\u9664\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}` });
      }).finally(() => setBusy(false));
    }, []);
    const connected = status !== null && status.configured;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.page, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: styles.title, children: "Notion \u8FDE\u63A5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.status, children: connected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
        "\u5DF2\u8FDE\u63A5\uFF1A",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: status.workspaceName || "(\u672A\u547D\u540D\u5DE5\u4F5C\u533A)" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: styles.err, children: "\u672A\u914D\u7F6E" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.row, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          style: styles.input,
          type: "password",
          placeholder: "\u7C98\u8D34 Notion Integration Token (secret_...)",
          value: token,
          spellCheck: false,
          onChange: (event) => setToken(event.target.value)
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.row, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: busy ? { ...styles.buttonPrimary, ...styles.buttonDisabled } : styles.buttonPrimary, disabled: busy, onClick: save, children: "\u6D4B\u8BD5\u5E76\u4FDD\u5B58" }),
        connected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: busy ? { ...styles.button, ...styles.buttonDisabled } : styles.button, disabled: busy, onClick: clear, children: "\u6E05\u9664\u914D\u7F6E" }) : null
      ] }),
      message !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: message.kind === "ok" ? styles.ok : styles.err, children: message.text }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.hint, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.hintP, children: "1. \u6253\u5F00\u96C6\u6210\u7BA1\u7406\u9875\u521B\u5EFA\u4E00\u4E2A Integration\uFF08\u5185\u90E8\u96C6\u6210\uFF09\uFF0C\u590D\u5236 Internal Integration Secret\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.hintP, children: "2. \u5728 Notion \u4E2D\u628A\u8981\u8BBF\u95EE\u7684\u9875\u9762/\u6570\u636E\u5E93 Share \u7ED9\u8BE5 Integration\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.hintP, children: "3. \u628A Secret \u7C98\u8D34\u5230\u4E0A\u65B9\u5E76\u4FDD\u5B58\uFF1B\u4FDD\u5B58\u65F6\u4F1A\u81EA\u52A8\u6821\u9A8C\u5E76\u8BFB\u53D6\u5DE5\u4F5C\u533A\u4FE1\u606F\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.hintP, children: "\u914D\u7F6E\u540E\u53EF\u7528\u5DE5\u5177\uFF1Anotion_search\u3001notion_read_page\u3001notion_query_database\u3001notion_create_page\u3001notion_update_page\u3001notion_append_blocks\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: styles.hintP, children: [
          "\u521B\u5EFA Integration\uFF1A",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: "https://www.notion.so/my-integrations", target: "_blank", rel: "noreferrer", children: "https://www.notion.so/my-integrations" })
        ] })
      ] })
    ] });
  }

  // src/client/index.ts
  var inject = ["slots"];
  function apply(ctx) {
    ctx.slots.inject("settings.section", () => ctx.slots.register(
      { name: "settings.section", id: "notion", order: 30, label: "Notion" },
      () => (0, import_react2.createElement)(NotionSettings)
    ));
  }

		return module.exports;
	}
});
