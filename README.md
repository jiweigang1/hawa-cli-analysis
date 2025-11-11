# Hawa CLI 分析工具

这是一个用于增强 Claude CLI、Codex CLI 的上下文日志分析工具。通过代理模式拦截和分析 API 调用，提供详细的日志记录和分析功能。

## 🌟 功能特性

- **多 CLI 支持**: 支持 Claude CLI、Codex CLI
- **代理模式**: 通过本地代理服务器拦截和分析 API 调用
- **详细日志记录**: 记录所有 API 请求和响应，支持完整和简化日志模式
- **多模型支持**: 支持 Kimi、DeepSeek、OpenRouter 等多种 AI 模型
- **MCP 服务器代理**: 支持 MCP (Model Context Protocol) 服务器代理
- **端口管理**: 自动分配可用端口，避免端口冲突
- **配置管理**: 灵活的配置文件管理，支持多环境配置
- **多进程支持**: 支持多进程多个端口同时运行

## 📋 支持的 CLI 工具

### 1. Claude CLI (`uclaude`)
- 支持 Claude Code 命令行工具
- 支持多种 AI 模型 (Kimi, DeepSeek, OpenRouter)
- 自动代理配置和端口管理

### 2. Codex CLI (`ucodex`)
- 支持 OpenAI Codex 命令行工具
- 使用代理模式进行日志获取
- 支持多种 AI 模型配置

## 🚀 安装方式

### 前置要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装步骤

 ```bash
npm install -g @dahawa/hawa-cli-analysis
  ```

1. **克隆项目**
   ```bash
   git clone https://github.com/jiweigang1/hawa-cli-analysis.git
   cd hawa-cli-analysis
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **链接到全局**
   ```bash
   npm link
   ```

4. **初始化配置** (首次使用)
   ```bash
   # 运行任意命令会自动创建配置文件
   uclaude
   ```

## ⚙️ 配置说明

### 配置文件位置
配置文件位于用户主目录下的 `.hawa-cli-analysis/config.json`：
- **Windows**: `C:\Users\用户名\.hawa-cli-analysis\config.json`
- **macOS/Linux**: `~/.hawa-cli-analysis/config.json`

### 默认配置
```json
{
  "kimi-k2": {
    "enable": false,
    "env": {
      "BASE_URL": "https://api.moonshot.cn/anthropic",
      "AUTH_TOKEN": "sk-{使用自己的token}",
      "MODEL": "kimi-k2-0905-preview",
      "SMALL_FAST_MODEL": "kimi-k2-0905-preview"
    }
  },
  "deepseek": {
    "enable": false,
    "env": {
      "BASE_URL": "https://api.deepseek.com/anthropic",
      "AUTH_TOKEN": "sk-{使用自己的token}",
      "API_TIMEOUT_MS": "600000",
      "MODEL": "deepseek-chat",
      "SMALL_FAST_MODEL": "deepseek-chat",
      "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
    }
  },
  "openrouter": {
    "enable": false,
    "env": {
      "BASE_URL": "http://127.0.0.1:3000",
      "AUTH_TOKEN": "sk-or-v1-{使用自己的token}",
      "MODEL": "anthropic/claude-sonnet-4",
      "SMALL_FAST_MODEL": "anthropic/claude-sonnet-4"
    }
  }
}
```

### 启用模型
将对应模型的 `enable` 设置为 `true`，并填入您的 API Token。

## 📖 使用方法

### Claude CLI 使用
```bash
# 启动 Claude CLI
uclaude

# 选择启用的模型，程序会自动启动代理服务器和 Claude Code
```

### Codex CLI 使用
```bash
# 启动 Codex CLI
ucodex

# 程序会自动启动代理服务器和 Codex CLI
```

## 🔧 高级配置

### MCP 服务器配置
支持配置 MCP (Model Context Protocol) 服务器：

配置文件位置：`~/.hawa-cli-analysis/mcp.json`

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp",
      "bearer_token": "sbp_xxxxx",
      "tools": {
        "blacklist": ["tool_name_to_exclude"],
        "descriptions": {
          "tool_name": "Custom description for this tool"
        }
      }
    }
  }
}
```

### 环境变量
- `LOG_LEVEL`: 日志级别 (debug, info, warn, error)
- `PIPE_PATH_PRE`: 管道路径前缀
- `BASE_URL`: API 基础地址
- `AUTH_TOKEN`: API 认证令牌

## 📁 项目结构

```
hawa-cli-analysis/
├── api-anthropic.js      # Anthropic API 处理
├── api-openai.js         # OpenAI API 处理
├── anthropic-transformer.js  # Anthropic 数据转换
├── clogger.js            # 主日志模块
├── clogger-openai.js     # OpenAI 日志模块
├── config.js             # 配置管理
├── logger-manager.js     # 日志管理器
├── logger.js             # 日志模块
├── mcp_oauth_tokens.js   # MCP OAuth 令牌
├── port-manager.js       # 端口管理
├── simple-transform-example.js  # 简单转换示例
├── ucodex-proxy.js       # Codex 代理
├── uclaude.js            # Claude CLI 启动器
├── ucodex.js             # Codex CLI 启动器
├── untils.js             # 工具函数
├── _uclaude.js           # Claude CLI 备用启动器
├── index.js              # 主入口文件
├── claude/               # Claude 相关配置
├── codex/                # Codex 相关配置
├── mcp/                  # MCP 服务器配置
├── tests/                # 测试文件
└── package.json
```

## 🔍 日志文件

日志文件保存在用户主目录下的 `.hawa-cli-analysis/logs/` 目录中：
- **系统日志**: `system/api-simple-{timestamp}.log`
- **完整日志**: `{cli-type}/api-full-{timestamp}.log`
- **简化日志**: `{cli-type}/api-simple-{timestamp}.log`

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

ISC License
