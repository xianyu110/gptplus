document.addEventListener('DOMContentLoaded', () => {
    const toolsGrid = document.getElementById('tools-grid');
    const pageTitle = document.getElementById('page-title');
    const headerTitle = document.getElementById('header-title');

    // Update titles for the new content
    pageTitle.textContent = '免费影视专栏';
    headerTitle.innerHTML = '<i class="fas fa-film mr-2"></i>影视导航';

    // Function to get color class based on category name
    function getColorForCategory(category) {
        if (category.includes('观看')) return 'bg-green-500';
        if (category.includes('免费')) return 'bg-blue-500';
        if (category.includes('下载')) return 'bg-green-600';
        if (category.includes('海外')) return 'bg-purple-500';
        if (category.includes('动漫')) return 'bg-sky-500';
        if (category.includes('直播')) return 'bg-amber-500';
        if (category.includes('纪录片')) return 'bg-teal-500';
        if (category.includes('短视频')) return 'bg-rose-500';
        return 'bg-gray-400'; // Default color
    }

    // Fetch the categorized links data
    fetch('categorized-links.json')
        .then(response => response.json())
        .then(toolCategories => {
            toolCategories.forEach(category => {
                const card = document.createElement('div');
                card.className = 'bg-white rounded-lg shadow-md p-6 tool-card';

                let toolsHtml = '<div class="mt-4 flex flex-wrap gap-3">';
                category.tools.forEach(tool => {
                    toolsHtml += `<div><a href="${tool.url}" target="_blank" rel="noopener noreferrer" class="link-item text-gray-800">${tool.name}</a></div>`;
                });
                toolsHtml += '</div>';

                const categoryColorClass = getColorForCategory(category.category);

                card.innerHTML = `
                    <div class="flex items-center category-header">
                        <div class="icon ${categoryColorClass}"></div>
                        <h2 class="text-xl font-bold text-gray-800">${category.category}</h2>
                    </div>
                    ${toolsHtml}
                `;

                toolsGrid.appendChild(card);
            });
        })
        .catch(error => {
            console.error('Error fetching categorized links:', error);
            toolsGrid.innerHTML = '<p class="text-red-500 text-center col-span-full">加载影视链接失败，请稍后重试。</p>';
        });
}); 