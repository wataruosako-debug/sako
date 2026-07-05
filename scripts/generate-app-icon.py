#!/usr/bin/env python3
"""ノビログ アプリアイコン (1024x1024) 生成スクリプト.

デザイン仕様:
- 背景: 青グラデーション(左上→右下, #2563EB 系)
- 中央に 3 本バーのシンボルのみ(文字なし)
- バーはキャンバスの約 63% を占めるサイズ
- 一番右(最も高い)バーの上に薄い青の「^」矢印
- 角丸なしの正方形(角丸は iOS が自動適用)
"""

import numpy as np
from PIL import Image, ImageDraw

SIZE = 1024
SS = 4  # スーパーサンプリング倍率

# ---- カラー ----
BG_TL = (37, 99, 235)   # #2563EB  左上
BG_BR = (30, 64, 175)   # #1E40AF  右下(同系のより深い青)
BAR = (255, 255, 255)   # 白いバー(青背景でのコントラスト)
CARET = (147, 197, 253)  # #93C5FD  薄い青の矢印

# ---- 背景グラデーション(左上→右下の対角) ----
yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
t = (xx + yy) / (2 * (SIZE - 1))          # 0(左上) → 1(右下)
bg = np.empty((SIZE, SIZE, 3), np.float32)
for i in range(3):
    bg[..., i] = BG_TL[i] * (1 - t) + BG_BR[i] * t
bg_img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), "RGB")

# ---- シンボル(スーパーサンプリングして描画) ----
layer = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)


def S(v):
    return int(round(v * SS))


# バー配置(1024 座標) : 高さ比 ≒ 1 : 1.7 : 2.85, 幅=バー間隔
baseline = 835
w = 100          # バー幅
gap = 90         # バー間隔
total_w = 3 * w + 2 * gap
x0 = (SIZE - total_w) / 2   # バー群を水平中央に
heights = [197, 333, 560]   # bar1, bar2, bar3
radius = 26                 # バー角丸

centers = []
for idx, h in enumerate(heights):
    left = x0 + idx * (w + gap)
    right = left + w
    top = baseline - h
    centers.append((left + right) / 2)
    d.rounded_rectangle(
        [S(left), S(top), S(right), S(baseline)],
        radius=S(radius),
        fill=BAR,
    )

# ---- 一番右のバー上の「^」矢印(薄い青) ----
cx = centers[2]               # bar3 中心
tip_y = heights[2]            # 参照用(未使用)
peak = (cx, baseline - heights[2] - 90)   # 矢印の頂点(bar3 の少し上)
arm = 75                                   # 腕の水平方向の広がり
foot_y = baseline - heights[2] + 5         # bar3 天面に接する
stroke = 46
left_foot = (cx - arm, foot_y)
right_foot = (cx + arm, foot_y)

# 2 本の線 + 丸い端/接合で「^」を描く
for a, b in ((left_foot, peak), (peak, right_foot)):
    d.line([S(a[0]), S(a[1]), S(b[0]), S(b[1])], fill=CARET, width=S(stroke))
# 丸い角/端
r = stroke / 2
for cxp, cyp in (peak, left_foot, right_foot):
    d.ellipse([S(cxp - r), S(cyp - r), S(cxp + r), S(cyp + r)], fill=CARET)

# ---- ダウンサンプル & 合成 ----
sym = layer.resize((SIZE, SIZE), Image.LANCZOS)
icon = bg_img.convert("RGBA")
icon.alpha_composite(sym)
icon = icon.convert("RGB")

out = "assets/icon-1024.png"
import os
os.makedirs("assets", exist_ok=True)
icon.save(out)
print("saved", out, icon.size)
