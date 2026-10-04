#!/usr/bin/env python3
"""Erzeugt src/data/aschenthron.json im Tiled-JSON-Format (orthogonal, 32px).
Gids: 1 Stadtstein, 2 Wand, 3 Sumpf, 4 Gras, 5 Katakombenboden, 6 Wasser.
Danach in Tiled bearbeitbar; das Spiel liest nur die JSON-Datei."""
import json, random, collections

W, H, TS = 64, 48, 32
random.seed(4711)
g = [[2] * W for _ in range(H)]

def fill(x0, y0, x1, y1, gid):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = gid

fill(2, 2, 17, 17, 1)       # Stadt
fill(20, 2, 45, 20, 3)      # Sumpf
fill(2, 22, 30, 44, 4)      # Friedhofswald
fill(34, 24, 61, 45, 5)     # Katakomben
fill(18, 9, 19, 10, 1)      # Stadttor Ost -> Sumpf
fill(8, 18, 9, 21, 1)       # Stadttor Sued -> Friedhof
fill(31, 33, 33, 35, 5)     # Friedhof -> Katakomben
fill(30, 21, 31, 21, 4)
for _ in range(60):          # Wasser im Sumpf
    x, y = random.randint(22, 44), random.randint(4, 19)
    g[y][x] = 6
for _ in range(90):          # Grabsteine/Baeume im Friedhof
    x, y = random.randint(3, 29), random.randint(23, 43)
    g[y][x] = 2
for _ in range(70):          # Saeulen in den Katakomben
    x, y = random.randint(36, 60), random.randint(26, 44)
    g[y][x] = 2
fill(8, 18, 9, 21, 1)
fill(31, 33, 33, 35, 5)
fill(18, 9, 19, 10, 1)

objs = []
oid = [1]
def obj(name, typ, x, y, w=0, h=0, **props):
    o = {"id": oid[0], "name": name, "type": typ, "x": x * TS, "y": y * TS, "width": w * TS, "height": h * TS,
         "rotation": 0, "visible": True,
         "properties": [{"name": k, "type": "string", "value": v} for k, v in props.items()]}
    oid[0] += 1
    objs.append(o)

def free(x, y): return g[y][x] not in (2, 6)

def clear_spot(x, y):
    g[y][x] = {1: 1, 3: 3, 4: 4, 5: 5}.get(g[y][x], 4)

obj("Start", "start", 9, 13)
obj("Stadt", "safezone", 1, 1, 18, 18)
obj("Lehrer Varn", "npc", 8, 6, kind="trainer")
obj("Händlerin Mirel", "npc", 11, 6, kind="merchant")
obj("Truhe", "npc", 9, 10, kind="stash")

def spawn(kind, n, x0, y0, x1, y1):
    placed = 0
    while placed < n:
        x, y = random.randint(x0, x1), random.randint(y0, y1)
        if free(x, y):
            obj(kind, "monster", x, y, kind=kind); placed += 1

spawn("grave_rat", 8, 21, 3, 30, 19)
spawn("bog_ghoul", 8, 31, 3, 44, 19)
spawn("wraith", 12, 4, 24, 29, 43)
spawn("bone_knight", 12, 36, 26, 60, 43)
clear_spot(58, 43)
obj("ash_king", "monster", 58, 43, kind="ash_king")

# Erreichbarkeit pruefen
sx, sy = 9, 13
seen = {(sx, sy)}; q = collections.deque([(sx, sy)])
while q:
    x, y = q.popleft()
    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx, ny = x+dx, y+dy
        if 0 <= nx < W and 0 <= ny < H and free(nx, ny) and (nx, ny) not in seen:
            seen.add((nx, ny)); q.append((nx, ny))
for o in objs:
    if o["type"] in ("monster", "npc"):
        tx, ty = o["x"] // TS, o["y"] // TS
        assert (tx, ty) in seen, f"unerreichbar: {o['name']} {tx},{ty}"

data = [g[y][x] for y in range(H) for x in range(W)]
tmj = {
    "compressionlevel": -1, "height": H, "width": W, "infinite": False, "orientation": "orthogonal",
    "renderorder": "right-down", "tilewidth": TS, "tileheight": TS, "type": "map", "version": "1.10",
    "nextlayerid": 3, "nextobjectid": oid[0],
    "tilesets": [],
    "layers": [
        {"id": 1, "name": "ground", "type": "tilelayer", "width": W, "height": H, "x": 0, "y": 0, "visible": True, "opacity": 1, "data": data},
        {"id": 2, "name": "objects", "type": "objectgroup", "x": 0, "y": 0, "visible": True, "opacity": 1, "draworder": "topdown", "objects": objs},
    ],
}
json.dump(tmj, open("src/data/aschenthron.json", "w"), ensure_ascii=False)
print("ok", len(objs), "objekte")
