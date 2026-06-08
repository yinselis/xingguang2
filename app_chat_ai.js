async function fetchChatAPI(contactId, history) {
// === 拦截：如果是群聊，走专门的群聊通道 ===
let contacts = await loadFromDB('chat_contacts') || [];
let contactInfo = contacts.find(c => c.id === contactId);
if (contactInfo && contactInfo.isGroup) {
    return fetchGroupChatAPI(contactId, history, contactInfo);
}
// ======================================
    const area = document.getElementById('chatMessageArea');
    let aiAvatarUrl = diaryAvatarCache[contactId] || '';
    
    // 封装正在输入的打字状态显隐函数
    const showTyping = () => {
        if (document.getElementById('chatLoadingBubble')) return; // 防重复
        const loadingHtml = `
            <div class="chat-bubble-row ai" id="chatLoadingBubble">
                <div class="chat-bubble-avatar" style="${aiAvatarUrl ? `background-image:url(${aiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>
                <div class="chat-bubble"><span style="color:var(--text-sub);font-size:13.5px;font-style:italic;letter-spacing:0.5px;">TA 正在输入...</span></div>
            </div>
        `;
        area.insertAdjacentHTML('beforeend', loadingHtml);
        area.scrollTop = area.scrollHeight;
    };
    
    const hideTyping = () => {
        document.getElementById('chatLoadingBubble')?.remove();
    };

// === 拦截器：检查日程表是否允许回复 ===
const aiName = document.getElementById('chatRoomTitle').innerText || 'TA';
const schedSettings = await loadFromDB(`chat_schedule_${contactId}`) || {};
if (schedSettings.enabled) {
    const status = checkIsOnline(schedSettings.schedule);
    const area = document.getElementById('chatMessageArea');
    if (status.status === 'offline') {
        // 红灯离线：插入系统消息，并拦截回复
        area.insertAdjacentHTML('beforeend', `<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin: 12px 0; font-weight: 600; letter-spacing: 1px;">${aiName} 已离线</div>`);
        area.scrollTop = area.scrollHeight;
        return;
    } else if (status.status === 'busy') {
        // 黄灯忙碌：插入系统消息，AI 依然会继续回复
        area.insertAdjacentHTML('beforeend', `<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin: 12px 0; font-weight: 600; letter-spacing: 1px;">${aiName} 正在忙碌</div>`);
        area.scrollTop = area.scrollHeight;
    }
}
    
    // 刚发起请求时，立刻显示“正在输入...”
    showTyping();

    const useSubApi = await loadFromDB('chatUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if (!apiKey) {
        hideTyping();
        showToast('请先去设置中填写主节点 API Key！');
        return;
    }

    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === contactId);
    
    // 替换为动态构建的提示词（包含用户画像、连发要求等）
    const systemPrompt = await buildChatSystemPrompt(history);
    
    // 获取动态记忆上下文条数
    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    const contextCount = settings.contextCount || 15;

    const contextHistory = history.slice(-contextCount).map(m => {
let textContent = m.content;
if (m.msgType === 'diary_invite') textContent = `[发送了交换日记的邀请，附言："${m.content}"]`;
if (m.msgType === 'forward_card') {
    let fwDetail = (m.forwardData || []).map(f => {
        let n = f.role === 'user' ? '我' : (f.speakerName || 'TA');
        let c = f.content || '[图片/特殊消息]';
        return `${n}: ${c}`;
    }).join(' | ');
    textContent = `[发送了一份合并聊天记录卡片，内含如下历史对话：{ ${fwDetail} }]`;
}
if (m.quoteText) textContent = `[引用回复了你的消息: "${m.quoteText}"]\n` + textContent;

    // ★给每条消息打上精确时间戳
    let timeLabel = '';
    if (m.timestamp) {
        let d = new Date(m.timestamp);
        let mm = (d.getMonth()+1).toString().padStart(2,'0');
        let dd = d.getDate().toString().padStart(2,'0');
        let hh = d.getHours().toString().padStart(2,'0');
        let mins = d.getMinutes().toString().padStart(2,'0');
        timeLabel = `[${mm}月${dd}日 ${hh}:${mins}] `;
    }
    textContent = timeLabel + textContent;
    
    if (m.imageUrl) {
        return {
            role: m.role,
            content: [
                { type: "text", text: textContent },
                { type: "image_url", image_url: { url: m.imageUrl } }
            ]
        };
    }
    return { role: m.role, content: textContent };
});
const messages = [{ role: 'system', content: systemPrompt }, ...contextHistory];

// 读取你在系统设置里保存的温度 (Temp)
const savedTemp = await loadFromDB('sysTemp');
const tempValue = (savedTemp !== undefined && savedTemp !== null) ? parseFloat(savedTemp) : 0.85;

try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        // 将发散度绑定为你设置的 Temp 值
        body: JSON.stringify({ model, messages, temperature: tempValue })
    });
        
if (!response.ok) {
    const errData = await response.text();
    throw new Error(`HTTP状态码 ${response.status} | 详细原因: ${errData}`);
}

const data = await response.json();

// 👇 新增：精准抓取官方 API 本次请求的真实 Token 消耗
if (data.usage) {
    let actualTokens = data.usage.total_tokens || 0;
    let promptTokens = data.usage.prompt_tokens || 0;
    await saveToDB(`last_actual_tokens_${contactId}`, { total: actualTokens, prompt: promptTokens });
}

let reply = data.choices[0].message.content.trim();
reply = reply.replace(/\[\d{1,2}月\d{1,2}日 \d{1,2}:\d{2}\]\s*/g, '');
        
// === 新增：全局提取当轮心声（保证所有切分出的气泡都能共享） ===
let turnInnerVoice = null;
const globalVoiceMatch = reply.match(/\[心声[:：]\s*([\s\S]*?)\]/i);
if (globalVoiceMatch) {
    turnInnerVoice = globalVoiceMatch[1].trim();
    reply = reply.replace(/\[心声[:：]\s*[\s\S]*?\]/i, '').trim();
}

// === 终极防粘连切分逻辑 (完美兼容笨模型) ===
const safeReply = reply.replace(/(\[(QUOTE|LOCATION|REDPACKET|VOICE|DIARY_INVITE):.*?\])\s*\n+/gi, '$1 ');

let lines = [];

// 1. 如果模型听话，使用了 [气泡] 标记，就用气泡标记来切西瓜
if (safeReply.includes('[气泡]')) {
    lines = safeReply.split(/\[气泡\]/).map(s => s.trim()).filter(s => s !== '');
} 
// 2. 如果模型完全不听话，没打标记，甚至连换行都不打（大段落粘连发病期）
else {
    // 先尝试按普通的换行切一下
    lines = safeReply.split('\n').map(s => s.trim()).filter(s => s !== '');
    
    // 【终极防线】：如果切完之后只有1条，且字数很长(大于30字)，说明模型吐了一大坨文字！
    // 此时触发强制标点切分大法，强行把它切成微信短句！
    if (lines.length === 1 && lines[0].length > 30) {
        // 在句号、感叹号、问号、波浪号后面强制切开（保留标点符号）
        let forceSplitRegex = /([^。！？~…]+[。！？~…]+)/g;
        let matched = lines[0].match(forceSplitRegex);
        if (matched && matched.length > 1) {
            lines = matched.map(s => s.trim()).filter(s => s !== '');
        }
    }
}
// ============================================

// 模拟真人发微信，根据字数动态延迟，一条一条连发！
for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/\[气泡\]/g, '').trim(); // 清理残留标记
    if (!line) continue; // 防止出现空心气泡
    
    // 除了第一条，后面的每条都要模拟打字延迟
    if (i > 0) {
        let delay = 600 + Math.min(line.length * 60, 2500);
        await new Promise(r => setTimeout(r, delay));
    }
            
// == 开始替换为这段解析代码 ==
let msgType = 'text';
let voiceDur = 0;
let rpAmt = 0;
let locName = '';
let cleanText = line;
let quoteText = null;

// 解析 AI 对日记邀请的自动回应
const aiDiaryRespMatch = cleanText.match(/\[日记(同意|拒绝)\]/i);
if (aiDiaryRespMatch) {
    const isAgree = aiDiaryRespMatch[1] === '同意';
if (isAgree) {
    let days = await loadFromDB(`pending_diary_days_${contactId}`) || 7;
    let books = await loadFromDB(`diary_books_${contactId}`) || [];
    // 兼容老数据迁移
    if (books.length === 0) {
        let oldAg = await loadFromDB(`diary_agreement_${contactId}`);
        if (oldAg) {
            let oldName = await loadFromDB(`diary_book_name_${contactId}`) || '交换日记';
            books.push({ id: 'default', name: oldName, days: oldAg.days||7, startTime: oldAg.startTime });
        }
    }
    // 添加一本全新从0起算的日记本！
    books.push({ id: 'book_'+Date.now(), name: '新交换日记', days: days, startTime: Date.now() });
    await saveToDB(`diary_books_${contactId}`, books);
    
    // 为了防止老系统崩溃，顺带写一份假契约安抚它
    saveToDB(`diary_agreement_${contactId}`, { agreed: true, days: days, startTime: Date.now() });
}
const aiName = document.getElementById('chatRoomTitle').innerText || 'TA';
    const sysText = isAgree ? `${aiName} 同意了你的日记邀请` : `${aiName} 婉拒了你的日记邀请`;
    const tsSys = Date.now() + i + 50;
    
    // 存入历史记录
    history.push({ role: 'system', content: sysText, timestamp: tsSys });
    
    // 在界面上渲染灰色小字
    const loadingEl = document.getElementById('chatLoadingBubble');
const sysHtml = `<div class="chat-system-msg" data-ts="${tsSys}"><span class="chat-system-msg-text">${sysText}</span></div>`;
if (loadingEl) loadingEl.insertAdjacentHTML('beforebegin', sysHtml);
else document.getElementById('chatMessageArea').insertAdjacentHTML('beforeend', sysHtml);
    
    // 把暗号从 AI 的气泡里抹掉
    cleanText = cleanText.replace(/\[日记(同意|拒绝)\]/i, '').trim();
    if (!cleanText) {
        document.getElementById('chatMessageArea').scrollTop = document.getElementById('chatMessageArea').scrollHeight;
        continue;
    }
}

// 解析 AI 发出的戳一戳动作
const aiPokeMatch = cleanText.match(/\[POKE:(.*?)\]/i);
if (aiPokeMatch) {
    const pokeText = aiPokeMatch[1].trim();
    const tsPoke = Date.now() + i;
    history.push({ role: 'system', content: pokeText, timestamp: tsPoke });
    await saveToDB(`chat_history_${contactId}`, history);
    
    const loadingEl = document.getElementById('chatLoadingBubble');
const sysHtml = `<div class="chat-system-msg" data-ts="${tsPoke}"><span class="chat-system-msg-text">${pokeText}</span></div>`;
if (loadingEl) loadingEl.insertAdjacentHTML('beforebegin', sysHtml);
else document.getElementById('chatMessageArea').insertAdjacentHTML('beforeend', sysHtml);
    
    cleanText = cleanText.replace(/\[POKE:.*?\]/i, '').trim();
    if (!cleanText) {
        document.getElementById('chatMessageArea').scrollTop = document.getElementById('chatMessageArea').scrollHeight;
        continue;
    }
}

const quoteMatch = cleanText.match(/\[QUOTE:(.*?)\]([\s\S]*)/i);
if (quoteMatch) {
    quoteText = quoteMatch[1].trim();
    cleanText = quoteMatch[2].trim();
}

const voiceMatch = cleanText.match(/\[VOICE:(\d+)\](.*)/i);
const rpMatch = line.match(/\[REDPACKET:([\d\.]+)\](.*)/i);
const locMatch = cleanText.match(/\[LOCATION:(.*?)\](.*)/i);
const inviteMatch = cleanText.match(/\[DIARY_INVITE:(.*?)\](.*)/i);
let proposedName = '';

if (voiceMatch) { msgType = 'voice'; voiceDur = parseInt(voiceMatch[1]); cleanText = voiceMatch[2].trim(); } 
else if (rpMatch) { msgType = 'redpacket'; rpAmt = parseFloat(rpMatch[1]); cleanText = rpMatch[2].trim(); }
else if (locMatch) { msgType = 'location'; locName = locMatch[1].trim(); cleanText = locMatch[2].trim(); }
else if (inviteMatch) { msgType = 'diary_invite'; cleanText = inviteMatch[1].trim(); }
else if (cleanText.includes('[日记提议:')) {
    const match = cleanText.match(/\[日记提议:(.*?)\]([\s\S]*)/i);
    if (match) { msgType = 'rename_proposal'; proposedName = match[1].trim(); cleanText = match[2].trim(); }
}

const ts = Date.now();
history.push({ 
    role: 'assistant', 
    speakerId: typeof speakerInfo !== 'undefined' ? speakerInfo.id : undefined, 
    speakerName: typeof speakerName !== 'undefined' ? speakerName : undefined, 
    content: cleanText, 
    msgType: msgType, 
    voiceDuration: voiceDur, 
    rpAmount: rpAmt, 
    locationName: locName, 
    quoteText: quoteText, 
    proposedName: proposedName, 
    innerVoice: turnInnerVoice,
    timestamp: ts 
});
await saveToDB(`chat_history_${contactId}`, history);

// --- 改为局部追加，避免闪屏 ---
let md = new Date(ts);
let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;

// ★新增：AI单聊回复时，只要跨天就弹日期
let dateDividerHtml = '';
if (i === 0) {
    let lastMsgTs = history.length > 1 ? history[history.length - 2].timestamp : 0;
    if (lastMsgTs) {
        let lastD = new Date(lastMsgTs);
        if (lastD.getDate() !== md.getDate() || lastD.getMonth() !== md.getMonth() || lastD.getFullYear() !== md.getFullYear()) {
            dateDividerHtml = `<div class="chat-system-msg"><span class="chat-system-msg-text" style="background: transparent; color: var(--text-sub); opacity: 0.7; font-weight: bold; font-size: 11px;">${md.getFullYear()}年${md.getMonth() + 1}月${md.getDate()}日</span></div>`;
        }
    }
}

let timeHtml = `<div class="chat-time-stamp" ${['voice', 'redpacket', 'location', 'diary_invite', 'forward_card'].includes(msgType) ? 'style="display:none;"' : ''}>${tStr}</div>`;
let innerTimeHtml = `<div class="chat-time-stamp" style="margin: 0 4px; align-self: flex-end; padding-bottom: 2px;">${tStr}</div>`;
let formattedCleanText = (cleanText || '').replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '<div class="bilingual-trans">$1</div>');
formattedCleanText = formattedCleanText.replace(/\[图片[:：]\s*([\s\S]*?)\]/gi, '<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">$1</div></div>');

// 解析表情包
const allStickerGroupsAPI = await loadFromDB('sticker_groups') || [];
const allStickersAPI = allStickerGroupsAPI.flatMap(g => g.stickers);

let isPureStickerAPI = false;
let stickerUrlAPI = '';
const stickerMatchAPI = cleanText.match(/^\[表情包[:：](.*?)\]$/i);
if (stickerMatchAPI) {
    const sticker = allStickersAPI.find(s => s.name === stickerMatchAPI[1].trim());
    if (sticker) {
        isPureStickerAPI = true;
        stickerUrlAPI = sticker.url;
    }
}

let isPureFakeImgAPI = false;
let fakeImgDescAPI = '';
const fakeImgMatchAPI = cleanText.match(/^\[图片[:：]\s*([\s\S]*?)\]$/i);
if (fakeImgMatchAPI) {
    isPureFakeImgAPI = true;
    fakeImgDescAPI = fakeImgMatchAPI[1].trim();
}

// 【升级版容错拦截】
formattedCleanText = formattedCleanText.replace(/[\(（]【?发送了?表情包[:：]?\s*(.*?)】?[\)）]/g, '[表情包:$1]');
formattedCleanText = formattedCleanText.replace(/\[\[STICKER:(.*?)\]\]/gi, '[表情包:$1]');

formattedCleanText = formattedCleanText.replace(/\[表情包[:：](.*?)\]/gi, (match, name) => {
    let cleanName = name.split(/[\/\-：:]/).pop().trim();
    // 模糊匹配
    const sticker = allStickersAPI.find(s => s.name === cleanName || name.includes(s.name) || s.name.includes(cleanName));
    if (sticker) {
        return `<img src="${sticker.url}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 4px 0;">`;
    }
    return `<span style="color:var(--text-sub); font-style:italic;">（发送了表情包：${name}）</span>`;
});
    
let contentHtml = '';
let bubbleStyle = '';

if (msgType === 'voice') {
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px;">
            <div class="chat-voice-bubble" onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                <span>${voiceDur}"</span>
            </div>
            ${innerTimeHtml}
        </div>
        <div class="chat-voice-trans" style="display:none;">${formattedCleanText}</div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (msgType === 'redpacket') {
    const safeContent = (cleanText || '心意红包').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px;">
            <div class="chat-rp-bubble" onclick="openRedPacketModal(this, '${safeContent}', ${rpAmt})" style="cursor:pointer;">
                <div class="rp-top">
                    <div class="rp-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><circle cx="12" cy="14" r="3"></circle><path d="M4 8h16"></path></svg></div>
                    <div class="rp-info">
                        <div class="rp-msg">${cleanText}</div>
                        <div class="rp-amt">查看红包</div>
                    </div>
                </div>
                <div class="rp-bottom">LUMINA TRANSFER</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (msgType === 'location') {
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px;">
            <div class="chat-location-bubble">
                <div class="loc-top">
                    <div class="loc-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>
                    <div class="loc-info"><div class="loc-name">${locName}</div></div>
                </div>
                <div class="loc-desc">${cleanText}</div>
                <div class="loc-bottom">LUMINA MAPS</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (msgType === 'diary_invite') {
    let safeContent = (cleanText || '').replace(/'/g, "\\'");
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px;">
            <div class="chat-diary-invite-bubble" onclick="handleDiaryInviteClick('assistant', '${safeContent}', currentChatContact.id, ${ts})" style="cursor:pointer;">
                <div class="di-top">
                    <div class="di-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 2v8l3-2 3 2V2"/></svg></div>
                    <div class="di-info"><div class="di-msg">交换日记邀请</div><div class="di-hint">${cleanText}</div></div>
                </div>
                <div class="di-bottom">LUMINA DIARY</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
    } else if ((typeof msgType !== 'undefined' && msgType === 'rename_invite') || (typeof msg !== 'undefined' && msg.msgType === 'rename_invite')) {
    let _content = typeof msg !== 'undefined' ? msg.content : cleanText;
    let _role = typeof msg !== 'undefined' ? msg.role : 'user';
    let _ts = typeof msg !== 'undefined' ? msg.timestamp : ts;
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${_role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-diary-invite-bubble" onclick="handleRenameInviteClick('${_role}', '${(_content||'').replace(/'/g, "\\'")}', currentChatContact.id, ${_ts})">
                <div class="di-top">
                    <div class="di-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
                    <div class="di-info"><div class="di-msg">邀请给日记本起名</div><div class="di-hint">${_content}</div></div>
                </div>
                <div class="di-bottom" style="color:var(--text-sub);">点击呼叫 TA 思考</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if ((typeof msgType !== 'undefined' && msgType === 'rename_proposal') || (typeof msg !== 'undefined' && msg.msgType === 'rename_proposal')) {
    let _name = typeof msg !== 'undefined' ? msg.proposedName : proposedName;
    let _role = typeof msg !== 'undefined' ? msg.role : 'assistant';
    let _ts = typeof msg !== 'undefined' ? msg.timestamp : ts;
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${_role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-diary-invite-bubble" onclick="handleRenameProposalClick('${_role}', '${(_name||'').replace(/'/g, "\\'")}', currentChatContact.id, ${_ts})">
                <div class="di-top">
                    <div class="di-icon" style="color:#8BA888; background:rgba(139,168,136,0.15);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                    <div class="di-info"><div class="di-msg" style="color:#8BA888;">日记本起名提议</div><div class="di-hint">我想叫它：${_name}</div></div>
                </div>
                <div class="di-bottom">点击确认使用此名字</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (isPureStickerAPI) {
    contentHtml = `<img src="${stickerUrlAPI}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 2px 0;">`;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (isPureFakeImgAPI) {
    contentHtml = `<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">${fakeImgDescAPI}</div></div>`;
    bubbleStyle = `class="chat-special-bubble"`;
} else {
    contentHtml = formattedCleanText;
    bubbleStyle = `class="chat-bubble"`; 
}

            // 生成 AI 自己的引用框 HTML
            let quoteHtml = '';
            if (quoteText) {
                const safeQuote = quoteText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                quoteHtml = `<div class="chat-bubble-quote">${safeQuote}</div>`;
            }

let currentAiName = document.getElementById('chatRoomTitle').innerText || 'TA';
let roleBadge = '';

            const newRowHtml = dateDividerHtml + `
    <div class="chat-bubble-row ai new-pop" data-ts="${ts}">
                    <div class="ms-checkbox"></div>
                    <div class="chat-bubble-avatar" style="${aiAvatarUrl ? `background-image:url(${aiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>
                    <div style="display:flex; flex-direction:column; max-width:85%; align-items:flex-start;">
                        <div style="font-size:10px; color:var(--text-sub); margin-left:4px; margin-bottom:2px; font-weight:bold; display:flex; align-items:center;">${roleBadge}${currentAiName}</div>
                        <div ${bubbleStyle} style="max-width: 100%;">${quoteHtml}${contentHtml}</div>
                    </div>
                    ${timeHtml}
                </div>
            
`;

const area = document.getElementById('chatMessageArea');
const loadingEl = document.getElementById('chatLoadingBubble');
if (loadingEl) {
    loadingEl.insertAdjacentHTML('beforebegin', newRowHtml);
} else {
    area.insertAdjacentHTML('beforeend', newRowHtml);
}
area.scrollTop = area.scrollHeight;

let purePreviewText = cleanText.replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '').trim();
let preText = '';
if (msgType === 'voice') preText = `[语音] ${purePreviewText}`;
else if (msgType === 'redpacket') preText = `[红包] ${purePreviewText}`;
else if (msgType === 'location') preText = `[定位] ${locName}`;
else preText = purePreviewText;
await updateContactPreview(contactId, preText);
// == 替换结束 ==

 
        }
        
hideTyping(); // 所有的消息连发完毕后，彻底隐藏正在输入气泡
checkAndTriggerMemorySummary(contactId); // 然后在后台静默检查总结记忆
    } catch (e) {
    hideTyping();
    
    // 提取真正的报错信息
    const errorMsg = "⚠️ 节点 API 报错拦截：\n" + e.message;
    
    // 把它存进本地聊天记录，方便以后查看
    history.push({ role: 'assistant', content: errorMsg, timestamp: Date.now() });
    await saveToDB(`chat_history_${contactId}`, history);
    
    // 生成一个红色的警告气泡显示在屏幕上
        const area = document.getElementById('chatMessageArea');
    area.insertAdjacentHTML('beforeend', `
        <div class="chat-bubble-row ai" data-ts="${Date.now()}">
            <div class="ms-checkbox"></div>
            <div class="chat-bubble-avatar" style="${aiAvatarUrl ? `background-image:url(${aiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>
            <div class="chat-bubble" style="color: #D67A7A; background: #FFF0F0; border: 1px dashed #D67A7A;">${errorMsg}</div>
        </div>
    `);
    area.scrollTop = area.scrollHeight;
    
    // 更新列表最后一条消息预览
    await updateContactPreview(contactId, "[系统报错记录]");
}
}

async function updateContactPreview(contactId, text) {
    let contacts = await loadFromDB('chat_contacts') || [];
    let contact = contacts.find(c => c.id === contactId);
    if (contact) {
        contact.lastMessage = text;
        contact.lastTime = Date.now();
        await saveToDB('chat_contacts', contacts);
        renderChatSessionList();
    }
}

// ==========================================
// 全新：群聊专属核心推演引擎
// ==========================================
async function fetchGroupChatAPI(contactId, history, contactInfo) {
    const area = document.getElementById('chatMessageArea');
    
    // 显示加载气泡 (支持指定名字)
    const showTyping = (name = null) => {
        if (document.getElementById('chatLoadingBubble')) return;
        const text = name ? `${name} 正在输入...` : '群成员正在输入...';
        area.insertAdjacentHTML('beforeend', `
            <div class="chat-bubble-row ai" id="chatLoadingBubble">
                <div class="chat-bubble"><span style="color:var(--text-sub);font-size:13.5px;font-style:italic;letter-spacing:0.5px;">${text}</span></div>
            </div>
        `);
        area.scrollTop = area.scrollHeight;
    };
    const hideTyping = () => document.getElementById('chatLoadingBubble')?.remove();

    showTyping();

    const allChars = await loadFromDB('ai_characters') || [];
    const members = allChars.filter(c => contactInfo.members.includes(c.id));
    if (members.length === 0) { hideTyping(); return; }

    // ★新增：获取禁言名单，并在设定里警告 AI
    const now = Date.now();
    const mutedData = contactInfo.muted || {};
    const mutedMembers = Object.keys(mutedData).filter(id => mutedData[id] > now);

    let memberDesc = members.map(m => {
    let muteWarning = mutedMembers.includes(m.id) ? ' 【⚠️该成员当前已被管理员禁言，你绝对不能代替该角色发言！】' : '';
    let roleStr = '';
    if (contactInfo.owner === m.id) roleStr = ' (群主)';
    else if ((contactInfo.admins || []).includes(m.id)) roleStr = ' (管理员)';
    
    
    return `- 名字: ${m.name}${roleStr} | 设定: ${m.prompt}${muteWarning}`;
}).join('\n');

    const useSubApi = await loadFromDB('chatUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) { hideTyping(); showToast('未配置 API Key'); return; }

    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    const rCount = settings.replyCount || '';
    let replyCountText = '';
    
    if (rCount === '') {
        replyCountText = `3. 【强硬要求】：请根据语境自由决定生成的聊天气泡条数。`;
    } else if (rCount.includes('-')) {
        let parts = rCount.split('-');
        replyCountText = `3. 【强硬要求】：本次回复你必须精确且严格地生成 ${parts[0].trim()} 到 ${parts[1].trim()} 条独立的聊天气泡！`;
    } else {
        replyCountText = `3. 【强硬要求】：本次回复你必须精确且严格地生成 ${rCount.trim()} 条独立的聊天气泡！`;
    }

    // 获取表情包库，让AI知道发什么
const allStickerGroupsAPI = await loadFromDB('sticker_groups') || [];
// 容错 1：防止 g.stickers 是空值导致 flatMap 崩溃
const allStickersAPI = allStickerGroupsAPI.flatMap(g => g.stickers || []);

// ======== 新增：群聊成员表情包权限精确控制 ========
const memberStickers = settings.memberStickers || {};
let stickerRules = [];

members.forEach(m => {
    // 容错 2：防止读取出来的权限列表损坏不是数组
    let allowedGids = memberStickers[m.id];
    if (!Array.isArray(allowedGids)) allowedGids = [];
    
    if (allowedGids.length > 0) {
        let mStickers = [];
        allStickerGroupsAPI.forEach(g => {
            // 容错 3：只有当 g.stickers 是真正的数组时才遍历，杜绝死机
            if (allowedGids.includes(g.id) && Array.isArray(g.stickers)) {
                g.stickers.forEach(s => mStickers.push(s.name));
            }
        });
        if (mStickers.length > 0) {
            // 生成具体某人的专属白名单
            stickerRules.push(`【${m.name}】被允许使用的表情包有：${mStickers.join(', ')}`);
        }
    }
});

let stickerAiPrompt = '';
if (stickerRules.length > 0) {
    stickerAiPrompt = `\n7. 【表情包系统】：如果要发表情，格式必须严格为：[表情包:名称]。\n【权限警告】：\n${stickerRules.join('\n')}\n(注意：未被明确允许拥有表情包的角色，绝对禁止发送任何表情包！请严格遵守！)`;
} else {
    stickerAiPrompt = `\n7. 【表情包系统】：本群当前已禁用 AI 发送表情包功能，绝对禁止任何角色发送表情包！`;
}
// ===================================================

    // ★★★ 核心修复：把指令集（世界书/规则）和双语翻译开关正式接入群聊！ ★★★
    const commands = await loadFromDB('ai_commands') || [];
    const boundCmdIds = settings.boundCommands || [];
    const activeCmds = commands.filter(c => c.isGlobal || boundCmdIds.includes(c.id));
    
    let frontCmdText = '';
    let backCmdText = '';
    if (activeCmds.length > 0) {
        activeCmds.forEach(c => {
            if (c.position === 'back') backCmdText += `\n【附加指令 - ${c.name}】：\n${c.content}`;
            else frontCmdText += `\n【附加设定 - ${c.name}】：\n${c.content}`;
        });
    }

    let innerVoiceText = '';
if (settings.innerVoice) {
    const customPrompt = settings.innerVoicePrompt || '请写出你此刻最真实、未经修饰的内心想法，包含表层情绪和深层顾虑。';
    innerVoiceText = `\n【心声系统】：在生成气泡回复之前，发言角色必须单独在最前面用 [心声: xxx] 的格式输出其内心独白。要求：${customPrompt}`;
}

const bilingualText = settings.bilingual ? `\n8. 【最高强制指令 - 翻译思维链】：每次输出前，请先在内部逻辑中执行“语言属性检测”：1. 确认即将输出的句子是否包含英语、日语、粤语等非普通话。2. 若包含，必须在含有外语/方言的句末，附加严格格式的翻译。格式必须且只能是：[译: 标准普通话翻译]。严禁自创格式（如(翻译: xxx)、[EN: xxx]）！示例：What a beautiful day! [译: 今天天气真不错！]` : '';

    // ==== 新增修复：让群聊也能读取自动总结的记忆，并开启关键词雷达 ====
    const allMemories = await loadFromDB(`chat_memories_${contactId}`) || [];
    const activeMemories = allMemories.filter(m => !m.isArchived);
    const archivedMemories = allMemories.filter(m => m.isArchived && m.triggerKeys);
    
    // 雷达扫描：抓取你最近发送的3条消息，看有没有触发归档里的旧日关键词
    const recentUserMsgs = history.filter(m => m.role === 'user').slice(-3).map(m => m.content).join(' ');
    let awakenedMemories = [];
    if (recentUserMsgs) {
        archivedMemories.forEach(mem => {
            const keys = mem.triggerKeys.split(/[,，、]/).map(k => k.trim()).filter(k => k);
            for (let key of keys) {
                if (recentUserMsgs.includes(key)) {
                    awakenedMemories.push(mem.content);
                    break;
                }
            }
        });
    }
    let radarText = awakenedMemories.length > 0 ? `\n\n【被当前对话触动唤醒的旧日记忆】（这让大家回想起了这些往事）：\n${awakenedMemories.join('\n')}` : '';
    const memoryText = (activeMemories.length > 0 || awakenedMemories.length > 0) 
        ? `\n【往期剧情与常驻记忆】：\n${activeMemories.map(m => m.content).join('\n')}${radarText}` 
        : '';
    // ==============================================================

    const sysPrompt = `你是一个多角色群聊推演引擎。正在模拟的群聊是：【${contactInfo.name}】。
【群内角色名单与设定】：
${memberDesc}
${memoryText}
${frontCmdText}

【核心推演与意识指令】：
1. 群里的每个人都是有独立生活、情绪波动的真实人类。在发言前，请先深度检索该角色的国籍、时代与文化背景。ta的母语是什么？请自动且坚定地使用符合ta背景的语言、方言或专属口癖，拒绝被统一的现代普通话同化。
2. 彻底抛弃教科书式的反应！请自行推演每个角色在群聊生态中的真实表现。
   - 思考：ta的核心性格是什么？ta是个话痨还是习惯潜水？ta喜欢如何表达？
   - ta的标点符号习惯、说话节奏、长短句分布，都必须是真实人性的“自然流露”，绝不机械套用公式。
3. 如果角色拥有(群主)或(管理员)标签，思考ta的性格是否喜欢滥用权力？会不会因为小事、吃醋或纯粹为了开玩笑而故意禁言别人？如果角色拥有表情包权限，思考ta的发图频率和风格。一切交互行为都必须符合该角色的人设底色！
4. 真实群聊不需要每个人都像开会一样轮流发言！允许打错字、用语气词、互相拌嘴甚至争吵。多用口语化短句，如果话没说完，直接用换行符分隔，系统会切分成多条气泡连发。
${replyCountText.replace(/^\d+\.\s*/, '')}
5. 想发语音格式：[VOICE:秒数]语音文字。发送图片格式：[图片:图片画面的详细描述]。发红包：[REDPACKET:金额]留言。发定位：[LOCATION:地点]留言。极低概率下想戳一戳某人，单起一行：[POKE:动作描述] (如: [POKE:张三揉了揉李四的脑袋])，严禁频繁使用！引用回复格式：[QUOTE:被引用的原话]回复。${stickerAiPrompt}
6. 若角色的性格和当前情绪决定了ta要禁言某人（且ta拥有群主/管理员权限），单起一行输出：[禁言:对方名字:秒数]理由。【警告：必须根据角色的愤怒/开玩笑程度，亲自决定具体秒数(如300, 3600, 86400等，永久填0)】。只能禁言下级普通群员。
7. 绝对不要使用 JSON！严格遵守纯文本格式输出：
   - 每一个独立的气泡之间必须用 === 分隔。
   - 每一个气泡的第一行必须是你指定的发言人的名字，用中括号括起来，例如：[张三]。第二行开始是正文内容。${innerVoiceText}${bilingualText}
${backCmdText}`;

// 改造 1：不要直接 join 成纯文本，而是组装成多模态支持的数组
let finalUserContent = [{ type: "text", text: "最近的群聊记录如下：\n" }];

history.slice(-15).forEach(m => {
    let speaker = m.role === 'user' ? '我' : (m.speakerName || contactInfo.name || '神秘群员');
    let textContent = m.content;
    if (m.msgType === 'diary_invite') textContent = `[发送了交换日记的邀请，附言："${m.content}"]`;
    if (m.msgType === 'forward_card') {
    let fwDetail = (m.forwardData || []).map(f => {
        let n = f.role === 'user' ? '我' : (f.speakerName || 'TA');
        let c = f.content || '[图片/特殊消息]';
        return `${n}: ${c}`;
    }).join(' | ');
    textContent = `[发送了一份合并聊天记录卡片，内含如下历史对话：{ ${fwDetail} }]`;
}

    // ★给每条消息打上精确时间戳
    let timeLabel = '';
    if (m.timestamp) {
        let d = new Date(m.timestamp);
        let mm = (d.getMonth()+1).toString().padStart(2,'0');
        let dd = d.getDate().toString().padStart(2,'0');
        let hh = d.getHours().toString().padStart(2,'0');
        let mins = d.getMinutes().toString().padStart(2,'0');
        timeLabel = `[${mm}月${dd}日 ${hh}:${mins}] `;
    }

    // 拼接文字部分
    finalUserContent.push({ type: "text", text: `${timeLabel}${speaker}: ${textContent}\n` });
    
    // 如果有图片，直接把图片对象塞进数组供 AI 读取
    if (m.imageUrl) {
        finalUserContent.push({
            type: "image_url",
            image_url: { url: m.imageUrl }
        });
    }
});

try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: sysPrompt },
                // 改造 2：这里把刚才组装好的多模态数组直接传给 user
                { role: "user", content: finalUserContent }
            ],
            temperature: (await loadFromDB('sysTemp') != null) ? parseFloat(await loadFromDB('sysTemp')) : 0.9
        })
    });

        if (!response.ok) throw new Error("API 请求失败");

const data = await response.json();
let reply = data.choices[0].message.content.trim();
reply = reply.replace(/\[\d{1,2}月\d{1,2}日 \d{1,2}:\d{2}\]\s*/g, '');

// 移除群聊不合理的全局心声提取，改为针对每个人的专属心声字典
let personInnerVoices = {};

const initialBubbles = reply.split(/===+/).map(b => b.trim()).filter(b => b);
const bubbles = [];
initialBubbles.forEach(b => {
    let text = b;
    let currentName = '神秘群员';
    
    // 匹配真正的发言人名字
    let nameMatch = text.match(/^\[(.*?)\]/);
    if (nameMatch) {
        currentName = nameMatch[1].trim();
        // 终极修复：把开头所有幻觉产生的连环名字标签全部剔除
        text = text.replace(/^(?:\[.*?\]\s*)+/, '').trim();
    }
    
    // 防止引用等功能框被换行切断
    text = text.replace(/(\[(QUOTE|LOCATION|REDPACKET|VOICE|DIARY_INVITE):.*?\])\s*\n+/gi, '$1 ');
    // 强行合并双语翻译标签
    text = text.replace(/\n+\s*(\[(?:译|翻译|EN|En|Eng)[:：].*?\])/gi, ' $1');

    text.split('\n').map(l => l.trim()).filter(l => l).forEach(line => {
        // 【核心修复】：如果遇到了单纯的名字标签换行，更新当前说话的人，并跳过避免生成空泡
        let lineNameMatch = line.match(/^\[(.*?)\]$/);
        if (lineNameMatch) {
            currentName = lineNameMatch[1].trim();
            return; 
        }

        // 【核心修复】：如果模型没换行直接吐出了 "[Logan] 你会完蛋的" 格式
        let inlineNameMatch = line.match(/^\[(.*?)\]\s*(.*)/);
        if (inlineNameMatch && inlineNameMatch[1] && inlineNameMatch[2]) {
            const tag = inlineNameMatch[1].trim();
            const excludeTags = ['QUOTE', 'LOCATION', 'REDPACKET', 'VOICE', 'DIARY_INVITE', 'POKE', '禁言', '图片', '表情包', '心声', '译', '翻译', 'EN', 'En', 'Eng'];
            // 如果不是功能性标签，说明它是发言人名字，那就更新它
            if (!excludeTags.includes(tag.toUpperCase())) {
                currentName = tag;
                line = inlineNameMatch[2].trim();
            }
        }

        bubbles.push(`[${currentName}]\n${line}`);
    });
});

        for (let i = 0; i < bubbles.length; i++) {
            let bubble = bubbles[i];
            
let speakerName = '神秘群员';
let rawContent = bubble;
const nameMatch = bubble.match(/^\[(.*?)\]/);
if (nameMatch) {
    speakerName = nameMatch[1].trim();
    rawContent = bubble.replace(/^\[.*?\]\s*/, '').trim(); 
}

let speakerInfo = members.find(m => m.name === speakerName); 
            if (!speakerInfo) {
                const matches = members.filter(m => m.name.includes(speakerName) || speakerName.includes(m.name));
                if (matches.length > 0) {
                    matches.sort((a, b) => b.name.length - a.name.length); 
                    speakerInfo = matches[0];
                }
            }
            if (!speakerInfo) speakerInfo = members[0]; 
            speakerName = speakerInfo.name;

            // ★新增：如果AI还是产生了幻觉想代替被禁言的人说话，我们直接在这里把这层泡泡物理抹杀掉！
            if (mutedMembers.includes(speakerInfo.id)) {
                console.log(`已物理拦截被禁言群员的发言: ${speakerName}`);
                continue; 
            }

            hideTyping(); 
            showTyping(speakerName); 
            
            let delay = (i === 0) ? 600 : 800 + Math.min(rawContent.length * 40, 2000);
            await new Promise(r => setTimeout(r, delay));
            

            // 解析特殊内容
let msgType = 'text';
let voiceDur = 0;
let rpAmt = 0;
let locName = '';
let cleanText = rawContent;
let quoteText = null;

// ★ 修复：群聊中分别提取每个人独立的心声，并剥离出文本
const localVoiceMatch = cleanText.match(/\[心声[:：]\s*([\s\S]*?)\]/i);
if (localVoiceMatch) {
    personInnerVoices[speakerName] = localVoiceMatch[1].trim();
    cleanText = cleanText.replace(/\[心声[:：]\s*[\s\S]*?\]/i, '').trim();
}
let turnInnerVoice = personInnerVoices[speakerName] || null;

// 解析 AI 发出的禁言动作
let isSpeakerAdmin = (contactInfo.owner === speakerInfo.id) || (contactInfo.admins && contactInfo.admins.includes(speakerInfo.id));
const aiMuteMatch = cleanText.match(/\[禁言:(.*?)(?::(\d+))?\](.*)/i);
if (aiMuteMatch && isSpeakerAdmin) {
    const targetName = aiMuteMatch[1].trim();
    // 如果它忘了写秒数，给个随机惩罚(1分钟到1小时不等)
const muteSecs = aiMuteMatch[2] ? parseInt(aiMuteMatch[2]) : (Math.floor(Math.random() * (3600 - 60 + 1)) + 60); 
    const muteReason = aiMuteMatch[3].trim();
    
    const targetInfo = members.find(m => m.name === targetName || m.name.includes(targetName));
    if (targetInfo) {
        let tRole = (contactInfo.owner === targetInfo.id) ? 2 : ((contactInfo.admins && contactInfo.admins.includes(targetInfo.id)) ? 1 : 0);
        let sRole = (contactInfo.owner === speakerInfo.id) ? 2 : 1;
        // 权限判断：上级才能禁言下级
        if (sRole > tRole) {
            let contactsDb = await loadFromDB('chat_contacts') || [];
            let cInfoDb = contactsDb.find(c => c.id === contactId);
            if (cInfoDb) {
                let mutedData = cInfoDb.muted || {};
                mutedData[targetInfo.id] = muteSecs === 0 ? Date.now() + 100 * 365 * 24 * 3600000 : Date.now() + muteSecs * 1000;
                cInfoDb.muted = mutedData;
                contactInfo.muted = mutedData;
                await saveToDB('chat_contacts', contactsDb);
            }
            let sysText = `${targetInfo.name} 被 ${speakerName} 禁言 ${formatMuteTime(muteSecs)}。理由：${muteReason}`;
            const tsMute = Date.now() + i + 10;
            history.push({ role: 'system', content: sysText, timestamp: tsMute });
            await saveToDB(`chat_history_${contactId}`, history);
            const loadingEl = document.getElementById('chatLoadingBubble');
const sysHtml = `<div class="chat-system-msg" data-ts="${tsMute}"><span class="chat-system-msg-text" style="color:#D67A7A; background:#FFF0F0;">${sysText}</span></div>`;
if (loadingEl) loadingEl.insertAdjacentHTML('beforebegin', sysHtml);
else document.getElementById('chatMessageArea').insertAdjacentHTML('beforeend', sysHtml);
        }
    }
    cleanText = cleanText.replace(/\[禁言:.*?\].*/i, '').trim();
    if (!cleanText) {
        document.getElementById('chatMessageArea').scrollTop = document.getElementById('chatMessageArea').scrollHeight;
        continue;
    }
}

// 解析 AI 发出的戳一戳动作
const aiPokeMatch = cleanText.match(/\[POKE:(.*?)\]/i);
if (aiPokeMatch) {
    const pokeText = aiPokeMatch[1].trim();
    const tsPoke = Date.now() + i;
    history.push({ role: 'system', content: pokeText, timestamp: tsPoke });
    await saveToDB(`chat_history_${contactId}`, history);
    
    const loadingEl = document.getElementById('chatLoadingBubble');
const sysHtml = `<div class="chat-system-msg" data-ts="${tsPoke}"><span class="chat-system-msg-text">${pokeText}</span></div>`;
if (loadingEl) loadingEl.insertAdjacentHTML('beforebegin', sysHtml);
else document.getElementById('chatMessageArea').insertAdjacentHTML('beforeend', sysHtml);
    
    cleanText = cleanText.replace(/\[POKE:.*?\]/i, '').trim();
    if (!cleanText) {
        document.getElementById('chatMessageArea').scrollTop = document.getElementById('chatMessageArea').scrollHeight;
        continue;
    }
}

const quoteMatch = cleanText.match(/\[QUOTE:(.*?)\]([\s\S]*)/i);
            if (quoteMatch) { quoteText = quoteMatch[1].trim(); cleanText = quoteMatch[2].trim(); }

            const voiceMatch = cleanText.match(/\[VOICE:(\d+)\](.*)/i);
            const rpMatch = cleanText.match(/\[REDPACKET:([\d\.]+)\](.*)/i);
            const locMatch = cleanText.match(/\[LOCATION:(.*?)\](.*)/i);
const inviteMatch = cleanText.match(/\[DIARY_INVITE:(.*?)\](.*)/i);
let proposedName = '';

            if (voiceMatch) { msgType = 'voice'; voiceDur = parseInt(voiceMatch[1]); cleanText = voiceMatch[2].trim(); } 
            else if (rpMatch) { msgType = 'redpacket'; rpAmt = parseFloat(rpMatch[1]); cleanText = rpMatch[2].trim(); }
            else if (locMatch) { msgType = 'location'; locName = locMatch[1].trim(); cleanText = locMatch[2].trim(); }
else if (inviteMatch) { msgType = 'diary_invite'; cleanText = inviteMatch[1].trim(); }
else if (cleanText.includes('[日记提议:')) {
    const match = cleanText.match(/\[日记提议:(.*?)\]([\s\S]*)/i);
    if (match) { msgType = 'rename_proposal'; proposedName = match[1].trim(); cleanText = match[2].trim(); }
}

            const ts = Date.now() + i; 
history.push({ role: 'assistant', speakerId: speakerInfo ? speakerInfo.id : undefined, speakerName: speakerName ? speakerName : undefined, content: cleanText, msgType: msgType, voiceDuration: voiceDur, rpAmount: rpAmt, locationName: locName, quoteText: quoteText, proposedName: proposedName, innerVoice: turnInnerVoice, timestamp: ts });
            await saveToDB(`chat_history_${contactId}`, history);

            let aiAvatarUrl = diaryAvatarCache[speakerInfo.id];
            if (!aiAvatarUrl) {
                const f = await loadFromDB(`char_avatar_${speakerInfo.id}`);
                aiAvatarUrl = f ? URL.createObjectURL(f) : '';
                diaryAvatarCache[speakerInfo.id] = aiAvatarUrl;
            }

            let md = new Date(ts);
let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;

// ★新增：AI群聊回复时跨天检测
let dateDividerHtml = '';
if (i === 0) {
    let lastMsgTs = history.length > 1 ? history[history.length - 2].timestamp : 0;
    if (lastMsgTs) {
        let lastD = new Date(lastMsgTs);
        if (lastD.getDate() !== md.getDate() || lastD.getMonth() !== md.getMonth() || lastD.getFullYear() !== md.getFullYear()) {
            dateDividerHtml = `<div class="chat-system-msg"><span class="chat-system-msg-text" style="background: transparent; color: var(--text-sub); opacity: 0.7; font-weight: bold; font-size: 11px;">${md.getFullYear()}年${md.getMonth() + 1}月${md.getDate()}日</span></div>`;
        }
    }
}

let timeHtml = `<div class="chat-time-stamp" ${['voice', 'redpacket', 'location', 'diary_invite', 'forward_card'].includes(msgType) ? 'style="display:none;"' : ''}>${tStr}</div>`;
            let innerTimeHtml = `<div class="chat-time-stamp" style="margin: 0 4px; align-self: flex-end; padding-bottom: 2px;">${tStr}</div>`;
            let formattedCleanText = (cleanText || '').replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '<div class="bilingual-trans">$1</div>');
formattedCleanText = formattedCleanText.replace(/\[图片[:：]\s*([\s\S]*?)\]/gi, '<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">$1</div></div>');

            let isPureStickerAPI = false;
let stickerUrlAPI = '';
const stickerMatchAPI = cleanText.match(/^\[表情包[:：](.*?)\]$/i);
if (stickerMatchAPI) {
    const sticker = allStickersAPI.find(s => s.name === stickerMatchAPI[1].trim());
    if (sticker) {
        isPureStickerAPI = true;
        stickerUrlAPI = sticker.url;
    }
}

let isPureFakeImgAPI = false;
let fakeImgDescAPI = '';
const fakeImgMatchAPI = cleanText.match(/^\[图片[:：]\s*([\s\S]*?)\]$/i);
if (fakeImgMatchAPI) {
    isPureFakeImgAPI = true;
    fakeImgDescAPI = fakeImgMatchAPI[1].trim();
}

formattedCleanText = formattedCleanText.replace(/[\(（]【?发送了?表情包[:：]?\s*(.*?)】?[\)）]/g, '[表情包:$1]');
            formattedCleanText = formattedCleanText.replace(/\[\[STICKER:(.*?)\]\]/gi, '[表情包:$1]');
            formattedCleanText = formattedCleanText.replace(/\[表情包[:：](.*?)\]/gi, (match, name) => {
                let cleanName = name.split(/[\/\-：:]/).pop().trim();
                const sticker = allStickersAPI.find(s => s.name === cleanName || name.includes(s.name) || s.name.includes(cleanName));
                if (sticker) {
                    return `<img src="${sticker.url}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 4px 0;">`;
                }
                return `<span style="color:var(--text-sub); font-style:italic;">（发送了表情包：${name}）</span>`;
            });

            let contentHtml = '';
            let bubbleStyle = '';

            if (msgType === 'voice') {
                contentHtml = `
                    <div style="display:flex; align-items:flex-end; gap:4px;">
                        <div class="chat-voice-bubble" onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                            <span>${voiceDur}"</span>
                        </div>
                        ${innerTimeHtml}
                    </div>
                    <div class="chat-voice-trans" style="display:none;">${formattedCleanText}</div>
                `;
                bubbleStyle = `class="chat-special-bubble"`;
            } else if (msgType === 'redpacket') {
                const safeContent = (cleanText || '心意红包').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
                contentHtml = `
                    <div style="display:flex; align-items:flex-end; gap:4px;">
                        <div class="chat-rp-bubble" onclick="openRedPacketModal(this, '${safeContent}', ${rpAmt})" style="cursor:pointer;">
                            <div class="rp-top">
                                <div class="rp-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><circle cx="12" cy="14" r="3"></circle><path d="M4 8h16"></path></svg></div>
                                <div class="rp-info">
                                    <div class="rp-msg">${cleanText}</div>
                                    <div class="rp-amt">查看红包</div>
                                </div>
                            </div>
                            <div class="rp-bottom">LUMINA TRANSFER</div>
                        </div>
                        ${innerTimeHtml}
                    </div>
                `;
                bubbleStyle = `class="chat-special-bubble"`;
            } else if (msgType === 'location') {
                contentHtml = `
                    <div style="display:flex; align-items:flex-end; gap:4px;">
                        <div class="chat-location-bubble">
                            <div class="loc-top">
                                <div class="loc-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>
                                <div class="loc-info"><div class="loc-name">${locName}</div></div>
                            </div>
                            <div class="loc-desc">${cleanText}</div>
                            <div class="loc-bottom">LUMINA MAPS</div>
                        </div>
                        ${innerTimeHtml}
                    </div>
                `;
                bubbleStyle = `class="chat-special-bubble"`;
            } else if (msgType === 'diary_invite') {
    let safeContent = (cleanText || '').replace(/'/g, "\\'");
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px;">
            <div class="chat-diary-invite-bubble" onclick="handleDiaryInviteClick('assistant', '${safeContent}', currentChatContact.id, ${ts})" style="cursor:pointer;">
                <div class="di-top">
                    <div class="di-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 2v8l3-2 3 2V2"/></svg></div>
                    <div class="di-info"><div class="di-msg">交换日记邀请</div><div class="di-hint">${cleanText}</div></div>
                </div>
                <div class="di-bottom">LUMINA DIARY</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
    } else if ((typeof msgType !== 'undefined' && msgType === 'rename_invite') || (typeof msg !== 'undefined' && msg.msgType === 'rename_invite')) {
    let _content = typeof msg !== 'undefined' ? msg.content : cleanText;
    let _role = typeof msg !== 'undefined' ? msg.role : 'user';
    let _ts = typeof msg !== 'undefined' ? msg.timestamp : ts;
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${_role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-diary-invite-bubble" onclick="handleRenameInviteClick('${_role}', '${(_content||'').replace(/'/g, "\\'")}', currentChatContact.id, ${_ts})">
                <div class="di-top">
                    <div class="di-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
                    <div class="di-info"><div class="di-msg">邀请给日记本起名</div><div class="di-hint">${_content}</div></div>
                </div>
                <div class="di-bottom" style="color:var(--text-sub);">点击呼叫 TA 思考</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if ((typeof msgType !== 'undefined' && msgType === 'rename_proposal') || (typeof msg !== 'undefined' && msg.msgType === 'rename_proposal')) {
    let _name = typeof msg !== 'undefined' ? msg.proposedName : proposedName;
    let _role = typeof msg !== 'undefined' ? msg.role : 'assistant';
    let _ts = typeof msg !== 'undefined' ? msg.timestamp : ts;
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${_role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-diary-invite-bubble" onclick="handleRenameProposalClick('${_role}', '${(_name||'').replace(/'/g, "\\'")}', currentChatContact.id, ${_ts})">
                <div class="di-top">
                    <div class="di-icon" style="color:#8BA888; background:rgba(139,168,136,0.15);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                    <div class="di-info"><div class="di-msg" style="color:#8BA888;">日记本起名提议</div><div class="di-hint">我想叫它：${_name}</div></div>
                </div>
                <div class="di-bottom">点击确认使用此名字</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (isPureStickerAPI) {
    contentHtml = `<img src="${stickerUrlAPI}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 2px 0;">`;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (isPureFakeImgAPI) {
    contentHtml = `<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">${fakeImgDescAPI}</div></div>`;
    bubbleStyle = `class="chat-special-bubble"`;
} else {
    contentHtml = formattedCleanText;
                bubbleStyle = `class="chat-bubble"`; 
            }

            let quoteHtml = '';
            if (quoteText) {
                const safeQuote = quoteText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                quoteHtml = `<div class="chat-bubble-quote">${safeQuote}</div>`;
            }

            const newRowHtml = dateDividerHtml + `
    <div class="chat-bubble-row ai new-pop" data-ts="${ts}">
                    <div class="ms-checkbox"></div>
                    <div class="chat-bubble-avatar" style="${aiAvatarUrl ? `background-image:url(${aiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>
                    <div style="display:flex; flex-direction:column; max-width:85%; align-items:flex-start;">
                        <div style="font-size:10px; color:var(--text-sub); margin-left:4px; margin-bottom:2px; font-weight:bold;">${speakerName}</div>
                        <div ${bubbleStyle} style="max-width: 100%;">${quoteHtml}${contentHtml}</div>
                    </div>
                    ${timeHtml}
                </div>
            `;
            
            const loadingEl = document.getElementById('chatLoadingBubble');
            if (loadingEl) loadingEl.insertAdjacentHTML('beforebegin', newRowHtml);
            else area.insertAdjacentHTML('beforeend', newRowHtml);
            
            area.scrollTop = area.scrollHeight;
                    await updateContactPreview(contactId, `${speakerName}: ${cleanText}`);
    }
hideTyping();
checkAndTriggerMemorySummary(contactId); // <--- 在第11057行下面，加上这一句补上即可！
    } catch (e) {
        hideTyping();
        showToast("群聊引擎报错：" + e.message);
    }
}
