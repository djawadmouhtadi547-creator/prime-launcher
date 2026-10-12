#!/usr/bin/env python3
"""يولّد أيقونة Prime Launcher (حرف P من مكعبات) بدون أي مكتبات خارجية.
الناتج: tools/app-icon.png + src-tauri/icons/*.png + icon.ico
لتوليد icon.icns لماك شغّل بعدها:  npm run icon
"""
import os, struct, zlib

BG, FRAME = (27, 29, 33), (46, 49, 56)
ACC, HI, LO = (125, 154, 91), (163, 188, 132), (69, 85, 50)
P = ["######.", "##...##", "##...##", "##...##", "######.", "##.....", "##.....", "##.....", "##....."]
X0, Y0 = 4, 3  # موضع الحرف داخل شبكة 16×16

def pixel(x, y, size):
    g = 128
    gx, gy = x * g // size, y * g // size
    cx, cy, lx, ly = gx // 8, gy // 8, gx % 8, gy % 8
    if cx in (0, 15) or cy in (0, 15):
        return FRAME
    px, py = cx - X0, cy - Y0
    if 0 <= py < len(P) and 0 <= px < len(P[0]) and P[py][px] == "#":
        if lx == 0 or ly == 0: return HI
        if lx == 7 or ly == 7: return LO
        return ACC
    return BG

def png(size):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel(x, y, size)); raw.append(255)
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))

def ico(sizes):
    imgs = [png(s) for s in sizes]
    out = struct.pack("<HHH", 0, 1, len(sizes)); off = 6 + 16 * len(sizes)
    for s, d in zip(sizes, imgs):
        out += struct.pack("<BBBBHHII", s % 256, s % 256, 0, 0, 1, 32, len(d), off); off += len(d)
    return out + b"".join(imgs)

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
icons = os.path.join(root, "src-tauri", "icons"); os.makedirs(icons, exist_ok=True)
def w(path, data):
    with open(path, "wb") as f: f.write(data)
w(os.path.join(root, "tools", "app-icon.png"), png(1024))
for name, s in [("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256), ("icon.png", 512)]:
    w(os.path.join(icons, name), png(s))
w(os.path.join(icons, "icon.ico"), ico([16, 32, 48, 64, 128, 256]))
print("icons generated")
