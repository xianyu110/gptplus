const { chromium } = require('playwright');

async function openBaiduWithPlaywright() {
    console.log('启动 Playwright 浏览器...');
    
    // 启动浏览器
    const browser = await chromium.launch({
        headless: false, // 设置为false以显示浏览器窗口
        slowMo: 1000     // 每个操作之间延迟1秒，便于观察
    });
    
    // 创建新页面
    const page = await browser.newPage();
    
    // 设置视口大小
    await page.setViewportSize({ width: 1280, height: 720 });
    
    console.log('正在打开百度首页...');
    
    // 导航到百度首页
    await page.goto('https://www.baidu.com');
    
    // 等待页面加载完成
    await page.waitForLoadState('domcontentloaded');
    
    console.log('百度首页已成功打开！');
    console.log('页面标题:', await page.title());
    
    // 可选：截图保存
    await page.screenshot({ path: 'baidu-homepage.png' });
    console.log('截图已保存为 baidu-homepage.png');
    
    // 等待几秒钟以便观察
    await page.waitForTimeout(5000);
    
    // 关闭浏览器
    await browser.close();
    console.log('浏览器已关闭');
}

// 运行函数
openBaiduWithPlaywright().catch(console.error);