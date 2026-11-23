# Changelog

本项目的所有重要变更都记录在这里。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 修复

- **`notion_query_database` 带 `filter` / `sorts` 时必定失败**（[#1](https://github.com/zhengjy01/dsh-notion-connector/issues/1)）：宿主会把 `type: 'json'` 的参数以 JSON 字符串形式传入，原先直接透传给 Notion 导致 `body.filter should be an object or undefined, instead was "{\"property\": ...}"`。现在所有接受 JSON 的参数（`filter`、`sorts`、`properties`、`children`）都会先做一次 `JSON.parse` 归一化，字符串与对象两种写法都能用；字符串不是合法 JSON 时直接抛出可读的中文错误，不再白跑一次 Notion 请求。

## [0.1.2] - 2026-09-29

### 兼容性

- 声明兼容 **DSH 0.2.0-rc.2**：`peerDependencies` 中官方 DSH 包的版本范围追加 `^0.2.0-rc.2`。功能与行为无变化，仅解除新版 DSH 下的兼容告警。

