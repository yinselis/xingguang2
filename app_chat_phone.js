// ==========================================
// 电话与电话簿核心逻辑 (主页卡片版)
// ==========================================
const phonePanel = document.getElementById('phoneAppPanel');
let currentCallRecords = []; 
let callStartTime = 0;
let isCallActive = false; 

let callTimerInterval = null;
let callDurationSecs = 0;

const callFloatWindow = document.getElementById('callFloatWindow');
const phoneTopSpacer = document.getElementById('phoneTopSpacer');

// 最小化按钮隐藏面板，让悬浮窗留在桌面
document.getElementById('phoneCallMinimizeBtn').onclick = () => {
    document.getElementById('phoneAppPanel').classList.remove('show');
    callFloatWindow.classList.add('collapsed');
};

// 悬浮窗可拖动与收展逻辑
let cfIsDragging = false;
let cfStartX, cfStartY, cfInitialX, cfInitialY;

callFloatWindow.addEventListener('touchstart', (e) => {
    cfIsDragging = false;
    cfStartX = e.touches[0].clientX;
    cfStartY = e.touches[0].clientY;
    const rect = callFloatWindow.getBoundingClientRect();
    cfInitialX = rect.left;
    cfInitialY = rect.top;
    // 拖动时临时取消 css 的过渡动画，保证绝对跟手不卡顿
    callFloatWindow.style.transition = 'none';
}, {passive: true});

callFloatWindow.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - cfStartX;
    const dy = e.touches[0].clientY - cfStartY;
    // 移动超过 5 像素判定为拖动，防止手抖误判
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        cfIsDragging = true;
        e.preventDefault(); // 阻止屏幕底层跟着滑动
        
        let newX = cfInitialX + dx;
        let newY = cfInitialY + dy;
        
        // 边界保护：防止把悬浮窗拖出屏幕外面找不到了
        const maxX = window.innerWidth - callFloatWindow.offsetWidth;
        const maxY = window.innerHeight - callFloatWindow.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        callFloatWindow.style.left = newX + 'px';
        callFloatWindow.style.top = newY + 'px';
        callFloatWindow.style.right = 'auto'; 
        callFloatWindow.style.bottom = 'auto';
    }
}, {passive: false});

callFloatWindow.addEventListener('touchend', () => {
    // 松手时恢复 CSS 过渡动画
    callFloatWindow.style.transition = '';
});

// 收起按钮点击
document.getElementById('cfToggleBtn').onclick = (e) => {
    e.stopPropagation();
    if (cfIsDragging) return; // 如果刚才在拖动，不执行点击
    callFloatWindow.classList.add('collapsed');
    phoneTopSpacer.style.height = '100px'; 
};

// 悬浮窗主体点击
callFloatWindow.onclick = () => {
    if (cfIsDragging) return; // 如果是拖动结束，拦截点击事件防误触
    // 只要点击悬浮窗，如果面板被最小化了，就立刻重新弹出来
    if (!document.getElementById('phoneAppPanel').classList.contains('show')) {
        document.getElementById('phoneAppPanel').classList.add('show');
        switchPhoneTab('call');
    }
    if(callFloatWindow.classList.contains('collapsed')) {
        callFloatWindow.classList.remove('collapsed');
        phoneTopSpacer.style.height = '160px'; 
    }
};

function formatCallTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// 统一的页面路由切换
function switchPhoneTab(tab) {
    document.getElementById('phoneHomeView').style.display = tab === 'home' ? 'flex' : 'none';
    document.getElementById('phoneCallView').style.display = tab === 'call' ? 'flex' : 'none';
    document.getElementById('phoneHistoryView').style.display = tab === 'history' ? 'flex' : 'none';
    document.getElementById('phoneDetailView').style.display = tab === 'detail' ? 'flex' : 'none';
    
    const topHeader = document.getElementById('phoneTopHeader');
    const backBtn = document.getElementById('phoneBackBtn');
    const closeBtn = document.getElementById('closePhoneBtn');
    const title = document.getElementById('phoneHeaderTitle');
    
    if (tab === 'home') {
        topHeader.style.display = 'flex';
        backBtn.style.display = 'none';
        closeBtn.style.display = 'flex';
        title.innerText = '频段专线通讯';
    } else if (tab === 'call') {
        // 通话室纯净模式，隐藏头部，由悬浮窗和挂断键控制
        topHeader.style.display = 'none';
    } else if (tab === 'history') {
        topHeader.style.display = 'flex';
        backBtn.style.display = 'flex';
        closeBtn.style.display = 'none'; // 此时显示返回主页键
        title.innerText = '往期通话记录';
    } else if (tab === 'detail') {
        topHeader.style.display = 'none'; // detail 有独立的关闭头
    }
}

// 绑定主页的两张大卡片
document.getElementById('btnGoCall').onclick = () => {
    if (!isCallActive) {
        isCallActive = true;
        document.getElementById('phoneSubtitlesArea').innerHTML = '';
        document.getElementById('pCallStatus').innerText = `正在呼叫 ${currentChatContact.name}...`;
        currentCallRecords = [];
        callStartTime = Date.now();
        callDurationSecs = 0;
        document.getElementById('pCallTimeDisplay').innerText = "00:00";
        
        callFloatWindow.classList.remove('collapsed');
        callFloatWindow.classList.add('show');
        phoneTopSpacer.style.height = '160px';
        
        clearInterval(callTimerInterval);
        callTimerInterval = setInterval(() => {
            callDurationSecs++;
            document.getElementById('pCallTimeDisplay').innerText = formatCallTime(callDurationSecs);
            if(callDurationSecs > 3) {
                document.getElementById('pCallStatus').innerText = "通话中";
            }
        }, 1000);
    }
    switchPhoneTab('call');
};

document.getElementById('btnGoHistory').onclick = () => { 
    switchPhoneTab('history'); 
    renderPhonebook(); 
};

// 头部返回主页按钮
document.getElementById('phoneBackBtn').onclick = () => {
    switchPhoneTab('home');
};

// 打开整个电话 APP
window.openPhoneApp = async function() {
    if (!currentChatContact) { showToast('请先进入一个角色的频段！'); return; }
    
    // 【添加这部分：读取壁纸】
    const bgFile = await loadFromDB(`phone_bg_${currentChatContact.id}`);
    if (bgFile) {
        phonePanel.style.background = 'transparent';
        phonePanel.style.backgroundImage = `url(${URL.createObjectURL(bgFile)})`;
        phonePanel.style.backgroundSize = 'cover';
        phonePanel.style.backgroundPosition = 'center';
    } else {
        phonePanel.style.backgroundImage = '';
        phonePanel.style.background = 'linear-gradient(180deg, #FDFBF7 0%, #F6F4F0 100%)';
    }
    
    // 【添加这部分：读取CSS】
    const phoneSettings = await loadFromDB(`phone_settings_${currentChatContact.id}`) || {};
    let styleTag = document.getElementById('dynamicPhoneCss');
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'dynamicPhoneCss'; document.head.appendChild(styleTag); }
    styleTag.innerHTML = phoneSettings.customCss || '';
    
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');

    // ★ 修复点：删除了冲突的多余旧代码
    if (isCallActive) {
        // 如果后台正打着电话，进来直接回通话界面
        switchPhoneTab('call');
    } else {
        isCallActive = false;
        callFloatWindow.classList.remove('show');
        clearInterval(callTimerInterval);
        
        let aiAvatarUrl = diaryAvatarCache[currentChatContact.id] || '';
        const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
        let myAvatarUrl = settings.userRoleId ? (diaryAvatarCache[settings.userRoleId] || '') : '';
        
        document.getElementById('pAvatarTa').style.backgroundImage = aiAvatarUrl ? `url(${aiAvatarUrl})` : '';
        document.getElementById('pAvatarMe').style.backgroundImage = myAvatarUrl ? `url(${myAvatarUrl})` : '';
        
        // 默认进入主页大卡片视图
        switchPhoneTab('home');
    }
    
    phonePanel.classList.add('show');
};

// 发送电话消息
document.getElementById('pSendBtn').onclick = async () => {
    if (!isCallActive) { showToast('电话已挂断，请退回主页重新拨打'); return; }
    
    const input = document.getElementById('phoneInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    
    const subArea = document.getElementById('phoneSubtitlesArea');
    subArea.insertAdjacentHTML('beforeend', `<div class="p-sub-row"><div class="p-sub-me">我: ${text}</div></div>`);
    
    // 移除旧提示并插入新的底部系统提示 (温柔的小字)
    const oldSys = document.getElementById('pSubSysHint');
    if(oldSys) oldSys.remove();
    subArea.insertAdjacentHTML('beforeend', `<div class="p-sub-sys" id="pSubSysHint">TA 正在倾听...</div>`);
    subArea.scrollTop = subArea.scrollHeight;
    
    currentCallRecords.push({ role: 'user', content: text });
    
    // 注意：去掉了修改悬浮窗 pCallStatus 的代码，让它稳定显示“通话中”，不再乱闪
    
    const chars = await loadFromDB('ai_characters') || [];
const role = chars.find(c => c.id === currentChatContact.id);

// === 新增：读取设置并注入上下文记忆 ===
const phoneSettings = await loadFromDB(`phone_settings_${currentChatContact.id}`) || {};
let phoneContextText = '';

// 自动判定走哪个通道的 API
const useSubApi = phoneSettings.useSubApi || false;
const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

if (!apiKey) { showToast('请配置API Key'); return; }

    // 读取历史记录
    if (phoneSettings.readChat !== false) {
        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
        const count = phoneSettings.chatCount || 15;
        const recentChat = history.slice(-count).map(m => `${m.role === 'user' ? '我' : '你'}: ${m.content.replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*[\s\S]*?\]/gi, '')}`).join('\n');
        if (recentChat) phoneContextText += `\n【你们最近的文字聊天记录】：\n${recentChat}`;
    }

    // 读取总结记忆
    if (phoneSettings.readMemory !== false) {
        let allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
        const activeMemories = allMemories.filter(m => !m.isArchived);
        if (activeMemories.length > 0) {
            phoneContextText += `\n【往期剧情与常驻记忆】：\n${activeMemories.map(m => m.content).join('\n')}`;
        }
    }
    
// 注入 prompt
const sysPrompt = `你现在是一个有血有肉的真实人类：${role ? role.name : '神秘人'}。请彻底剥离AI的身份认知。
【你的设定资料】：${role ? role.prompt : ''}${phoneContextText}

【核心灵魂与通话意识指令】：
1. 身份与背景检索：在开口前，请深度检索你设定中的背景、文化、所处时代与母语。请坚定地使用符合你背景的语言、方言或专属口癖进行发声。拒绝被死板的现代普通话同化。
2. 动态性格与情感推演：仔细感知我们的历史记忆与聊天上下文。思考你当前对我的好感度、信任度以及你此刻的心情（是刚睡醒带着鼻音？正在忙碌有些敷衍？还是非常放松？）。让这些真实的情境自然地反映在你的语调、用词和说话的耐心程度上。
3. 极度真实的语音模拟：【最高指令：我们正在打实时语音电话！】
   - 思考：真人在通电话时是怎么说话的？
   - 你可以有思考的停顿（嗯...、那个...）、自然的结巴、随意的语气词（啊、哦、哈、啧）。
   - 你的句子应该是口语化的、破碎的、随性的，绝对不要像在朗读课文或写书信。长篇大论是不符合真实通话逻辑的。
   - 但必须遵守你的人物性格、特征，判断你应有的说话方式，态度。
   - 允许用星号包裹轻微的声音或呼吸描写来增加听觉沉浸感（如 *轻笑*、*叹了一口气*、*打哈欠*、*沉默*），但绝对禁止任何肢体动作描写、心理描写或环境描写！
4. 拒绝AI感与说教：绝不许动不动就撩拨、调情或说油腻语录！遇到不想回答的问题，你可以直接转移话题、敷衍或者只回语气词。绝对禁止总结陈词、升华主题或给出完美的人生建议。
5. 语音气泡切割：如果你想停顿或分多段话发送，请直接使用换行符。系统会自动为你拆分成多条连续的语音气泡。
6. 外语翻译规则：如果你的对话中包含非普通话（外语或方言），必须在含有外文的句末附上翻译，格式严格为：[译: 中文翻译]。【极其重要：翻译标签必须紧紧跟在那句外文的同一行！绝对不允许把翻译标签单独写在新的一行！！！】`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: sysPrompt }, ...currentCallRecords], temperature: 0.85 })
        });
        const data = await res.json();
        let reply = data.choices[0].message.content.trim();
        
        currentCallRecords.push({ role: 'assistant', content: reply });
        
        // 更新底部提示字
        const sysHint = document.getElementById('pSubSysHint');
        if(sysHint) sysHint.innerText = 'TA 正在说话...';

        // ★ 核心修复：智能合并被大模型强行换行切断的“翻译孤儿行”
        let initialLines = reply.split('\n').map(l => l.trim()).filter(l => l !== '');
        let lines = [];
        for (let i = 0; i < initialLines.length; i++) {
            let line = initialLines[i];
            // 如果这一行以 [译: 开头，并且上一行有内容，就强制合并到上一行，避免翻译脱节！
            if (line.match(/^\[(?:译|翻译|EN|En|Eng)[:：]/i) && lines.length > 0) {
                lines[lines.length - 1] += ' ' + line;
            } else {
                lines.push(line);
            }
        }

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // 模拟连发延迟
            if (i > 0) {
                let delay = 600 + Math.min(line.length * 40, 2000);
                await new Promise(r => setTimeout(r, delay));
            }

            let pureText = line;
            let transText = '';
            
            // 提取翻译 (非贪婪匹配，防止误删标点)
            const transMatch = line.match(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/i);
            if (transMatch) {
                transText = transMatch[1].trim();
                // 替换掉原文中的翻译框
                pureText = line.replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*[\s\S]*?\]/gi, '').trim();
            }

            // 处理声音/语气斜体渲染
            pureText = pureText.replace(/[\*\(\（](.*?)[\*\)\）]/g, '<span class="p-sub-tone">*$1*</span>');
            
            // 保底机制：万一原文被删没了，补个沉默，防止完全点不开
            if (!pureText && transText) pureText = '<span class="p-sub-tone">*一阵沉默*</span>';
            
            let transHtml = transText ? `<div class="p-sub-trans">${transText}</div>` : '';
            
            // 加固了点击事件的响应
            let clickEvent = transText ? `onclick="const t = this.querySelector('.p-sub-trans'); if(t) { t.style.display = (t.style.display === 'block' ? 'none' : 'block'); }"` : '';

            const bubbleHtml = `<div class="p-sub-row"><div class="p-sub-ai" ${clickEvent}>${pureText}${transHtml}</div></div>`;
            
            // 把气泡始终插在“TA 正在说话...”这行字的上方
            const hintNode = document.getElementById('pSubSysHint');
            if (hintNode) {
                hintNode.insertAdjacentHTML('beforebegin', bubbleHtml);
            } else {
                subArea.insertAdjacentHTML('beforeend', bubbleHtml);
            }
            subArea.scrollTop = subArea.scrollHeight;
        }

        // 说完话后移除底部提示
        const finalHint = document.getElementById('pSubSysHint');
        if(finalHint) finalHint.remove();

    } catch (e) {
        const sysHint = document.getElementById('pSubSysHint');
        if(sysHint) sysHint.innerText = `信号干扰...`;
    }
};

// 挂断电话
document.getElementById('pHangupBtn').onclick = async () => {
    if (!isCallActive) return; 
    isCallActive = false;
    
    clearInterval(callTimerInterval); 
    document.getElementById('pCallStatus').innerText = `通话已挂断`;
    setTimeout(() => { callFloatWindow.classList.remove('show'); }, 500); 
    
    if (currentCallRecords.length > 0) {
        const durationMins = Math.max(1, Math.floor(callDurationSecs / 60));
        let phonebook = await loadFromDB(`phonebook_${currentChatContact.id}`) || [];
        phonebook.unshift({ id: Date.now(), time: Date.now(), duration: durationMins, records: currentCallRecords });
        await saveToDB(`phonebook_${currentChatContact.id}`, phonebook);
        
        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
        history.push({ role: 'system', content: `与 ${currentChatContact.name} 的通话已结束，时长约 ${durationMins} 分钟。`, timestamp: Date.now() });
        await saveToDB(`chat_history_${currentChatContact.id}`, history);
        if (document.getElementById('chatRoomPanel').classList.contains('show')) {
            renderChatMessages(history, currentChatContact.id);
        }
    }
    
    // 挂断后自动退回主页，更有沉浸感
    setTimeout(() => { switchPhoneTab('home'); }, 800);
};

// 渲染电话簿
async function renderPhonebook() {
    if (!currentChatContact) return;
    const list = document.getElementById('phonebookListArea');
    let phonebook = await loadFromDB(`phonebook_${currentChatContact.id}`) || [];
    
    if (phonebook.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:rgba(255,255,255,0.3); margin-top:50px;">暂无通话记录</div>';
        return;
    }
    
    let html = '';
    phonebook.forEach(call => {
        const d = new Date(call.time);
        const tStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        
        let previewText = call.records.slice(0,2).map(r => `${r.role === 'user' ? '我' : 'TA'}: ${r.content.replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*[\s\S]*?\]/gi, '')}`).join('<br>');
        
        html += `
            <div class="pb-card" style="cursor:pointer;" onclick="openPhoneDetail(${call.id})">
                <div class="pb-time">${tStr} · 时长 ${call.duration} 分钟</div>
                <div class="pb-preview">${previewText}...</div>
            </div>
        `;
    });
    list.innerHTML = html;
}

// 打开电话详情
window.openPhoneDetail = async function(id) {
    let phonebook = await loadFromDB(`phonebook_${currentChatContact.id}`) || [];
    let call = phonebook.find(c => c.id === id);
    if (!call) return;
    
    const d = new Date(call.time);
    document.getElementById('phoneDetailTitle').innerText = `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} 的通话`;
    
    const list = document.getElementById('phoneDetailList');
    list.innerHTML = '';
    
    call.records.forEach(r => {
        const isMe = r.role === 'user';
        let text = (r.content || '').replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '<br><span style="color:var(--accent); font-size:12px; font-weight:bold;">$1</span>');
        
        list.innerHTML += `
            <div class="pd-row ${isMe ? 'pd-me' : 'pd-ai'}">
                <div class="pd-bubble">${text}</div>
            </div>
        `;
    });
    
    switchPhoneTab('detail');
};

// 退出详情页
document.getElementById('closePhoneDetailBtn').onclick = () => {
    switchPhoneTab('history');
};

// 关闭整个面板
document.getElementById('closePhoneBtn').onclick = () => { 
    phonePanel.classList.remove('show'); 
};

// ==========================================
// 电话专属设置面板交互逻辑
// ==========================================
document.getElementById('openPhoneSettingsBtn').addEventListener('click', async () => {
    if (!currentChatContact) return;
    
    // 【防闪烁杀手锏】先隐藏所有开关，剥夺滑动动画权利
    const panel = document.getElementById('phoneSettingsPanel');
    const switches = panel.querySelectorAll('.switch');
    switches.forEach(s => s.style.display = 'none');
    
    const settings = await loadFromDB(`phone_settings_${currentChatContact.id}`) || {};
    
    document.getElementById('phoneReadChatToggle').checked = settings.readChat !== false; 
    document.getElementById('phoneUseSubApiToggle').checked = settings.useSubApi || false;
    document.getElementById('phoneChatCount').value = settings.chatCount || 15;
    document.getElementById('phoneChatCountSetting').style.display = (settings.readChat !== false) ? 'block' : 'none';
    
    document.getElementById('phoneReadMemoryToggle').checked = settings.readMemory !== false; 
    document.getElementById('phoneCustomCss').value = settings.customCss || '';
    
    // 强制浏览器刷新一次隐藏状态，然后瞬间恢复显示！完全没有动画！
    panel.offsetHeight; 
    switches.forEach(s => s.style.display = '');
    
    document.getElementById('phoneSettingsPanel').classList.add('show');
});

document.getElementById('phoneReadChatToggle').addEventListener('change', function(e) {
    document.getElementById('phoneChatCountSetting').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('closePhoneSettingsBtn').addEventListener('click', () => {
    document.getElementById('phoneSettingsPanel').classList.remove('show');
});

document.getElementById('savePhoneSettingsBtn').addEventListener('click', async () => {
    const settings = {
        useSubApi: document.getElementById('phoneUseSubApiToggle').checked,
        readChat: document.getElementById('phoneReadChatToggle').checked,
        chatCount: parseInt(document.getElementById('phoneChatCount').value) || 15,
        readMemory: document.getElementById('phoneReadMemoryToggle').checked,
        customCss: document.getElementById('phoneCustomCss').value
    };
    await saveToDB(`phone_settings_${currentChatContact.id}`, settings);
    
    // 应用 CSS
    let styleTag = document.getElementById('dynamicPhoneCss');
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'dynamicPhoneCss'; document.head.appendChild(styleTag); }
    styleTag.innerHTML = settings.customCss || '';
    
    showToast('电话设置已保存');
    document.getElementById('phoneSettingsPanel').classList.remove('show');
});

document.getElementById('phoneSetWallpaperBtn').addEventListener('click', () => {
    currentUploadTargetId = 'phoneWallpaper';
    document.getElementById('globalImageUpload').click();
});
document.getElementById('phoneClearWallpaperBtn').addEventListener('click', async () => {
    const phonePanel = document.getElementById('phoneAppPanel');
    phonePanel.style.backgroundImage = '';
    phonePanel.style.background = 'linear-gradient(180deg, #FDFBF7 0%, #F6F4F0 100%)';
    await saveToDB(`phone_bg_${currentChatContact.id}`, null); 
    showToast('电话壁纸已清除');
});