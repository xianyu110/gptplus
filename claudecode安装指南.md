# claudecode 安装指南（macOS）

## 1. 安装 Node.js

建议使用 [Node.js 官方网站](https://nodejs.org/) 下载并安装 Node.js。推荐版本：**20.17.0 或更高**。

可用 Homebrew 安装（推荐）：
```bash
brew install node
```

## 2. 修复 npm 可能的权限问题

如果你之前用过 `sudo` 或遇到 npm 权限报错，建议先修复 npm 缓存目录权限：

```bash
sudo chown -R $(id -u):$(id -g) ~/.npm
```

## 3. 全局安装 claudecode

使用以下命令进行全局安装（需加 sudo）：

```bash
sudo npm install -g https://gaccode.com/claudecode/install --registry=https://registry.npmmirror.com
```

## 4. 检查安装

安装完成后，可通过以下命令检查是否安装成功：

```bash
claudecode --version
```
或
```bash
npx claudecode --help
```

## 5. 常见问题

### 1. npm 报错 "ERR_REQUIRE_ESM" 或 "EACCES"
- 先升级 Node.js 和 npm 到最新版本。
- 清理 npm 缓存和修复权限：
  ```bash
  sudo rm -rf ~/.npm
  sudo chown -R $(id -u):$(id -g) ~/.npm
  ```

### 2. npm 与 Node.js 版本不兼容警告
- 建议升级 Node.js 至 20.17.0 或更高版本。

### 3. 网络问题
- 若下载缓慢或失败，可切换为淘宝镜像（如上命令所示，已用 npmmirror）。

---

