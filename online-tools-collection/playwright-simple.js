const { chromium } = require('playwright');

async function openBaiduSimple() {
    try {
        console.log('启动 Playwright 浏览器...');
        
        // 启动浏览器
        const browser = await chromium.launch({
            headless: false, // 显示浏览器窗口
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        // 创建新页面
        const page = await browser.newPage();
        
        console.log('正在打开百度首页...');
        
        // 导航到百度首页
        await page.goto('https://www.baidu.com');
        
        console.log('百度首页已成功打开！');
        console.log('页面标题:', await page.title());
        
        // 等待5秒钟以便观察
        await page.waitForTimeout(5000);
        
        // 关闭浏览器
        await browser.close();
        console.log('浏览器已关闭');
        
    } catch (error) {
        console.error('发生错误:', error);
    }
}

// 运行函数
openBaiduSimple();