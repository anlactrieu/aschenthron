#!/usr/bin/env python3
"""Erzeugt src/data/aschenthron.json (Tiled-JSON, orthogonal, 32px) – die Insel „Aschental“ (Version 3).
Gids: 1 Stadtstein, 2 Wand, 3 Sumpf, 4 Gras, 5 Dungeonboden, 6 Wasser, 7 Weg, 8 Hochland, 9 Asche,
10 Baum, 11 Fels, 12 Lava, 13 Grabstein, 14 Säule (alle blockiert außer 1,3,4,5,7,8,9).
Monster stehen in Rudeln (1–5, mit Anführer einer höheren Stufe). Je weiter vom Zoneneingang, desto stärker.
Alles hier ist eigener Entwurf. Danach in Tiled editierbar; das Spiel liest nur die JSON-Datei."""
import json, random, collections, sys

S = 1.5                                  # Skalierung gegenüber dem ersten Entwurf (160x120)
W, H, TS = 240, 180, 32
random.seed(20261005)
g = [[6] * W for _ in range(H)]
BLOCK = {2, 6, 10, 11, 12, 13, 14}
objs, oid = [], [1]
pack_counter = [0]

def sc(v): return int(round(v * S))

def fill(r, gid):
    x0, y0, x1, y1 = r
    for y in range(max(0, y0), min(H - 1, y1) + 1):
        for x in range(max(0, x0), min(W - 1, x1) + 1):
            g[y][x] = gid

def obj(name, typ, x, y, w=0, h=0, **props):
    objs.append({"id": oid[0], "name": name, "type": typ, "x": x * TS, "y": y * TS, "width": w * TS, "height": h * TS,
                 "rotation": 0, "visible": True,
                 "properties": [{"name": k, "type": "string", "value": str(v)} for k, v in props.items()]})
    oid[0] += 1

def free(x, y): return 0 <= x < W and 0 <= y < H and g[y][x] not in BLOCK

def road(pts, width=3, gid=7):
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

def ragged(r, gid, depth=4, p=0.4):
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

# ---------------------------------------------------------------- Oberfläche
def R(a, b, c, d): return (sc(a), sc(b), sc(c), sc(d))
ZONES = dict(
    farm=R(34, 80, 66, 112), forest=R(14, 46, 62, 80), camp=R(14, 24, 46, 44), swamp=R(68, 62, 112, 96),
    grave=R(70, 98, 112, 114), hills=R(92, 26, 130, 58), ash=R(114, 60, 152, 92),
)
GROUND = dict(farm=4, forest=4, camp=7, swamp=3, grave=4, hills=8, ash=9)
TOWN1 = (21, 132, 41, 151)      # Aschenhafen (20x20)
TOWN2 = (103, 60, 124, 80)      # Felsenwacht (22x21)
for k, r in ZONES.items():
    fill(r, GROUND[k]); ragged(r, GROUND[k])
fill(TOWN1, 1); fill(TOWN2, 1)

def area(r): return (r[2] - r[0]) * (r[3] - r[1])
scatter(ZONES['farm'], 4, 10, 0.03); scatter(ZONES['farm'], 4, 11, 0.01)
scatter(ZONES['forest'], 4, 10, 0.20)
scatter(ZONES['camp'], 7, 11, 0.04); scatter(ZONES['camp'], 7, 10, 0.03)
blobs(ZONES['swamp'], 3, 6, 30, 4); scatter(ZONES['swamp'], 3, 10, 0.04)
scatter(ZONES['grave'], 4, 13, 0.09); scatter(ZONES['grave'], 4, 10, 0.02)
scatter(ZONES['hills'], 8, 11, 0.12); scatter(ZONES['hills'], 8, 10, 0.02)
blobs(ZONES['ash'], 9, 12, 26, 4); scatter(ZONES['ash'], 9, 11, 0.10)

def town(r, gates):
    x0, y0, x1, y1 = r
    for x in range(x0, x1 + 1): g[y0][x] = g[y1][x] = 2
    for y in range(y0, y1 + 1): g[y][x0] = g[y][x1] = 2
    for gx, gy in gates:
        for d in range(-1, 2):
            if gx in (x0, x1): g[gy + d][gx] = 1
            else: g[gy][gx + d] = 1
t1x, t1y = TOWN1[0], TOWN1[1]
t2x, t2y = TOWN2[0], TOWN2[1]
T1_E = (TOWN1[2], (TOWN1[1] + TOWN1[3]) // 2)      # Osttor
T1_N = ((TOWN1[0] + TOWN1[2]) // 2, TOWN1[1])      # Nordtor
T2_W = (TOWN2[0], (TOWN2[1] + TOWN2[3]) // 2)
T2_S = ((TOWN2[0] + TOWN2[2]) // 2, TOWN2[3])
T2_E = (TOWN2[2], (TOWN2[1] + TOWN2[3]) // 2)
T2_N = ((TOWN2[0] + TOWN2[2]) // 2, TOWN2[1])
town(TOWN1, [T1_E, T1_N]); town(TOWN2, [T2_W, T2_S, T2_E, T2_N])
for ox, oy, hw, hh in [(2, 2, 4, 3), (11, 2, 5, 3), (2, 12, 5, 3), (13, 12, 4, 3)]:
    fill((t1x + ox, t1y + oy, t1x + ox + hw - 1, t1y + oy + hh - 1), 2)
for ox, oy, hw, hh in [(2, 2, 4, 3), (14, 2, 4, 3), (2, 15, 4, 3), (14, 15, 4, 3)]:
    fill((t2x + ox, t2y + oy, t2x + ox + hw - 1, t2y + oy + hh - 1), 2)

def P(x, y): return (sc(x), sc(y))
# Wege
road([T1_E, (sc(50), T1_E[1]), P(50, 64)])
road([P(50, 64), P(50, 48), P(30, 48), P(30, 40)])
road([T1_N, (T1_N[0], sc(84)), P(50, 84)])
road([P(62, 70), P(68, 70)])
road([P(60, 70), P(68, 70)])
road([(T2_S[0], sc(63)), T2_S])
road([P(66, 106), P(74, 106)])
road([P(90, 95), P(90, 99)])
road([T2_E, P(96, T2_E[1] / S)])
road([P(112, 76), P(116, 76)])
road([P(122, 58), P(122, 62)])
road([P(112, 106), P(116, 106)])
road([P(130, 42), P(134, 42)])
road([P(110, 26), P(110, 21)])
road([P(46, 34), P(70, 34), (T2_N[0], P(70, 34)[1])])

# --------------------------------------------------------------- Dungeons
def dungeon(box, entrance, cell=(11, 9), room=(8, 6), pillars=0.05, loops=4):
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
    ex, ey = entrance
    ent = min(rooms, key=lambda k: abs((rooms[k][0] + rooms[k][2]) // 2 - ex) + abs((rooms[k][1] + rooms[k][3]) // 2 - ey))
    ecx, ecy = (rooms[ent][0] + rooms[ent][2]) // 2, (rooms[ent][1] + rooms[ent][3]) // 2
    road([(ex, ey), (ex, ecy), (ecx, ecy)], width=3, gid=5)
    adj = collections.defaultdict(list)
    for a, b in edges: adj[a].append(b); adj[b].append(a)
    dist = {ent: 0}; q = collections.deque([ent])
    while q:
        c = q.popleft()
        for n in adj[c]:
            if n not in dist: dist[n] = dist[c] + 1; q.append(n)
    boss = max(dist, key=dist.get)
    return rooms, ent, boss, dist

def room_center(r): return (r[0] + r[2]) // 2, (r[1] + r[3]) // 2

DUNGEONS = {
    'sumpf': dict(box=(sc(48), 4, sc(92), sc(30)), entrance=(T2_N[0], sc(31))),
    'kata': dict(box=(sc(114), sc(94), sc(152), sc(114)), entrance=P(114, 106)),
    'mine': dict(box=(sc(134), sc(26), sc(156), sc(58)), entrance=P(134, 42)),
    'thron': dict(box=(sc(96), 4, sc(154), sc(22)), entrance=P(110, 22)),
}
dg = {}
for name, d in DUNGEONS.items():
    dg[name] = dungeon(d['box'], d['entrance'])
road([T2_N, (T2_N[0], sc(29))], width=3, gid=7)

# ------------------------------------------------------------------ Objekte
START = (t1x + 10, t1y + 12)
obj("Start", "start", *START)
obj("Aschenhafen", "townstart", *START)
obj("Felsenwacht", "townstart", t2x + 11, t2y + 10)
obj("Aschenhafen", "safezone", TOWN1[0] - 1, TOWN1[1] - 1, TOWN1[2] - TOWN1[0] + 3, TOWN1[3] - TOWN1[1] + 3)
obj("Felsenwacht", "safezone", TOWN2[0] - 1, TOWN2[1] - 1, TOWN2[2] - TOWN2[0] + 3, TOWN2[3] - TOWN2[1] + 3)

ZONE_INFO = [("Aschenhafen", (TOWN1[0] - 1, TOWN1[1] - 1, TOWN1[2] + 1, TOWN1[3] + 1), "Stadt"),
             ("Roggenfelder", ZONES['farm'], "1-5"), ("Düsterwald", ZONES['forest'], "3-10"),
             ("Räuberlager", ZONES['camp'], "7-13"), ("Moorlande", ZONES['swamp'], "6-15"),
             ("Felsenwacht", (TOWN2[0] - 1, TOWN2[1] - 1, TOWN2[2] + 1, TOWN2[3] + 1), "Stadt"),
             ("Totenacker", ZONES['grave'], "8-18"), ("Hochland", ZONES['hills'], "11-22"), ("Aschenöde", ZONES['ash'], "21-29"),
             ("Gruft der Moorhexe", DUNGEONS['sumpf']['box'], "10-16"), ("Katakomben", DUNGEONS['kata']['box'], "13-18"),
             ("Tiefenmine", DUNGEONS['mine']['box'], "17-23"), ("Thron der Asche", DUNGEONS['thron']['box'], "26-30")]
for nm, r, lv in ZONE_INFO:
    obj(nm, "region", r[0], r[1], r[2] - r[0] + 1, r[3] - r[1] + 1, levels=lv)

def npc(name, dx, dy, tx, ty, **props): obj(name, "npc", tx + dx, ty + dy, **props)
npc("Lehrer Varn", 7, 6, t1x, t1y, kind="trainer", tier=1)
npc("Händlerin Mirel", 11, 6, t1x, t1y, kind="merchant", shop="basic")
npc("Truhe", 9, 10, t1x, t1y, kind="stash")
npc("Schmiedin Ilse", 14, 9, t1x, t1y, kind="smith")
npc("Hauptmann Brandt", 16, 6, t1x, t1y, kind="quest", quests="q_rats,q_hounds,q_goblins,q_bandits,q_spiders,q_goblin_scouts")
npc("Kräuterfrau Odda", 4, 9, t1x, t1y, kind="quest", quests="q_herbs,q_ghouls")
npc("Meisterin Kjorra", 5, 7, t2x, t2y, kind="trainer", tier=2)
npc("Händler Dorn", 12, 7, t2x, t2y, kind="merchant", shop="advanced")
npc("Truhe", 11, 12, t2x, t2y, kind="stash")
npc("Schmied Torgal", 3, 11, t2x, t2y, kind="smith")
npc("Wachführerin Tessa", 16, 11, t2x, t2y, kind="quest", quests="q_harkon,q_goblin_king,q_wraiths,q_veshra,q_trolls")
npc("Späher Ruven", 11, 5, t2x, t2y, kind="quest", quests="q_mine,q_ash,q_katacombs,q_king")

safe_rects = [(TOWN1[0] - 1, TOWN1[1] - 1, TOWN1[2] + 1, TOWN1[3] + 1), (TOWN2[0] - 1, TOWN2[1] - 1, TOWN2[2] + 1, TOWN2[3] + 1)]
def in_safe(x, y, pad=0):
    return any(a - pad <= x <= b + pad and c - pad <= y <= d + pad for a, c, b, d in safe_rects)

SPAWN_BUFFER = 12
taken = []
def place_ok(x, y, ground, pad, gap):
    if not free(x, y) or (ground is not None and g[y][x] not in ground): return False
    if in_safe(x, y, pad): return False
    return not any(abs(x - a) < gap and abs(y - b) < gap for a, b in taken)

def spawn_pack(kinds, x, y, ground, size, leader=None, gap=3):
    """Ein Rudel um (x,y): Anführer (falls angegeben) und size-1 Mitglieder in 3 Tiles Umkreis."""
    pack_counter[0] += 1
    pid = pack_counter[0]
    members = []
    cx, cy = x, y
    members.append((leader or random.choice(kinds), cx, cy))
    tries = 0
    while len(members) < size and tries < 60:
        tries += 1
        mx, my = cx + random.randint(-3, 3), cy + random.randint(-3, 3)
        if free(mx, my) and (ground is None or g[my][mx] in ground) and not in_safe(mx, my) and not any(abs(mx - a) < 2 and abs(my - b) < 2 for _, a, b in members):
            members.append((random.choice(kinds), mx, my))
    for kind, mx, my in members:
        obj(kind, "monster", mx, my, kind=kind, pack=pid)
        taken.append((mx, my))
    return len(members)

def zone_packs(zone, entry, bands, n_packs, ground):
    """bands: [(f_max, [(kind, gewicht)...], leader_kind|None)] nach Entfernung vom Eingang (0..1)."""
    x0, y0, x1, y1 = zone
    far = max(abs(entry[0] - x0), abs(entry[0] - x1)) + max(abs(entry[1] - y0), abs(entry[1] - y1))
    placed, tries, total = 0, 0, 0
    while placed < n_packs and tries < n_packs * 60:
        tries += 1
        x, y = random.randint(x0, x1), random.randint(y0, y1)
        if not place_ok(x, y, ground, SPAWN_BUFFER, 6): continue
        f = (abs(x - entry[0]) + abs(y - entry[1])) / far
        band = next((b for b in bands if f <= b[0]), bands[-1])
        kinds = [k for k, w in band[1] for _ in range(w)]
        size = random.choices([1, 2, 3, 4, 5], weights=[3, 4, 4, 3, 2] if f < 0.7 else [3, 4, 3, 2, 1])[0]
        leader = band[2] if band[2] and size >= 3 and random.random() < 0.5 else None
        total += spawn_pack(kinds, x, y, ground, size, leader)
        placed += 1
    if placed < n_packs: print("WARN nur", placed, "von", n_packs, "Rudeln in", zone, file=sys.stderr)
    return total

E = lambda x, y: P(x, y)
# Roggenfelder L1-5: Ratten und Hunde am Eingang, Goblins weiter hinten
zone_packs(ZONES['farm'], T1_E, [
    (0.30, [('field_rat', 5), ('wild_hound', 2)], 'wild_hound'),
    (0.60, [('wild_hound', 3), ('burrow_rat', 3), ('goblin', 2)], 'goblin_scout'),
    (1.00, [('goblin', 3), ('feral_hound', 2), ('giant_rat', 2), ('goblin_scout', 3)], 'goblin_scout')], 26, (4,))
# Düsterwald L3-10: Goblins in Stufen, Spinnen, Banditen-Späher
zone_packs(ZONES['forest'], P(50, 80), [
    (0.25, [('goblin', 4), ('feral_hound', 2), ('forest_spider', 2)], 'goblin_scout'),
    (0.55, [('goblin_scout', 4), ('forest_spider', 3), ('bandit_novice', 2)], 'goblin_warrior'),
    (0.80, [('goblin_warrior', 3), ('wolf', 2), ('venom_spider', 2), ('highwayman', 2)], 'goblin_shaman'),
    (1.00, [('goblin_warrior', 3), ('goblin_shaman', 2), ('venom_spider', 2), ('wolf', 2)], 'goblin_chief')], 30, (4,))
# Goblinkönig im Düsterwald (tief im Wald)
gk = (sc(22), sc(50))
for _ in range(200):
    gx, gy = random.randint(sc(16), sc(30)), random.randint(sc(50), sc(60))
    if place_ok(gx, gy, (4,), 0, 2):
        fill((gx - 2, gy - 2, gx + 2, gy + 2), 4); obj("Goblinkönig Grix", "monster", gx, gy, kind="goblin_king", pack=0); taken.append((gx, gy)); break
# Räuberlager L7-13
zone_packs(ZONES['camp'], P(30, 44), [
    (0.45, [('highwayman', 3), ('bandit', 3), ('bandit_novice', 1)], 'bandit'),
    (1.00, [('bandit', 4), ('highwayman', 2), ('goblin_shaman', 1)], 'bandit_captain')], 12, (7, 4))
bl = (sc(30), sc(28))
fill((bl[0] - 3, bl[1] - 3, bl[0] + 3, bl[1] + 3), 7); obj("Räuberfürst Harkon", "monster", bl[0], bl[1], kind="bandit_lord", pack=0); taken.append(bl)
# Moorlande L6-15
zone_packs(ZONES['swamp'], P(78, 62), [
    (0.30, [('bog_ghoul', 5), ('giant_rat', 1)], 'marsh_corpse'),
    (0.65, [('bog_ghoul', 3), ('marsh_corpse', 3), ('bog_witch', 1)], 'bog_witch'),
    (1.00, [('marsh_corpse', 3), ('bog_witch', 2), ('ghoul_alpha', 2), ('wraith', 1)], 'ghoul_alpha')], 28, (3,))
# Totenacker L8-18
zone_packs(ZONES['grave'], P(90, 98), [
    (0.30, [('skeleton', 4), ('wraith', 2)], 'zombie'),
    (0.60, [('skeleton', 3), ('zombie', 3), ('wraith', 2)], 'bone_knight'),
    (1.00, [('zombie', 3), ('bone_knight', 3), ('crypt_guard', 1)], 'crypt_guard')], 22, (4,))
# Hochland L11-22
zone_packs(ZONES['hills'], P(92, 49), [
    (0.30, [('wolf', 3), ('dire_wolf', 3), ('hill_troll', 1)], 'dire_wolf'),
    (0.65, [('dire_wolf', 3), ('hill_troll', 3), ('stone_golem', 2)], 'hill_troll'),
    (1.00, [('rock_troll', 3), ('stone_golem', 3), ('shadow_wolf', 2)], 'rock_troll')], 28, (8,))
# Aschenöde L21-29
zone_packs(ZONES['ash'], P(114, 76), [
    (0.30, [('ash_walker', 4), ('shadow_wolf', 2), ('imp', 1)], 'ash_walker'),
    (0.60, [('ash_walker', 3), ('cinder_wisp', 3), ('night_stalker', 2), ('imp', 2)], 'cinder_wisp'),
    (1.00, [('cinder_wisp', 3), ('death_knight', 2), ('ember_elemental', 3), ('hell_spawn', 2), ('imp', 2)], 'hell_spawn')], 26, (9,))

def dungeon_spawns(name, bands, boss_kind, guards=None, per_room=(1, 2)):
    rooms, ent, boss, dist = dg[name]
    maxd = max(dist.values()) or 1
    for k, r in rooms.items():
        if k == ent: continue
        if k == boss:
            cx, cy = room_center(r)
            obj(boss_kind, "monster", cx, cy, kind=boss_kind, pack=0); taken.append((cx, cy))
            for gk in (guards or []):
                for _ in range(2):
                    for _t in range(30):
                        x, y = random.randint(r[0], r[2]), random.randint(r[1], r[3])
                        if place_ok(x, y, (5,), 0, 2):
                            obj(gk, "monster", x, y, kind=gk, pack=0); taken.append((x, y)); break
            continue
        f = dist.get(k, maxd) / maxd
        band = next((b for b in bands if f <= b[0]), bands[-1])
        kinds = [kk for kk, w in band[1] for _ in range(w)]
        for _ in range(random.randint(*per_room)):
            for _t in range(40):
                x, y = random.randint(r[0] + 1, r[2] - 1), random.randint(r[1] + 1, r[3] - 1)
                if place_ok(x, y, (5,), 0, 3):
                    spawn_pack(kinds, x, y, (5,), random.randint(1, 4), band[2]); break
    return room_center(rooms[boss])

dungeon_spawns('sumpf', [(0.4, [('marsh_corpse', 3), ('bog_witch', 1), ('wraith', 1)], 'bog_witch'), (1.0, [('bog_witch', 2), ('ghoul_alpha', 3), ('wraith', 2)], 'ghoul_alpha')], 'bog_queen', ['bog_witch'])
dungeon_spawns('kata', [(0.4, [('skeleton', 3), ('zombie', 2), ('wraith', 1)], 'bone_knight'), (1.0, [('bone_knight', 3), ('crypt_guard', 3), ('zombie', 1)], 'crypt_guard')], 'bone_lord', ['bone_knight'])
dungeon_spawns('mine', [(0.35, [('cave_spider', 3), ('pit_worm', 2), ('stone_golem', 1)], 'pit_worm'), (0.7, [('pit_worm', 3), ('rock_troll', 2), ('iron_golem', 2), ('cave_spider', 2)], 'iron_golem'), (1.0, [('iron_golem', 3), ('acid_worm', 3), ('rock_troll', 2)], 'acid_worm')], 'stone_colossus', ['iron_golem'])
dungeon_spawns('thron', [(0.4, [('imp', 3), ('death_knight', 2), ('ember_elemental', 1)], 'death_knight'), (1.0, [('death_knight', 3), ('ember_elemental', 2), ('hell_spawn', 3), ('imp', 2)], 'hell_spawn')], 'ash_king', ['hell_spawn'])

# Webmutter in der Tiefenmine (eigener Raum nahe dem Ende)
rooms, ent, boss, dist = dg['mine']
cand = sorted((k for k in rooms if k not in (ent, boss)), key=lambda k: -dist.get(k, 0))
if cand:
    r = rooms[cand[0]]; cx, cy = room_center(r)
    obj("Webmutter Skarra", "monster", cx, cy, kind="web_mother", pack=0); taken.append((cx, cy))

# -------------------------------------------------------------------- Truhen
CHEST_COUNT = {}
ctaken = []
def chest(x, y, level, tier):
    obj("Truhe", "chest", x, y, level=level, tier=tier)
    ctaken.append((x, y))
    CHEST_COUNT[tier] = CHEST_COUNT.get(tier, 0) + 1

def zone_chests(zone, ground, n, levels, tiers, entry):
    """Truhen abseits der Wege: Standort mit mindestens 5 freien Nachbarn, nie in Stadtnähe."""
    x0, y0, x1, y1 = zone
    far = max(abs(entry[0] - x0), abs(entry[0] - x1)) + max(abs(entry[1] - y0), abs(entry[1] - y1))
    placed, tries = 0, 0
    while placed < n and tries < 4000:
        tries += 1
        x, y = random.randint(x0, x1), random.randint(y0, y1)
        if not free(x, y) or (ground and g[y][x] not in ground) or in_safe(x, y, 10) or g[y][x] == 7: continue
        if sum(1 for dx in (-1, 0, 1) for dy in (-1, 0, 1) if free(x + dx, y + dy)) < 6: continue
        if any(abs(x - a) < 3 and abs(y - b) < 3 for a, b in taken) or any(abs(x - a) < 14 and abs(y - b) < 14 for a, b in ctaken): continue
        f = min(1.0, (abs(x - entry[0]) + abs(y - entry[1])) / far)
        lv = levels[0] + int((levels[1] - levels[0]) * f)
        tier = tiers[0] if f < 0.45 else tiers[1] if f < 0.8 else tiers[2]
        chest(x, y, lv, tier); placed += 1

zone_chests(ZONES['farm'], (4,), 8, (1, 5), ('wood', 'wood', 'iron'), T1_E)
zone_chests(ZONES['forest'], (4,), 10, (3, 10), ('wood', 'iron', 'iron'), P(50, 80))
zone_chests(ZONES['camp'], (7, 4), 4, (8, 13), ('iron', 'iron', 'gold'), P(30, 44))
zone_chests(ZONES['swamp'], (3,), 10, (6, 15), ('wood', 'iron', 'gold'), P(78, 62))
zone_chests(ZONES['grave'], (4,), 8, (8, 18), ('iron', 'iron', 'gold'), P(90, 98))
zone_chests(ZONES['hills'], (8,), 10, (11, 22), ('iron', 'iron', 'gold'), P(92, 49))
zone_chests(ZONES['ash'], (9,), 10, (21, 29), ('iron', 'gold', 'gold'), P(114, 76))
DLV = {'sumpf': (10, 16), 'kata': (13, 18), 'mine': (17, 23), 'thron': (26, 30)}
for name, (rooms, ent, boss, dist) in dg.items():
    maxd = max(dist.values()) or 1
    for k, r in rooms.items():
        if k == ent: continue
        f = dist.get(k, maxd) / maxd
        lv = DLV[name][0] + int((DLV[name][1] - DLV[name][0]) * f)
        if k == boss:
            for dx in (-2, 2):
                x, y = room_center(r); x += dx; y += 2
                if free(x, y): chest(x, y, DLV[name][1], 'gold')
        elif random.random() < 0.45:
            for _t in range(30):
                x, y = random.randint(r[0] + 1, r[2] - 1), random.randint(r[1] + 1, r[3] - 1)
                if free(x, y) and not any(abs(x - a) < 3 and abs(y - b) < 3 for a, b in taken + ctaken):
                    chest(x, y, lv, 'gold' if f > 0.6 else 'iron'); break

# ------------------------------------------------------------------ Prüfung
sx, sy = START
seen = {(sx, sy)}; q = collections.deque([(sx, sy)])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if free(nx, ny) and (nx, ny) not in seen:
            seen.add((nx, ny)); q.append((nx, ny))
bad = [o for o in objs if o["type"] in ("monster", "npc", "chest") and (o["x"] // TS, o["y"] // TS) not in seen]
if bad:
    crit = [o for o in bad if o["type"] == "npc" or "boss" in o["name"].lower() or o["name"] in ("Räuberfürst Harkon", "Moorhexe Veshra", "Aschenkönig", "Steinkoloss", "Knochenfürst Morrik", "Goblinkönig Grix", "Webmutter Skarra")]
    for o in bad[:20]: print("UNERREICHBAR", o["name"], o["x"] // TS, o["y"] // TS, file=sys.stderr)
    if crit: sys.exit("kritische Objekte unerreichbar: " + ", ".join(o["name"] for o in crit))
    ids = {o["id"] for o in bad}; objs[:] = [o for o in objs if o["id"] not in ids]
    print("entfernt:", len(bad), "unerreichbare Objekte", file=sys.stderr)

data = [g[y][x] for y in range(H) for x in range(W)]
tmj = {"compressionlevel": -1, "height": H, "width": W, "infinite": False, "orientation": "orthogonal", "renderorder": "right-down",
       "tilewidth": TS, "tileheight": TS, "type": "map", "version": "1.10", "nextlayerid": 3, "nextobjectid": oid[0], "tilesets": [],
       "layers": [{"id": 1, "name": "ground", "type": "tilelayer", "width": W, "height": H, "x": 0, "y": 0, "visible": True, "opacity": 1, "data": data},
                  {"id": 2, "name": "objects", "type": "objectgroup", "x": 0, "y": 0, "visible": True, "opacity": 1, "draworder": "topdown", "objects": objs}]}
json.dump(tmj, open("src/data/aschenthron.json", "w"), ensure_ascii=False)
mons = [o for o in objs if o["type"] == "monster"]
print("ok:", len(mons), "Monster in", pack_counter[0], "Rudeln,", sum(1 for o in objs if o["type"] == "npc"), "NPCs,", sum(CHEST_COUNT.values()), "Truhen", CHEST_COUNT, ", begehbar:", len(seen))
if "--preview" in sys.argv:
    ch = {1: 'T', 2: '#', 3: '~', 4: '.', 5: '_', 6: ' ', 7: '=', 8: ',', 9: ':', 10: 'f', 11: 'o', 12: '!', 13: 't', 14: 'i'}
    for y in range(0, H, 3):
        print(''.join(ch[g[y][x]] for x in range(0, W, 2)))
