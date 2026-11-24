"""Native-resolution RGBA plants for the Sumiyoshi street atlas.

Coordinates follow a spray from its root to its tip. The two paintings of each
threshold plant share a root, but occupy different depth planes in Blender.
"""
import math
import random


CLEAR = (0, 0, 0, 0)
# Underside, shadow, folded plane, open plane, rim, wet glint.
LEAF = ('192d38', '254344', '356053', '567c5b', '81a471', 'b7c799')
JADE = ('19313c', '24484c', '35625a', '528571', '79a78b', 'aec5a3')
GOLD = ('25373e', '3a5047', '556b50', '818e60', 'b3af75', 'd4c795')
BLUE = ('1d303f', '293f48', '395652', '526c60', '738c75', '9da985')


def mix(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def curve(start, bend, end, t):
    return mix(mix(start, bend, t), mix(bend, end, t), t)


def polygon(d, points, color):
    """Fill a contour at texel centres, preserving sharp, integer boundaries."""
    edges = tuple(zip(points, points[1:] + points[:1]))
    for y in range(max(0, math.floor(min(v[1] for v in points))),
                   min(d.h, math.ceil(max(v[1] for v in points)))):
        scan = y + .5
        cuts = sorted(a[0] + (b[0] - a[0]) * (scan - a[1]) / (b[1] - a[1])
                      for a, b in edges if min(a[1], b[1]) <= scan < max(a[1], b[1]))
        for left, right in zip(cuts[::2], cuts[1::2]):
            x, stop = math.ceil(left - .5), math.ceil(right - .5)
            d.rect(x, y, stop - x, 1, color)


def stroke(d, points, color, width=1):
    for a, b in zip(points, points[1:]):
        d.line(*a, *b, color, width)


def lamina(d, start, bend, tip, half_width, palette, grade, rng, variety='plain'):
    """Folded lanceolate/ovate leaf with a bowed midrib and directed side veins."""
    stations = 11
    spine = [curve(start, bend, tip, i / stations) for i in range(stations + 1)]
    left, right = [], []
    for i, p in enumerate(spine):
        a, b = spine[max(0, i - 1)], spine[min(stations, i + 1)]
        length = max(.001, math.dist(a, b))
        normal = (-(b[1] - a[1]) / length, (b[0] - a[0]) / length)
        t = i / stations
        radius = half_width * math.sin(math.pi * t) ** (.65 if variety == 'variegated' else .88)
        if variety == 'serrated' and i % 2:
            radius *= .84
        left.append((p[0] + normal[0] * radius, p[1] + normal[1] * radius))
        right.append((p[0] - normal[0] * radius * .79, p[1] - normal[1] * radius * .79))
    polygon(d, left + right[::-1], palette[grade])
    polygon(d, left + spine[::-1], palette[min(4, grade + 1)])
    if half_width >= 3.3:
        for i in (3, 5, 7):
            end = mix(spine[i + 1], left[i + 2], .73)
            d.line(*spine[i], *end, palette[min(4, grade + 1 + (variety == 'variegated'))])
            if variety == 'variegated':
                polygon(d, [mix(spine[i], left[i], .28), mix(spine[i], left[i], .56),
                            mix(spine[i + 2], left[i + 2], .85), end], GOLD[4])
        stroke(d, spine[2:7], palette[min(5, grade + 2)])
    if grade >= 2 and rng.random() < .42:
        stroke(d, left[4:7], palette[min(5, grade + 2)])


def aspidistra(d, rng, front):
    base = (d.w * .5, d.h - 2)
    for j in range(9 if front else 12):
        fan = (j / (8 if front else 11) - .5) * 2 + rng.uniform(-.08, .08)
        tip = (base[0] + fan * rng.uniform(46, 58),
               d.h - rng.uniform(51, 87) * (1 - .43 * abs(fan)) - (0 if front else 17))
        shoulder = (mix(base, tip, .33)[0], d.h - rng.uniform(18, 31))
        bend = (mix(shoulder, tip, .58)[0], min(shoulder[1], tip[1]) - rng.uniform(7, 18))
        d.line(*base, *shoulder, LEAF[2 if front else 1], 2)
        lamina(d, shoulder, bend, tip, rng.uniform(4.8, 7.5),
               JADE if j % 2 else LEAF, rng.choice((2, 3)) if front else 1, rng,
               'variegated' if j % 4 == 1 else 'plain')


def fern(d, rng, front):
    base = (d.w * .5, d.h - 2)
    for j in range(8 if front else 10):
        fan = (j / (7 if front else 9) - .5) * 2
        tip = (base[0] + fan * rng.uniform(46, 54), rng.uniform(8, 24) + 39 * abs(fan) + 12 * front)
        bend = (mix(base, tip, .32)[0], tip[1] - 14)
        spine = [curve(base, bend, tip, i / 20) for i in range(21)]
        palette = GOLD if front and j == 5 else LEAF if front else BLUE
        stroke(d, spine, palette[2 if front else 1])
        for i in range(4, 20):
            t = i / 20
            p = spine[i]
            a, b = spine[i - 1], spine[i + 1]
            length = math.dist(a, b)
            tangent = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
            wing = (3.4 + 16 * math.sin(math.pi * (t - .15) / .86)) * (1 - .50 * t)
            for sign in (-1, 1):
                q = (p[0] + wing * (-sign * tangent[1] + tangent[0] * .62),
                     p[1] + wing * (sign * tangent[0] + tangent[1] * .62))
                heel = (p[0] + tangent[0] * 3.6, p[1] + tangent[1] * 3.6)
                wing_base = (mix(p, q, .41)[0] - tangent[0] * 1.9, mix(p, q, .41)[1] - tangent[1] * 1.9)
                polygon(d, [p, wing_base, q, mix(heel, q, .54), heel],
                        palette[2 + int(front) + int(sign == -1 and i % 5 == 0)])


def sedge(d, rng, front):
    base = (d.w * .50, d.h - 2)
    for _ in range(23 if front else 34):
        fan = rng.uniform(-1, 1)
        root = (base[0] + rng.uniform(-8, 8), base[1])
        tip = (root[0] + fan * rng.uniform(38, 55), rng.uniform(17, 53) + 36 * abs(fan))
        bend = (mix(root, tip, .47)[0], tip[1] - rng.uniform(15, 47))
        spine = [curve(root, bend, tip, i / 13) for i in range(14)]
        blade = [(p[0] + 3.3 * (1 - i / 14), p[1]) for i, p in enumerate(spine)]
        palette = GOLD if front else JADE
        grade = rng.choice((2, 3, 3, 4)) if front else rng.choice((1, 2))
        polygon(d, spine + blade[::-1], palette[grade])
        if grade == 4:
            stroke(d, spine[4:8], palette[5])


def hydrangea(d, rng, front):
    origin = (d.w * .5, d.h - 1)
    n = 5 if front else 8
    for i in range(n):
        fan = 2 * i / (n - 1) - 1
        tip = (origin[0] + fan * rng.uniform(28, 41),
               rng.uniform(28, 41) + abs(fan) * 17 - (0 if front else 12))
        bend = (mix(origin, tip, .45)[0], mix(origin, tip, .55)[1])
        stroke(d, [origin, bend, tip], BLUE[2], 2)
        for step in (2, 4, 6):
            p = curve(origin, bend, tip, step / 7)
            for sign in (-1, 1):
                q = (p[0] + sign * rng.uniform(14, 24), p[1] - rng.uniform(7, 15))
                elbow = (mix(p, q, .5)[0], q[1] - 5)
                lamina(d, p, elbow, q, rng.uniform(4, 6), JADE, 2 if front else 1, rng, 'serrated')
        if i % 3 == (1 if front else 0):
            colors = ('494d6c', '65708c', '8d9bb1', 'bac9c3') if front else ('3b465a', '505c71', '66768a', '8c9aa3')
            florets = []
            for _ in range(23):
                a, r = rng.random() * math.tau, math.sqrt(rng.random())
                florets.append((tip[0] + math.cos(a) * 10 * r, tip[1] + math.sin(a) * 6.5 * r))
            for x, y in sorted(florets, key=lambda q: -q[1]):
                d.circle(round(x), round(y), 3, 2, colors[1])
                d.rect(x - 1, y - 1, 2, 1, colors[2]); d.rect(x + 1, y, 1, 2, colors[2])
                if rng.random() < .19:
                    d.rect(x, y, 1, 1, colors[3])


def sapling(d, rng, front):
    """Nandina stems, paired lanceolate leaflets and a hanging red fruit panicle."""
    origin = (d.w * .50, d.h - 1)
    for j in range(4 if front else 6):
        side = rng.uniform(-1, 1)
        top = (origin[0] + side * rng.uniform(12, 28), rng.uniform(7, 27) + (10 if front else 0))
        pivot = (mix(origin, top, .64)[0], mix(origin, top, .45)[1])
        stroke(d, [origin, pivot, top], ('5b554b' if front else '3e4544'), 2)
        for i in range(1, 4):
            p = mix(top, pivot, i / 4.1)
            for sign in (-1, 1):
                q = (p[0] + sign * rng.uniform(14, 29), p[1] - rng.uniform(7, 17))
                d.line(*p, *q, LEAF[2])
                for t in (.24, .51, .76, 1):
                    joint = mix(p, q, t)
                    incline = -1 if t == .51 or t == 1 else 1
                    end = (joint[0] + sign * rng.uniform(5, 10), joint[1] + incline * rng.uniform(5, 12))
                    bend = (mix(joint, end, .5)[0], mix(joint, end, .5)[1] - 3)
                    lamina(d, joint, bend, end, rng.uniform(1.5, 3.2), JADE if j % 2 else LEAF, 2 if front else 1, rng)
        if front and j == 2:
            pit = mix(top, pivot, .55)
            for k in range(9):
                dx, dy = rng.uniform(-5, 5), rng.uniform(1, 9)
                d.rect(pit[0] + dx, pit[1] + dy, 2, 2, ('a96d54', '805447', 'c38969')[k % 3])


def groundcover(d, rng):
    for i in range(65):
        x = rng.uniform(4, d.w - 4)
        base = (x, d.h - rng.uniform(.5, 3))
        dx = rng.uniform(-7, 7)
        tip = (x + dx, d.h - rng.uniform(3, 17) * (.45 + .55 * math.sin(math.pi * x / d.w)))
        polygon(d, [base, (x + .48 * dx, tip[1] + 3), tip, (x + 2, base[1])], rng.choice(BLUE[1:4]))
        if i % 9 == 2:
            d.rect(*tip, 2, 1, GOLD[4])


def climber(d, rng):
    # Teika-kazura twines up a drainpipe, then makes long lateral shoots under the eaves.
    shoots = []
    for j, (b, q) in enumerate([((45,65),(88,18)),((32,54),(13,41)),
                                 ((39,44),(51,7)),((37,124),(8,103))]):
        root = (40+j*.8, d.h-1)
        vine = [curve(root,b,q,i/23) for i in range(24)]
        stroke(d,vine,'615a49' if j%2 else '3b4a45',1.5)
        for i in range(3,23,2):
            p=vine[i]
            sign = -1 if (i//2+j)%2 else 1
            end=(p[0]+sign*rng.uniform(9,21),p[1]+rng.uniform(-6,6))
            shoots.append((p,end,i>13 and j<3))
    for p,q,lit in shoots:
        d.line(*p,*q,'505b4c')
        for j in range(4):
            joint=mix(p,q,.23+j*.23)
            sign=-1 if j%2 else 1
            end=(joint[0]+(q[0]-p[0])*.46,joint[1]+sign*rng.uniform(6,11))
            bend=(mix(joint,end,.55)[0],mix(joint,end,.55)[1]-2)
            lamina(d,joint,bend,end,rng.uniform(2.7,4.5),LEAF if lit else JADE,2 if lit else 1,rng)
        if lit and rng.random()<.20:
            for ox,oy in [(0,0),(4,3),(-2,3)]:
                xx,yy=q[0]+ox,q[1]+oy
                d.rect(xx-1,yy,3,1,'bdbca0');d.rect(xx,yy-1,1,3,'98a896')

def canopy(d, rng, conifer, variant):
    root = (d.w * .50, d.h - 2)
    palette = (('182d38', '1f3c45', '2a4d50', '3b6059', '526f5c'),
               ('1a303a', '23414a', '315354', '45685c', '657b64'),
               ('1a303f', '233e4b', '304e55', '40625c', '597367'))[variant % 3]
    branches = []
    if conifer:
        tip = (root[0] + rng.uniform(-6, 6), 4)
        polygon(d, [(root[0] - 3, root[1]), tip, (root[0] + 3, root[1])], '394344')
        for level in range(21):
            t = .048 + level * .044
            joint = mix(tip, root, t)
            spread = d.w * (.016 + .47 * t)
            for direction in (-1, 1):
                for j in range(5):
                    length = spread * (rng.uniform(.69, 1.02) if j < 3 else rng.uniform(.12, .51))
                    start = (joint[0], joint[1] + rng.uniform(-3, 3))
                    wing = (start[0] + direction * length, start[1] + spread * rng.uniform(.13, .45))
                    bend = (mix(start, wing, .65)[0], mix(start, wing, .21)[1])
                    branches.append((start, bend, wing, direction == -1 and rng.random() < .69))
        for joint, bend, wing, lit in branches:
            stem = [curve(joint, bend, wing, k / 15) for k in range(16)]
            stroke(d, stem, palette[1], 2)
            for k in range(1, 16):
                p = stem[k]
                for sign in (-1, 1):
                    drop = rng.uniform(5, 16) * (1 - k / 30)
                    offset = (wing[0] - joint[0]) * .13 * (1 - k / 22)
                    q = (p[0] + offset + sign * 1.5, p[1] + drop)
                    polygon(d, [(p[0] - 3, p[1]), (p[0] + 3, p[1] - 2), q],
                            palette[rng.choice((1, 1, 2, 3 if lit else 2))])
                if lit and k % 3 == 1:
                    d.rect(p[0] - 2, p[1] - 1, 4, 1, palette[4])
        return

    # Broad deciduous boughs fork from a common trunk. Only the final forks carry leaf sprays.
    tips = []
    def limb(p, angle, length, radius, depth):
        q = (p[0] + math.sin(angle) * length, p[1] - math.cos(angle) * length)
        perp = (math.cos(angle) * radius, math.sin(angle) * radius)
        polygon(d, [(p[0] - perp[0], p[1] - perp[1]), (p[0] + perp[0], p[1] + perp[1]),
                    (q[0] + .7 * perp[0], q[1] + .7 * perp[1]), (q[0] - .7 * perp[0], q[1] - .7 * perp[1])],
                '34413f' if depth > 1 else '384b49')
        if depth == 0:
            tips.append(q)
            return
        for sign in (-1, 1):
            child_angle = angle * .70 + sign * rng.uniform(.27, .78)
            limb(q, child_angle, length * rng.uniform(.62, .82), max(.7, radius * .57), depth - 1)
        if depth == 2:
            limb(mix(p, q, .66), angle + rng.uniform(-.19, .20), length * .65, 1.1, 0)
    trunk = [root, (root[0] - 3, root[1] - 24), (root[0] + 2, root[1] - 43),
             (root[0] + 1, root[1] - 57)]
    for i, (a, b) in enumerate(zip(trunk, trunk[1:])):
        width = 4.9 - i
        polygon(d, [(a[0]-width,a[1]),(a[0]+width,a[1]),(b[0]+width-.7,b[1]),
                    (b[0]-width+.7,b[1])], '3a4948')
        stroke(d, [(a[0]-width+1,a[1]),(b[0]-width+1,b[1])], '52605a')
    for angle, start in ((-.83,1),(-.33,2),(.02,3),(.47,2),(.85,1)):
        limb(trunk[start], angle + rng.uniform(-.12, .12),
             rng.uniform(38.5, 43.5) * (1 - abs(angle) * .18), 3.0, 4)
    sprays = []
    for x, y in tips:
        for _ in range(4):
            a = rng.random() * math.tau
            sprays.append((x + 7 * math.cos(a), y + 5 * math.sin(a), rng.uniform(6, 12)))
    # The underside gives leaf clusters depth; the gaps between separate branches stay open.
    for x, y, radius in sprays:
        for j in range(3):
            dx, dy = rng.uniform(-4, 4), rng.uniform(-3, 3)
            polygon(d, [(x - radius + dx, y + dy), (x - radius * .27, y - radius * .62),
                        (x + radius * .66, y - radius * .35), (x + radius + dx, y + dy + 1),
                        (x + radius * .25, y + radius * .63), (x - radius * .58, y + radius * .53)],
                    palette[0 if j == 0 else 1])
    for x, y, radius in sorted(sprays, key=lambda p: -p[1]):
        lit = rng.random() < .37 and y < d.h * .67
        # A small number of connected light-facing leaf groups reads at street scale.
        if lit:
            polygon(d, [(x-radius*.85,y-radius*.16),(x-radius*.37,y-radius*.50),
                        (x+radius*.43,y-radius*.54),(x+radius*.29,y-radius*.22),
                        (x-radius*.30,y-radius*.08)], palette[2])
        for j in range(9):
            a, r = rng.uniform(2.75, 6.9), radius * math.sqrt(rng.random())
            xx, yy = x + math.cos(a) * r, y + math.sin(a) * r * .62
            direction = (-1 if j % 3 else 1) * rng.uniform(3, 6)
            col = palette[rng.choice((1, 2, 2, 3, 4 if lit and j < 2 else 2))]
            polygon(d, [(xx, yy + 2), (xx + direction * .4, yy - .5),
                        (xx + direction + 1, yy - 1.7), (xx + direction, yy + .6)], col)


def botanical_tiles(paper):
    tiles = {}
    for i, painter in enumerate((aspidistra, fern, sedge, hydrangea, sapling)):
        for layer in (0, 1):
            plate = paper(132, 116, CLEAR)
            painter(plate, random.Random(7451 + i * 211 + layer * 37), bool(layer))
            tiles[f'herb{i}-{layer}'] = plate
    for i in range(5):
        plate = paper(238, 220, CLEAR)
        canopy(plate, random.Random(817 + i * 29), i in (1, 4), i)
        tiles[f'tree{i}'] = plate
    plate = paper(104, 21, CLEAR)
    groundcover(plate, random.Random(184))
    tiles['gutter growth'] = plate
    plate = paper(112, 164, CLEAR)
    climber(plate, random.Random(992))
    tiles['teika climber'] = plate
    return tiles
