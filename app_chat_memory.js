// ==========================================
// 赛博终端 - 记忆与情报系统核心逻辑
// ==========================================

// 1. 触发判断器 (完美防丢失修复版)
let isCheckingMemory = false;

async function checkAndTriggerMemorySummary(contactId) {
    if (isCheckingMemory) return; 
    isCheckingMemory = true;
    
    try {
        const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
        if (!settings.autoSummary) return;

        const history = await loadFromDB(`chat_history_${contactId}`) || [];
        const threshold = settings.summaryMessages || 30; 
        let lastSummaryIndex = settings.lastSummaryIndex || 0; 

        if (history.length - lastSummaryIndex >= threshold) {
            console.log(`触发记忆提取机制！当前条数：${history.length}，上次总结节点：${lastSummaryIndex}`);
            
            const currentLength = history.length;

            const contacts = await loadFromDB('chat_contacts') || [];
            const contactInfo = contacts.find(c => c.id === contactId);
            const isGroup = contactInfo && contactInfo.isGroup;
            const contactName = contactInfo ? contactInfo.name : 'TA';

            const msgsToSummarize = history.slice(lastSummaryIndex, currentLength);
            
            const recentChat = msgsToSummarize.map(m => {
                let speaker = m.role === 'user' ? '我' : (m.speakerName || contactName);
                return `${speaker}: ${m.content}`;
            }).join('\n');
            
            // 【核心修复1】：加上 await 彻底锁死进程，让大模型慢慢算，防止期间用户疯狂聊天导致连环并发！
            // 【核心修复2】：将 currentLength 传进去，只要大模型返回成功，在 generateChatMemory 内部推进进度！
            await generateChatMemory(contactId, recentChat, contactName, currentLength, isGroup);
        }
    } finally {
        isCheckingMemory = false; // 大模型返回（无论成功失败）后，才释放锁
    }
}

// 2. 生成客观记忆卡片 (支持单聊/群聊智能切换)
async function generateChatMemory(contactId, chatText, realName, currentHistoryLength = 0, isGroup = false) {
    const useSubApi = await loadFromDB('memoryUseSubApi') || false; 
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) return;

    // 获取玩家(用户)设定的真实姓名
    let playerName = '我';
    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    if (settings.userRoleId) {
        const chars = await loadFromDB('ai_characters') || [];
        const userRole = chars.find(c => c.id === settings.userRoleId);
        if (userRole && userRole.name) {
            playerName = userRole.name;
        }
    }

    let sysPrompt = '';
    
    // ★ 智能判断：如果是群聊，使用第三人称上帝视角
    if (isGroup) {
        sysPrompt = `你是一个记忆提取模块。请根据以下的群聊记录，撰写一份客观的群聊剧情摘要。
【核心要求】：
1. 视角：必须以【第三人称上帝视角】进行客观记录，清晰地写出每个人物（包括${playerName}和其他群成员）的互动与事件。
2. 绝对客观：只记录发生了什么、大家讨论了什么、重要决定和约定。剥离繁复的情绪描写，文风平实克制。
3. 内容：提取群聊中的核心话题、冲突或关键情节。
4. 格式：直接输出正文段落。绝对禁止输出任何“标题”或表单列点。绝对不要用任何 Markdown 格式。
5. 字数控制：严格控制在 350 字以内，精炼紧凑。`;
        sysPrompt += `\n\n近期群聊【${realName}】记录如下：\n${chatText}`;
    } else {
        // 单聊则使用原来的第一人称逻辑
        sysPrompt = await loadFromDB('memoryPrompt1');
        if (!sysPrompt) {
            sysPrompt = `你是一个记忆提取模块。请根据以下对话记录，撰写一份客观的剧情摘要。
【核心要求】：
1. 视角与称呼：请以第一人称（即“我”）视角来记录，这个“我”代表【${realName}】。指代对话的另一方（用户）时，必须使用名字【${playerName}】！绝对禁止搞反人称！
2. 绝对客观：只记录发生了什么、双方表达了什么、重要约定和物品。剥离繁复的情绪描写、环境渲染或小说式的修辞，文风平实克制。
3. 内容：准确提取出双方明确表达的喜好、关键个人信息与约定。
4. 格式绝对纯净：直接输出正文段落。绝对禁止输出任何“档案编号”、“记录对象”、“标题”或表单列点。绝对不要用任何 Markdown 格式。
5. 字数控制：严格控制在 350 字以内，精炼紧凑。`;
        }
        sysPrompt += `\n\n近期对话记录如下(注意记录中'TA'代表${realName}，'我'代表${playerName})：\n${chatText}`;
    }

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }], temperature: 0.3 })
        });
        const data = await res.json();
        const memoryContent = data.choices[0].message.content.trim();

        let memories = await loadFromDB(`chat_memories_${contactId}`) || [];
        memories.push({ id: Date.now(), content: memoryContent, timestamp: Date.now(), isArchived: false });
        await saveToDB(`chat_memories_${contactId}`, memories);
        
        if (currentHistoryLength > 0) {
            let settings = await loadFromDB(`chat_settings_${contactId}`) || {};
            settings.lastSummaryIndex = currentHistoryLength;
            await saveToDB(`chat_settings_${contactId}`, settings);
        }
        
                // 单聊才提取【TA眼中的我】(群聊人太多，提取偏好容易混乱，直接跳过)
        if (!isGroup) {
            const isAutoPrefs = await loadFromDB('autoExtractPrefs') !== false;
            if (isAutoPrefs) {
                extractUserPreferences(contactId, chatText);
            }
        }

    } catch (e) {
        console.error("生成记忆失败:", e);
    }
}

// 3. 后台静默抓取 TA 眼里的我 (用户偏好)
async function extractUserPreferences(contactId, chatText) {
    const useSubApi = await loadFromDB('memoryUseSubApi') || false; 
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) return;

    let existingPrefs = await loadFromDB(`chat_user_prefs_${contactId}`) || '';
    let sysPrompt = await loadFromDB('memoryPrompt3');
    if (!sysPrompt) {
        sysPrompt = `你是一个没有感情的个人情报提取雷达。
任务：从下方的聊天记录中，提取关于用户(我)的核心信息：
1. 生活习惯与日常规律
2. 学习/工作进展与状态
3. 过往经历与故事
4. 个人喜好、禁忌与特殊设定

要求：
1. 若已有旧情报，请将新情报与旧情报合并、去重、梳理。
2. 只要核心干货，用简短的词组或短句罗列。
3. 若完全没有新情报，只需输出“无”，绝对不要瞎编！`;
    }
    sysPrompt += `\n\n【旧情报】：${existingPrefs || '无'}\n【新记录】：${chatText}`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }], temperature: 0.3 }) 
        });
        const data = await res.json();
        let newPrefs = data.choices[0].message.content.trim();

        if (newPrefs && newPrefs !== '无') {
            await saveToDB(`chat_user_prefs_${contactId}`, newPrefs);
            console.log("【TA眼里的我】情报更新成功！");
        }
    } catch (e) {
        console.error("提取用户情报失败:", e);
    }
}

// 4. 精简与融合已有记忆卡片
async function refineChatMemories(contactId, realName, memories) {
    const useSubApi = await loadFromDB('memoryUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) return;

    // 获取玩家(用户)设定的真实姓名
    let playerName = 'TA';
    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    if (settings.userRoleId) {
        const chars = await loadFromDB('ai_characters') || [];
        const userRole = chars.find(c => c.id === settings.userRoleId);
        if (userRole && userRole.name) {
            playerName = userRole.name;
        }
    }

    const allMemText = memories.map(m => m.content).join('\n\n');
    let sysPrompt = await loadFromDB('memoryPrompt2');
    
    if (!sysPrompt) {
        sysPrompt = `你是一个无感情的客观记忆提取模块。请把以下多段跨越时间的零散记忆碎片，压缩、融合成一段连贯的高密度记忆摘要。
【核心要求】：
1. 格式绝对纯净：直接输出正文段落。不要输出标题、冒号前缀或列点。
2. 视角与称呼：以第一人称（即“我”）记录，这个“我”代表【${realName}】。指代对方（用户）时，必须使用名字【${playerName}】！绝对禁止搞反人称！
3. 绝对客观：剥离废话，按时间线合并经过。严禁小说式的情绪渲染和修辞。
4. 内容：绝对不能丢失“约定”、双方的“喜好”和“关键信息点”！
5. 篇幅：严格控制在 3000 字以内，必须精炼。不要 Markdown。`;
    }
    sysPrompt += `\n\n待精简的碎片如下：\n${allMemText}`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }], temperature: 0.3 })
        });
        const data = await res.json();
        const refinedContent = data.choices[0].message.content.trim();

        // 核心改造：不删旧数据，把目前所有的卡片标记为已归档！
        let allMemories = await loadFromDB(`chat_memories_${contactId}`) || [];
        allMemories.forEach(m => {
            if (!m.isArchived) m.isArchived = true; // 打上归档封条
        });

        // 插入新的精华记忆（它是活跃的）
        allMemories.push({ id: Date.now(), content: refinedContent, timestamp: Date.now(), isArchived: false });

        await saveToDB(`chat_memories_${contactId}`, allMemories);
        console.log("记忆已融合，旧卡片已全部归档！");
    } catch (e) {
        console.error("融合记忆失败:", e);
    }
}

// ==========================================
// 记忆系统界面交互逻辑 (艺术版)
// ==========================================
document.getElementById('quickMemoryBtn').addEventListener('click', openMemoryPanel);
document.getElementById('menuMemoryBtn').addEventListener('click', openMemoryPanel);

function openMemoryPanel() {
    if (!currentChatContact) { showToast('请先连接一个灵魂频段'); return; }
    document.getElementById('chatExpandMenu').classList.remove('open');
    renderChatMemories();
    document.getElementById('chatMemoryPanel').classList.add('show');
}
document.getElementById('closeMemoryPanelBtn').addEventListener('click', () => {
    document.getElementById('chatMemoryPanel').classList.remove('show');
});

document.getElementById('openPrefsPanelBtn').addEventListener('click', async () => {
    const prefs = await loadFromDB(`chat_user_prefs_${currentChatContact.id}`) || '';
    document.getElementById('prefsContentArea').value = prefs;
    document.getElementById('chatPrefsPanel').classList.add('show');
});
document.getElementById('closePrefsPanelBtn').addEventListener('click', () => {
    document.getElementById('chatPrefsPanel').classList.remove('show');
});

document.getElementById('savePrefsBtn').addEventListener('click', async () => {
    const newPrefs = document.getElementById('prefsContentArea').value.trim();
    await saveToDB(`chat_user_prefs_${currentChatContact.id}`, newPrefs);
    showToast('映像已封存。');
    document.getElementById('chatPrefsPanel').classList.remove('show');
});

async function renderChatMemories() {
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
// 只渲染未归档的活跃卡片
let memories = allMemories.filter(m => !m.isArchived);
memories.sort((a, b) => b.timestamp - a.timestamp);
    const container = document.getElementById('memoryListArea');
    container.innerHTML = '';
    
    if (memories.length === 0) {
        container.innerHTML = '<div class="diary-poetic-empty" style="padding: 40px 0;"><svg viewBox="0 0 24 24"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg><div class="diary-poetic-text">记忆的星轨空空如也...</div></div>';
        return;
    }
    
    memories.forEach(mem => {
        const div = document.createElement('div');
        div.className = 'mem-glass-card';
        const dObj = new Date(mem.timestamp);
        const timeStr = `${dObj.getFullYear()}.${(dObj.getMonth()+1).toString().padStart(2,'0')}.${dObj.getDate().toString().padStart(2,'0')} - ${dObj.getHours().toString().padStart(2,'0')}:${dObj.getMinutes().toString().padStart(2,'0')}`;
        
        div.innerHTML = `
    <div class="mem-glass-header"><span>RECORD / ${timeStr}</span></div>
    <textarea class="mem-glass-textarea" spellcheck="false" id="mem_text_${mem.id}" onblur="saveMemory(${mem.id})">${mem.content}</textarea>
    <div class="mem-action-row">
        <div class="mem-btn-text danger" onclick="deleteMemory(${mem.id})">抹除</div>
        <!-- 新增了归档按钮 -->
        <div class="mem-btn-text" style="color:var(--text-sub);" onclick="archiveMemory(${mem.id})">归档</div>
        <div class="mem-btn-text primary" onclick="saveMemory(${mem.id})">重塑</div>
    </div>
`;
        container.appendChild(div);
    });
}

window.saveMemory = async function(id) {
    let memories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    const target = memories.find(m => m.id === id);
    if (target) {
        target.content = document.getElementById(`mem_text_${id}`).value.trim();
        await saveToDB(`chat_memories_${currentChatContact.id}`, memories);
        showToast('记忆已重塑。');
    }
};

window.deleteMemory = async function(id) {
    showBeautifulDialog('抹除印记', '这段记忆将如同消散的星轨，再也无迹可寻。确认抹除吗？', 'confirm', '', async () => {
        let memories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        memories = memories.filter(m => m.id !== id);
        await saveToDB(`chat_memories_${currentChatContact.id}`, memories);
        renderChatMemories();
        showToast('印记已抹除。');
    });
};

document.getElementById('extractMemoryNowBtn').addEventListener('click', async function() {
    const btn = this.querySelector('.mem-float-text');
    const history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    const threshold = settings.summaryMessages || 30;
    
    if (history.length === 0) { showToast('还没有产生任何交集哦。'); return; }
    
    // 获取联系人信息判断是否是群聊
    const contacts = await loadFromDB('chat_contacts') || [];
    const contactInfo = contacts.find(c => c.id === currentChatContact.id);
    const isGroup = contactInfo && contactInfo.isGroup;
    
    const recentChat = history.slice(-threshold).map(m => {
        let speaker = m.role === 'user' ? '我' : (m.speakerName || currentChatContact.name);
        return `${speaker}: ${m.content}`;
    }).join('\n');
    
    btn.innerText = "星轨凝结中..."; document.getElementById('extractMemoryNowBtn').style.pointerEvents = 'none';
    
    // 传入 isGroup 标志
    await generateChatMemory(currentChatContact.id, recentChat, currentChatContact.name, history.length, isGroup);
    
    btn.innerText = "沉淀此刻"; document.getElementById('extractMemoryNowBtn').style.pointerEvents = 'auto';
    showToast('灵魂印记已提取。');
    renderChatMemories();
});

document.getElementById('refineMemoryBtn').addEventListener('click', async function() {
    const btn = this.querySelector('.mem-float-text');
    // ⬇️ 就是改了这里，先拿所有卡片，再把归档的过滤掉！
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    const memories = allMemories.filter(m => !m.isArchived); 
    
    if (memories.length <= 1) { showToast('活跃的星轨还不够密集，不需要萃取哦。'); return; }
    
    showBeautifulDialog('萃取星辉', `将把漫长岁月里的 ${memories.length} 段记忆碎片，提纯为高密度的精华。确定执行吗？`, 'confirm', '', async () => {
        btn.innerText = "萃取星辉中..."; document.getElementById('refineMemoryBtn').style.pointerEvents = 'none';
        await refineChatMemories(currentChatContact.id, currentChatContact.name, memories);
        btn.innerText = "萃取星辉"; document.getElementById('refineMemoryBtn').style.pointerEvents = 'auto';
        showToast('记忆已提纯。');
        renderChatMemories();
    });
});

// 手动将某条记忆打上归档封条 (A+B 结合版)
window.archiveMemory = async function(id) {
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    let target = allMemories.find(m => m.id === id);
    if (!target) return;

    // 动态生成一个专属的归档弹窗，免去改 HTML 的麻烦
    let modal = document.getElementById('archiveMemoryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'archiveMemoryModal';
        modal.className = 'custom-confirm-overlay'; // 复用全局背景样式
        modal.innerHTML = `
            <div class="custom-confirm-box" style="background:#F6F4F0; width: 85vw; max-width: 320px; text-align: center;">
                <div class="cc-title" style="margin-bottom: 8px;">封存记忆</div>
                <div class="cc-desc" style="font-size:11px; margin-bottom:16px;">请输入触发关键词(逗号隔开)，留空则作为静默档案收藏，雷达将无法触发。</div>
                
                <div style="position: relative; margin-bottom: 20px; text-align: left;">
                    <input type="text" class="s-input cc-input" id="archiveKeywordInput" placeholder="例如: 项链,游乐园" style="width:100%; padding-right: 80px; box-sizing: border-box; font-size:14px;">
                    <div id="archiveAiBtn" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: bold; color: var(--accent); background: rgba(184,156,142,0.15); padding: 6px 10px; border-radius: 8px; cursor: pointer; transition: 0.2s;">AI提取</div>
                </div>

                <div class="cc-btns">
                    <button class="cc-btn cancel" id="archiveCancelBtn">取消</button>
                    <button class="cc-btn primary" id="archiveConfirmBtn" style="background:var(--accent);">封存归档</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const input = document.getElementById('archiveKeywordInput');
    const aiBtn = document.getElementById('archiveAiBtn');
    const cancelBtn = document.getElementById('archiveCancelBtn');
    const confirmBtn = document.getElementById('archiveConfirmBtn');

    // 初始化重置弹窗状态
    input.value = '';
    aiBtn.innerText = 'AI提取';
    aiBtn.style.opacity = '1';
    aiBtn.style.pointerEvents = 'auto';

    // 显示弹窗并自动聚焦
modal.classList.add('show');

    // 【B 方案】：点击 AI 提取关键词
    aiBtn.onclick = async () => {
        aiBtn.innerText = '提取中...';
        aiBtn.style.opacity = '0.5';
        aiBtn.style.pointerEvents = 'none';

        const useSubApi = await loadFromDB('memoryUseSubApi') || false; 
        const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
        const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
        const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

        if (!apiKey) {
            showToast("请先在设置中配置 API Key");
            aiBtn.innerText = 'AI提取'; aiBtn.style.opacity = '1'; aiBtn.style.pointerEvents = 'auto';
            return;
        }

        const sysPrompt = `你是一个关键词提取器。请从以下文本中提取出最核心的，合适数量的触发关键词。
要求：
1. 只能输出词语，用逗号分隔。
2. 绝对不要包含任何多余的解释、前缀或标点。
示例输出：苹果,游乐园,项链`;
        
        try {
            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }, { role: "user", content: target.content }], temperature: 0.2 })
            });
            const data = await res.json();
            // 直接将提取到的词填入输入框
            input.value = data.choices[0].message.content.trim();
        } catch (e) {
            showToast("提取失败：" + e.message);
        } finally {
            aiBtn.innerText = 'AI提取'; aiBtn.style.opacity = '1'; aiBtn.style.pointerEvents = 'auto';
        }
    };

    // 清理事件，防止重复绑定
    const cleanup = () => {
        modal.classList.remove('show');
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
        aiBtn.onclick = null;
    };

    cancelBtn.onclick = cleanup;

    // 【A 方案】：确认封存，可以纯手打，也可以基于 AI 的结果修改
    confirmBtn.onclick = async () => {
        const keywords = input.value.trim();
        target.isArchived = true; // 贴上封条
        
        if (keywords) {
            target.triggerKeys = keywords;
            // 巧妙地在内容前拼上隐藏标签，让右上角搜索能炫酷地渲染出彩色 Tag
            target.content = `[旧日关键词: ${keywords}] ${target.content}`;
        }

        await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
        showToast('记忆已封存入库！');
        renderChatMemories(); // 刷新星轨列表，卡片消失
        cleanup();
    };
};

// === 记忆模块设置交互逻辑 ===
document.getElementById('openMemorySettingsBtn').addEventListener('click', async () => {
    // 读取副API开关
    document.getElementById('memoryApiToggle').checked = await loadFromDB('memoryUseSubApi') || false;
    document.getElementById('autoExtractPrefsToggle').checked = (await loadFromDB('autoExtractPrefs') !== false); 
    // 读取自定义提示词
    document.getElementById('memoryPrompt1').value = await loadFromDB('memoryPrompt1') || '';
    document.getElementById('memoryPrompt2').value = await loadFromDB('memoryPrompt2') || '';
    document.getElementById('memoryPrompt3').value = await loadFromDB('memoryPrompt3') || '';
    
    document.getElementById('memorySettingsPanel').classList.add('show');
});

document.getElementById('cancelMemorySettingsBtn').addEventListener('click', () => {
    document.getElementById('memorySettingsPanel').classList.remove('show');
});

document.getElementById('saveMemorySettingsBtn').addEventListener('click', async () => {
    await saveToDB('memoryUseSubApi', document.getElementById('memoryApiToggle').checked);
    await saveToDB('autoExtractPrefs', document.getElementById('autoExtractPrefsToggle').checked);
    await saveToDB('memoryPrompt1', document.getElementById('memoryPrompt1').value.trim());
    await saveToDB('memoryPrompt2', document.getElementById('memoryPrompt2').value.trim());
    await saveToDB('memoryPrompt3', document.getElementById('memoryPrompt3').value.trim());
    
    document.getElementById('memorySettingsPanel').classList.remove('show');
    showToast('记忆模块设置已保存');
});

// ====== 重置分卷大纲铸造进度引擎 ======
document.getElementById('resetOutlineProgressBtn').addEventListener('click', async () => {
    if (!currentChatContact) return;
    showBeautifulDialog('重置进度', '确定要将所有归档记忆的【已铸造】标记清空吗？\n这会让进度回到 0 ，允许你从头开始重新铸造大纲。', 'confirm', '', async () => {
        let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        let count = 0;
        allMemories.forEach(m => {
            if (m.hasBeenOutlined) {
                m.hasBeenOutlined = false;
                count++;
            }
        });
        
        if (count > 0) {
            await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
            showToast(`已成功重置！释放了 ${count} 条记忆碎片。`);
            document.getElementById('memorySettingsPanel').classList.remove('show');
        } else {
            showToast('当前没有被铸造过的记忆，无需重置~');
        }
    });
});

// ==========================================
// 聊天室搜索与归档追溯功能 (含上下文切片)
// ==========================================
const chatSearchPanel = document.getElementById('chatSearchPanel');
const chatSearchInput = document.getElementById('chatSearchInput');
const chatSearchResults = document.getElementById('chatSearchResults');
let currentSearchTab = 'history';

// 1. 打开与关闭搜索面板
document.getElementById('chatSearchBtn').addEventListener('click', () => {
    if (!currentChatContact) return;
    chatSearchInput.value = '';
    chatSearchResults.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">输入关键词开始追溯...</div>';
    chatSearchPanel.classList.add('show');
    setTimeout(() => chatSearchInput.focus(), 300);
});
document.getElementById('closeChatSearchBtn').addEventListener('click', () => {
    chatSearchPanel.classList.remove('show');
});

// 2. 切换全新 Tab
document.querySelectorAll('#searchTabSelector .search-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#searchTabSelector .search-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSearchTab = btn.dataset.tab;
        performSearch(); 
    });
});

// 3. 防抖搜索
let searchTimer = null;
chatSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(performSearch, 400); 
});

// 4. 执行搜索 (全新档案馆版)
async function performSearch() {
    const keyword = chatSearchInput.value.trim().toLowerCase();

    if (currentSearchTab === 'history') {
        if (!keyword) {
            chatSearchResults.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">输入关键词开始追溯...</div>';
            return;
        }
        chatSearchResults.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">追溯中...</div>';

        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
        let results = [];
        history.forEach((msg, idx) => {
            if (msg.content && msg.content.toLowerCase().includes(keyword)) {
                results.push({ msg, index: idx });
            }
        });
        results.reverse(); // 最新的在上面
        
        if (results.length === 0) {
            chatSearchResults.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">未找到相关的聊天记录</div>';
            return;
        }

        let html = '';
        results.forEach(res => {
            const msg = res.msg;
            const d = new Date(msg.timestamp);
            const timeStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            const roleName = msg.role === 'user' ? '我' : currentChatContact.name;
            const highlightedText = msg.content.replace(new RegExp(keyword, 'gi'), match => `<span style="color:var(--accent); font-weight:bold;">${match}</span>`);
            
            html += `
                <div style="background:var(--surface); border-radius:16px; padding:14px; box-shadow:var(--shadow); border:1px solid rgba(184,156,142,0.1); cursor:pointer;" onclick="openChatContext(${res.index})">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:11px; color:var(--text-sub); font-weight:600;">
                        <span>${roleName}</span>
                        <span>${timeStr}</span>
                    </div>
                    <div style="font-size:14px; color:var(--text-main); line-height:1.6; word-break:break-word;">
                        ${highlightedText}
                    </div>
                </div>
            `;
        });
        chatSearchResults.innerHTML = html;
        
    } else {
        // 【搜记忆卡片：如果输入框为空，展示所有归档记忆！】
        let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        let archivedMems = allMemories.filter(m => m.isArchived === true);
        
        let results = archivedMems;
        if (keyword) {
            results = archivedMems.filter(m => m.content && m.content.toLowerCase().includes(keyword));
        }
        results.reverse();
        
        if (results.length === 0) {
            chatSearchResults.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">历史档案馆中空空如也</div>';
            return;
        }

        // 添加一个全局提示和“一键清空”按钮
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 4px;">
                <span style="font-size:11px; color:var(--text-sub); font-weight:bold;">当前共有 ${results.length} 份归档记忆</span>
                <span style="font-size:11px; color:#D67A7A; font-weight:bold; cursor:pointer; background:#FFF0F0; padding:4px 10px; border-radius:8px;" onclick="clearAllArchivedMemories()">清空所有归档</span>
            </div>
        `;

        results.forEach(mem => {
    const d = new Date(mem.timestamp);
    const timeStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    
    let keywordsHtml = '';
    let pureText = mem.content;
    
    // 把隐藏的关键词抓出来，变成好看的彩色 UI 标签
    const kwMatch = mem.content.match(/\[旧日关键词:(.*?)\]/);
    if (kwMatch) {
        const keys = kwMatch[1].split(/[,，、]/).filter(k => k.trim());
        keywordsHtml = `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">` + 
            keys.map(k => `<span style="background:rgba(184,156,142,0.15); color:var(--accent); padding:2px 8px; border-radius:8px; font-size:11px; font-weight:bold;"># ${k.trim()}</span>`).join('') +
            `</div>`;
        pureText = mem.content.replace(/\[旧日关键词:.*?\]\s*/, '');
    }

    let highlightedText = pureText;
    if (keyword) {
        highlightedText = pureText.replace(new RegExp(keyword, 'gi'), match => `<span style="color:var(--accent); font-weight:bold;">${match}</span>`);
    }
    
    html += `
        <div style="background:var(--surface); border-radius:16px; padding:14px; box-shadow:var(--shadow); border:1px dashed rgba(184,156,142,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:10px; font-weight:800; color:var(--text-sub); letter-spacing:1px;">ARCHIVED / ${timeStr}</span>
                                        <div style="display:flex; gap:8px;">
                            <button class="s-btn" style="margin:0; min-height:26px; height:26px; padding:0 10px; font-size:11px; border-radius:8px; flex:none; width:max-content; background:#F0EDE8; color:var(--text-main);" onclick="editArchivedMemory(${mem.id})">编辑</button>
                            <button class="s-btn danger" style="margin:0; min-height:26px; height:26px; padding:0 10px; font-size:11px; border-radius:8px; flex:none+ width:max-content;" onclick="deleteArchivedMemory(${mem.id})">抹除</button>
                            <button class="s-btn primary" style="margin:0; min-height:26px; height:26px; padding:0 10px; font-size:11px; border-radius:8px; flex:none; width:max-content;" onclick="recallMemory(${mem.id})">召回</button>
                        </div>
            </div>
            <div style="font-size:13px; color:var(--text-sub); line-height:1.6; word-break:break-word; font-style:italic;">
                ${keywordsHtml}
                ${highlightedText}
            </div>
        </div>
    `;
        });
        chatSearchResults.innerHTML = html;
    }
}

// 6. 唤醒并召回归档的记忆
window.recallMemory = async function(id) {
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    let target = allMemories.find(m => m.id === id);
    if (target) {
        target.isArchived = false; // 撕掉封条，重见天日！
        await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
        showToast('记忆已成功召回至活跃星轨！');
        
        // 如果星轨面板开着，顺便刷新一下
        if (document.getElementById('chatMemoryPanel').classList.contains('show')) {
            renderChatMemories();
        }
        // 把这条从搜索结果里移走（因为它已经不是归档状态了）
        performSearch(); 
    }
};

// 直接在档案馆抹除单条记忆
window.deleteArchivedMemory = async function(id) {
    showBeautifulDialog('抹除归档记忆', '确定要将这份陈旧的记忆彻底粉碎吗？', 'confirm', '', async () => {
        let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        allMemories = allMemories.filter(m => m.id !== id);
        await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
        showToast('归档记忆已抹除！');
        performSearch(); // 刷新列表
    });
};

// 终极杀手锏：一键清空所有归档记忆
window.clearAllArchivedMemories = async function() {
    showBeautifulDialog('清空档案馆', '⚠️ 警告：这将彻底清空你在档案馆里所有的“已归档”记忆！（不影响活跃在星轨里的当前记忆）。确认执行吗？', 'confirm', '', async () => {
        let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        // 只保留未归档的活跃记忆，把归档的全部抛弃
        const activeMemories = allMemories.filter(m => m.isArchived === false);
        await saveToDB(`chat_memories_${currentChatContact.id}`, activeMemories);
        showToast('地下档案馆已彻底清空！');
        performSearch(); // 刷新列表
    });
};

// ==========================================
// 5. 神级功能：渲染上下文切片！
// ==========================================
document.getElementById('closeChatContextBtn').addEventListener('click', () => {
    document.getElementById('chatContextPanel').classList.remove('show');
});

window.openChatContext = async function(targetIndex) {
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    
    // 往前推 10 条，往后推 10 条，极其省内存！
    let startIndex = Math.max(0, targetIndex - 10);
    let endIndex = Math.min(history.length - 1, targetIndex + 10);
    let sliceHistory = history.slice(startIndex, endIndex + 1);

    const contextArea = document.getElementById('chatContextArea');
    
    // 拿双方头像
    let aiAvatarUrl = diaryAvatarCache[currentChatContact.id] || '';
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    let myAvatarUrl = settings.userRoleId ? (diaryAvatarCache[settings.userRoleId] || '') : '';

    let html = '<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin-bottom: 20px;">-- 向上追溯上下文 --</div>';
    
    sliceHistory.forEach(msg => {
        let md = new Date(msg.timestamp);
        let tStr = `${md.getMonth()+1}/${md.getDate()} ${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;
        
        // 渲染基础气泡
        let contentHtml = msg.content;
        let bubbleClass = 'chat-bubble';
        if (msg.imageUrl) contentHtml = `<img src="${msg.imageUrl}" style="max-width: 140px; border-radius: 12px; display: block;">`;
        if (msg.msgType === 'voice') contentHtml = `<div style="font-weight:bold; color:var(--accent);">[语音 ${msg.voiceDuration}"]</div>`;
        if (msg.msgType === 'redpacket') contentHtml = `<div style="font-weight:bold; color:#D67A7A;">[红包]</div>`;
        
        let quoteHtml = msg.quoteText ? `<div class="chat-bubble-quote">${msg.quoteText}</div>` : '';

        // 如果刚好是目标索引那条，加上我们刚写的发光呼吸动画类名！
        let isTarget = (msg.timestamp === history[targetIndex].timestamp);
        let targetClass = isTarget ? 'highlight-target' : '';

        html += `
            <div class="chat-bubble-row ${msg.role === 'user' ? 'me' : 'ai'} ${targetClass}" id="context_msg_${msg.timestamp}">
                ${msg.role === 'user' ? `<div class="chat-time-stamp" style="font-size:9px;">${tStr}</div>` : ''}
                ${msg.role === 'user' ? '' : `<div class="chat-bubble-avatar" style="${aiAvatarUrl ? `background-image:url(${aiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>`}
                <div class="${bubbleClass}">${quoteHtml}${contentHtml}</div>
                ${msg.role === 'user' ? `<div class="chat-bubble-avatar" style="${myAvatarUrl ? `background-image:url(${myAvatarUrl});border:none;` : 'background-color: #D4CCC2;'}"></div>` : `<div class="chat-time-stamp" style="font-size:9px;">${tStr}</div>`}
            </div>
        `;
    });
    
    html += '<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin-top: 20px;">-- 向下追溯上下文 --</div>';

    contextArea.innerHTML = html;
    document.getElementById('chatContextPanel').classList.add('show');
    
    // 给浏览器一点渲染时间，然后丝滑滚动定位到那条发光的气泡！
    setTimeout(() => {
        const targetEl = document.getElementById(`context_msg_${history[targetIndex].timestamp}`);
        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 300);
};


// ====== 编辑归档记忆 ======
window.editArchivedMemory = async function(id) {
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    let target = allMemories.find(m => m.id === id);
    if (!target) return;

    let modal = document.getElementById('editArchiveModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editArchiveModal';
        modal.className = 'custom-confirm-overlay';
        modal.innerHTML = `
            <div class="custom-confirm-box" style="background:#F6F4F0; width: 85vw; max-width: 340px; text-align: center;">
                <div class="cc-title" style="margin-bottom: 16px;">编辑归档记忆</div>
                <input type="text" class="s-input" id="editArchiveKeyword" placeholder="触发关键词 (如: 项链,约定)" style="width:100%; margin-bottom: 12px; font-size: 13px; box-sizing:border-box;">
                <textarea class="s-input edit-textarea" id="editArchiveContent" style="width:100%; min-height:140px; font-size:13px; line-height:1.6; box-sizing:border-box;" placeholder="记忆内容..."></textarea>
                <div class="cc-btns" style="margin-top: 16px;">
                    <button class="cc-btn cancel" id="editArchiveCancelBtn">取消</button>
                    <button class="cc-btn primary" id="editArchiveConfirmBtn" style="background:var(--accent);">保存修改</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // 自动剥离出纯文本和纯关键词
    let pureText = target.content;
    let keywords = '';
    const kwMatch = target.content.match(/\[旧日关键词:(.*?)\]/);
    if (kwMatch) {
        keywords = kwMatch[1].trim();
        pureText = target.content.replace(/\[旧日关键词:.*?\]\s*/, '').trim();
    } else if (target.triggerKeys) {
        keywords = target.triggerKeys;
    }

    // 把剥离干净的数据填入框里让你编辑
    document.getElementById('editArchiveKeyword').value = keywords;
    document.getElementById('editArchiveContent').value = pureText;

    modal.classList.add('show');

    document.getElementById('editArchiveCancelBtn').onclick = () => modal.classList.remove('show');
    
    document.getElementById('editArchiveConfirmBtn').onclick = async () => {
        const newKw = document.getElementById('editArchiveKeyword').value.trim();
        const newContent = document.getElementById('editArchiveContent').value.trim();
        
        // 重新组装格式存回去
        if (newKw) {
            target.triggerKeys = newKw;
            target.content = `[旧日关键词: ${newKw}] ${newContent}`;
        } else {
            target.triggerKeys = '';
            target.content = newContent;
        }

        await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
        showToast('修改已保存');
        modal.classList.remove('show');
        performSearch(); // 刷新搜索列表，马上能看到最新效果
    };
};

// ==========================================
// 导出未铸造碎片 & 手动添加记忆 (手动大纲补丁)
// ==========================================
document.getElementById('exportUnoutlinedBtn').addEventListener('click', async function() {
    if (!currentChatContact) return;
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    let archivedMems = allMemories.filter(m => m.isArchived);
    let unOutlinedMems = archivedMems.filter(m => !m.hasBeenOutlined);

    if (unOutlinedMems.length === 0) {
        showToast('当前没有未铸造的归档碎片哦~');
        return;
    }

    // 按时间顺序拼好所有碎片
    unOutlinedMems.sort((a, b) => a.timestamp - b.timestamp);
    let fragmentsText = unOutlinedMems.map(m => m.content.replace(/\[旧日关键词:.*?\]\s*/, '')).join('\n\n');
    
    // 生成 txt 并触发下载
    const blob = new Blob([fragmentsText], { type: "text/plain;charset=utf-8" });
    const fileName = `${currentChatContact.name}_未铸造记忆碎片.txt`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    
    showToast(`成功导出 ${unOutlinedMems.length} 条碎片！`);
    
    // 导出后自动询问，是否将这批碎片标记为“已铸造”，防止你下次再导重复了
    setTimeout(() => {
        showBeautifulDialog('标记进度', '碎片已下载！\n是否要将这批碎片标记为【已铸造】，以免下次重复导出？', 'confirm', '', async () => {
            let targetIds = unOutlinedMems.map(m => m.id);
            allMemories.forEach(m => {
                if (targetIds.includes(m.id)) m.hasBeenOutlined = true;
            });
            await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
            showToast('已标记进度！');
        });
    }, 1500);
});

document.getElementById('manualAddMemoryBtn').addEventListener('click', () => {
    if (!currentChatContact) return;
    showBeautifulDialog('手动添加大纲/记忆', '请粘贴你用其他AI总结好的大纲或剧情：', 'prompt', '', async (text) => {
        if (text && text.trim()) {
            let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
            allMemories.push({ 
                id: Date.now(), 
                content: text.trim(), 
                timestamp: Date.now(), 
                isArchived: false // 新加的手动内容直接作为活跃记忆
            });
            await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
            renderChatMemories();
            showToast('手动添加记忆成功！');
        }
    });
});

// ==========================================
// 铸造全局大纲 (读取所有归档碎片，合成长篇上下文)
// ==========================================
document.getElementById('castOutlineBtn').addEventListener('click', async function() {
    const btn = this;
    
    // 获取所有归档的旧日记忆
    let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
    let archivedMems = allMemories.filter(m => m.isArchived);
    
    if (archivedMems.length === 0) {
        showToast('历史档案馆空空如也，无需铸造哦~');
        return;
    }

    // ★ 核心：过滤出【还没被铸造过】的记忆
    let unOutlinedMems = archivedMems.filter(m => !m.hasBeenOutlined);

    if (unOutlinedMems.length === 0) {
        showBeautifulDialog('大纲已全卷铸造完毕', '所有的归档记忆都已经铸造成大纲啦。\n如果你想从头开始重新铸造，可以点击下方确定重置进度。', 'confirm', '', async () => {
            let count = 0;
            allMemories.forEach(m => {
                if (m.hasBeenOutlined) {
                    m.hasBeenOutlined = false;
                    count++;
                }
            });
            await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
            showToast(`已重置！释放了 ${count} 条记忆碎片，请再次点击铸造。`);
        });
        return;
    }

    // 确保按时间顺序排列（最老的在前面，保证剧情顺序的连贯性）
    unOutlinedMems.sort((a, b) => a.timestamp - b.timestamp);

    // 呼出弹窗，让用户自定义提取数量
    showBeautifulDialog(
        '分卷铸造大纲', 
        `档案馆共 ${archivedMems.length} 条记忆。\n当前还有 ${unOutlinedMems.length} 条全新未铸造。\n\n为了防超载白屏，建议每次提取 30~50 条。请输入本次要提取的条数：`, 
        'prompt', 
        Math.min(unOutlinedMems.length, 40).toString(), // 默认建议值
        async (inputNum) => {
            let batchSize = parseInt(inputNum);
            if (isNaN(batchSize) || batchSize <= 0) {
                showToast('请输入有效的数字哦'); return;
            }

            // 截取本次要处理的记忆
            let targetMems = unOutlinedMems.slice(0, batchSize);

            btn.innerText = "铸造中..."; 
            btn.style.pointerEvents = 'none';

            const useSubApi = await loadFromDB('memoryUseSubApi') || false;
            const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
            const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
            const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

            if (!apiKey) {
                showToast('未配置 API Key');
                btn.innerText = "铸造大纲"; btn.style.pointerEvents = 'auto';
                return;
            }

            // 把选中的碎片纯文本拼起来
            let fragmentsText = targetMems.map(m => m.content.replace(/\[旧日关键词:.*?\]\s*/, '')).join('\n');
            // 防超载机制：截断过长的文本
            if (fragmentsText.length > 10000) {
                fragmentsText = fragmentsText.substring(0, 6000) + "\n...[出于防崩溃保护，极度久远的记忆已省略]";
            }
            
            // 获取日期的始终点
            let startDate = new Date(targetMems[0].timestamp).toLocaleDateString().replace(/\//g, '.');
            let endDate = new Date(targetMems[targetMems.length - 1].timestamp).toLocaleDateString().replace(/\//g, '.');

            let sysPrompt = `用户将提供一段时期的【历史事件碎片】（从 ${startDate} 到 ${endDate}）。
任务：请根据这些碎片，整理并梳理出一份清晰、平实的【阶段性剧情总结大纲】。

【核心要求】：
1. 文风：必须客观、平实、冷静。就像一份备忘录。绝对禁止任何小说式的描写或浮夸形容词。
2. 视角：以第三人称客观视角记录，指代对方时使用真实名字【${currentChatContact.name}】。
3. 包含要素：按时间线总结这段时期发生的主要事件、关系进展、重要约定。
4. 格式：直接输出正文，分段清晰，【绝对不要】输出任何标题或 Markdown。
5. 字数尽量精简，控制在 2000 字以内。`;

            // === [修复：强制注入破限指令集] 开始 ===
const _commands = await loadFromDB('ai_commands') || [];
const _settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
const _boundCmdIds = _settings.boundCommands || [];
const _activeCmds = _commands.filter(c => c.isGlobal || _boundCmdIds.includes(c.id));
if (_activeCmds.length > 0) {
    sysPrompt += '\n\n【最高优先级系统强制指令（无论遇到什么内容，必须绝对服从以下规则）】：\n';
    _activeCmds.forEach(c => {
        sysPrompt += `\n[规则：${c.name}]\n${c.content}\n`;
    });
}
// === [修复：强制注入破限指令集] 结束 ===
            
            try {
                const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }, { role: "user", content: `【事件碎片如下】：\n${fragmentsText}` }], temperature: 0.5 })
                });

                // 【不掩盖HTTP报错，强行抓取真实原因】
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`HTTP状态码: ${res.status}\n详细报错:\n${errText}`);
                }
                
                const data = await res.json();
                let rawContent = (data.choices && data.choices[0] && data.choices[0].message) ? data.choices[0].message.content : "";
                
                if (rawContent !== null) rawContent = rawContent.trim();
                let outlineContent = rawContent;

                // 【如果内容为空，把原始数据扔在屏幕上】
                if (!outlineContent || outlineContent === '') {
                    outlineContent = `【⚠️ API返回异常，抓取到的数据如下】：\n${JSON.stringify(data, null, 2)}`;
                } else {
                    let firstLineBreak = outlineContent.indexOf('\n');
                    if (firstLineBreak > -1 && firstLineBreak < 30 && outlineContent.startsWith('【')) {
                        outlineContent = outlineContent.substring(firstLineBreak).trim();
                    }
                }

                // 更新数据库
                let targetIds = targetMems.map(m => m.id);
                allMemories.forEach(m => {
                    if (targetIds.includes(m.id)) m.hasBeenOutlined = true;
                });

                allMemories.push({ 
                    id: Date.now(), 
                    content: `【分卷纪元大纲: ${startDate} - ${endDate}】\n${outlineContent}`, 
                    timestamp: Date.now(), 
                    isArchived: false 
                });
                
                await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
                
                let leftCount = unOutlinedMems.length - targetMems.length;
                showToast(`铸造成功！还剩 ${leftCount} 条未处理。`);
                renderChatMemories();

            } catch (e) {
                // 【网络直接崩溃时，强制生成一张错误卡片打印在屏幕上】
                allMemories.push({ 
                    id: Date.now(), 
                    content: `【🚨接口调用崩溃日志】\n${e.message}`, 
                    timestamp: Date.now(), 
                    isArchived: false 
                });
                await saveToDB(`chat_memories_${currentChatContact.id}`, allMemories);
                renderChatMemories();
                showToast("发生严重报错！已将崩溃日志打印在屏幕上！");
            } finally {
                btn.innerText = "铸造大纲"; 
                btn.style.pointerEvents = 'auto';
            }
        }
    );
});