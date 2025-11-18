# 🧭 **Minecraft Java — Java バージョン自動判定（完全版）**

## 🎯 要件まとめ

| 要件                                                                   | 対応    |
| -------------------------------------------------------------------- | ----- |
| release / snapshot / old beta / alpha 全対応                            | ✔     |
| `version.json` に Java 情報 (`javaVersion.majorVersion`) がある場合 → そのまま利用 | ✔     |
| 古いバージョン（Java 情報なし）→ リリース日時で判定                                        | ✔     |
| Electron（Node.js）向けの実装                                               | ✔     |
| `version.json` 構造例                                                   | ✔（後述） |

---

# 1. Mojang Meta API 仕様（最新版）

### **version_manifest_v2.json**

```
https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
```
または
`./sample/compact_mojang_version_manifest.json`

構造例（重要部分）：

```json
{
  "versions": [
    {
      "id": "1.21.1",
      "type": "release",
      "url": "https://piston-meta.mojang.com/v1/packages/xxx/1.21.1.json",
      "releaseTime": "2024-07-10T12:00:00+00:00" 
    },
    {
      "id": "24w33a",
      "type": "snapshot",
      "url": "https://piston-meta.mojang.com/v1/packages/yyy/24w33a.json",
      "releaseTime": "2024-08-14T15:10:20+00:00"
    },
    {
      "id": "1.0",
      "type": "release",
      "url": "https://piston-meta.mojang.com/v1/packages/zzz/1.0.json",
      "releaseTime": "2011-11-18T22:00:00+00:00"
    }
  ]
}
```

---

# 2. 各 version.json の構造例

### ❗Java 情報のある最新バージョン例

```json
{
  "id": "1.21.10",
  "javaVersion": {
    "component": "java-runtime-gamma",
    "majorVersion": 21
  },
  "downloads": {
    "server": {
      "url": "..."
    }
  }
}
```

### ❗Java 情報が欠けている旧バージョン例（例：1.16.5）

```json
{
  "id": "1.16.5",
  "downloads": {
    "server": { ... }
  }
}
```

---

# 3. リリース日時による Java フォールバックルール（公式ドキュメント準拠）

Minecraft が Java バージョンを切り替えたタイミング：

| Java    | 必須になったバージョン  | リリース日時        | 判定しきい値                    |
| ------- | ------------ | ------------- | ------------------------- |
| Java 16 | 1.17         | 2021-06-08    | `< 2021-06-08` → Java 8   |
| Java 17 | 1.18         | 2021-11-30    | `< 2021-11-30` → Java 16  |
| Java 21 | 1.20.5       | 2024-04-23    | `< 2024-04-23` → Java 17  |

まとめると：

```
releaseTime < 2021-06-08 → Java 8
releaseTime < 2021-11-30 → Java 16
releaseTime < 2024-04-23 → Java 17
releaseTime >= 2024-04-23 → Java 21
```

---

# 4. 実装 — Electron（JavaScript）

## ✔ 完全版（Java 情報がある場合は利用し、無い場合は releaseTime で判定）

```js
const MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

async function getRequiredJavaVersion(mcVersion) {
    const manifest = await (await fetch(MANIFEST_URL)).json();

    const entry = manifest.versions.find(v => v.id === mcVersion);
    if (!entry) throw new Error(`Version not found: ${mcVersion}`);

    // 詳細 version.json を取得
    const versionJson = await (await fetch(entry.url)).json();

    // 1. 明記されている場合は公式の値を返す（最優先）
    if (versionJson.javaVersion && versionJson.javaVersion.majorVersion) {
        return versionJson.javaVersion.majorVersion;
    }

    // 2. フォールバック：releaseTime で判定
    const releaseTime = new Date(entry.releaseTime);

    return detectJavaByDate(releaseTime);
}

// releaseTime による判定ルール
function detectJavaByDate(date) {
    if (date < new Date("2021-06-08T00:00:00Z")) return 8;   // 1.16.5まで
    if (date < new Date("2021-11-30T00:00:00Z")) return 16;  // 1.17.x
    if (date < new Date("2024-04-23T00:00:00Z")) return 17;  // 1.18〜1.20.4（通常使われない）
    return 21;                                               // 1.20.5+     （通常使われない）
}

// ------ 使用例 ------
(async () => {
    console.log(await getRequiredJavaVersion("1.21.10")); // → 21（jsonに記載あり）
    console.log(await getRequiredJavaVersion("1.16.5"));  // → 8  （フォールバック）
    console.log(await getRequiredJavaVersion("24w33a"));  // → 21（jsonに記載あり）
})();
```

---

# 5. なぜこの方式が「完全対応」なのか？

### ✔ snapshot / pre-release / experimental

`version.json` は例外なく以下を持つ：

```
javaVersion.majorVersion
releaseTime
```

したがって snapshot でも pre-release でも旧ベータでも必ずどちらかで判定できる。

### ✔ 古いバージョン（1.2.5, Beta, Alpha, Indev 等）

* 公式 API には **releaseTime が必ず存在**
* Java 情報はない
  → リリース日時で確実に決定できる

### ✔ 将来バージョンにも強い

* 新 Java になる場合、必ず公式 JSON に majorVersion が追加される
* JSON が優先されるので壊れない
* 過去は releaseTime で扱える
