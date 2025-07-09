const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const sourceUrl = 'http://guozhivip.com/tool/';
const outputFile = 'categorized-tools.json';

async function scrapeAndCategorize() {
    try {
        const { data: html } = await axios.get(sourceUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(html);

        const categories = {};
        let currentCategory = null;

        // The page is structured with rows of .col-xs-12 elements.
        // An element containing h5/h6 denotes a new category header.
        $('.col-xs-12').each((idx, elem) => {
            const headerEl = $(elem).find('h5, h6').first();
            if (headerEl.length > 0) {
                // Found a new category
                const catName = headerEl.text().trim().split(' ')[0];
                currentCategory = catName;
                if (!categories[currentCategory]) {
                    categories[currentCategory] = {
                        category: currentCategory,
                        icon: getIcon(currentCategory),
                        tools: []
                    };
                }
            } else {
                // Not a header – look for links under current category
                if (currentCategory) {
                    $(elem).find('a').each((i, a) => {
                        const url = $(a).attr('href');
                        const text = $(a).text().trim();
                        if (url && text && !url.startsWith('javascript:')) {
                            const absoluteUrl = new URL(url, sourceUrl).href;
                            const catObj = categories[currentCategory];
                            if (!catObj.tools.some(t => t.url === absoluteUrl)) {
                                catObj.tools.push({ name: text, url: absoluteUrl });
                            }
                        }
                    });
                }
            }
        });

        const result = Object.values(categories).filter(c => c.tools.length > 0);
        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
        console.log(`Scraped and saved ${result.length} categories to ${outputFile}`);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

function getIcon(category) {
    if (category.includes('便民')) return 'fas fa-city';
    if (category.includes('图片')) return 'fas fa-image';
    if (category.includes('格式')) return 'fas fa-file-export';
    if (category.includes('文字')) return 'fas fa-font';
    if (category.includes('计算')) return 'fas fa-calculator';
    if (category.includes('在线生成')) return 'fas fa-qrcode';
    if (category.includes('设计')) return 'fas fa-pencil-ruler';
    if (category.includes('开发')) return 'fas fa-code';
    if (category.includes('站长')) return 'fas fa-server';
    return 'fas fa-toolbox';
}

scrapeAndCategorize(); 