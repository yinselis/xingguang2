// === 信笺APP 终极侧边栏架构逻辑 ===
const letterModal = document.getElementById('letterAppModal');
const drawer = document.getElementById('letterDrawer');
const drawerOverlay = document.getElementById('letterDrawerOverlay');

let draftsData = []; 
let mailboxData = [];
let currentDraftId = null;
let saveDraftTimer = null;

// ==== 自动触发错投信件的核心函数 ====
async function triggerRandomWrongMail() {
// === 拦截器：后台耗钱开关 ===
const isWrongMailEnabled = await loadFromDB('globalWrongMail') !== false;
if (!isWrongMailEnabled) return; // 开关关了，直接退出不花钱

    // --- 新增：每天只掷一次骰子机制 ---
const todayStr = new Date().toLocaleDateString();
const lastRollDate = await loadFromDB('lastWrongMailRollDate');
if (lastRollDate === todayStr) return; // 今天已经判定过了，直接退出

await saveToDB('lastWrongMailRollDate', todayStr); // 记录今天已经判定过

if(Math.random() > 0.25) return; // 25%的概率中奖触发
    
    const useSubApi = await loadFromDB('letterUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if(apiKey) {
        try {
            const sysPrompt = `请随机生成一封“寄错地址的信件”。发件人和收件人必须是随机的虚构人物、古代名人或科幻角色。\n格式必须严格如下，用 | 隔开：\n发件人名字|收件人名字|信件正文内容（写一段隐秘的、充满感情的话）\n不要输出任何其他废话。`;
            
            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.9 })
            });
            const data = await res.json();
            const replyText = data.choices[0].message.content;
            
            let parts = replyText.split('|');
            let sender = "未知寄件人";
            let content = replyText;
            if(parts.length >= 3) {
                sender = parts[0].trim();
                content = `(本应寄给：${parts[1].trim()})\n\n${parts.slice(2).join('|').trim()}`;
            }
            
            // 存入邮箱并标记为错寄 (isWrong: true)
            const mailList = await loadFromDB('letter_mailbox') || [];
            mailList.unshift({ id: 'wrong_'+Date.now(), sender: sender, content: content, timestamp: Date.now(), isRead: false, isWrong: true });
            await saveToDB('letter_mailbox', mailList);
            mailboxData = mailList; // 更新当前内存
            
            // 优雅的顶部小弹窗提示
            const toast = document.createElement('div');
            toast.innerText = '📮 邮筒里似乎刚被塞入了一封寄错的信...';
            toast.style.cssText = 'position:absolute; top:30px; left:50%; transform:translateX(-50%); background:var(--accent); color:#fff; padding:12px 24px; border-radius:24px; font-size:13px; font-weight:bold; z-index:9999; box-shadow:0 8px 24px rgba(184,156,142,0.4); opacity:0; transition:opacity 0.4s, top 0.4s;';
            document.getElementById('letterAppModal').appendChild(toast);
            
            // 动画效果
            setTimeout(() => { toast.style.opacity = '1'; toast.style.top = '40px'; }, 100);
            setTimeout(() => { toast.style.opacity = '0'; toast.style.top = '30px'; }, 3500);
            setTimeout(() => toast.remove(), 4000);
            
            // 如果邮筒正开着，立刻刷新列表
            if(document.getElementById('letterMailboxPanel').classList.contains('show')) {
                renderMailbox();
            }
        } catch(e) {} // 后台静默执行，失败了不打扰用户
    }
}

// ==== 绑定信笺APP图标点击 ====
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('信笺')) {
        app.addEventListener('click', async () => {
            // 1. 先在后台静默把数据拉取完毕
            await loadLetterData();
            if(draftsData.length === 0) createNewDraft();
            else switchDraft(draftsData[0].id);
            
            // 2. 抄袭梦境的写法，在这里提前给副API开关和羁绊开关赋值
            const isSub = await loadFromDB('letterUseSubApi') || false;
            document.getElementById('towerApiToggle').checked = isSub;
            
            const isAutoSummary = await loadFromDB('letterAutoSummary') || false;
            document.getElementById('towerAutoSummaryToggle').checked = isAutoSummary;
            document.getElementById('autoSummarySettings').style.display = isAutoSummary ? 'block' : 'none';
            
            const rounds = await loadFromDB('letterSummaryRounds') || 15;
            document.getElementById('towerSummaryRounds').value = rounds;

            // 3. 所有的DOM状态准备就绪后，再丝滑展开面板，告别闪烁！
            letterModal.classList.add('open');
            
            
        });
    }
});

document.getElementById('closeLetterAppBtn').addEventListener('click', () => letterModal.classList.remove('open'));

// 侧栏呼出与关闭
document.getElementById('letterMenuBtn').addEventListener('click', () => {
    renderDrawerList();
    drawer.classList.add('show');
    drawerOverlay.classList.add('show');
});
drawerOverlay.addEventListener('click', closeDrawer);
function closeDrawer() {
    drawer.classList.remove('show');
    drawerOverlay.classList.remove('show');
}

// 自动保存机制 (极其丝滑)
function triggerAutoSave() {
    clearTimeout(saveDraftTimer);
    saveDraftTimer = setTimeout(async () => {
        if(!currentDraftId) return;
        const draft = draftsData.find(d => d.id === currentDraftId);
        if(draft) {
            draft.title = document.getElementById('letterCurrentTitle').value || '无题';
            draft.content = document.getElementById('letterMainContent').value;
            await saveToDB('letter_drafts', draftsData);
        }
    }, 600); // 停止打字0.6秒后无感保存
}
document.getElementById('letterCurrentTitle').addEventListener('input', triggerAutoSave);
document.getElementById('letterMainContent').addEventListener('input', triggerAutoSave);

async function loadLetterData() {
    draftsData = await loadFromDB('letter_drafts') || [];
    mailboxData = await loadFromDB('letter_mailbox') || [];
}

function createNewDraft() {
    const newId = 'draft_' + Date.now();
    draftsData.unshift({ id: newId, title: '无题', content: '' });
    saveToDB('letter_drafts', draftsData);
    switchDraft(newId);
}
document.getElementById('letterAddBtn').addEventListener('click', () => {
    createNewDraft();
    closeDrawer();
});

function switchDraft(id) {
    currentDraftId = id;
    const draft = draftsData.find(d => d.id === id);
    if(draft) {
        document.getElementById('letterCurrentTitle').value = draft.title;
        document.getElementById('letterMainContent').value = draft.content;
    }
}

// 侧边栏列表渲染
function renderDrawerList() {
    const listEl = document.getElementById('letterDrawerList');
    listEl.innerHTML = '';
    draftsData.forEach(draft => {
        const item = document.createElement('div');
        item.className = 'drawer-item' + (draft.id === currentDraftId ? ' active' : '');
        item.innerHTML = `
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${draft.title || '无题'}</div>
            <div class="drawer-item-del" data-id="${draft.id}">×</div>
        `;
        item.onclick = (e) => {
            if(e.target.classList.contains('drawer-item-del')) {
                // 删除此草稿
                showBeautifulDialog('销毁文稿', '确定要将这页信纸撕毁吗？', 'confirm', '', async () => {
                    draftsData = draftsData.filter(d => d.id !== draft.id);
                    await saveToDB('letter_drafts', draftsData);
                    if(draftsData.length === 0) createNewDraft();
                    else if (draft.id === currentDraftId) switchDraft(draftsData[0].id);
                    renderDrawerList();
                });
            } else {
                switchDraft(draft.id);
                closeDrawer();
            }
        };
        listEl.appendChild(item);
    });
}

// === 信号塔 与 羁绊记忆 ===



// 打开设置面板 (此时状态已经是正确的，绝不会闪动)
document.getElementById('openTowerBtn').addEventListener('click', () => {
    document.getElementById('towerModal').classList.add('show');
});

// 取消与关闭
document.getElementById('cancelTowerBtn').addEventListener('click', () => {
    document.getElementById('towerModal').classList.remove('show');
});

// 监听“羁绊总结”开关，动态展开/收起下方输入框
document.getElementById('towerAutoSummaryToggle').addEventListener('change', function(e) {
    document.getElementById('autoSummarySettings').style.display = e.target.checked ? 'block' : 'none';
});

// 保存信号塔设置
document.getElementById('saveTowerBtn').addEventListener('click', async () => {
    await saveToDB('letterUseSubApi', document.getElementById('towerApiToggle').checked);
    await saveToDB('letterAutoSummary', document.getElementById('towerAutoSummaryToggle').checked);
    
    let rounds = parseInt(document.getElementById('towerSummaryRounds').value);
    if (isNaN(rounds) || rounds < 1) rounds = 15; // 防止填乱七八糟的内容
    await saveToDB('letterSummaryRounds', rounds);
    
    document.getElementById('towerModal').classList.remove('show');
});

// 羁绊记忆管理面板逻辑
document.getElementById('openBondBtn').addEventListener('click', async () => {
    document.getElementById('bondMemoryContent').value = await loadFromDB('letter_bond_memory') || '';
    document.getElementById('bondModal').classList.add('show');
});
document.getElementById('closeBondBtn').addEventListener('click', () => document.getElementById('bondModal').classList.remove('show'));
document.getElementById('saveBondBtn').addEventListener('click', async () => {
    await saveToDB('letter_bond_memory', document.getElementById('bondMemoryContent').value);
    document.getElementById('bondModal').classList.remove('show');
});
// 信物珍藏册管理逻辑
document.getElementById('openKeepsakeBtn').addEventListener('click', async () => {
    document.getElementById('keepsakeContent').value = await loadFromDB('letter_keepsake_memory') || '';
    document.getElementById('keepsakeModal').classList.add('show');
});
document.getElementById('closeKeepsakeBtn').addEventListener('click', () => document.getElementById('keepsakeModal').classList.remove('show'));
document.getElementById('saveKeepsakeBtn').addEventListener('click', async () => {
    await saveToDB('letter_keepsake_memory', document.getElementById('keepsakeContent').value);
    document.getElementById('keepsakeModal').classList.remove('show');
    showToast('信物已妥善珍藏！');
});
// === 寄出信件 ===
document.getElementById('openSendDialogBtn').addEventListener('click', async () => {
    const chars = await loadFromDB('ai_characters') || [];
    const select = document.getElementById('letterSendCharacter');
    select.innerHTML = '<option value="">-- 选择寄给已有角色 --</option>';
    chars.forEach(c => {
        if(c.roleType === 'char') select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    document.getElementById('letterMyName').value = await loadFromDB('letterMyName') || '';
    document.getElementById('letterMySeal').value = await loadFromDB('letterMySeal') || '';
    document.getElementById('letterTaSeal').value = await loadFromDB('letterTaSeal') || '';
    document.getElementById('letterSendPanel').classList.add('show');
});
document.getElementById('cancelSendBtn').addEventListener('click', () => document.getElementById('letterSendPanel').classList.remove('show'));

document.getElementById('confirmSendBtn').addEventListener('click', async () => {
    const btn = document.getElementById('confirmSendBtn');
    const content = document.getElementById('letterMainContent').value.trim();
    if(!content) { showToast('信纸还是空的哦！'); return; }
    
    await saveToDB('letterMyName', document.getElementById('letterMyName').value);
    await saveToDB('letterMySeal', document.getElementById('letterMySeal').value);
    await saveToDB('letterTaSeal', document.getElementById('letterTaSeal').value);

    const useSubApi = await loadFromDB('letterUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if(!apiKey) { showToast('请先在设置中配置API节点！'); return; }

    const charId = document.getElementById('letterSendCharacter').value;
    const sendName = document.getElementById('letterSendName').value;
    const myName = document.getElementById('letterMyName').value || '匿名者';
    const seal = document.getElementById('letterMySeal').value;
    const realDateStr = new Date().toLocaleDateString();
    const taSeal = document.getElementById('letterTaSeal').value;
    
    let targetDesc = '';
    let targetNameForSummary = sendName || '陌生人';
    if(charId) {
        const chars = await loadFromDB('ai_characters') || [];
        const role = chars.find(c => c.id === charId);
        if(role) {
            targetDesc = `你是${role.name}。${role.prompt}`;
            targetNameForSummary = role.name;
        }
    } else {
        const sendEra = document.getElementById('letterSendEra').value || '未知';
        targetDesc = `你是一个身处【${sendEra}】时代的【${sendName||'随机陌生人'}】`;
    }
    
    const emojiDesc = seal ? `\n寄件人在信纸上留下了专属印记：【${seal}】。` : '';
    const taSealDesc = taSeal ? `\n【核心相认提示】：寄件人在信中向你出示了你曾经给TA的专属暗号/信物：【${taSeal}】。` : '';
    const bond = await loadFromDB('letter_bond_memory');
    const memoryPrompt = bond ? `\n【已有羁绊记忆】：${bond}` : '';

    const sysPrompt = `${targetDesc}
此时此刻的真实日期是：${realDateStr}。
你收到了一封来自自称“${myName}”的时空来信，内容：“${content}”。${emojiDesc}${taSealDesc}${memoryPrompt}

请用符合你身份、时代、人物性格的语气，给ta回一封信。
【强制格式要求】：
1. 必须在回信的第一行写一个简短的标题，用【】括起来（例如：【致未来的你】或【关于那只蝴蝶】）。
2. 从第二行开始写回信正文。
3. 【羁绊成长】：如果我们交流很久了，你可以主动提出或者使用一个属于我们俩的【专属标记/暗号】作为落款。
4. 必须真实代入设定！直接自然地写出回信正文！`;

    // ================= 核心：界面立刻关闭，开启后台任务 =================
    document.getElementById('letterSendPanel').classList.remove('show');
    showToast('寄出啦，去逛逛别的吧~');
    
    // (匿名自执行异步函数：把它丢到后台去慢慢跑，不再阻塞界面)
    (async function backgroundSendTask() {
        try {
            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.8 })
            });
            const data = await res.json();
            const replyContent = data.choices[0].message.content;
            
            let mailTitle = targetNameForSummary;
            let mailBody = replyContent;
            if(replyContent.startsWith('【') && replyContent.includes('】')) {
                const endIdx = replyContent.indexOf('】');
                mailTitle = replyContent.substring(1, endIdx);
                mailBody = replyContent.substring(endIdx + 1).trim();
            }
            
            // 读取最新的邮筒数据并存入新信件
            let currentMailbox = await loadFromDB('letter_mailbox') || [];
            currentMailbox.unshift({
                id: 'mail_' + Date.now(),
                sender: mailTitle,
                content: mailBody,
                timestamp: Date.now(), seal: seal, isRead: false
            });
            await saveToDB('letter_mailbox', currentMailbox);
            mailboxData = currentMailbox; // 更新内存数据
            
            // 叮咚！像 QQ 消息一样弹出悬浮窗！
            showToast('叮咚！邮筒有新信件！');
            
            // 如果用户正巧开着邮筒，立刻帮他刷新列表
            if(document.getElementById('letterMailboxPanel').classList.contains('show')) {
                renderMailbox();
            }
            
        // 自动总结羁绊逻辑
const isAutoSummary = document.getElementById('towerAutoSummaryToggle').checked;
if (isAutoSummary) {
    // 1. 读取你设定的目标轮数（没设就是15）
    let targetRounds = await loadFromDB('letterSummaryRounds');
    if (!targetRounds || isNaN(targetRounds)) targetRounds = 15;
    
    // 2. 读取你和这个角色当前的通信轮数计步器
    let currentRounds = await loadFromDB('bond_rounds_' + targetNameForSummary) || 0;
    currentRounds++; // 加上这次刚完成的一来一回

    // 3. 判断是否攒够了设定的轮数
    if (currentRounds >= targetRounds) {
        // 攒够了！清零计步器，并呼叫 AI 提炼羁绊
        await saveToDB('bond_rounds_' + targetNameForSummary, 0);
        triggerBondSummary(apiUrl, apiKey, model, targetNameForSummary, myName, bond, content, mailBody);
    } else {
        // 还没攒够，把新的计步数字存进数据库，默默等待
        await saveToDB('bond_rounds_' + targetNameForSummary, currentRounds);
        // 可以在后台偷偷看当前到第几轮了（选填，不影响运行）
        console.log(`【${targetNameForSummary}】羁绊积累中: ${currentRounds} / ${targetRounds}`);
    }
}
        } catch(e) {
            showToast('🌪️ 邮递员在时空隧道迷路了: ' + e.message);
        }
    })();
});

// === 邮筒与错寄信件 ===
// === 打开邮筒与渲染逻辑 ===
document.getElementById('openMailboxBtn').addEventListener('click', async () => {
    // 每次打开邮筒前，先检查一下有没有“在路上飘了几天终于寄到”的信
    const now = Date.now();
    let hasNewArrival = false;
    
    mailboxData.forEach(mail => {
        if (mail.deliverTime && mail.deliverTime <= now) {
            delete mail.deliverTime; // 时间到了！抹掉延迟标记，让它正式掉进邮筒！
            mail.timestamp = now;    // 把收信时间更新为此时此刻
            hasNewArrival = true;
        }
    });

    if (hasNewArrival) {
        await saveToDB('letter_mailbox', mailboxData);
        showToast('叮咚！有在路上漂泊了很久的信件终于送达了！');
    }

    renderMailbox();
    document.getElementById('letterMailboxPanel').classList.add('show');
});

document.getElementById('closeMailboxBtn').addEventListener('click', () => document.getElementById('letterMailboxPanel').classList.remove('show'));

function renderMailbox() {
    const list = document.getElementById('mailboxList');
    list.innerHTML = '';
    const now = Date.now();
    
    // ★ 核心改动：把还在路上（时间没到）的信件藏起来不显示
    const visibleMails = mailboxData.filter(m => !m.deliverTime || m.deliverTime <= now);
    
    visibleMails.forEach(mail => {
        const div = document.createElement('div');
        div.className = 'mail-card';
        div.innerHTML = `
            <div style="font-weight:bold; font-size:15px; margin-bottom:4px;">${mail.sender} ${mail.isWrong ? '<span style="color:#D67A7A;font-size:10px;">[错寄]</span>' : (!mail.isRead ? '<span style="color:var(--accent);font-size:10px;">[新]</span>' : '')}</div>
            <div style="font-size:12px; color:var(--text-sub); display:-webkit-box; -webkit-line-clamp:2; overflow:hidden; -webkit-box-orient:vertical;">${mail.isRead ? mail.content : '一封尚未拆开的信...'}</div>
        `;
        div.onclick = () => openReadMail(mail);
        list.appendChild(div);
    });
}

document.getElementById('checkNewMailBtn').addEventListener('click', async () => {
    const btn = document.getElementById('checkNewMailBtn');
    btn.innerText = "正在信箱底部摸索..."; 
    btn.disabled = true;

    const useSubApi = await loadFromDB('letterUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if(apiKey) {
        try {
            const sysPrompt = `请随机生成一封“公开漂流瓶/交友信/随笔分享”。可能是有人想交笔友、分享一首诗、一段伤感随笔、一个搞笑段子，或者是科幻/古代背景下的公开广播。
发件人必须是随机设定的虚构人物、古代名人或科幻角色。
格式必须严格如下，用 | 隔开：
发件人名字|信件标题|信件正文内容
不要输出任何其他废话。`;
            
            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.9 })
            });
            const data = await res.json();
            const replyText = data.choices[0].message.content;
            
            let parts = replyText.split('|');
            let sender = "匿名的分享者";
            let content = replyText;
            if(parts.length >= 3) {
                sender = parts[0].trim();
                content = `【${parts[1].trim()}】\n\n${parts.slice(2).join('|').trim()}`;
            }
            
            // 注意这里 isWrong 是 false，因为这是公开分享，不是错寄的
            mailboxData.unshift({ id: 'public_'+Date.now(), sender: sender, content: content, timestamp: Date.now(), isRead: false, isWrong: false });
            await saveToDB('letter_mailbox', mailboxData);
            renderMailbox();
        } catch(e){ showToast('摸索失败了，可能是网络信号不好。'); }
    } else {
        showToast('请先在设置中配置API节点哦！');
    }
    
    btn.innerText = "翻看是否有新信件..."; 
    btn.disabled = false;
});

let currentReadId = null;
function openReadMail(mail) {
    currentReadId = mail.id;
    document.getElementById('readLetterTitle').innerText = mail.sender;
    document.getElementById('readLetterMeta').innerText = new Date(mail.timestamp).toLocaleString();
    document.getElementById('readLetterContent').innerText = mail.content;
    document.getElementById('readLetterSeal').innerText = mail.seal ? `印记: ${mail.seal}` : '';
    
    if(mail.isWrong) document.getElementById('wrongMailActions').style.display = 'flex';
    else document.getElementById('wrongMailActions').style.display = 'none';

    if(!mail.isRead) { mail.isRead = true; saveToDB('letter_mailbox', mailboxData); renderMailbox(); }
    document.getElementById('letterReadPanel').classList.add('show');
}
document.getElementById('closeReadBtn').addEventListener('click', () => document.getElementById('letterReadPanel').classList.remove('show'));

// 私藏错寄信件
document.getElementById('keepWrongMailBtn').addEventListener('click', async () => {
    showToast("你悄悄把这封信收了起来...");
    const mail = mailboxData.find(m => m.id === currentReadId);
    if(mail) { 
        mail.isWrong = false; 
        mail.sender = "私藏的信：" + mail.sender; 
        await saveToDB('letter_mailbox', mailboxData); 
    }
    document.getElementById('letterReadPanel').classList.remove('show'); 
    renderMailbox();
});

// 退回错寄信件（静默呼叫API生成感谢信）
// 退回错寄信件（静默呼叫API生成感谢信，并在几天后送达）
document.getElementById('returnWrongMailBtn').addEventListener('click', async () => {
    const mail = mailboxData.find(m => m.id === currentReadId);
    if (!mail) return;

    // 1. 关闭面板并给出温柔提示
    document.getElementById('letterReadPanel').classList.remove('show'); 
    showToast('已交给邮递员退回原处...');

    // 2. 把这封错寄的信从你的邮筒删掉
    mailboxData = mailboxData.filter(m => m.id !== currentReadId);
    await saveToDB('letter_mailbox', mailboxData);
    renderMailbox();

    // 3. 开启后台静默任务，呼叫 API 写感谢信
    (async function backgroundReturnThanks() {
        const useSubApi = await loadFromDB('letterUseSubApi') || false;
        const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
        const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
        const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

        if (!apiKey) return;

        try {
            const sysPrompt = `你之前不小心寄错了一封信，内容是：“${mail.content}”。
有一位好心的陌生人没有私藏，而是把信退回了邮局，最终物归原主。
请你以原来寄件人（${mail.sender}）的身份，给这位善良的陌生人写一封简短的感谢信。
【要求】
1. 感谢ta的善意，语气必须完全符合你（${mail.sender}）的人设背景。
2. 格式严格为：发件人|信件正文
3. 不要有多余的废话。`;

            const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                body:JSON.stringify({ model, messages:[{role:"system",content:sysPrompt}], temperature:0.8 })
            });
            
            const data = await res.json();
            const replyText = data.choices[0].message.content;
            
            let parts = replyText.split('|');
            let senderName = mail.sender;
            let replyContent = replyText;
            if(parts.length >= 2) {
                senderName = parts[0].trim();
                replyContent = parts.slice(1).join('|').trim();
            }

            // ★ 核心改动：计算送达时间（随机 3 到 7 天之后）
            const delayDays = Math.floor(Math.random() * 5) + 3; // 3 ~ 7 天
            const deliverTime = Date.now() + delayDays * 24 * 60 * 60 * 1000;
            
            // 💡 如果你写代码时想马上测试效果，可以暂时把上面两行删掉，换成下面这行（1分钟后送达）：
            // const deliverTime = Date.now() + 1 * 60 * 1000; 

            let currentMailbox = await loadFromDB('letter_mailbox') || [];
            currentMailbox.unshift({ 
                id: 'thanks_' + Date.now(), 
                sender: `${senderName} 的感谢信`, 
                content: replyContent, 
                timestamp: Date.now(), 
                deliverTime: deliverTime, // 悄悄打上送达时间标签
                isRead: false, 
                isWrong: false 
            });
            await saveToDB('letter_mailbox', currentMailbox);
            mailboxData = currentMailbox; 
            
            // 注意：由于是几天后才到，所以我们不弹提示，让它彻底隐藏在后台。
        } catch(e) {}
    })();
});

// === 自动提炼羁绊记忆 (Prompt 2) ===
async function triggerBondSummary(apiUrl, apiKey, model, targetName, senderName, oldMemory, myLetter, aiReply) {
    try {
        const hText = `我的去信：${myLetter}\n对方的回信：${aiReply}`;
        const sysSummary = `你是一个记忆提炼助手。请根据下方的往来书信记录，提炼出【${targetName}】与【${senderName}】之间的羁绊记忆。
【已有记忆】：
${oldMemory || '无'}

【最近通信】：
${hText}

【核心要求】：
1. 重点提炼双方约定的【专属暗号】、经常互寄的【贴纸/物品】、以及彼此之间发生的重要事件和情感变化。
2. 以第三人称客观陈述，尽量压缩精简，保留干货，不超过350字。
3. 绝对不要输出任何无关废话、问候语或Markdown代码块。`;

        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
            body:JSON.stringify({ model, messages:[{role:"system",content:sysSummary}], temperature:0.5 })
        });
        const data = await res.json();
        const newMemory = data.choices[0].message.content.trim();
        
        // 自动保存到本地羁绊记忆，并更新弹窗里显示的文字
        await saveToDB('letter_bond_memory', newMemory);
        document.getElementById('bondMemoryContent').value = newMemory;
        console.log("羁绊记忆已自动更新！");
        
    } catch(e) {
        console.error("提炼羁绊记忆失败：", e);
    }
}

// === 日记 APP 交互逻辑 (支持相片与头像缓存版) ===
const diaryModal = document.getElementById('diaryAppModal');
const diaryWritePanel = document.getElementById('diaryWritePanel');
const diaryReadPanel = document.getElementById('diaryReadPanel');
const exchangeDetailPanel = document.getElementById('exchangeDetailPanel');
let diaryCurrentTab = 'private'; 
let diariesData = [];
let currentExchangeChar = null; 
let tempDiaryImgFile = null;
window.diaryAvatarCache = window.diaryAvatarCache || {}; 
let diaryAvatarCache = window.diaryAvatarCache; // 【核心】解决头像闪烁的缓存

document.querySelectorAll('.app-name').forEach(appNameDiv => {
    if (appNameDiv.innerText.trim() === '日记') {
        const appIcon = appNameDiv.closest('.app');
        if (appIcon) {
            appIcon.addEventListener('click', async () => {
                diaryModal.classList.add('open');
                await loadDiaryData();
            });
        }
    }
});
document.getElementById('closeDiaryApp').addEventListener('click', () => diaryModal.classList.remove('open'));

document.querySelectorAll('#diaryTabSelector .diary-tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#diaryTabSelector .diary-tab-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        diaryCurrentTab = btn.dataset.tab;
        
        document.getElementById('privateDiaryView').style.display = 'none';
        document.getElementById('exchangeDiaryView').style.display = 'none';
        document.getElementById('aiDiaryView').style.display = 'none';
        
        if (diaryCurrentTab === 'private') {
            document.getElementById('privateDiaryView').style.display = 'block';
            renderPrivateDiaryList();
        } else if (diaryCurrentTab === 'exchange') {
            document.getElementById('exchangeDiaryView').style.display = 'block';
            renderExchangeCharacterList();
                } else if (diaryCurrentTab === 'ai_diary') {
            document.getElementById('aiDiaryView').style.display = 'block';
            renderAiDiaryList();
        }
    });
});

async function loadDiaryData() {
    diariesData = await loadFromDB('diary_records') || [];
    let changed = false;
    const now = Date.now();
    // 时间到了，系统偷偷把写好的回信展示出来
    diariesData.forEach(d => {
        if (d.type === 'exchange' && !d.aiContent && d.replyTime && d.replyTime <= now && d.pendingReplyText) {
            d.aiContent = d.pendingReplyText; 
            delete d.pendingReplyText;
            changed = true;
        }
    });
    if (changed) await saveToDB('diary_records', diariesData);

        if (diaryCurrentTab === 'private') {
        renderPrivateDiaryList();
    } else if (diaryCurrentTab === 'exchange') {
        renderExchangeCharacterList();
    } else if (diaryCurrentTab === 'ai_diary') {
        renderAiDiaryList();
    }
}

async function renderPrivateDiaryList() {
    const privateDiaries = diariesData.filter(d => d.type === 'private');
    document.getElementById('privateTotalCount').innerText = `${privateDiaries.length} 篇`;

    // 1. 提前后台预加载图片并缓存（彻底消灭等待白屏）
    for (let diary of privateDiaries) {
        if (diary.hasImage && diaryAvatarCache['diary_img_'+diary.id] === undefined) {
            const file = await loadFromDB(`diary_img_${diary.id}`);
            diaryAvatarCache['diary_img_'+diary.id] = file ? URL.createObjectURL(file) : '';
        }
    }

    const container = document.getElementById('diaryListArea');
    if (privateDiaries.length === 0) {
        container.innerHTML = '<div class="diary-poetic-empty"><svg viewBox="0 0 24 24"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg><div class="diary-poetic-text">岁月如白纸，等落笔生花</div></div>'; 
        return;
    }

    // 2. 内存中构建 HTML，不立刻清理屏幕
    const frag = document.createDocumentFragment();
    for (let diary of privateDiaries) {
        const div = document.createElement('div');
        div.className = 'organic-card';
        const dObj = new Date(diary.timestamp);
        
        let imgHtml = '';
        if (diary.hasImage && diaryAvatarCache['diary_img_'+diary.id]) {
            imgHtml = `<div style="width:100%; height:80px; border-radius:12px; background:url(${diaryAvatarCache['diary_img_'+diary.id]}) center/cover; margin-top:12px;"></div>`;
        }

        div.innerHTML = `
            <div class="organic-date">
                <span class="o-day">${dObj.getDate()}</span><span class="o-month">/${dObj.getMonth()+1}</span>
                <span class="o-time">${dObj.getHours()}:${dObj.getMinutes().toString().padStart(2,'0')}</span>
            </div>
            <div class="diary-mood-badge">${diary.mood}</div>
            <div class="diary-content-preview">${diary.myContent}</div>
            ${imgHtml}
        `;
        div.onclick = () => openReadPanel(diary);
        frag.appendChild(div);
    }
    
    // 3. 瞬间替换，彻底告别闪烁！
    container.innerHTML = '';
    container.appendChild(frag);
}

async function renderExchangeCharacterList() {
    const chars = await loadFromDB('ai_characters') || [];
    const exchangeChars = chars.filter(c => c.roleType === 'char');
    const container = document.getElementById('exchangeCharacterList');

    for (let char of exchangeChars) {
        if (diaryAvatarCache[char.id] === undefined) {
            const f = await loadFromDB(`char_avatar_${char.id}`);
            diaryAvatarCache[char.id] = f ? URL.createObjectURL(f) : '';
        }
    }

    if (exchangeChars.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">档案室空空如也，先去创造角色吧...</div>'; 
        return;
    }

    const frag = document.createDocumentFragment();
    for (let char of exchangeChars) {
        const div = document.createElement('div');
        div.className = 'exchange-char-card';
        div.innerHTML = `
            <div class="ec-avatar" style="${diaryAvatarCache[char.id] ? `background-image:url(${diaryAvatarCache[char.id]})` : ''}"></div>
            <div class="ec-info">
                <div class="ec-name">${char.name}</div>
                <div class="ec-desc">SPIRITUAL BOND</div>
            </div>
            <div class="invite-share-btn" onclick="sendDiaryInvite(event, '${char.id}', '${char.name.replace(/'/g, "\\'")}')" style="position: relative; z-index: 10; padding: 16px; margin-right: -4px; color: var(--accent); display: flex; align-items: center; justify-content: center; transition: 0.2s;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="pointer-events: none;"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </div>
        `;
        // 【核心修改】：这里不再直接进内页，而是打开书架
        div.onclick = async (e) => {
    const agreement = await loadFromDB(`diary_agreement_${char.id}`);
    if (agreement && agreement.agreed) {
        openBookshelf(char);
    } else {
        showToast('TA还没同意交换日记，请先点击右侧按钮发送邀请~');
    }
};
        frag.appendChild(div);
    }
    
    container.innerHTML = '';
    container.appendChild(frag);
}

// === 打开书架的函数 (支持长按改名) ===
async function openBookshelf(char) {
    currentExchangeChar = char;
    document.getElementById('bookshelfTitle').innerText = char.name + " 的书架";
    const shelf = document.getElementById('bookshelfGrid');
    
    // 读取这个角色名下所有的书
    let books = await loadFromDB(`diary_books_${char.id}`) || [];
    // 兼容老数据，如果你之前已经有了一本，把它平滑转移到新架构里
    if (books.length === 0) {
        let oldAg = await loadFromDB(`diary_agreement_${char.id}`);
        if (oldAg && oldAg.agreed) {
            let oldName = await loadFromDB(`diary_book_name_${char.id}`) || '交换日记';
            books.push({ id: 'default', name: oldName, days: oldAg.days || 7, startTime: oldAg.startTime });
            await saveToDB(`diary_books_${char.id}`, books);
        }
    }

    shelf.innerHTML = '';
    const diariesData = await loadFromDB('diary_records') || [];
    let hasActiveBook = false; // 是否还有未写完的活跃书本

    // 循环遍历每一本书进行渲染
    for (let i = 0; i < books.length; i++) {
        let book = books[i];
        // 精准过滤属于这本书的日记（老日记自动归入 default）
        const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === char.id && (d.bookId === book.id || (!d.bookId && book.id === 'default')));
        list.sort((a, b) => b.timestamp - a.timestamp);

        const uniqueDays = new Set(list.map(d => {
            let t = new Date(d.timestamp);
            return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate();
        })).size;
        
        let isUserFinished = uniqueDays >= book.days;
        let isCompleted = isUserFinished && list[0] && list[0].aiContent && list[0].aiContent.trim() !== '';

        if (!isCompleted) hasActiveBook = true;

        let startD = new Date(book.startTime || Date.now());
        let startStr = `${startD.getFullYear()}.${startD.getMonth()+1}.${startD.getDate()}`;
        let endStr = isCompleted && list.length > 0 ? `${new Date(list[0].timestamp).getFullYear()}.${new Date(list[0].timestamp).getMonth()+1}.${new Date(list[0].timestamp).getDate()}` : '至今';

        let sealBadge = isCompleted ? `<div style="position:absolute; top:12px; right:-24px; background:#D67A7A; color:#fff; font-size:10px; font-weight:bold; padding:2px 24px; transform:rotate(45deg); box-shadow:0 2px 4px rgba(0,0,0,0.15); letter-spacing:2px; z-index:10;">已封存</div>` : '';

        const bookDiv = document.createElement('div');
        bookDiv.className = 'diary-book-cover';
        bookDiv.style.overflow = 'hidden';
        bookDiv.innerHTML = `
            ${sealBadge}
            <div class="db-title-wrapper">
                <div class="db-title" id="bookTitle_${book.id}">${book.name}</div>
            </div>
            <div class="db-sub">LUMINA DIARY</div>
            <div style="font-size:9px; color:var(--text-sub); margin-top:10px; font-weight:bold; font-family:-apple-system, sans-serif; transform:scale(0.9); opacity:0.8;">${startStr} - ${endStr}</div>
        `;

        // 点击书本翻开它
        bookDiv.onclick = async () => {
            window.currentExchangeBook = book; // 全局锁定当前看的是哪本书
            document.getElementById('exchangeDetailName').innerText = book.name;
            document.getElementById('exchangeCheckinBadge').innerText = isCompleted ? `已封存 (${uniqueDays} / ${book.days} 天)` : `已打卡 ${uniqueDays} / ${book.days} 天`;
            document.getElementById('openExchangeWriteBtn').style.display = isUserFinished ? 'none' : 'flex';
            
            await renderExchangeDetailList();
            document.getElementById('exchangeDetailPanel').classList.add('show');
        };

        // 长按改名
        let pressTimer;
        bookDiv.addEventListener('touchstart', (e) => { pressTimer = setTimeout(() => { renameDiaryBook(char.id, book.id, book.name); }, 600); }, {passive: true});
        bookDiv.addEventListener('touchend', () => clearTimeout(pressTimer));
        bookDiv.addEventListener('touchmove', () => clearTimeout(pressTimer));
        bookDiv.oncontextmenu = (e) => { e.preventDefault(); renameDiaryBook(char.id, book.id, book.name); };

        shelf.appendChild(bookDiv);
    }

    // 如果该角色的书已经全部封存（没有活跃的书），就添加一个“新建”按钮！
    if (!hasActiveBook && books.length > 0) {
        const addDiv = document.createElement('div');
        addDiv.className = 'diary-book-cover';
        addDiv.style.background = 'transparent';
        addDiv.style.border = '2px dashed rgba(184,156,142,0.4)';
        addDiv.style.boxShadow = 'none';
        addDiv.style.display = 'flex'; addDiv.style.justifyContent = 'center'; addDiv.style.alignItems = 'center';
        addDiv.style.color = 'var(--accent)'; addDiv.style.fontSize = '14px'; addDiv.style.fontWeight = 'bold';
        addDiv.innerHTML = '<div style="text-align:center;"><div style="font-size:24px; margin-bottom:8px;">+</div>新日记本</div>';
        
 addDiv.onclick = () => {
    showBeautifulDialog('建立新羁绊', `旧的打卡已封存，是否要前往聊天室，向 ${char.name} 发送新的日记邀请？\n(当 TA 再次同意后，书架就会生成一本全新空白的日记本哦！)`, 'confirm', '', () => {
        // 1. 关闭日记APP相关面板
        document.getElementById('exchangeBookshelfPanel').classList.remove('show');
        document.getElementById('diaryAppModal').classList.remove('open');
        
        // 2. 强行拉出聊天APP面板，并进入专属聊天室
        document.getElementById('chatAppModal').classList.add('open');
        openChatRoom(char.id, char.name);
        
        // 3. 延迟半秒钟，自动替你弹出发邀请的弹窗连招！
        setTimeout(() => {
            const mockEvent = { stopPropagation: () => {} }; // 伪造一个点击事件防止报错
            sendDiaryInvite(mockEvent, char.id, char.name);
        }, 500);
    });
};
        shelf.appendChild(addDiv);
    }

    document.getElementById('exchangeBookshelfPanel').classList.add('show');

    // 多书本改名引擎
    function renameDiaryBook(charId, bookId, oldName) {
        const cc = document.getElementById('customConfirm');
        cc.querySelector('.cc-title').innerText = "重命名日记本";
        cc.querySelector('.cc-desc').innerText = "为这本日记起一个新的名字：";
        const inputEl = cc.querySelector('.cc-input');
        inputEl.style.display = 'block'; inputEl.value = oldName;
        
        const btnBox = cc.querySelector('.cc-btns');
        const oldHtml = btnBox.innerHTML;
        btnBox.innerHTML = `<button class="cc-btn cancel" id="cancelRenameBtn" style="flex:1;">取消</button><button class="cc-btn primary" id="confirmRenameBtn" style="flex:1;">确定</button>`;
        cc.classList.add('show');
        
        document.getElementById('cancelRenameBtn').onclick = () => { cc.classList.remove('show'); btnBox.innerHTML = oldHtml; inputEl.style.display = 'none'; };
        document.getElementById('confirmRenameBtn').onclick = async () => {
            const newName = inputEl.value.trim();
            if (newName) {
                let savedBooks = await loadFromDB(`diary_books_${charId}`) || [];
                let b = savedBooks.find(b => b.id === bookId);
                if (b) {
                    b.name = newName;
                    await saveToDB(`diary_books_${charId}`, savedBooks);
                    document.getElementById(`bookTitle_${bookId}`).innerText = newName;
                    showToast('日记本已重新命名！');
                    if (window.currentExchangeBook && window.currentExchangeBook.id === bookId) window.currentExchangeBook.name = newName;
                }
            }
            cc.classList.remove('show'); btnBox.innerHTML = oldHtml; inputEl.style.display = 'none';
        };
    }
}

// === 退出逻辑调整 ===
// 1. 退出书架（返回人员列表）
document.getElementById('closeBookshelfBtn').addEventListener('click', () => {
    document.getElementById('exchangeBookshelfPanel').classList.remove('show');
    currentExchangeChar = null; // 彻底退出才清空记录
    loadDiaryData();
});

// 2. 找到原来的 closeExchangeDetailBtn 逻辑，把它覆盖替换为以下代码：
// 在手账内页点“合上日记本”，只退回到书架层
document.getElementById('closeExchangeDetailBtn').addEventListener('click', () => {
    document.getElementById('exchangeDetailPanel').classList.remove('show');
    // 注意这里不清空 currentExchangeChar，因为还要在书架看！
});

async function renderAiDiaryList() {
    const aiDiaries = diariesData.filter(d => d.type === 'ai_diary');
    const container = document.getElementById('aiDiaryListArea');

    if (aiDiaries.length === 0) {
        container.innerHTML = '<div class="diary-poetic-empty"><svg viewBox="0 0 24 24"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg><div class="diary-poetic-text">TA暂时还没有留下任何回音...</div></div>'; 
        return;
    }

    const frag = document.createDocumentFragment();
    for (let diary of aiDiaries) {
        const div = document.createElement('div');
        div.className = 'ai-diary-card';
        const dObj = new Date(diary.timestamp);
        
        let avatarUrl = diaryAvatarCache[diary.aiId];
        if (avatarUrl === undefined) {
            const file = await loadFromDB(`char_avatar_${diary.aiId}`);
            avatarUrl = file ? URL.createObjectURL(file) : '';
            diaryAvatarCache[diary.aiId] = avatarUrl;
        }

        div.innerHTML = `
            <div class="ai-card-header">
                <div class="ai-card-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl})` : 'background-color:rgba(184,156,142,0.2)'}"></div>
                <div>
                    <div class="ai-card-name">${diary.aiName}</div>
                    <div class="ai-card-time">${dObj.getMonth()+1}/${dObj.getDate()} ${dObj.getHours()}:${dObj.getMinutes().toString().padStart(2,'0')}</div>
                </div>
            </div>
            <div class="diary-content-preview" style="color: var(--text-main); line-height: 1.7; font-size: 13.5px;">${diary.myContent}</div>
        `;
        // 点击打开阅读面板
        div.onclick = () => openReadPanel(diary);
        frag.appendChild(div);
    }
    
    container.innerHTML = '';
    container.appendChild(frag);
}

async function renderExchangeDetailList() {
    if (!currentExchangeChar || !window.currentExchangeBook) return;
    const book = window.currentExchangeBook;

    // 精准过滤出只属于当前这本书的日记！
    const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === currentExchangeChar.id && (d.bookId === book.id || (!d.bookId && book.id === 'default')));
    list.sort((a,b) => b.timestamp - a.timestamp);

    const uniqueDays = new Set(list.map(d => {
        let t = new Date(d.timestamp);
        return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate();
    })).size;
    
    let isUserFinished = uniqueDays >= book.days;
    let isCompleted = isUserFinished && list[0] && list[0].aiContent && list[0].aiContent.trim() !== '';
    
    let badge = document.getElementById('exchangeCheckinBadge');
    if (badge) {
        badge.innerText = isCompleted ? `已封存 (${uniqueDays} / ${book.days} 天)` : `已打卡 ${uniqueDays} / ${book.days} 天`;
        if (isCompleted) {
            badge.style.background = '#FFF0F0';
            badge.style.color = '#D67A7A';
        } else {
            badge.style.background = 'rgba(184,156,142,0.15)';
            badge.style.color = 'var(--accent)';
        }
    }
    
    const writeBtn = document.getElementById('openExchangeWriteBtn');
    if (writeBtn) writeBtn.style.display = isUserFinished ? 'none' : 'flex';

    const container = document.getElementById('exchangeDetailList');

    for (let diary of list) {
        if (diary.hasImage && diaryAvatarCache['diary_img_'+diary.id] === undefined) {
            const file = await loadFromDB(`diary_img_${diary.id}`);
            diaryAvatarCache['diary_img_'+diary.id] = file ? URL.createObjectURL(file) : '';
        }
    }

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:40px;">这是全新的日记本，主动留下一篇吧。</div>'; 
        return;
    }

    // 2. 内存中构建 HTML
    const frag = document.createDocumentFragment();
    for (let diary of list) {
    const div = document.createElement('div');
    div.className = 'organic-card';
    // 赋予卡片更精致的信纸底色和留白
    div.style.padding = '20px 24px';
    div.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(253,251,247,0.85))';
    div.style.border = '1px solid rgba(255,255,255,0.8)';
    
    const dObj = new Date(diary.timestamp);
    
    let imgHtml = '';
    if (diary.hasImage && diaryAvatarCache['diary_img_'+diary.id]) {
        imgHtml = `<div style="width:100%; height:130px; border-radius:12px; background:url(${diaryAvatarCache['diary_img_'+diary.id]}) center/cover; margin:16px 0 12px 0; box-shadow:0 4px 12px rgba(0,0,0,0.05);"></div>`;
    }
    
    // 智能判断并构建 TA 的回信区块
    // 智能判断并构建 TA 的回信区块 (透明硫酸纸便签风)
let aiReplyHtml = '';
if (diary.aiContent) {
    aiReplyHtml = `
    <div style="margin-top:16px; padding:16px; background: rgba(255,255,255,0.6); border-radius:16px; border: 1.5px solid rgba(255,255,255,0.9); box-shadow: 0 4px 12px rgba(128,118,110,0.03), inset 0 2px 10px rgba(184,156,142,0.02);">
        <div style="font-size:10px; font-weight:800; color:var(--accent); margin-bottom:8px; letter-spacing:1px; display:flex; align-items:center; gap:6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${diary.aiName}
        </div>
        <div class="diary-content-preview" style="color:var(--text-main); font-size:14px; line-height:1.7;">${diary.aiContent}</div>
    </div>`;
} else {
    // 未回信：柔和的虚线框
    aiReplyHtml = `
    <div style="margin-top:16px; padding:12px 16px; background:transparent; border:1.5px dashed rgba(184,156,142,0.25); border-radius:16px;">
        <div class="diary-content-preview" style="color:var(--text-sub); font-size:11px; font-weight:600; text-align:center; letter-spacing:1px;">🎵 信件还在时空中穿梭...</div>
    </div>`;
}

    div.innerHTML = `
        <!-- 头部：日期与心情同行错落排版 -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div style="display:flex; align-items:baseline; gap:4px;">
                <span style="font-size:28px; font-weight:800; color:var(--text-main); font-family:-apple-system, sans-serif; letter-spacing:-1px; line-height:1;">${dObj.getDate()}</span>
                <span style="font-size:11px; font-weight:700; color:var(--text-sub); text-transform:uppercase;">${dObj.toLocaleString('en-US',{month:'short'})}</span>
            </div>
<div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
    <div style="font-size:11px; color:var(--text-sub); font-weight:600; font-family:monospace;">${dObj.getHours().toString().padStart(2,'0')}:${dObj.getMinutes().toString().padStart(2,'0')}</div>
    <div style="display:flex; gap:6px;">
        <div style="font-size:10px; font-weight:800; color:var(--accent); background:rgba(184,156,142,0.12); padding:3px 8px; border-radius:6px; letter-spacing:1px;">${diary.mood}</div>
        ${diary.aiMood && diary.aiContent ? `<div style="font-size:10px; font-weight:800; color:var(--text-sub); background:rgba(150,143,137,0.12); padding:3px 8px; border-radius:6px; letter-spacing:1px;">TA: ${diary.aiMood}</div>` : ''}
    </div>
</div>
        </div>
        
        ${imgHtml}
        
                <!-- 我的日记正文 -->
        <div class="diary-content-preview" style="color:var(--text-main); font-size:14.5px; line-height:1.8; letter-spacing:0.5px; padding: 0 4px;">${diary.myContent}</div>
        
        <!-- TA的回信模块 -->
        ${aiReplyHtml}
    `;
    div.onclick = () => openReadPanel(diary);
    frag.appendChild(div);
}
    
    // 3. 瞬间替换
    container.innerHTML = '';
    container.appendChild(frag);
}

document.getElementById('closeExchangeDetailBtn').addEventListener('click', () => {
    exchangeDetailPanel.classList.remove('show');
    currentExchangeChar = null;
    loadDiaryData(); 
});

// 写日记与发图逻辑
let currentMood = '平静';
const customMoodInput = document.getElementById('customMoodInput');

document.querySelectorAll('.mood-chip').forEach(chip => {
    if(chip.id === 'customMoodInput' || chip.classList.contains('habit-chip')) return; // 跳过输入框和防健忘打卡
    chip.addEventListener('click', () => {
        document.querySelectorAll('.mood-chip:not(.habit-chip)').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentMood = chip.dataset.mood;
        customMoodInput.value = ''; // 点击自带心情时，清空自定义输入框
    });
});

customMoodInput.addEventListener('input', (e) => {
    document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
    customMoodInput.classList.add('active');
    currentMood = e.target.value.trim() || '神秘心情';
});
customMoodInput.addEventListener('click', (e) => {
    document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
    customMoodInput.classList.add('active');
    currentMood = e.target.value.trim() || '神秘心情';
});

let currentReplyTimeType = 'now';
document.querySelectorAll('#replyTimeSelector .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#replyTimeSelector .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentReplyTimeType = btn.dataset.time;
    });
});

document.getElementById('diaryImgUploadBtn').addEventListener('click', () => document.getElementById('diaryImgInput').click());
document.getElementById('diaryImgInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        tempDiaryImgFile = file;
        document.getElementById('diaryImgPreview').style.backgroundImage = `url(${URL.createObjectURL(file)})`;
        document.getElementById('diaryImgPreview').style.display = 'block';
        document.getElementById('diaryImgUploadBtn').style.display = 'none';
    }
});
document.getElementById('diaryImgDelBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    tempDiaryImgFile = null;
    document.getElementById('diaryImgInput').value = '';
    document.getElementById('diaryImgPreview').style.display = 'none';
    document.getElementById('diaryImgUploadBtn').style.display = 'flex';
});

function resetWritePanel() {
    document.getElementById('diaryInputContent').value = '';
    tempDiaryImgFile = null;
    document.getElementById('diaryImgInput').value = '';
    document.getElementById('diaryImgPreview').style.display = 'none';
    document.getElementById('diaryImgUploadBtn').style.display = 'flex';
    // 清空打卡按钮的选中状态
    document.querySelectorAll('.habit-chip').forEach(c => c.classList.remove('active'));
}

// 绑定打卡按钮的点击切换事件
document.querySelectorAll('.habit-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        chip.classList.toggle('active'); // 点一下选中，再点一下取消
    });
});

document.getElementById('openWriteDiaryBtn').addEventListener('click', () => {
    resetWritePanel();
    document.getElementById('exchangeSettingsArea').style.display = 'none';
    document.getElementById('openWriteDiaryBtn').style.display = 'none';
    diaryWritePanel.classList.add('show');
});

document.getElementById('openExchangeWriteBtn').addEventListener('click', () => {
    resetWritePanel();
    document.getElementById('exchangeSettingsArea').style.display = 'block';
    diaryWritePanel.classList.add('show');
});

document.getElementById('cancelDiaryBtn').addEventListener('click', () => {
    diaryWritePanel.classList.remove('show');
    document.getElementById('openWriteDiaryBtn').style.display = 'flex';
});

// === 图片转 Base64 辅助函数（用于 AI 识图） ===
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// === 全局日记折叠控制函数 ===
window.toggleDiaryExpand = function(wrapperId, btn) {
    const wrapper = document.getElementById(wrapperId);
    if (wrapper.classList.contains('collapsed')) {
        wrapper.classList.remove('collapsed');
        wrapper.classList.add('expanded');
        btn.innerText = '收起 ∧';
    } else {
        wrapper.classList.remove('expanded');
        wrapper.classList.add('collapsed');
        btn.innerText = '展开阅读 ∨';
    }
};

document.getElementById('saveDiaryBtn').addEventListener('click', async function() {
    const content = document.getElementById('diaryInputContent').value.trim();
    if (!content && !tempDiaryImgFile) { showToast('写点字或者配张图吧~'); return; }

    // 获取选中的打卡项
    const selectedHabits = Array.from(document.querySelectorAll('.habit-chip.active')).map(c => c.dataset.habit);

    const newDiary = {
        id: 'diary_' + Date.now(), timestamp: Date.now(), mood: currentMood, myContent: content, hasImage: !!tempDiaryImgFile, habits: selectedHabits
    };

    if (tempDiaryImgFile) await saveToDB(`diary_img_${newDiary.id}`, tempDiaryImgFile);

    if (diaryCurrentTab === 'private') {
    newDiary.type = 'private';
    diariesData.unshift(newDiary);
    await saveToDB('diary_records', diariesData);
    diaryWritePanel.classList.remove('show');
    document.getElementById('openWriteDiaryBtn').style.display = 'flex';
    renderPrivateDiaryList();

    } else {
        // === 交换模式：后台投递 + AI 识图支持 ===
        newDiary.type = 'exchange';
newDiary.aiId = currentExchangeChar.id;
newDiary.aiName = currentExchangeChar.name; 
newDiary.bookId = window.currentExchangeBook ? window.currentExchangeBook.id : 'default'; // ★ 关键：印上日记本的专属ID

const now = Date.now();
        if (currentReplyTimeType === 'now') { newDiary.replyTime = now; }
        else if (currentReplyTimeType === 'random') { newDiary.replyTime = now + (Math.floor(Math.random() * 48) + 2) * 3600000; } 

        const useSubApi = await loadFromDB('diaryUseSubApi') || false;
        const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
        const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
        const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

        if (!apiKey) { 
            showToast('未配置API，日记仅保存在本地'); 
            diariesData.unshift(newDiary); await saveToDB('diary_records', diariesData);
            diaryWritePanel.classList.remove('show'); renderExchangeDetailList();
            return; 
        }

        // 1. 【核心体验优化】立刻关闭弹窗！存入“待回信”状态
newDiary.pendingReplyText = ''; 
newDiary.aiContent = '';
diariesData.unshift(newDiary);
await saveToDB('diary_records', diariesData);

// 先等底层列表重新渲染完毕（读取数据库图片），再降下写日记的面板，彻底消灭闪烁！
await renderExchangeDetailList();
diaryWritePanel.classList.remove('show');
document.getElementById('openWriteDiaryBtn').style.display = 'flex';


        // 2. 剥离到后台默默执行的 AI 请求
        (async function backgroundSendTask() {
            let timeInstruction = currentReplyTimeType === 'aidecide' ? `\n【重要指令】：请在回复最后另起一行加 [DELAY:小时数] 决定回信送达所需的时间。如 [DELAY:12] 代表12小时后。` : '';

                        // --- 新增：算出这是打卡第几天 ---
            const book = window.currentExchangeBook;
            const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === currentExchangeChar.id && (d.bookId === book.id || (!d.bookId && book.id === 'default')));
            const uniqueDays = new Set(list.map(d => { let t = new Date(d.timestamp); return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate(); })).size;
            // -----------------------------

            const sysPrompt = `你扮演：${currentExchangeChar.name}。详细设定：${currentExchangeChar.prompt}
【任务】：用户正在和你“交换日记”。当前是你们这本日记打卡的第 ${uniqueDays} 天（共约定 ${book ? book.days : 7} 天）。你需要以日记的口吻，回写一篇你的日记来作为交换。

【内容要求】：
1. 用户的今天心情是【${currentMood}】。
2. 随意发散，分享一件符合你角色设定和时代背景的日常小事、一个念头或一点碎碎念，想写什么都可以，随意发挥。
3. 必须遵守你的人物性格特征、身份。思考你应该如何回应？想记录什么？避免陷入性格的刻板印象。
4. 【新增强制要求】：请在日记正文的开头，用 [心情:你的心情] 标出你写这篇日记时的心情，例如 [心情:心安] 或 [心情:有些疲惫]。

【文风要求 - 极简白描】（最高优先级）：
1. 必须使用“白描”手法，文字平实、自然、克制。
2. 绝对不要浮夸、不要矫情、不要故意伤春悲秋或过度抒情。
3. 严禁堆砌华丽辞藻，不要乱用莫名其妙的比喻、成语。
4. 就像真实生活中的人在平静地记录，不要有任何“演戏”或“写作文”的痕迹。
5. 绝对不要写聊天对白，不要写信件开头（如“亲爱的xx”），只输出日记正文段落。${timeInstruction}`;

            // 构造支持识图的复杂载荷
            let userMessagesContent = [{ type: "text", text: `这是我今天的日记：\n"${content}"\n请写下你的日记与我交换吧。` }];
            
            if (tempDiaryImgFile) {
                try {
                    const base64Img = await fileToBase64(tempDiaryImgFile);
                    userMessagesContent.push({
                        type: "image_url",
                        image_url: { url: base64Img }
                    });
                } catch(e) { console.error("图片转换失败"); }
            }

            try {
                const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
                    method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
                    body:JSON.stringify({ 
                        model, 
                        messages:[
                            {role:"system", content: sysPrompt},
                            {role:"user", content: userMessagesContent}
                        ], 
                        temperature: 0.8 
                    })
                });
const data = await res.json();
let aiText = data.choices[0].message.content.trim();

// --- 解析 AI 的心情 ---
let aiMood = '';
const moodMatch = aiText.match(/\[心情:(.*?)\]/i);
if (moodMatch) {
    aiMood = moodMatch[1].trim();
    aiText = aiText.replace(/\[心情:.*?\]/i, '').trim(); // 把标签从正文里剥离出来
}

if (currentReplyTimeType === 'aidecide') {
                    const match = aiText.match(/\[DELAY:(\d+)\]/i);
                    let delayHours = 24;
                    if (match) { delayHours = parseInt(match[1]); aiText = aiText.replace(/\[DELAY:\d+\]/ig, '').trim(); }
                    newDiary.replyTime = Date.now() + delayHours * 3600000;
                }

                // 更新数据库
                const latestDiaries = await loadFromDB('diary_records');
                const targetDiary = latestDiaries.find(d => d.id === newDiary.id);
               if (targetDiary) {
    targetDiary.aiMood = aiMood; // 存下TA的心情
    if (currentReplyTimeType === 'now') { targetDiary.aiContent = aiText; } 
                    else { targetDiary.pendingReplyText = aiText; targetDiary.aiContent = ''; }
                    await saveToDB('diary_records', latestDiaries);
                    diariesData = latestDiaries; 
                    
                    if (currentReplyTimeType === 'now') {
                        showToast(`叮咚！${currentExchangeChar.name} 给你回写了日记！`);
                        if (exchangeDetailPanel.classList.contains('show')) renderExchangeDetailList();
                    }
                }
            } catch(e) {
                showToast(`投递给 ${currentExchangeChar.name} 的信件丢失了：` + e.message);
            }
        })();
    }
});

async function openReadPanel(diary) {
    currentReadDiaryId = diary.id;
    const dObj = new Date(diary.timestamp);
    document.getElementById('readDiaryDateObj').innerHTML = `<span class="o-day">${dObj.getDate()}</span><span class="o-month">/${dObj.getMonth()+1}</span>`;
    document.getElementById('readDiaryTime').innerText = `${dObj.getHours()}:${dObj.getMinutes().toString().padStart(2,'0')}`;
    // 动态生成双心情标签
let moodHtml = `<div class="diary-mood-badge" style="display:inline-block; margin-right:8px;">${diary.mood}</div>`;
if (diary.type === 'exchange' && diary.aiContent && diary.aiMood) {
    moodHtml += `<div class="diary-mood-badge" style="display:inline-block; background:rgba(150,143,137,0.1); color:var(--text-sub);">TA: ${diary.aiMood}</div>`;
}
// 替换掉原来的外壳，防止 ID 冲突
const oldMoodEl = document.getElementById('readDiaryMood');
if (oldMoodEl) {
    const newWrapper = document.createElement('div');
    newWrapper.id = 'readDiaryMoodContainer';
    newWrapper.innerHTML = moodHtml;
    oldMoodEl.parentNode.replaceChild(newWrapper, oldMoodEl);
} else {
    document.getElementById('readDiaryMoodContainer').innerHTML = moodHtml;
}
    const imgEl = document.getElementById('readDiaryImg');
    if (diary.hasImage) {
        const file = await loadFromDB(`diary_img_${diary.id}`);
        if (file) { imgEl.src = URL.createObjectURL(file); imgEl.style.display = 'block'; }
        else { imgEl.style.display = 'none'; }
    } else { imgEl.style.display = 'none'; }

// === 核心修复：把日记正文填入屏幕，并动态修改标题 ===
document.getElementById('readDiaryMyContent').innerText = diary.myContent || '';
const myLabelEl = document.getElementById('readDiaryMyContent').parentElement.previousElementSibling;
if (diary.type === 'ai_diary') {
    if(myLabelEl) myLabelEl.innerText = (diary.aiName || 'TA') + " 的悄悄话";
} else {
    if(myLabelEl) myLabelEl.innerText = "我的落笔";
}

    
    if (diary.type === 'exchange') {
        document.getElementById('readDiaryAiReplyArea').style.display = 'block';
        document.getElementById('readDiaryAiName').innerText = `${diary.aiName} 的日记`;
        document.getElementById('readDiaryAiContent').innerText = diary.aiContent ? diary.aiContent : '🎵 TA 的回信还在时空中穿梭，未到送达时间...';
    } else {
        document.getElementById('readDiaryAiReplyArea').style.display = 'none';
    }
    
    document.getElementById('openWriteDiaryBtn').style.display = 'none';
    diaryReadPanel.classList.add('show');
}
document.getElementById('closeReadDiaryBtn').addEventListener('click', () => {
    diaryReadPanel.classList.remove('show');
    document.getElementById('openWriteDiaryBtn').style.display = 'flex';
});

document.getElementById('deleteDiaryBtn').addEventListener('click', () => {
    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = '销毁日记';
    cc.querySelector('.cc-desc').innerText = '这页日记将被彻底粉碎，且相片也会被删除。';
    cc.classList.add('show');
    document.getElementById('ccConfirm').onclick = async () => {
    cc.classList.remove('show');
    const db = await initDB();
    const tx = db.transaction('allDataStore', 'readwrite');
    tx.objectStore('allDataStore').delete(`diary_img_${currentReadDiaryId}`);
    
    diariesData = diariesData.filter(d => d.id !== currentReadDiaryId);
    await saveToDB('diary_records', diariesData);
    diaryReadPanel.classList.remove('show');
    document.getElementById('openWriteDiaryBtn').style.display = 'flex';
    if (diaryCurrentTab === 'private') renderPrivateDiaryList();
    else renderExchangeDetailList();
    showToast('日记已销毁。');
};
    document.getElementById('ccCancel').onclick = () => cc.classList.remove('show');
});

// === 日记 APP 设置与统计面板逻辑 ===
// === 日记 APP 设置与统计面板逻辑 ===
document.getElementById('openDiarySettingsBtn').addEventListener('click', async () => {
    const modal = document.getElementById('diarySettingsModal');
    // 【杀手锏】先隐藏开关，剥夺动画权利
    const switches = modal.querySelectorAll('.switch');
    switches.forEach(s => s.style.display = 'none');

    // 1. 读取开关状态
    const isSub = await loadFromDB('diaryUseSubApi') || false;
    document.getElementById('diaryApiToggle').checked = isSub;
    const isAiAuto = await loadFromDB('diaryAiAutoToggle') || false;
    document.getElementById('diaryAiAutoToggle').checked = isAiAuto;

    // 2. 计算统计数据
    const allDiaries = await loadFromDB('diary_records') || [];
    const privateCount = allDiaries.filter(d => d.type === 'private').length;
    document.getElementById('statPrivateTotal').innerText = `私人: ${privateCount} 篇`;

    const chars = await loadFromDB('ai_characters') || [];
    const exchangeDiaries = allDiaries.filter(d => d.type === 'exchange');
    const statsList = document.getElementById('diaryStatsList');
    
    let charStatsHtml = '';
    chars.forEach(char => {
        if(char.roleType === 'char') {
            const count = exchangeDiaries.filter(d => d.aiId === char.id).length;
            if(count > 0) {
                charStatsHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-sub); border-bottom: 1px dashed rgba(184,156,142,0.15); padding-bottom: 8px;">
                    <span style="font-weight: 700; color: var(--text-main);">${char.name}</span>
                    <span style="background: rgba(184,156,142,0.1); padding: 4px 10px; border-radius: 8px; color: var(--accent); font-weight: 600;">共交换 ${count} 篇</span>
                </div>`;
            }
        }
    });
    
    if(charStatsHtml === '') {
        statsList.innerHTML = '<div style="text-align:center; font-size:12px; color:var(--text-sub); margin-top:10px;">还没有与任何人交换过日记。</div>';
    } else {
        statsList.innerHTML = charStatsHtml;
    }

    // 强制浏览器刷新一次隐藏状态，然后瞬间恢复显示！
    modal.offsetHeight; 
    switches.forEach(s => s.style.display = '');

    // 3. 打开面板
    modal.classList.add('show');
});

// 保存并关闭设置面板
document.getElementById('closeDiarySettingsBtn').addEventListener('click', async () => {
    await saveToDB('diaryUseSubApi', document.getElementById('diaryApiToggle').checked);
        await saveToDB('diaryAiAutoToggle', document.getElementById('diaryAiAutoToggle').checked);
    document.getElementById('diarySettingsModal').classList.remove('show');
});

// === 让 TA 偷偷写日记的后台随机触发逻辑 ===
async function triggerAiAutoDiary() {
// === 拦截器：后台耗钱总开关 ===
const isGlobalAutoDiaryEnabled = await loadFromDB('globalAutoDiary') !== false;
if (!isGlobalAutoDiaryEnabled) return; // 开关关了，直接退出不花钱

    // 1. 检查开关有没有打开
    const isAiAuto = await loadFromDB('diaryAiAutoToggle') || false;
    if (!isAiAuto) return; 

    // 【新增控制：每天限额】检查今天是否已经写过了！
    const todayStr = new Date().toLocaleDateString();
    const lastAiDiaryDate = await loadFromDB('lastAiDiaryDate');
    if (lastAiDiaryDate === todayStr) return; // 今天写过啦，直接退出！

// 2. 提高到 35% 的概率触发
    if (Math.random() > 0.35) return;

    // 3. 随机抽取一个允许自己写日记的角色
    const chars = await loadFromDB('ai_characters') || [];
    const aiChars = chars.filter(c => c.roleType === 'char' && c.allowAutoDiary !== false);
    if (aiChars.length === 0) return;
    const randomChar = aiChars[Math.floor(Math.random() * aiChars.length)];

    const useSubApi = await loadFromDB('diaryUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if (!apiKey) return;

    // --- 新增：获取当前具体时间，让 AI 感知 ---
    const now = new Date();
    const timeStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    let timeContext = '';
    if(now.getHours() >= 0 && now.getHours() < 6) timeContext = '深夜/凌晨';
    else if(now.getHours() < 12) timeContext = '上午';
    else if(now.getHours() < 18) timeContext = '下午';
    else timeContext = '晚上';
    // ----------------------------------------

    // ！！！核心提示词在这里 ！！！
    const sysPrompt = `你扮演：${randomChar.name}。你的详细设定：${randomChar.prompt}。
【核心任务】：请严格遵守你的身份性格和所处的时代背景，写下一篇你个人的私密日记。
【当前现实时间】：${timeStr} (${timeContext})。请务必让你的日记内容符合这个时间点该有的状态（比如深夜没睡、清晨刚醒、午休、下午摸鱼、傍晚等）。

【内容要求 - 极度自由发散】：
思维发散，随意发挥。你可以写一件微不足道的小事、脑海中一闪而过的念头、观察到的一个细节、对某人的吐槽，或者就是单纯的无聊碎碎念。不需要有头有尾，没有任何限制，你爱怎么写怎么写。

【文风要求 - 极简白描】（最高优先级强制指令）：
1. 必须使用“白描”手法，文字平实、自然、克制。
2. 绝对不要浮夸、不要矫情、不要故意伤春悲秋。
3. 严禁堆砌华丽辞藻，不要乱用莫名其妙的比喻、成语或四字词语。
4. 就像一个真实存在的人在平静地记录生活，不要有任何“演戏”或“写作文”的痕迹。

直接输出日记正文，不要写“亲爱的日记”之类的开头，不要自己加日期，绝对不要出戏。`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method:'POST', 
            headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`},
            body:JSON.stringify({ 
                model, 
                messages:[{role:"system", content: sysPrompt}], 
                temperature: 0.9 // 温度调高，让思维更发散
            })
        });
        
        const data = await res.json();
        const aiContent = data.choices[0].message.content.trim();

        // 存入数据库
        let diariesData = await loadFromDB('diary_records') || [];
        
        // --- 新增：检查有没有正在进行的交换日记本 ---
        let books = await loadFromDB(`diary_books_${randomChar.id}`) || [];
        let activeBook = null;
        for (let b of books) {
            const list = diariesData.filter(d => d.type === 'exchange' && d.aiId === randomChar.id && (d.bookId === b.id || (!d.bookId && b.id === 'default')));
            const uniqueDays = new Set(list.map(d => { let t = new Date(d.timestamp); return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate(); })).size;
            if (uniqueDays < b.days) { activeBook = b; break; } // 找到一本还没写完的！
        }

        // 如果有没写完的日记本，就有一半的概率主动写在交换日记里，一半概率写在私密悄悄话里
        if (activeBook && Math.random() > 0.5) {
            diariesData.unshift({
                id: 'exchange_' + Date.now(),
                timestamp: Date.now(),
                type: 'exchange',
                aiId: randomChar.id,
                aiName: randomChar.name,
                bookId: activeBook.id,
                myContent: "【TA 主动打卡了这天的交换日记，快去写下你的回应吧...】",
                aiContent: aiContent, // AI 的日记放在回信区
                mood: '期待',
                aiMood: '主动分享'
            });
            if (typeof showToast === 'function') showToast(`叮咚！${randomChar.name} 主动写下了一篇交换日记！`);
        } else {
            // 原来的写进“回音/悄悄话”的逻辑
            diariesData.unshift({
                id: 'ai_diary_' + Date.now(),
                timestamp: Date.now(),
                type: 'ai_diary',
                aiId: randomChar.id,
                aiName: randomChar.name,
                myContent: aiContent, 
                mood: 'TA的日常'
            });
        }
        await saveToDB('diary_records', diariesData);

        // 【最最最关键的一步】写完了，把今天的日期盖个章存下来！
        await saveToDB('lastAiDiaryDate', todayStr);

        // 如果用户正好停留在“TA的日记”界面，悄悄刷新一下
        if (document.getElementById('aiDiaryView') && document.getElementById('aiDiaryView').style.display === 'block') {
            if(typeof renderAiDiaryList === 'function') renderAiDiaryList(); 
        }
        
    } catch(e) {
        console.log("后台自动写日记失败: ", e);
    }
}

// 每次打开或者刷新这个网页时，偷偷在后台抛一次骰子
window.addEventListener('load', () => {
    // 延迟 8 秒再偷偷执行，给系统足够的时间处理开屏动画，完全不卡顿
    setTimeout(triggerAiAutoDiary, 8000); 
    setTimeout(triggerRandomWrongMail, 12000); 
});

// ==========================================
// 阅读共读 APP 核心逻辑 (多模式翻页 + 记忆联动)
// ==========================================
const readingModal = document.getElementById('readingAppModal');
let bookFullText = ''; 
let bookPages = [];
let currentReadPage = 0;
let bookTitle = '无名氏';
let readSelectedText = '';
let currentReadCompanionId = 'system';

// 多本书架新增的核心变量
let readBooksList = []; 
let currentReadBookId = null;

// 获取 DOM 元素
const readTextContainer = document.getElementById('readTextContainer');
const readPageText = document.getElementById('readPageText');
const readControlsBar = document.getElementById('readControlsBar');

// 内部设置变量
let rFontSize = 17;
let rMode = 'page'; 
let rUseSubApi = false;
let rReadContext = false;
let rContextCount = 10;
let rCustomCss = '';
function applyReadCss(cssText) {
    let styleTag = document.getElementById('dynamicReadCss');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamicReadCss';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = cssText || '';
}

// 切页算法
function splitBookText() {
    bookPages = [];
    const paragraphs = bookFullText.split('\n').filter(p => p.trim() !== '');
    let currentPageText = '';
    
    let dynamicLimit = Math.floor(260 * Math.pow(17 / rFontSize, 2));
    const limit = rMode === 'scroll' ? 4000 : dynamicLimit; 
    
    paragraphs.forEach(p => {
        currentPageText += `<p style="margin:0 0 16px 0;">${p}</p>`;
        if (currentPageText.length > limit) {
            bookPages.push(currentPageText);
            currentPageText = '';
        }
    });
    if (currentPageText) bookPages.push(currentPageText);
    
    if (currentReadPage >= bookPages.length) currentReadPage = Math.max(0, bookPages.length - 1);
}

// 渲染书页
function renderReadPage() {
    if (bookPages.length === 0) return;
    document.getElementById('readShelfState').style.display = 'none';
    document.getElementById('readContentState').style.display = 'flex';
    document.getElementById('openReadSettingsBtn').style.display = 'block'; 
    document.getElementById('backToReadShelfBtn').style.display = 'block'; 
    
    readPageText.innerHTML = bookPages[currentReadPage];
    document.getElementById('readPageIndicator').innerText = `${currentReadPage + 1} / ${bookPages.length}`;
    readTextContainer.scrollTop = 0;
    
    readTextContainer.style.fontSize = rFontSize + 'px';
    if (rMode === 'scroll') {
        readTextContainer.style.overflowY = 'auto'; 
        readControlsBar.style.display = 'flex'; 
        readPageText.style.minHeight = 'auto';
    } else {
        readTextContainer.style.overflowY = 'hidden'; 
        readTextContainer.scrollTop = 0; 
        readControlsBar.style.display = 'flex';
        readPageText.style.minHeight = '65vh';
    }
}

let isShelfManageMode = false;
let shelfSelectedBooks = [];

// 渲染书架
async function renderReadShelf() {
    readBooksList = await loadFromDB('read_books_list') || [];
    
    // 兼容你旧版单独保存的那本书，平滑迁移过来
    const oldCachedBook = await loadFromDB('cached_reading_book');
    if (oldCachedBook && oldCachedBook.fullText) {
        const newId = 'book_' + Date.now();
        readBooksList.push({ id: newId, title: oldCachedBook.title || '上次阅读', currentPage: oldCachedBook.currentPage || 0 });
        await saveToDB(`read_book_text_${newId}`, oldCachedBook.fullText);
        await saveToDB('read_books_list', readBooksList);
        await saveToDB('cached_reading_book', null); 
    }

    document.getElementById('readContentState').style.display = 'none';
    document.getElementById('readShelfState').style.display = 'flex';
    document.getElementById('backToReadShelfBtn').style.display = 'none';
    document.getElementById('openReadSettingsBtn').style.display = 'none';
    document.getElementById('readingBookTitle').innerText = '书架';

    const grid = document.getElementById('readShelfGrid');
    const empty = document.getElementById('readShelfEmpty');
    grid.innerHTML = '';
    
    if (readBooksList.length === 0) {
        empty.style.display = 'flex';
        grid.style.display = 'none';
        document.getElementById('shelfManageBtn').style.display = 'none'; // 没书时隐藏编辑按钮
        return;
    }
    
    empty.style.display = 'none';
    grid.style.display = 'flex';
    document.getElementById('shelfManageBtn').style.display = 'block';
    
    readBooksList.forEach(book => {
        const div = document.createElement('div');
        div.className = 'diary-book-cover';
        div.style.marginBottom = '16px';
        div.style.transition = '0.2s';
        
        let isSelected = shelfSelectedBooks.includes(book.id);
        
        div.innerHTML = `
            <div class="shelf-check" style="position:absolute; top:8px; left:8px; width:22px; height:22px; border-radius:50%; border:2px solid ${isSelected ? 'var(--accent)' : 'rgba(184,156,142,0.4)'}; background:${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.8)'}; display:${isShelfManageMode ? 'flex' : 'none'}; justify-content:center; align-items:center; z-index:10; transition:0.2s;">
                <svg viewBox="0 0 24 24" style="width:14px; height:14px; stroke:#fff; fill:none; stroke-width:3.5; stroke-linecap:round; opacity:${isSelected ? '1' : '0'}; transform:scale(${isSelected ? '1' : '0.5'}); transition:0.2s;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="db-title-wrapper" style="flex:1; display:flex; align-items:center; justify-content:center; border-top: 1px dashed rgba(184,156,142,0.4); border-bottom: 1px dashed rgba(184,156,142,0.4); margin:8px 0; padding:10px 4px;">
                <div class="db-title" style="font-size:14px; font-weight:800; color:var(--text-main); font-family:serif; text-align:center;">${book.title}</div>
            </div>
            <div style="font-size:10px; color:var(--text-sub); margin-top:4px; font-weight:bold;">第 ${book.currentPage + 1} 页</div>
        `;
        
        // 如果被选中了，让书本缩小一点，边框高亮，更有苹果多选的感觉
        if (isSelected) {
            div.style.transform = 'scale(0.95)';
            div.style.borderColor = 'var(--accent)';
            div.style.boxShadow = '0 0 0 2px var(--accent), 0 8px 20px rgba(184,156,142,0.2)';
        }
        
        div.onclick = async () => {
            if (isShelfManageMode) {
                // 编辑模式下的点击是选中/取消选中
                if (shelfSelectedBooks.includes(book.id)) {
                    shelfSelectedBooks = shelfSelectedBooks.filter(id => id !== book.id);
                } else {
                    shelfSelectedBooks.push(book.id);
                }
                renderReadShelf(); // 触发 UI 更新
                updateShelfMultiBar();
            } else {
                // 正常模式点击则是看书
                openBookFromShelf(book);
            }
        };
        
        // 长按直接进入编辑模式并选中这本书
        let pressTimer;
        div.addEventListener('touchstart', (e) => { 
            if (!isShelfManageMode) {
                pressTimer = setTimeout(() => { 
                    isShelfManageMode = true;
                    shelfSelectedBooks = [book.id];
                    toggleShelfManageUI(true);
                    renderReadShelf();
                    updateShelfMultiBar();
                }, 500); 
            }
        }, {passive:true});
        div.addEventListener('touchend', () => clearTimeout(pressTimer));
        div.addEventListener('touchmove', () => clearTimeout(pressTimer));
        
        grid.appendChild(div);
    });
}

function updateShelfMultiBar() {
    document.getElementById('shelfDeleteBtn').innerText = `删除 (${shelfSelectedBooks.length})`;
}

function toggleShelfManageUI(show) {
    if (show) {
        document.getElementById('shelfTopBtns').style.display = 'none';
        document.getElementById('shelfMultiBar').style.display = 'flex';
    } else {
        document.getElementById('shelfTopBtns').style.display = 'flex';
        document.getElementById('shelfMultiBar').style.display = 'none';
    }
}

// === 编辑按钮事件 ===
document.getElementById('shelfManageBtn').addEventListener('click', () => {
    isShelfManageMode = true;
    shelfSelectedBooks = [];
    toggleShelfManageUI(true);
    renderReadShelf();
    updateShelfMultiBar();
});

// === 取消编辑事件 ===
document.getElementById('shelfCancelManage').addEventListener('click', () => {
    isShelfManageMode = false;
    shelfSelectedBooks = [];
    toggleShelfManageUI(false);
    renderReadShelf();
});

// === 全选事件 ===
document.getElementById('shelfSelectAll').addEventListener('click', () => {
    if (shelfSelectedBooks.length === readBooksList.length) {
        shelfSelectedBooks = []; // 如果已经全选，就全取消
    } else {
        shelfSelectedBooks = readBooksList.map(b => b.id); // 全选
    }
    renderReadShelf();
    updateShelfMultiBar();
});

// === 确认删除事件 (调用绝美的全局确认弹窗) ===
document.getElementById('shelfDeleteBtn').addEventListener('click', () => {
    if (shelfSelectedBooks.length === 0) return;
    
    showBeautifulDialog('清理书架', `确定要将选中的 ${shelfSelectedBooks.length} 本书彻底从书架移除吗？`, 'confirm', '', async () => {
        // 删数据库里的书籍文字实体
        const db = await initDB();
        const tx = db.transaction('allDataStore', 'readwrite');
        shelfSelectedBooks.forEach(id => {
            tx.objectStore('allDataStore').delete(`read_book_text_${id}`);
        });
        
        // 从书架列表删掉
        readBooksList = readBooksList.filter(b => !shelfSelectedBooks.includes(b.id));
        await saveToDB('read_books_list', readBooksList);
        
        isShelfManageMode = false;
        shelfSelectedBooks = [];
        toggleShelfManageUI(false);
        renderReadShelf();
        showToast('已完成清理！');
    });
});

// 打开书架上的书
async function openBookFromShelf(book) {
    currentReadBookId = book.id;
    bookTitle = book.title;
    currentReadPage = book.currentPage || 0;
    document.getElementById('readingBookTitle').innerText = bookTitle;
    
    // 打开时提示加载，防止大文件白屏卡顿
    showToast('正在翻开书页...');
    setTimeout(async () => {
        bookFullText = await loadFromDB(`read_book_text_${book.id}`) || '空空如也...';
        splitBookText();
        renderReadPage();
    }, 100);
}

// 绑定打开APP按钮
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('阅读')) {
        app.addEventListener('click', async () => {
            const rSettings = await loadFromDB('read_settings') || {};
            rFontSize = rSettings.fontSize || 17;
            rMode = rSettings.mode || 'page';
            rUseSubApi = rSettings.useSubApi || false;
            rReadContext = rSettings.readContext || false;
            rContextCount = rSettings.contextCount || 10;
            rCustomCss = rSettings.customCss || '';
            applyReadCss(rCustomCss);
            
            readingModal.classList.add('open');
            await renderReadShelf();
        });
    }
});

// 保存进度并退出阅读
document.getElementById('closeReadingApp').addEventListener('click', async () => {
    readingModal.classList.remove('open');
    if (currentReadBookId) {
        let book = readBooksList.find(b => b.id === currentReadBookId);
        if (book) {
            book.currentPage = currentReadPage;
            await saveToDB('read_books_list', readBooksList);
        }
    }
    // 关闭时退出管理模式
    isShelfManageMode = false;
    toggleShelfManageUI(false);
});

// 返回书架按钮
document.getElementById('backToReadShelfBtn').addEventListener('click', async () => {
    if (currentReadBookId) {
        let book = readBooksList.find(b => b.id === currentReadBookId);
        if (book) {
            book.currentPage = currentReadPage;
            await saveToDB('read_books_list', readBooksList);
        }
    }
    renderReadShelf();
});

// 导入TXT
document.getElementById('shelfUploadBtn').addEventListener('click', () => document.getElementById('txtFileInput').click());
document.getElementById('txtFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const newTitle = file.name.replace('.txt', '');
    
    // 退出编辑模式
    isShelfManageMode = false;
    toggleShelfManageUI(false);
    
    showToast('正在解析书籍排版...');
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target.result;
        const newId = 'book_' + Date.now();
        
        readBooksList.unshift({ id: newId, title: newTitle, currentPage: 0 }); // 新书放在最前面
        await saveToDB('read_books_list', readBooksList);
        await saveToDB(`read_book_text_${newId}`, text);
        
        showToast('《' + newTitle + '》已上架！');
        renderReadShelf();
    };
    reader.readAsText(file);
    e.target.value = '';
});

// ==== 智能触控翻页 & 铅笔段落选取 ====
const doPrevPage = () => {
    if (currentReadPage > 0) { currentReadPage--; renderReadPage(); bindReadControls(); }
    else { showToast('已经是第一页啦'); }
};
const doNextPage = () => {
    if (currentReadPage < bookPages.length - 1) { currentReadPage++; renderReadPage(); bindReadControls(); }
    else { showToast('已经读完最后一页了！'); }
};

// 初始绑定底部栏按钮
bindReadControls();

let isPencilMode = false;
let selectedParagraphs = [];
let readChatHistoryForAi = [];

// 铅笔点击事件
document.getElementById('readPencilBtn').addEventListener('click', function() {
    isPencilMode = !isPencilMode;
    if (isPencilMode) {
        this.style.color = 'var(--accent)';
        this.style.background = 'rgba(184,156,142,0.15)';
        this.style.borderRadius = '8px';
        document.body.classList.add('reading-select-mode');
        selectedParagraphs = [];
        showToast('已开启画笔，点击你想分享的段落吧 (可多选)');
    } else {
        this.style.color = 'var(--text-main)';
        this.style.background = 'transparent';
        document.body.classList.remove('reading-select-mode');
        document.querySelectorAll('#readPageText p.selected').forEach(p => p.classList.remove('selected'));
        readControlsBarEl.innerHTML = originalControlsHtml;
        bindReadControls();
    }
});

// 直接给文字容器绑定点击，智能判断你要干嘛
document.getElementById('readTextContainer').addEventListener('click', (e) => {
    if (isPencilMode) {
        let pTag = e.target.closest('p');
        if (pTag) {
            pTag.classList.toggle('selected');
            if (pTag.classList.contains('selected')) {
                selectedParagraphs.push(pTag.innerText);
            } else {
                selectedParagraphs = selectedParagraphs.filter(t => t !== pTag.innerText);
            }
            
            if (selectedParagraphs.length > 0) {
                readControlsBarEl.innerHTML = `
                    <button class="s-btn" id="cancelPencilBtn" style="flex:1; border-radius: 12px; height: 44px; min-height: 44px; margin: 0;">取消</button>
                    <button class="s-btn primary" id="quickAskSentenceBtn" style="flex:2; border-radius: 12px; height: 44px; min-height: 44px; margin: 0 0 0 10px;">发送选中的 ${selectedParagraphs.length} 段</button>
                `;
                document.getElementById('cancelPencilBtn').onclick = () => {
                    selectedParagraphs = [];
                    document.querySelectorAll('#readPageText p.selected').forEach(p => p.classList.remove('selected'));
                    readControlsBarEl.innerHTML = originalControlsHtml;
                    bindReadControls();
                };
                document.getElementById('quickAskSentenceBtn').onclick = () => {
    // 强制按书本原有的上下排列顺序获取段落，无视手指点击的先后顺序
    const orderedElements = Array.from(document.querySelectorAll('#readPageText p.selected'));
    const orderedTexts = orderedElements.map(p => p.innerText);
    const textToSend = orderedTexts.join('\\n\\n');
    
    addUserReadingMessage('sentence', textToSend, orderedTexts.length);
    
    selectedParagraphs = [];
                    document.querySelectorAll('#readPageText p.selected').forEach(p => p.classList.remove('selected'));
                    readControlsBarEl.innerHTML = originalControlsHtml;
                    bindReadControls();
                    document.getElementById('readPencilBtn').click(); // 问完自动关掉铅笔
                };
            } else {
                readControlsBarEl.innerHTML = originalControlsHtml;
                bindReadControls();
            }
        }
        return; 
    }

    // 2. 如果你在屏幕上长按滑动选中了文本，就什么都不做，留给底部的长按判定
    if (window.getSelection().toString().trim().length > 0) return;

    // 3. 正常左右点击翻页
    if (rMode === 'page') {
        const rect = document.getElementById('readTextContainer').getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width * 0.3) {
            doPrevPage();
        } else if (x > rect.width * 0.7) {
            doNextPage();
        }
    }
});

// ==== 阅读设置面板逻辑 ====
const readSettingsPanel = document.getElementById('readSettingsPanel');
document.getElementById('openReadSettingsBtn').addEventListener('click', () => {
    // 填充数据
    document.getElementById('rFontDisp').innerText = rFontSize;
    document.querySelectorAll('#rModeSelector .role-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`#rModeSelector .role-btn[data-mode="${rMode}"]`).classList.add('active');
    
    document.getElementById('readApiToggle').checked = rUseSubApi;
    document.getElementById('readContextToggle').checked = rReadContext;
    document.getElementById('readContextCountWrap').style.display = rReadContext ? 'flex' : 'none';
    document.getElementById('readContextCount').value = rContextCount;
        document.getElementById('readCustomCss').value = rCustomCss;
        
    readSettingsPanel.classList.add('show');
});

document.getElementById('closeReadSettingsBtn').addEventListener('click', () => readSettingsPanel.classList.remove('show'));

document.getElementById('rFontMinus').onclick = () => { if (rFontSize > 12) rFontSize -= 1; document.getElementById('rFontDisp').innerText = rFontSize; };
document.getElementById('rFontPlus').onclick = () => { if (rFontSize < 36) rFontSize += 1; document.getElementById('rFontDisp').innerText = rFontSize; };

document.querySelectorAll('#rModeSelector .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#rModeSelector .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rMode = btn.dataset.mode;
    });
});

document.getElementById('readContextToggle').addEventListener('change', (e) => {
    document.getElementById('readContextCountWrap').style.display = e.target.checked ? 'flex' : 'none';
});

document.getElementById('saveReadSettingsBtn').addEventListener('click', async () => {
    rUseSubApi = document.getElementById('readApiToggle').checked;
    rReadContext = document.getElementById('readContextToggle').checked;
    rContextCount = parseInt(document.getElementById('readContextCount').value) || 10;
    
        rCustomCss = document.getElementById('readCustomCss').value;
    await saveToDB('read_settings', { fontSize: rFontSize, mode: rMode, useSubApi: rUseSubApi, readContext: rReadContext, contextCount: rContextCount, customCss: rCustomCss });
    applyReadCss(rCustomCss);
    
    if (bookFullText && bookFullText.trim() !== '') {
        splitBookText(); 
        renderReadPage(); 
    }
    
    readSettingsPanel.classList.remove('show');
    showToast('共读设定已生效');
});

// ==== 高级伴读角色选择器 ====
const companionPanel = document.getElementById('readCompanionPanel');
document.getElementById('openReadCompanionBtn').addEventListener('click', async () => {
    const chars = await loadFromDB('ai_characters') || [];
    const list = document.getElementById('readCompanionList');
    list.innerHTML = '';
    
    // 添加默认助手
    const sysCard = document.createElement('div');
    sysCard.className = 'char-card';
    sysCard.innerHTML = `
        <div class="char-card-avatar" style="background:var(--accent); color:#fff; border:none;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="char-card-info">
            <div class="char-card-name">内置伴读助手 <span class="role-badge badge-char" style="background:rgba(184,156,142,0.15); color:var(--accent);">默认</span></div>
            <div class="char-card-desc">纯粹、安静的 AI 读书助手</div>
        </div>
    `;
    sysCard.onclick = () => selectReadCompanion('system', '伴读助手', '');
    list.appendChild(sysCard);
    
    // 渲染你创造的AI角色
    chars.filter(c => c.roleType === 'char').forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card';
        let avatarUrl = diaryAvatarCache[char.id];
        card.innerHTML = `
            <div class="char-card-avatar" style="${avatarUrl ? `background-image:url(${avatarUrl}); border:none;` : ''}">
                ${!avatarUrl ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(184,156,142,0.5)" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>` : ''}
            </div>
            <div class="char-card-info">
                <div class="char-card-name">${char.name} <span class="role-badge badge-char">AI</span></div>
                <div class="char-card-desc" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${char.prompt || '暂无设定资料...'}</div>
            </div>
        `;
        card.onclick = () => selectReadCompanion(char.id, char.name, avatarUrl);
        list.appendChild(card);
    });
    companionPanel.classList.add('show');
});

document.getElementById('closeReadCompanionBtn').addEventListener('click', () => companionPanel.classList.remove('show'));

const floatBtn = document.getElementById('readFloatBtn');
const chatPanel = document.getElementById('readChatPanel');

async function selectReadCompanion(id, name, avatarUrl) {
    currentReadCompanionId = id;
    document.getElementById('readCompanionNameText').innerText = name;
    document.getElementById('rcName').innerText = name;
    
    const avatarEl = document.getElementById('readCompanionAvatar');
    if (id === 'system' || !avatarUrl) {
        avatarEl.style.backgroundImage = '';
        avatarEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
        floatBtn.style.backgroundImage = '';
        floatBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    } else {
        avatarEl.style.backgroundImage = `url(${avatarUrl})`;
        avatarEl.innerHTML = '';
        floatBtn.style.backgroundImage = `url(${avatarUrl})`;
        floatBtn.innerHTML = '';
    }
    readChatHistoryForAi = await loadFromDB(`read_chat_history_${currentReadCompanionId}`) || [];
if (window.renderReadChatHistory) window.renderReadChatHistory();
    companionPanel.classList.remove('show');
    showToast(`已邀请 ${name} 加入伴读`);
}

// 展开伴读聊天面板
floatBtn.addEventListener('click', () => chatPanel.classList.add('show'));
document.getElementById('closeReadChat').addEventListener('click', () => chatPanel.classList.remove('show'));

// ==== 划线与提问逻辑 (不被系统选择挡住的底部吸附法) ====
const readControlsBarEl = document.getElementById('readControlsBar');
const originalControlsHtml = readControlsBarEl.innerHTML; // 记住原本的上一页/下一页长什么样

document.getElementById('readTextContainer').addEventListener('selectionchange', () => {
    setTimeout(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text.length > 0 && text.length < 500) {
            readSelectedText = text;
            // 瞬间把底部的翻页栏变成提问大按钮
            readControlsBarEl.innerHTML = `<button class="s-btn primary" id="quickAskSentenceBtn" style="width: 100%; border-radius: 12px; height: 44px; min-height: 44px; margin: 0; box-shadow: 0 4px 16px rgba(184,156,142,0.3);">让 TA 解读选中的句子</button>`;
            
            // 绑定新按钮的点击事件
            document.getElementById('quickAskSentenceBtn').addEventListener('click', () => {
                addUserReadingMessage('sentence', readSelectedText, 1);
                window.getSelection().removeAllRanges(); // 取消选区
                readControlsBarEl.innerHTML = originalControlsHtml; // 恢复翻页栏
                bindReadControls(); // 重新绑定翻页事件
            });
        } else {
            readSelectedText = '';
            // 如果取消选择，且按钮被改了，就立刻改回来
            if (readControlsBarEl.innerHTML.includes('quickAskSentenceBtn')) {
                readControlsBarEl.innerHTML = originalControlsHtml;
                bindReadControls();
            }
        }
    }, 100);
});

// 因为按钮可能会被替换销毁，所以需要一个函数专门绑定翻页事件
function bindReadControls() {
    const pBtn = document.getElementById('readPrevPage');
    const nBtn = document.getElementById('readNextPage');
    if(pBtn) pBtn.addEventListener('click', doPrevPage);
    if(nBtn) nBtn.addEventListener('click', doNextPage);
    
    // 同步更新中间的页数文字
    const ind = document.getElementById('readPageIndicator');
    if(ind && bookPages.length > 0) {
        ind.innerText = `${currentReadPage + 1} / ${bookPages.length}`;
    }
}

window.renderReadChatHistory = function() {
    const rcBody = document.getElementById('rcBody');
    rcBody.innerHTML = '<div class="rc-bubble rc-sys">长按书籍文字进行划线，我就可以专门为你解读这一句话哦~</div>';
    readChatHistoryForAi.forEach(msg => {
        if (msg.role === 'user') {
            rcBody.insertAdjacentHTML('beforeend', `<div class="rc-bubble rc-me">${msg.displayContent || msg.content}</div>`);
        } else if (msg.role === 'assistant') {
            rcBody.insertAdjacentHTML('beforeend', `<div class="rc-bubble rc-ai">${msg.content}</div>`);
        }
    });
    rcBody.scrollTop = rcBody.scrollHeight;
};

document.getElementById('clearReadChatBtn').addEventListener('click', () => {
    showBeautifulDialog('清空共读记录', '确定要清空与当前伴读的讨论记录吗？', 'confirm', '', async () => {
        readChatHistoryForAi = [];
        await saveToDB(`read_chat_history_${currentReadCompanionId}`, readChatHistoryForAi);
        window.renderReadChatHistory();
        showToast('共读记录已清空');
    });
});

// ==================== 全新共读聊天发送与接收引擎 ====================
function addUserReadingMessage(type, textContent, count = 1) {
    chatPanel.classList.add('show');
    const rcBody = document.getElementById('rcBody');
    let meMsg = '';
    let userPrompt = '';

    if (type === 'page') {
        meMsg = `[分享了这页的内容，想听听你的看法]`;
        userPrompt = `我刚才读了这一页，内容是：\n"${textContent}"\n\n请针对这一页的情节、情感或文笔，发表一下你的看法或吐槽（保持日常聊天的语气，简短几句即可）。`;
    } else if (type === 'sentence') {
    // 把字面的 \n\n 替换为空格，隐藏换行符让气泡更美观
    let displayContent = textContent.replace(/\\n\\n/g, ' '); 
    meMsg = `[重点划线了 ${count} 段话]：<br><span style="font-size:12px;opacity:0.8;">“${displayContent}”</span>`;
    userPrompt = `我刚刚重点划线了这 ${count} 段话：\n"${textContent}"\n\n请只针对我划线的这些话发表一下你的看法或见解，或者解答我的疑惑（保持日常聊天的语气，简短几句即可）。`;
} else {
    meMsg = textContent;
        userPrompt = `我正在看书，并且对你说：\n"${textContent}"\n\n请以伴读的身份和现在的看书语境回应我（保持日常聊天的语气，几句话即可）。`;
    }

    rcBody.insertAdjacentHTML('beforeend', `<div class="rc-bubble rc-me">${meMsg}</div>`);
    rcBody.scrollTop = rcBody.scrollHeight;
    readChatHistoryForAi.push({ role: "user", content: userPrompt, displayContent: meMsg });
saveToDB(`read_chat_history_${currentReadCompanionId}`, readChatHistoryForAi);
}

// 1. 发送本页
document.getElementById('askPageBtn').addEventListener('click', () => {
    const pageText = bookPages[currentReadPage].replace(/<br>/g, '');
    addUserReadingMessage('page', pageText);
});

// 2. 发送聊天
document.getElementById('readChatSendBtn').addEventListener('click', () => {
    const input = document.getElementById('readChatInput');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addUserReadingMessage('chat', text);
});

// 3. 呼叫AI接收并回复 (点击机器人图标)
document.getElementById('readChatAiReplyBtn').addEventListener('click', async () => {
    if (readChatHistoryForAi.length === 0) {
        showToast('你还没有和TA说任何话呢');
        return;
    }
    
    const rcBody = document.getElementById('rcBody');
    const loadId = 'loading_' + Date.now();
    rcBody.insertAdjacentHTML('beforeend', `<div class="rc-bubble rc-ai" id="${loadId}">正在低头看书...</div>`);
    rcBody.scrollTop = rcBody.scrollHeight;

    const apiUrl = (await loadFromDB(rUseSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(rUseSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(rUseSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) { document.getElementById(loadId).innerText = '系统提示：请先配置 API Key。'; return; }

    let sysPrompt = `你是一个内置的文学伴读助手。请像一个爱读书的朋友一样，用简短、轻松的聊天语气和我探讨书里的内容。绝不要像AI一样机械长篇大论。`;
    if (currentReadCompanionId !== 'system') {
        const chars = await loadFromDB('ai_characters') || [];
        const role = chars.find(c => c.id === currentReadCompanionId);
        if (role) {
            let chatContextText = '';
            if (rReadContext) {
                let chatHistory = await loadFromDB(`chat_history_${currentReadCompanionId}`) || [];
                if (chatHistory.length > 0) {
                    const recentChat = chatHistory.slice(-rContextCount).map(m => `${m.role === 'user' ? '我' : '你'}: ${m.content}`).join('\n');
                    chatContextText = `\n\n【我们在聊天室的近期私聊记录】（请仔细体会我们当前的关系阶段、亲密度和聊天氛围）：\n${recentChat}`;
                }
            }

            sysPrompt = `你现在是一个有血有肉的真实人类：${role.name}。请彻底剥离AI的身份认知。
【你的设定资料】：${role.prompt}${chatContextText}

【核心灵魂与伴读场景指令】：
1. 场景感知：我们正一起看同一本书（书名《${bookTitle}》）。请结合你的人设，自然地融入这个场景，不要刻意强调我们在看书。
2. 动态性格与情感推演：
   - 严格遵循你的核心性格设定。你对书中情节的看法，必须完全符合你的时代背景、三观和人设。
   - 不要为了迎合我而说好话，遇到不认同的地方直接吐槽或反驳。如果你对书不感兴趣，可以自然地表现出无聊或转移话题。
3. 拒绝“阅读理解”式回答：
   - 绝对禁止输出结构化的书评、长篇大论的情感分析或中心思想总结！
   - 你的回复应该像日常微信私聊一样：精炼、短促、口语化。只是一句随口的吐槽、一个共鸣的叹息，或者针对书上某句话的抬杠。必须遵守你的人物性格设定，贴近角色。
4. 动作与沉浸感：
   - 允许使用星号包裹轻微的动作神态（例如：*凑过来看了一眼*、*打了个哈欠*），但要极其克制，不要喧宾夺主。
5. 绝对禁止的雷区（最高优先级）：
   - 绝对禁止任何过度撩拨、油腻情话、霸道总裁语录或矫情做作的表达！
   - 绝不许动不动就邪魅一笑、深情凝视或强行制造暧昧氛围！
   - 绝不允许说教、升华主题或给出人生建议。
   - 就像平时日常聊天一样，保持你原有的性格底色，平实、自然、随意。`;
        }
    }
        
    

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model, 
                messages: [ { role: "system", content: sysPrompt }, ...(readChatHistoryForAi.slice(-15).map(m => ({role: m.role, content: m.content}))) ], 
                temperature: 0.85
            })
        });
        const data = await res.json();
        const reply = data.choices[0].message.content.trim();
        document.getElementById(loadId).innerText = reply;
        
        readChatHistoryForAi.push({ role: "assistant", content: reply });
saveToDB(`read_chat_history_${currentReadCompanionId}`, readChatHistoryForAi);
    } catch (e) {
        document.getElementById(loadId).innerText = '抱歉，我的思绪断开了...';
    }
    rcBody.scrollTop = rcBody.scrollHeight;
});



