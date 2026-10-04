#!/usr/bin/env python3
"""Erzeugt src/data/aschenthron.json (Tiled-JSON, orthogonal, 32px) – die Insel „Aschental“.
Gids: 1 Stadtstein, 2 Wand, 3 Sumpf, 4 Gras, 5 Dungeonboden, 6 Wasser, 7 Weg, 8 Hochland, 9 Asche,
10 Baum, 11 Fels, 12 Lava, 13 Grabstein, 14 Säule (alle blockiert).
Alles hier ist eigener Entwurf. Danach in Tiled editierbar; das Spiel liest nur die JSON-Datei."""
import json, random, collections, sys

W, H, TS = 160, 120, 32
random.seed(20261004)
g = [[6] * W for _ in range(H)]
BLOCK = {2, 6, 10, 11, 12, 13, 14}
objs, oid = [], [1]

def fill(r, gid):
    x0, y0, x1, y1 = r
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            g[y][x] = gid

def obj(name, typ, x, y, w=0, h=0, **props):
    objs.append({"id": oid[0], "name": name, "type": typ, "x": x * TS, "y": y * TS, "width": w * TS, "height": h * TS,
                 "rotation": 0, "visible": True,
                 "properties": [{"name": k, "type": "string", "value": str(v)} for k, v in props.items()]})
    oid[0] += 1

def free(x, y): return 0 <= x < W and 0 <= y < H and g[y][x] not in BLOCK

def road(pts, width=3, gid=7):
    """Weg entlang eines Linienzugs; überschreibt alles (auch Wasser = Brücke, Fels = Durchgang)."""
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        x, y = ax, ay
        while True:
            for dx in range(-(width // 2), width - width // 2):
                for dy in range(-(width // 2), width - width // 2):
                    if 0 <= x + dx < W and 0 <= y + dy < H:
                        g[y + dy][x + dx] = gid
            if (x, y) == (bx, by): break
            if x != bx: x += 1 if bx > x else -1
            elif y != by: y += 1 if by > y else -1

def ragged(r, gid, depth=3, p=0.35):
    """Unregelmäßiger Rand: Randzone zufällig zu Wasser machen (nur für Landregionen)."""
    x0, y0, x1, y1 = r
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            d = min(x - x0, x1 - x, y - y0, y1 - y)
            if d < depth and random.random() < p * (depth - d) / depth and g[y][x] == gid:
                g[y][x] = 6

def scatter(r, gid_ground, gid_obstacle, density):
    x0, y0, x1, y1 = r
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if g[y][x] == gid_ground and random.random() < density:
                g[y][x] = gid_obstacle

def blobs(r, gid_ground, gid_blob, n, size):
    x0, y0, x1, y1 = r
    for _ in range(n):
        cx, cy = random.randint(x0 + 3, x1 - 3), random.randint(y0 + 3, y1 - 3)
        rad = random.randint(2, size)
        for y in range(cy - rad, cy + rad + 1):
            for x in range(cx - rad, cx + rad + 1):
                if x0 <= x <= x1 and y0 <= y <= y1 and g[y][x] == gid_ground and (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad:
                    g[y][x] = gid_blob

# ---------- Oberfläche ----------
R = dict(
    town1=(14, 88, 33, 106), farm=(34, 80, 66, 112), forest=(14, 46, 62, 80), camp=(14, 24, 46, 44),
    swamp=(68, 62, 112, 96), town2=(68, 40, 88, 58), grave=(70, 98, 112, 114), hills=(92, 26, 130, 58),
    ash=(114, 60, 152, 92),
)
GROUND = dict(town1=1, farm=4, forest=4, camp=7, swamp=3, town2=1, grave=4, hills=8, ash=9)
for k, r in R.items():
    fill(r, GROUND[k])
    if k not in ('town1', 'town2'):
        ragged(r, GROUND[k])

scatter(R['farm'], 4, 10, 0.03); scatter(R['farm'], 4, 11, 0.01)
scatter(R['forest'], 4, 10, 0.20)
scatter(R['camp'], 7, 11, 0.04); scatter(R['camp'], 7, 10, 0.03)
blobs(R['swamp'], 3, 6, 14, 3); scatter(R['swamp'], 3, 10, 0.04)
scatter(R['grave'], 4, 13, 0.09); scatter(R['grave'], 4, 10, 0.02)
scatter(R['hills'], 8, 11, 0.12); scatter(R['hills'], 8, 10, 0.02)
blobs(R['ash'], 9, 12, 12, 3); scatter(R['ash'], 9, 11, 0.10)

# Städte: Mauern mit Toren, Häuser als Blöcke
def town(r, gates):
    x0, y0, x1, y1 = r
    for x in range(x0, x1 + 1):
        g[y0][x] = g[y1][x] = 2
    for y in range(y0, y1 + 1):
        g[y][x0] = g[y][x1] = 2
    for gx, gy in gates:
        for d in range(-1, 2):
            if gx in (x0, x1): g[gy + d][gx] = 1
            else: g[gy][gx + d] = 1
town(R['town1'], [(33, 97), (23, 88)])
town(R['town2'], [(68, 49), (78, 58), (88, 49), (78, 40)])
for hx, hy, hw, hh in [(16, 90, 4, 3), (25, 90, 5, 3), (16, 100, 5, 3), (27, 100, 4, 3),
                       (70, 42, 4, 3), (82, 42, 4, 3), (70, 52, 4, 3), (82, 52, 4, 3)]:
    fill((hx, hy, hx + hw - 1, hy + hh - 1), 2)

# Wege (Verbindungen zwischen allen Gebieten)
road([(33, 97), (50, 97), (50, 64)])
road([(50, 64), (50, 48), (30, 48), (30, 40)])
road([(23, 88), (23, 84), (50, 84)])
road([(62, 70), (68, 70)])
road([(78, 63), (78, 58)])
road([(66, 106), (74, 106)])
road([(90, 95), (90, 99)])
road([(88, 49), (96, 49)])
road([(112, 76), (116, 76)])
road([(122, 58), (122, 62)])
road([(112, 106), (116, 106)])
road([(78, 40), (78, 31)])
road([(130, 42), (134, 42)])
road([(110, 26), (110, 21)])
road([(46, 34), (70, 34), (78, 34)])  # Räuberlager → Gruftweg
road([(60, 70), (68, 70)])

# ---------- Dungeons ----------
def dungeon(box, entrance, cell=(11, 9), room=(8, 6), pillars=0.05, loops=3):
    x0, y0, x1, y1 = box
    fill(box, 2)
    cols, rows = (x1 - x0 - 2) // cell[0], (y1 - y0 - 2) // cell[1]
    rooms = {}
    for c in range(cols):
        for r in range(rows):
            rx, ry = x0 + 2 + c * cell[0], y0 + 2 + r * cell[1]
            rooms[(c, r)] = (rx, ry, rx + room[0] - 1, ry + room[1] - 1)
            fill(rooms[(c, r)], 5)
    def connect(a, b):
        ax0, ay0, ax1, ay1 = rooms[a]; bx0, by0, bx1, by1 = rooms[b]
        acx, acy, bcx, bcy = (ax0 + ax1) // 2, (ay0 + ay1) // 2, (bx0 + bx1) // 2, (by0 + by1) // 2
        road([(acx, acy), (bcx, acy), (bcx, bcy)], width=2, gid=5)
    keys = list(rooms)
    seen = {keys[0]}; stack = [keys[0]]; edges = []
    while stack:
        cur = stack[-1]
        nb = [(cur[0] + dx, cur[1] + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (cur[0] + dx, cur[1] + dy) in rooms and (cur[0] + dx, cur[1] + dy) not in seen]
        if nb:
            n = random.choice(nb); seen.add(n); stack.append(n); edges.append((cur, n))
        else: stack.pop()
    for a, b in edges: connect(a, b)
    for _ in range(loops):
        a = random.choice(keys); dx, dy = random.choice(((1, 0), (0, 1)))
        b = (a[0] + dx, a[1] + dy)
        if b in rooms: connect(a, b)
    for k, (rx0, ry0, rx1, ry1) in rooms.items():
        for y in range(ry0 + 1, ry1):
            for x in range(rx0 + 1, rx1):
                if g[y][x] == 5 and random.random() < pillars and abs(x - (rx0 + rx1) // 2) > 1 and abs(y - (ry0 + ry1) // 2) > 1:
                    g[y][x] = 14
    # Eingang: nächster Raum zum Eintrittspunkt
    ex, ey = entrance
    ent = min(rooms, key=lambda k: abs((rooms[k][0] + rooms[k][2]) // 2 - ex) + abs((rooms[k][1] + rooms[k][3]) // 2 - ey))
    ecx, ecy = (rooms[ent][0] + rooms[ent][2]) // 2, (rooms[ent][1] + rooms[ent][3]) // 2
    road([(ex, ey), (ex, ecy), (ecx, ecy)], width=3, gid=5)
    # Bossraum = weitester Raum (Pfadlänge im Raumgraphen)
    adj = collections.defaultdict(list)
    for a, b in edges: adj[a].append(b); adj[b].append(a)
    dist = {ent: 0}; q = collections.deque([ent])
    while q:
        c = q.popleft()
        for n in adj[c]:
            if n not in dist: dist[n] = dist[c] + 1; q.append(n)
    boss = max(dist, key=dist.get)
    return rooms, ent, boss

def room_center(r): return (r[0] + r[2]) // 2, (r[1] + r[3]) // 2

DUNGEONS = {
    'sumpf': dict(box=(48, 4, 92, 30), entrance=(78, 31)),
    'kata': dict(box=(114, 94, 152, 114), entrance=(114, 106)),
    'mine': dict(box=(134, 26, 156, 58), entrance=(134, 42)),
    'thron': dict(box=(96, 4, 154, 22), entrance=(110, 22)),
}
dg = {}
for name, d in DUNGEONS.items():
    dg[name] = dungeon(d['box'], d['entrance'])
    # Eingangsweg bis zur Oberfläche offen lassen
road([(78, 40), (78, 29)], width=3, gid=7)

# ---------- Objekte ----------
obj("Start", "start", 22, 99)
obj("Aschenhafen", "townstart", 22, 99)
obj("Felsenwacht", "townstart", 78, 50)
obj("Aschenhafen", "safezone", 13, 87, 22, 21)
obj("Felsenwacht", "safezone", 67, 39, 23, 21)
# Zonen (für Namensanzeige und Minikarte): Name, Rechteck, Level-Spanne
for nm, r, lv in [("Aschenhafen", (13, 87, 34, 108), "Stadt"), ("Roggenfelder", (35, 80, 66, 112), "1-3"),
                  ("Düsterwald", (14, 46, 62, 79), "3-7"), ("Räuberlager", (14, 24, 46, 44), "8-12"),
                  ("Moorlande", (68, 62, 112, 96), "6-11"), ("Felsenwacht", (67, 39, 90, 60), "Stadt"),
                  ("Totenacker", (70, 98, 112, 114), "9-13"), ("Hochland", (92, 26, 130, 58), "13-19"),
                  ("Aschenöde", (114, 60, 152, 92), "21-29"),
                  ("Gruft der Moorhexe", DUNGEONS['sumpf']['box'], "10-16"), ("Katakomben", DUNGEONS['kata']['box'], "13-18"),
                  ("Tiefenmine", DUNGEONS['mine']['box'], "17-22"), ("Thron der Asche", DUNGEONS['thron']['box'], "26-30")]:
    obj(nm, "region", r[0], r[1], r[2] - r[0] + 1, r[3] - r[1] + 1, levels=lv)
# NPCs Aschenhafen
obj("Lehrer Varn", "npc", 20, 94, kind="trainer", tier=1)
obj("Händlerin Mirel", "npc", 24, 94, kind="merchant", shop="basic")
obj("Truhe", "npc", 20, 98, kind="stash")
obj("Schmiedin Ilse", "npc", 28, 96, kind="smith")
obj("Hauptmann Brandt", "npc", 30, 94, kind="quest", quests="q_rats,q_hounds,q_bandits,q_spiders")
obj("Kräuterfrau Odda", "npc", 17, 96, kind="quest", quests="q_herbs,q_ghouls")
# NPCs Felsenwacht
obj("Meisterin Kjorra", "npc", 74, 46, kind="trainer", tier=2)
obj("Händler Dorn", "npc", 80, 46, kind="merchant", shop="advanced")
obj("Truhe", "npc", 78, 52, kind="stash")
obj("Schmied Torgal", "npc", 72, 50, kind="smith")
obj("Wachführerin Tessa", "npc", 84, 50, kind="quest", quests="q_harkon,q_wraiths,q_veshra,q_trolls")
obj("Späher Ruven", "npc", 78, 44, kind="quest", quests="q_mine,q_ash,q_katacombs,q_king")

# Monster
SPAWN_BUFFER = 8
SPACING = 4   # Mindestabstand zwischen Monstern (vermeidet Massen-Aggro)
DENSITY = 1.0  # Anteil der Monster pro Patch
safe_rects = [(13, 87, 34, 108), (67, 39, 90, 60)]
def in_safe(x, y, pad=0):
    return any(a - pad <= x <= b + pad and c - pad <= y <= d + pad for a, c, b, d in safe_rects)
taken = []
def spawn(kind, n, r, ground=None, pad=SPAWN_BUFFER, tries=4000):
    x0, y0, x1, y1 = r
    n = max(1, round(n * DENSITY))
    placed, t = 0, 0
    while placed < n and t < tries:
        t += 1
        x, y = random.randint(x0, x1), random.randint(y0, y1)
        if not free(x, y) or (ground is not None and g[y][x] not in ground): continue
        if in_safe(x, y, pad) or any(abs(x - a) < SPACING and abs(y - b) < SPACING for a, b in taken): continue
        taken.append((x, y)); obj(kind, "monster", x, y, kind=kind); placed += 1
    if placed < n: print("WARN nur", placed, "von", n, kind, r, file=sys.stderr)

# Roggenfelder L1-3 (nahe der Stadt nur Stufe 1)
spawn('field_rat', 14, (36, 92, 66, 110), (4,))
spawn('field_rat', 10, (36, 82, 66, 92), (4,))
spawn('wild_hound', 12, (44, 82, 66, 106), (4,))
spawn('bandit_novice', 6, (50, 80, 66, 90), (4,))
# Düsterwald L3-7
spawn('wild_hound', 10, (16, 62, 62, 80), (4,))
spawn('bandit_novice', 10, (16, 62, 62, 80), (4,))
spawn('forest_spider', 18, (16, 46, 62, 66), (4,))
spawn('highwayman', 8, (16, 46, 62, 62), (4,))
# Räuberlager L8-12
spawn('highwayman', 16, (16, 26, 44, 43), (7, 4))
spawn('bandit_novice', 6, (16, 26, 44, 43), (7, 4))
obj("Räuberfürst Harkon", "monster", 30, 28, kind="bandit_lord"); taken.append((30, 28))
fill((28, 26, 32, 30), 7)
# Moorlande L6-11
spawn('bog_ghoul', 26, (70, 64, 110, 94), (3,))
spawn('bog_witch', 10, (84, 64, 110, 94), (3,))
spawn('wraith', 6, (70, 64, 90, 94), (3,))
# Totenacker L9-13
spawn('wraith', 20, (72, 100, 110, 112), (4,))
spawn('bone_knight', 12, (86, 100, 110, 112), (4,))
# Hochland L13-19
spawn('hill_troll', 20, (94, 28, 128, 56), (8,))
spawn('stone_golem', 14, (104, 28, 128, 56), (8,))
spawn('shadow_wolf', 16, (94, 28, 128, 56), (8,))
# Aschenöde L21-29
spawn('ash_walker', 18, (116, 62, 150, 90), (9,))
spawn('cinder_wisp', 16, (126, 62, 150, 90), (9,))
spawn('death_knight', 10, (132, 66, 150, 90), (9,))
spawn('hell_spawn', 8, (140, 70, 150, 90), (9,))

def dungeon_spawns(name, kinds, per_room, boss_kind, guards=None):
    rooms, ent, boss = dg[name]
    for k, r in rooms.items():
        if k == ent: continue
        if k == boss:
            cx, cy = room_center(r)
            obj(boss_kind, "monster", cx, cy, kind=boss_kind); taken.append((cx, cy))
            for gk in (guards or []):
                spawn(gk, 2, r, (5,), pad=0)
            continue
        for kind in random.sample(kinds, k=min(len(kinds), per_room)):
            spawn(kind, random.randint(2, 4), r, (5,), pad=0)
    return room_center(rooms[boss])

dungeon_spawns('sumpf', ['bog_ghoul', 'wraith', 'bog_witch'], 2, 'bog_queen', ['bog_witch'])
dungeon_spawns('kata', ['bone_knight', 'wraith', 'hill_troll'], 2, 'bone_lord', ['bone_knight'])
dungeon_spawns('mine', ['pit_worm', 'stone_golem', 'hill_troll'], 2, 'stone_colossus')
dungeon_spawns('thron', ['death_knight', 'hell_spawn', 'cinder_wisp'], 2, 'ash_king', ['hell_spawn'])

# ---------- Prüfung ----------
sx, sy = 22, 99
seen = {(sx, sy)}; q = collections.deque([(sx, sy)])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if free(nx, ny) and (nx, ny) not in seen:
            seen.add((nx, ny)); q.append((nx, ny))
bad = [o for o in objs if o["type"] in ("monster", "npc") and (o["x"] // TS, o["y"] // TS) not in seen]
if bad:
    for o in bad[:20]: print("UNERREICHBAR", o["name"], o["x"] // TS, o["y"] // TS, file=sys.stderr)
    # Unerreichbare Monster entfernen, Bosse/NPCs nicht -> Abbruch
    crit = [o for o in bad if o["type"] == "npc" or o["name"] in ("Räuberfürst Harkon", "Moorhexe Veshra", "Aschenkönig", "Steinkoloss", "Knochenfürst Morrik")]
    if crit: sys.exit("kritische Objekte unerreichbar: " + ", ".join(o["name"] for o in crit))
    ids = {o["id"] for o in bad}; objs[:] = [o for o in objs if o["id"] not in ids]
    print("entfernt:", len(bad), "unerreichbare Monster", file=sys.stderr)

tmj = {"compressionlevel": -1, "height": H, "width": W, "infinite": False, "orientation": "orthogonal", "renderorder": "right-down",
       "tilewidth": TS, "tileheight": TS, "type": "map", "version": "1.10", "nextlayerid": 3, "nextobjectid": oid[0], "tilesets": [],
       "layers": [{"id": 1, "name": "ground", "type": "tilelayer", "width": W, "height": H, "x": 0, "y": 0, "visible": True, "opacity": 1,
                   "data": [g[y][x] for y in range(H) for x in range(W)]},
                  {"id": 2, "name": "objects", "type": "objectgroup", "x": 0, "y": 0, "visible": True, "opacity": 1, "draworder": "topdown", "objects": objs}]}
json.dump(tmj, open("src/data/aschenthron.json", "w"), ensure_ascii=False)
mons = [o for o in objs if o["type"] == "monster"]
print("ok:", len(mons), "Monster,", sum(1 for o in objs if o["type"] == "npc"), "NPCs, erreichbare Tiles:", len(seen))
if "--preview" in sys.argv:
    ch = {1: 'T', 2: '#', 3: '~', 4: '.', 5: '_', 6: ' ', 7: '=', 8: ',', 9: ':', 10: 'f', 11: 'o', 12: '!', 13: 't', 14: 'i'}
    for y in range(0, H, 2):
        print(''.join(ch[g[y][x]] for x in range(0, W, 2)))
