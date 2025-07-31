document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const tokenInput = document.getElementById('token-input');
    const cdkInput = document.getElementById('cdk-input');
    const verifyBtn = document.querySelector('.verify-btn');
    const cdkBuyBtn = document.querySelector('.cdk-buy-btn');
    const modal = document.getElementById('message-modal');
    const modalMessage = document.getElementById('modal-message');
    const closeModal = document.querySelector('.close');
    const logsContainer = document.getElementById('logs-container');

    // Account info elements
    const userEmail = document.getElementById('user-email');
    const subscriptionStatus = document.getElementById('subscription-status');
    const expiryDate = document.getElementById('expiry-date');

    // Account data structure
    let accountData = {
        email: '',
        isSubscribed: false,
        expiryDate: null,
        logs: []
    };

    // Initialize
    init();

    function init() {
        // Load saved data from localStorage
        loadAccountData();
        updateAccountDisplay();
        setupEventListeners();
    }

    function setupEventListeners() {
        // Verify button click
        verifyBtn.addEventListener('click', handleVerify);
        
        // CDK buy button click
        cdkBuyBtn.addEventListener('click', handleCDKPurchase);
        
        // Modal close
        closeModal.addEventListener('click', hideModal);
        
        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                hideModal();
            }
        });

        // Input validation
        tokenInput.addEventListener('input', validateTokenInput);
        cdkInput.addEventListener('input', validateCDKInput);

        // Enter key handling
        tokenInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleVerify();
            }
        });

        cdkInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleVerify();
            }
        });
    }

    function validateTokenInput() {
        const token = tokenInput.value.trim();
        if (token.length > 0) {
            tokenInput.style.borderColor = '#10b981';
        } else {
            tokenInput.style.borderColor = '#e5e7eb';
        }
    }

    function validateCDKInput() {
        const cdk = cdkInput.value.trim();
        if (cdk.length > 0) {
            cdkInput.style.borderColor = '#10b981';
        } else {
            cdkInput.style.borderColor = '#e5e7eb';
        }
    }

    function handleVerify() {
        const token = tokenInput.value.trim();
        const cdk = cdkInput.value.trim();

        // Validation
        if (!token) {
            showModal('错误', '请输入账户令牌', 'error');
            return;
        }

        if (!cdk) {
            showModal('错误', '请输入CDK密钥', 'error');
            return;
        }

        // Simulate verification process
        verifyBtn.disabled = true;
        verifyBtn.textContent = '验证中...';

        setTimeout(() => {
            // Simulate verification result
            const success = Math.random() > 0.3; // 70% success rate simulation

            if (success) {
                // Update account data
                accountData.email = token.includes('@') ? token : `${token.substring(0, 8)}***@gmail.com`;
                accountData.isSubscribed = true;
                accountData.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
                
                // Add log entry
                addLogEntry('卡密充值成功', 'ChatGPT Plus 订阅已成功激活');
                
                // Save and update display
                saveAccountData();
                updateAccountDisplay();
                
                // Clear inputs
                tokenInput.value = '';
                cdkInput.value = '';
                
                showModal('充值成功', '卡密充值成功！您的ChatGPT Plus订阅已激活', 'success');
            } else {
                addLogEntry('卡密充值失败', '无效的卡密或网络异常，请重试');
                showModal('充值失败', '卡密充值失败，请检查卡密是否正确，或多提交几次重试', 'error');
            }

            verifyBtn.disabled = false;
            verifyBtn.textContent = '立即充值';
        }, 2000);
    }

    function handleCDKPurchase() {
        showModal('联系客服', '请联系客服购买卡密：\n\n客服QQ: 1002569303\n\n直接转账免手续费，24小时在线服务', 'info');
    }

    function showModal(title, message, type = 'info') {
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        modalMessage.innerHTML = `<h3>${icon} ${title}</h3><p style="margin-top: 15px; line-height: 1.6;">${message.replace(/\n/g, '<br>')}</p>`;
        modal.style.display = 'block';
        
        // Auto close success messages after 3 seconds
        if (type === 'success') {
            setTimeout(hideModal, 3000);
        }
    }

    function hideModal() {
        modal.style.display = 'none';
    }

    function addLogEntry(action, description) {
        const timestamp = new Date().toLocaleString('zh-CN');
        const logEntry = {
            timestamp,
            action,
            description
        };
        
        accountData.logs.unshift(logEntry); // Add to beginning
        
        // Keep only last 10 logs
        if (accountData.logs.length > 10) {
            accountData.logs = accountData.logs.slice(0, 10);
        }
        
        updateLogsDisplay();
    }

    function updateLogsDisplay() {
        if (accountData.logs.length === 0) {
            logsContainer.innerHTML = '<p class="no-logs">暂无操作记录</p>';
            return;
        }

        const logsHTML = accountData.logs.map(log => `
            <div class="log-entry" style="padding: 10px; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px;">
                <div style="font-weight: 500; color: #374151; margin-bottom: 4px;">${log.action}</div>
                <div style="font-size: 0.9rem; color: #6b7280; margin-bottom: 4px;">${log.description}</div>
                <div style="font-size: 0.8rem; color: #9ca3af;">${log.timestamp}</div>
            </div>
        `).join('');

        logsContainer.innerHTML = logsHTML;
    }

    function updateAccountDisplay() {
        userEmail.textContent = accountData.email || '未登录';
        subscriptionStatus.textContent = accountData.isSubscribed ? 'ChatGPT Plus 已激活' : '未订阅';
        subscriptionStatus.style.color = accountData.isSubscribed ? '#10b981' : '#6b7280';
        
        if (accountData.expiryDate) {
            expiryDate.textContent = accountData.expiryDate.toLocaleDateString('zh-CN');
        } else {
            expiryDate.textContent = '-';
        }
    }

    function saveAccountData() {
        // Convert dates to strings for JSON storage
        const dataToSave = {
            ...accountData,
            expiryDate: accountData.expiryDate ? accountData.expiryDate.toISOString() : null
        };
        localStorage.setItem('gptplus_account', JSON.stringify(dataToSave));
    }

    function loadAccountData() {
        const saved = localStorage.getItem('gptplus_account');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                accountData = {
                    ...parsed,
                    expiryDate: parsed.expiryDate ? new Date(parsed.expiryDate) : null
                };
                updateLogsDisplay();
            } catch (error) {
                console.error('Failed to load account data:', error);
            }
        }
    }

    // Function to reset account data
    window.resetAccount = function() {
        accountData = {
            email: '',
            isSubscribed: false,
            expiryDate: null,
            logs: []
        };
        localStorage.removeItem('gptplus_account');
        updateAccountDisplay();
        updateLogsDisplay();
        showModal('重置完成', '账户信息已重置', 'info');
    };

    // Add welcome log on first visit
    if (accountData.logs.length === 0) {
        addLogEntry('系统初始化', '欢迎使用ChatGPT Plus正规iOS代充服务');
    }
});