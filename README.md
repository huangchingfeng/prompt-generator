# prompt.autolab.cloud（AI 提示詞產生器）

## 🔴 改內容前一定要先做的事

```bash
git fetch origin && git status
```

**這個 repo 曾經被「從舊副本部署」毀過兩次**（2026-08-17、2026-09-05）。
兩次都是同一個死法：有人拿本機一份舊的 `prompt-templates.json` 蓋掉線上，
3554 個已經升級過的 placeholder 範例被打回短版，**全程零錯誤訊息**，三週後才被發現。

### 唯一真相源
`prompt-templates.json` 以**這個 git repo 的 origin/main** 為準。
本機至少有 18 份副本（`~/xxx-work`、`~/.cache/afeng-*`、`~/.cache/cf-pages-deploy/`），
**沒有一份可以直接拿來部署**。要改就 clone 一份新的，改完 push。

### 部署
GitHub Pages：**push 就是上線**，不要另外跑 wrangler。

### 健康判準（改完自己驗）
```bash
python3 -c "
import json,statistics
d=json.load(open('prompt-templates.json',encoding='utf-8'))
c=[x for x in d if not str(x.get('id','')).startswith('_')]
L=[len(f.get('placeholder','') or '') for x in c for f in (x.get('structure') or [])]
print(len(c),'題  placeholder 中位',statistics.median(L),' <30字',sum(1 for v in L if v<30))
"
```
正常值：**1131 題以上、中位 ≥70、<30 字的欄位為 0**。
中位掉到 26 就是又被舊副本蓋掉了。

### 自動監控
每週一 09:20 `com.afeng.sites-check` 會比對線上 vs GitHub main，
不一致會寄 Email 告警。
