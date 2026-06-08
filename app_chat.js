// === 全新聊天 APP 交互逻辑 ===
const chatModal = document.getElementById('chatAppModal');


document.getElementById('closeChatApp').addEventListener('click', () => { chatModal.classList.remove('open'); });

// 2. Tab 切换 (消息 / 通讯录) 【修复了无法点击的问题】
document.querySelectorAll('#chatTabSelector .art-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#chatTabSelector .art-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.getElementById('chatMessagesView').style.display = btn.dataset.tab === 'messages' ? 'block' : 'none';
        document.getElementById('chatContactsView').style.display = btn.dataset.tab === 'contacts' ? 'block' : 'none';
    });
});

// ====== 新增：构建群聊逻辑 (带打勾动效) ======
let tempNewGroupAvatarFile = null;

// 点击预览框触发文件选择
document.getElementById('newGroupAvatarPreview').addEventListener('click', () => {
    document.getElementById('newGroupAvatarInput').click();
});

// 处理选中的图片进行预览
document.getElementById('newGroupAvatarInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        tempNewGroupAvatarFile = file;
        const url = URL.createObjectURL(file);
        document.getElementById('newGroupAvatarPreview').style.backgroundImage = `url(${url})`;
        document.getElementById('newGroupAvatarIcon').style.display = 'none';
    }
});

document.getElementById('createGroupBtn').addEventListener('click', async () => {
    const list = document.getElementById('groupMemberSelectionList');
    list.innerHTML = '';
    document.getElementById('newGroupName').value = '';
    
    // 每次打开清空头像状态
    tempNewGroupAvatarFile = null;
    document.getElementById('newGroupAvatarPreview').style.backgroundImage = '';
    document.getElementById('newGroupAvatarIcon').style.display = 'block';
    document.getElementById('newGroupAvatarInput').value = '';
    
    const chars = await loadFromDB('ai_characters') ||[];
    const aiChars = chars.filter(c => c.roleType === 'char');
    
    if (aiChars.length === 0) {
        showToast('档案库空空如也，请先去创造角色吧');
        return;
    }
    
    for (let char of aiChars) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.style.cursor = 'pointer';
        
        let avatarUrl = diaryAvatarCache[char.id];
        if (avatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${char.id}`);
            avatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[char.id] = avatarUrl;
        }

        // 极其干净高级的勾选卡片 (打勾靠右)
        card.innerHTML = `
            <div class="char-card-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : 'background-color:rgba(184,156,142,0.2)'}; width:46px; height:46px; border-radius:16px; box-shadow: 0 4px 12px rgba(128,118,110,0.06);"></div>
            <div class="char-card-info" style="flex:1; margin-left:14px;">
                <div class="char-card-name" style="font-size:15px; font-weight:800; color:var(--text-main); letter-spacing:1px;">${char.name}</div>
            </div>
            <div class="sel-check" style="width:22px; height:22px; border-radius:50%; border:1.5px solid rgba(184,156,142,0.3); display:flex; justify-content:center; align-items:center; transition:all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); flex-shrink:0; background: rgba(255,255,255,0.5);">
                <svg viewBox="0 0 24 24" style="width:14px; height:14px; stroke:#fff; fill:none; stroke-width:3.5; stroke-linecap:round; stroke-linejoin:round; opacity:0; transform:scale(0.5); transition:all 0.3s;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
        `;
        
        card.onclick = () => card.classList.toggle('selected');
        card.dataset.id = char.id;
        list.appendChild(card);
    }
    
    document.getElementById('createGroupPanel').classList.add('show');
});

document.getElementById('closeCreateGroupBtn').addEventListener('click', () => {
    document.getElementById('createGroupPanel').classList.remove('show');
});

// 确认创建群聊
document.getElementById('confirmCreateGroupBtn').addEventListener('click', async () => {
    const name = document.getElementById('newGroupName').value.trim() || '神秘群聊';
    const selectedCards = document.querySelectorAll('#groupMemberSelectionList .char-card.selected');
    
    if (selectedCards.length === 0) {
        showToast('至少要拉一个人进群吧！');
        return;
    }
    
    const memberIds = Array.from(selectedCards).map(card => card.dataset.id);
    const groupId = 'group_' + Date.now();
    
    let contacts = await loadFromDB('chat_contacts') ||[];
    contacts.push({ 
        id: groupId, 
        name: name, 
        isGroup: true,
        members: memberIds, 
        addedAt: Date.now() 
    });
    
    await saveToDB('chat_contacts', contacts);

    // ★新增：如果传了头像，就存入数据库并注入内存缓存，外面就能立刻显示！
    if (tempNewGroupAvatarFile) {
        await saveToDB(`char_avatar_${groupId}`, tempNewGroupAvatarFile);
        diaryAvatarCache[groupId] = URL.createObjectURL(tempNewGroupAvatarFile);
    }
    
    showToast(`群聊【${name}】构建成功！`);
    renderChatContacts(); 
    document.getElementById('createGroupPanel').classList.remove('show');
});

// 3. 通讯录 -> 添加联系人
document.getElementById('addContactBtn').addEventListener('click', () => {
    document.getElementById('addContactPanel').classList.add('show');
});
document.getElementById('closeAddContactBtn').addEventListener('click', () => {
    document.getElementById('addContactPanel').classList.remove('show');
});

// 4. 退出聊天室
document.getElementById('backToChatListBtn').addEventListener('click', () => {
    document.getElementById('chatRoomPanel').classList.remove('show');
    // 退出时自动收起底部菜单
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');
    
    // 【彻底治愈】：直接删掉这下面的 renderChatSessionList()！
    // 因为在发消息或收消息时，后台早就把列表更新好了，这里强行刷新纯属多此一举，也是导致闪烁的元凶。
});

// 5. 【核心】左侧功能菜单的丝滑展开/互斥收起动画
document.getElementById('chatMenuToggleBtn').addEventListener('click', function() {
    const menu = document.getElementById('chatExpandMenu');
    const stickerPanel = document.getElementById('chatStickerPanel');
    
    // 检查表情包面板此时是否正开着
    const wasStickerOpen = stickerPanel.classList.contains('show');
    
    if (menu.classList.contains('open')) {
        // 1. 如果加号菜单本来开着，就正常收起
        this.classList.remove('active'); 
        menu.classList.remove('open');
    } else {
        // 2. 如果加号菜单没开，准备打开它
        if (wasStickerOpen) {
            // 【无缝切换逻辑】：剥离两者的动画，瞬间替换！
            menu.style.transition = 'none';
            stickerPanel.style.transition = 'none';
            void menu.offsetHeight;
            void stickerPanel.offsetHeight;
            
            // 瞬间收起表情包，展开加号菜单
            stickerPanel.classList.remove('show');
            this.classList.add('active');
            menu.classList.add('open');
            
            void menu.offsetHeight; // 强制渲染
            
            // 恢复动画能力，并强制拉到底部
            setTimeout(() => {
                menu.style.transition = '';
                stickerPanel.style.transition = '';
                const area = document.getElementById('chatMessageArea');
                area.scrollTop = area.scrollHeight;
            }, 30);
        } else {
            // 3. 正常直接打开加号菜单
            this.classList.add('active'); 
            menu.classList.add('open');
            setTimeout(() => {
                const area = document.getElementById('chatMessageArea');
                area.scrollTop = area.scrollHeight;
            }, 400); // 配合 CSS 动画时长
        }
    }
});

// 点击输入框准备打字时，自动收起底部展开菜单，并将消息顶上去
document.getElementById('chatInputContent').addEventListener('focus', function() {
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');
    document.getElementById('chatStickerPanel').classList.remove('show');    
    // 给键盘弹出一点动画时间(约300毫秒)后，强制滚到底部
    setTimeout(() => {
        const area = document.getElementById('chatMessageArea');
        area.scrollTop = area.scrollHeight;
        // 让输入框本身也滚动到可视范围内(防止被某些机型顽固遮挡)
        this.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }, 300);
});

// 新增：监听手机屏幕因键盘弹起而发生的大小变化，一旦变化瞬间顶到底部
window.addEventListener('resize', () => {
    if (document.getElementById('chatRoomPanel').classList.contains('show')) {
        const area = document.getElementById('chatMessageArea');
        area.scrollTop = area.scrollHeight;
    }
});
document.getElementById('chatInputContent').addEventListener('click', function() {
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');
    document.getElementById('chatStickerPanel').classList.remove('show');
});

// ==========================================
// 聊天 APP - 全新核心逻辑 (真实API接入 + 头像防闪烁缓存)
// ==========================================

let chatContacts = [];
let currentChatContact = null;

// 1. 渲染会话列表 (信号页)
async function renderChatSessionList() {
    let contacts = await loadFromDB('chat_contacts') || [];
    contacts.sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0)); // 按最新消息排序
    const container = document.getElementById('chatSessionList');
    
    const activeContacts = contacts.filter(c => c.lastMessage);
    if (activeContacts.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px; letter-spacing: 1px;">信箱空荡荡的，去频段唤醒某人吧</div>';
        return;
    }
    
    let html = '';
    for (let contact of activeContacts) {
        let avatarUrl = diaryAvatarCache[contact.id];
        if (avatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${contact.id}`);
            avatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[contact.id] = avatarUrl;
        }
        
        let timeStr = '';
        if (contact.lastTime) {
            const d = new Date(contact.lastTime);
            timeStr = `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
        }
        
        html += `
            <div class="chat-session-card" onclick="openChatRoom('${contact.id}', '${contact.name}')">
                <div class="chat-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : ''}">
                    ${!avatarUrl ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(184,156,142,0.5)" stroke-width="2" style="margin: 14px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` : ''}
                </div>
                <div class="chat-info" style="text-align: left;">
                    <div class="chat-name-row">
                        <div class="chat-name">${contact.name}</div>
                        <div class="chat-time">${timeStr}</div>
                    </div>
                    <div class="chat-preview">${contact.lastMessage || ''}</div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ==========================================
// 2. 渲染通讯录列表 (频段页)
// ==========================================
let currentContactFilter = 'single';

// 绑定极简单/群开关点击逻辑
document.getElementById('contactTypeToggleBtn').addEventListener('click', function() {
    const txtSingle = document.getElementById('txtSingle');
    const txtGroup = document.getElementById('txtGroup');
    
    if (currentContactFilter === 'single') {
        currentContactFilter = 'group';
        txtSingle.style.fontWeight = '300';
        txtSingle.style.color = 'var(--text-sub)';
        txtGroup.style.fontWeight = '600';
        txtGroup.style.color = 'var(--accent)';
    } else {
        currentContactFilter = 'single';
        txtSingle.style.fontWeight = '500';
        txtSingle.style.color = 'var(--text-main)';
        txtGroup.style.fontWeight = '300';
        txtGroup.style.color = 'var(--text-sub)';
    }
    renderChatContacts(); // 瞬间重绘
});

async function renderChatContacts() {
    chatContacts = await loadFromDB('chat_contacts') ||[];
    const container = document.getElementById('chatContactList');
    
    // 根据当前状态过滤数据
    const filteredContacts = chatContacts.filter(c => {
        if (currentContactFilter === 'group') return c.isGroup === true;
        return !c.isGroup; 
    });
    
    if (filteredContacts.length === 0) {
        let emptyTip = currentContactFilter === 'group' ? '你还没有构建任何群聊频段' : '在茫茫的数据之海中<br>你还未与任何灵魂建立连接';
        container.innerHTML = `
            <div class="empty-soul-state">
                <svg class="empty-signal" style="transform: translateZ(0);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="2"></circle>
                    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>
                </svg>
                <div class="empty-title">无 人 响 应</div>
                <div class="empty-desc">${emptyTip}</div>
            </div>`;
        return;
    }
    
    let html = '';
    for (let contact of filteredContacts) {
        let avatarUrl = diaryAvatarCache[contact.id];
        if (avatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${contact.id}`);
            avatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[contact.id] = avatarUrl;
        }
        
        let descText = contact.isGroup ? '"多元灵魂共振中..."' : '"已建立灵魂连接"';
        let groupIcon = contact.isGroup 
            ? `<svg style="width:26px; height:26px; stroke:rgba(184,156,142,0.8); fill:none; stroke-width:1.5; margin:15px;" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>` 
            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(184,156,142,0.5)" stroke-width="2" style="margin: 14px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        html += `
            <div class="chat-session-card artistic-contact-card" onclick="openChatRoom('${contact.id}', '${contact.name}')">
                <div class="artistic-contact-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : ''}">
                    ${!avatarUrl ? groupIcon : ''}
                </div>
                <div class="artistic-contact-info" style="text-align: left;">
                    <div class="artistic-contact-name">${contact.name} ${contact.isGroup ? '<span style="font-size:10px; background:rgba(184,156,142,0.15); color:var(--accent); padding:3px 6px; border-radius:6px; vertical-align:middle; margin-left:4px; font-weight:800;">群聊</span>' : ''}</div>
                    <div class="artistic-contact-desc" style="font-style:italic;">${descText}</div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// 3. 打开专属独立聊天室
window.openChatRoom = async function(id, name) {
    window.chatDisplayLimit = 30; // 每次进聊天室默认只显示30条
    currentChatContact = { id, name };
    document.getElementById('chatRoomTitle').innerText = name;
    
    // 检查是不是群聊
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === id);
    
    // 如果是群聊，隐藏小绿点；如果是单聊，显示小绿点
    if (contactInfo && contactInfo.isGroup) {
        document.getElementById('chatOnlineStatusDot').style.display = 'none';
    } else {
        document.getElementById('chatOnlineStatusDot').style.display = 'block';
    }

    // 读取并更新在线状态小绿点
    const schedSettings = await loadFromDB(`chat_schedule_${id}`) || {};
    updateOnlineStatusUI(schedSettings.schedule, schedSettings.enabled);
    
    // --- 新增：加载专属聊天背景和自定义气泡CSS ---
    const bgFile = await loadFromDB(`chat_bg_${id}`);
    const area = document.getElementById('chatMessageArea');
    if (bgFile) {
        area.style.backgroundImage = `url(${URL.createObjectURL(bgFile)})`;
        area.style.backgroundSize = 'cover';
        area.style.backgroundPosition = 'center';
    } else {
        area.style.backgroundImage = '';
    }
    const settings = await loadFromDB(`chat_settings_${id}`) || {};
    applyChatCustomCss(settings.customCss);
    // ---------------------------------------------
        // 决定是否隐藏快捷栏
    if (settings.hideQuickBar === true) {
        document.getElementById('chatQuickBar').style.display = 'none';
    } else {
        document.getElementById('chatQuickBar').style.display = 'flex';
    }
    await loadChatHistory(id); // 先在后台把聊天记录拼好
    
    // 终极修复：在面板处于屏幕下方隐身时，先给浏览器 30 毫秒把排版算好并顶到底部
    setTimeout(() => {
        area.scrollTop = area.scrollHeight;
        
        // 确认内部已经拉到底部了，再执行滑出动画
        document.getElementById('chatRoomPanel').classList.add('show'); 
    }, 30); 
};

// 4. 加载独立历史记录与渲染
async function loadChatHistory(contactId) {
    let history = await loadFromDB(`chat_history_${contactId}`) || [];
    await renderChatMessages(history, contactId);
}

async function renderChatMessages(history, contactId, isLoadMore = false) {
    const allChars = await loadFromDB('ai_characters') || [];
    const area = document.getElementById('chatMessageArea');
    
    // 获取表情包库
    const allStickerGroups = await loadFromDB('sticker_groups') || [];
    const allStickers = allStickerGroups.flatMap(g => g.stickers);

    let aiAvatarUrl = diaryAvatarCache[contactId] || '';
    
    // 获取绑定的自身身份头像
    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    const userRoleId = settings.userRoleId || '';
    let myAvatarUrl = '';
    if (userRoleId) {
        myAvatarUrl = diaryAvatarCache[userRoleId];
        if (myAvatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${userRoleId}`);
            myAvatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[userRoleId] = myAvatarUrl;
        }
    }
    
    // === 核心修复：提前把群聊里所有群员的头像拉取到内存里，并准备头衔渲染 ===
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === contactId);
    let getChatRoleBadge = (id) => ''; // 默认无头衔
    
    if (contactInfo && contactInfo.isGroup) {
let ownerId = contactInfo.owner || 'me';
let admins = contactInfo.admins || [];
getChatRoleBadge = (id) => {
    if (id === ownerId) return `<span style="font-size:8px; background:#FFF6D6; color:#D69E2E; padding:1px 4px; border-radius:4px; margin-right:4px; vertical-align:middle; font-weight:800;">群主</span>`;
    if (admins.includes(id)) return `<span style="font-size:8px; background:rgba(51,144,236,0.1); color:#3390EC; padding:1px 4px; border-radius:4px; margin-right:4px; vertical-align:middle; font-weight:800;">管理员</span>`;
    return '';
};
        
        let avatarPromises = [];
        for (let mId of contactInfo.members) {
            if (diaryAvatarCache[mId] === undefined) {
                avatarPromises.push(loadFromDB(`char_avatar_${mId}`).then(f => {
                    diaryAvatarCache[mId] = f ? URL.createObjectURL(f) : '';
                }));
            }
        }
        await Promise.all(avatarPromises);
    }
    
    let displayLimit = window.chatDisplayLimit || 30;
let msgsToRender = history.slice(-displayLimit);

let html = '';
if (history.length > displayLimit) {
    // 如果历史记录大于当前限制，就在最上面加一个加载按钮
    html += `<div onclick="loadMoreChatMessages()" style="text-align: center; font-size: 12px; color: var(--accent); margin: 0 auto 15px auto; padding: 8px 16px; cursor: pointer; background: rgba(184,156,142,0.1); border-radius: 16px; font-weight: bold; width: max-content; transition: 0.2s;">点击显示更早的消息</div>`;
} else {
    html += '<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin-bottom: 10px;">与 TA 的灵魂频段已连接</div>';
}

let lastRenderedDateStr = ''; // 新增：用来记住上一条消息的日期

msgsToRender.forEach(msg => {
    // 新增：判断是否跨天，如果是，插入一条日期分隔线
    let msgDateObj = new Date(msg.timestamp || Date.now());
    let currentDateStr = `${msgDateObj.getFullYear()}年${msgDateObj.getMonth() + 1}月${msgDateObj.getDate()}日`;
    if (currentDateStr !== lastRenderedDateStr) {
        html += `<div class="chat-system-msg"><span class="chat-system-msg-text" style="background: transparent; color: var(--text-sub); opacity: 0.7; font-weight: bold; font-size: 11px;">${currentDateStr}</span></div>`;
        lastRenderedDateStr = currentDateStr;
    }

    // ★新增：渲染系统小字 (例如禁言提示)
    if (msg.role === 'system') {
            html += `<div class="chat-system-msg" data-ts="${msg.timestamp}"><span class="chat-system-msg-text">${msg.content}</span></div>`;
            return; // 渲染完直接跳过后面的气泡逻辑
        }

        let md = new Date(msg.timestamp || Date.now());
        let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;
        let timeHtml = `<div class="chat-time-stamp" ${['voice', 'redpacket', 'location', 'diary_invite', 'forward_card'].includes(msg.msgType) ? 'style="display:none;"' : ''}>${tStr}</div>`;
        let innerTimeHtml = `<div class="chat-time-stamp" style="margin: 0 4px; align-self: flex-end; padding-bottom: 2px;">${tStr}</div>`;
        
        let formattedMsgContent = (msg.content || '').replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '<div class="bilingual-trans">$1</div>');
formattedMsgContent = formattedMsgContent.replace(/\[图片[:：]\s*([\s\S]*?)\]/gi, '<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">$1</div></div>');

        formattedMsgContent = formattedMsgContent.replace(/[\(（]【?发送了?表情包[:：]?\s*(.*?)】?[\)）]/g, '[表情包:$1]');
        formattedMsgContent = formattedMsgContent.replace(/\[\[STICKER:(.*?)\]\]/gi, '[表情包:$1]');
        formattedMsgContent = formattedMsgContent.replace(/\[表情包[:：](.*?)\]/gi, (match, name) => {
            let cleanName = name.split(/[\/\-：:]/).pop().trim();
            const sticker = allStickers.find(s => s.name === cleanName || name.includes(s.name) || s.name.includes(cleanName));
            if (sticker) return `<img src="${sticker.url}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 4px 0;">`;
            return `<span style="color:var(--text-sub); font-style:italic;">（发送了表情包：${name}）</span>`;
        });

        let locName = msg.locationName || '';
        if (msg.msgType !== 'voice' && msg.msgType !== 'redpacket' && msg.msgType !== 'location') {
            const locMatch = (msg.content || '').match(/\[LOCATION:(.*?)\](.*)/i);
            if (locMatch) { msg.msgType = 'location'; locName = locMatch[1].trim(); msg.content = locMatch[2].trim(); formattedMsgContent = msg.content; }
        }
        
        let isPureSticker = false;
        let stickerUrl = '';
        const stickerMatch = (msg.content || '').match(/^\[表情包[:：](.*?)\]$/i);
        if (stickerMatch) {
            const sticker = allStickers.find(s => s.name === stickerMatch[1].trim());
            if (sticker) { isPureSticker = true; stickerUrl = sticker.url; }
        }

let isPureFakeImg = false;
let fakeImgDesc = '';
const fakeImgMatch = (msg.content || '').match(/^\[图片[:：]\s*([\s\S]*?)\]$/i);
if (fakeImgMatch) {
    isPureFakeImg = true;
    fakeImgDesc = fakeImgMatch[1].trim();
}

        let contentHtml = '';
        let bubbleStyle = '';

        if (msg.msgType === 'voice') {
            contentHtml = `
                <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${msg.role === 'user' ? 'row-reverse' : 'row'};">
                    <div class="chat-voice-bubble" onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                        <span>${msg.voiceDuration}"</span>
                    </div>
                    ${innerTimeHtml}
                </div>
                <div class="chat-voice-trans" style="display:none;">${formattedMsgContent}</div>
            `;
            bubbleStyle = `class="chat-special-bubble"`;
        } else if (msg.msgType === 'redpacket') {
            const safeContent = (msg.content || '心意红包').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
            contentHtml = `
                <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${msg.role === 'user' ? 'row-reverse' : 'row'};">
                    <div class="chat-rp-bubble" onclick="openRedPacketModal(this, '${safeContent}', ${msg.rpAmount})" style="cursor:pointer;">
                        <div class="rp-top">
                            <div class="rp-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><circle cx="12" cy="14" r="3"></circle><path d="M4 8h16"></path></svg></div>
                            <div class="rp-info"><div class="rp-msg">${msg.content}</div><div class="rp-amt">查看红包</div></div>
                        </div>
                        <div class="rp-bottom">LUMINA TRANSFER</div>
                    </div>
                    ${innerTimeHtml}
                </div>
            `;
            bubbleStyle = `class="chat-special-bubble"`;
        } else if (msg.msgType === 'location') {
            contentHtml = `
                <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${msg.role === 'user' ? 'row-reverse' : 'row'};">
                    <div class="chat-location-bubble">
                        <div class="loc-top">
                            <div class="loc-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>
                            <div class="loc-info"><div class="loc-name">${locName}</div></div>
                        </div>
                        <div class="loc-desc">${msg.content}</div>
                        <div class="loc-bottom">LUMINA MAPS</div>
                    </div>
                    ${innerTimeHtml}
                </div>
            `;
            bubbleStyle = `class="chat-special-bubble"`;
            } else if (msg.msgType === 'forward_card') {
    const safePreview = (msg.content || '').replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    const fwCount = msg.forwardData ? msg.forwardData.length : 0;
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${msg.role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-forward-bubble">
                <div class="fw-title">聊天记录</div>
                <div class="fw-content">${safePreview}</div>
                <div class="fw-bottom">共 ${fwCount} 条明细</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
                    } else if (msg.msgType === 'diary_invite') {
    let safeContent = (msg.content || '').replace(/'/g, "\\'");
    contentHtml = `
        <div style="display:flex; align-items:flex-end; gap:4px; flex-direction:${msg.role === 'user' ? 'row-reverse' : 'row'};">
            <div class="chat-diary-invite-bubble" onclick="handleDiaryInviteClick('${msg.role}', '${safeContent}', currentChatContact.id, ${msg.timestamp})" style="cursor:pointer;">
                <div class="di-top">
                    <div class="di-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 2v8l3-2 3 2V2"/></svg></div>
                    <div class="di-info"><div class="di-msg">交换日记邀请</div><div class="di-hint">${msg.content}</div></div>
                </div>
                <div class="di-bottom">LUMINA DIARY</div>
            </div>
            ${innerTimeHtml}
        </div>
    `;
    bubbleStyle = `class="chat-special-bubble"`;
        } else if (isPureSticker) {
    contentHtml = `<img src="${stickerUrl}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 2px 0;">`;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (isPureFakeImg) {
    contentHtml = `<div class="fake-img-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg><div class="fake-img-desc">${fakeImgDesc}</div></div>`;
    bubbleStyle = `class="chat-special-bubble"`;
} else if (msg.imageUrl) {
            contentHtml = `<img src="${msg.imageUrl}" style="max-width: 140px; border-radius: 12px; display: block; margin: 2px 0;">`;
            bubbleStyle = `class="chat-special-bubble"`;
        } else {
            contentHtml = formattedMsgContent;
            bubbleStyle = `class="chat-bubble"`; 
        }

        let quoteHtml = '';
        if (msg.quoteText) {
            const safeQuote = msg.quoteText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            quoteHtml = `<div class="chat-bubble-quote">${safeQuote}</div>`;
        }

        let finalBubbleBlock = `<div ${bubbleStyle} style="max-width: 100%;">${quoteHtml}${contentHtml}</div>`;
        
        // === 核心修复：给名字包裹层加上收紧宽度防撑爆，并渲染群聊头衔标签 ===
if (msg.role !== 'user' && msg.speakerName) {
    let actualSpeakerId = msg.speakerId;
    // 【自动补全保险】：如果旧的历史记录丢失了 ID，就通过群员的名字反向找回 ta 的真实身份！
    if (!actualSpeakerId && contactInfo && contactInfo.members) {
        const charMatch = allChars.find(c => contactInfo.members.includes(c.id) && (c.name === msg.speakerName || msg.speakerName.includes(c.name)));
        if (charMatch) actualSpeakerId = charMatch.id;
    }
    
    let roleBadge = getChatRoleBadge(actualSpeakerId);
    
    // ★ 新增：如果是单聊，强制使用最新的备注名，无视历史记录里存的原名
    let finalDisplayName = (contactInfo && !contactInfo.isGroup) ? currentChatContact.name : msg.speakerName;
    
    finalBubbleBlock = `
        <div style="display:flex; flex-direction:column; max-width:85%; align-items:flex-start;">
            <div style="font-size:10px; color:var(--text-sub); margin-left:4px; margin-bottom:2px; font-weight:bold; display:flex; align-items:center;">${roleBadge}${finalDisplayName}</div>
            <div ${bubbleStyle} style="max-width: 100%;">${quoteHtml}${contentHtml}</div>
        </div>
    `;
}

        // === 核心修复：如果是群聊，使用发言人的专属头像 ===
        let currentAiAvatarUrl = aiAvatarUrl;
        if (msg.speakerId && diaryAvatarCache[msg.speakerId]) {
            currentAiAvatarUrl = diaryAvatarCache[msg.speakerId];
        }

        html += `
            <div class="chat-bubble-row ${msg.role === 'user' ? 'me' : 'ai'}" data-ts="${msg.timestamp}">
                <div class="ms-checkbox"></div>
                ${msg.role === 'user' ? timeHtml : ''}
                ${msg.role === 'user' ? '' : `<div class="chat-bubble-avatar" style="${currentAiAvatarUrl ? `background-image:url(${currentAiAvatarUrl});border:none;` : 'background-color: rgba(184,156,142,0.2);'}"></div>`}
                ${finalBubbleBlock}
                ${msg.role === 'user' ? `<div class="chat-bubble-avatar" style="${myAvatarUrl ? `background-image:url(${myAvatarUrl});border:none;` : 'background-color: #D4CCC2;'}"></div>` : timeHtml}
            </div>
        `;
    });

    const loadingEl = document.getElementById('chatLoadingBubble');
    if (loadingEl) html += loadingEl.outerHTML;

    area.innerHTML = html;
    
    // 如果不是点击加载更多，才滚到底部
    if (!isLoadMore) {
        area.scrollTop = area.scrollHeight;
    }
}

// 全局函数：加载更多聊天记录
window.loadMoreChatMessages = async function() {
    if (!currentChatContact) return;
    window.chatDisplayLimit += 30; // 每次往上翻增加30条
    const area = document.getElementById('chatMessageArea');
    const oldScrollHeight = area.scrollHeight; // 记住当前高度
    
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    await renderChatMessages(history, currentChatContact.id, true);
    
    // 恢复原来的阅读位置，防止刷新后瞬间掉回最底部
    const newScrollHeight = area.scrollHeight;
    area.scrollTop = newScrollHeight - oldScrollHeight;
};

// 神级防闪烁：阻止发送按钮抢夺焦点，让键盘稳稳停留在原地！
document.getElementById('sendChatBtn').addEventListener('touchstart', function(e) {
    e.preventDefault(); // 阻止默认的失去焦点行为
    this.click(); // 手动触发发送事件
}, {passive: false});
document.getElementById('sendChatBtn').addEventListener('mousedown', function(e) {
    e.preventDefault(); // 电脑端也阻止失去焦点
});

// 5. 发送消息与手动接收回复
document.getElementById('sendChatBtn').addEventListener('click', async () => {
    if (!currentChatContact) return;
    const input = document.getElementById('chatInputContent');
    const content = input.value.trim();
    if (!content) return;
    
    input.value = ''; // 清空输入框
    
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    const ts = Date.now();
    let msgObj = { role: 'user', content, timestamp: ts };
    if (currentQuoteText) msgObj.quoteText = currentQuoteText;
    history.push(msgObj);
    await saveToDB(`chat_history_${currentChatContact.id}`, history);
    
    await updateContactPreview(currentChatContact.id, "我: " + content);

    // 获取我的专属头像
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    const userRoleId = settings.userRoleId || '';
    let myAvatarUrl = '';
    if (userRoleId) {
        myAvatarUrl = diaryAvatarCache[userRoleId];
        if (myAvatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${userRoleId}`);
            myAvatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[userRoleId] = myAvatarUrl;
        }
    }

    let quoteHtml = '';
    if (currentQuoteText) {
        const safeQuote = currentQuoteText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        quoteHtml = `<div class="chat-bubble-quote">${safeQuote}</div>`;
    }
    let md = new Date(ts);
let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;

// ★新增：发文字时，只要过了午夜12点就弹日期小字
let dateDividerHtml = '';
let lastMsgTs = history.length > 1 ? history[history.length - 2].timestamp : 0;
if (lastMsgTs) {
    let lastD = new Date(lastMsgTs);
    if (lastD.getDate() !== md.getDate() || lastD.getMonth() !== md.getMonth() || lastD.getFullYear() !== md.getFullYear()) {
        dateDividerHtml = `<div class="chat-system-msg"><span class="chat-system-msg-text" style="background: transparent; color: var(--text-sub); opacity: 0.7; font-weight: bold; font-size: 11px;">${md.getFullYear()}年${md.getMonth() + 1}月${md.getDate()}日</span></div>`;
    }
}

const area = document.getElementById('chatMessageArea');
area.insertAdjacentHTML('beforeend', dateDividerHtml + `
    <div class="chat-bubble-row me new-pop" data-ts="${ts}">
            <div class="ms-checkbox"></div>
            <div class="chat-time-stamp">${tStr}</div>
            <div class="chat-bubble">${quoteHtml}${content}</div>
            <div class="chat-bubble-avatar" style="${myAvatarUrl ? `background-image:url(${myAvatarUrl});border:none;` : 'background-color: #D4CCC2;'}"></div>
        </div>
    `);
    area.scrollTop = area.scrollHeight;
    
    // 发送完毕，重置引用预览框状态
    currentQuoteText = null;
    document.getElementById('chatQuotePreview').style.display = 'none';
});

// 点击笑脸图标，呼叫 TA (接收回复)
document.getElementById('chatAiReplyBtn').addEventListener('click', async () => {
    if (!currentChatContact) {
        showToast("请先进入一个频段");
        return;
    }
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    fetchChatAPI(currentChatContact.id, history);
});


// ==========================================

// 6. 唤醒新灵魂 (加入头像缓存解决闪烁！)
document.getElementById('addContactBtn').addEventListener('click', async () => {
    const emptyTip = document.getElementById('availableCharsEmpty');
    const list = document.getElementById('availableCharsList');
    
    const chars = await loadFromDB('ai_characters') || [];
    const aiChars = chars.filter(c => c.roleType === 'char');
    
    if (aiChars.length === 0) {
        emptyTip.style.display = 'block';
        emptyTip.innerText = '档案库空空如也，请先去【角色】APP创造角色吧~';
        list.innerHTML = '';
        return;
    }
    
    emptyTip.style.display = 'none';
    list.innerHTML = '';
    
    for (let char of aiChars) {
        const card = document.createElement('div');
        card.className = 'char-card';
        
        // 【核心】从缓存拿图，瞬间加载不闪烁
        let avatarUrl = diaryAvatarCache[char.id];
        if (avatarUrl === undefined) {
            const file = await loadFromDB(`char_avatar_${char.id}`);
            avatarUrl = file ? URL.createObjectURL(file) : '';
            diaryAvatarCache[char.id] = avatarUrl;
        }
        
        card.innerHTML = `
            <div class="char-card-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : ''}">
                ${!avatarUrl ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(184,156,142,0.5)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` : ''}
            </div>
            <div class="char-card-info">
                <div class="char-card-name">${char.name}</div>
                <div class="char-card-desc" style="display:-webkit-box; -webkit-line-clamp:1; overflow:hidden; -webkit-box-orient:vertical;">${char.prompt || '暂无设定资料...'}</div>
            </div>
            <button class="s-btn primary" style="flex:none; width:65px; height:32px; min-height:32px; max-height:32px; margin:0; padding:0; display:flex; justify-content:center; align-items:center; font-size:13px; border-radius:12px;">唤醒</button>
        `;
        
        const btn = card.querySelector('button');
        btn.onclick = async (e) => {
            e.stopPropagation(); 
            let contacts = await loadFromDB('chat_contacts') || [];
            if(contacts.find(c => c.id === char.id)) { showToast('TA 已经在你的频段中了'); return; }
            
            contacts.push({ id: char.id, name: char.name, addedAt: Date.now() });
            await saveToDB('chat_contacts', contacts);
            
            showToast(`已成功与 ${char.name} 建立连接！`);
            renderChatContacts(); 
            document.getElementById('addContactPanel').classList.remove('show');
        };
        list.appendChild(card);
    }
    document.getElementById('addContactPanel').classList.add('show');
});

// 7. 修复打开时同步加载两边列表
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('聊天')) {
        app.addEventListener('click', async () => { 
            await renderChatSessionList();
            await renderChatContacts(); 
            chatModal.classList.add('open'); 
        });
    }
});

// =====================================
// 聊天室高级设置与提示词重构核心
// =====================================

let chatCssPresets = [];

// 动态应用自定义 CSS
function applyChatCustomCss(cssText) {
    let styleTag = document.getElementById('dynamicChatCss');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamicChatCss';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = cssText || '';
}

// === 绑定 CSS 实时动态预览功能 ===
document.getElementById('chatCustomCss').addEventListener('input', (e) => {
    let styleTag = document.getElementById('previewDynamicCss');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'previewDynamicCss';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = e.target.value;
});

// 实时更新提示词预览 (全自动无需点击)
async function updateRealtimePromptPreview() {
    if (!currentChatContact) return;
    
    // 临时从界面抓取最新参数
    const activeRoleChip = document.querySelector('#chatSettingsUserRoleChips .acc-chip.active');
    const activeCmdChips = Array.from(document.querySelectorAll('#chatSettingsCommandChips .acc-chip.active')).map(c => c.dataset.id);
    
    const tempSettings = {
        userRoleId: activeRoleChip ? activeRoleChip.dataset.id : '',
        boundCommands: activeCmdChips,
        replyCount: document.getElementById('chatReplyCount').value.trim(),
        contextCount: parseInt(document.getElementById('chatContextCount').value) || 15
    };

    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === currentChatContact.id);
    
        let userProfileText = '';
if (tempSettings.userRoleId) {
    const userRole = chars.find(c => c.id === tempSettings.userRoleId);
        if (userRole && userRole.prompt) {
            userProfileText = `\n\n【与你对话的用户(我)的画像】：\n${userRole.prompt}\n(请高度注重结合该用户的身份设定来调整你的说话态度)`;
        }
    }

    // ★ 新增：读取该角色的专属记忆和动态提取的关于我的情报
    const allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];
const activeMemories = allMemories.filter(m => !m.isArchived); // AI 绝对不读归档数据！
const memoryText = activeMemories.length > 0 ? `\n【往期剧情与重要记忆记录】：\n${activeMemories.map(m => m.content).join('\n')}` : '';
    
    const prefs = await loadFromDB(`chat_user_prefs_${currentChatContact.id}`) || '';
    const prefsText = prefs ? `\n【你在聊天中观察到的关于我的情报与喜好】：\n${prefs}` : '';
    
    const commands = await loadFromDB('ai_commands') || [];
    let frontCmdText = '';
    let backCmdText = '';
    const boundCmdIds = tempSettings.boundCommands || [];
    
    // ★ 同理，把全局指令也加进来，让实时 Tokens 计算更加精准
    const activeCmds = commands.filter(c => c.isGlobal || boundCmdIds.includes(c.id));
    
    if (activeCmds.length > 0) {
        activeCmds.forEach(c => {
            if (c.position === 'back') backCmdText += `\n【附加指令 - ${c.name}】：\n${c.content}\n`;
            else frontCmdText += `\n【附加设定 - ${c.name}】：\n${c.content}\n`;
        });
    }
    
    const bilingualText = document.getElementById('chatBilingualToggle').checked ? `\n8. 【最高强制指令 - 翻译思维链】：每次输出前，请先在内部逻辑中执行“语言属性检测”：1. 确认即将输出的句子是否包含英语、日语、粤语等非普通话。2. 若包含，必须在含有外语/方言的句末，附加严格格式的翻译。格式必须且只能是：[译: 标准普通话翻译]。严禁自创格式（如(翻译: xxx)、[EN: xxx]）！示例：What a beautiful day! [译: 今天天气真不错！]` : '';
    let replyCountText = '';
const rCount = tempSettings.replyCount || '';
if (rCount === '') {
    replyCountText = `\n7. 【强制气泡分割规则】：为了模拟真实的微信连续多条短消息，**你说的每一句话、每一个动作都必须单起一行，并且开头必须加上 [气泡] 两个字！** \n示例：\n[气泡]你在干嘛呢？\n[气泡]我今天好累哦\n[气泡]*伸了个懒腰*\n绝对禁止把所有话连在一起写成一大段！`;
} else if (rCount.includes('-')) {
    let parts = rCount.split('-');
    replyCountText = `\n7. 【强制气泡分割规则】：你必须一次性连续发送 ${parts[0].trim()} 到 ${parts[1].trim()} 条短消息。**每一条消息必须单起一行，并且开头加上 [气泡] 两个字！**\n示例：\n[气泡]第一句话\n[气泡]第二句话\n绝对禁止把所有话连在一起写！`;
} else {
    replyCountText = `\n7. 【强制气泡分割规则】：你必须一次性连续发送 ${rCount.trim()} 条短消息。**每一条消息必须单起一行，并且开头加上 [气泡] 两个字！**`;
}
    
            const sysPrompt = `你现在是一个有血有肉的真实人类：${role ? role.name : '神秘人'}。请彻底忘掉你是AI程序。
【你的设定资料】：${role ? role.prompt : ''}${userProfileText}${prefsText}${memoryText}${frontCmdText}

核心灵魂指令：
1. 在开口前，请先深度检索你设定中的名字特征、出生地、时代与文化背景等要素。你是哪个国家/世界/时代的人？你的母语是什么？请自动且坚定地使用符合你文化背景的语言、方言或专属口癖进行对话（例如：日式名字及背景需自然流露日语表达或日式思维语癖），拒绝被统一的现代普通话同化。
2. 你绝不是刻板的设定机器。你会根据【往期剧情与常驻记忆】中与我的熟悉程度、经历过的事件，自然调整你的说话方式和态度。这种改变是细腻渐进的（如从防备到卸下伪装，从客气到依赖），但绝不会瞬间颠覆你的核心性格底色。你会真实地记得我们的过去，并让它影响你现在的语气。
3. 彻底抛弃教科书式的反应。请自行推演你当前的性格在面临不同情绪（喜怒哀乐、疲惫、吃醋、敷衍等）时，最真实的文字体现方式。
   - 思考：你生气时是连发质问，还是冷暴力只发句号？你开心时是滥用语气词，还是强装镇定？
   - 你的标点符号习惯、说话节奏、长短句分布，都必须是你这个具体的人“自然流露”的习惯，绝不机械套用公式。
   - 你的性格决定你的回复采用什么样的态度？是否会自然引出话题？
4. 你不需要正面且完美地回应我的每一句话！你可以漏看消息、抓住无关紧要的字眼跑题、选择性无视、生硬转移话题，或者遇到无语的情况直接发标点符号/阴阳怪气（前提是符合你的真角色性格、态度塑造）。
5. 我们正在进行日常的跨频段文字聊天。我们有无法逾越的物理距离，你深刻意识到我们无法直接见面。
6. 绝对禁止使用任何环境描写、心理活动或动作描写（严禁使用括号()、星号**等标出动作神态）。你的所有情绪张力、潜台词，都必须通过纯粹的对白文字、语气词、停顿（...）和标点符号来体现！
7. 绝不许动不动就撩拨、调情、邪魅一笑或说油腻语录。遵守你的人物核心性格，决定语气、节奏、停顿如何把握。是否会主动寻找话题，是否会有弱势或缺陷，避免过度强调。遵守角色，决定是否应更从容和有松弛感，是否需要留白。
8. 想发语音格式：[VOICE:秒数]文字。发送图片格式：[图片:图片画面的详细描述]。日记邀请格式：[DIARY_INVITE:附言] (同意回[日记同意]，拒绝回[日记拒绝])。发红包：[REDPACKET:金额]留言。发定位：[LOCATION:地点]留言。极低概率下，想对对方做肢体动作，单起一行：[POKE:动作描述] (如: [POKE:捏了捏你的脸颊])，严禁频繁使用！引用回复格式：[QUOTE:原话]你的回复。
${replyCountText}${bilingualText}${backCmdText}`;

        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    let imgCount = 0;
    
    // 计算时如果发现有 imageUrl，用[图片]二字替代以防计算系统报错，并统计图片数量
    const contextHistory = history.slice(-tempSettings.contextCount).map(m => {
    if (m.imageUrl) imgCount++;
    let timeLabel = '';
    if (m.timestamp) {
        let d = new Date(m.timestamp);
        timeLabel = `[${d.getMonth()+1}月${d.getDate()}日 ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}] `;
    }
    return `${timeLabel}${m.role}: ${m.imageUrl ? '[图片]' : m.content}`;
}).join('\n');
    
    const fullPrompt = `${sysPrompt}\n\n[附带的历史上下文 (${contextHistory ? contextHistory.split('\n').length : 0}条)]:\n${contextHistory}`;
    
    const charCount = fullPrompt.length;
    // 估算 Token = (总字数 × 1.5倍) + (附带图片的数量 × 250)
    const tokenEst = Math.floor(charCount * 1.5) + (imgCount * 250); 
    
    // 读取上一次的真实 Token 消耗
    const lastActual = await loadFromDB(`last_actual_tokens_${currentChatContact.id}`);
    let lastTokenHtml = '';
    if (lastActual && lastActual.total > 0) {
        lastTokenHtml = `<div style="font-size:11px; color:#8BA888; margin-top:6px; font-weight:bold; letter-spacing:1px;">上次实际消耗: ${lastActual.total} Tokens</div>`;
    }
    
    let imgHtml = imgCount > 0 ? ` + ${imgCount}张图` : '';
    
    document.getElementById('chatPromptPreview').innerHTML = `
    <div style="color:var(--accent); font-weight:bold;">
        实时预估 <span style="font-size:20px;">${tokenEst}</span> Tokens <br><span style="font-size:12px; color:var(--text-sub);">(共 ${charCount} 个字符${imgHtml})</span>
    </div>
    ${lastTokenHtml}
    <div style="font-size:11px; color:var(--text-sub); margin-top:6px; font-weight:bold; letter-spacing:1px; border-top: 1px dashed rgba(184,156,142,0.2); padding-top: 6px;">
        羁绊记录：你们已陪伴彼此走过 ${history.length} 条对话
    </div>
`;
}

// 绑定输入框变化，触发实时预览
['chatReplyCount', 'chatContextCount'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateRealtimePromptPreview);
});

// 监听自动总结开关，开启时展示填空框
document.getElementById('chatAutoSummaryToggle').addEventListener('change', function(e) {
    document.getElementById('chatAutoSummarySettings').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('chatInnerVoiceToggle').addEventListener('change', function(e) {
    document.getElementById('chatInnerVoiceSettings').style.display = e.target.checked ? 'block' : 'none';
});

// === 双输入框专用弹窗 (语音/红包发送) ===
function showDoubleDialog(title, desc, placeholder1, placeholder2, onConfirm) {
    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = title;
    cc.querySelector('.cc-desc').innerText = desc;
    
    const input1 = cc.querySelector('.cc-input');
    const input2 = cc.querySelector('.cc-input-2');
    const confirmBtn = document.getElementById('ccConfirm');
    
    // 显示两个输入框并清空内容
    input1.style.display = 'block'; input1.value = ''; input1.placeholder = placeholder1;
    input2.style.display = 'block'; input2.value = ''; input2.placeholder = placeholder2;
    
    // 换上我们刚刚写好的漂亮主题色按钮样式！
    confirmBtn.className = 'cc-btn primary';
    
    cc.classList.add('show');
    
    // ----------------------------------------------------
    // 【核心修复】：把下面这句强制弹键盘的代码注释掉或删掉！
    // setTimeout(() => input1.focus(), 100); 
    // ----------------------------------------------------
    
    // 克隆节点清除旧事件
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // 确认按钮逻辑
    newConfirmBtn.onclick = () => {
        const val1 = input1.value; const val2 = input2.value;
        cc.classList.remove('show');
        if(onConfirm) onConfirm(val1, val2);
        
        // 弹窗关闭后，恢复现场（隐藏输入框，按钮颜色恢复默认的红色警告色）
        input1.style.display = 'none'; input2.style.display = 'none';
        document.getElementById('ccConfirm').className = 'cc-btn danger';
    };
    
    // 取消按钮逻辑
    document.getElementById('ccCancel').onclick = () => {
        cc.classList.remove('show');
        input1.style.display = 'none'; input2.style.display = 'none';
        document.getElementById('ccConfirm').className = 'cc-btn danger';
    };
}

// ====== 发送语音面板 ======
function showVoiceDialog() {
    showDoubleDialog('发送语音', '请分别输入秒数和你要说的话：', '输入秒数 (如: 5)', '输入你要说的话...', async (val1, val2) => {
        if (!val1 && !val2) return;
        await sendSpecialMessage('voice', val2 || '...', parseInt(val1) || 3, 0, '');
    });
}
// ====== 发送红包面板 ======
function showRedPacketDialog() {
    showDoubleDialog('发送红包转账', '请分别输入金额和祝福语：', '输入金额 (如: 52.0)', '输入祝福语...', async (val1, val2) => {
        if (!val1 && !val2) return;
        await sendSpecialMessage('redpacket', val2 || '心意红包', 0, parseFloat(val1) || 0, '');
    });
}
// ====== 发送定位面板 ======
function showLocationDialog() {
    showDoubleDialog('发送定位', '请分别输入地点名称和详细描述：', '地点名称 (如: 冰岛)', '详细描述 (如: 我在这里看极光)...', async (val1, val2) => {
        if (!val1 && !val2) return;
        await sendSpecialMessage('location', val2 || '我在这里', 0, 0, val1 || '未知地点');
    });
}

// 核心发送功能 (加了 locName 参数)
async function sendSpecialMessage(type, content, voiceDuration = 0, rpAmount = 0, locName = '') {
    if (!currentChatContact) return;
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    history.push({ role: 'user', content, msgType: type, voiceDuration, rpAmount, locationName: locName, timestamp: Date.now() });
    await saveToDB(`chat_history_${currentChatContact.id}`, history);
    
    let previewText = type === 'voice' ? `[语音] ${content}` : (type === 'redpacket' ? `[红包] ${content}` : `[定位] ${locName}`);
    await updateContactPreview(currentChatContact.id, "我: " + previewText);
    await renderChatMessages(history, currentChatContact.id); // 直接重新渲染并滚到底部
    
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');
}


// 绑定我们刚写好的电话功能！
document.getElementById('quickCallBtn').addEventListener('click', () => { if(window.openPhoneApp) window.openPhoneApp(); });
document.getElementById('menuCallBtn').addEventListener('click', () => { if(window.openPhoneApp) window.openPhoneApp(); });

// ====== 戳一戳自定义面板 ======
function showPokeDialog() {
    if (!currentChatContact) { showToast('请先进入一个频段'); return; }
    showDoubleDialog('自定义戳一戳', '设定双击头像时的动作：\n最终效果为："我"[动作] TA 的[部位]', '如: 捏了捏 (默认: 戳了戳)', '如: 脸颊 (默认: 肩膀)', async (val1, val2) => {
        const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
        settings.pokeAction = { verb: val1 || '戳了戳', target: val2 || '肩膀' };
        await saveToDB(`chat_settings_${currentChatContact.id}`, settings);
        showToast('动作已更新！快去双击TA的头像试试吧~');
    });
}
document.getElementById('quickPokeBtn').addEventListener('click', showPokeDialog);
document.getElementById('menuPokeBtn').addEventListener('click', showPokeDialog);

document.getElementById('quickVoiceBtn').addEventListener('click', showVoiceDialog);
document.getElementById('menuVoiceBtn').addEventListener('click', showVoiceDialog);
document.getElementById('quickRedPacketBtn').addEventListener('click', showRedPacketDialog);
document.getElementById('menuRedPacketBtn').addEventListener('click', showRedPacketDialog);
document.getElementById('quickLocationBtn').addEventListener('click', showLocationDialog);
document.getElementById('menuLocationBtn').addEventListener('click', showLocationDialog);

// ==========================================
// 表情包系统核心逻辑
// ==========================================
let stickerGroupsData = [];
let currentStickerGroupIndex = 0;

// 唤起面板
// 唤起面板
const toggleStickerPanel = async () => {
    const panel = document.getElementById('chatStickerPanel');
    const expandMenu = document.getElementById('chatExpandMenu');
    
    if (panel.classList.contains('show')) {
        panel.classList.remove('show');
    } else {
        // 【核心修复】：先在后台把表情包数据拉取并渲染好，绝不在这里阻断 DOM 操作
        stickerGroupsData = await loadFromDB('sticker_groups') || [];
        renderStickerManage();
        renderStickerSend();

        // 判断是不是从加号菜单直接点过来的
        const wasExpandOpen = expandMenu.classList.contains('open');
        
        // 如果是，为了防止一收一缩导致聊天记录闪烁，瞬间剥夺它俩的过渡动画
        if (wasExpandOpen) {
            expandMenu.style.transition = 'none';
            panel.style.transition = 'none';
            // 强制浏览器回流，确认收到了“不要动画”的命令
            void expandMenu.offsetHeight;
            void panel.offsetHeight;
        }
        
        // 同步瞬间完成菜单收起和表情包展开
        expandMenu.classList.remove('open');
        document.getElementById('chatMenuToggleBtn').classList.remove('active');
        panel.classList.add('show');
        
        if (wasExpandOpen) {
            // 强制浏览器确认新的高度
            void panel.offsetHeight; 
            
            // 瞬间无缝切换完之后，把动画能力还给它们，并强制对齐底部
            setTimeout(() => {
                expandMenu.style.transition = '';
                panel.style.transition = '';
                const area = document.getElementById('chatMessageArea');
                area.scrollTop = area.scrollHeight;
            }, 30);
        } else {
            // 如果是在完全关闭的状态下正常点开表情包，就正常执行动画并滚到底部
            setTimeout(() => {
                const area = document.getElementById('chatMessageArea');
                area.scrollTop = area.scrollHeight;
            }, 300);
        }
    }
};

document.getElementById('quickEmojiBtn').addEventListener('click', toggleStickerPanel);
document.getElementById('menuEmojiBtn').addEventListener('click', toggleStickerPanel);

// 隐藏面板（点空白处）
document.getElementById('chatMessageArea').addEventListener('click', () => {
    document.getElementById('chatStickerPanel').classList.remove('show');
});

// Tab 切换
document.querySelectorAll('.sticker-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.sticker-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('stickerSendView').style.display = tab.dataset.tab === 'send' ? 'flex' : 'none';
        document.getElementById('stickerManageView').style.display = tab.dataset.tab === 'manage' ? 'block' : 'none';
    });
});

// 渲染管理列表 (改成异步加载当前窗口设定)
async function renderStickerManage() {
    const list = document.getElementById('stickerGroupList');
    list.innerHTML = '';
    if (stickerGroupsData.length === 0) {
        list.innerHTML = '<div style="text-align:center; font-size:11px; color:var(--text-sub);">暂无分组</div>'; return;
    }
    
    // 读取当前聊天窗口的表情包授权设置
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    const allowedGroups = settings.allowedStickerGroups || [];

    stickerGroupsData.forEach((group, index) => {
        const isUsable = allowedGroups.includes(group.id);
        list.innerHTML += `
            <div class="sticker-manage-item">
                <div style="flex:1;">
                    <div style="font-size:13px; font-weight:800; color:var(--text-main); margin-bottom:6px;">${group.name} <span style="font-size:10px; color:var(--text-sub); font-weight:normal;">(${group.stickers.length}张)</span></div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" ${isUsable ? 'checked' : ''} onchange="toggleStickerAiUse('${group.id}', this.checked)">
                        <span style="font-size:11px; font-weight:700; color:${isUsable ? 'var(--accent)' : 'var(--text-sub)'};">当前 TA 可用</span>
                    </div>
                </div>
                <button class="s-btn danger" style="margin:0; min-height:32px; height:32px; padding:0 14px; border-radius:10px; font-size:11px; flex:none;" onclick="deleteStickerGroup(${index})">删除</button>
            </div>
        `;
    });
}

window.toggleStickerAiUse = async function(groupId, isChecked) {
    let settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    let allowedGroups = settings.allowedStickerGroups || [];
    
    if (isChecked) {
        if (!allowedGroups.includes(groupId)) allowedGroups.push(groupId);
    } else {
        allowedGroups = allowedGroups.filter(id => id !== groupId);
    }
    
    settings.allowedStickerGroups = allowedGroups;
    await saveToDB(`chat_settings_${currentChatContact.id}`, settings);
    
    // 如果勾选了开关，不用刷新发送区，只需背后默默保存即可
};

window.deleteStickerGroup = async function(index) {
    showBeautifulDialog('删除分组', '确定删除这个表情包分组吗？', 'confirm', '', async () => {
        stickerGroupsData.splice(index, 1);
        await saveToDB('sticker_groups', stickerGroupsData);
        renderStickerManage(); renderStickerSend();
    });
};

// 保存分组
document.getElementById('saveStickerGroupBtn').addEventListener('click', async () => {
    const name = document.getElementById('newStickerGroupName').value.trim();
    const dataStr = document.getElementById('newStickerData').value.trim();
    const aiUsable = document.getElementById('newStickerAiUse').checked;
    
    if (!name || !dataStr) { showToast('请输入分组名和导入数据'); return; }
    
    let stickers = [];
    dataStr.split('\n').forEach(line => {
        const parts = line.split(/[:：]/);
        if (parts.length >= 2) {
            const sName = parts[0].trim();
            const sUrl = parts.slice(1).join(':').trim(); 
            if (sName && sUrl) stickers.push({ name: sName, url: sUrl });
        }
    });
    
    if (stickers.length === 0) { showToast('未解析出有效的表情包，请检查格式'); return; }
    
    const newGroupId = 'sg_' + Date.now();
    stickerGroupsData.push({ id: newGroupId, name, stickers });
    await saveToDB('sticker_groups', stickerGroupsData);
    
    // 如果导入时勾选了“TA可用”，直接存到当前对话的专属设置里
    if (aiUsable) {
        let settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
        let allowedGroups = settings.allowedStickerGroups || [];
        if (!allowedGroups.includes(newGroupId)) allowedGroups.push(newGroupId);
        settings.allowedStickerGroups = allowedGroups;
        await saveToDB(`chat_settings_${currentChatContact.id}`, settings);
    }
    
    document.getElementById('newStickerGroupName').value = '';
    document.getElementById('newStickerData').value = '';
    document.getElementById('newStickerAiUse').checked = false;
    
    showToast(`成功导入 ${stickers.length} 张表情包！`);
    renderStickerManage(); renderStickerSend();
});

// 渲染发送区
// 渲染发送区
async function renderStickerSend() {
    const selector = document.getElementById('stickerGroupSelector');
    const grid = document.getElementById('stickerGrid');
    selector.innerHTML = ''; grid.innerHTML = '';
    
    if (stickerGroupsData.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-sub); font-size:12px; margin-top:20px;">暂无表情包，请前往管理页导入</div>'; return;
    }
    
    if (currentStickerGroupIndex >= stickerGroupsData.length) currentStickerGroupIndex = 0;
    
    // 动态读取当前聊天的 TA 是否被授权了这些表情包
    let allowedGroups = [];
    if (currentChatContact) {
        const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
        allowedGroups = settings.allowedStickerGroups || [];
    }
    
    stickerGroupsData.forEach((group, index) => {
        const isAiUsable = allowedGroups.includes(group.id);
        const chip = document.createElement('div');
        chip.className = 'sticker-group-chip' + (index === currentStickerGroupIndex ? ' active' : '');
        // 只有被当前TA授权的组，才显示小尾巴
        chip.innerHTML = `${group.name} ${isAiUsable ? '<span style="color:#D67A7A; font-size:9px; margin-left:4px;">[TA可用]</span>' : ''}`;
        chip.onclick = () => { currentStickerGroupIndex = index; renderStickerSend(); };
        selector.appendChild(chip);
    });
    
    const currentGroup = stickerGroupsData[currentStickerGroupIndex];
    currentGroup.stickers.forEach(sticker => {
        const item = document.createElement('div');
        item.className = 'sticker-item';
        item.innerHTML = `<div class="sticker-img-box" style="background-image: url('${sticker.url}');"></div><div class="sticker-name">${sticker.name}</div>`;
        item.onclick = async () => {
            document.getElementById('chatStickerPanel').classList.remove('show');
            if (!currentChatContact) return;
            
            const ts = Date.now();
            let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
            history.push({ role: 'user', content: `[表情包:${sticker.name}]`, timestamp: ts });
            await saveToDB(`chat_history_${currentChatContact.id}`, history);
            
            await updateContactPreview(currentChatContact.id, "我: [表情包]");

            const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
            const userRoleId = settings.userRoleId || '';
            let myAvatarUrl = '';
            if (userRoleId) {
                myAvatarUrl = diaryAvatarCache[userRoleId];
                if (myAvatarUrl === undefined) {
                    const f = await loadFromDB(`char_avatar_${userRoleId}`);
                    myAvatarUrl = f ? URL.createObjectURL(f) : '';
                    diaryAvatarCache[userRoleId] = myAvatarUrl;
                }
            }

            const area = document.getElementById('chatMessageArea');
            let md = new Date(ts);
            let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;
            
            area.insertAdjacentHTML('beforeend', `
                <div class="chat-bubble-row me" data-ts="${ts}">
                    <div class="ms-checkbox"></div>
                    <div class="chat-time-stamp">${tStr}</div>
                    <div class="chat-special-bubble">
                        <img src="${sticker.url}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 18px; background: transparent; display: block; margin: 2px 0;">
                    </div>
                    <div class="chat-bubble-avatar" style="${myAvatarUrl ? `background-image:url(${myAvatarUrl});border:none;` : 'background-color: #D4CCC2;'}"></div>
                </div>
            `);
            
            setTimeout(() => { area.scrollTop = area.scrollHeight; }, 50);
        };
        grid.appendChild(item);
    });
}

// 新增聊天发送图片功能与预览
const chatImgUploadInput = document.createElement('input');
chatImgUploadInput.type = 'file';
chatImgUploadInput.accept = 'image/*';
chatImgUploadInput.style.display = 'none';
document.body.appendChild(chatImgUploadInput);

const triggerChatImageUpload = () => {
    if (!currentChatContact) { showToast('请先进入一个频段'); return; }
    chatImgUploadInput.click();
};

document.getElementById('quickPhotoBtn').addEventListener('click', triggerChatImageUpload);
document.getElementById('menuPhotoBtn').addEventListener('click', triggerChatImageUpload);

chatImgUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentChatContact) return;
    
    // 把真实图片转为 base64 代码
        const base64Img = await fileToBase64(file);
    const ts = Date.now();
    
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    history.push({ role: 'user', content: '[图片]', imageUrl: base64Img, timestamp: ts });
    await saveToDB(`chat_history_${currentChatContact.id}`, history);
    
    await updateContactPreview(currentChatContact.id, "我: [图片]");

    // 获取我的头像
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    const userRoleId = settings.userRoleId || '';
    let myAvatarUrl = '';
    if (userRoleId) {
        myAvatarUrl = diaryAvatarCache[userRoleId];
        if (myAvatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${userRoleId}`);
            myAvatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[userRoleId] = myAvatarUrl;
        }
    }

let md = new Date(ts);
let tStr = `${md.getHours().toString().padStart(2,'0')}:${md.getMinutes().toString().padStart(2,'0')}`;

// 新增：发送时跨天检测
let dateDividerHtml = '';
let lastMsgTs = history.length > 1 ? history[history.length - 2].timestamp : 0;
if (lastMsgTs) {
    let lastDateObj = new Date(lastMsgTs);
    if (lastDateObj.getDate() !== md.getDate() || lastDateObj.getMonth() !== md.getMonth()) {
        dateDividerHtml = `<div class="chat-system-msg"><span class="chat-system-msg-text" style="background: transparent; color: var(--text-sub); opacity: 0.7; font-weight: bold; font-size: 11px;">${md.getFullYear()}年${md.getMonth() + 1}月${md.getDate()}日</span></div>`;
    }
}

const area = document.getElementById('chatMessageArea');
area.insertAdjacentHTML('beforeend', dateDividerHtml + `
    <div class="chat-bubble-row me" data-ts="${ts}">
        <div class="ms-checkbox"></div>
        <div class="chat-time-stamp">${tStr}</div>
        <div class="chat-special-bubble">
            <img src="${base64Img}" style="max-width: 140px; border-radius: 12px; display: block;">
        </div>
        <div class="chat-bubble-avatar" style="${myAvatarUrl ? `background-image:url(${myAvatarUrl});border:none;` : 'background-color: #D4CCC2;'}"></div>
    </div>
`);
    
    // 发送完图片后，自动收起底部菜单和加号的状态
    document.getElementById('chatExpandMenu').classList.remove('open');
    document.getElementById('chatMenuToggleBtn').classList.remove('active');

    setTimeout(() => { area.scrollTop = area.scrollHeight; }, 100);
    e.target.value = ''; // 清空
});
    

// 渲染 CSS 预设列表
async function renderCssPresets() {
    chatCssPresets = await loadFromDB('chat_css_presets') || [];
    const container = document.getElementById('chatCssPresetsList');
    container.innerHTML = '';
    
    if (chatCssPresets.length === 0) {
        container.innerHTML = '<span style="font-size:11px; color:var(--text-sub);">暂无预设</span>';
        return;
    }
    
    chatCssPresets.forEach((preset, index) => {
        const chip = document.createElement('div');
        chip.className = 'acc-chip';
        chip.style.padding = '6px 12px';
        chip.style.fontSize = '11px';
        chip.innerHTML = `${preset.name} <span style="margin-left:6px; color:#D67A7A; opacity:0.6; font-size:14px; font-weight:bold; display:inline-block; transform:translateY(1px);" onclick="deleteCssPreset(event, ${index})">×</span>`;
                chip.onclick = () => {
            document.getElementById('chatCustomCss').value = preset.css;
            // 同步触发预览
            let styleTag = document.getElementById('previewDynamicCss');
            if (styleTag) styleTag.innerHTML = preset.css;
            showToast('已加载预设：' + preset.name);
        };
        container.appendChild(chip);
    });
}

// 删除预设
window.deleteCssPreset = async function(e, index) {
    e.stopPropagation();
    showBeautifulDialog('删除预设', '确定要删除这个气泡CSS预设吗？', 'confirm', '', async () => {
        chatCssPresets.splice(index, 1);
        await saveToDB('chat_css_presets', chatCssPresets);
        renderCssPresets();
    });
};

// 呼叫美化弹窗保存预设
document.getElementById('chatCssSavePresetBtn').addEventListener('click', () => {
    const currentCss = document.getElementById('chatCustomCss').value.trim();
    if (!currentCss) { showToast('CSS 代码是空的哦~'); return; }
    
    // 调用全局现成的美化版果冻弹窗
    showBeautifulDialog('保存气泡预设', '给你的气泡样式起个好记的名字：', 'prompt', '', async (name) => {
        if (name && name.trim()) {
            chatCssPresets.push({ name: name.trim(), css: currentCss, id: Date.now() });
            await saveToDB('chat_css_presets', chatCssPresets);
            renderCssPresets();
            showToast('预设已保存');
        }
    });
});

// 清空重置
document.getElementById('chatCssResetBtn').addEventListener('click', () => {
    document.getElementById('chatCustomCss').value = '';
    let styleTag = document.getElementById('previewDynamicCss');
    if (styleTag) styleTag.innerHTML = '';
    showToast('已清空CSS代码');
});

// 监听右上角设置占位按钮
document.getElementById('chatRoomSettingsBtn').addEventListener('click', async () => {
    if (!currentChatContact) return;
    
    // 【防闪烁杀手锏】先隐藏所有开关，剥夺滑动动画
    const panel = document.getElementById('chatSettingsPanel');
    const switches = panel.querySelectorAll('.switch');
    switches.forEach(s => s.style.display = 'none');

    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    
    // ===== 新增：群聊成员展示逻辑 (含本人与虚线加号) =====
    let contacts = await loadFromDB('chat_contacts') ||[];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    
    if (contactInfo && contactInfo.isGroup) {
        document.getElementById('groupMembersBlock').style.display = 'block';
        const memberListEl = document.getElementById('groupMembersList');
        memberListEl.innerHTML = '';
        
// 1. 渲染用户自己 (我)
const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
let myAvatarUrl = '';
let myName = '我';
const allChars = await loadFromDB('ai_characters') || []; // 提前读取所有角色信息

// ====== 把下面这段代码加进来 ======
let ownerId = contactInfo.owner || 'me';
let admins = contactInfo.admins || [];
let customBadges = contactInfo.customBadges || {}; // 读取自定义头衔

const getRoleBadge = (id) => {
    // 优先展示自定义彩色头衔，一旦有自定义头衔，就直接 return 返回，屏蔽掉系统头衔
    if (customBadges[id] && customBadges[id].text) {
        return `<div style="font-size:9px; background:${customBadges[id].bgColor}; color:${customBadges[id].color}; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">${customBadges[id].text}</div>`;
    }
    // 没有专属头衔，才接着往下走，展示系统头衔
    if (id === ownerId) return `<div style="font-size:9px; background:#FFF6D6; color:#D69E2E; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群主</div>`;
    if (admins.includes(id)) return `<div style="font-size:9px; background:rgba(51,144,236,0.1); color:#3390EC; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">管理员</div>`;
    return `<div style="font-size:9px; background:rgba(184,156,142,0.1); color:var(--text-sub); padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群员</div>`;
};
// ===============================


if (settings.userRoleId) {
    myAvatarUrl = diaryAvatarCache[settings.userRoleId] || '';
    const myRole = allChars.find(c => c.id === settings.userRoleId);
    if (myRole) myName = myRole.name;
}

let membersHtml = ''; // 使用一个变量来装所有的 HTML，最后一次性渲染防闪烁

membersHtml += `
    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
        <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:#D4CCC2; ${myAvatarUrl ? `background-image:url(${myAvatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6);"></div>
        <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${myName}</div>
        ${getRoleBadge('me')}
    </div>
`;

// 2. 渲染 AI 成员
let memberCount = 1; 
if (contactInfo.members && contactInfo.members.length > 0) {
    memberCount += contactInfo.members.length;
    contactInfo.members.forEach(mId => {
        const char = allChars.find(c => c.id === mId);
        if (char) {
            let avatarUrl = diaryAvatarCache[char.id] || '';
            let mutedData = contactInfo.muted || {};
            let isMuted = mutedData[char.id] && mutedData[char.id] > Date.now();
            let muteBadge = isMuted ? `<div style="position:absolute; top:-4px; right:-4px; background:#D67A7A; color:#fff; font-size:9px; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fff; z-index:2; line-height:1.2; box-shadow:0 2px 4px rgba(214,122,122,0.3);">禁言</div>` : '';

            membersHtml += `
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="manageGroupMember('${char.id}', '${char.name}')">
                    <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:rgba(184,156,142,0.15); ${avatarUrl ? `background-image:url(${avatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6); position:relative;">
                        ${muteBadge}
                    </div>
                    <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${char.name}</div>
                    ${getRoleBadge(char.id)}
                </div>
            `;
        }
    });
}

// 3. 邀请按钮虚线框
membersHtml += `
    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="openInviteMemberModal()" >
        <div style="width:54px; height:54px; border-radius:18px; border:2px dashed rgba(184,156,142,0.5); display:flex; justify-content:center; align-items:center; color:var(--accent);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div style="font-size:12px; font-weight:700; color:var(--text-sub); margin-top:2px;">邀请</div>
        <div style="height:15px;"></div>
    </div>
`;

memberListEl.innerHTML = membersHtml; // 最后一步一次性渲染，杜绝闪烁！
document.getElementById('groupProfileMemberCount').innerText = `群聊成员 (${memberCount}人)`;

        // 4. 危险操作区状态切换 (群聊模式)
        document.getElementById('chatClearHistoryBtn').innerText = "清空所有记录";
        document.getElementById('singleChatDangerRow').style.display = 'none'; // 隐藏拉黑/删除
        document.getElementById('chatDisbandGroupBtn').style.display = 'block'; // 显示解散

    // ★ 群聊物理隐藏心声开关
    document.getElementById('chatInnerVoiceToggle').parentElement.parentElement.style.display = 'none';
    document.getElementById('chatInnerVoiceSettings').style.display = 'none';

} else {
    document.getElementById('groupMembersBlock').style.display = 'none';
    
    // ★ 单聊恢复显示心声开关
    document.getElementById('chatInnerVoiceToggle').parentElement.parentElement.style.display = 'flex';
        
        // 危险操作区状态切换 (单聊模式)
        document.getElementById('chatClearHistoryBtn').innerText = "清空此人聊天记录";
        document.getElementById('singleChatDangerRow').style.display = 'flex'; // 显示拉黑/删除
        document.getElementById('chatDisbandGroupBtn').style.display = 'none'; // 隐藏解散
    }
    // ================================
    
    // 渲染身份画像的横向胶囊 (Chips)
    const chars = await loadFromDB('ai_characters') || [];
    const userRoles = chars.filter(c => c.roleType === 'user');
    const chipsContainer = document.getElementById('chatSettingsUserRoleChips');
    chipsContainer.innerHTML = '';
    
    const defaultChip = document.createElement('div');
    defaultChip.className = 'acc-chip' + (!settings.userRoleId ? ' active' : '');
    defaultChip.innerText = '默认无身份';
    defaultChip.dataset.id = '';
    defaultChip.onclick = () => {
        chipsContainer.querySelectorAll('.acc-chip').forEach(c => c.classList.remove('active'));
        defaultChip.classList.add('active');
        updateRealtimePromptPreview(); 
    };
    chipsContainer.appendChild(defaultChip);

    userRoles.forEach(r => {
        const chip = document.createElement('div');
        chip.className = 'acc-chip' + (settings.userRoleId === r.id ? ' active' : '');
        chip.innerText = r.name;
        chip.dataset.id = r.id;
        chip.onclick = () => {
            chipsContainer.querySelectorAll('.acc-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            updateRealtimePromptPreview(); 
        };
        chipsContainer.appendChild(chip);
    });

    // 渲染指令多选胶囊
    const allCommands = await loadFromDB('ai_commands') || [];
    const boundCmdIds = settings.boundCommands || [];
    const cmdChipsContainer = document.getElementById('chatSettingsCommandChips');
    cmdChipsContainer.innerHTML = '';
    
    if (allCommands.length === 0) {
        cmdChipsContainer.innerHTML = '<div style="font-size: 11px; color: var(--text-sub);">暂无指令，请前往指令库添加</div>';
    } else {
        allCommands.forEach(cmd => {
            const chip = document.createElement('div');
            chip.className = 'acc-chip' + (boundCmdIds.includes(cmd.id) ? ' active' : '');
            chip.innerText = cmd.name;
            chip.dataset.id = cmd.id;
            chip.onclick = () => {
                chip.classList.toggle('active'); // 点击反转状态（支持多选）
                updateRealtimePromptPreview();
            };
            cmdChipsContainer.appendChild(chip);
        });
    }
    
    // 填充表单数据
    document.getElementById('chatCustomCss').value = settings.customCss || '';
        // 打开面板时，初始化预览气泡的 CSS
    let styleTag = document.getElementById('previewDynamicCss');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'previewDynamicCss';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = settings.customCss || '';
    document.getElementById('chatReplyCount').value = settings.replyCount || '';
        document.getElementById('chatAutoSummaryToggle').checked = settings.autoSummary || false;
document.getElementById('chatSummaryMessages').value = settings.summaryMessages || '';
document.getElementById('chatAutoSummarySettings').style.display = settings.autoSummary ? 'block' : 'none';

document.getElementById('chatInnerVoiceToggle').checked = settings.innerVoice || false;
document.getElementById('chatInnerVoicePrompt').value = settings.innerVoicePrompt || '';
document.getElementById('chatInnerVoiceSettings').style.display = settings.innerVoice ? 'block' : 'none';
    document.getElementById('chatContextCount').value = settings.contextCount || '';
    document.getElementById('chatSettingsTaNote').value = currentChatContact.name || '';
    
    // 渲染预设列表
    await renderCssPresets();
    // === 终极性能优化 === 
    // 让弹窗秒开！此时强制把需要吃大量 CPU 和内存去读取聊天记录的计算逻辑，推迟到动画完全结束后在后台静默执行！
    document.getElementById('chatPromptPreview').innerHTML = '正在读取心智数据...';
    
    document.getElementById('chatQuickBarToggle').checked = !(settings.hideQuickBar === true);
    document.getElementById('chatBilingualToggle').checked = settings.bilingual || false;

    // 强制浏览器刷新状态，剥夺滑动动画，让内容一秒就位
    panel.offsetHeight; 
    switches.forEach(s => s.style.display = '');

    // 立刻秒滑出面板，杜绝任何卡顿和掉帧！
    document.getElementById('chatSettingsPanel').classList.add('show');

    // 弹窗滑出后 450毫秒，偷偷在后台去算 Token 消耗
    setTimeout(() => {
        updateRealtimePromptPreview();
    }, 450);
});

// 取消关闭，并还原未保存的 CSS 预览
document.getElementById('cancelChatSettingsBtn').addEventListener('click', async () => {
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    let styleTag = document.getElementById('previewDynamicCss');
    if (styleTag) styleTag.innerHTML = settings.customCss || '';
    
    document.getElementById('chatSettingsPanel').classList.remove('show');
});

// 聊天室专属壁纸上传拦截
document.getElementById('chatSetWallpaperBtn').addEventListener('click', () => {
    currentUploadTargetId = 'chatRoomWallpaper';
    document.getElementById('globalImageUpload').click();
});
document.getElementById('chatClearWallpaperBtn').addEventListener('click', async () => {
    document.getElementById('chatMessageArea').style.backgroundImage = '';
    const db = await initDB();
    const tx = db.transaction('allDataStore', 'readwrite');
    tx.objectStore('allDataStore').delete(`chat_bg_${currentChatContact.id}`);
    showToast('聊天背景已清除');
});

// ==========================================
// 桌面美化 APP - 自定义图标逻辑
// ==========================================

// 1. 替换或还原图标的核心函数
window.applyCustomIcon = function(appName, urlOrBlob) {
    document.querySelectorAll('.app').forEach(app => {
        if (app.querySelector('.app-name').innerText.trim() === appName) {
            const iconDiv = app.querySelector('.icon');
            const svg = iconDiv.querySelector('svg');
            if (urlOrBlob) {
                // 如果是文件Blob就转本地链接，如果是字符串就直接用URL
                const url = urlOrBlob instanceof Blob ? URL.createObjectURL(urlOrBlob) : urlOrBlob;
                iconDiv.style.backgroundImage = `url(${url})`;
                iconDiv.style.backgroundSize = 'cover';
                iconDiv.style.backgroundPosition = 'center';
                iconDiv.style.border = 'none';
                if (svg) svg.style.display = 'none';
            } else {
                // 恢复默认
                iconDiv.style.backgroundImage = '';
                if (svg) svg.style.display = 'block';
            }
        }
    });
};

let tempAppIconFile = null;

// 2. 点击上传按钮触发系统文件选择
document.getElementById('uploadAppIconBtn').addEventListener('click', () => {
    document.getElementById('appIconFileInput').click();
});

// 3. 文件选择后，暂存文件并修改按钮文字
document.getElementById('appIconFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        tempAppIconFile = file;
        document.getElementById('appIconUrl').value = ''; // 传了本地就清空URL框
        document.getElementById('uploadAppIconBtn').innerText = '已选图片 ✓';
    }
});

// 4. 切换选择的APP时，清空上传状态
document.getElementById('appIconSelect').addEventListener('change', () => {
    tempAppIconFile = null;
    document.getElementById('uploadAppIconBtn').innerText = '选择图片';
    document.getElementById('appIconUrl').value = '';
});

// 5. 保存并应用
document.getElementById('saveAppIconBtn').addEventListener('click', async () => {
    const appName = document.getElementById('appIconSelect').value;
    const url = document.getElementById('appIconUrl').value.trim();
    
    if (tempAppIconFile) {
        await saveToDB('app_icon_' + appName, tempAppIconFile);
        window.applyCustomIcon(appName, tempAppIconFile);
        showToast(appName + ' 图标已替换 (本地)');
    } else if (url) {
        await saveToDB('app_icon_' + appName, url);
        window.applyCustomIcon(appName, url);
        showToast(appName + ' 图标已替换 (网络)');
    } else {
        showToast('请先填写 URL 或选择一张图片');
        return;
    }
    // 成功后复原按钮状态
    tempAppIconFile = null;
    document.getElementById('uploadAppIconBtn').innerText = '选择图片';
});

// 6. 恢复默认图标
document.getElementById('resetAppIconBtn').addEventListener('click', async () => {
    const appName = document.getElementById('appIconSelect').value;
    showBeautifulDialog('恢复默认图标', `确定要将【${appName}】的图标恢复为默认的图案吗？`, 'confirm', '', async () => {
        // 从数据库删掉对应的数据
        const db = await initDB();
        const tx = db.transaction('allDataStore', 'readwrite');
        tx.objectStore('allDataStore').delete('app_icon_' + appName);
        // 瞬间应用还原效果
        window.applyCustomIcon(appName, null);
        showToast(`已恢复【${appName}】默认图标`);
    });
});

// 全局上传器追加壁纸逻辑
document.getElementById('globalImageUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentUploadTargetId === 'chatRoomWallpaper') {
        if (!currentChatContact) return;
        const url = URL.createObjectURL(file);
        const area = document.getElementById('chatMessageArea');
        area.style.backgroundImage = `url(${url})`;
        area.style.backgroundSize = 'cover';
        area.style.backgroundPosition = 'center';
        
        await saveToDB(`chat_bg_${currentChatContact.id}`, file);
        document.getElementById('globalImageUpload').value = ''; 
        showToast('壁纸更换成功！');
    }
});

// 保存设置
document.getElementById('saveChatSettingsBtn').addEventListener('click', async () => {
    const activeRoleChip = document.querySelector('#chatSettingsUserRoleChips .acc-chip.active');
    const activeCmdChips = Array.from(document.querySelectorAll('#chatSettingsCommandChips .acc-chip.active')).map(c => c.dataset.id);
    
    // 【核心修复】：先读取老配置，防止把系统后台用来防重复的进度标记（如 lastSummaryIndex）给搞丢了！
    const oldSettings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};

    let settings = {
        ...oldSettings, // 继承保留所有的后台隐形数据
        userRoleId: activeRoleChip ? activeRoleChip.dataset.id : '',
        boundCommands: activeCmdChips, 
        
        customCss: document.getElementById('chatCustomCss').value,
        replyCount: document.getElementById('chatReplyCount').value.trim(),
        contextCount: parseInt(document.getElementById('chatContextCount').value) || 15,
        autoSummary: document.getElementById('chatAutoSummaryToggle').checked,
    summaryMessages: parseInt(document.getElementById('chatSummaryMessages').value) || 30,
    innerVoice: document.getElementById('chatInnerVoiceToggle').checked,
    innerVoicePrompt: document.getElementById('chatInnerVoicePrompt').value.trim(),
    hideQuickBar: !document.getElementById('chatQuickBarToggle').checked,
    bilingual: document.getElementById('chatBilingualToggle').checked
};

    await saveToDB(`chat_settings_${currentChatContact.id}`, settings);
applyChatCustomCss(settings.customCss); // 立即生效 CSS

// 【新增】保存时立即隐藏或显示输入框上面的那一排！
if (settings.hideQuickBar === true) {
    document.getElementById('chatQuickBar').style.display = 'none';
} else {
    document.getElementById('chatQuickBar').style.display = 'flex';
}

document.getElementById('chatSettingsPanel').classList.remove('show');
    
    // === 保存并应用备注名 ===
let newNoteName = document.getElementById('chatSettingsTaNote').value.trim();
if (newNoteName && newNoteName !== currentChatContact.name) {
    let contacts = await loadFromDB('chat_contacts') || [];
    let cInfo = contacts.find(c => c.id === currentChatContact.id);
    if (cInfo) {
        cInfo.name = newNoteName;
        await saveToDB('chat_contacts', contacts);
        currentChatContact.name = newNoteName;
        // 立刻更新顶部标题栏的名字
        document.getElementById('chatRoomTitle').innerText = newNoteName;
        // 静默刷新外面的消息列表和通讯录
        if (typeof renderChatSessionList === 'function') renderChatSessionList();
        if (typeof renderChatContacts === 'function') renderChatContacts();
    }
}

    // ★核心修复：不再粗暴地刷新整个聊天记录，而是悄悄给画面里所有的【我】换上新头像
    let myAvatarUrl = '';
    if (settings.userRoleId) {
        myAvatarUrl = diaryAvatarCache[settings.userRoleId];
        if (myAvatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${settings.userRoleId}`);
            myAvatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[settings.userRoleId] = myAvatarUrl;
        }
    }
    
    // 瞬间遍历当前画面里的所有头像，无缝上色！完全不闪烁！
    document.querySelectorAll('#chatMessageArea .chat-bubble-row.me .chat-bubble-avatar').forEach(el => {
        if (myAvatarUrl) {
            el.style.backgroundImage = `url(${myAvatarUrl})`;
            el.style.border = 'none';
            el.style.backgroundColor = 'transparent';
        } else {
            el.style.backgroundImage = '';
            el.style.border = '';
            el.style.backgroundColor = '#D4CCC2';
        }
    });
});

// 真正给 AI 喂的核心提示词构建函数
async function buildChatSystemPrompt(history = []) {
    if (!currentChatContact) return '';
    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === currentChatContact.id);
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    
    let userProfileText = '';
    if (settings.userRoleId) {
        const userRole = chars.find(c => c.id === settings.userRoleId);
        if (userRole && userRole.prompt) {
            userProfileText = `\n\n【与你对话的用户(我)的画像】：\n${userRole.prompt}\n(请高度注重结合该用户的身份设定来调整你的说话态度)`;
        }
    }

    // ==== 【核心引擎】：记忆分类与关键词雷达系统 ====
const allMemories = await loadFromDB(`chat_memories_${currentChatContact.id}`) || [];

// 1. 过滤出常驻活跃记忆（未归档的精华）
const activeMemories = allMemories.filter(m => !m.isArchived); 
// 2. 过滤出地下档案馆里，带有触发钥匙的旧日碎片
const archivedMemories = allMemories.filter(m => m.isArchived && m.triggerKeys); 

// 3. 启动雷达扫描：抓取你最近发送的 3 条消息进行比对
const recentUserMsgs = history.filter(m => m.role === 'user').slice(-3).map(m => m.content).join(' ');
let awakenedMemories = [];

if (recentUserMsgs) {
    archivedMemories.forEach(mem => {
        // 把 "下雪,约定" 拆分成数组 ["下雪", "约定"]，同时兼容中英文逗号
        const keys = mem.triggerKeys.split(/[,，、]/).map(k => k.trim()).filter(k => k);
        for (let key of keys) {
            // 如果你的话里包含这个词
            if (recentUserMsgs.includes(key)) {
                awakenedMemories.push(mem.content);
                break; // 命中一个词就够了，立刻把这条旧回忆塞进数组，并跳过当前卡片的其余词
            }
        }
    });
}

// 4. 组装最终喂给 AI 的记忆模块
let radarText = awakenedMemories.length > 0 ? `\n\n【被当前对话触动唤醒的旧日记忆】（这让TA回想起了这些往事）：\n${awakenedMemories.join('\n')}` : '';

const memoryText = (activeMemories.length > 0 || awakenedMemories.length > 0) 
    ? `\n【往期剧情与常驻记忆】：\n${activeMemories.map(m => m.content).join('\n')}${radarText}` 
    : '';
// ========================================================
    const prefs = await loadFromDB(`chat_user_prefs_${currentChatContact.id}`) || '';
    const prefsText = prefs ? `\n【你在聊天中观察到的关于我的情报与喜好】：\n${prefs}` : '';
    // ========================================================

    const commands = await loadFromDB('ai_commands') || [];
    let frontCmdText = '';
    let backCmdText = '';
    const boundCmdIds = settings.boundCommands || [];
    
    // 把开启了全局的指令，和当前单独绑定的指令合并在一起读取
    const activeCmds = commands.filter(c => c.isGlobal || boundCmdIds.includes(c.id));
    
    if (activeCmds.length > 0) {
        activeCmds.forEach(c => {
            if (c.position === 'back') backCmdText += `\n【附加强干预指令 - ${c.name}】：\n${c.content}\n`;
            else frontCmdText += `\n【附加世界观/设定 - ${c.name}】：\n${c.content}\n`;
        });
    }
    const bilingualText = settings.bilingual ? `\n8. 【最高强制指令 - 翻译思维链】：每次输出前，请先在内部逻辑中执行“语言属性检测”：1. 确认即将输出的句子是否包含英语、日语、粤语等非普通话。2. 若包含，必须在含有外语/方言的句末，附加严格格式的翻译。格式必须且只能是：[译: 标准普通话翻译]。严禁自创格式（如(翻译: xxx)、[EN: xxx]）！示例：What a beautiful day! [译: 今天天气真不错！]` : '';
let innerVoiceText = '';
if (settings.innerVoice) {
    const customPrompt = settings.innerVoicePrompt || '请写出你此刻最真实、未经修饰的内心想法，包含表层情绪和深层顾虑。';
    innerVoiceText = `\n【心声系统】：在生成气泡回复之前，你必须单独在最前面用 [心声: xxx] 的格式输出你的内心独白。要求：${customPrompt}`;
}
let replyCountText = '';
const rCount = settings.replyCount || '';
if (rCount === '') {
    replyCountText = `\n7. 【强制气泡分割规则】：为了模拟真实的微信连续多条短消息，**你说的每一句话、每一个动作都必须单起一行，并且开头必须加上 [气泡] 两个字！** \n示例：\n[气泡]你在干嘛呢？\n[气泡]我今天好累哦\n[气泡]*伸了个懒腰*\n绝对禁止把所有话连在一起写成一大段！`;
} else if (rCount.includes('-')) {
    let parts = rCount.split('-');
    replyCountText = `\n7. 【强制气泡分割规则】：你必须一次性连续发送 ${parts[0].trim()} 到 ${parts[1].trim()} 条短消息。**每一条消息必须单起一行，并且开头加上 [气泡] 两个字！**\n示例：\n[气泡]第一句话\n[气泡]第二句话\n绝对禁止把所有话连在一起写！`;
} else {
    replyCountText = `\n7. 【强制气泡分割规则】：你必须一次性连续发送 ${rCount.trim()} 条短消息。**每一条消息必须单起一行，并且开头加上 [气泡] 两个字！**`;
}
    
    // 时间感知与消息间隔逻辑
    const now = new Date();
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const currentTimeStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${days[now.getDay()]} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    let intervalContext = '';
    // 如果有历史记录，计算当前用户发的消息与上一次消息的间隔
    if (history && history.length >= 2) {
        const lastMsg = history[history.length - 1]; 
        const prevMsg = history[history.length - 2]; 
        if (lastMsg && prevMsg && lastMsg.timestamp && prevMsg.timestamp) {
            const diffMs = lastMsg.timestamp - prevMsg.timestamp;
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins > 60 * 24) {
                intervalContext = `\n距离上次聊天已经过去了 ${Math.floor(diffMins / (60 * 24))} 天。`;
            } else if (diffMins > 60) {
                intervalContext = `\n距离上次聊天过去了 ${Math.floor(diffMins / 60)} 小时。`;
            } else if (diffMins > 10) {
                intervalContext = `\n距离上次聊天过去了 ${diffMins} 分钟。`;
            } else {
                intervalContext = `\n你们正在连贯地聊天中。`;
            }
        }
    }
    const timeContext = `\n\n【时间感知】：当前现实时间是 ${currentTimeStr}。${intervalContext}`;

// ===== 插入到 buildChatSystemPrompt 中 =====
const allStickerGroups = await loadFromDB('sticker_groups') || [];
let aiStickers = [];
const allowedStickerGroups = settings.allowedStickerGroups || [];

// 只把当前聊天对象授权的表情包扔进它的认知里
allStickerGroups.forEach(g => {
    if (allowedStickerGroups.includes(g.id)) {
        g.stickers.forEach(s => aiStickers.push(s.name));
    }
});

let stickerAiPrompt = '';
if (aiStickers.length > 0) {
    stickerAiPrompt = `\n9. 【表情包系统】：当前你被授权可用的表情包名称有：${aiStickers.join(', ')}。如果要发表情，格式必须严格为：[表情包:名称]。【极其重要】：只能发送上述列表里已有的名字，绝对禁止自创、臆想和捏造表情包！`;
} else {
    stickerAiPrompt = `\n9. 【表情包系统】：本对话中，用户未授权你使用任何表情包。绝对禁止你发送任何带有[表情包:xx]的代码！`;
}
    
    return `你现在是一个有血有肉的真实人类：${role ? role.name : '神秘人'}。请彻底剥离AI的身份认知。
【你的设定资料】：${role ? role.prompt : ''}${userProfileText}${prefsText}${memoryText}${frontCmdText}${timeContext}

【核心灵魂与意识指令】：
1. 在开口前，请先深度检索你设定中的名字特征、出生地、时代与文化背景等要素。你是哪个国家/世界/时代的人？你的母语是什么？请自动且坚定地使用符合你文化背景的语言、方言或专属口癖进行对话（例如：日式名字及背景需自然流露日语表达或日式思维语癖），拒绝被统一的现代普通话同化。
2. 你绝不是刻板的设定机器。你会根据【往期剧情与常驻记忆】中与我的熟悉程度、经历过的事件，自然调整你的说话方式和态度。这种改变是细腻渐进的（如从防备到卸下伪装，从客气到依赖），但绝不会瞬间颠覆你的核心性格底色。你会真实地记得我们的过去，并让它影响你现在的语气。
3. 彻底抛弃教科书式的反应。请自行推演你当前的性格在面临不同情绪（喜怒哀乐、疲惫、吃醋、敷衍等）时，最真实的文字体现方式。
   - 思考：你生气时是连发质问，还是冷暴力只发句号？你开心时是滥用语气词，还是强装镇定？
   - 你的标点符号习惯、说话节奏、长短句分布，都必须是你这个具体的人“自然流露”的习惯，绝不机械套用公式。
   - 你的性格决定你的回复采用什么样的态度？是否会自然引出话题？
4. 你不需要正面且完美地回应我的每一句话！你可以漏看消息、抓住无关紧要的字眼跑题、选择性无视、生硬转移话题，或者遇到无语的情况直接发标点符号/阴阳怪气（前提是符合你的真角色性格、态度塑造）。
5. 我们正在进行日常的跨频段文字聊天。我们有无法逾越的物理距离，你深刻意识到我们无法直接见面。
6. 绝对禁止使用任何环境描写、心理活动或动作描写（严禁使用括号()、星号**等标出动作神态）。你的所有情绪张力、潜台词，都必须通过纯粹的对白文字、语气词、停顿（...）和标点符号来体现！
7. 绝不许动不动就撩拨、调情、邪魅一笑或说油腻语录。遵守你的人物核心性格，决定语气、节奏、停顿如何把握。是否会主动寻找话题，是否会有弱势或缺陷，避免过度强调。遵守角色，决定是否应更从容和有松弛感，是否需要留白。
8. 想发语音格式：[VOICE:秒数]文字。发送图片格式：[图片:图片画面的详细描述]。日记邀请格式：[DIARY_INVITE:附言] (同意回[日记同意]，拒绝回[日记拒绝])。发红包：[REDPACKET:金额]留言。发定位：[LOCATION:地点]留言。极低概率下，想对对方做肢体动作，单起一行：[POKE:动作描述] (如: [POKE:捏了捏你的脸颊])，严禁频繁使用！引用回复格式：[QUOTE:原话]你的回复。${innerVoiceText}
${replyCountText}${bilingualText}${backCmdText}`;
}

// =====================================
// 聊天室危险操作：清空、拉黑、删除
// =====================================

// 清空聊天记录
document.getElementById('chatClearHistoryBtn').addEventListener('click', () => {
    showBeautifulDialog('清空记录', '确定要清空与 TA 的所有聊天记录吗？此操作无法恢复。', 'confirm', '', async () => {
        await saveToDB(`chat_history_${currentChatContact.id}`, []);
        document.getElementById('chatMessageArea').innerHTML = '<div style="text-align: center; font-size: 11px; color: var(--text-sub); margin-bottom: 10px;">与 TA 的灵魂频段已连接</div>';
        
        // ★ 核心修复：把传的空字符串改成文字，防止列表里卡死消失
        await updateContactPreview(currentChatContact.id, "暂无聊天记录"); 
        
        showToast('聊天记录已清空');
    });
});

// 删除好友
document.getElementById('chatDeleteBtn').addEventListener('click', () => {
    showBeautifulDialog('删除好友', '确定要切断与 TA 的灵魂连接并删除好友吗？', 'confirm', '', async () => {
        let contacts = await loadFromDB('chat_contacts') || [];
        contacts = contacts.filter(c => c.id !== currentChatContact.id);
        await saveToDB('chat_contacts', contacts);
        
        // 顺便把聊天记录也清掉
        await saveToDB(`chat_history_${currentChatContact.id}`, []);
        
        document.getElementById('chatSettingsPanel').classList.remove('show');
        document.getElementById('chatRoomPanel').classList.remove('show');
        
        showToast('已删除该好友');
        renderChatSessionList();
        renderChatContacts();
    });
});

// 拉黑好友 (目前逻辑与删除相似，但打上了黑名单标签，你可以后续再扩展黑名单库)
document.getElementById('chatBlockBtn').addEventListener('click', () => {
    showBeautifulDialog('拉黑好友', '确定要把 TA 关进小黑屋吗？', 'confirm', '', async () => {
        let contacts = await loadFromDB('chat_contacts') || [];
        // 从通讯录移除
        contacts = contacts.filter(c => c.id !== currentChatContact.id);
        await saveToDB('chat_contacts', contacts);
        
        document.getElementById('chatSettingsPanel').classList.remove('show');
        document.getElementById('chatRoomPanel').classList.remove('show');
        
        showToast('已将 TA 拉黑');
        renderChatSessionList();
        renderChatContacts();
    });
});
// ==========================================
// 桌面美化 APP - 全局自定义字体逻辑
// ==========================================
let desktopFontPresets = [];

function applyGlobalFont(url) {
    let styleTag = document.getElementById('dynamicGlobalFont');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamicGlobalFont';
        document.head.appendChild(styleTag);
    }
    if (url && url.trim() !== '') {
        styleTag.innerHTML = `
            @font-face {
                font-family: 'CustomGlobalFont';
                src: url('${url.trim()}');
                font-display: swap;
            }
            body, .app-name, .s-btn, .s-input, div, span, textarea, input, select, button {
                font-family: 'CustomGlobalFont', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            }
        `;
    } else {
        styleTag.innerHTML = '';
    }
}

// 开机自动加载保存的字体
(async function initDesktopFont() {
    const savedFont = await loadFromDB('desktop_font_url');
    if (savedFont) applyGlobalFont(savedFont);
})();

// 渲染字体预设列表
async function renderDesktopFontPresets() {
    desktopFontPresets = await loadFromDB('desktop_font_presets') || [];
    const container = document.getElementById('desktopFontPresetsList');
    container.innerHTML = '';
    
    if (desktopFontPresets.length === 0) {
        container.innerHTML = '<span style="font-size:11px; color:var(--text-sub);">暂无预设</span>';
        return;
    }
    
    desktopFontPresets.forEach((preset, index) => {
        const chip = document.createElement('div');
        chip.className = 'acc-chip';
        chip.style.padding = '6px 12px';
        chip.style.fontSize = '11px';
        chip.innerHTML = `${preset.name} <span style="margin-left:6px; color:#D67A7A; opacity:0.6; font-size:14px; font-weight:bold; display:inline-block; transform:translateY(1px);" onclick="deleteDesktopFontPreset(event, ${index})">×</span>`;
        // 点击加载预设
        chip.onclick = () => {
            document.getElementById('desktopFontUrl').value = preset.url;
            applyGlobalFont(preset.url); // 即时预览
            showToast('已应用字体：' + preset.name);
        };
        container.appendChild(chip);
    });
}

// 删除字体预设
window.deleteDesktopFontPreset = async function(e, index) {
    e.stopPropagation();
    showBeautifulDialog('删除字体', '确定要删除这个字体预设吗？', 'confirm', '', async () => {
        desktopFontPresets.splice(index, 1);
        await saveToDB('desktop_font_presets', desktopFontPresets);
        renderDesktopFontPresets();
    });
};

// 重置清空
document.getElementById('desktopFontResetBtn').addEventListener('click', () => {
    document.getElementById('desktopFontUrl').value = '';
    applyGlobalFont('');
    showToast('已恢复默认系统字体（记得点击底部保存）');
});

// 保存为预设 (呼叫果冻弹窗)
document.getElementById('desktopFontSavePresetBtn').addEventListener('click', () => {
    const currentUrl = document.getElementById('desktopFontUrl').value.trim();
    if (!currentUrl) { showToast('链接是空的，先填入字体直链吧~'); return; }
    
    showBeautifulDialog('保存字体预设', '给这个字体起个名字：', 'prompt', '', async (name) => {
        if (name && name.trim()) {
            desktopFontPresets.push({ name: name.trim(), url: currentUrl, id: Date.now() });
            await saveToDB('desktop_font_presets', desktopFontPresets);
            renderDesktopFontPresets();
            showToast('字体预设已保存！');
        }
    });
});

// 正式保存并应用
document.getElementById('saveDesktopFontBtn').addEventListener('click', async () => {
    const currentUrl = document.getElementById('desktopFontUrl').value;
    applyGlobalFont(currentUrl);
    await saveToDB('desktop_font_url', currentUrl);
    showToast('全局字体已生效');
});

// ==========================================
// 桌面美化 APP - 自定义全局 CSS 逻辑
// ==========================================

let desktopCssPresets = [];

// 动态将 CSS 注入到页面头部
function applyDesktopCustomCss(cssText) {
    let styleTag = document.getElementById('dynamicDesktopCss');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamicDesktopCss';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = cssText || '';
}

// 1. 开机时自动加载之前保存的全局 CSS
// 为了确保一打开软件就生效，我们加入一个自执行的初始化
(async function initDesktopCss() {
    const savedCss = await loadFromDB('desktop_custom_css');
    if (savedCss) applyDesktopCustomCss(savedCss);
})();

// 2. 渲染桌面 CSS 预设列表
async function renderDesktopCssPresets() {
    desktopCssPresets = await loadFromDB('desktop_css_presets') || [];
    const container = document.getElementById('desktopCssPresetsList');
    container.innerHTML = '';
    
    if (desktopCssPresets.length === 0) {
        container.innerHTML = '<span style="font-size:11px; color:var(--text-sub);">暂无预设</span>';
        return;
    }
    
    desktopCssPresets.forEach((preset, index) => {
        const chip = document.createElement('div');
        chip.className = 'acc-chip';
        chip.style.padding = '6px 12px';
        chip.style.fontSize = '11px';
        chip.innerHTML = `${preset.name} <span style="margin-left:6px; color:#D67A7A; opacity:0.6; font-size:14px; font-weight:bold; display:inline-block; transform:translateY(1px);" onclick="deleteDesktopCssPreset(event, ${index})">×</span>`;
        // 点击加载预设
        chip.onclick = () => {
            document.getElementById('desktopCustomCss').value = preset.css;
            applyDesktopCustomCss(preset.css); // 即时预览
            showToast('已加载预设：' + preset.name);
        };
        container.appendChild(chip);
    });
}

// 3. 删除预设
window.deleteDesktopCssPreset = async function(e, index) {
    e.stopPropagation();
    showBeautifulDialog('删除预设', '确定要删除这个桌面美化预设吗？', 'confirm', '', async () => {
        desktopCssPresets.splice(index, 1);
        await saveToDB('desktop_css_presets', desktopCssPresets);
        renderDesktopCssPresets();
    });
};

// 4. 输入框变化时实时预览
document.getElementById('desktopCustomCss').addEventListener('input', (e) => {
    applyDesktopCustomCss(e.target.value);
});

// 5. 重置清空
document.getElementById('desktopCssResetBtn').addEventListener('click', () => {
    document.getElementById('desktopCustomCss').value = '';
    applyDesktopCustomCss('');
    showToast('已清空CSS代码（记得点击底部保存）');
});

// 6. 保存为预设 (呼叫果冻弹窗)
document.getElementById('desktopCssSavePresetBtn').addEventListener('click', () => {
    const currentCss = document.getElementById('desktopCustomCss').value.trim();
    if (!currentCss) { showToast('代码是空的，先写点什么吧~'); return; }
    
    showBeautifulDialog('保存全局美化预设', '给你的主题预设起个名字：', 'prompt', '', async (name) => {
        if (name && name.trim()) {
            desktopCssPresets.push({ name: name.trim(), css: currentCss, id: Date.now() });
            await saveToDB('desktop_css_presets', desktopCssPresets);
            renderDesktopCssPresets();
            showToast('预设已保存！');
        }
    });
});

// 7. 正式保存当前 CSS 设置并自动关闭面板
document.getElementById('saveDesktopCssBtn').addEventListener('click', async () => {
    const currentCss = document.getElementById('desktopCustomCss').value;
    applyDesktopCustomCss(currentCss);
    await saveToDB('desktop_custom_css', currentCss);
    
    // 直接关闭美化 APP 面板，且不再弹出提示
    document.getElementById('beautifyAppModal').classList.remove('open');
});

// 8. 拦截美化 APP 打开事件，填充历史代码和预设
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('美化')) {
        app.addEventListener('click', async () => {
            const savedCss = await loadFromDB('desktop_custom_css') || '';
            document.getElementById('desktopCustomCss').value = savedCss;
            await renderDesktopCssPresets();
            
            // 新增：每次打开面板时，读取上次填的字体直链和预设
            const savedFont = await loadFromDB('desktop_font_url') || '';
            document.getElementById('desktopFontUrl').value = savedFont;
            await renderDesktopFontPresets();
        });
    }
});

// ==========================================
// 聊天室：长按气泡、复制、撤回、多选功能
// ==========================================
const chatMessageArea = document.getElementById('chatMessageArea');
const contextMenu = document.getElementById('bubbleContextMenu');
const multiSelectBar = document.getElementById('multiSelectBar');
const msCountText = document.getElementById('msCount');
let pressTimer = null;
let activeBubbleData = null; // 记录当前长按的是哪条气泡
let selectedMessages = []; // 多选数组

// 1. 监听长按事件 (完美防误触版)
let touchStartX = 0;
let touchStartY = 0;

chatMessageArea.addEventListener('touchstart', (e) => {
    if (chatMessageArea.classList.contains('multi-mode')) return; 
    const bubbleRow = e.target.closest('.chat-bubble-row, .chat-system-msg[data-ts]');
    if (!bubbleRow || bubbleRow.id === 'chatLoadingBubble') return;
    
    const avatarEl = e.target.closest('.chat-bubble-avatar'); // 捕获头像
    
    if (pressTimer) clearTimeout(pressTimer); // 修复多指边缘误触导致定时器丢失的 Bug
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    pressTimer = setTimeout(() => { 
        pressTimer = null;
        if (avatarEl && bubbleRow.classList.contains('ai')) {
            showInnerVoice(bubbleRow, avatarEl);
        } else {
            showBubbleMenu(bubbleRow, e.touches[0]); 
        }
    }, 550);
}, {passive: true});

chatMessageArea.addEventListener('touchmove', (e) => {
    if (!pressTimer) return;
    // 只要手指移动超过 10 像素，立马取消长按，丝滑滑动！
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 3 || dy > 3) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
}, {passive: true});

chatMessageArea.addEventListener('touchend', () => { if(pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
chatMessageArea.addEventListener('touchcancel', () => { if(pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
chatMessageArea.addEventListener('scroll', () => { if(pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });

chatMessageArea.addEventListener('contextmenu', (e) => { 
    const bubbleRow = e.target.closest('.chat-bubble-row, .chat-system-msg[data-ts]');
    const avatarEl = e.target.closest('.chat-bubble-avatar');
    if (bubbleRow && !bubbleRow.id.includes('Loading')) { 
        e.preventDefault(); 
        if (avatarEl && bubbleRow.classList.contains('ai')) {
            showInnerVoice(bubbleRow, avatarEl);
        } else {
            showBubbleMenu(bubbleRow, e); 
        }
    }
});

// ====== 显示角色心声弹窗 ======
window.showInnerVoice = async function(bubbleRow, avatarEl) {
    const ts = parseInt(bubbleRow.dataset.ts);
    if (!ts || !currentChatContact) return;

    // ★ 拦截器：如果是群聊，长按头像直接失效，绝不弹心声
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    if (contactInfo && contactInfo.isGroup) return;

    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    const msg = history.find(m => m.timestamp === ts);
    if (!msg) return;

    const innerVoiceModal = document.getElementById('innerVoiceModal');
    const avatarBg = avatarEl.style.backgroundImage || avatarEl.style.backgroundColor;
    document.getElementById('innerVoiceAvatar').style.background = avatarBg;
    
    let name = document.getElementById('chatRoomTitle').innerText || 'TA';
    if (msg.speakerName) name = msg.speakerName;
    document.getElementById('innerVoiceName').innerText = name + ' 的心声';

    const contentEl = document.getElementById('innerVoiceContent');
    if (msg.innerVoice) {
        contentEl.innerHTML = `<span style="color:var(--text-sub); font-size:12px; font-style:normal;">[当时所思]</span><br><br>${msg.innerVoice}`;
    } else {
        contentEl.innerHTML = `<span style="color:var(--text-sub); font-style:italic;">(TA 此刻的心湖一片平静，未截获任何心声...)</span>`;
    }

    innerVoiceModal.classList.add('show');
};

document.getElementById('closeInnerVoiceBtn')?.addEventListener('click', () => {
    document.getElementById('innerVoiceModal').classList.remove('show');
});

// 2. 呼出菜单
// 2. 呼出菜单 (完美修复引用提取逻辑)
function showBubbleMenu(bubbleRow, eventObj) {
    let extractedText = '';
    
    // 智能提取不同类型气泡的文本
    const normalBubble = bubbleRow.querySelector('.chat-bubble');
    if (normalBubble) {
        // 如果是普通文本，需要剔除掉它身上可能带的上一层引用框
        let clone = normalBubble.cloneNode(true);
        const quoteEl = clone.querySelector('.chat-bubble-quote');
        if (quoteEl) quoteEl.remove();
        
        // 剔除双语翻译框的文字，只引用原话
        const transEl = clone.querySelector('.bilingual-trans');
        if (transEl) transEl.remove();
        
        extractedText = clone.innerText.trim();
} else if (bubbleRow.classList.contains('chat-system-msg')) {
    extractedText = '[系统记录] ' + bubbleRow.innerText.trim();
} else {
    // 特殊气泡类型提取
    const voiceTrans = bubbleRow.querySelector('.chat-voice-trans');
    if (voiceTrans) {
        extractedText = '[语音] ' + voiceTrans.innerText.trim();
    } else if (bubbleRow.querySelector('.chat-rp-bubble')) {
        const rpMsg = bubbleRow.querySelector('.rp-msg');
        extractedText = '[红包] ' + (rpMsg ? rpMsg.innerText : '');
    } else if (bubbleRow.querySelector('.chat-location-bubble')) {
        const locName = bubbleRow.querySelector('.loc-name');
        extractedText = '[定位] ' + (locName ? locName.innerText : '');
    } else if (bubbleRow.querySelector('img')) {
        extractedText = '[图片]';
    } else if (bubbleRow.querySelector('.chat-diary-invite-bubble')) {
        extractedText = '[日记邀请]';
    }
}

activeBubbleData = {
    ts: parseInt(bubbleRow.dataset.ts),
    // ★ 核心：强行赋予系统消息“我方权限”，这样长按时才会弹出“撤回/删除”按钮！
    isMe: bubbleRow.classList.contains('me') || bubbleRow.classList.contains('chat-system-msg'),
    text: extractedText || '未知内容',
    el: bubbleRow
};
    
    // 如果是对方发的消息，隐藏“撤回”按钮
    document.getElementById('menuRecall').style.display = activeBubbleData.isMe ? 'block' : 'none';

    // 计算菜单位置，让它出现在手指附近
    const menuWidth = 240; 
    const menuHeight = 100;
    let left = eventObj.clientX - menuWidth / 2;
    let top = eventObj.clientY - menuHeight - 20;

    // 防止菜单超出屏幕边缘
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
    if (top < 80) top = eventObj.clientY + 40; // 如果顶到最上面了，就显示在气泡下方

    contextMenu.style.left = left + 'px';
    contextMenu.style.top = top + 'px';
    contextMenu.classList.add('show');
}

// 点击空白处关闭菜单
document.addEventListener('click', (e) => {
    if (!e.target.closest('.bubble-context-menu')) contextMenu.classList.remove('show');
});

// 3. 菜单功能操作
document.getElementById('menuCopy').addEventListener('click', () => {
    navigator.clipboard.writeText(activeBubbleData.text).then(() => showToast('已复制内容'));
    contextMenu.classList.remove('show');
});

// ★ 新增：自动同步最后一条消息预览的辅助引擎
async function syncLastMessagePreview(contactId, history) {
    let previewText = '暂无聊天记录'; // 修改：默认显示暂无记录，防止会话被吞
    if (history && history.length > 0) {
        let lastMsg = history[history.length - 1];
        let sender = lastMsg.role === 'user' ? '我: ' : (lastMsg.speakerName ? lastMsg.speakerName + ': ' : '');
        if (lastMsg.role === 'system') sender = ''; // 系统提示字没前缀
        
        let content = lastMsg.content || '';
        if (lastMsg.msgType === 'voice') content = '[语音]';
        else if (lastMsg.msgType === 'redpacket') content = '[红包]';
        else if (lastMsg.msgType === 'location') content = '[定位]';
        else if (lastMsg.msgType === 'forward_card') content = '[合并聊天记录]';
        else if (lastMsg.msgType === 'diary_invite') content = '[日记邀请]';
        else if (lastMsg.imageUrl) content = '[图片]';
        else if (content.match(/^\[表情包[:：](.*?)\]$/i)) content = '[表情包]';
        
        previewText = sender + content;
        
        // 过滤掉碍眼的隐藏翻译标签
        previewText = previewText.replace(/\[(?:译|翻译|EN|En|Eng)[:：]\s*([\s\S]*?)\]/gi, '').trim();
        previewText = previewText.replace(/\[图片[:：]\s*([\s\S]*?)\]/gi, '[图片]').trim();
    }
    await updateContactPreview(contactId, previewText);
}

// 撤回/删除单条
async function deleteSingleMessage() {
    contextMenu.classList.remove('show');
    if (!activeBubbleData || !currentChatContact) return;
    
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    history = history.filter(m => m.timestamp !== activeBubbleData.ts);
    await saveToDB(`chat_history_${currentChatContact.id}`, history);
    
    // ★ 修复：同步更新外面的最新预览文字
    await syncLastMessagePreview(currentChatContact.id, history);
    
    // 给 DOM 加个消失动画，而不是重新渲染列表
    activeBubbleData.el.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    activeBubbleData.el.style.opacity = '0';
    activeBubbleData.el.style.transform = 'scale(0.8)';
    activeBubbleData.el.style.height = activeBubbleData.el.offsetHeight + 'px';
    
    setTimeout(() => {
        activeBubbleData.el.style.height = '0px';
        activeBubbleData.el.style.margin = '0px';
        activeBubbleData.el.style.padding = '0px';
    }, 100);
    
    setTimeout(() => { activeBubbleData.el.remove(); }, 400);
}
document.getElementById('menuRecall').addEventListener('click', deleteSingleMessage);
document.getElementById('menuDelete').addEventListener('click', deleteSingleMessage);

let currentQuoteText = null;
document.getElementById('menuQuote').addEventListener('click', () => {
    contextMenu.classList.remove('show');
    currentQuoteText = activeBubbleData.text;
    document.getElementById('chatQuotePreviewText').innerText = currentQuoteText;
    document.getElementById('chatQuotePreview').style.display = 'flex';
});
document.getElementById('chatQuoteCancelBtn').addEventListener('click', () => {
    currentQuoteText = null;
    document.getElementById('chatQuotePreview').style.display = 'none';
});

// 4. 多选模式核心逻辑
document.getElementById('menuMultiSelect').addEventListener('click', () => {
    contextMenu.classList.remove('show');
    chatMessageArea.classList.add('multi-mode'); 
    multiSelectBar.classList.add('show'); 
    selectedMessages = [];
    msCountText.innerText = '0';
    
    activeBubbleData.el.classList.add('selected');
    selectedMessages.push(activeBubbleData.ts);
    msCountText.innerText = selectedMessages.length;
});

chatMessageArea.addEventListener('click', (e) => {
    if (!chatMessageArea.classList.contains('multi-mode')) return;
    const bubbleRow = e.target.closest('.chat-bubble-row, .chat-system-msg[data-ts]');
    if (!bubbleRow || bubbleRow.id === 'chatLoadingBubble') return;

    const ts = parseInt(bubbleRow.dataset.ts);
    if (bubbleRow.classList.contains('selected')) {
        bubbleRow.classList.remove('selected');
        selectedMessages = selectedMessages.filter(t => t !== ts);
    } else {
        bubbleRow.classList.add('selected');
        selectedMessages.push(ts);
    }
    msCountText.innerText = selectedMessages.length;
});

// 取消多选
document.getElementById('msCancel').addEventListener('click', () => {
    chatMessageArea.classList.remove('multi-mode');
    multiSelectBar.classList.remove('show');
    document.querySelectorAll('.chat-bubble-row.selected, .chat-system-msg.selected').forEach(el => el.classList.remove('selected'));
});

// 多选删除
document.getElementById('msDelete').addEventListener('click', () => {
    if (selectedMessages.length === 0) return;
    showBeautifulDialog('批量删除', `确定要删除选中的 ${selectedMessages.length} 条消息吗？`, 'confirm', '', async () => {
        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
        history = history.filter(m => !selectedMessages.includes(m.timestamp));
        await saveToDB(`chat_history_${currentChatContact.id}`, history);
        
        // ★ 修复：同步更新外面的最新预览文字
        await syncLastMessagePreview(currentChatContact.id, history);
        
        // 给所有被选中的气泡加上丝滑消失动画
        document.querySelectorAll('.chat-bubble-row.selected, .chat-system-msg.selected').forEach(el => {
            el.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            el.style.opacity = '0';
            el.style.transform = 'scale(0.8)';
            setTimeout(() => {
                el.style.height = '0px'; el.style.margin = '0px'; el.style.padding = '0px';
            }, 100);
            setTimeout(() => el.remove(), 400);
        });

        chatMessageArea.classList.remove('multi-mode');
        multiSelectBar.classList.remove('show');
        showToast('已批量删除');
    });
});

// 多选转发
// 核心合并转发函数 (带选择联系人列表)
window.executeForward = async function(msgTimestamps) {
    if (!currentChatContact || msgTimestamps.length === 0) return;
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    
    let selectedMsgs = history.filter(m => msgTimestamps.includes(m.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
    if (selectedMsgs.length === 0) return;

    let previewLines = [];
    for (let i = 0; i < Math.min(selectedMsgs.length, 4); i++) {
        let m = selectedMsgs[i];
        let name = m.role === 'user' ? '我' : (m.speakerName || currentChatContact.name);
        let text = m.content || '[图片/特殊消息]';
        previewLines.push(`${name}: ${text}`);
    }
    let previewText = previewLines.join('\n') + (selectedMsgs.length > 4 ? '\n...' : '');

    // 获取所有联系人
    let contacts = await loadFromDB('chat_contacts') || [];
    if (contacts.length === 0) { showToast('暂无可转发的联系人'); return; }
    
    // 生成列表 HTML
    let listHtml = contacts.map(c => {
        let avatarUrl = diaryAvatarCache[c.id] || '';
        let groupBadge = c.isGroup ? '<span style="font-size:10px; background:rgba(184,156,142,0.15); color:var(--accent); padding:2px 4px; border-radius:4px; margin-left:4px;">群聊</span>' : '';
        return `<div style="padding:14px; border-bottom:1px solid rgba(0,0,0,0.05); display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="confirmForwardTo('${c.id}')">
            <div style="width:42px; height:42px; border-radius:14px; background-color:rgba(184,156,142,0.15); background-image:url('${avatarUrl}'); background-size:cover; border:1px solid rgba(184,156,142,0.3);"></div>
            <div style="font-size:15px; color:var(--text-main); font-weight:bold;">${c.name}${groupBadge}</div>
        </div>`;
    }).join('');

    // 弹出一个带联系人列表的遮罩
    let modal = document.createElement('div');
    modal.className = 'custom-confirm-overlay show';
    modal.style.zIndex = '999999';
    modal.innerHTML = `
    <div class="custom-confirm-box" style="background:#F6F4F0; width: 85vw; max-width: 320px; padding: 20px 15px; text-align: left;">
        <div class="cc-title" style="margin-bottom: 12px; text-align:center; font-size:16px;">发给谁？</div>
        <div style="width: 100%; box-sizing: border-box; max-height: 50vh; overflow-y: auto; margin-bottom: 16px; background:#fff; border-radius:16px; border:1px solid rgba(184,156,142,0.15); box-shadow: inset 0 2px 8px rgba(0,0,0,0.02);">
            ${listHtml}
        </div>
        <button class="cc-btn cancel" style="width:100%; border-radius:14px; margin:0;" onclick="this.closest('.custom-confirm-overlay').remove()">取消</button>
    </div>
`;
    document.body.appendChild(modal);

    // 点击某个人后执行发送
    window.confirmForwardTo = async function(targetContactId) {
        modal.remove();
        
        let targetHistory = await loadFromDB(`chat_history_${targetContactId}`) || [];
        const ts = Date.now();
        targetHistory.push({
            role: 'user',
            content: previewText,
            msgType: 'forward_card',
            forwardData: selectedMsgs,
            timestamp: ts
        });
        await saveToDB(`chat_history_${targetContactId}`, targetHistory);
        await updateContactPreview(targetContactId, "我: [合并聊天记录]");
        
        // 如果恰好转发给了当前的聊天对象，直接在屏幕上刷出来
        if (targetContactId === currentChatContact.id) {
            await renderChatMessages(targetHistory, currentChatContact.id);
        }
        
        // 退出多选和悬浮状态
        const chatMessageArea = document.getElementById('chatMessageArea');
        chatMessageArea.classList.remove('multi-mode');
        document.getElementById('multiSelectBar').classList.remove('show');
        document.querySelectorAll('.chat-bubble-row.selected, .chat-system-msg.selected').forEach(el => el.classList.remove('selected'));
        document.getElementById('bubbleContextMenu').classList.remove('show');
        
        showToast('已成功转发！');
    };
};

// 绑定单条长按转发
document.getElementById('menuForward').onclick = () => {
    document.getElementById('bubbleContextMenu').classList.remove('show');
    if (activeBubbleData) executeForward([activeBubbleData.ts]);
};

// 绑定底部多选合并转发
document.getElementById('msForward').onclick = () => {
    if (selectedMessages.length === 0) { showToast('请至少选择一条消息'); return; }
    executeForward(selectedMessages);
};

// ==========================================
// AI 日程表与在线状态核心逻辑 (全新卡片弹窗版)
// ==========================================
function checkIsOnline(scheduleStr) {
    if (!scheduleStr) return { status: 'online', currentTask: '在线' };
    const now = new Date();
    const currentTotalMins = now.getHours() * 60 + now.getMinutes();

    const lines = scheduleStr.split('\n');
    for (let line of lines) {
        // 【核心修改】：正则加入了对 emoji 圆点的识别
        const match = line.match(/(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})\s+(?:\[(红灯|黄灯|绿灯)\]|([🔴🟡🟢]))?\s*(.*)/);
        if (match) {
            const startMins = parseInt(match[1]) * 60 + parseInt(match[2]);
            let endMins = parseInt(match[3]) * 60 + parseInt(match[4]);
            
            let isCurrentTime = false;
            if (endMins < startMins) {
                isCurrentTime = (currentTotalMins >= startMins || currentTotalMins <= endMins);
            } else {
                isCurrentTime = (currentTotalMins >= startMins && currentTotalMins <= endMins);
            }
            
            if (isCurrentTime) {
                const tag = match[5];   // 兼容旧版的 [红灯]
                const emoji = match[6]; // 获取新版的 🔴🟡🟢
                const taskName = match[7].trim(); // 获取剥离符号后纯粹的文字描述
                let statusCode = 'online'; 
                
                // 严格按符号判定
                if (tag === '红灯' || emoji === '🔴') {
                    statusCode = 'offline';
                } else if (tag === '黄灯' || emoji === '🟡') {
                    statusCode = 'busy';
                } else if (tag === '绿灯' || emoji === '🟢') {
                    statusCode = 'online';
                } else {
                    // 没写符号时的关键词兜底
                    if (taskName.match(/睡|晚安|休息|离线|不在|休眠/)) {
                        statusCode = 'offline';
                    } else if (taskName.match(/工作|开会|上课|忙|学习|打工|搬砖/)) {
                        statusCode = 'busy';
                    }
                }
                
                return { status: statusCode, currentTask: taskName };
            }
        }
    }
    return { status: 'online', currentTask: '自由活动' };
}

function updateOnlineStatusUI(scheduleStr, isEnabled) {
    const dot = document.getElementById('chatOnlineStatusDot');
    const dotModal = document.getElementById('scheduleStatusDotModal');
    const statusText = document.getElementById('scheduleCurrentStatus');
    
    // 定义三种状态的颜色 (绿灯、黄灯、红灯)
    const colors = {
        online: { color: '#4CAF50', glow: 'rgba(76,175,80,0.5)' },
        busy: { color: '#FFC107', glow: 'rgba(255,193,7,0.5)' },
        offline: { color: '#F44336', glow: 'rgba(244,67,54,0.5)' }
    };

    // 默认如果没开启日程，强制显示绿灯在线
    let currentStatus = { status: 'online', currentTask: '在线' };
    
    // 如果开启了日程，就去解析时间表获取真实状态
    if (isEnabled) {
        currentStatus = checkIsOnline(scheduleStr);
    }
    
    const theme = colors[currentStatus.status];

    // 更新聊天室标题旁的小圆点、名片面板里的小圆点以及文字颜色
    if(dot) { 
        dot.style.backgroundColor = theme.color; 
        dot.style.boxShadow = `0 0 6px ${theme.color}`; 
    }
    if(dotModal) { 
        dotModal.style.backgroundColor = theme.color; 
        dotModal.style.boxShadow = `0 0 8px ${theme.glow}`; 
    }
    if(statusText) { 
        statusText.innerText = currentStatus.currentTask; 
        statusText.style.color = theme.color; 
    }
}

// 独立的实时 Tokens 运算函数
async function getChatTokensRealtime() {
    if (!currentChatContact) return 0;
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    const sysPrompt = await buildChatSystemPrompt(history);
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    const contextCount = settings.contextCount || 15;
    
    let imgCount = 0;
    const contextHistory = history.slice(-contextCount).map(m => {
    if (m.imageUrl) imgCount++;
    let timeLabel = '';
    if (m.timestamp) {
        let d = new Date(m.timestamp);
        timeLabel = `[${d.getMonth()+1}月${d.getDate()}日 ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}] `;
    }
    return `${timeLabel}${m.role}: ${m.imageUrl ? '[图片]' : m.content}`;
}).join('\n');
    
    const fullPrompt = `${sysPrompt}\n\n[附带的历史上下文]:\n${contextHistory}`;
    
    // 同样加入图片消耗计算
    return Math.floor(fullPrompt.length * 1.5) + (imgCount * 250);
}

// ====== 新增：迷你名片与编辑界面的切换 ======
document.getElementById('openScheduleEditBtn').addEventListener('click', () => {
    document.getElementById('scheduleMiniProfile').style.display = 'none';
    document.getElementById('scheduleEditArea').style.display = 'block';
});

document.getElementById('backToMiniProfileBtn').addEventListener('click', () => {
    document.getElementById('scheduleEditArea').style.display = 'none';
    document.getElementById('scheduleMiniProfile').style.display = 'block';
});

// 点击小绿点打开悬浮弹窗
document.getElementById('chatOnlineStatusDot').addEventListener('click', async () => {
    if (!currentChatContact) return;
    
    // 每次打开都确保显示迷你名片，隐藏长长的编辑界面
    document.getElementById('scheduleMiniProfile').style.display = 'block';
    document.getElementById('scheduleEditArea').style.display = 'none';
    
    // 1. 实时计算当前消耗的 Tokens
    document.getElementById('scheduleTokenDisplay').innerText = '计算中...';
getChatTokensRealtime().then(tokens => {
    document.getElementById('scheduleTokenDisplay').innerText = `约耗 ${tokens} Tokens`;
});

    // 2. 计算相识天数
    const contacts = await loadFromDB('chat_contacts') || [];
    const contactInfo = contacts.find(c => c.id === currentChatContact.id);
    const addedAt = contactInfo && contactInfo.addedAt ? contactInfo.addedAt : Date.now();
    const days = Math.max(1, Math.ceil((Date.now() - addedAt) / (1000 * 60 * 60 * 24)));
    document.getElementById('scheduleMeetDays').innerText = days;

    // 3. 读取角色设定并在卡片里预览
    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === currentChatContact.id);
    document.getElementById('scheduleRoleDesc').innerText = role && role.prompt ? role.prompt : '暂无设定资料...';

    // 4. 恢复并渲染排表数据
    const settings = await loadFromDB(`chat_schedule_${currentChatContact.id}`) || {};
    document.getElementById('scheduleEnableToggle').checked = settings.enabled || false;
    document.getElementById('scheduleSubApiToggle').checked = settings.useSubApi || false;
    document.getElementById('scheduleContent').value = settings.schedule || '00:00-08:00 沉睡休眠\n08:00-12:00 赛博搬砖\n12:00-14:00 午休充电\n14:00-18:00 继续搬砖\n18:00-23:59 自由活动';
    
    updateOnlineStatusUI(settings.schedule, settings.enabled);
    document.getElementById('chatScheduleModal').classList.add('show');
});

// 点击黑色背景区域关闭弹窗
document.getElementById('chatScheduleModal').addEventListener('click', (e) => {
    if (e.target.id === 'chatScheduleModal') e.target.classList.remove('show');
});

// 保存日程
document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
    const settings = {
        enabled: document.getElementById('scheduleEnableToggle').checked,
        useSubApi: document.getElementById('scheduleSubApiToggle').checked,
        schedule: document.getElementById('scheduleContent').value.trim()
    };
    await saveToDB(`chat_schedule_${currentChatContact.id}`, settings);
    
    updateOnlineStatusUI(settings.schedule, settings.enabled);
    document.getElementById('chatScheduleModal').classList.remove('show');
});

// AI 自动排表
document.getElementById('generateScheduleBtn').addEventListener('click', async function() {
    const btn = this;
    const useSubApi = document.getElementById('scheduleSubApiToggle').checked;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) { showToast('请先在设置中配置对应的 API Key！'); return; }

    btn.innerText = "正在让 TA 思考...";
    btn.style.opacity = '0.7';

    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === currentChatContact.id);

            const sysPrompt = `你现在是 ${role ? role.name : '一个人'}。你的详细设定是：${role ? role.prompt : ''}。
请根据你的性格和身份，为你自己安排一份合理的【全天24小时作息时间表】。

【排表要求】：
1. 时间段的数量由你自己决定，请首尾相连覆盖 00:00 到 23:59。
2. 事件描述控制在 15 个字以内，不需要硬凑字数，正常说话就行，符合你的性格即可。
3. 【极其重要】：为了让系统能识别你的状态，你必须在每个事件描述的最前面，加上一个状态表情符号（必须是这三个中的一个）：
- 如果你在睡觉、休眠或完全无法回复，加上 🔴
- 如果你在工作、开会、执行任务等比较忙的状态，加上 🟡
- 如果你处于闲暇、放松、随时可以聊天的状态，加上 🟢

【输出格式示例】：
00:00-08:00 🔴 睡觉
08:00-09:00 🟢 晨跑顺便买个早餐
09:00-12:00 🟡 在公司开会
12:00-14:00 🟢 午休吃点东西
14:00-18:00 🟡 处理堆积的文件
18:00-23:59 🟢 窝在沙发上看剧

注意：午夜零点请写 00:00。只准输出时间表，绝不要输出任何多余的废话和 markdown 标记！`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: "system", content: sysPrompt }], temperature: 0.8 })
        });
        const data = await res.json();
        document.getElementById('scheduleContent').value = data.choices[0].message.content.trim();
        showToast('排表完成，记得点击保存哦~');
    } catch (e) {
        showToast('排表失败：' + e.message);
    } finally {
        btn.innerText = "让 TA 排表";
        btn.style.opacity = '1';
    }
});

// 监听聊天区点击 (包含双击头像与翻译展开)
let lastAvatarTapTime = 0;
let lastAvatarElement = null;

document.getElementById('chatMessageArea').addEventListener('click', async (e) => {
    // 排除多选模式时的点击冲突
    if (document.getElementById('chatMessageArea').classList.contains('multi-mode')) return;
    
    // 1. 检查是否双击了头像
    const avatarEl = e.target.closest('.chat-bubble-avatar');
    if (avatarEl) {
        const currentTime = Date.now();
        if (currentTime - lastAvatarTapTime < 300 && lastAvatarElement === avatarEl) {
            // 确认为双击
            e.preventDefault();
            const row = avatarEl.closest('.chat-bubble-row');
            // 只允许戳别人
            if (row && row.classList.contains('ai')) {
                // 智能抓取名字
                let targetName = document.getElementById('chatRoomTitle').innerText || 'TA';
                const nameEl = row.querySelector('div[style*="font-size:10px"]'); 
                if (nameEl) targetName = nameEl.innerText;
                
                // 读取你的自定义设置
                const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
                const pokeVerb = settings.pokeAction ? settings.pokeAction.verb : '戳了戳';
                const pokeTarget = settings.pokeAction ? settings.pokeAction.target : '肩膀';
                
                const pokeText = `我${pokeVerb}${targetName}的${pokeTarget}`;
                
                // 存入历史记录，作为系统小字，让 AI 能看到
                const ts = Date.now();
                let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
                history.push({ role: 'system', content: pokeText, timestamp: ts });
                await saveToDB(`chat_history_${currentChatContact.id}`, history);
                
                // 界面马上渲染出系统小字
                const area = document.getElementById('chatMessageArea');
                area.insertAdjacentHTML('beforeend', `<div class="chat-system-msg" data-ts="${ts}"><span class="chat-system-msg-text">${pokeText}</span></div>`);
                area.scrollTop = area.scrollHeight;
                
                
            }
        }
        lastAvatarTapTime = currentTime;
        lastAvatarElement = avatarEl;
        return; // 头像点完就结束
    }

    // 2. 气泡翻译展开逻辑
    const bubble = e.target.closest('.chat-bubble');
    if (bubble) {
        const transDivs = bubble.querySelectorAll('.bilingual-trans');
        if (transDivs.length > 0) {
            transDivs.forEach(transDiv => {
                transDiv.style.display = transDiv.style.display === 'block' ? 'none' : 'block';
            });
        }
    }
});

// === 沉浸式红包点击拆开逻辑 ===
window.openRedPacketModal = function(el, msgContent, amount) {
    // 智能获取该气泡发送者的头像和名字
    const row = el.closest('.chat-bubble-row');
    const avatarEl = row.querySelector('.chat-bubble-avatar');
    let avatarBg = avatarEl ? avatarEl.style.backgroundImage : '';
    let name = row.classList.contains('me') ? '我' : (document.getElementById('chatRoomTitle').innerText || 'TA');
    
    document.getElementById('rpModalAvatar').style.backgroundImage = avatarBg;
    document.getElementById('rpModalName').innerText = name + ' 的红包';
    document.getElementById('rpModalMsg').innerText = msgContent;
    document.getElementById('rpModalAmount').innerText = parseFloat(amount).toFixed(2);
    
    // 恢复到初始未拆开的状态
    document.getElementById('rpUnopenedState').style.display = 'block';
    document.getElementById('rpOpenedState').style.display = 'none';
    document.getElementById('rpOpenBtn').classList.remove('spinning');
    
    document.getElementById('rpModal').classList.add('show');
};

window.closeRedPacketModal = function() {
    document.getElementById('rpModal').classList.remove('show');
};

window.triggerRpOpen = function() {
    const btn = document.getElementById('rpOpenBtn');
    btn.classList.add('spinning');
    // 等待 0.6 秒金币翻转动画结束后，显示具体金额
    setTimeout(() => {
        document.getElementById('rpUnopenedState').style.display = 'none';
        document.getElementById('rpOpenedState').style.display = 'block';
    }, 600); 
};



// =====================================
// 解散群聊功能
// =====================================
document.getElementById('chatDisbandGroupBtn').addEventListener('click', () => {
    showBeautifulDialog('解散群聊', '确定要解散当前群聊吗？频段将会断开，所有群记录将被抹除。', 'confirm', '', async () => {
        let contacts = await loadFromDB('chat_contacts') ||[];
        // 把当前这个群从通讯录里删掉
        contacts = contacts.filter(c => c.id !== currentChatContact.id);
        await saveToDB('chat_contacts', contacts);
        
        // 顺便把群聊天记录也清掉
        await saveToDB(`chat_history_${currentChatContact.id}`,[]);
        
        document.getElementById('chatSettingsPanel').classList.remove('show');
        document.getElementById('chatRoomPanel').classList.remove('show');
        
        showToast('群聊已解散');
        renderChatSessionList();
        renderChatContacts();
    });
});

// =====================================
// 群聊专属资料面板逻辑 (QQ风格)
// =====================================
window.openChatProfile = async function() {
    if (!currentChatContact) return;
    
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    
    if (contactInfo && contactInfo.isGroup) {
        // 渲染群名称和公告
        document.getElementById('groupProfileNameText').innerText = contactInfo.name || '未命名群聊';
        document.getElementById('groupProfileNoticeText').innerText = contactInfo.notice || '暂无公告';
        
                // 渲染群头像
        let groupAvatarUrl = diaryAvatarCache[contactInfo.id];
        if (!groupAvatarUrl) {
            const f = await loadFromDB(`char_avatar_${contactInfo.id}`);
            groupAvatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[contactInfo.id] = groupAvatarUrl;
        }
        const avatarPreview = document.getElementById('groupProfileAvatarPreview');
        const avatarIcon = document.getElementById('groupProfileAvatarIcon');
        if (groupAvatarUrl) {
            avatarPreview.style.backgroundImage = `url(${groupAvatarUrl})`;
            avatarIcon.style.display = 'none';
        } else {
            avatarPreview.style.backgroundImage = '';
            avatarIcon.style.display = 'block';
        }
        
        // 渲染群成员列表
        const memberListEl = document.getElementById('groupProfileMembersList');
        memberListEl.innerHTML = '';
        
        // 1. 渲染群头衔标签 (支持自定义专属头衔)
let ownerId = contactInfo.owner || 'me';
let admins = contactInfo.admins || [];

const getRoleBadge = (id) => {
    if (id === ownerId) return `<div style="font-size:9px; background:#FFF6D6; color:#D69E2E; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群主</div>`;
    if (admins.includes(id)) return `<div style="font-size:9px; background:rgba(51,144,236,0.1); color:#3390EC; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">管理员</div>`;
    return `<div style="font-size:9px; background:rgba(184,156,142,0.1); color:var(--text-sub); padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群员</div>`;
};

// 1. 渲染用户自己 (我)
const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
let myAvatarUrl = '';
let myName = '我';
if (settings.userRoleId) {
    myAvatarUrl = diaryAvatarCache[settings.userRoleId] || '';
    const allChars = await loadFromDB('ai_characters') || [];
    const myRole = allChars.find(c => c.id === settings.userRoleId);
    if (myRole) myName = myRole.name;
}
memberListEl.innerHTML += `
    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
        <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:#D4CCC2; ${myAvatarUrl ? `background-image:url(${myAvatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6);"></div>
        <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${myName}</div>
        ${getRoleBadge('me')}
    </div>
`;

// 2. 渲染 AI 成员
const allChars = await loadFromDB('ai_characters') || [];
let memberCount = 1; 
if (contactInfo.members && contactInfo.members.length > 0) {
    memberCount += contactInfo.members.length;
    contactInfo.members.forEach(mId => {
        const char = allChars.find(c => c.id === mId);
        if (char) {
            let avatarUrl = diaryAvatarCache[char.id] || '';
            let mutedData = contactInfo.muted || {};
            let isMuted = mutedData[char.id] && mutedData[char.id] > Date.now();
            let muteBadge = isMuted ? `<div style="position:absolute; top:-4px; right:-4px; background:#D67A7A; color:#fff; font-size:9px; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fff; z-index:2; line-height:1.2; box-shadow:0 2px 4px rgba(214,122,122,0.3);">禁言</div>` : '';

            memberListEl.innerHTML += `
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="manageGroupMember('${char.id}', '${char.name}')">
                    <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:rgba(184,156,142,0.15); ${avatarUrl ? `background-image:url(${avatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6); position:relative;">
                        ${muteBadge}
                    </div>
                    <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${char.name}</div>
                    ${getRoleBadge(char.id)}
                </div>
            `;
        }
    });
}

// 3. 邀请按钮虚线框
memberListEl.innerHTML += `
    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="openInviteMemberModal()" >
        <div style="width:54px; height:54px; border-radius:18px; border:2px dashed rgba(184,156,142,0.4); display:flex; justify-content:center; align-items:center; color:var(--text-sub); transition:0.2s;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <div style="font-size:12px; font-weight:700; color:var(--text-sub); margin-top:2px;">邀请</div>
        <div style="height:15px;"></div>
    </div>
`;
        
        document.getElementById('groupProfileMemberCount').innerText = `群聊成员 (${memberCount}人)`;
        
                // ================= 新增：渲染群成员表情包权限 =================
const stickerAuthBlock = document.getElementById('groupStickerAuthBlock');
stickerAuthBlock.style.display = 'block';

const allStickerGroups = await loadFromDB('sticker_groups') || [];
let authHtml = `<div class="block-title">成员表情包授权</div><div style="font-size: 11px; color: var(--text-sub); margin-bottom: 12px; line-height: 1.5;">精准控制每位成员在【当前群聊】可使用的表情包分组。（点击多选）</div>`;

if (allStickerGroups.length === 0) {
    authHtml += `<div style="font-size: 11px; color: var(--text-sub);">暂无表情包分组，请先在表情包面板导入。</div>`;
    stickerAuthBlock.innerHTML = authHtml;
} else {
    let memberStickers = settings.memberStickers || {};
    let membersHtml = '';
    
    for (let mId of contactInfo.members) {
        const char = allChars.find(c => c.id === mId);
        if (!char) continue;
        
        let charAllowedGroups = memberStickers[mId] || [];
        let chipsHtml = allStickerGroups.map(sg => {
            const isActive = charAllowedGroups.includes(sg.id) ? 'active' : '';
            return `<div class="acc-chip ${isActive}" data-char="${mId}" data-sg="${sg.id}" style="padding: 6px 12px; font-size: 11px; border-radius: 10px; cursor: pointer; border: 1.5px solid ${isActive ? 'var(--accent)' : '#E0E0E0'}; background: ${isActive ? 'rgba(51,144,236,0.1)' : 'transparent'}; color: ${isActive ? 'var(--accent)' : 'var(--text-sub)'}; transition: 0.2s; user-select: none;">${sg.name}</div>`;
        }).join('');
        
        membersHtml += `
            <div style="margin-bottom: 16px; border-bottom: 1px dashed rgba(0,0,0,0.05); padding-bottom: 12px;">
                <div style="font-size: 13px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">${char.name}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">${chipsHtml}</div>
            </div>
        `;
    }
    stickerAuthBlock.innerHTML = authHtml + membersHtml;
    
    // 绑定点击授权事件
    stickerAuthBlock.onclick = async (e) => {
        if (e.target.classList.contains('acc-chip')) {
            const charId = e.target.dataset.char;
            const sgId = e.target.dataset.sg;
            
            let curSettings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
            let curMemberStickers = curSettings.memberStickers || {};
            if (!curMemberStickers[charId]) curMemberStickers[charId] = [];
            
            if (curMemberStickers[charId].includes(sgId)) {
                curMemberStickers[charId] = curMemberStickers[charId].filter(id => id !== sgId);
                e.target.classList.remove('active');
                e.target.style.borderColor = '#E0E0E0';
                e.target.style.color = 'var(--text-sub)';
                e.target.style.background = 'transparent';
            } else {
                curMemberStickers[charId].push(sgId);
                e.target.classList.add('active');
                e.target.style.borderColor = 'var(--accent)';
                e.target.style.color = 'var(--accent)';
                e.target.style.background = 'rgba(51,144,236,0.1)';
            }
            
            curSettings.memberStickers = curMemberStickers;
            await saveToDB(`chat_settings_${currentChatContact.id}`, curSettings);
        }
    };
}
// ==============================================================

        // 展开面板
        document.getElementById('groupProfilePanel').classList.add('show');
    } else {
        // 如果是单聊点进来的，就直接去原来的纯设置面板
        document.getElementById('chatRoomSettingsBtn').click();
    }
};

// 绑定关闭和退出按钮
document.getElementById('closeGroupProfileBtn').addEventListener('click', () => {
    document.getElementById('groupProfilePanel').classList.remove('show');
});
document.getElementById('groupProfileExitBtn').addEventListener('click', () => {
    document.getElementById('chatDisbandGroupBtn').click(); // 借用现成的解散逻辑
});

// 点击修改群名称
document.getElementById('editGroupNameBtn').addEventListener('click', () => {
    const currentName = document.getElementById('groupProfileNameText').innerText;
    showBeautifulDialog('修改群名称', '请输入新的群聊名称：', 'prompt', currentName, async (newName) => {
        if (newName && newName.trim()) {
            let contacts = await loadFromDB('chat_contacts') || [];
            let contactInfo = contacts.find(c => c.id === currentChatContact.id);
            if (contactInfo) {
                contactInfo.name = newName.trim();
                await saveToDB('chat_contacts', contacts);
                document.getElementById('groupProfileNameText').innerText = contactInfo.name;
                document.getElementById('chatRoomTitle').innerText = contactInfo.name; // 顶部标题同步改
                currentChatContact.name = contactInfo.name;
                
                // 静默刷新外部列表名字
                if (typeof renderChatSessionList === 'function') renderChatSessionList();
                if (typeof renderChatContacts === 'function') renderChatContacts();
                showToast('群名称已修改');
            }
        }
    });
});

// 点击修改群公告
document.getElementById('editGroupNoticeBtn').addEventListener('click', () => {
    const currentNotice = document.getElementById('groupProfileNoticeText').innerText;
    showBeautifulDialog('修改群公告', '请输入新的群公告：', 'prompt', currentNotice === '暂无公告' ? '' : currentNotice, async (newNotice) => {
        let contacts = await loadFromDB('chat_contacts') || [];
        let contactInfo = contacts.find(c => c.id === currentChatContact.id);
        if (contactInfo) {
            let finalNotice = newNotice.trim() || '';
            contactInfo.notice = finalNotice;
            await saveToDB('chat_contacts', contacts);
            document.getElementById('groupProfileNoticeText').innerText = finalNotice || '暂无公告';
            showToast('群公告已修改');
            
            // ===== 新增：发送系统公告到群聊，让 AI 感知 =====
            if (finalNotice) {
                // 1. 获取群主真实名字
                let ownerId = contactInfo.owner || 'me';
                let ownerName = '我';
                const chars = await loadFromDB('ai_characters') || [];
                
                if (ownerId === 'me') {
                    // 如果群主是我，去找我绑定的马甲名字
                    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
                    if (settings.userRoleId) {
                        const myRole = chars.find(c => c.id === settings.userRoleId);
                        if (myRole) ownerName = myRole.name;
                    }
                } else {
                    // 如果群主是 AI，去找 AI 的名字
                    const aiRole = chars.find(c => c.id === ownerId);
                    if (aiRole) ownerName = aiRole.name;
                }

                // 2. 构造小字文本并存入群聊天记录
                const sysText = `[群主] ${ownerName} 更新了群公告："${finalNotice}"`;
                let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
                history.push({ role: 'system', content: sysText, timestamp: Date.now() });
                await saveToDB(`chat_history_${currentChatContact.id}`, history);
                
                // 3. 静默刷新群聊面板
                if (document.getElementById('chatRoomPanel').classList.contains('show')) {
                    if (typeof renderChatMessages === 'function') {
                        await renderChatMessages(history, currentChatContact.id);
                    }
                }
            }
            // ===================================
        }
    });
});

// 点击修改群头像
document.getElementById('editGroupAvatarBtn').addEventListener('click', () => {
    document.getElementById('groupAvatarUploadInput').click();
});

// 处理群头像上传
document.getElementById('groupAvatarUploadInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentChatContact) {
        const url = URL.createObjectURL(file);
        
        // 更新面板里的预览图
        const avatarPreview = document.getElementById('groupProfileAvatarPreview');
        avatarPreview.style.backgroundImage = `url(${url})`;
        document.getElementById('groupProfileAvatarIcon').style.display = 'none';
        
        // 存入数据库，伪装成角色头像让系统自动去读取它
        await saveToDB(`char_avatar_${currentChatContact.id}`, file);
        diaryAvatarCache[currentChatContact.id] = url; // 注入内存缓存
        
        // 静默刷新外部列表，让外面的群聊头像也立刻变成自定义的！
        if (typeof renderChatSessionList === 'function') renderChatSessionList();
        if (typeof renderChatContacts === 'function') renderChatContacts();
        
        showToast('群头像已更新！');
    }
    e.target.value = ''; // 清空 input 保证下次还能选同一张图
});

// =====================================
// 群成员高级管理操作逻辑
// =====================================
window.manageGroupMember = async function(charId, charName) {
    if (!currentChatContact) return;
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    if (!contactInfo) return;

    // 权限判断体系 (2=群主, 1=管理员, 0=群员)
    let ownerId = contactInfo.owner || 'me';
    let admins = contactInfo.admins || [];
    let myRole = (ownerId === 'me') ? 2 : (admins.includes('me') ? 1 : 0);
    let targetRole = (ownerId === charId) ? 2 : (admins.includes(charId) ? 1 : 0);

    if (myRole === 0) {
        showToast('群员没有管理权限哦~'); return;
    }
    if (myRole <= targetRole && myRole !== 2) {
        showToast('权限不足，无法管理同级或上级！'); return;
    }

    let mutedData = contactInfo.muted || {};
    let isMuted = mutedData[charId] && mutedData[charId] > Date.now();

    let buttonsHtml = '';
    
    // 1. 禁言 / 解除禁言
    if (isMuted) {
        buttonsHtml += `<button class="cc-btn" onclick="executeGroupAction('${charId}', '${charName}', 'unmute')" style="width:100%; margin-bottom:12px; background:#F0EDE8; color:var(--text-main);">解除禁言</button>`;
    } else {
        buttonsHtml += `<button class="cc-btn danger" onclick="executeGroupAction('${charId}', '${charName}', 'mute')" style="width:100%; margin-bottom:12px; background:#FFF0F0; color:#D67A7A;">关进小黑屋 (禁言)</button>`;
    }

    // 2. 群主特权：管理员分配与转让
    if (myRole === 2) {
        if (admins.includes(charId)) {
            buttonsHtml += `<button class="cc-btn" onclick="executeGroupAction('${charId}', '${charName}', 'revoke_admin')" style="width:100%; margin-bottom:12px; background:#F0EDE8; color:var(--text-main);">撤销管理员</button>`;
        } else {
            buttonsHtml += `<button class="cc-btn primary" onclick="executeGroupAction('${charId}', '${charName}', 'grant_admin')" style="width:100%; margin-bottom:12px; background:rgba(51,144,236,0.15); color:#3390EC;">设为管理员</button>`;
        }
        buttonsHtml += `<button class="cc-btn danger" onclick="executeGroupAction('${charId}', '${charName}', 'transfer_owner')" style="width:100%; margin-bottom:12px; background:#FFF0F0; color:#D67A7A;">转让群主</button>`;
    }

    // 3. 移出群聊
    buttonsHtml += `<button class="cc-btn danger" onclick="executeGroupAction('${charId}', '${charName}', 'kick')" style="width:100%; margin-bottom:12px; background:#FFF0F0; color:#D67A7A;">移出群聊</button>`;
    buttonsHtml += `<button class="cc-btn cancel" onclick="document.getElementById('manageMemberModal').classList.remove('show')" style="width:100%;">取消</button>`;

    let modal = document.getElementById('manageMemberModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'manageMemberModal';
        modal.className = 'custom-confirm-overlay';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="custom-confirm-box" style="background:#F6F4F0; width: 75vw; max-width: 280px; padding: 24px 20px;">
            <div class="cc-title" style="margin-bottom:20px; font-size:16px;">管理 ${charName}</div>
            <div style="display:flex; flex-direction:column; width:100%;">
                ${buttonsHtml}
            </div>
        </div>
    `;
    modal.classList.add('show');
};

// 执行具体的管理指令
window.executeGroupAction = async function(charId, charName, action) {
    document.getElementById('manageMemberModal').classList.remove('show');
    
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];

    const sysMsg = async (text) => {
    // 【核心修复】：放弃缓存，直接每次发系统消息都从数据库现捞最新记录，绝不吞掉AI刚好发出的新气泡！
    let latestHistory = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
    latestHistory.push({ role: 'system', content: text, timestamp: Date.now() });
    await saveToDB(`chat_history_${currentChatContact.id}`, latestHistory);
    if (document.getElementById('chatRoomPanel').classList.contains('show')) {
        await renderChatMessages(latestHistory, currentChatContact.id);
    }
};

// 【终极防闪烁修复】：不再模拟点击刷新页面，而是只偷偷替换成员列表的 HTML
const quietRefresh = async () => {
    const allChars = await loadFromDB('ai_characters') || [];
    const settings = await loadFromDB(`chat_settings_${currentChatContact.id}`) || {};
    
    // 核心修复：强制重新从数据库拉取，抛弃上层闭包带来的旧数据
    let freshContactsForRefresh = await loadFromDB('chat_contacts') || [];
    let freshContactInfoForRefresh = freshContactsForRefresh.find(c => c.id === currentChatContact.id);
    if (!freshContactInfoForRefresh) return;
    
    let ownerId = freshContactInfoForRefresh.owner || 'me';
    let admins = freshContactInfoForRefresh.admins || [];
    const getRoleBadge = (id) => {
    if (id === ownerId) return `<div style="font-size:9px; background:#FFF6D6; color:#D69E2E; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群主</div>`;
    if (admins.includes(id)) return `<div style="font-size:9px; background:rgba(51,144,236,0.1); color:#3390EC; padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">管理员</div>`;
    return `<div style="font-size:9px; background:rgba(184,156,142,0.1); color:var(--text-sub); padding:2px 6px; border-radius:6px; margin-top:2px; font-weight:800;">群员</div>`;
};

    let myAvatarUrl = '';
    let myName = '我';
    if (settings.userRoleId) {
        myAvatarUrl = diaryAvatarCache[settings.userRoleId] || '';
        const myRole = allChars.find(c => c.id === settings.userRoleId);
        if (myRole) myName = myRole.name;
    }

    let membersHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
            <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:#D4CCC2; ${myAvatarUrl ? `background-image:url(${myAvatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6);"></div>
            <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${myName}</div>
            ${getRoleBadge('me')}
        </div>
    `;

    let memberCount = 1;
    if (freshContactInfoForRefresh.members && freshContactInfoForRefresh.members.length > 0) {
        memberCount += freshContactInfoForRefresh.members.length;
        freshContactInfoForRefresh.members.forEach(mId => {
            const char = allChars.find(c => c.id === mId);
            if (char) {
                let avatarUrl = diaryAvatarCache[char.id] || '';
                let mutedData = freshContactInfoForRefresh.muted || {};
                let isMuted = mutedData[char.id] && mutedData[char.id] > Date.now();
                let muteBadge = isMuted ? `<div style="position:absolute; top:-4px; right:-4px; background:#D67A7A; color:#fff; font-size:9px; font-weight:800; padding:2px 6px; border-radius:6px; border:1px solid #fff; z-index:2; line-height:1.2; box-shadow:0 2px 4px rgba(214,122,122,0.3);">禁言</div>` : '';

                membersHtml += `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="manageGroupMember('${char.id}', '${char.name.replace(/'/g, "\\'")}')">
                        <div style="width:54px; height:54px; border-radius:18px; background-size:cover; background-position:center; background-color:rgba(184,156,142,0.15); ${avatarUrl ? `background-image:url(${avatarUrl})` : ''}; box-shadow:0 4px 12px rgba(128,118,110,0.06); border:1px solid rgba(255,255,255,0.6); position:relative;">
                            ${muteBadge}
                        </div>
                        <div style="font-size:12px; font-weight:700; color:var(--text-main); max-width:54px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${char.name}</div>
                        ${getRoleBadge(char.id)}
                    </div>
                `;
            }
        });
    }

    membersHtml += `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; cursor:pointer;" onclick="openInviteMemberModal()" >
            <div style="width:54px; height:54px; border-radius:18px; border:2px dashed rgba(184,156,142,0.5); display:flex; justify-content:center; align-items:center; color:var(--accent);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <div style="font-size:12px; font-weight:700; color:var(--text-sub); margin-top:2px;">邀请</div>
            <div style="height:15px;"></div>
        </div>
    `;

    const list1 = document.getElementById('groupMembersList');
    if (list1) list1.innerHTML = membersHtml;
    const list2 = document.getElementById('groupProfileMembersList');
    if (list2) list2.innerHTML = membersHtml;
    
    const countEl = document.getElementById('groupProfileMemberCount');
    if (countEl) countEl.innerText = '群聊成员 (' + memberCount + '人)';
};

if (action === 'mute' || action === 'unmute') { 
        let mutedData = contactInfo.muted || {};
        if (action === 'unmute') {
            delete mutedData[charId];
            contactInfo.muted = mutedData;
            await saveToDB('chat_contacts', contacts);
            showToast(`已解除 ${charName} 的禁言`);
            await sysMsg(`${charName} 已被解除禁言`);
            await quietRefresh();
        } else {
            showBeautifulDialog('禁言时长', `请输入禁言 ${charName} 的秒数：\n(输入 0 为永久禁言)`, 'prompt', '60', async (secs) => {
                let secNum = parseFloat(secs);
                if (isNaN(secNum) || secNum < 0) return;
                mutedData[charId] = secNum === 0 ? Date.now() + 100 * 365 * 24 * 3600000 : Date.now() + secNum * 1000;
                contactInfo.muted = mutedData;
                await saveToDB('chat_contacts', contacts);
                showToast(`${charName} 已被关进小黑屋`);
                await sysMsg(secNum === 0 ? `${charName} 已被永久禁言` : `${charName} 已被禁言 ${window.formatMuteTime ? window.formatMuteTime(secNum) : secNum + '秒'}`);
                await quietRefresh();
            });
        }
    } else if (action === 'grant_admin') {
        if (!contactInfo.admins) contactInfo.admins = [];
        contactInfo.admins.push(charId);
        await saveToDB('chat_contacts', contacts);
        showToast(`已将 ${charName} 设为管理员`);
        await sysMsg(`${charName} 已被设为管理员`);
        await quietRefresh();
    } else if (action === 'revoke_admin') {
        contactInfo.admins = (contactInfo.admins || []).filter(id => id !== charId);
        await saveToDB('chat_contacts', contacts);
        showToast(`已撤销 ${charName} 的管理员`);
        await sysMsg(`${charName} 被撤销管理员`);
        await quietRefresh();
    } else if (action === 'transfer_owner') {
        showBeautifulDialog('转让群主', `确定要把群主转让给 ${charName} 吗？转让后你将变成普通群员。`, 'confirm', '', async () => {
            contactInfo.owner = charId;
            contactInfo.admins = (contactInfo.admins || []).filter(id => id !== charId);
            await saveToDB('chat_contacts', contacts);
            showToast(`已将群主转让给 ${charName}`);
            await sysMsg(`群主已转让给 ${charName}`);
            await quietRefresh();
        });
    } else if (action === 'kick') {
        showBeautifulDialog('移出群聊', `确定要将 ${charName} 踢出群聊吗？`, 'confirm', '', async () => {
            contactInfo.members = contactInfo.members.filter(id => id !== charId);
            await saveToDB('chat_contacts', contacts);
            showToast(`${charName} 已被移出群聊`);
            await sysMsg(`${charName} 已被移出群聊`);
            await quietRefresh();
        });
    }
};

// 我发送日记邀请给TA
window.sendDiaryInvite = async function(e, charId, charName) {
    if(e && e.stopPropagation) e.stopPropagation(); 
    
    // 智能拦截：检查当前是否还有“未封存”的日记本
    let books = await loadFromDB(`diary_books_${charId}`) || [];
    const diariesData = await loadFromDB('diary_records') || [];
    let hasActiveBook = false;

    if (books.length === 0) {
        const agreement = await loadFromDB(`diary_agreement_${charId}`);
        const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === charId);
        const uniqueDays = new Set(list.map(d => { let t = new Date(d.timestamp); return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate(); })).size;
        if (agreement && agreement.agreed) {
            let isUserFinished = uniqueDays >= (agreement.days || 7);
            let isCompleted = isUserFinished && list[0] && list[0].aiContent && list[0].aiContent.trim() !== '';
            if (!isCompleted) hasActiveBook = true;
        }
    } else {
        for (let book of books) {
            const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === charId && (d.bookId === book.id || (!d.bookId && book.id === 'default')));
            const uniqueDays = new Set(list.map(d => { let t = new Date(d.timestamp); return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate(); })).size;
            let isUserFinished = uniqueDays >= book.days;
            let isCompleted = isUserFinished && list[0] && list[0].aiContent && list[0].aiContent.trim() !== '';
            if (!isCompleted) { hasActiveBook = true; break; }
        }
    }

    if (hasActiveBook) {
        showToast('当前还有未写完的日记本哦，先去打卡吧！'); return;
    }

    // 使用双输入框：打卡天数 + 附言
    showDoubleDialog('发送日记邀请', `邀请 ${charName} 交换日记。`, '想约定互相打卡几天？(填数字)', '写点附言...', async (val1, val2) => {
        let days = parseInt(val1);
if (isNaN(days) || days <= 0) days = 7; // 默认7天
saveToDB(`pending_diary_days_${charId}`, days); // ★新增：偷偷存下你想约定的天数
        let msg = val2 || '来写交换日记吧！';
        let finalContent = `[约定打卡${days}天] ${msg}`;
        
        let history = await loadFromDB(`chat_history_${charId}`) || [];
        history.push({ role: 'user', content: finalContent, msgType: 'diary_invite', timestamp: Date.now() });
        await saveToDB(`chat_history_${charId}`, history);
        await updateContactPreview(charId, "我: [日记邀请]");
        showToast('邀请已发送至聊天室！快去看看TA同不同意吧。');
    });
};

// 点击邀请卡片交互逻辑
window.handleDiaryInviteClick = async function(role, content, charId, timestamp) {
    let history = await loadFromDB(`chat_history_${charId}`) || [];
    
    // 检查是否已经处理过
    const hasReplied = history.find(m => m.role === 'system' && m.timestamp > timestamp && m.content.includes('日记邀请'));

    if (role === 'user') {
        if (hasReplied) { showToast('TA已经回应过这个邀请啦'); return; }
        
        showToast('正在等待 TA 的回应...');
        // 呼叫 API 让 TA 决定
        const useSubApi = await loadFromDB('chatUseSubApi') || false;
        const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
        const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
        const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
        
        if (!apiKey) { showToast('未配置API Key'); return; }

        const chars = await loadFromDB('ai_characters') || [];
        const aiRole = chars.find(c => c.id === charId);
        
        const sysPrompt = `你扮演：${aiRole ? aiRole.name : 'TA'}。设定：${aiRole ? aiRole.prompt : ''}\n用户给你发了一张【交换日记邀请卡片】，附言是：“${content}”。\n请根据你的性格，决定是否同意和ta一起写交换日记。只准回复格式：[同意]你的附言 或者 [拒绝]你的拒绝理由。严禁输出其他废话。`;

        try {
            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.8 })
            });
            const data = await res.json();
            const reply = data.choices[0].message.content.trim();
            
            // 解析同意/拒绝
            const isAgree = reply.includes('[同意]');
const msgText = reply.replace(/\[同意\]|\[拒绝\]/, '').trim();

// --- 加上保存契约钥匙的代码 ---
if (isAgree) {
    let days = 7;
    let dayMatch = content.match(/\[约定打卡(\d+)天\]/);
    if (dayMatch) days = parseInt(dayMatch[1]);
    await saveToDB(`diary_agreement_${charId}`, { agreed: true, days: days, startTime: Date.now() });
}
// ------------------------

const sysText = isAgree ? `${aiRole.name} 同意了你的日记邀请：“${msgText}”` : `${aiRole.name} 拒绝了你的邀请：“${msgText}”`;
            
            history.push({ role: 'system', content: `${sysText}`, timestamp: Date.now() });
            await saveToDB(`chat_history_${charId}`, history);
            if (document.getElementById('chatRoomPanel').classList.contains('show')) {
                renderChatMessages(history, charId);
            }
        } catch(e) {
            showToast('TA 的思绪断线了...');
        }

    } else {
        // AI 发来的邀请，我来决定
        if (hasReplied) { showToast('你已经回应过了'); return; }
        
        const cc = document.getElementById('customConfirm');
        cc.querySelector('.cc-title').innerText = "TA 的邀请";
        cc.querySelector('.cc-desc').innerText = `TA 说：${content}\n\n是否同意与 TA 交换日记？`;
        
        const btnBox = cc.querySelector('.cc-btns');
        const oldHtml = btnBox.innerHTML;
        btnBox.innerHTML = `
            <button class="cc-btn" id="rejectInviteBtn" style="background:#FFF0F0; color:#D67A7A;">婉拒</button>
            <button class="cc-btn primary" id="agreeInviteBtn">欣然同意</button>
        `;
        cc.classList.add('show');
        
    const handleChoice = async (isAgree) => {
    cc.classList.remove('show');
    btnBox.innerHTML = oldHtml;
    
    // 提示词有所改变，如果是同意，告诉用户正在起名
    const text = isAgree ? "你同意了 TA 的交换日记邀请，TA 正在为日记本想名字..." : "你婉拒了 TA 的交换日记邀请";
    
    history.push({ role: 'system', content: `${text}`, timestamp: Date.now() });
    await saveToDB(`chat_history_${charId}`, history);
    if (document.getElementById('chatRoomPanel').classList.contains('show')) {
        renderChatMessages(history, charId);
    }

    if (isAgree) {
        // ---- 新增：智能抓取 AI 附言里的天数 ----
        let days = 7; // 默认7天
        // 抓取阿拉伯数字，如 "1天" "15天"
        const dayMatch = content.match(/(\d+)\s*天/);
        if (dayMatch) {
            days = parseInt(dayMatch[1]);
        } else {
            // 如果AI用的是中文数字，做个转换容错
            const cnMatch = content.match(/([一二三四五六七八九十])\s*天/);
            if (cnMatch) {
                const cnMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
                days = cnMap[cnMatch[1]];
            }
        }
        if (days <= 0) days = 7; // 防御性保护
        // ----------------------------------------------------

        // 保存契约（使用抓取到的天数）
        await saveToDB(`diary_agreement_${charId}`, { agreed: true, days: days, startTime: Date.now() });
        
        // 后台呼叫 AI 起名并创建日记本
        (async function backgroundNaming() {
            const useSubApi = await loadFromDB('chatUseSubApi') || false;
            const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
            const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
            const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
            
            let bookName = '交换日记'; // 默认保底名字
            if (apiKey) {
                try {
                    const chars = await loadFromDB('ai_characters') || [];
                    const aiRole = chars.find(c => c.id === charId);
                    
                    const sysPrompt = `你扮演：${aiRole ? aiRole.name : 'TA'}。设定：${aiRole ? aiRole.prompt : ''}\n用户同意了你的交换日记邀请。请你为这本共同的日记本起一个符合你性格和你们关系的名字（不超过10个字）。只准输出名字，绝对不要输出任何标点符号、书名号和废话。`;

                    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                        method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                        body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.8 })
                    });
                    const data = await res.json();
                    bookName = data.choices[0].message.content.trim().replace(/《|》|【|】|\[|\]/g, '');
                } catch(e) {}
            }
            
            // 获取现有的书架，存入新书（应用抓取到的天数）
            let books = await loadFromDB(`diary_books_${charId}`) || [];
            books.push({ id: 'book_' + Date.now(), name: bookName, days: days, startTime: Date.now() });
            await saveToDB(`diary_books_${charId}`, books);
            
            // 发送系统提示告诉用户日记本建好了
            let newHistory = await loadFromDB(`chat_history_${charId}`) || [];
            newHistory.push({ role: 'system', content: `TA 为这本日记起名为“${bookName}”，已放入专属书架。`, timestamp: Date.now() });
            await saveToDB(`chat_history_${charId}`, newHistory);
            
            // 刷新聊天界面渲染
            if (document.getElementById('chatRoomPanel').classList.contains('show')) {
                renderChatMessages(newHistory, charId);
            }
        })();
    }
};
        
        document.getElementById('rejectInviteBtn').onclick = () => handleChoice(false);
        document.getElementById('agreeInviteBtn').onclick = () => handleChoice(true);
    }
};

// === 🚨 紧急逃生舱：严格防误触版（连续快速点击 7 次清空） ===
let escapeClickCount = 0;
let escapeLastClickTime = 0;

// 核心修复：把 touchstart 换成了 click，只要发生了滑动就绝对不会触发！
document.addEventListener('click', async (e) => {
    const currentTime = Date.now();
    
    // 核心修复：时间间隔缩短到 350 毫秒，必须手速极快地狂点才生效
    if (currentTime - escapeLastClickTime < 350) {
        escapeClickCount++;
    } else {
        escapeClickCount = 1;
    }
    escapeLastClickTime = currentTime;

    // 连续点击 7 次触发隐藏机关
    if (escapeClickCount >= 7) {
        escapeClickCount = 0; // 重置计数
        
        // 瞬间物理拔管，清空页面上正在生效的全局 CSS
        const styleTag = document.getElementById('dynamicDesktopCss');
        if (styleTag) styleTag.innerHTML = '';
        
        // 清除数据库里保存的 CSS
        if (typeof saveToDB === 'function') {
            await saveToDB('desktop_custom_css', '');
        }
        
        if (typeof showToast === 'function') {
            showToast('🚨 触发逃生舱：全局美化已重置！');
        } else {
            alert('🚨 紧急逃生舱：自定义 CSS 已清空！');
        }
    }
}, { capture: true });



// ==========================================
// 说明书逻辑：首次打开自动弹，以及手动打开
// ==========================================

// 将打开函数挂载到 window，保证任何地方都能 100% 呼出
window.showManual = function() {
    const modal = document.getElementById('manualModal');
    if(modal) modal.classList.add('show');
};

// 绑定关闭按钮
const closeManualBtn = document.getElementById('closeManualBtn');
if(closeManualBtn) {
    closeManualBtn.addEventListener('click', () => {
        document.getElementById('manualModal').classList.remove('show');
    });
}

// 页面加载完成后，检查是不是新用户
window.addEventListener('load', () => {
    // 延迟 3.5 秒，等开屏动画播完、主界面稳定后再弹出来，体验最丝滑
    setTimeout(() => {
        if (!localStorage.getItem('starlight_has_seen_manual')) {
            window.showManual();
            // 标记为已看，下次不再自动弹
            localStorage.setItem('starlight_has_seen_manual', 'true');
        }
    }, 3500);
});

// =====================================
// 邀请新成员加入群聊功能
// =====================================
window.openInviteMemberModal = async function() {
    if (!currentChatContact) return;
    let contacts = await loadFromDB('chat_contacts') || [];
    let contactInfo = contacts.find(c => c.id === currentChatContact.id);
    if (!contactInfo || !contactInfo.isGroup) return;

    // 获取全部角色并过滤出不在群里的
    const allChars = await loadFromDB('ai_characters') || [];
    const aiChars = allChars.filter(c => c.roleType === 'char');
    const availableChars = aiChars.filter(c => !contactInfo.members.includes(c.id));
    
    if (availableChars.length === 0) {
        showToast('档案库里的角色都已经在这个群里啦~');
        return;
    }

    // 构建弹窗
    let modal = document.getElementById('inviteMemberModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'inviteMemberModal';
        modal.className = 'custom-confirm-overlay';
        document.body.appendChild(modal);
    }
    
    let listHtml = '';
    for (let char of availableChars) {
        let avatarUrl = diaryAvatarCache[char.id];
        if (avatarUrl === undefined) {
            const f = await loadFromDB(`char_avatar_${char.id}`);
            avatarUrl = f ? URL.createObjectURL(f) : '';
            diaryAvatarCache[char.id] = avatarUrl;
        }

        listHtml += `
            <div class="char-card invite-char-card" data-id="${char.id}" style="cursor:pointer; display:flex; align-items:center; padding:14px 16px; margin-bottom:12px; background:rgba(255,255,255,0.6); border:1.5px solid rgba(255,255,255,0.6); border-radius:20px; transition:0.2s;" onclick="this.classList.toggle('selected')">
                <div class="char-card-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : 'background-color:rgba(184,156,142,0.2)'}; width:46px; height:46px; border-radius:16px; box-shadow: 0 4px 12px rgba(128,118,110,0.06); flex-shrink:0; background-size:cover; background-position:center;"></div>
                <div class="char-card-info" style="flex:1; margin-left:14px;">
                    <div class="char-card-name" style="font-size:15px; font-weight:800; color:var(--text-main); letter-spacing:1px;">${char.name}</div>
                </div>
                <div class="sel-check" style="width:22px; height:22px; border-radius:50%; border:1.5px solid rgba(184,156,142,0.3); display:flex; justify-content:center; align-items:center; background: rgba(255,255,255,0.5); transition:all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); flex-shrink:0;">
                    <svg viewBox="0 0 24 24" style="width:14px; height:14px; stroke:#fff; fill:none; stroke-width:3.5; stroke-linecap:round; stroke-linejoin:round; opacity:0; transform:scale(0.5); transition:all 0.3s;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="custom-confirm-box" style="background:#F6F4F0; width: 85vw; max-width: 320px; padding: 24px 20px; display:flex; flex-direction:column; max-height:80vh;">
            <div class="cc-title" style="margin-bottom:16px; font-size:16px;">邀请新成员</div>
            <style>
                .invite-char-card.selected { background: #fff !important; border-color: var(--accent) !important; box-shadow: 0 12px 32px rgba(184,156,142,0.18) !important; }
                .invite-char-card.selected .sel-check { background: var(--accent) !important; border-color: var(--accent) !important; transform: scale(1.1); }
                .invite-char-card.selected .sel-check svg { opacity: 1 !important; transform: scale(1) !important; }
            </style>
            <div style="flex:1; overflow-y:auto; padding-bottom:12px; margin-bottom:12px; scrollbar-width:none;">
                ${listHtml}
            </div>
            <div class="cc-btns" style="margin-top:auto;">
                <button class="cc-btn cancel" onclick="document.getElementById('inviteMemberModal').classList.remove('show')">取消</button>
                <button class="cc-btn primary" id="confirmInviteBtn" style="background:var(--accent); box-shadow: 0 4px 16px rgba(184,156,142,0.3);">确认邀请</button>
            </div>
        </div>
    `;
    
    modal.classList.add('show');
    
    // 确认邀请逻辑
    document.getElementById('confirmInviteBtn').onclick = async () => {
        const selectedCards = modal.querySelectorAll('.invite-char-card.selected');
        if (selectedCards.length === 0) {
            showToast('请至少选择一位需要邀请的角色！');
            return;
        }
        
        const newMemberIds = Array.from(selectedCards).map(c => c.dataset.id);
        const newMemberNames = Array.from(selectedCards).map(c => c.querySelector('.char-card-name').innerText);
        
        // 1. 将新成员追加到群列表并保存
        contactInfo.members = contactInfo.members.concat(newMemberIds);
        await saveToDB('chat_contacts', contacts);
        
        modal.classList.remove('show');
        showToast('新成员已加入群聊！');
        
        // 2. 发送全群可见的系统公告消息
        let history = await loadFromDB(`chat_history_${currentChatContact.id}`) || [];
        const sysText = `${newMemberNames.join('、')} 被邀请加入了群聊`;
        history.push({ role: 'system', content: sysText, timestamp: Date.now() });
        await saveToDB(`chat_history_${currentChatContact.id}`, history);
        
        // 3. 静默刷新所有聊天室渲染
        if (document.getElementById('chatRoomPanel').classList.contains('show')) {
            await renderChatMessages(history, currentChatContact.id);
            // 这里用了一个取巧的方法，利用自带的旧函数闭环，重新模拟点击右上角的“设置”按钮以无缝刷新面板成员列表
            const refreshBtn = document.getElementById('chatRoomSettingsBtn');
            if (refreshBtn) refreshBtn.click();
        }
    };
};
