# macOS Nginx 快速配置指南

## 🍎 专为 macOS 用户设计

### 📦 第一步：安装 Nginx（如果尚未安装）

```bash
# 使用 Homebrew 安装
brew install nginx

# 检查安装
nginx -v
```

### 📍 第二步：找到配置文件位置

```bash
# 查看当前配置
nginx -t

# 通常位置（根据安装方式）
# Intel Mac:
/usr/local/etc/nginx/nginx.conf

# Apple Silicon Mac (M1/M2):
/opt/homebrew/etc/nginx/nginx.conf
```

### 🔧 第三步：快速修改配置

#### 方法1：直接修改主配置文件

```bash
# 备份原配置
cp /opt/homebrew/etc/nginx/nginx.conf /opt/homebrew/etc/nginx/nginx.conf.backup

# 编辑配置
nano /opt/homebrew/etc/nginx/nginx.conf
```

#### 方法2：创建独立的代理配置（推荐）

```bash
# 创建代理配置文件
nano /opt/homebrew/etc/nginx/servers/chatgpt-proxy.conf
```

### 📝 macOS 专用配置文件

#### 完整配置示例（chatgpt-proxy.conf）：

```nginx
server {
    listen 8080;
    server_name localhost;
    
    # 静态文件根目录
    root /usr/local/var/www;
    index index.html index.htm;
    
    # 主页面
    location / {
        try_files $uri $uri/ =404;
        
        # CORS 头部
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        # OPTIONS 预检
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Content-Type text/plain;
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # ChatGPT 代理
    location /chatgpt-api/ {
        # 重写 URL 去掉前缀
        rewrite ^/chatgpt-api/(.*)$ /$1 break;
        
        # 代理到 ChatGPT
        proxy_pass https://chatgpt.com;
        
        # 关键代理头部
        proxy_set_header Host chatgpt.com;
        proxy_set_header Origin https://chatgpt.com;
        proxy_set_header Referer https://chatgpt.com;
        proxy_set_header User-Agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
        proxy_set_header X-Forwarded-For $remote_addr;
        
        # SSL 设置
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        
        # CORS 响应头
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        # 超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # 专门的图片代理
    location /images/ {
        rewrite ^/images/(.*)$ /$1 break;
        proxy_pass https://chatgpt.com;
        
        proxy_set_header Host chatgpt.com;
        proxy_set_header Referer https://chatgpt.com;
        proxy_set_header User-Agent "Mozilla/5.0 (compatible)";
        
        # 图片缓存
        expires 1d;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*" always;
    }
    
    # 日志
    access_log /usr/local/var/log/nginx/chatgpt.access.log;
    error_log /usr/local/var/log/nginx/chatgpt.error.log;
}
```

#### 简化版配置（快速测试）：

```nginx
server {
    listen 8080;
    server_name localhost;
    
    location / {
        root /usr/local/var/www;
        add_header Access-Control-Allow-Origin "*";
    }
    
    location /api/ {
        proxy_pass https://chatgpt.com/;
        proxy_set_header Host chatgpt.com;
        add_header Access-Control-Allow-Origin "*";
    }
}
```

### 🚀 第四步：启动和测试

```bash
# 测试配置
nginx -t

# 启动 Nginx
brew services start nginx

# 或者手动启动
nginx

# 重新加载配置
nginx -s reload

# 检查状态
brew services list | grep nginx
```

### 🧪 第五步：本地测试

#### 在浏览器中测试：

1. 打开：http://localhost:8080
2. 测试代理：http://localhost:8080/chatgpt-api/
3. 测试图片：http://localhost:8080/images/

#### 命令行测试：

```bash
# 测试基本连接
curl -I http://localhost:8080

# 测试 CORS
curl -H "Origin: http://localhost:8080" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:8080/chatgpt-api/

# 测试代理
curl -v http://localhost:8080/chatgpt-api/backend-api/
```

### 🔧 前端代码修改

#### 修改您的网站代码：

```javascript
// 原来的代码：
// fetch('https://chatgpt.com/backend-api/estuary/content?id=...')

// 改为：
fetch('/chatgpt-api/backend-api/estuary/content?id=file-NP2KtBX3E5H2yU3EAoXVPi...')
  .then(response => {
    if (response.ok) {
      return response.blob();
    }
    throw new Error('Network response was not ok');
  })
  .then(blob => {
    const imageUrl = URL.createObjectURL(blob);
    document.getElementById('your-image').src = imageUrl;
  })
  .catch(error => {
    console.error('图片加载失败:', error);
    // 显示默认图片
    document.getElementById('your-image').src = '/placeholder.png';
  });
```

### 🔍 故障排除（macOS 特定）

#### 端口冲突：

```bash
# 检查端口占用
lsof -i :8080

# 杀死占用进程
sudo kill -9 <PID>

# 使用其他端口
# 在配置中改为 listen 8081;
```

#### 权限问题：

```bash
# 确保 Nginx 有权限访问文件
sudo chown -R $(whoami) /usr/local/var/www
sudo chmod -R 755 /usr/local/var/www
```

#### 日志查看：

```bash
# 查看错误日志
tail -f /usr/local/var/log/nginx/error.log

# 查看访问日志
tail -f /usr/local/var/log/nginx/access.log
```

### 🛠️ 开发环境集成

#### 与 VS Code Live Server 配合：

```json
// .vscode/settings.json
{
  "liveServer.settings.proxy": [
    ["/chatgpt-api", "http://localhost:8080/chatgpt-api"]
  ]
}
```

#### 与 webpack-dev-server 配合：

```javascript
// webpack.config.js
module.exports = {
  devServer: {
    proxy: {
      '/chatgpt-api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
};
```

### ⚡ 一键启动脚本

#### 创建启动脚本：

```bash
# 创建脚本文件
nano ~/start-chatgpt-proxy.sh
```

```bash
#!/bin/bash
# ChatGPT 代理启动脚本

echo "🚀 启动 ChatGPT 代理服务..."

# 检查 Nginx 是否已安装
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx 未安装，正在安装..."
    brew install nginx
fi

# 测试配置
echo "🔧 测试 Nginx 配置..."
if nginx -t; then
    echo "✅ 配置文件正确"
else
    echo "❌ 配置文件有错误，请检查"
    exit 1
fi

# 启动服务
echo "🏃 启动 Nginx 服务..."
brew services start nginx

# 等待服务启动
sleep 2

# 测试服务
if curl -s http://localhost:8080 > /dev/null; then
    echo "🎉 代理服务启动成功！"
    echo "📍 访问地址: http://localhost:8080"
    echo "🔗 API 代理: http://localhost:8080/chatgpt-api/"
else
    echo "❌ 服务启动失败，请检查配置"
fi
```

```bash
# 给脚本执行权限
chmod +x ~/start-chatgpt-proxy.sh

# 运行脚本
~/start-chatgpt-proxy.sh
```

### ✅ macOS 配置检查清单

- [ ] 安装 Homebrew 和 Nginx
- [ ] 备份原始配置文件
- [ ] 创建代理配置文件
- [ ] 测试配置语法 (`nginx -t`)
- [ ] 启动 Nginx 服务
- [ ] 测试本地访问 (http://localhost:8080)
- [ ] 测试代理功能
- [ ] 修改前端代码调用代理
- [ ] 验证图片加载成功

---

💡 **macOS 提示**: 记得在系统防火墙中允许 Nginx 的网络访问！ 