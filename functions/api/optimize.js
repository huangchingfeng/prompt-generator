/**
 * 黃金提示詞優化師 — Cloudflare Pages Function
 * POST /api/optimize  { prompt: string } → { optimized: string }
 *
 * 金鑰只存在 Cloudflare Pages 環境變數 GEMINI_API_KEY，不進 repo、不進前端。
 * 防濫用：同源檢查 + 輸入長度上限 + 每 IP 冷卻(Cache API)。
 */

const MODEL = 'gemini-2.5-flash';
const MAX_LEN = 1000;
const COOLDOWN_SEC = 6; // 同一 IP 兩次請求最短間隔

const OPTIMIZER_SYSTEM_PROMPT = `你是一位頂尖的「提示詞優化專家」，專精於將用戶模糊、單薄的指令轉化為結構化、專業級的高品質 Prompt。

## 你的核心方法論：黃金三角理論

每個優秀的 Prompt 必須包含三個關鍵要素：

1. **Role（角色）**：指定 AI 應該扮演什麼專家角色
2. **Context（情境）**：提供足夠的背景資訊和限制條件
3. **Expectation（期望）**：明確說明期望的輸出格式和要求

## 你的工作流程

當收到用戶的原始指令時，請依照以下步驟處理：

### Step 1: 分析 (Analyze)
- 拆解用戶的核心意圖
- 識別缺失的關鍵資訊
- 推測用戶可能的使用場景

### Step 2: 擴充 (Expand)
根據黃金三角理論補全資訊：
- **Role**: 推薦最適合的專家角色（如：資深文案師、數據分析師、內容策略顧問）
- **Context**: 根據語意推敲背景（急迫性、專業程度、目標受眾）
- **Expectation**: 設定具體的輸出格式、字數限制、風格要求

### Step 3: 重組 (Reconstruct)
將所有資訊組合成結構化的 Markdown 格式 Prompt

## 輸出格式要求

請嚴格按照以下 Markdown 格式輸出：

## 🎭 角色設定 (Role)

**你是**：[專家角色名稱]

[角色的專業背景描述，2-3句話]

---

## 📋 情境描述 (Context)

**背景**：
[詳細的情境描述]

**限制條件**：
- [條件1]
- [條件2]
- [條件3]

---

## 🎯 期望輸出 (Expectation)

**輸出格式**：[格式要求]

**具體要求**：
1. [要求1]
2. [要求2]
3. [要求3]

---

## 📝 執行指令

[整合後的完整指令，可直接複製使用]

## 重要原則

1. **不要問問題**：直接根據語境做出最合理的假設
2. **專業但易懂**：使用專業術語但解釋清楚
3. **實用導向**：輸出的 Prompt 必須可以直接使用
4. **繁體中文**：所有輸出使用繁體中文（台灣用語）

現在，請分析並優化用戶的指令。`;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function onRequestPost({ request, env }) {
  try {
    // 同源檢查：擋掉別人直接拿這支 API 當免費後端
    const origin = request.headers.get('Origin') || request.headers.get('Referer') || '';
    const host = new URL(request.url).host;
    if (origin && !origin.includes(host) && !origin.includes('localhost')) {
      return json({ error: '來源不允許' }, 403);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: '格式錯誤' }, 400); }
    const prompt = (body && body.prompt || '').trim();

    if (!prompt) return json({ error: '請先輸入你的原始想法' }, 400);
    if (prompt.length > MAX_LEN) return json({ error: `想法長度不能超過 ${MAX_LEN} 字` }, 400);

    // 每 IP 冷卻(Cache API，per-colo)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const cache = caches.default;
    const rlKey = new Request(`https://ratelimit.local/opt/${encodeURIComponent(ip)}`);
    const hit = await cache.match(rlKey);
    if (hit) return json({ error: '太快了，請幾秒後再試一次' }, 429);
    await cache.put(rlKey, new Response('1', { headers: { 'Cache-Control': `max-age=${COOLDOWN_SEC}` } }));

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) return json({ error: '尚未設定 API 金鑰，請聯繫管理員' }, 500);

    const model = env.GEMINI_MODEL || MODEL;
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: OPTIMIZER_SYSTEM_PROMPT },
              { text: `請根據黃金三角理論，優化以下用戶指令：\n\n---\n用戶原始指令：\n${prompt}\n---\n\n請按照指定格式輸出優化後的 Prompt。` },
            ],
          }],
          generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!r.ok) return json({ error: 'AI 服務暫時無法使用，請稍後再試' }, 502);

    const data = await r.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const optimized = parts.map(p => p.text || '').join('').trim();
    if (!optimized) return json({ error: '無法生成優化結果，請重試' }, 500);

    return json({ optimized });
  } catch (e) {
    return json({ error: '系統發生錯誤，請稍後再試' }, 500);
  }
}

export async function onRequestGet() {
  return json({ ok: true, service: 'golden-prompt-optimizer', method: 'POST /api/optimize' });
}
