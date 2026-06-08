// ==========================================
// 系统备份与恢复引擎 (图片压缩 + 单文件内部智能切片 + 合并覆盖)
// ==========================================

document.getElementById('backupIncludeImgToggle').addEventListener('change', function() {
    const row = document.getElementById('backupImgQualityRow');
    row.style.opacity = this.checked ? '1' : '0.4';
    row.style.pointerEvents = this.checked ? 'auto' : 'none';
});

function compressBlobToBase64(blob, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = (e) => {
            if (quality >= 1.0) { resolve(e.target.result); return; }
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
    });
}

function base64ToBlob(base64, type) {
    const binStr = atob(base64.split(',')[1]);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = binStr.charCodeAt(i);
    return new Blob([arr], { type: type });
}

// 内部切片分割符
const SPLIT_TAG = "\n---STARLIGHT_CHUNK_SPLIT---\n";

// 单文件打包导出
document.getElementById('exportBackupBtn').addEventListener('click', async function() {
    const btn = this;
    const oldText = btn.innerText;
    btn.innerText = "正在封存数据..."; 
    btn.style.opacity = '0.6';
    
    const includeImg = document.getElementById('backupIncludeImgToggle').checked;
    const imgQuality = parseFloat(document.getElementById('backupImgQualitySelect').value);
    const CHUNK_LIMIT = 4 * 1024 * 1024; // 每片 4MB，防止单个 JSON 过大
    
    try {
        const db = await initDB();
        const allData = await new Promise((resolve, reject) => {
            const dbData = {};
            const tx = db.transaction(STORE_NAME, "readonly");
            const req = tx.objectStore(STORE_NAME).openCursor();
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { dbData[cursor.key] = cursor.value; cursor.continue(); } 
                else { resolve(dbData); }
            };
            req.onerror = reject;
        });

        const lsData = {};
        for (let i = 0; i < localStorage.length; i++) {
            lsData[localStorage.key(i)] = localStorage.getItem(localStorage.key(i));
        }

        const blobParts = [];
        
        // 第1块：元数据和配置
        blobParts.push(JSON.stringify({
            app: "Lumina Desk Backup", version: 3, 
            exportTime: new Date().toISOString(),
            localStorage: lsData
        }));

        let currentChunk = {};
        let currentSize = 0;

        // 对海量数据库进行智能内部切割
        for (const key in allData) {
            let value = allData[key];
            if (value instanceof Blob || value instanceof File) {
                if (!includeImg) continue; 
                const b64 = await compressBlobToBase64(value, imgQuality);
                const outType = imgQuality < 1.0 ? 'image/jpeg' : value.type;
                value = { _isBlob: true, type: outType, name: value.name, data: b64 };
            }
            
            const valueStr = JSON.stringify(value);
            if (currentSize + valueStr.length > CHUNK_LIMIT && Object.keys(currentChunk).length > 0) {
                blobParts.push(SPLIT_TAG);
                blobParts.push(JSON.stringify(currentChunk));
                currentChunk = {};
                currentSize = 0;
            }
            currentChunk[key] = value;
            currentSize += valueStr.length;
        }
        if (Object.keys(currentChunk).length > 0) {
            blobParts.push(SPLIT_TAG);
            blobParts.push(JSON.stringify(currentChunk));
        }

        // 把所有碎块拼成唯一的单文件
        const finalBlob = new Blob(blobParts, { type: "text/plain;charset=utf-8" });
        const fileName = `Starlight备份_${new Date().getTime()}.starlight`;

        const a = document.createElement("a");
        a.href = URL.createObjectURL(finalBlob);
        a.download = fileName;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        
        showToast("📦 单文件备份包导出成功！");
    } catch (e) {
        showToast("导出失败，请重试");
    } finally {
        btn.innerText = oldText; btn.style.opacity = '1';
    }
});

// 单文件智能吞吐导入
document.getElementById('importBackupInput').addEventListener('change', async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = "选择导入方式";
    cc.querySelector('.cc-desc').innerText = "📦 检查到备份包\n\n【覆盖】将清空当前所有数据\n【合并】将保留旧数据，仅补充新数据";
    
    const btnBox = cc.querySelector('.cc-btns');
    const originalBtnsHtml = btnBox.innerHTML; 

    btnBox.innerHTML = `
        <button class="cc-btn cancel" id="impCancel">取消</button>
        <button class="cc-btn" id="impMerge" style="background:#E6E3DE; color:var(--text-main);">合并</button>
        <button class="cc-btn danger" id="impOverwrite" style="background:var(--accent); color:#fff;">覆盖</button>
    `;
    cc.classList.add('show');

    const executeImport = async (mode) => {
        cc.classList.remove('show');
        btnBox.innerHTML = originalBtnsHtml; 
        
        const loading = document.createElement('div');
        loading.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(246,244,240,0.85); backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:var(--text-main); font-size:15px; font-weight:700; transition:0.3s;';
        document.body.appendChild(loading);

        try {
            loading.innerHTML = `<div style="width:30px; height:30px; border:3px solid var(--accent); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:16px;"></div>正在读取封存包...`;
            await new Promise(r => setTimeout(r, 100));

            // 读取文件并拆解内部切片
            const text = await file.text();
            let chunks = [];
            
            // 兼容你之前的老版本 json
            if (text.includes(SPLIT_TAG)) {
                chunks = text.split(SPLIT_TAG);
            } else {
                chunks = [text]; // 老版本整块直接吃
            }

            if (mode === 'overwrite') {
                localStorage.clear();
                const db = await initDB();
                const tx = db.transaction(STORE_NAME, "readwrite");
                await new Promise((res) => {
                    const req = tx.objectStore(STORE_NAME).clear();
                    req.onsuccess = res; req.onerror = res;
                });
            }

            // 处理第一块（包含配置）
            const metaPart = JSON.parse(chunks[0]);
            const lsData = metaPart.localStorage;
            let firstChunkDb = metaPart.data; // 如果是旧版，数据就在这；如果是新版，这为空

            if (lsData) {
                for (const [k, v] of Object.entries(lsData)) {
                    if (mode === 'merge' && (k === 'ai_characters' || k === 'ai_commands' || k === 'chat_contacts')) {
                        const oldArr = JSON.parse(localStorage.getItem(k) || '[]');
                        const newArr = JSON.parse(v || '[]');
                        const merged = [...oldArr];
                        newArr.forEach(newItem => {
                            if (!merged.find(oldItem => oldItem.id === newItem.id)) merged.push(newItem);
                        });
                        localStorage.setItem(k, JSON.stringify(merged));
                    } else {
                        localStorage.setItem(k, v);
                    }
                }
            }

            // 提取存入数据库的方法
            const processDbData = async (dbDataObj) => {
                if (!dbDataObj) return;
                for (const [key, value] of Object.entries(dbDataObj)) {
                    let finalValue = value;
                    if (value && typeof value === 'object' && value._isBlob) {
                        finalValue = base64ToBlob(value.data, value.type);
                        if (value.name) finalValue = new File([finalValue], value.name, { type: value.type });
                    }
                    if (mode === 'merge' && Array.isArray(value)) {
                        const oldArr = await loadFromDB(key) || [];
                        if (Array.isArray(oldArr)) {
                            const merged = [...oldArr];
                            finalValue.forEach(nItem => {
                                const hasDup = merged.find(oItem => {
                                    if (oItem.id && nItem.id) return oItem.id === nItem.id;
                                    if (oItem.timestamp && nItem.timestamp) return oItem.timestamp === nItem.timestamp;
                                    return false;
                                });
                                if (!hasDup) merged.push(nItem);
                            });
                            // 保持排序规则
                            if (key === 'diary_records' || key === 'letter_mailbox' || key === 'letter_drafts' || key === 'period_records') {
                                finalValue = merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); 
                            } else {
                                finalValue = merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); 
                            }
                        }
                    }
                    await saveToDB(key, finalValue);
                }
            };

            // 吞吐旧版剩余数据
            if (firstChunkDb) await processDbData(firstChunkDb);

            // 逐片吞吐新版的数据库碎片 (从第2片开始)
            for (let i = 1; i < chunks.length; i++) {
                if (!chunks[i].trim()) continue;
                loading.innerHTML = `<div style="width:30px; height:30px; border:3px solid var(--accent); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:16px;"></div>消化数据碎片 [ ${i} / ${chunks.length - 1} ]...`;
                const chunkData = JSON.parse(chunks[i]);
                await processDbData(chunkData);
            }

            loading.innerHTML = `<div style="font-size:32px; margin-bottom:12px;">✨</div>系统重构完毕，即将重启...`;
            setTimeout(() => location.reload(), 1200);
        } catch (e) {
            loading.remove();
            console.error(e);
            showToast("导入中断，文件格式异常");
        }
        event.target.value = '';
    };

    document.getElementById('impCancel').onclick = () => { cc.classList.remove('show'); btnBox.innerHTML = originalBtnsHtml; event.target.value = ''; };
    document.getElementById('impMerge').onclick = () => executeImport('merge');
    document.getElementById('impOverwrite').onclick = () => executeImport('overwrite');
});

// 恢复出厂设置
document.getElementById('clearAllDataBtn').addEventListener('click', () => {
    const cc = document.getElementById('customConfirm');
    cc.querySelector('.cc-title').innerText = "⚠️ 极其危险的操作";
    cc.querySelector('.cc-desc').innerText = "确定要清空所有数据并恢复出厂设置吗？\n该操作无法撤销！建议先导出备份！";
    cc.classList.add('show');
    document.getElementById('ccConfirm').onclick = () => {
        cc.classList.remove('show');
        setTimeout(() => {
            showBeautifulConfirm(() => {
                const req = indexedDB.deleteDatabase(DB_NAME);
                req.onsuccess = () => { localStorage.clear(); location.reload(); };
                req.onblocked = () => { localStorage.clear(); location.reload(); };
            });
            const c2 = document.getElementById('customConfirm');
            c2.querySelector('.cc-title').innerText = "最后警告";
            c2.querySelector('.cc-desc').innerText = "销毁倒计时，一切化为虚无，是否执行？";
            c2.querySelector('#ccConfirm').style.background = "#D67A7A";
            c2.querySelector('#ccConfirm').style.color = "#FFF";
        }, 300);
    };
});

// ==========================================
// 旧日记忆解码仪 (纯本地切片逻辑)
// ==========================================
let decoderChunks = []; // 存放切好的文本碎片
let decoderCurrentIndex = 0; // 当前处理到第几个碎片
let decoderRetryCount = 0; // ★ 新增：记录当前碎片的重试次数
let decoderIsRunning = false;
let decoderLastTimestamp = Date.now(); 

const txtUpload = document.getElementById('memoryTxtUpload');
const consolePanel = document.getElementById('decoderConsole');
const logBox = document.getElementById('decoderLog');
const statusText = document.getElementById('decoderStatus');
const progressText = document.getElementById('decoderProgressText');
const progressBar = document.getElementById('decoderProgressBar');

// 写入控制台日志的辅助函数
function appendDecoderLog(msg, color = "#A3C7A3") {
    logBox.innerHTML += `<span style="color: ${color};">> ${msg}</span><br>`;
    logBox.scrollTop = logBox.scrollHeight;
}

// 1. 读取TXT并切片
txtUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    consolePanel.style.display = 'block';
    appendDecoderLog(`检测到文件: ${file.name}`);
    appendDecoderLog(`文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`, "#FFD54F");
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const fullText = event.target.result;
        appendDecoderLog(`读取成功！总字符数: ${fullText.length}`);
        
        // 核心切片逻辑：每 6500 字切一块，保证不爆 Token，同时保留一点重叠部分防断章取义
        const CHUNK_SIZE = 6500;
        decoderChunks = [];
        for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
            decoderChunks.push(fullText.substring(i, i + CHUNK_SIZE));
        }
        
        decoderCurrentIndex = 0;
        document.getElementById('decoderStartIndex').value = 1; // 新文件重置起始位置
        decoderLastTimestamp = Date.now(); // 新增：新文件重置记忆时间
        statusText.innerText = "就绪";
        progressText.innerText = `0 / ${decoderChunks.length} 碎片`;
        progressBar.style.width = "0%";
        
        appendDecoderLog(`分卷切片完成，共切分出 [ ${decoderChunks.length} ] 块碎片。`, "#4CAF50");
        appendDecoderLog(`如遇中断，可直接在上方填入编号并点击开始继续。`, "#fff");
    };
    reader.readAsText(file);
    e.target.value = ''; // 清空选择
});

// 2. 取消/放弃按钮
document.getElementById('cancelDecodeBtn').addEventListener('click', () => {
    decoderIsRunning = false;
    decoderChunks = [];
    consolePanel.style.display = 'none';
    logBox.innerHTML = "> 终端初始化完毕...<br>";
    document.getElementById('startDecodeBtn').style.display = 'block';
    document.getElementById('pauseDecodeBtn').style.display = 'none';
});

// 3. 开始 / 暂停 控制台逻辑
document.getElementById('startDecodeBtn').addEventListener('click', () => {
    if (decoderChunks.length === 0) {
        showToast("请先选择记忆 TXT 文件！"); return;
    }
    
    // ★ 读取用户指定的起始切片
    let userStartIndex = parseInt(document.getElementById('decoderStartIndex').value);
    if (!isNaN(userStartIndex) && userStartIndex >= 1 && userStartIndex <= decoderChunks.length) {
        // 让当前索引与输入框对齐（数组从 0 开始）
        decoderCurrentIndex = userStartIndex - 1;
    }

    if (decoderCurrentIndex >= decoderChunks.length) {
        showToast("已经全部处理完毕啦！"); return;
    }
    
    decoderIsRunning = true;
    document.getElementById('startDecodeBtn').style.display = 'none';
    document.getElementById('pauseDecodeBtn').style.display = 'block';
    
    appendDecoderLog(`>>> 迁徙引擎启动，从第 ${decoderCurrentIndex + 1} 片开始提炼...`, "#FF9800");
    processNextChunk(); // 触发自动循环
});

document.getElementById('pauseDecodeBtn').addEventListener('click', () => {
    decoderIsRunning = false;
    document.getElementById('startDecodeBtn').style.display = 'block';
    document.getElementById('pauseDecodeBtn').style.display = 'none';
    appendDecoderLog(">>> 已暂停。如需恢复请直接点击开始。", "#FF9800");
});

// 4. 核心：排队喂给 AI，提炼关键词与大事记
async function processNextChunk() {
    if (!decoderIsRunning) return; // 如果点了暂停，就停住
    if (decoderCurrentIndex >= decoderChunks.length) {
        appendDecoderLog("✨ 所有记忆碎片解码完成！", "#4CAF50");
        document.getElementById('startDecodeBtn').style.display = 'block';
        document.getElementById('pauseDecodeBtn').style.display = 'none';
        document.getElementById('startDecodeBtn').innerText = "解码完成";
        decoderIsRunning = false;
        return;
    }

    const chunkText = decoderChunks[decoderCurrentIndex];
    const currentIndexDisp = decoderCurrentIndex + 1;
    
    // 更新 UI 进度
    progressText.innerText = `${currentIndexDisp} / ${decoderChunks.length} 碎片`;
    progressBar.style.width = `${(currentIndexDisp / decoderChunks.length) * 100}%`;
    appendDecoderLog(`[碎片 ${currentIndexDisp}] 扫描中...`, "#9E9E9E");

    // 获取 API 配置 (强制优先使用副节点省钱)
    const useSubApi = await loadFromDB('memoryUseSubApi') || false; 
    const apiUrl = (await loadFromDB(useSubApi ? 'subApiUrl' : 'mainApiUrl')) || 'https://api.openai.com/v1';
    const apiKey = await loadFromDB(useSubApi ? 'subApiKey' : 'mainApiKey');
    const model = (await loadFromDB(useSubApi ? 'subSysModel' : 'sysModel')) || 'gpt-3.5-turbo';

    if (!apiKey) {
        appendDecoderLog("❌ 错误：未配置 API Key，引擎停止。", "#F44336");
        decoderIsRunning = false; return;
    }

    const contactId = document.getElementById('charEditId').value;
    const charName = document.getElementById('charEditName').value.trim() || 'TA'; 

    let playerName = '我'; // 保底称呼
    const settings = await loadFromDB(`chat_settings_${contactId}`) || {};
    if (settings.userRoleId) {
        const allChars = await loadFromDB('ai_characters') || [];
        const userRole = allChars.find(c => c.id === settings.userRoleId);
        if (userRole && userRole.name) {
            playerName = userRole.name;
        }
    }

    // 第一人称上帝视角 + 关键词触发 + 智能时间侦探
    const sysPrompt = `你是一个无感情的客观记忆提取模块。用户将提供一段历史聊天记录切片。
任务：寻找其中有没有【重大剧情转折、信物交换、重要约定、关键情报/雷区】。
要求：
1. 【禁止偷懒】：哪怕这段聊天只有最普通的日常问候和琐事，你也必须强行提炼出他们的交互过程！绝对不要输出【无】！绝对不允许输出空回复！无论如何都必须至少写出一段剧情摘要、梗概。
2. 视角与称呼（极度重要）：哪怕聊天记录中没有写明名字，你也必须清楚这是【你】和【玩家】的对话！必须以【第一人称（“我”）】视角记录，这里的“我”代表【${charName}】（你自己）。指代玩家时，必须使用对方的名字【${playerName}】。绝对禁止搞反人称！
3. 时间侦探：请侦测这段记录里有没有出现真实的日期（如 2023-05-12，或 2023年5月12日）。如果有，请提取出来；如果没有发现日期，请填“延续”。
4. 绝对客观：只记录发生了什么、双方表达了什么。剥离一切情绪描写或小说式的修辞。字数控制在100-500字内。
5. 必须为你提取的剧情打上合适的触发关键词，格式必须严格如下：
[日期:YYYY-MM-DD或延续] [关键词1,关键词2] 这里是提取的客观剧情摘要内容。
6. 【保底格式】：如果你实在找不到任何关键剧情，也绝不准返回空！请强制套用此格式：[日期:延续] [日常闲聊] ${playerName}和我进行了一些…对话。对话内容简单概括。`;

    try {
        const res = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ 
                model, 
                messages: [
                    { role: "system", content: sysPrompt },
                    { role: "user", content: `聊天切片：\n${chunkText}` }
                ], 
                temperature: 0.2 // 低温度保证格式严格
            })
        });

        if (!res.ok) {
            appendDecoderLog(`⚠️ API 被限制或网络波动，冷却 20 秒后重试...`, "#F44336");
            await new Promise(r => setTimeout(r, 20000));
            processNextChunk(); // 原地重新试一次
            return; 
        }

const data = await res.json();
const reply = data.choices[0].message.content.trim();

// ★ 1. 发现是废话就直接跳过
if (reply === '【无】' || reply === '无' || reply.includes('[无]') || reply.length < 15) {
    let previewText = reply ? reply.substring(0, 20).replace(/\n/g, ' ') : '[一片空白]';
    appendDecoderLog(`[碎片 ${currentIndexDisp}] 无实质内容，已跳过: ${previewText}`, "#757575");
    decoderRetryCount = 0; 
}
// ★ 2. 正常提取流程 (支持多日剧情自动拆分为多张卡片)
else {
    decoderRetryCount = 0; 
    let cleanReply = reply.replace(/^(好的|明白了|根据.*?提取|以下是).*?[\n:]/i, '').trim();
    
    let allMemories = await loadFromDB(`chat_memories_${contactId}`) || [];
    let extractedCount = 0;

    // 全局正则引擎：不管 AI 列出了多少个 [日期] [关键词]，统统抓出来拆开！
    const regex = /[\[【]\s*日期[:：]?\s*(.*?)[\]】]\s*[\[【](.*?)[\]】]\s*([\s\S]*?)(?=(?:[\[【]\s*日期|$))/gi;
    let match;
    
    while ((match = regex.exec(cleanReply)) !== null) {
        let dateStr = match[1].trim();
        let keywords = match[2].trim();
        let text = match[3].trim();
        
        if (text.length > 5) {
            // 如果识别到真实日期，更新时间戳
            if (dateStr !== '延续' && dateStr !== '无') {
                let cleanDateStr = dateStr.replace(/年|月/g, '-').replace(/日/g, '');
                let parsedTime = new Date(cleanDateStr).getTime();
                if (!isNaN(parsedTime)) {
                    decoderLastTimestamp = parsedTime;
                }
            }
            
            // 拆分存入独立的记忆卡片
            allMemories.push({ 
                id: Date.now() + currentIndexDisp + Math.random(), // 加上随机数防止多卡片ID重复
                content: `[旧日关键词: ${keywords}] ${text}`, 
                timestamp: decoderLastTimestamp,
                isArchived: true, 
                triggerKeys: keywords 
            });
            extractedCount++;
            appendDecoderLog(`🌟 提取成功: ${keywords}`, "#FFD54F");
        }
    }

    // 如果连一组标准的都没匹配出来（AI 格式彻底崩溃没写日期），就走兜底方案全包进去
    if (extractedCount === 0) {
        let dateStr = '延续';
        let keywords = '记忆碎片';
        let text = cleanReply;

        const match2 = cleanReply.match(/[\[【](.*?)[\]】]\s*([\s\S]*)/);
        if (match2 && match2[1].length < 40 && !match2[1].includes('日期')) {
            keywords = match2[1].trim();
            text = match2[2].trim();
        }

        if (text && text.length > 5) {
            allMemories.push({ 
                id: Date.now() + currentIndexDisp, 
                content: `[旧日关键词: ${keywords}] ${text}`, 
                timestamp: decoderLastTimestamp,
                isArchived: true, 
                triggerKeys: keywords 
            });
            appendDecoderLog(`🌟 兜底提取成功: ${keywords}`, "#FFD54F");
        } else {
            appendDecoderLog(`[碎片 ${currentIndexDisp}] 格式崩溃: ${reply.substring(0, 30).replace(/\n/g, '')}...`, "#F44336");
        }
    }

    await saveToDB(`chat_memories_${contactId}`, allMemories);
}

        // ★ 成功处理完一个，索引+1，并同步到输入框方便记录
        decoderCurrentIndex++;
        if (document.getElementById('decoderStartIndex')) {
            document.getElementById('decoderStartIndex').value = decoderCurrentIndex + 1;
        }
        
        if (decoderCurrentIndex < decoderChunks.length) {
            let waitTime = 22; // 防封控倒计时
            appendDecoderLog(`防封控机制启动：倒数 ${waitTime} 秒处理下一块...`, "#00BCD4");
            let countdown = setInterval(() => {
                waitTime--;
                if (waitTime <= 0 || !decoderIsRunning) clearInterval(countdown);
            }, 1000);
            setTimeout(() => { processNextChunk(); }, 22000);
        } else {
            processNextChunk(); // 触发结束
        }

    } catch (e) {
        if (decoderRetryCount < 3) {
            decoderRetryCount++;
            appendDecoderLog(`❌ 请求出错，冷却10秒进行第 ${decoderRetryCount} 次重试...`, "#F44336");
            await new Promise(r => setTimeout(r, 10000));
            return processNextChunk(); // 原地重试
        } else {
            appendDecoderLog(`❌ 连续报错，跳过此碎片: ${e.message}`, "#F44336");
            decoderRetryCount = 0;
            decoderCurrentIndex++;
            if (document.getElementById('decoderStartIndex')) {
                document.getElementById('decoderStartIndex').value = decoderCurrentIndex + 1;
            }
            processNextChunk(); // 跳到下一个
        }
    }
}