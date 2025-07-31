# MaynorAI GPT PLUS 充值系统

基于原版 nice.chatgpt-plus.top 网站设计的 GitHub Pages 版本。

## 功能特性

- 🎨 现代化响应式设计
- 🔐 账户令牌管理
- 💳 CDK密钥验证系统
- 📊 账户信息面板
- 📝 操作日志记录
- 📱 移动端适配

## 技术栈

- HTML5
- CSS3 (Grid/Flexbox布局)
- 原生JavaScript
- LocalStorage数据持久化

## 部署到 GitHub Pages

1. Fork 或下载此项目
2. 在 GitHub 仓库设置中启用 Pages
3. 选择 main 分支作为源
4. 访问 `https://[用户名].github.io/[仓库名]`

## 本地运行

```bash
# 克隆项目
git clone [仓库地址]

# 进入目录
cd [项目目录]

# 使用本地服务器打开 index.html
# 或直接在浏览器中打开 index.html
```

## 文件结构

```
├── index.html      # 主页面
├── style.css       # 样式文件
├── script.js       # 交互逻辑
└── README.md       # 说明文档
```

## 演示功能

- 输入任意邮箱格式的令牌
- 输入任意CDK密钥进行模拟验证
- 70%成功率的随机验证结果
- 本地存储的账户状态和日志

## 注意事项

此为演示版本，所有验证功能均为前端模拟。实际部署需要后端API支持。