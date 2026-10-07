#!/usr/bin/env python3
"""Erzeugt src/data/aschenthron.json (Tiled-JSON, orthogonal, 32px) – die Insel „Aschental“ (Version 4: 300x240 mit Goblinbau, Spinnennest, Aschengrund, Weltbossen und Lore-NPCs).
Gids: 1 Stadtstein, 2 Wand, 3 Sumpf, 4 Gras, 5 Dungeonboden, 6 Wasser, 7 Weg, 8 Hochland, 9 Asche,
10 Baum, 11 Fels, 12 Lava, 13 Grabstein, 14 Säule (alle blockiert außer 1,3,4,5,7,8,9).
Monster stehen in Rudeln (1–5, mit Anführer einer höheren Stufe). Je weiter vom Zoneneingang, desto stärker.
Alles hier ist eigener Entwurf. Danach in Tiled editierbar; das Spiel liest nur die JSON-Datei."""
import json, math, random, collections, sys

S = 1.5                                  # Skalierung gegenüber dem ersten Entwurf (160x120)
W, H, TS = 300, 240, 32
random.seed(20261005)
g = [[6] * W for _ in range(H)]
BLOCK = {2, 6, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27}
objs, oid = [], [1]
pack_counter = [0]
CHAMPIONS = [0]

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
npc("Hauptmann Brandt", 16, 6, t1x, t1y, kind="quest", quests="q_rats,q_chests1,q_hounds,q_goblins,q_bandits,q_spiders,q_goblin_scouts,q_unique1")
npc("Kräuterfrau Odda", 4, 9, t1x, t1y, kind="quest", quests="q_herbs,q_ghouls")
npc("Meisterin Kjorra", 5, 7, t2x, t2y, kind="trainer", tier=2, field="Kampf")
npc("Erzmagier Orvan", 8, 9, t2x, t2y, kind="trainer", tier=2, field="Magie")
npc("Händler Dorn", 12, 7, t2x, t2y, kind="merchant", shop="advanced")
npc("Truhe", 11, 12, t2x, t2y, kind="stash")
npc("Schmied Torgal", 3, 11, t2x, t2y, kind="smith")
npc("Wachführerin Tessa", 16, 11, t2x, t2y, kind="quest", quests="q_harkon,q_champs1,q_goblin_king,q_wraiths,q_chests2,q_veshra,q_trolls,c_thr3")
npc("Späher Ruven", 11, 5, t2x, t2y, kind="quest", quests="q_unique2,q_mine,q_champs2,q_ash,q_katacombs,q_king,c_thr4,c_thr5")

safe_rects = [(TOWN1[0] - 1, TOWN1[1] - 1, TOWN1[2] + 1, TOWN1[3] + 1), (TOWN2[0] - 1, TOWN2[1] - 1, TOWN2[2] + 1, TOWN2[3] + 1)]
def in_safe(x, y, pad=0):
    return any(a - pad <= x <= b + pad and c - pad <= y <= d + pad for a, c, b, d in safe_rects)

SPAWN_BUFFER = 12
taken = []
def place_ok(x, y, ground, pad, gap):
    if not free(x, y) or (ground is not None and g[y][x] not in ground): return False
    if in_safe(x, y, pad): return False
    return not any(abs(x - a) < gap and abs(y - b) < gap for a, b in taken)

PACK_MAX = 3                             # Rudel bleiben klein (2–3 Tiere), sie patrouillieren im Spiel gemeinsam
PACK_DENSITY = 0.6                       # Anteil der früheren Rudelanzahl je Zone

def spawn_pack(kinds, x, y, ground, size, leader=None, gap=3, champions=True):
    """Ein Rudel um (x,y): Anführer (falls angegeben) und size-1 Mitglieder in 3 Tiles Umkreis."""
    size = min(size, PACK_MAX)
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
    champ_roll = champions and size >= 2 and random.random() < 0.10
    for idx, (kind, mx, my) in enumerate(members):
        if idx == 0 and champ_roll:
            obj(kind, "monster", mx, my, kind=kind, pack=pid, champ=random.choice(['swift', 'armored', 'fiery', 'vampiric', 'thorned']))
            CHAMPIONS[0] += 1
        else:
            obj(kind, "monster", mx, my, kind=kind, pack=pid)
        taken.append((mx, my))
    return len(members)

PACK_META = {}                           # Rudel-Id -> (Zonen-Tag, Entfernung vom Eingang 0..1)

def zone_packs(zone, entry, bands, n_packs, ground, tag=None):
    """bands: [(f_max, [(kind, gewicht)...], leader_kind|None)] nach Entfernung vom Eingang (0..1)."""
    x0, y0, x1, y1 = zone
    n_packs = max(1, round(n_packs * PACK_DENSITY))
    far = max(abs(entry[0] - x0), abs(entry[0] - x1)) + max(abs(entry[1] - y0), abs(entry[1] - y1))
    placed, tries, total = 0, 0, 0
    while placed < n_packs and tries < n_packs * 60:
        tries += 1
        x, y = random.randint(x0, x1), random.randint(y0, y1)
        if not place_ok(x, y, ground, SPAWN_BUFFER, 6): continue
        f = (abs(x - entry[0]) + abs(y - entry[1])) / far
        band = next((b for b in bands if f <= b[0]), bands[-1])
        kinds = [k for k, w in band[1] for _ in range(w)]
        size = random.choices([1, 2, 3], weights=[1, 5, 4] if f < 0.7 else [0, 4, 5])[0]
        if f < 0.25:
            size = random.choice([1, 2, 2])   # nahe am Zoneneingang: kleine Rudel, damit die ersten Minuten fair bleiben
        leader = band[2] if band[2] and size >= 3 and random.random() < 0.5 else None
        total += spawn_pack(kinds, x, y, ground, size, leader, champions=f >= 0.3)
        PACK_META[pack_counter[0]] = (tag, f)
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
    (0.55, [('goblin_scout', 3), ('goblin_archer', 1), ('forest_spider', 3), ('bandit_novice', 2)], 'goblin_archer'),   # Anführer L5 statt Krieger L8: der Wald-Osthang liegt neben Felsenwacht, Stufe-4-Spieler sterben dort sonst in Schleifen
    (0.80, [('goblin_warrior', 3), ('wolf', 2), ('venom_spider', 2), ('highwayman', 1), ('bandit_archer', 1)], 'goblin_shaman'),
    (1.00, [('goblin_warrior', 3), ('goblin_shaman', 2), ('venom_spider', 2), ('wolf', 2)], 'goblin_chief')], 30, (4,), tag='forest')
# Goblinkönig: früher im Düsterwald, jetzt im Goblinbau (siehe unten)
gk = (sc(22), sc(50))
for _ in range(200):
    gx, gy = random.randint(sc(16), sc(30)), random.randint(sc(50), sc(60))
    if place_ok(gx, gy, (4,), 0, 2):
        # Grix sitzt jetzt im Goblinbau (P3); der Platz bleibt reserviert, damit der restliche Entwurf unverändert bleibt
        fill((gx - 2, gy - 2, gx + 2, gy + 2), 4); taken.append((gx, gy)); break
# Räuberlager L7-13
zone_packs(ZONES['camp'], P(30, 44), [
    (0.45, [('highwayman', 2), ('bandit_archer', 1), ('bandit', 3), ('bandit_novice', 1)], 'bandit'),
    (1.00, [('bandit', 3), ('bandit_archer', 1), ('highwayman', 2), ('goblin_shaman', 1)], 'bandit_captain')], 12, (7, 4))
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
    (0.60, [('skeleton', 3), ('zombie', 2), ('bone_acolyte', 1), ('wraith', 2)], 'bone_knight'),
    (1.00, [('zombie', 2), ('necromancer', 1), ('bone_knight', 3), ('crypt_guard', 1)], 'crypt_guard')], 22, (4,))
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
    """Rudel je Raum nach Entfernungs-Bändern. Bänder mit 4. Eintrag (lo, hi) legen die Rudelgröße fest und
    begrenzen Räume neben dem Eingang auf höchstens 2 (P3-Dungeons, ohne Wächter im Bossraum); sonst 1–4."""
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
        lo, hi = band[3] if len(band) > 3 else (1, 4)
        if len(band) > 3 and dist.get(k, maxd) <= 1: hi = min(hi, 2)
        for _ in range(random.randint(*per_room)):
            for _t in range(40):
                x, y = random.randint(r[0] + 1, r[2] - 1), random.randint(r[1] + 1, r[3] - 1)
                if place_ok(x, y, (5,), 0, 3):
                    spawn_pack(kinds, x, y, (5,), random.randint(lo, hi), band[2]); break
    return room_center(rooms[boss])

dungeon_spawns('sumpf', [(0.4, [('marsh_corpse', 3), ('bog_witch', 1), ('wraith', 1)], 'bog_witch'), (1.0, [('bog_witch', 2), ('ghoul_alpha', 3), ('wraith', 2)], 'ghoul_alpha')], 'bog_queen', ['bog_witch'])
dungeon_spawns('kata', [(0.4, [('skeleton', 3), ('zombie', 2), ('wraith', 1)], 'bone_knight'), (1.0, [('bone_knight', 3), ('crypt_guard', 3), ('necromancer', 1)], 'crypt_guard')], 'bone_lord', ['bone_knight'])
dungeon_spawns('mine', [(0.35, [('cave_spider', 3), ('pit_worm', 2), ('stone_golem', 1)], 'pit_worm'), (0.7, [('pit_worm', 3), ('rock_troll', 2), ('iron_golem', 2), ('cave_spider', 2)], 'iron_golem'), (1.0, [('iron_golem', 3), ('acid_worm', 3), ('rock_troll', 2)], 'acid_worm')], 'stone_colossus', ['iron_golem'])
dungeon_spawns('thron', [(0.4, [('imp', 3), ('death_knight', 2), ('ember_elemental', 1)], 'death_knight'), (1.0, [('death_knight', 3), ('ember_elemental', 2), ('hell_spawn', 3), ('imp', 2)], 'hell_spawn')], 'ash_king', ['hell_spawn'])

# Webmutter in der Tiefenmine (eigener Raum nahe dem Ende)
rooms, ent, boss, dist = dg['mine']
cand = sorted((k for k in rooms if k not in (ent, boss)), key=lambda k: -dist.get(k, 0))
if cand:
    r = rooms[cand[0]]; cx, cy = room_center(r)
    obj("Webmutter Skarra", "monster", cx, cy, kind="web_mother", pack=0); taken.append((cx, cy))

# ------------------------------------------------------------- Mini-Bosse
def place_unique(zone, ground, uid, base, entry, min_f=0.35):
    """Ein benannter Mini-Boss weit vom Zoneneingang entfernt (nie nahe der Stadt)."""
    x0, y0, x1, y1 = zone
    far = max(abs(entry[0] - x0), abs(entry[0] - x1)) + max(abs(entry[1] - y0), abs(entry[1] - y1))
    for _ in range(4000):
        x, y = random.randint(x0, x1), random.randint(y0, y1)
        if not place_ok(x, y, ground, SPAWN_BUFFER, 4): continue
        if (abs(x - entry[0]) + abs(y - entry[1])) / far < min_f: continue
        obj(uid, "monster", x, y, kind=base, unique=uid, pack=0)
        taken.append((x, y))
        UNIQUE_COUNT[0] += 1
        return True
    print("WARN Mini-Boss nicht platziert:", uid, file=sys.stderr)
    return False

UNIQUE_COUNT = [0]
place_unique(ZONES['farm'], (4,), 'rat_king', 'giant_rat', T1_E, 0.5)
place_unique(ZONES['farm'], (4,), 'spotted_beast', 'feral_hound', T1_E, 0.45)
place_unique(ZONES['forest'], (4,), 'goblin_shaman_brakk', 'goblin_shaman', P(50, 80), 0.5)
place_unique(ZONES['forest'], (4,), 'venom_mother', 'venom_spider', P(50, 80), 0.6)
place_unique(ZONES['camp'], (7, 4), 'captain_kolm', 'bandit_captain', P(30, 44), 0.5)
place_unique(ZONES['swamp'], (3,), 'bog_brute', 'ghoul_alpha', P(78, 62), 0.5)
place_unique(ZONES['swamp'], (3,), 'hexmaster_irva', 'bog_witch', P(78, 62), 0.7)
place_unique(ZONES['grave'], (4,), 'crypt_ormund', 'crypt_guard', P(90, 98), 0.5)
place_unique(ZONES['grave'], (4,), 'ghost_lord_sael', 'wraith', P(90, 98), 0.65)
place_unique(ZONES['hills'], (8,), 'troll_chief_drogg', 'rock_troll', P(92, 49), 0.55)
place_unique(ZONES['hills'], (8,), 'alpha_fenrik', 'dire_wolf', P(92, 49), 0.4)
place_unique(ZONES['ash'], (9,), 'cinder_lord_zarkesh', 'ember_elemental', P(114, 76), 0.6)
place_unique(ZONES['ash'], (9,), 'dread_valdor', 'death_knight', P(114, 76), 0.75)

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


# ============================================================ P3: neue Dungeons, Aschengrund, Weltbosse, Lore-NPCs
# Alles Neue entsteht nach dem bisherigen Entwurf mit eigenem Zufallsstrom, damit die alten Zonen unverändert bleiben.
random.seed(20261006)

def water_ok(box, pad=1):
    x0, y0, x1, y1 = box
    return all(0 <= x < W and 0 <= y < H and g[y][x] == 6 for y in range(y0 - pad, y1 + pad + 1) for x in range(x0 - pad, x1 + pad + 1))

NEW_DUNGEONS = {
    'goblin': dict(box=(4, 4, 60, 33), entrance=(28, 34)),         # Goblinbau: Zugang vom Räuberlager (Nordrand, weit weg von Harkon)
    'nest': dict(box=(100, 178, 152, 208), entrance=(126, 176)),   # Spinnennest: Zugang vom Totenacker (Südrand)
}
for name, d in NEW_DUNGEONS.items():
    assert water_ok(d['box']), "Platz für " + name + " nicht frei"
    dg[name] = dungeon(d['box'], d['entrance'])
road([(28, 34), (28, 44)], width=3, gid=7)
road([(126, 166), (126, 176)], width=3, gid=7)

GRUND = (236, 90, 294, 150)
assert water_ok(GRUND), "Platz für Aschengrund nicht frei"
fill(GRUND, 9); ragged(GRUND, 9)
blobs(GRUND, 9, 12, 34, 4); scatter(GRUND, 9, 11, 0.09)
road([(222, 114), (244, 114)], width=3, gid=9)

for nm, r, lv in [("Goblinbau", NEW_DUNGEONS['goblin']['box'], "8-12"), ("Spinnennest", NEW_DUNGEONS['nest']['box'], "13-18"), ("Aschengrund", GRUND, "28-32")]:
    obj(nm, "region", r[0], r[1], r[2] - r[0] + 1, r[3] - r[1] + 1, levels=lv)

dungeon_spawns('goblin', [
    (0.34, [('goblin_warrior', 3), ('goblin_archer', 1), ('goblin_scout', 1)], 'goblin_warrior', (1, 2)),
    (0.67, [('goblin_warrior', 3), ('goblin_shaman', 1), ('goblin_brute', 2), ('goblin_archer', 1)], 'goblin_brute', (1, 3)),
    (1.00, [('goblin_brute', 3), ('goblin_shaman', 1), ('goblin_warlord', 2)], 'goblin_warlord', (2, 3))], 'goblin_king')
dungeon_spawns('nest', [
    (0.34, [('giant_spider', 3), ('brood_spider', 3)], 'giant_spider', (1, 2)),
    (0.67, [('web_stalker', 3), ('giant_spider', 2), ('brood_spider', 2)], 'web_stalker', (1, 3)),
    (1.00, [('nest_matron', 3), ('web_stalker', 3), ('brood_spider', 1)], 'nest_matron', (2, 3))], 'spider_queen')

def dungeon_chests(name, lv, total=(3, 5)):
    """3–5 Truhen je Dungeon: zwei goldene im Bossraum, der Rest in zufälligen Räumen."""
    rooms, ent, boss, dist = dg[name]
    maxd = max(dist.values()) or 1
    n = random.randint(*total); placed = 0
    for dx in (-2, 2):
        x, y = room_center(rooms[boss]); x += dx; y += 2
        if free(x, y) and placed < n: chest(x, y, lv[1], 'gold'); placed += 1
    others = [k for k in rooms if k not in (ent, boss)]
    random.shuffle(others)
    for k in others:
        if placed >= n: break
        r = rooms[k]; f = dist.get(k, maxd) / maxd
        for _t in range(30):
            x, y = random.randint(r[0] + 1, r[2] - 1), random.randint(r[1] + 1, r[3] - 1)
            if free(x, y) and not any(abs(x - a) < 3 and abs(y - b) < 3 for a, b in taken + ctaken):
                chest(x, y, lv[0] + int((lv[1] - lv[0]) * f), 'gold' if f > 0.6 else 'iron'); placed += 1; break

dungeon_chests('goblin', (8, 12))
dungeon_chests('nest', (13, 18))

# Aschengrund: Elite-Zone (Stufe 28–32), dichter besetzt als die Aschenöde, bessere Truhen
GRUND_ENTRY = (236, 114)
zone_packs(GRUND, GRUND_ENTRY, [
    (0.30, [('hell_spawn', 3), ('hell_hound', 3)], 'hell_hound'),
    (0.65, [('hell_hound', 3), ('doom_knight', 3), ('hell_spawn', 2)], 'doom_knight'),
    (1.00, [('doom_knight', 3), ('pit_fiend', 3), ('hell_hound', 2)], 'pit_fiend')], 52, (9,), tag='grund')
zone_chests(GRUND, (9,), 9, (28, 32), ('iron', 'gold', 'gold'), GRUND_ENTRY)

# Weltbosse: weit vom Zoneneingang, abseits der Wege (nur auf Zonenboden, nie Weg)
place_unique(ZONES['swamp'], (3,), 'bog_titan', 'ghoul_alpha', P(78, 62), 0.65)
place_unique(ZONES['hills'], (8,), 'mountain_king', 'rock_troll', P(92, 49), 0.7)
place_unique(GRUND, (9,), 'abyss_warden', 'pit_fiend', GRUND_ENTRY, 0.75)

# Lore-NPCs: feste Plätze (kein Zufall), danach werden Monster in 5 Feldern Umkreis entfernt
def prop(o, n): return next((p["value"] for p in o["properties"] if p["name"] == n), None)
BOSS_KINDS = {"goblin_king", "bandit_lord", "bone_lord", "bog_queen", "stone_colossus", "web_mother", "ash_king", "spider_queen"}
LORE_POS = []
def free_near(x, y, ground, maxr=14):
    for r in range(maxr + 1):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                if max(abs(dx), abs(dy)) != r: continue
                nx, ny = x + dx, y + dy
                if free(nx, ny) and g[ny][nx] in ground and sum(1 for ax in (-1, 0, 1) for ay in (-1, 0, 1) if free(nx + ax, ny + ay)) >= 7 \
                        and not any(abs(nx - a) < 3 and abs(ny - b) < 3 for a, b in ctaken + LORE_POS) \
                        and not any(abs(nx - o["x"] // TS) < 9 and abs(ny - o["y"] // TS) < 9 for o in objs if o["type"] == "monster" and (prop(o, "unique") or prop(o, "kind") in BOSS_KINDS)):
                    return nx, ny
    raise SystemExit("kein Platz für NPC bei %d,%d" % (x, y))

def lore_npc(name, x, y, quests, ground):
    nx, ny = free_near(x, y, ground)
    obj(name, "npc", nx, ny, kind="quest", quests=quests)
    LORE_POS.append((nx, ny)); taken.append((nx, ny))

lore_npc("Chronistin Maren", t1x + 9, t1y + 7, "c_gob1", (1,))
lore_npc("Torwache Haldor", t2x + 9, t2y + 18, "c_moor1,c_eid1,c_web1,c_web2,c_web3", (1,))
lore_npc("Jägerin Ysa", 47, 63, "c_gob2,c_gob3,c_gob4", (7, 4))
lore_npc("Eremit Olm", sc(88), sc(80), "c_moor2,c_moor3,c_moor4", (3,))
_er = dg['mine'][0][dg['mine'][1]]
lore_npc("Schatzsucher Pell", (_er[0] + _er[2]) // 2 + 1, (_er[1] + _er[3]) // 2 + 1, "c_pell1,c_pell2,c_pell3", (5,))
lore_npc("Ritter Aldric", 181, 118, "c_eid2,c_eid3,c_eid4", (9,))
objs[:] = [o for o in objs if not (o["type"] == "monster" and not any(p["name"] == "unique" or (p["name"] == "kind" and p["value"] in ("bandit_lord", "goblin_king")) for p in o["properties"])
                                   and any(abs(o["x"] // TS - a) <= 5 and abs(o["y"] // TS - b) <= 5 for a, b in LORE_POS))]

# Forst-Eingang entschärfen: im vorderen Düsterwald höchstens 3 je Rudel (nachträglich gekürzt, Zufallsstrom bleibt gleich)
trim = 0
for pid, (tag, f) in PACK_META.items():
    if tag == 'forest' and f < 0.5:
        members = [o for o in objs if o["type"] == "monster" and any(p["name"] == "pack" and p["value"] == str(pid) for p in o["properties"])]
        for o in members[3:]:
            objs.remove(o); trim += 1
print("Düsterwald: %d Rudelmitglieder im Eingangsbereich gekürzt" % trim, file=sys.stderr)

# ------------------------------------------------------------------ Aschenhafen als Hafenstadt (Stufe 6)
# Entsteht nach allem Alten, ohne Zufall: Die alte ummauerte Stadt wird zu einer größeren Hafenstadt auf Wasser und Altstadt umgebaut
# (Spielstände bleiben gültig, MAP_VERSION unverändert; wer in einem neuen Haus stand, startet wieder am Hafen).
# Oben Mauer mit Nord- und Osttor, in der Mitte Hauptstraße und Querstraße mit Brunnen, jede Rolle in einem eigenen Haus mit Türschild,
# unten Hafenplatz mit Kai, Stegen, Booten und dem Schiff, mit dem man ankommt.
# Kacheln: 15 Dielen, 16 Pflaster, 17 Blumenwiese, 18 Hauswand, 19 Fass, 20 Kisten, 21 Brunnen, 22 Laterne, 23 Boot, 24 Marktstand,
# 25 Pfahl, 26 Schiff, 27 Blumenkasten, 28-36 Türen (Symbol: Anker, Buch, Münzen, Amboss, Truhe, Schild, Blatt, Schriftrolle, Schwert).
TOWN = (14, 132, 47, 175)
tx0, ty0, tx1, ty1 = TOWN
for y in range(ty0 - 1, ty1 + 10):
    for x in range(tx0 - 2, tx1 + 2):
        assert g[y][x] in (6, 1, 2, 7), ("Aschenhafen: Fläche nicht frei", x, y, g[y][x])
def L(lx, ly): return tx0 + lx, ty0 + ly
def setg(lx, ly, gid):
    x, y = L(lx, ly)
    g[y][x] = gid
fill(TOWN, 1)
for lx in range(0, 34):
    setg(lx, 0, 2)
for ly in range(0, 35):
    setg(0, ly, 2); setg(33, ly, 2)
for d in (-1, 0, 1):
    setg(17 + d, 0, 1)                      # Nordtor (Straße von Norden bei x=31)
    setg(33, 9 + d, 1)                      # Osttor (Straße nach Osten bei y=141)
# Plätze: Stadtmitte um den Brunnen, Hafenplatz
for ly in range(6, 13):
    for lx in range(14, 21): setg(lx, ly, 16)
for ly in range(35, 41):
    for lx in range(2, 32): setg(lx, ly, 16)
setg(17, 9, 21)                             # Brunnen
# Kai (Dielen) und Stege über dem Wasser
for ly in range(41, 44):
    for lx in range(2, 32): setg(lx, ly, 15)
for ly in range(44, 52):
    for lx in (16, 17, 18): setg(lx, ly, 15)            # Hauptsteg
for ly in range(44, 50):
    for lx in (6, 7): setg(lx, ly, 15)                  # Nebensteg
for lx, ly in [(15, 46), (19, 46), (15, 51), (19, 51), (5, 49), (8, 49)]: setg(lx, ly, 25)
for lx, ly in [(9, 46), (11, 44), (23, 44)]: setg(lx, ly, 23)
setg(21, 47, 26)                                         # Schiff, am Hauptsteg vertäut

def house(lx0, ly0, door_side, icon):
    """Haus 8x6 (Außenmaß): Wände, Dielen, Tür mit Berufsschild. Liefert die Kachel direkt hinter der Tür (Platz des NPC)."""
    for lx in range(lx0, lx0 + 8):
        setg(lx, ly0, 18); setg(lx, ly0 + 5, 18)
    for ly in range(ly0, ly0 + 6):
        setg(lx0, ly, 18); setg(lx0 + 7, ly, 18)
    for ly in range(ly0 + 1, ly0 + 5):
        for lx in range(lx0 + 1, lx0 + 7): setg(lx, ly, 15)
    door = {'S': (lx0 + 4, ly0 + 5), 'N': (lx0 + 4, ly0), 'E': (lx0 + 7, ly0 + 3), 'W': (lx0, ly0 + 3)}[door_side]
    inner = {'S': (0, -1), 'N': (0, 1), 'E': (-1, 0), 'W': (1, 0)}[door_side]
    setg(door[0], door[1], 28 + ICONS.index(icon))
    return (door[0] + inner[0], door[1] + inner[1])
ICONS = ['anchor', 'book', 'coins', 'anvil', 'chest', 'shield', 'leaf', 'scroll', 'sword', 'staff']
SPOT = {}
SPOT['wache'] = house(5, 1, 'S', 'shield')
SPOT['kraeuter'] = house(22, 1, 'S', 'leaf')
SPOT['lehrer'] = house(5, 12, 'N', 'book')
SPOT['haendler'] = house(22, 12, 'N', 'coins')
SPOT['schmied'] = house(5, 20, 'E', 'anvil')
SPOT['ausruester'] = house(22, 20, 'W', 'sword')
SPOT['lager'] = house(5, 28, 'E', 'chest')
SPOT['chronik'] = house(22, 28, 'W', 'scroll')
SPOT['hafen'] = house(3, 35, 'E', 'anchor')
SPOT['magier'] = house(22, 35, 'W', 'staff')       # Magielehrerin: Gegenstück zum Hafenmeisterhaus am Hafenplatz
# Schmuck: Gärten, Bäume, Laternen, Fässer, Kisten, Marktstände, Blumenkästen
for ly in range(8, 12):
    for lx in range(1, 4): setg(lx, ly, 17)
    for lx in range(30, 33): setg(lx, ly, 17)
for lx, ly in [(2, 3), (2, 5), (31, 3), (31, 5), (2, 15), (31, 15), (2, 26), (31, 26)]: setg(lx, ly, 10)
for lx, ly in [(14, 3), (20, 3), (14, 14), (20, 14), (14, 18), (20, 18), (14, 26), (20, 26), (14, 34), (20, 34), (9, 9), (26, 9), (11, 36)]: setg(lx, ly, 22)
for lx, ly in [(13, 21), (13, 26), (21, 26), (21, 21), (13, 29), (30, 40)]: setg(lx, ly, 19)
for lx, ly in [(13, 25), (21, 25), (2, 36), (27, 42)]: setg(lx, ly, 20)
for lx, ly in [(13, 37)]: setg(lx, ly, 24)
for lx, ly in [(7, 7), (11, 7), (24, 7), (28, 7), (7, 11), (11, 11), (24, 11), (28, 11)]: setg(lx, ly, 27)

# alte Objekte der Stadt entfernen (NPCs, Zonen, Start), neue setzen
def in_old_town(o): return TOWN1[0] - 2 <= o["x"] // TS <= TOWN1[2] + 2 and TOWN1[1] - 2 <= o["y"] // TS <= TOWN1[3] + 2
objs[:] = [o for o in objs if not ((o["type"] == "npc" and in_old_town(o)) or (o["type"] in ("safezone", "region", "townstart") and o["name"] == "Aschenhafen") or o["type"] == "start")]
# Sanfter Einstieg: um das Osttor (die Straße zu den Feldern) bleiben ganze Rudel weg, damit Anfänger nicht beim ersten Schritt in gemischte Gruppen laufen
GATE_E = L(33, 9)
near = [o for o in objs if o["type"] == "monster" and math.hypot(o["x"] // TS - GATE_E[0], o["y"] // TS - GATE_E[1]) <= 18 and not prop(o, "unique")]
dropped = [o for o in near if prop(o, "kind") != "field_rat"]      # nur die schwächsten Tiere (Feldratten) bleiben als Übungsziel
objs[:] = [o for o in objs if o not in dropped]
print("Aschenhafen: %d Monster am Osttor entfernt, %d Feldratten bleiben" % (len(dropped), len(near) - len(dropped)), file=sys.stderr)
# Übungsziele: ein paar Feldratten-Rudel im vorderen Drittel der Felder (nicht auf der Straße: die Handelsstraße schiebt sie danach vom Weg weg)
fx0, fy0, fx1, fy1 = ZONES['farm']
rat_packs = 0
for _ in range(400):
    if rat_packs >= 5: break
    x, y = random.randint(fx0, fx0 + 22), random.randint(fy0, fy1)
    if place_ok(x, y, (4,), 0, 6) and 16 <= math.hypot(x - GATE_E[0], y - GATE_E[1]) <= 34:
        spawn_pack([('field_rat')], x, y, (4,), 2, None, champions=False); rat_packs += 1
print("Aschenhafen: %d Feldratten-Rudel als Übungsziele" % rat_packs, file=sys.stderr)
START = L(17, 38)
obj("Start", "start", *START)
obj("Aschenhafen", "townstart", *START)
obj("Aschenhafen", "safezone", tx0 - 1, ty0 - 1, tx1 - tx0 + 3, 55)
obj("Aschenhafen", "region", tx0 - 1, ty0 - 1, tx1 - tx0 + 3, 55, levels="Stadt")
def npc_at(name, key, **props): obj(name, "npc", *L(*SPOT[key]), **props)
npc_at("Hafenmeister Joren", 'hafen', kind="quest", quests="c_arr1")
npc_at("Lehrer Varn", 'lehrer', kind="trainer", tier=1, field="Kampf", quests="c_arr2")
npc_at("Magierin Selka", 'magier', kind="trainer", tier=1, field="Magie")
npc_at("Händlerin Mirel", 'haendler', kind="merchant", shop="basic", quests="c_arr3")
npc_at("Schmiedin Ilse", 'schmied', kind="smith", quests="c_arr4")
npc_at("Lagerverwalter Ottmar", 'lager', kind="stash", quests="c_arr5")
npc_at("Hauptmann Brandt", 'wache', kind="quest", quests="q_rats,q_chests1,q_hounds,q_goblins,q_bandits,q_spiders,q_goblin_scouts,q_unique1")
npc_at("Kräuterfrau Odda", 'kraeuter', kind="quest", quests="q_herbs,q_ghouls")
npc_at("Händler Wenzel", 'ausruester', kind="merchant", shop="artisan")
npc_at("Chronistin Maren", 'chronik', kind="quest", quests="c_gob1,c_thr1,c_thr2,c_thr6")

# ------------------------------------------------------------------ Felsenwacht: Lagerhaus
# Die freistehende "Truhe" wird durch ein richtiges Haus (Wände, Dielen, Tür mit Truhen-Schild) mit Lagerverwalter ersetzt.
# Kein Zufall, nur Kacheln innerhalb der Stadtmauer; der alte Mauerklotz unten rechts liegt im Grundriss und verschwindet.
fx0, fy0 = t2x + 12, t2y + 14          # Haus 8x6 (Außenmaß), Tür nach Westen
for y in range(fy0, fy0 + 6):
    for x in range(fx0, fx0 + 8):
        assert g[y][x] in (1, 2), ("Felsenwacht: Lagerhaus-Fläche nicht frei", x, y, g[y][x])
        edge = y in (fy0, fy0 + 5) or x in (fx0, fx0 + 7)
        g[y][x] = 18 if edge else 15
g[fy0 + 3][fx0] = 28 + ICONS.index('chest')
objs[:] = [o for o in objs if not (o["type"] == "npc" and o["name"] == "Truhe")]
obj("Lagerverwalter Torvin", "npc", fx0 + 1, fy0 + 3, kind="stash")

# ------------------------------------------------------------------ Handelsstraße (sicherer Weg)
# Eine durchgehende Straße verbindet Aschenhafen mit der Felsenwacht (und weiter bis zum Hochland-Eingang). Entlang der Straße
# bleibt ein Streifen frei von Monstern: Wer nur reisen will, wird nicht angegriffen. Rudel in dem Streifen ziehen innerhalb ihrer
# Zone nach außen (Anzahl und Stufen bleiben gleich). Nach allem Alten und mit eigenem Zufallsstrom, damit der Rest unverändert bleibt.
TRADE_ROAD = [[(TOWN[2] + 1, 141), (89, 141), (89, 106), (112, 106), (113, 94)],     # Osttor Aschenhafen -> Südtor Felsenwacht (dort schließt die alte Straße an)
              [(TOWN2[2], 70), (144, 70)]]                                           # Osttor Felsenwacht -> Hochland-Eingang
SAFE_R = 12                                                                           # Aggro höchstens 6 + Patrouille höchstens 5 Felder um den Rudelplatz
trade_tiles = set()
for pts in TRADE_ROAD:
    before = {(x, y) for y in range(H) for x in range(W) if g[y][x] == 7}
    road(pts, width=3)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        for x in range(min(ax, bx) - 1, max(ax, bx) + 2):
            for y in range(min(ay, by) - 1, max(ay, by) + 2):
                if 0 <= x < W and 0 <= y < H and g[y][x] == 7: trade_tiles.add((x, y))
trade_pts = sorted(trade_tiles)
def near_trade(x, y, r=SAFE_R):
    return any((x - a) ** 2 + (y - b) ** 2 < r * r for a, b in trade_pts if abs(x - a) < r and abs(y - b) < r)
zone_rects = list(ZONES.values())
def zone_of(x, y): return next((i for i, (a, b, c, d) in enumerate(zone_rects) if a <= x <= c and b <= y <= d), None)
rng2 = random.Random(7731)
def relocate_packs():
    mons_ = [o for o in objs if o["type"] == "monster"]
    groups = collections.defaultdict(list)
    for o in mons_:
        pk = int(prop(o, "pack") or 0)
        groups[pk if pk else -o["id"]].append(o)
    moved = lost = 0
    for key, mem in groups.items():
        tiles = [(o["x"] // TS, o["y"] // TS) for o in mem]
        if not any(near_trade(x, y) for x, y in tiles): continue
        if any(g[y][x] == 5 for x, y in tiles): continue                               # Dungeons nie anfassen
        zs = {zone_of(x, y) for x, y in tiles}
        z0 = tiles and zone_of(*tiles[0])
        others = [(o2["x"] // TS, o2["y"] // TS) for o2 in mons_ if o2 not in mem]
        done = False
        for r in range(1, 41):
            cand = [(dx, dy) for dx in range(-r, r + 1) for dy in range(-r, r + 1) if max(abs(dx), abs(dy)) == r]
            rng2.shuffle(cand)
            for dx, dy in cand:
                ok = True
                for x, y in tiles:
                    nx, ny = x + dx, y + dy
                    if not (free(nx, ny) and g[ny][nx] == g[y][x] and zone_of(nx, ny) == z0 and not in_safe(nx, ny, 2) and not near_trade(nx, ny)
                            and not any(abs(nx - a) < 2 and abs(ny - b) < 2 for a, b in others)):
                        ok = False; break
                if ok:
                    for o in mem: o["x"] += dx * TS; o["y"] += dy * TS
                    moved += 1; done = True; break
            if done: break
        if not done:
            lost += len(mem)
            ids = {o["id"] for o in mem}; objs[:] = [o for o in objs if o["id"] not in ids]
    return moved, lost
mv, ls = relocate_packs()
print("Handelsstraße: %d Straßenfelder, %d Rudel nach außen verschoben, %d Monster entfernt" % (len(trade_tiles), mv, ls), file=sys.stderr)

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
    for o in bad[:20]: print("UNERREICHBAR", o["name"], o["x"] // TS, o["y"] // TS, file=sys.stderr)
    crit = [o for o in bad if o["type"] == "npc"]
    if crit: sys.exit("kritische Objekte unerreichbar: " + ", ".join(o["name"] for o in crit))
    keep = []
    for o in bad:
        if o["type"] == "monster" and (prop(o, "unique") or prop(o, "kind") in BOSS_KINDS):
            # Mini-Bosse/Bosse nie löschen: auf das nächste erreichbare Feld verschieben
            ox, oy = o["x"] // TS, o["y"] // TS
            tx, ty = min(((x, y) for (x, y) in seen if g[y][x] == g[oy][ox] or g[y][x] in (3, 4, 5, 8, 9)), key=lambda c: abs(c[0] - ox) + abs(c[1] - oy))
            print("verschoben:", o["name"], (ox, oy), "->", (tx, ty), file=sys.stderr)
            o["x"], o["y"] = tx * TS, ty * TS
        else: keep.append(o)
    ids = {o["id"] for o in keep}; objs[:] = [o for o in objs if o["id"] not in ids]
    print("entfernt:", len(keep), "unerreichbare Objekte", file=sys.stderr)

data = [g[y][x] for y in range(H) for x in range(W)]
tmj = {"compressionlevel": -1, "height": H, "width": W, "infinite": False, "orientation": "orthogonal", "renderorder": "right-down",
       "tilewidth": TS, "tileheight": TS, "type": "map", "version": "1.10", "nextlayerid": 3, "nextobjectid": oid[0], "tilesets": [],
       "layers": [{"id": 1, "name": "ground", "type": "tilelayer", "width": W, "height": H, "x": 0, "y": 0, "visible": True, "opacity": 1, "data": data},
                  {"id": 2, "name": "objects", "type": "objectgroup", "x": 0, "y": 0, "visible": True, "opacity": 1, "draworder": "topdown", "objects": objs}]}
json.dump(tmj, open("src/data/aschenthron.json", "w"), ensure_ascii=False)
mons = [o for o in objs if o["type"] == "monster"]
print("ok:", len(mons), "Monster in", pack_counter[0], "Rudeln,", CHAMPIONS[0], "Champions,", UNIQUE_COUNT[0], "Mini-Bossen,", sum(1 for o in objs if o["type"] == "npc"), "NPCs,", sum(CHEST_COUNT.values()), "Truhen", CHEST_COUNT, ", begehbar:", len(seen))
if "--preview" in sys.argv:
    ch = {1: 'T', 2: '#', 3: '~', 4: '.', 5: '_', 6: ' ', 7: '=', 8: ',', 9: ':', 10: 'f', 11: 'o', 12: '!', 13: 't', 14: 'i'}
    for y in range(0, H, 3):
        print(''.join(ch[g[y][x]] for x in range(0, W, 2)))
