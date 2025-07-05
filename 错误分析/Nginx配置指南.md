# Nginx 配置修改指南

## 🎯 目标
配置 Nginx 反向代理来解决 ChatGPT 图片跨域访问问题

## 📍 第一步：定位 Nginx 配置文件

### macOS (使用 Homebrew 安装)
```bash
# 查找配置文件位置
nginx -t

# 常见位置
/usr/local/etc/nginx/nginx.conf
/opt/homebrew/etc/nginx/nginx.conf
```

### Linux (Ubuntu/Debian)
```bash
# 配置文件位置
/etc/nginx/nginx.conf
/etc/nginx/sites-available/default
/etc/nginx/sites-enabled/default
```

### CentOS/RHEL
```bash
# 配置文件位置
/etc/nginx/nginx.conf
/etc/nginx/conf.d/default.conf
```

## 🔧 第二步：备份现有配置

```bash
# 备份主配置文件
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# 备份站点配置（如果存在）
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
```

## 📝 第三步：修改配置文件

### 方法1：修改现有站点配置

```bash
# 编辑站点配置
sudo nano /etc/nginx/sites-available/default
# 或者使用 vim
sudo vim /etc/nginx/sites-available/default
```

### 方法2：创建新的配置文件

```bash
# 创建新的站点配置
sudo nano /etc/nginx/sites-available/chatgpt-proxy
```

## 🔨 完整的 Nginx 配置示例

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name saas.maynor1024.live;
    
    # 根目录设置
    root /var/www/html;
    index index.html index.htm index.nginx-debian.html;
    
    # 主站点配置
    location / {
        try_files $uri $uri/ =404;
        
        # 添加 CORS 头部
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        add_header Access-Control-Expose-Headers "Content-Length,Content-Range" always;
        
        # 处理 OPTIONS 预检请求
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }
    
    # ChatGPT API 代理配置
    location /api/chatgpt/ {
        # 代理到 ChatGPT
        proxy_pass https://chatgpt.com/;
        
        # 代理头部设置
        proxy_set_header Host chatgpt.com;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Origin https://chatgpt.com;
        proxy_set_header Referer https://chatgpt.com;
        proxy_set_header User-Agent "Mozilla/5.0 (compatible; Nginx-Proxy)";
        
        # SSL 验证设置
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
        
        # 缓存设置
        proxy_cache_bypass $http_upgrade;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 添加 CORS 头部
        add_header Access-Control-Allow-Origin "https://saas.maynor1024.live" always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        
        # 处理 OPTIONS 请求
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://saas.maynor1024.live";
            add_header Access-Control-Allow-Credentials true;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }
    
    # 专门的图片代理
    location /proxy/images/ {
        # 移除前缀并代理到 ChatGPT
        rewrite ^/proxy/images/(.*)$ /$1 break;
        proxy_pass https://chatgpt.com;
        
        # 图片专用头部
        proxy_set_header Host chatgpt.com;
        proxy_set_header Referer https://chatgpt.com;
        proxy_set_header User-Agent "Mozilla/5.0 (compatible; Image-Proxy)";
        
        # 缓存图片
        proxy_cache_valid 200 1d;
        proxy_cache_valid 404 1m;
        
        # CORS 设置
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "public, max-age=86400" always;
    }
    
    # 错误页面
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    # 日志设置
    access_log /var/log/nginx/chatgpt-proxy.access.log;
    error_log /var/log/nginx/chatgpt-proxy.error.log;
}
```

## 🔄 第四步：验证配置

```bash
# 测试配置文件语法
sudo nginx -t

# 如果语法正确，应该看到：
# nginx: configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

## 🔄 第五步：重启 Nginx

```bash
# 重新加载配置（推荐，不中断服务）
sudo nginx -s reload

# 或者重启服务
sudo systemctl restart nginx

# macOS (Homebrew)
brew services restart nginx

# 检查服务状态
sudo systemctl status nginx
```

## 🔗 第六步：启用站点（Debian/Ubuntu）

```bash
# 如果创建了新的配置文件，需要启用
sudo ln -s /etc/nginx/sites-available/chatgpt-proxy /etc/nginx/sites-enabled/

# 删除默认配置（可选）
sudo rm /etc/nginx/sites-enabled/default

# 重新加载配置
sudo nginx -s reload
```

## 🧪 第七步：测试代理

### 测试命令

```bash
# 测试基本连接
curl -I http://saas.maynor1024.live

# 测试代理功能
curl -I http://saas.maynor1024.live/api/chatgpt/

# 测试 CORS 头部
curl -H "Origin: https://saas.maynor1024.live" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://saas.maynor1024.live/api/chatgpt/
```

## 🔍 故障排除

### 检查日志

```bash
# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 查看访问日志
sudo tail -f /var/log/nginx/access.log
```

## ✅ 配置完成检查清单

- [ ] 备份原始配置文件
- [ ] 修改 Nginx 配置
- [ ] 验证配置语法 (`nginx -t`)
- [ ] 重启/重载 Nginx 服务
- [ ] 测试代理功能
- [ ] 检查 CORS 头部
- [ ] 验证图片加载 