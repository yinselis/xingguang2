        // === 角色 APP 交互逻辑 ===
const characterModal = document.getElementById('characterAppModal');
const charEditPanel = document.getElementById('characterEditPanel');
let characterList = [];
let tempAvatarFile = null; // 记录临时上传的头像
let avatarCache = {}; // 【新增】头像记忆缓存，防止重复解码闪烁！

// 绑定桌面“角色”图标
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('角色')) {
        app.addEventListener('click', () => {
            characterModal.classList.add('open');
            // 删掉 renderCharacterList()，只做纯粹的滑出动画
        });
    }
});

document.getElementById('closeCharacterApp').addEventListener('click', () => {
    characterModal.classList.remove('open');
    charEditPanel.classList.remove('show');
});

// 渲染角色列表 (极速瞬间加载版)
async function renderCharacterList() {
    characterList = await loadFromDB('ai_characters') || [];
    const container = document.getElementById('characterList');
    
    if (characterList.length === 0) {
        container.innerHTML = '<div class="char-empty">档案室空空如也，快去创造吧~</div>';
        return;
    }

    // 使用文档碎片，在内存中一次性拼好所有卡片
    const frag = document.createDocumentFragment();
    
    characterList.forEach(char => {
        const card = document.createElement('div');
        card.className = 'char-card';

        let avatarContent = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(184,156,142,0.5)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        let styleStr = '';
        
        // 【核心】直接读取开屏动画期间已经准备好的全局缓存！绝不去数据库排队！
        let avatarUrl = window.diaryAvatarCache ? window.diaryAvatarCache[char.id] : null;
        
        if (avatarUrl) {
            styleStr = `background-image: url(${avatarUrl}); border: none;`;
            avatarContent = ''; 
        }

        // 判断身份，生成对应的小徽章
        let badgeHtml = char.roleType === 'user' 
            ? `<span class="role-badge badge-user">ME</span>`
            : `<span class="role-badge badge-char">AI</span>`;

        card.innerHTML = `
            <div class="char-card-avatar" style="${styleStr}">
                ${avatarContent}
            </div>
            <div class="char-card-info">
                <div class="char-card-name">${char.name} ${badgeHtml}</div>
                <div class="char-card-desc">${char.prompt || '未填写设定资料...'}</div>
            </div>
        `;
        card.onclick = () => openCharEditPanel(char);
        frag.appendChild(card);
    });

    // 瞬间替换：没有任何异步等待，一秒把整个列表贴到屏幕上，绝对不滚屏！
    container.innerHTML = '';
    container.appendChild(frag);
}

// 打开编辑面板
function openCharEditPanel(char = null) {
    tempAvatarFile = null;
    const avatarEl = document.getElementById('charEditAvatar');
    const iconEl = document.getElementById('charEditIcon');
    const diaryRow = document.getElementById('charAutoDiaryRow');

    if (char) {
        document.getElementById('charEditId').value = char.id;
        document.getElementById('charEditName').value = char.name;
        document.getElementById('charEditPrompt').value = char.prompt;
        
        // 读取开关状态（如果以前没存过，默认算开启）
        document.getElementById('charEditAutoDiaryToggle').checked = char.allowAutoDiary !== false;
        
        // 恢复选中状态
        document.querySelectorAll('#roleSelector .role-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`#roleSelector .role-btn[data-type="${char.roleType || 'char'}"]`).classList.add('active');
        
        // 如果是“我的画像”，隐藏写日记开关
        diaryRow.style.display = (char.roleType === 'user') ? 'none' : 'flex';

        document.getElementById('deleteCharBtn').style.display = 'block';
        
        // 【修复】：直接从开屏准备好的缓存里拿头像！
let avatarUrl = window.diaryAvatarCache ? window.diaryAvatarCache[char.id] : null;

if (avatarUrl) {
    avatarEl.style.backgroundImage = `url(${avatarUrl})`;
    iconEl.style.display = 'none';
    avatarEl.style.border = 'none';
} else {
    avatarEl.style.backgroundImage = '';
    iconEl.style.display = 'block';
    avatarEl.style.border = '';
}
    } else {
        document.getElementById('charEditId').value = 'new_' + Date.now();
        document.getElementById('charEditName').value = '';
        document.getElementById('charEditPrompt').value = '';
        document.getElementById('charEditAutoDiaryToggle').checked = true; // 新建角色默认开启
        document.getElementById('deleteCharBtn').style.display = 'none';    
        
        // 新建默认选中 AI
        document.querySelectorAll('#roleSelector .role-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`#roleSelector .role-btn[data-type="char"]`).classList.add('active');
        diaryRow.style.display = 'flex';

        avatarEl.style.backgroundImage = '';
        iconEl.style.display = 'block';
        avatarEl.style.border = '';
    }
    charEditPanel.classList.add('show');
}

// 角色分类开关点击切换
document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// 绑定新建和取消按钮
document.getElementById('addNewCharBtn').addEventListener('click', () => openCharEditPanel(null));
document.getElementById('cancelCharEditBtn').addEventListener('click', () => charEditPanel.classList.remove('show'));

// 角色头像上传拦截
document.getElementById('charEditAvatar').addEventListener('click', () => {
    currentUploadTargetId = 'charEditAvatar';
    globalUpload.click();
});

// 重写全局上传逻辑，处理角色头像的临时预览
const originalUploadHandler = globalUpload.onchange; // 防止覆盖
globalUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentUploadTargetId === 'charEditAvatar') {
    tempAvatarFile = file;
    const url = URL.createObjectURL(file);
    
    // 【防闪烁法宝 1】：先在后台内存里静默解码，好了再贴上去
    const img = new Image();
    img.onload = () => {
        const targetEl = document.getElementById('charEditAvatar');
        targetEl.style.backgroundImage = `url(${url})`;
        targetEl.style.border = 'none';
        document.getElementById('charEditIcon').style.display = 'none';
    };
    img.src = url;
    
    globalUpload.value = ''; 
}
    
    // (这段写在 charEditAvatar 那个 if 块的后面，作为并列的 if 或 else if)
if (file && currentUploadTargetId === 'desktopWallpaper') {
    const url = URL.createObjectURL(file);
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    
    saveToDB('desktopWallpaper_file', file); // 存入数据库
    globalUpload.value = ''; 
    
}
// 在 if (file && currentUploadTargetId === 'desktopWallpaper') 之前或之后加入：
if (file && currentUploadTargetId === 'phoneWallpaper') {
    if (!currentChatContact) return;
    const url = URL.createObjectURL(file);
    const phonePanel = document.getElementById('phoneAppPanel');
    phonePanel.style.background = 'transparent';
    phonePanel.style.backgroundImage = `url(${url})`;
    phonePanel.style.backgroundSize = 'cover';
    phonePanel.style.backgroundPosition = 'center';
    
    await saveToDB(`phone_bg_${currentChatContact.id}`, file);
    document.getElementById('globalImageUpload').value = ''; 
    showToast('电话壁纸更换成功！');
    return;
}
});

// 保存角色
document.getElementById('saveCharBtn').addEventListener('click', async () => {
    const id = document.getElementById('charEditId').value;
    const name = document.getElementById('charEditName').value.trim() || '未命名设定';
    const prompt = document.getElementById('charEditPrompt').value.trim();
    const roleType = document.querySelector('#roleSelector .role-btn.active').dataset.type; // 抓取选中的身份！
    const allowAutoDiary = document.getElementById('charEditAutoDiaryToggle').checked; // 获取最新的开关状态！

    const existingIndex = characterList.findIndex(c => c.id === id);
    if (existingIndex > -1) {
        characterList[existingIndex] = { id, name, prompt, roleType, allowAutoDiary };
    } else {
        characterList.push({ id, name, prompt, roleType, allowAutoDiary });
    }

    await saveToDB('ai_characters', characterList);
    if (tempAvatarFile) {
    await saveToDB(`char_avatar_${id}`, tempAvatarFile);
    const newAvatarUrl = URL.createObjectURL(tempAvatarFile);
    
    // 【防闪烁法宝 2】：在面板滑下去之前，强制浏览器提前把新头像缓冲好！
    await new Promise(resolve => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = newAvatarUrl;
    });

    avatarCache[id] = newAvatarUrl; 
    if (window.diaryAvatarCache) window.diaryAvatarCache[id] = newAvatarUrl; 
}

    charEditPanel.classList.remove('show');
    
    // 延迟 400 毫秒（等面板丝滑降落关掉后）再刷新全局数据
    setTimeout(() => {
        renderCharacterList();
        // ★核心修复：同步刷新所有聊天列表和通讯录，确保头像和名字立刻跟着变！
        if (typeof renderChatSessionList === 'function') renderChatSessionList();
        if (typeof renderChatContacts === 'function') renderChatContacts();
        // 如果当前正处于聊天室中，连同聊天室内部的历史记录也一起刷新！
        if (currentChatContact && document.getElementById('chatRoomPanel').classList.contains('show')) {
            loadChatHistory(currentChatContact.id);
        }
    }, 400);
});

// 删除角色
document.getElementById('deleteCharBtn').addEventListener('click', async () => {
    const id = document.getElementById('charEditId').value;
    if(confirm('确定要销毁这个角色吗？此操作无法恢复。')) {
        characterList = characterList.filter(c => c.id !== id);
        await saveToDB('ai_characters', characterList);
        delete avatarCache[id]; // 从记忆中抹除！
        if (window.diaryAvatarCache) delete window.diaryAvatarCache[id]; // 同步抹除全局残留！
        
        // 真实从数据库删掉头像垃圾
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(`char_avatar_${id}`);

        charEditPanel.classList.remove('show');
        
        // 同步刷新全局
        setTimeout(() => {
            renderCharacterList();
            if (typeof renderChatSessionList === 'function') renderChatSessionList();
            if (typeof renderChatContacts === 'function') renderChatContacts();
        }, 400);
    }
});

       // === 设置 APP 交互逻辑 ===
const settingsModal = document.getElementById('settingsAppModal');

// 自动寻找桌面上叫“设置”的图标并绑定点击事件
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('设置')) {
        app.addEventListener('click', async () => {
            // 【杀手锏】先隐藏设置里的所有开关，剥夺它们播放滑动动画的权利
            const switches = settingsModal.querySelectorAll('.switch');
            switches.forEach(s => s.style.display = 'none');
            
            // 后台拉取数据并给开关拨向正确的位置
            await loadSettings(); 
            
            // 强制浏览器刷新一下状态（此时它在隐身中瞬间就位了）
            settingsModal.offsetHeight; 
            
            // 数据就位后，瞬间恢复开关显示，没有任何滑动过程！
            switches.forEach(s => s.style.display = '');
            
            // 丝滑推出面板
            settingsModal.classList.add('open'); 
        });
    }
});

document.getElementById('closeSettingsApp').addEventListener('click', () => {
    settingsModal.classList.remove('open');
});

// 绑定“指令”APP点击事件
const commandModal = document.getElementById('commandAppModal');
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('指令')) {
        app.addEventListener('click', () => {
            commandModal.classList.add('open');
            renderCommandList();
        });
    }
});

document.getElementById('closeCommandApp').addEventListener('click', () => {
    commandModal.classList.remove('open');
    document.getElementById('commandEditPanel').classList.remove('show');
});

// 绑定“美化”APP点击事件
const beautifyModal = document.getElementById('beautifyAppModal');
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('美化')) {
        app.addEventListener('click', () => {
            beautifyModal.classList.add('open');
        });
    }
});

// 关闭美化面板
document.getElementById('closeBeautifyApp').addEventListener('click', () => {
    beautifyModal.classList.remove('open');
});

// 点击更换壁纸，触发全局上传，并打上特殊标记
document.getElementById('changeWallpaperBtn').addEventListener('click', () => {
    currentUploadTargetId = 'desktopWallpaper';
    document.getElementById('globalImageUpload').click();
});

// 点击恢复默认
document.getElementById('resetWallpaperBtn').addEventListener('click', async () => {
    document.body.style.backgroundImage = '';
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete('desktopWallpaper_file');
    
});

// 绑定温度滑动条数字显示
document.getElementById('tempInput').addEventListener('input', (e) => {
    document.getElementById('tempDisplay').innerText = e.target.value;
});

// 保存和加载配置 (增加到了双模型支持)
async function loadSettings() {
    document.getElementById('mainApiUrl').value = await loadFromDB('mainApiUrl') || '';
    document.getElementById('mainApiKey').value = await loadFromDB('mainApiKey') || '';
    document.getElementById('subApiUrl').value = await loadFromDB('subApiUrl') || '';
    document.getElementById('subApiKey').value = await loadFromDB('subApiKey') || '';
    document.getElementById('globalWrongMailToggle').checked = (await loadFromDB('globalWrongMail') !== false); // 默认开启
document.getElementById('globalAutoDiaryToggle').checked = (await loadFromDB('globalAutoDiary') !== false); // 默认开启
    const savedTemp = await loadFromDB('sysTemp');
    if (savedTemp) {
        document.getElementById('tempInput').value = savedTemp;
        document.getElementById('tempDisplay').innerText = savedTemp;
    }
    
    const savedMainModel = await loadFromDB('sysModel');
    if (savedMainModel) document.getElementById('mainModelSelect').innerHTML = `<option value="${savedMainModel}">${savedMainModel} (已存)</option>`;
    
    const savedSubModel = await loadFromDB('subSysModel');
    if (savedSubModel) document.getElementById('subModelSelect').innerHTML = `<option value="${savedSubModel}">${savedSubModel} (已存)</option>`;

    // 读取流畅模式开关
        // (这部分是原有的代码，参考定位)
    const perfMode = await loadFromDB('perfMode');
    const perfToggle = document.getElementById('perfModeToggle');
    if (perfMode === true) {
        perfToggle.checked = true;
        document.body.classList.add('perf-mode');
    } else {
        perfToggle.checked = false;
        document.body.classList.remove('perf-mode');
    }

    // ============= 新增：读取去模糊状态 =============
    const noBlurMode = await loadFromDB('noBlurMode');
    const blurToggle = document.getElementById('noBlurModeToggle');
    if (noBlurMode === true) {
        blurToggle.checked = true;
        document.body.classList.add('no-blur-mode');
    } else {
        blurToggle.checked = false;
        document.body.classList.remove('no-blur-mode');
    }
    // ==============================================
}

// 监听流畅模式开关
document.getElementById('perfModeToggle').addEventListener('change', async function() {
    const isChecked = this.checked;
    if (isChecked) {
        document.body.classList.add('perf-mode');
    } else {
        document.body.classList.remove('perf-mode');
    }
    await saveToDB('perfMode', isChecked);
});

// 监听：极致去模糊开关
document.getElementById('noBlurModeToggle').addEventListener('change', async function() {
    const isChecked = this.checked;
    if (isChecked) {
        document.body.classList.add('no-blur-mode');
    } else {
        document.body.classList.remove('no-blur-mode');
    }
    await saveToDB('noBlurMode', isChecked);
});

document.getElementById('saveConfigBtn').addEventListener('click', async function() {
    const btn = this;
    await saveToDB('mainApiUrl', document.getElementById('mainApiUrl').value);
    await saveToDB('mainApiKey', document.getElementById('mainApiKey').value);
    await saveToDB('subApiUrl', document.getElementById('subApiUrl').value);
    await saveToDB('subApiKey', document.getElementById('subApiKey').value);
    await saveToDB('globalWrongMail', document.getElementById('globalWrongMailToggle').checked);
await saveToDB('globalAutoDiary', document.getElementById('globalAutoDiaryToggle').checked);
    await saveToDB('sysTemp', document.getElementById('tempInput').value);
    
    const mainModel = document.getElementById('mainModelSelect').value;
    if (mainModel) await saveToDB('sysModel', mainModel);
    
    const subModel = document.getElementById('subModelSelect').value;
    if (subModel) await saveToDB('subSysModel', subModel);
    
    btn.innerText = "已保存！";
    btn.style.background = "#A3C7A3"; 
    setTimeout(() => { btn.innerText = "保存所有配置"; btn.style.background = "var(--accent)"; }, 1500);
});

// 提取出一个通用的网络请求拉取模型函数，主副共用
async function fetchModels(btnId, urlId, keyId, selectId) {
    const btn = document.getElementById(btnId);
    let url = document.getElementById(urlId).value.trim();
    let key = document.getElementById(keyId).value.trim();
    
    if (!key) {
        btn.innerText = "缺Key!";
        setTimeout(() => btn.innerText = "重新获取", 1500);
        return;
    }
    
    if (!url) url = 'https://api.openai.com/v1';
    if (url.endsWith('/')) url = url.slice(0, -1);
    if (!url.endsWith('/v1') && !url.includes('/models')) url += '/v1';
    
    btn.innerText = "请求中...";
    try {
        const response = await fetch(`${url}/models`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${key}` }
        });
        
        if (!response.ok) throw new Error('网络错误');
        
        const resJson = await response.json();
        const models = resJson.data; 
        
        if (models && Array.isArray(models)) {
            const select = document.getElementById(selectId);
            select.innerHTML = '';
            models.forEach(m => {
                let opt = document.createElement('option');
                opt.value = m.id; opt.innerText = m.id;
                select.appendChild(opt);
            });
            btn.innerText = "成功";
        } else throw new Error('格式不符');
    } catch(e) {
        btn.innerText = "失败!";
    }
    setTimeout(() => btn.innerText = btnId.includes('Main') ? "获取主模型" : "获取副模型", 2000);
}

// 绑定两个按钮
document.getElementById('fetchMainModelsBtn').addEventListener('click', () => fetchModels('fetchMainModelsBtn', 'mainApiUrl', 'mainApiKey', 'mainModelSelect'));
document.getElementById('fetchSubModelsBtn').addEventListener('click', () => fetchModels('fetchSubModelsBtn', 'subApiUrl', 'subApiKey', 'subModelSelect'));

// ==========================================
// 智能分类计算真实存储大小
// ==========================================

// 单位换算小助手 (自动转 B / KB / MB)
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function calculateRealStorage() {
    return new Promise(async (resolve) => {
        let stats = { images: 0, texts: 0, configs: 0, total: 0 };
        try {
            const db = await initDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.openCursor();

            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const key = cursor.key;
                    const val = cursor.value;
                    let size = 0;

                    // 分类称重
                    if (val instanceof Blob || val instanceof File) {
                        size = val.size;
                        stats.images += size;
                    } else if (typeof val === 'string') {
                        size = new Blob([val]).size;
                        // 区分日记文字和系统配置
                        if (key.startsWith('jText')) stats.texts += size;
                        else stats.configs += size;
                    } else {
                        size = JSON.stringify(val).length;
                        stats.configs += size;
                    }
                    
                    stats.total += size;
                    cursor.continue();
                } else {
                    resolve(stats);
                }
            };
            request.onerror = () => resolve(stats);
        } catch (e) { resolve(stats); }
    });
}

async function updateStorageInfo() {
    document.getElementById('totalUsedSpace').innerText = "读取中...";
    const stats = await calculateRealStorage();
    
    // 写入各分类文本
    document.getElementById('totalUsedSpace').innerText = formatBytes(stats.total);
    document.getElementById('sizeImg').innerText = formatBytes(stats.images);
    document.getElementById('sizeTxt').innerText = formatBytes(stats.texts);
    document.getElementById('sizeCfg').innerText = formatBytes(stats.configs);

    // 计算比例并驱动彩色条
    let pctImg = stats.total === 0 ? 0 : (stats.images / stats.total) * 100;
    let pctTxt = stats.total === 0 ? 0 : (stats.texts / stats.total) * 100;
    let pctCfg = stats.total === 0 ? 0 : (stats.configs / stats.total) * 100;

    document.getElementById('segImg').style.width = pctImg + '%';
    document.getElementById('segTxt').style.width = pctTxt + '%';
    document.getElementById('segCfg').style.width = pctCfg + '%';
}

// ==========================================
// 真实清理无效缓存 (保留资产)
// ==========================================
document.getElementById('clearCacheBtn').addEventListener('click', async function() {
    const btn = this;
    if(btn.innerText === "扫描并清理中...") return;
    btn.innerText = "扫描并清理中...";

    // 存一下清理前的大小
    const statsBefore = await calculateRealStorage();
    const bytesBefore = statsBefore.total;

    const validWidgetKeys = [];
    document.querySelectorAll('.custom-widget').forEach(w => {
        validWidgetKeys.push(w.id + '_alpha');
        validWidgetKeys.push(w.id + '_blur');
    });

    // 在这行上面先动态提取角色的头像 Key
const charAvatarKeys = [];
const savedChars = await loadFromDB('ai_characters') || [];
savedChars.forEach(c => charAvatarKeys.push(`char_avatar_${c.id}`));

const validKeys = [
    'mainApiUrl', 'mainApiKey', 'subApiUrl', 'subApiKey', 'sysTemp', 'sysModel', 'subSysModel', 'perfMode',
    'photoImg1_file', 'badgeImg_file', 'journalImg_file', 'lyricImg_file',
    'desktopWallpaper_file', 
    'jText1', 'jText2', 'lyricText', 'ai_characters', 'ai_commands', 'period_records',
    'accounting_accounts', 'accounting_records', // <--- 补上这两个！保护你的钱！
    ...validWidgetKeys,
    ...charAvatarKeys 
];

    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let junkBytes = 0;

    const req = store.openCursor();
    req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            if (!validKeys.includes(cursor.key)) {
                const val = cursor.value;
                if (val instanceof Blob || val instanceof File) junkBytes += val.size;
                else if (typeof val === 'string') junkBytes += new Blob([val]).size;
                else junkBytes += JSON.stringify(val).length;

                cursor.delete(); 
            }
            cursor.continue();
        }
    };

    tx.oncomplete = async () => {
        if (junkBytes === 0) {
            btn.innerText = "系统纯净，无残余可清"; 
        } else {
            btn.innerText = `成功清理 ${formatBytes(junkBytes)} 废弃碎片`; 
        }

        btn.style.background = "#E6E3DE";
        btn.style.color = "var(--text-sub)";
        
        updateStorageInfo(); // 重新加载动画条

        setTimeout(() => {
            btn.innerText = "清理无效数据缓存";
            btn.style.background = "#FFF0F0";
            btn.style.color = "#D67A7A";
        }, 2500);
    };
});

// === 指令库 APP 交互逻辑 ===
const commandEditPanel = document.getElementById('commandEditPanel');
let commandList = [];
let currentCommandFilter = '全部';

// 唤起美化版删除弹窗的通用函数
function showBeautifulConfirm(onConfirm) {
    const cc = document.getElementById('customConfirm');
    cc.classList.add('show');
    document.getElementById('ccConfirm').onclick = () => {
        cc.classList.remove('show');
        if(onConfirm) onConfirm();
    };
    document.getElementById('ccCancel').onclick = () => cc.classList.remove('show');
}

// 插入位置开关的点击逻辑
document.querySelectorAll('#commandPosSelector .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#commandPosSelector .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

async function renderCommandList() {
    commandList = await loadFromDB('ai_commands') || [];
    const container = document.getElementById('commandList');
    const filterBar = document.getElementById('commandFilterBar');
    
    let categories = ['全部'];
    commandList.forEach(c => { if (c.category && !categories.includes(c.category)) categories.push(c.category); });

    filterBar.innerHTML = '';
    categories.forEach(cat => {
        const chip = document.createElement('div');
        chip.className = 'cmd-chip' + (currentCommandFilter === cat ? ' active' : '');
        chip.innerText = cat;
        chip.onclick = () => { currentCommandFilter = cat; renderCommandList(); };
        filterBar.appendChild(chip);
    });

    if (commandList.length === 0) {
        container.innerHTML = '<div class="char-empty">还没有任何指令，点击下方添加吧~</div>'; return;
    }

    container.innerHTML = '';
    const filteredList = currentCommandFilter === '全部' ? commandList : commandList.filter(c => c.category === currentCommandFilter);

    if (filteredList.length === 0) {
         container.innerHTML = '<div class="char-empty">当前分类下没有指令~</div>'; return;
    }

    filteredList.forEach(cmd => {
        const card = document.createElement('div');
        card.className = 'char-card'; 

        let catBadge = cmd.category ? `<span class="cmd-badge">${cmd.category}</span>` : '';
        // 渲染前置后置的高亮小尾巴
        let posBadge = cmd.position === 'back' 
            ? `<span class="cmd-badge" style="background: rgba(214,122,122,0.15); color: #D67A7A;">后置</span>` 
            : `<span class="cmd-badge" style="background: rgba(184,156,142,0.15); color: var(--accent);">前置</span>`;
        
        // 渲染全局标志
        let globalBadge = cmd.isGlobal ? `<span class="cmd-badge" style="background: rgba(139,168,136,0.15); color: #8BA888;">全局</span>` : '';

        card.innerHTML = `
            <div class="char-card-info">
                <div class="char-card-name">${cmd.name} ${catBadge} ${posBadge} ${globalBadge}</div>
                <div class="char-card-desc">${cmd.content || '空指令...'}</div>
            </div>
        `;
        card.onclick = () => openCommandEditPanel(cmd);
        container.appendChild(card);
    });
}

function openCommandEditPanel(cmd = null) {
    // 恢复按钮选中状态的辅助函数
    const setPosBtn = (posValue) => {
        document.querySelectorAll('#commandPosSelector .role-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`#commandPosSelector .role-btn[data-pos="${posValue}"]`).classList.add('active');
    };

    if (cmd) {
    document.getElementById('commandGlobalToggle').checked = cmd.isGlobal || false;
        document.getElementById('commandEditId').value = cmd.id;
        document.getElementById('commandEditName').value = cmd.name;
        document.getElementById('commandEditCategory').value = cmd.category || '';
        document.getElementById('commandEditContent').value = cmd.content;
        setPosBtn(cmd.position || 'front'); // 载入保存的位置
        document.getElementById('deleteCommandBtn').style.display = 'block';
    } else {
    document.getElementById('commandGlobalToggle').checked = false;
        document.getElementById('commandEditId').value = 'cmd_' + Date.now();
        document.getElementById('commandEditName').value = '';
        document.getElementById('commandEditCategory').value = currentCommandFilter === '全部' ? '' : currentCommandFilter; 
        document.getElementById('commandEditContent').value = '';
        setPosBtn('front'); // 默认前置
        document.getElementById('deleteCommandBtn').style.display = 'none';    
    }
    commandEditPanel.classList.add('show');
}

document.getElementById('addNewCommandBtn').addEventListener('click', () => openCommandEditPanel(null));
document.getElementById('cancelCommandEditBtn').addEventListener('click', () => commandEditPanel.classList.remove('show'));

document.getElementById('saveCommandBtn').addEventListener('click', async () => {
    const id = document.getElementById('commandEditId').value;
    const name = document.getElementById('commandEditName').value.trim() || '未命名指令';
    const category = document.getElementById('commandEditCategory').value.trim() || '默认分类';
    const content = document.getElementById('commandEditContent').value.trim();
    const position = document.querySelector('#commandPosSelector .role-btn.active').dataset.pos;
const isGlobal = document.getElementById('commandGlobalToggle').checked; // ★新增这行
    const existingIndex = commandList.findIndex(c => c.id === id);
        if (existingIndex > -1) {
        commandList[existingIndex] = { id, name, category, position, isGlobal, content };
    } else {
        commandList.push({ id, name, category, position, isGlobal, content });
    }

    await saveToDB('ai_commands', commandList);
    commandEditPanel.classList.remove('show');
    setTimeout(() => renderCommandList(), 400); 
});

document.getElementById('deleteCommandBtn').addEventListener('click', () => {
    // 呼叫我们写好的美化版弹窗！
    showBeautifulConfirm(async () => {
        const id = document.getElementById('commandEditId').value;
        commandList = commandList.filter(c => c.id !== id);
        if(currentCommandFilter !== '全部' && !commandList.some(c => c.category === currentCommandFilter)) {
            currentCommandFilter = '全部';
        }
        await saveToDB('ai_commands', commandList);
        commandEditPanel.classList.remove('show');
        setTimeout(() => renderCommandList(), 400);
    });
});

// === 经期手账 APP 交互逻辑 ===
const periodModal = document.getElementById('periodAppModal');
let periodRecords = []; 
let currentCalDate = new Date(); 

// 借用之前写好的美化版通用弹窗！
function showPeriodConfirm(title, desc, onConfirm) {
    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = title;
    cc.querySelector('.cc-desc').innerText = desc;
    cc.classList.add('show');
    
    // 清除旧的事件监听防止重复触发
    const confirmBtn = document.getElementById('ccConfirm');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.onclick = () => {
        cc.classList.remove('show');
        if(onConfirm) onConfirm();
    };
    document.getElementById('ccCancel').onclick = () => cc.classList.remove('show');
}

document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('经期')) {
        app.addEventListener('click', () => {
            periodModal.classList.add('open');
            currentCalDate = new Date(); 
            renderPeriodApp();
        });
    }
});
document.getElementById('closePeriodApp').addEventListener('click', () => periodModal.classList.remove('open'));

function formatDate(timestamp) {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

document.getElementById('calPrevBtn').addEventListener('click', () => {
    currentCalDate.setMonth(currentCalDate.getMonth() - 1);
    renderPeriodApp();
});
document.getElementById('calNextBtn').addEventListener('click', () => {
    currentCalDate.setMonth(currentCalDate.getMonth() + 1);
    renderPeriodApp();
});

// ★ 点击日历格子，唤起美化版弹窗 ★
window.handleCalClick = async function(cellTimeStr) {
    const cellTime = parseInt(cellTimeStr);
    const dateStr = formatDate(cellTime);
    
    const openRecord = periodRecords.find(r => r.end === null);
    
    if (openRecord) {
        if (cellTime < openRecord.start) {
            showPeriodConfirm('无法标记', '结束时间不能早于开始时间哦！', null); return;
        }
        showPeriodConfirm('标记结束', `要将 ${dateStr} 标记为这次月经的【结束日】吗？`, async () => {
            openRecord.end = cellTime;
            periodRecords.sort((a, b) => a.start - b.start);
            await saveToDB('period_records', periodRecords);
            renderPeriodApp();
        });
    } else {
        showPeriodConfirm('补录开始', `要将 ${dateStr} 补录为月经的【开始日】吗？\n(确定后，再次点击日历标记结束)`, async () => {
            periodRecords.push({ id: Date.now() + cellTime, start: cellTime, end: null });
            periodRecords.sort((a, b) => a.start - b.start);
            await saveToDB('period_records', periodRecords);
            renderPeriodApp();
        });
    }
};

async function renderPeriodApp() {
    periodRecords = await loadFromDB('period_records') || [];
    periodRecords.sort((a, b) => a.start - b.start);
    
    const pTitle = document.getElementById('pStatusTitle');
    const pDays = document.getElementById('pStatusDays');
    const pDate = document.getElementById('pStatusDate');
    const actionBtn = document.getElementById('periodActionBtn');
    const historyList = document.getElementById('periodHistoryList');
    const avgText = document.getElementById('avgCycleText');

    let avgCycle = 28; 
    let cycleCount = 0; let totalCycleDays = 0;
    for (let i = 1; i < periodRecords.length; i++) {
        const days = Math.round((periodRecords[i].start - periodRecords[i-1].start) / 86400000);
        if (days > 15 && days < 60) { totalCycleDays += days; cycleCount++; }
    }
    if (cycleCount > 0) avgCycle = Math.round(totalCycleDays / cycleCount);
    avgText.innerText = cycleCount > 0 ? `平均周期: ${avgCycle}天` : `默认周期: 28天`;

    const now = new Date().setHours(0, 0, 0, 0); 
    let predictedStarts = []; 

    if (periodRecords.length === 0) {
        pTitle.innerText = "还未记录"; pDays.innerHTML = "-"; pDate.innerText = "点击日历或下方按钮记录";
        actionBtn.innerText = "月经来了"; actionBtn.style.background = "#FFF0F0"; actionBtn.style.color = "#D67A7A";
    } else {
        const lastRecord = periodRecords[periodRecords.length - 1];
        if (lastRecord.end === null) {
            const currentDay = Math.round((now - lastRecord.start) / 86400000) + 1;
            pTitle.innerText = "当前经期"; pDays.innerHTML = `${currentDay}<span>天</span>`;
            pDate.innerText = `开始于: ${formatDate(lastRecord.start)}`;
            actionBtn.innerText = "月经结束"; actionBtn.style.background = "var(--surface)"; actionBtn.style.color = "var(--text-main)";
        } else {
            const nextExpected = lastRecord.start + (avgCycle * 86400000);
            const diffDays = Math.round((nextExpected - now) / 86400000);

            for(let i=0; i<5; i++) predictedStarts.push(nextExpected + i * 86400000);

            if (diffDays > 0) {
                pTitle.innerText = "距离下次还有"; pDays.innerHTML = `${diffDays}<span>天</span>`;
            } else if (diffDays === 0) {
                pTitle.innerText = "预计今天来"; pDays.innerHTML = `0<span>天</span>`;
            } else {
                pTitle.innerText = "已经推迟了"; pDays.innerHTML = `${Math.abs(diffDays)}<span>天</span>`;
                pDays.style.color = "#E59999"; 
            }
            pDate.innerText = `预测日期: ${formatDate(nextExpected)}`;
            actionBtn.innerText = "月经来了"; actionBtn.style.background = "#FFF0F0"; actionBtn.style.color = "#D67A7A";
        }
    }

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    document.getElementById('calTitle').innerText = `${year}年${month + 1}月`;
    
    const firstDay = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = document.getElementById('calGrid');
    grid.innerHTML = '';
    
    let emptyDays = firstDay === 0 ? 6 : firstDay - 1; 
    for(let i=0; i<emptyDays; i++) grid.innerHTML += `<div class="cal-day-cell empty"></div>`;
    
    for(let d=1; d<=daysInMonth; d++) {
        const cellTime = new Date(year, month, d).setHours(0,0,0,0);
        let className = 'cal-day-cell';
        if(cellTime === now) className += ' today'; 
        
        let isPeriod = false;
        periodRecords.forEach(r => {
            const s = r.start;
            const e = r.end || now; 
            if(cellTime >= s && cellTime <= e) isPeriod = true;
        });
        
        if (isPeriod) className += ' period';
        else if (predictedStarts.includes(cellTime)) className += ' predicted'; 
        
        grid.innerHTML += `<div class="${className}" style="cursor:pointer;" onclick="handleCalClick('${cellTime}')">${d}</div>`;
    }
    
        // 渲染历史记录 (加入直观删除按钮)
    historyList.innerHTML = '';
    const reversedRecords = [...periodRecords].reverse();
    reversedRecords.forEach((record, index) => {
        const div = document.createElement('div'); div.className = 'period-record-item';
        const startStr = formatDate(record.start);
        const endStr = record.end ? formatDate(record.end) : '进行中';
        let duration = record.end ? Math.round((record.end - record.start) / 86400000) + 1 : '-';
        
        let cycleStr = '-';
        if (index < reversedRecords.length - 1) {
            const prevRecord = reversedRecords[index + 1];
            cycleStr = `${Math.round((record.start - prevRecord.start) / 86400000)}天周期`;
        }

        div.innerHTML = `
            <div style="flex:1;">
                <div class="pr-dates">${startStr} ~ ${endStr}</div>
                <div style="font-size:11px; color:var(--text-sub); display:flex; gap:8px; margin-top:2px;">
                    <span>共 ${duration} 天</span>
                    <span>${cycleStr}</span>
                </div>
            </div>
            <div class="pr-action-btn" id="del_pr_${record.id}">删除</div>
        `;
        historyList.appendChild(div);
        
        // 绑定删除美化弹窗
        document.getElementById(`del_pr_${record.id}`).addEventListener('click', () => {
            showPeriodConfirm('删除记录', `确定要删除 ${startStr} 这条记录吗？\n删除后可通过日历点击重新补录。`, async () => {
                periodRecords = periodRecords.filter(r => r.id !== record.id);
                await saveToDB('period_records', periodRecords);
                renderPeriodApp();
            });
        });
    });
}

document.getElementById('periodActionBtn').addEventListener('click', async () => {
    const now = new Date().setHours(0, 0, 0, 0);

    if (periodRecords.length === 0 || periodRecords[periodRecords.length - 1].end !== null) {
        periodRecords.push({ id: Date.now(), start: now, end: null }); 
    } else {
        const lastRecord = periodRecords[periodRecords.length - 1];
        if (lastRecord.start === now) {
            showPeriodConfirm('提示', '刚刚才记录开始，确定今天就结束了吗？', async () => {
                lastRecord.end = now; 
                await saveToDB('period_records', periodRecords);
                renderPeriodApp();
            });
            return;
        }
        lastRecord.end = now; 
    }

    periodRecords.sort((a, b) => a.start - b.start);
    await saveToDB('period_records', periodRecords);
    renderPeriodApp();
});

// === 记账 APP 交互逻辑 ===
const accountingModal = document.getElementById('accountingAppModal');
const accEditPanel = document.getElementById('accEditPanel');
let accAccounts = [];
let accRecords = [];

// 终极版全局美化弹窗调用函数 (支持文字确认 和 数字输入)
function showBeautifulDialog(title, desc, type = 'confirm', defaultValue = '', onConfirm) {
    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = title;
    cc.querySelector('.cc-desc').innerText = desc;
    
    const inputEl = cc.querySelector('.cc-input');
    const confirmBtn = document.getElementById('ccConfirm');
    
    if (type === 'prompt') {
        inputEl.style.display = 'block';
        inputEl.value = defaultValue;
        confirmBtn.style.background = 'var(--accent)';
        confirmBtn.style.color = '#fff';
    } else {
        inputEl.style.display = 'none';
        confirmBtn.style.background = '#FFF0F0';
        confirmBtn.style.color = '#D67A7A';
    }
    
    cc.classList.add('show');
// 延迟 400 毫秒，等弹窗动画彻底平稳结束后再唤起键盘，彻底解决闪烁

    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.onclick = () => {
        const val = inputEl.value;
        cc.classList.remove('show');
        if(onConfirm) {
            if (type === 'prompt') onConfirm(val);
            else onConfirm();
        }
    };
    document.getElementById('ccCancel').onclick = () => cc.classList.remove('show');
}

const defaultAccounts = [
    { id: 'wechat', name: '微信', balance: 0 },
    { id: 'alipay', name: '支付宝', balance: 0 },
    { id: 'bank', name: '银行卡', balance: 0 }
];

document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('记账')) {
        app.addEventListener('click', async () => {
            // 1. 先在后台静默把账单数据拉取并渲染完毕
            await renderAccountingApp();
            
            // 2. 给浏览器 30 毫秒的时间来彻底确认并固化排版，绝不让它在滑动中途才去算高度
            setTimeout(() => {
                accountingModal.classList.add('open');
            }, 30);
        });
    }
});
document.getElementById('closeAccountingApp').addEventListener('click', () => accountingModal.classList.remove('open'));

async function renderAccountingApp() {
    accAccounts = await loadFromDB('accounting_accounts');
    if (!accAccounts || accAccounts.length === 0) {
        accAccounts = JSON.parse(JSON.stringify(defaultAccounts));
        await saveToDB('accounting_accounts', accAccounts);
    }
    accRecords = await loadFromDB('accounting_records') || [];
    accRecords.sort((a, b) => b.timestamp - a.timestamp); 

    // 1. 渲染顶部总资产和账户卡片
    let total = 0;
    const cardsContainer = document.getElementById('accCardsContainer');
    cardsContainer.innerHTML = '';
    
    accAccounts.forEach(acc => {
        total += parseFloat(acc.balance);
        const card = document.createElement('div');
        card.className = 'acc-card';
        card.innerHTML = `
            <div class="acc-card-name">${acc.name} <span>✎</span></div>
            <div class="acc-card-bal">¥ ${parseFloat(acc.balance).toFixed(2)}</div>
        `;
        // 点击修改账户余额 (已替换为果冻弹窗！)
        card.onclick = () => {
            showBeautifulDialog(`修改【${acc.name}】余额`, '直接设置当前的真实余额：', 'prompt', acc.balance, async (newBal) => {
                if (newBal !== null && !isNaN(newBal) && newBal.trim() !== '') {
                    acc.balance = parseFloat(newBal);
                    await saveToDB('accounting_accounts', accAccounts);
                    renderAccountingApp();
                }
            });
        };
        cardsContainer.appendChild(card);
    });
    
    document.getElementById('accTotalNum').innerText = total.toFixed(2);

    // 2. 渲染流水列表
    const listContainer = document.getElementById('accRecordsList');
    listContainer.innerHTML = '';
    if (accRecords.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:12px; margin-top:20px;">还没有任何账单记录~</div>';
    } else {
        accRecords.forEach(record => {
            const div = document.createElement('div');
            div.className = 'acc-record-item';
            
            const date = new Date(record.timestamp);
            const timeStr = `${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;
            const accName = accAccounts.find(a => a.id === record.accountId)?.name || '未知账户';
            const sign = record.type === 'in' ? '+' : '-';
            const valClass = record.type === 'in' ? 'in' : 'out';
            const title = record.category || (record.type === 'in' ? '收入' : '支出');
            const remarkText = record.remark ? ` · ${record.remark}` : '';

            div.innerHTML = `
                <div class="acc-ri-left">
                    <div class="acc-ri-cat">${title} <span style="font-size:11px; color:var(--text-sub); font-weight:normal;">${remarkText}</span></div>
                    <div class="acc-ri-time"><span class="acc-ri-acc">${accName}</span> ${timeStr}</div>
                </div>
                <div class="acc-ri-right ${valClass}">${sign} ${parseFloat(record.amount).toFixed(2)}</div>
            `;
            // 长按删除账单并退还余额 (已替换为果冻弹窗！)
            div.oncontextmenu = (e) => {
                e.preventDefault();
                showBeautifulDialog('删除账单', '确定要删除这条账单吗？相应的金额会从账户中回退或扣除。', 'confirm', '', async () => {
                    const targetAcc = accAccounts.find(a => a.id === record.accountId);
                    if (targetAcc) {
                        if (record.type === 'in') targetAcc.balance -= record.amount;
                        else targetAcc.balance += record.amount;
                    }
                    accRecords = accRecords.filter(r => r.id !== record.id);
                    await saveToDB('accounting_accounts', accAccounts);
                    await saveToDB('accounting_records', accRecords);
                    renderAccountingApp();
                });
            }
            listContainer.appendChild(div);
        });
    }
}

// 记一笔相关逻辑
document.getElementById('openAddRecordBtn').addEventListener('click', () => {
    document.getElementById('accAmount').value = '';
    document.getElementById('accCategory').value = '';
    document.getElementById('accRemark').value = '';
    
    // 生成账户选择 Chips
    const chipsContainer = document.getElementById('accAccountChips');
    chipsContainer.innerHTML = '';
    accAccounts.forEach((acc, index) => {
        const chip = document.createElement('div');
        chip.className = 'acc-chip' + (index === 0 ? ' active' : '');
        chip.innerText = acc.name;
        chip.dataset.id = acc.id;
        chip.onclick = () => {
            chipsContainer.querySelectorAll('.acc-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        };
        chipsContainer.appendChild(chip);
    });
    
    accEditPanel.classList.add('show');
});

document.getElementById('cancelAccEditBtn').addEventListener('click', () => accEditPanel.classList.remove('show'));

// 收入/支出开关
document.querySelectorAll('#accTypeSelector .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#accTypeSelector .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// 保存账单
document.getElementById('saveAccRecordBtn').addEventListener('click', async () => {
    const amountStr = document.getElementById('accAmount').value;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        alert('金额必须大于 0 哦！'); return;
    }

    const type = document.querySelector('#accTypeSelector .role-btn.active').dataset.type;
    const category = document.getElementById('accCategory').value.trim();
    const remark = document.getElementById('accRemark').value.trim();
    const accountId = document.querySelector('#accAccountChips .acc-chip.active').dataset.id;

    // 1. 新增流水记录
    const newRecord = {
        id: Date.now(),
        timestamp: Date.now(),
        type, amount, category, remark, accountId
    };
    accRecords.push(newRecord);

    // 2. 同步加减对应账户的余额
    const targetAcc = accAccounts.find(a => a.id === accountId);
    if (targetAcc) {
        if (type === 'out') targetAcc.balance -= amount;
        else targetAcc.balance += amount;
    }

    // 3. 保存并刷新
    await saveToDB('accounting_accounts', accAccounts);
    await saveToDB('accounting_records', accRecords);
    
    accEditPanel.classList.remove('show');
    setTimeout(() => renderAccountingApp(), 300);
});

// === 食谱与体重 APP 交互逻辑 ===
const dietModal = document.getElementById('dietAppModal');
let currentDietDate = new Date().setHours(0, 0, 0, 0); // 当前选中的日期戳
let dailyDietData = {}; // 结构: { timestamp: { weight: 50, meals: [...], aiReply: "..." } }
let currentDietRoleId = ''; 

document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('食谱')) {
        app.addEventListener('click', async () => {
            dietModal.classList.add('open');
            currentDietDate = new Date().setHours(0, 0, 0, 0);
            await loadDietData();
            loadDietAiRoles();
        });
    }
});

document.getElementById('closeDietApp').addEventListener('click', () => dietModal.classList.remove('open'));

// 格式化并绑定顶部日期
function updateDietDateText() {
    const today = new Date().setHours(0, 0, 0, 0);
    const d = new Date(currentDietDate);
    
    if (currentDietDate === today) {
        document.getElementById('dietCurrentDate').innerText = '今天';
    } else {
        document.getElementById('dietCurrentDate').innerText = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    }
    
    // 同步给透明的原生 input[type="date"]
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    document.getElementById('dietDatePicker').value = `${yyyy}-${mm}-${dd}`;
}

// 监听日历选择器切换日期
document.getElementById('dietDatePicker').addEventListener('change', function(e) {
    if (e.target.value) {
        const [y, m, d] = e.target.value.split('-');
        currentDietDate = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
        updateDietDateText();
        renderDietUI();
    }
});

// 加载库里的饮食数据
async function loadDietData() {
    dailyDietData = await loadFromDB('diet_records_db') || {};
    updateDietDateText();
    renderDietUI();
}

// 渲染UI，带历史对话记忆
function renderDietUI() {
    const dayData = dailyDietData[currentDietDate] || { weight: '', meals: [], aiReply: '' };
    
    document.getElementById('dietWeightInput').value = dayData.weight || '';
    
    const list = document.getElementById('dietRecordsList');
    list.innerHTML = '';
    if(dayData.meals) {
dayData.meals.forEach(meal => {
    const div = document.createElement('div');
    div.className = 'diet-item';
    
    // 如果是AI生成的，换成深灰点；如果是自己记的，用奶咖点
    let mainColor = meal.isAi ? '#968F89' : 'var(--accent)';
    let typeText = meal.isAi ? `TA的${meal.type}` : meal.type;
    let aiClass = meal.isAi ? 'ai-text' : ''; // AI生成的带文艺斜体

    div.innerHTML = `
        <div class="diet-item-main">
            <div class="diet-meta" style="color: ${mainColor}; border: 1px solid ${mainColor}30;">
                <span class="diet-dot" style="background: ${mainColor}"></span>
                ${typeText}
            </div>
            <div class="diet-food ${aiClass}">${meal.food}</div>
        </div>
        <div class="diet-del" onclick="deleteMeal(${meal.id})">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </div>
    `;
    list.appendChild(div);
});
    }
    
    // 如果那天有回复历史，直接显示；如果没有，隐藏丑陋的占位符。
    const replyBox = document.getElementById('dietAiReply');
    if (dayData.aiReply) {
        replyBox.innerHTML = dayData.aiReply;
    } else {
        replyBox.innerHTML = '';
    }
    document.getElementById('dietFoodInput').value = '';
}

// 保存体重
document.getElementById('saveWeightBtn').addEventListener('click', async () => {
    const val = document.getElementById('dietWeightInput').value;
    if (!dailyDietData[currentDietDate]) dailyDietData[currentDietDate] = { weight: '', meals: [], aiReply: '' };
    dailyDietData[currentDietDate].weight = val;
    await saveToDB('diet_records_db', dailyDietData);
    
    const btn = document.getElementById('saveWeightBtn');
    btn.innerText = "已打卡";
    setTimeout(() => btn.innerText = "记录", 1500);
});

// 保存一餐
document.getElementById('saveDietBtn').addEventListener('click', async () => {
    const type = document.getElementById('dietMealType').value;
    const food = document.getElementById('dietFoodInput').value.trim();
    if (!food) return;
    
    if (!dailyDietData[currentDietDate]) dailyDietData[currentDietDate] = { weight: '', meals: [], aiReply: '' };
    if (!dailyDietData[currentDietDate].meals) dailyDietData[currentDietDate].meals = [];
    
    dailyDietData[currentDietDate].meals.push({ id: Date.now(), type, food });
    await saveToDB('diet_records_db', dailyDietData);
    renderDietUI();
});

// 删除一餐
window.deleteMeal = async function(id) {
    if(dailyDietData[currentDietDate] && dailyDietData[currentDietDate].meals) {
        dailyDietData[currentDietDate].meals = dailyDietData[currentDietDate].meals.filter(m => m.id !== id);
        await saveToDB('diet_records_db', dailyDietData);
        renderDietUI();
    }
}

// 滑动胶囊选角色
async function loadDietAiRoles() {
    const chars = await loadFromDB('ai_characters') || [];
    const chipsContainer = document.getElementById('dietRoleChips');
    chipsContainer.innerHTML = '';
    
    let html = `<div class="acc-chip active" data-id="">(自言自语)</div>`;
    currentDietRoleId = '';

    chars.forEach(c => {
        if(c.roleType === 'char') {
            html += `<div class="acc-chip" data-id="${c.id}">${c.name}</div>`;
        }
    });
    chipsContainer.innerHTML = html;
    
    const chips = chipsContainer.querySelectorAll('.acc-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentDietRoleId = chip.dataset.id;
        });
    });
}

// 严谨 Prompt + 对话入库保存
// 模式一：点评今日
document.getElementById('askAiDietBtn').addEventListener('click', async function() {
    const btn = this;
    const dayData = dailyDietData[currentDietDate];
    if (!dayData || (!dayData.weight && (!dayData.meals || dayData.meals.length === 0))) {
        alert("一片空白，没有数据可以分享哦~"); return;
    }

    const useSubApi = await loadFromDB('dietUseSubApi') || false;
const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if (!apiKey) { alert("请先去设置配置 API 节点哦！"); return; }

    btn.innerText = "TA 正在点评...";
    btn.style.opacity = '0.7';
    document.getElementById('dietAiReply').innerHTML = `<span style="color:var(--text-sub)">正在发送消息...</span>`;

    let recordText = '';
    if (dayData.weight) recordText += `今日体重：${dayData.weight}kg\n`;
    if (dayData.meals && dayData.meals.length > 0) {
        dayData.meals.forEach(m => recordText += `[${m.type}]: ${m.food}\n`);
    }

    const isToday = currentDietDate === new Date().setHours(0,0,0,0);
    const dateStr = isToday ? '今天' : new Date(currentDietDate).toLocaleDateString();

    let systemPrompt = `你是一个陪伴角色的搭档。【最高强制指令：绝对禁止描写环境、动作！只准发纯聊天对白！不要带任何括号动作！】`;
    if (currentDietRoleId) {
        const chars = await loadFromDB('ai_characters') || [];
        const role = chars.find(c => c.id === currentDietRoleId);
        if (role && role.prompt) {
            systemPrompt = `你扮演 ${role.name}。${role.prompt}\n【最高强制指令：必须严格符合你的性格设定！！只准用日常聊天的语气直接说话！绝对禁止任何环境描写、心理活动和动作描写！不许加任何动作括号！如有多句话请连在一起说！绝对禁止频道换行和留空行】`;
        }
    }

    let userPrompt = '';
    if (!dayData.meals || dayData.meals.length === 0) {
        userPrompt = `我在 ${dateStr} 的饮食记录是：\n【一片空白。说明用户今天一顿饭都没吃，或者连记都懒得记】\n\n请【严格根据你的人物性格，遵守人物对白语言】，对我“一顿饭都没吃/毫无饮食记录”这件事做出真实的反应。直接跟我对话，绝不要捏造我吃了东西！`;
    } else {
        userPrompt = `这是我 ${dateStr} 的饮食记录：\n${recordText}\n\n请【严格根据你的人物性格，遵守人物对白语言】，像平时聊天一样评价我的饮食。直接跟我对话，严禁凭空捏造我没吃过的东西！`;
    }

    try {
        const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.8
            })
        });
        
        if (!response.ok) {
    const errData = await response.text();
    throw new Error(`HTTP状态码 ${response.status} | 详细原因: ${errData}`);
}
        
        const data = await response.json();
        const reply = data.choices[0].message.content;
        
        // 解析文本并保存入库
        const formattedReply = reply.replace(/\n/g, '<br>');
        document.getElementById('dietAiReply').innerHTML = formattedReply;
        
        if (!dailyDietData[currentDietDate]) dailyDietData[currentDietDate] = { weight: '', meals: [], aiReply: '' };
        dailyDietData[currentDietDate].aiReply = formattedReply; 
        await saveToDB('diet_records_db', dailyDietData);
        
    } catch (e) {
        document.getElementById('dietAiReply').innerText = "TA 好像断网了：" + e.message;
    } finally {
        btn.innerText = "点评今日";
        btn.style.opacity = '1';
    }
});

// 模式二：TA吃什么？
document.getElementById('askAiMenuBtn').addEventListener('click', async function() {
    const btn = this;
    const useSubApi = await loadFromDB('dietUseSubApi') || false;
const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if (!apiKey) { alert("请先去设置配置 API 节点哦！"); return; }

    btn.innerText = "TA 正在点餐...";
    btn.style.opacity = '0.7';

    let systemPrompt = `你是一个陪伴用户的角色。【最高强制指令：只准严格输出规定的食谱数据！绝对禁止输出任何聊天、对白、动作描写或解释！不要聊天对白！只交出你的饮食清单！必须遵守时代背景】`;
    if (currentDietRoleId) {
        const chars = await loadFromDB('ai_characters') || [];
        const role = chars.find(c => c.id === currentDietRoleId);
        if (role && role.prompt) {
            systemPrompt = `你扮演 ${role.name}。${role.prompt}\n【最高强制指令：只准严格输出规定的食谱数据！绝对禁止说任何多余的话！不要聊天对白！必须遵守时代背景】`;
        }
    }

    const isToday = currentDietDate === new Date().setHours(0,0,0,0);
    let userPrompt = '';
    
    if (isToday) {
        userPrompt = `请记录你今天打算吃的一顿或多顿饭。
【要求】：
1. 严禁任何问候、对白或解释。
2. 每一行只输出一顿饭的记录，格式必须严格如下（左边餐类，竖线，右边食物加符合人物性格和对白语言的短句）：
[AI饮食] 早餐 | 冰美式 (提神保命)
[AI饮食] 午餐 | 庙街煲仔饭 (还是街边吃得舒坦)
如果你现在不想吃，严格回复：
[AI饮食] 不吃`;
    } else {
        const dateStr = new Date(currentDietDate).toLocaleDateString();
        userPrompt = `我们在回顾 ${dateStr} 这一天。请记录你那天吃的一顿或多顿饭。
【要求】：
1. 严禁任何问候、对白或解释。
2. 每一行只输出一顿饭的记录，格式必须严格如下：
[AI饮食] 午餐 | 烧味拼盘 (随便吃点)
如果你那餐没吃东西，严格回复：
[AI饮食] 不吃`;
    }

    try {
        const response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.8
            })
        });
        
        if (!response.ok) {
    const errData = await response.text();
    throw new Error(`HTTP状态码 ${response.status} | 详细原因: ${errData}`);
}
        
        const data = await response.json();
        const reply = data.choices[0].message.content;
        
        // 正则提取它按要求输出的固定格式
        if (!dailyDietData[currentDietDate]) dailyDietData[currentDietDate] = { weight: '', meals: [], aiReply: '' };
        if (!dailyDietData[currentDietDate].meals) dailyDietData[currentDietDate].meals = [];
        
        const lines = reply.split('\n');
        let added = false;
        lines.forEach(line => {
            const match = line.match(/\[AI饮食\]\s*(.*?)\s*\|\s*(.*)/);
            if (match) {
                const type = match[1].trim();
                const food = match[2].trim();
                if (type && food) {
                    dailyDietData[currentDietDate].meals.push({ id: Date.now() + Math.random(), type: type, food: food, isAi: true });
                    added = true;
                }
            }
        });
        
        if (added) {
            await saveToDB('diet_records_db', dailyDietData);
            renderDietUI(); 
            document.getElementById('dietAiReply').innerHTML = `<span style="color:var(--accent)">TA 已经把自己打算吃的东西，加到了上方的列表里啦~</span>`;
        } else if (reply.includes('不吃')) {
            document.getElementById('dietAiReply').innerHTML = `<span style="color:var(--accent)">TA 傲娇地说这天不打算吃东西。</span>`;
        } else {
            document.getElementById('dietAiReply').innerHTML = `<span style="color:#D67A7A">TA 的回答格式不对，没有成功识别：<br>${reply}</span>`;
        }
        
    } catch (e) {
        document.getElementById('dietAiReply').innerText = "点餐失败：" + e.message;
    } finally {
        btn.innerText = "TA吃什么?";
        btn.style.opacity = '1';
    }
});

// === 节点切换：三个点菜单逻辑 ===
// 1. 每次打开APP时，读取一次之前的状态，让三个点变色
document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('食谱')) {
        app.addEventListener('click', async () => {
            const isSub = await loadFromDB('dietUseSubApi') || false;
            document.getElementById('dietApiToggleBtn').style.color = isSub ? 'var(--accent)' : 'var(--text-sub)';
        });
    }
});

// 2. 点击三个点切换节点 (带跟随式悬浮提示)
document.getElementById('dietApiToggleBtn').addEventListener('click', async function() {
    let isSub = await loadFromDB('dietUseSubApi') || false;
    isSub = !isSub; // 反转状态
    await saveToDB('dietUseSubApi', isSub);
    
    // 改变图标颜色：奶咖色是副节点，深灰色是主节点
    this.style.color = isSub ? 'var(--accent)' : 'var(--text-sub)';
    
    // 动态生成一个就在手指旁边浮现的精致小气泡
    let toast = document.getElementById('apiToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'apiToast';
        toast.style.cssText = "position:absolute; top:36px; right:60px; background:var(--surface); border:1px solid rgba(184,156,142,0.3); padding:8px 14px; border-radius:12px; font-size:12px; font-weight:700; box-shadow:0 6px 16px rgba(0,0,0,0.08); opacity:0; transition:opacity 0.2s; pointer-events:none; z-index:999; white-space:nowrap;";
        this.parentNode.style.position = 'relative'; // 相对定位
        this.parentNode.appendChild(toast);
    }
    
    toast.innerText = isSub ? '已切换至 : 副节点 (Sub)' : '已切换至 : 主节点 (Main)';
    toast.style.color = isSub ? 'var(--accent)' : 'var(--text-main)';
    toast.style.opacity = '1';
    
    // 1.5秒后温柔地消失
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1500);
});

// === 梦境 APP 交互逻辑 ===
const dreamModal = document.getElementById('dreamAppModal');
let dreamCurrentTab = 'interpret'; // interpret (解梦) | exchange (交换) | collection (收藏)
let dreamCollections = [];
let lastDreamDataToSave = null; // 用于暂存以便收藏

document.querySelectorAll('.app').forEach(app => {
    if (app.innerText.includes('梦境')) {
        app.addEventListener('click', async () => {
            dreamModal.classList.add('open');
            await loadDreamRoles();
            await loadDreamCollections();
            // 读取API设置
            const isSub = await loadFromDB('dreamUseSubApi') || false;
            document.getElementById('dreamApiToggle').checked = isSub;
        });
    }
});

document.getElementById('closeDreamApp').addEventListener('click', () => dreamModal.classList.remove('open'));
document.getElementById('openDreamSettingsBtn').addEventListener('click', () => document.getElementById('dreamSettingsModal').classList.add('show'));
document.getElementById('closeDreamSettingsBtn').addEventListener('click', async () => {
    await saveToDB('dreamUseSubApi', document.getElementById('dreamApiToggle').checked);
    document.getElementById('dreamSettingsModal').classList.remove('show');
});

// 加载角色到下拉框
async function loadDreamRoles() {
    const chars = await loadFromDB('ai_characters') || [];
    const group = document.getElementById('dreamRoleGroup');
    group.innerHTML = '';
    chars.forEach(c => {
        if(c.roleType === 'char') group.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

// 切换下拉框时，显示或隐藏自定义名字输入框
document.getElementById('dreamPersonSelect').addEventListener('change', function(e) {
    if (e.target.value === 'custom') {
        document.getElementById('dreamCustomName').style.display = 'block';
    } else {
        document.getElementById('dreamCustomName').style.display = 'none';
    }
});

// 顶部 Tab 切换逻辑
document.querySelectorAll('#dreamTabSelector .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#dreamTabSelector .role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        dreamCurrentTab = btn.dataset.tab;
        
        const inputArea = document.getElementById('dreamInputArea');
        const collectionArea = document.getElementById('dreamCollectionArea');
        const actionBtn = document.getElementById('dreamActionBtn');
        
        if (dreamCurrentTab === 'collection') {
            inputArea.style.display = 'none';
            collectionArea.style.display = 'flex';
            renderDreamCollections();
        } else {
            inputArea.style.display = 'flex';
            collectionArea.style.display = 'none';
            actionBtn.innerText = dreamCurrentTab === 'interpret' ? "让 TA 帮你解梦" : "与 TA 交换梦境";
        }
    });
});

// 核心网络请求
document.getElementById('dreamActionBtn').addEventListener('click', async function() {
    const content = document.getElementById('dreamContentInput').value.trim();
    if (!content) { showToast('请先描述你的梦境...'); return; }

    const useSubApi = await loadFromDB('dreamUseSubApi') || false;
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';
    
    if (!apiKey) { showToast("请先去设置配置 API 节点！"); return; }

    const btn = this;
    const originalText = btn.innerText;
    btn.innerText = "进入梦境连接中...";
    btn.style.opacity = '0.7';

    // 确定交流对象身份
const selectVal = document.getElementById('dreamPersonSelect').value;
let targetName = '神秘解梦人';

// 完美复刻你的原版白描手法设定
let systemPrompt = "[System Note: 请使用细腻的白描手法描写，注重氛围感和细节描写。绝对禁止使用括号()或星号**来表示动作。禁止使用独白体，直接进行描写。]\n\n";

if (selectVal === 'random') {
    systemPrompt += "你是一个随机的、性格独特的陌生人。请先用一句话简短介绍你的虚拟身份，然后解答或回复。";
} else if (selectVal === 'custom') {
    targetName = document.getElementById('dreamCustomName').value.trim() || '神秘人';
    systemPrompt += `你现在的身份是【${targetName}】。请完全沉浸入这个角色，以符合该角色的时代背景、说话语气和世界观来回答。不要出戏。`;
} else {
    const chars = await loadFromDB('ai_characters') || [];
    const role = chars.find(c => c.id === selectVal);
    if (role) {
        targetName = role.name;
        systemPrompt += `你扮演 ${role.name}。人物设定：${role.prompt}\n请完全遵守人物设定和语气进行回复，不要出戏。`;
    }
}

// 区分“解梦”和“交换梦境”的 Prompt (融合你原版的强硬要求风格)
let userPrompt = '';
if (dreamCurrentTab === 'interpret') {
    userPrompt = `用户向你讲述了TA的梦境：\n"${content}"\n\n【要求】：\n1. 请你以当前的身份视角和世界观，为用户解答这个梦境的潜在含义。\n2. 结合你的性格特点，给出安慰、预言或哲理分析。\n3. 必须分段，篇幅适中。\n4. 不要解释，直接进行你的解答。`;
} else {
    userPrompt = `用户用一个梦境与你交换：\n"${content}"\n\n请你回赠一个奇异、超现实的梦境。\n【要求】：\n1. 必须完全符合角色性格。\n2. 必须分段。\n3. 篇幅600字以内。\n4. 不要解释，直接描述。\n5. 可以在结尾对用户的梦境作出一两句符合人设的简短回应。`;
}

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.8 })
        });
        
        if (!res.ok) throw new Error('网络请求失败');
        
        const data = await res.json();
        const reply = data.choices[0].message.content.trim();
        
        document.getElementById('dreamResultArea').style.display = 'block';
        document.getElementById('dreamResultTitle').innerText = `${targetName} 的回应`;
        document.getElementById('dreamResultText').innerText = reply;
        document.getElementById('saveDreamBtn').style.display = 'block';

        // 暂存用于收藏
        lastDreamDataToSave = {
            id: 'dream_' + Date.now(),
            type: dreamCurrentTab === 'interpret' ? '解梦' : '交换',
            targetName: targetName,
            myDream: content,
            aiReply: reply,
            time: Date.now()
        };

    } catch (e) {
        showToast("连接梦境失败：" + e.message);
    } finally {
        btn.innerText = originalText;
        btn.style.opacity = '1';
    }
});

// 收藏功能
async function loadDreamCollections() {
    dreamCollections = await loadFromDB('dream_collections') || [];
}

document.getElementById('saveDreamBtn').addEventListener('click', async function() {
    if (lastDreamDataToSave) {
        dreamCollections.unshift(lastDreamDataToSave);
        await saveToDB('dream_collections', dreamCollections);
        showToast('梦境已收藏进册子！');
        this.style.display = 'none'; // 收藏后隐藏按钮
        lastDreamDataToSave = null;
    }
});

// 全局注册展开/折叠功能
window.toggleDreamExpand = function(btn) {
    const wrapper = btn.previousElementSibling; // 现在选中的是整个内容包裹层
    if (wrapper.classList.contains('collapsed')) {
        wrapper.classList.remove('collapsed');
        wrapper.classList.add('expanded');
        btn.innerText = 'FOLD UP ∧';
    } else {
        wrapper.classList.remove('expanded');
        wrapper.classList.add('collapsed');
        btn.innerText = 'READ MORE ∨';
    }
};

// 渲染收藏册卡片
function renderDreamCollections() {
    const container = document.getElementById('dreamCollectionArea');
    container.innerHTML = '';
    if (dreamCollections.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-sub); font-size:13px; margin-top:60px; letter-spacing:1px;">册子里空空如也，今晚做个好梦吧。</div>';
        return;
    }

    dreamCollections.forEach(item => {
        const div = document.createElement('div');
        div.className = 'dream-col-card';
        const dateStr = new Date(item.time).toLocaleDateString().replace(/\//g, '.');
        
        // 【核心修改】因为平时彻底折叠，我们甚至不需要用 substring 去截断字数了，展开就能直接看全文！
        div.innerHTML = `
            <div class="dream-col-header">
                <div class="dream-tag">${item.type}</div>
                <div class="dream-date">${dateStr}</div>
            </div>
            <div class="dream-col-source">与 ${item.targetName} 的共振</div>
            <!-- 加了一个专门用来彻底隐藏的大外壳 -->
            <div class="dream-col-content-wrapper collapsed">
                <div class="dream-col-mine">${item.myDream}</div>
                <div class="dream-col-reply">${item.aiReply}</div>
            </div>
            <div class="dream-expand-btn" onclick="toggleDreamExpand(this)">READ MORE ∨</div>
            <div class="dream-col-footer">
                <div class="dream-col-del" onclick="deleteDream('${item.id}')">销毁记忆</div>
            </div>
        `;
        container.appendChild(div);
    });
}

