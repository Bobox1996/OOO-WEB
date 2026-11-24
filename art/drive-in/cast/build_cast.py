"""Build the editable OOO cast and the lightweight posed-part runtime library.

Run with Blender 5.3 in background mode, supplying this file to --python.
Artists can edit the individually named shapes in the source file. Runtime meshes
retain body pivots and share one vertex-colour material. One unit is one metre.
"""
from math import cos, sin, pi, sqrt, radians, exp
from pathlib import Path
from collections import defaultdict

import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
WEB = OUT.parents[2] / "public/drive-in/models"
WEB.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
TAU = 2 * pi
palette = {}
active_part = None
active_collection = None
alpha_mat = None


def linear(s):
    v = int(s, 16) / 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def paint(hex_code):
    if hex_code in palette:
        return palette[hex_code]
    mat = bpy.data.materials.new(hex_code)
    col = tuple(linear(hex_code[i:i+2]) for i in (0, 2, 4)) + (1,)
    mat.diffuse_color = col
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = col
    bs.inputs["Roughness"].default_value = .68
    palette[hex_code] = mat
    return mat


def obj(name, mesh=None):
    o = bpy.data.objects.new(name, mesh)
    active_collection.objects.link(o)
    return o


def shape(name, verts, faces, color, smooth=True):
    geo = bpy.data.meshes.new(name)
    geo.from_pydata(verts, [], faces)
    geo.update()
    o = obj(name, geo)
    o.parent = active_part
    # Shapes are authored at figure-local coordinates and grouped about pivots.
    o.location = -active_part.location
    o.data.materials.append(paint(color) if isinstance(color, str) else color)
    for p in geo.polygons:
        p.use_smooth = smooth
    return o


def rings(name, rows, color, caps=True, smooth=True):
    n = len(rows[0])
    faces = []
    for j in range(len(rows)-1):
        for i in range(n):
            k = (i+1) % n
            faces.append((j*n+i, j*n+k, (j+1)*n+k, (j+1)*n+i))
    if caps:
        faces.extend((tuple(reversed(range(n))), tuple((len(rows)-1)*n+i for i in range(n))))
    return shape(name, [p for ring in rows for p in ring], faces, color, smooth)


def profile(name, loc, levels, color, n=22):
    x,y,z = loc
    rows = [[(x+rx*cos(TAU*i/n), y+ry*sin(TAU*i/n), z+dz)
             for i in range(n)] for dz,rx,ry in levels]
    return rings(name, rows, color)


def oval(name, p, sizes, color, n=18, m=10, tilt=0):
    x,y,z = p
    rx,ry,rz = sizes
    rows=[]
    for j in range(m+1):
        a = -pi/2+.033+(pi-.066)*j/m
        row=[]
        for i in range(n):
            ang=TAU*i/n
            dx=rx*cos(a)*cos(ang)
            dz=rz*sin(a)
            row.append((x+dx*cos(tilt)+dz*sin(tilt), y+ry*cos(a)*sin(ang),
                        z-dx*sin(tilt)+dz*cos(tilt)))
        rows.append(row)
    return rings(name, rows, color)


def tube(name, coords, radius, color, sides=8):
    pts=[Vector(p) for p in coords]
    radii = [radius]*len(pts) if isinstance(radius, (float,int)) else radius
    rows=[]
    prev=None
    for i,p in enumerate(pts):
        axis=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        if prev is None:
            ref=Vector((0,0,1)) if abs(axis.z)<.85 else Vector((0,1,0))
            side=axis.cross(ref).normalized()
        else:
            side=(prev-axis*prev.dot(axis)).normalized()
        other=axis.cross(side)
        rows.append([tuple(p+radii[i]*(side*cos(TAU*j/sides)+other*sin(TAU*j/sides))) for j in range(sides)])
        prev=side
    return rings(name, rows, color)


def rounded_label(name, center, width, height, radius, depth, color):
    x,y,z=center
    outline=[]
    for dx,dz,base in [(width/2-radius,height/2-radius,0),(-width/2+radius,height/2-radius,90),
                       (-width/2+radius,-height/2+radius,180),(width/2-radius,-height/2+radius,270)]:
        for j in range(4):
            a=radians(base+j*30)
            outline.append((x+dx+radius*cos(a), z+dz+radius*sin(a)))
    n=len(outline)
    verts=[(a,y+d,b) for d in (depth/2,-depth/2) for a,b in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return shape(name,verts,faces,color,False)


INK="352E3B"
CREAM="FFF0CD"
WHITE="FFF9EB"
BRASS="E9AE63"
ROSTER=[
    # hair style, cut, skin, blush, hair, highlight, coat, contrast, slacks, shoe, role detail
    ("rain","rain","EDBA94","CB7E70","483A40","6C5451","E7B345","416C70","5B7477","426D6B","slicker"),
    ("crop","visor","D39B76","B77568","403337","685056","678A79","E9DBC1","49585C","735447","apron"),
    ("bun","pin","E9BD9F","D38F85","5A3A33","86594B","546E7E","D19280","6D6063","4D4748","apron"),
    ("curls","glasses","AC795D","A46257","423136","66484A","BD7353","F5C980","435E65","473E43","knit"),
    ("bob","beret","F1C7A6","DC958B","513C51","755A6C","79979A","EBD9AA","69617B","6A4F4B","trench"),
    ("sweep","beanie","CA9376","B77265","423D43","64575A","77849F","E9B5A3","514F62","546565","hoodie"),
    ("braid","kerchief","BA866D","AB6B60","554039","755445","CB8B73","738D79","677C6B","5C4640","overalls"),
    ("silver","glasses","E6B997","C98170","ADADA8","D1CFC6","806F82","D9B180","656478","795B4E","blazer"),
]

PART_PIVOTS={"Body":(0,0,0), "Head":(0,0,.815),
             "ArmL":(.19,0,.735),"ArmR":(-.19,0,.735),
             "LegL":(.092,0,.38),"LegR":(-.092,0,.38)}
root_parts={}


def group(root, part):
    global active_part
    active_part=root_parts[root.name][part]


def ring_front(name,p,rx,rz,thick,color):
    x,y,z=p
    seg=19
    coords=[(x+rx*cos(TAU*i/seg),y,z+rz*sin(TAU*i/seg)) for i in range(seg+1)]
    tube(name,coords,thick,color,7)


def face(data, idx):
    hair,hat,skin,cheek,base,hi,coat,accent,pants,shoe,style=data
    # Cranial profile flattens slightly across the forehead, with a soft apple cheek.
    levels=[(0,.074,.074),(.023,.142,.12),(.072,.219,.183),(.14,.271,.213),
            (.234,.295,.245),(.328,.292,.247),(.423,.261,.222),(.489,.207,.176),(.53,.13,.102),(.543,.033,.024)]
    cz=.829
    profile("Rounded cheek and jaw",(0,0,cz),levels,skin,32)
    for s in (-1,1):
        oval("Ear",(.281*s,-.002,1.075),(.064,.039,.080),skin,16,8,tilt=.12*s)
        oval("Ear inner",(.31*s,-.031,1.077),(.026,.014,.047),cheek,12,7,tilt=.18*s)
        eye_x=s*.107
        eye_z=1.093+(.003*s if idx in (2,3,6) else 0)
        oval("Eye dark outline",(eye_x,-.229,eye_z),(.041,.023,.062),INK,18,10,tilt=-s*.055)
        iris=["596A67","5A685D","7C564A","685145","566B72","535D76","75634D","647169"][idx]
        oval("Eye iris",(eye_x+.002,-.245,eye_z-.012),(.024,.011,.035),iris,16,9)
        oval("Eye glint",(eye_x-.012,-.256,eye_z+.024),(.011,.005,.014),WHITE,12,7)
        oval("Cheek paint",(.182*s,-.192,1.026),(.041,.013,.019),cheek,16,8,tilt=-s*.13)
        if idx in (1,3,6):
            for k in range(3):
                oval("Freckle",((.166+.014*k)*s,-.204+.006*k,1.027+.005*(k%2)),(.004,.003,.004),base,8,5)
        tube("Brow",[(s*.071,-.238,1.174),(s*.103,-.234,1.186+(idx%2)*.003),(s*.139,-.217,1.179)],
             [.005,.009,.004],base,8)
        if idx in (2,4,6):
            tube("Upper lash",[(s*.131,-.236,1.115),(s*.15,-.226,1.127),(s*.157,-.222,1.133)],
                 [.006,.005,.002],INK,7)
    oval("Round nose",(0,-.246,1.034),(.030,.027,.024),cheek,16,9)
    zshift=(0,.003,-.003,.002,0,-.001,.003,.002)[idx]
    tube("Smile",[(-.041,-.212,.974),(-.023,-.216,.967),(0,-.216,.963),
                  (.024,-.216,.968+zshift),(.044,-.214,.977+zshift)],
         [.004,.006,.006,.006,.004],"894F4A",8)
    if hat == "glasses":
        for s in (-1,1):
            ring_front("Acetate lens rim",(s*.107,-.262,1.095),.077,.073,.0085,base)
            tube("Spectacle temple",[(s*.180,-.26,1.105),(s*.223,-.199,1.13),(s*.298,-.045,1.12)],.007,base)
        tube("Bridge",[(-.032,-.262,1.10),(0,-.271,1.115),(.032,-.262,1.10)],.008,base)


def hairdo(data,idx):
    cut,hat,skin,cheek,base,hi,coat,accent,pants,shoe,style=data
    n=40
    rows=[]
    # A single continuous scalp with a hand-shaped fringe and lower nape.
    for j in range(13):
        row=[]
        for i in range(n):
            a=TAU*i/n
            front=max(0,-sin(a))
            length=1.95+(.30 if cut in ("bob","braid","bun") else .10)
            edge=length-(length-1.19)*front**1.8
            edge+=.12*cos(3*a+.9)*front+.08*cos(5*a-.5)*front
            phi=edge*(1-j/12)+.025*j/12
            row.append((.321*sin(phi)*cos(a),.287*sin(phi)*sin(a)+.008,1.117+.292*cos(phi)))
        rows.append(row)
    rings("Sculpted hairline",rows,base)
    if hat not in ("beret","beanie") and cut!="curls":
        for k in range(6):
            trace=[]
            for j in range(6):
                u=j/5
                phi=.30+.64*u+.045*(k%2)
                a=-2.88+.46*k+.22*sin(u*pi)-.26*u
                trace.append((.322*sin(phi)*cos(a),.289*sin(phi)*sin(a)+.008,
                              1.117+.293*cos(phi)))
            tube("Combed crown strand",trace,[.001,.0028,.0034,.0034,.0028,.001],hi,7)
    for k,(x,z,tilt) in enumerate([(-.209,1.187,.32),(-.143,1.218,.57),(-.063,1.243,.68),(.041,1.254,.75),(.161,1.221,.39),(.226,1.176,.18)]):
        if cut in ("bun","rain","silver","sweep","crop") and k==0:
            continue
        if cut=="curls":
            continue
        if cut in ("crop","silver"):
            z+=.018*cos(k*1.5);tilt+=.35
        if cut in ("braid","bun"):
            z+=.02*(k-2)/3;tilt-=.38
        y=-.243*sqrt(max(.0,1-(x/.31)**2))
        oval("Fringe lock",(x,y,z),(.052,.032,.08 if k<4 else .067),base,14,8,tilt)
        if k in (1,3,4):
            tube("Hair ridge",[(x+.009,y-.028,z+.025),(x,y-.032,z+.01),(x-.014,y-.03,z-.008)],
                 [.002,.003,.001],hi,6)
    if cut=="bun":
        oval("Hair knot",(.135,.138,1.345),(.124,.106,.117),base,20,10)
        ring_front("Bun tie",(.127,.058,1.321),.096,.056,.009,accent)
        for k in range(3):
            tube("Braided bun shine",[(.087+k*.026,.039,1.36),(.1+k*.026,.033,1.381),(.117+k*.026,.044,1.397)],
                 [.002,.004,.002],hi,6)
        for k in range(2):
            tube("Enamel hairpin",[(.136,-.182,1.247+k*.016),(.185,-.157,1.273+k*.016)],.006,"F2B977",8)
    if cut=="curls":
        for row,(rad,z,amount) in enumerate([(.226,1.285,11),(.151,1.347,8),(.066,1.374,5)]):
            for k in range(amount):
                a=(k+.35*row)*TAU/amount
                oval("Crown curl",(rad*cos(a),rad*.87*sin(a),z+.009*cos(k*1.5)),
                     (.079,.069,.066),base,15,8,tilt=.23*cos(a))
        for k in range(14):
            a=TAU*k/14
            z=1.20+.055*max(0,-sin(a))+.013*(k%2)
            oval("Woolly curl",(.238*cos(a),.18*sin(a),z),(.074,.064,.081),base,14,8,tilt=.24*cos(a))
        for k in range(5):
            x=(k-2)*.066
            oval("Forelock curl",(x,-.205+abs(x)*.16,1.225+.026*cos(k*1.2)),(.056,.048,.06),
                 base if k%2 else hi,14,8)
    if cut in ("bob","braid"):
        for s in (-1,1):
            if cut=="bob":
                oval("Bob side panel",(s*.242,.002,1.09),(.064,.165,.17),base,17,9,tilt=-s*.13)
            else:
                for k in range(3):
                    oval("Braided plait",(s*(.265+.015*sin(k)),.065,.993-k*.059),(.059-k*.005,.067,.067),base,16,8,tilt=s*(.35 if k%2 else -.35))
                oval("Braid ribbon",(s*.272,.06,.856),(.046,.048,.019),accent,12,6)
    if hat in ("visor","beret","beanie","kerchief"):
        if hat=="visor":
            profile("Canvas visor band",(0,.004,1.236),[(0,.297,.261),(.01,.299,.265),(.067,.268,.235)],coat,32)
            oval("Visor brim",(0,-.223,1.254),(.241,.122,.022),coat,24,8,tilt=-.05)
            rounded_label("Visor patch",(0,-.249,1.278),.091,.037,.009,.006,accent)
        elif hat=="beret":
            profile("Beret welt",(.018,.012,1.281),[(0,.239,.194),(.025,.257,.211),(.055,.257,.207)],base,28)
            oval("Soft beret",(.053,.016,1.349),(.284,.232,.095),"B97671",28,12,tilt=.13)
            tube("Beret stem",[(.05,.015,1.43),(.058,.017,1.459)],.016,"A56462")
        elif hat=="beanie":
            profile("Rib beanie",(0,.006,1.24),[(0,.294,.263),(.018,.306,.271),(.08,.288,.255),(.146,.247,.218),(.205,.16,.137),(.23,.063,.062)],accent,32)
            for k in range(28):
                a=k*TAU/28
                tube("Knit rib",[(.303*cos(a),.006+.269*sin(a),1.267),(.291*cos(a),.006+.258*sin(a),1.307)],.0035,"CB9388",6)
            rounded_label("Knit label",(.078,-.249,1.286),.057,.029,.004,.004,"FBE2BD")
        else:
            for s in (-1,1):
                oval("Kerchief bow",(s*.061,-.006,1.388),(.055,.035,.087),accent,15,8,tilt=s*.71)
            tube("Headscarf band",[(-.251,-.04,1.22),(-.192,-.005,1.341),(0,.00,1.398),(.19,-.005,1.341),(.254,-.04,1.222)],.024,accent,10)
    if cut=="silver":
        for s in (-1,1):
            oval("Silver temples",(s*.247,-.036,1.13),(.031,.069,.095),hi,14,8,tilt=s*.22)

def clothing(root,data,idx):
    cut,hat,skin,cheek,hair,hi,coat,accent,pants,shoe,style=data
    group(root,"Body")
    profile("Neck",(0,0,.784),[(0,.072,.064),(.093,.075,.068)],skin)
    profile("Trouser seat",(0,0,.342),[(0,.147,.085),(.068,.165,.115),(.12,.155,.104)],pants)
    bottom=.356 if style in ("trench","slicker") else .406
    profile("Outerwear silhouette",(0,.004,bottom),[(0,.183,.120),(.014,.192,.125),(.055,.189,.129),
        (.647-bottom,.16,.107),(.724-bottom,.196,.114),(.765-bottom,.157,.106),(.811-bottom,.079,.083)],coat,28)
    if style in ("overalls","apron"):
        bib = accent if style=="apron" else pants
        for s in (-1,1):
            tube("Bib strap",[(s*.079,-.032,.786),(s*.101,-.093,.75),(s*.1,-.111,.665)],.016,bib,9)
            oval("Brass stud",(s*.101,-.124,.673),(.012,.006,.012),BRASS,12,6)
        rounded_label("Bib apron",(0,-.118,.591),.244,.192,.029,.014,bib)
        rounded_label("Lower apron",(0,-.12,.469),.323,.128,.03,.016,bib)
        rounded_label("Patch pocket",(0,-.132,.484),.155,.076,.016,.012,coat)
        tube("Pocket stitch",[(-.067,-.141,.49),(-.06,-.142,.456),(0,-.145,.45),(.06,-.142,.457),(.068,-.141,.49)],.0026,accent if style=="overalls" else bib)
        if style=="apron":
            rounded_label("Name badge",(-.048,-.136,.645),.074,.035,.008,.008,WHITE)
            for k in range(3):
                oval("Badge ink",(-.067+k*.016,-.141,.645),(.005,.002,.005),coat,8,6)
    if style in ("trench","blazer","slicker"):
        seamcolor=accent if style=="slicker" else pants
        tube("Placket",[(0,-.121,bottom+.02),(0,-.127,.472),(0,-.112,.615),(0,-.112,.719)],.005,seamcolor,7)
        for s in (-1,1):
            tube("Collar",[ (s*.061,-.054,.79),(s*.109,-.1,.74),(s*.06,-.119,.701),(s*.018,-.115,.748)],.018,coat if style=="trench" else accent,9)
            tube("Welt pocket",[(s*.109,-.113,.487),(s*.153,-.086,.514)],.007,seamcolor,7)
        for k in range(3):
            oval("Button",(.017,-.124+.005*k,.486+k*.081),(.009,.006,.009),BRASS,10,6)
        if style=="slicker":
            oval("Folded rain hood",(0,.078,.766),(.151,.132,.089),accent,18,8)
            tube("Reflective storm yoke",[(-.153,-.075,.667),(-.085,-.112,.662),(0,-.12,.662),(.085,-.112,.662),(.153,-.075,.667)],.008,CREAM,8)
        if style=="blazer":
            oval("Woven scarf",(0,-.021,.78),(.107,.098,.051),accent,20,8)
            rounded_label("Scarf tail",(-.047,-.108,.709),.056,.11,.012,.022,accent)
    if style=="knit":
        for k in range(2):
            z=.626+k*.043
            rx=.166+k*.012
            profile("Knit stripe",(0,.003,z),[(0,rx,.115),(.015,rx+.002,.115)],accent,24)
        for k in range(5):
            x=(k-2)*.044
            y=-.119+.016*(abs(k-2)/2)
            tube("Fair isle diamond",[(x-.012,y,.588),(x,y-.002,.607),(x+.012,y,.588),(x,y-.002,.571),(x-.012,y,.588)],.004,CREAM,6)
    if style=="hoodie":
        oval("Folded hood",(0,.058,.76),(.15,.12,.079),accent,20,8)
        for s in (-1,1):
            tube("Cotton drawstring",[(s*.049,-.092,.763),(s*.054,-.123,.704),(s*.065,-.115,.66)],.005,CREAM)
        rounded_label("Kangaroo pouch",(0,-.123,.485),.197,.071,.018,.016,coat)
    for s,limb in [(1,"L"),(-1,"R")]:
        group(root,"Leg"+limb)
        x=.092*s
        profile("Trouser leg",(x,0,.142),[(0,.064,.064),(.022,.071,.071),(.12,.069,.07),(.22,.077,.079),(.253,.07,.073)],pants,18)
        if style=="overalls":
            profile("Turn up cuff",(x,0,.164),[(0,.071,.073),(.035,.074,.074)],accent,18)
        profile("Sock",(x,0,.095),[(0,.059,.058),(.078,.061,.06)],CREAM,16)
        if style=="slicker":
            profile("Rubber boot shaft",(x,0,.075),[(0,.07,.068),(.12,.073,.077),(.139,.081,.082)],shoe,20)
            profile("Boot cuff",(x,.0,.199),[(0,.08,.081),(.021,.082,.083)],accent,20)
        profile("Crepe sole",(x,-.034,.012),[(0,.075,.114),(.011,.083,.125),(.029,.080,.121)],"B79576",20)
        oval("Toecap",(x,-.041,.084),(.08,.121,.059),shoe,20,10)
        if style not in ("slicker","trench"):
            for k in range(2):
                tube("Shoelace",[(x-.029,-.08+k*.022,.124+k*.005),(x,-.089+k*.022,.132+k*.004),
                    (x+.029,-.08+k*.022,.124+k*.005)],.004,CREAM,6)
        group(root,"Arm"+limb)
        # Slightly bent elbows distinguish the pose at mid-distance.
        tx=s*.232
        hand_y=-.092
        hand_z=.48
        holding=(idx==0 and s==-1) or (idx in (1,2,3,4,5,6,7) and s==(1 if idx%2 else -1))
        if holding:
            tx=s*.226;hand_y=-.175;hand_z=.572
        positions=[(s*.167,0,.739),(s*.2,-.007,.699),(s*.237,-.009,.623),
                   (tx,-.048 if holding else -.035,.571),(tx,hand_y+.02,hand_z+.033)]
        oval("Soft shoulder",(s*.178,-.004,.712),(.077,.076,.067),coat,16,8,tilt=-s*.22)
        tube("Sleeve",positions,[.064,.078,.073,.064,.056],coat,14)
        tube("Sleeve hem",[positions[-2],positions[-1]],[.063,.058],accent if style in ("knit","hoodie","trench") else coat,14)
        oval("Mitten hand",(tx,hand_y,hand_z),(.056,.059,.059),skin,16,8,tilt=-s*.23)
        oval("Thumb",(tx-s*.042,hand_y-.023,hand_z+.012),(.023,.035,.032),skin,12,7)
        if not holding or idx==0:
            continue
        if idx in (1,3,7):
            cover=["","A46658","","729A90","","","","B18B61"][idx]
            rounded_label("Pocket notebook",(tx,hand_y-.027,hand_z+.063),.125,.146,.01,.035,cover)
            rounded_label("Notebook label",(tx,hand_y-.048,hand_z+.09),.065,.025,.005,.004,CREAM)
            tube("Notebook spine",[(tx-.048,hand_y-.046,hand_z),(tx-.048,hand_y-.046,hand_z+.125)],.004,INK)
        elif idx in (2,5):
            profile("Takeaway cup",(tx,hand_y-.025,hand_z+.007),[(0,.032,.032),(.099,.045,.045)],CREAM,16)
            profile("Cup sleeve",(tx,hand_y-.025,hand_z+.031),[(0,.036,.036),(.039,.041,.041)],accent,16)
            profile("Cup cap",(tx,hand_y-.025,hand_z+.104),[(0,.047,.047),(.014,.046,.046),(.02,.038,.038)],WHITE,16)
        else:
            # Handles clear the hand and let the bag hang beside the leg.
            x=tx+s*.045
            ring_front("Carrier handle",(x,hand_y,hand_z-.046),.046,.062,.008,"B79467")
            rounded_label("Canvas market tote",(x,hand_y,hand_z-.153),.16,.17,.022,.078,CREAM)
            for k in range(3):
                ring_front("Tote mark",(x+(k-1)*.027,hand_y-.043,hand_z-.144),.012,.016,.0035,accent)


def umbrella(root):
    group(root,"Umbrella")
    x=-.227;y=-.167
    # The pole leans back behind the face. Ribs and trimmed scallops catch wet-night lighting.
    cx=-.15;cy=.035
    tube("Brushed umbrella shaft",[(x,y,.569),(x,y,.735),(cx-.027,cy-.048,1.46),(cx,cy,1.689)],.009,"AFBBBE",10)
    tube("Curved umbrella handle",[(x+.032,y,.51),(x+.029,y,.492),(x+.012,y,.487),(x-.002,y,.499),
        (x,y,.529),(x,y,.621)],.015,"865E47",10)
    n=9;r=.551
    for k in range(n):
        a=TAU*k/n
        def pos(t,u):
            tangle=a+u*TAU/n
            scallop=sin(pi*u)*t*t
            rr=r*t*(1-.085*scallop)
            return (cx+rr*cos(tangle),cy+rr*sin(tangle),1.708-.158*t*t-.056*t-.019*scallop)
        facet=[]
        for v in range(6):
            for h in range(5):
                facet.append(pos(.014+.986*v/5,h/4))
        polys=[(j*5+i,j*5+i+1,(j+1)*5+i+1,(j+1)*5+i) for j in range(5) for i in range(4)]
        shape("Clear umbrella panel",facet,[tuple(reversed(f)) for f in polys],alpha_mat)
        tube("Steel canopy rib",[pos(t,0) for t in (.01,.22,.47,.75,1)],.0045,"ABBABC",6)
        tube("Rain binding",[pos(1,h/6) for h in range(7)],.007,"A2C4C2",7)
        ex,ey,ez=pos(1,0)
        oval("Rubber umbrella tip",(ex,ey,ez-.004),(.008,.008,.012),"D8C6A2",9,5)
        if k%2:
            for t,u in ((.64,.32),(.82,.61)):
                px,py,pz=pos(t,u)
                oval("Rain bead",(px,py,pz+.002),(.008,.011,.006),"CDDCD6",9,5)
    oval("Ferrule",(cx,cy,1.711),(.015,.015,.029),"937454",12,7)


def cast_member(idx,data):
    global active_collection
    name="Player" if idx==0 else f"Member{idx:02}"
    active_collection=bpy.data.collections.new(f"{name} | {data[10]}")
    scene.collection.children.link(active_collection)
    root=obj(name)
    root.empty_display_type="CIRCLE"
    root.empty_display_size=.20
    root_parts[name]={}
    pivots=dict(PART_PIVOTS)
    if idx == 0:
        pivots["Umbrella"]=PART_PIVOTS["ArmR"]
    for part,pivot in pivots.items():
        part_root=obj(f"{name}_{part}")
        part_root.parent=root
        part_root.location=pivot
        part_root.empty_display_size=.035
        root_parts[name][part]=part_root
    root.location=((idx%4-1.5)*1.34,(idx//4)*2.25,0)
    group(root,"Head")
    face(data,idx)
    hairdo(data,idx)
    clothing(root,data,idx)
    if idx==0:
        umbrella(root)
    return root


def merge_draws(root, part, children, transparent=False):
    verts=[]; faces=[]; colors=[]; smooth=[]
    pivot=Vector(part.location)
    for source in children:
        col=tuple(source.data.materials[0].diffuse_color)
        offset=len(verts)
        verts.extend(tuple(v.co-pivot) for v in source.data.vertices)
        colors.extend([col]*len(source.data.vertices))
        for poly in source.data.polygons:
            faces.append([v+offset for v in poly.vertices]);smooth.append(poly.use_smooth)
    if not verts:return
    geo=bpy.data.meshes.new(part.name+("Canopy" if transparent else "Surface"))
    geo.from_pydata(verts,[],faces)
    geo.update()
    merged=bpy.data.objects.new(geo.name,geo)
    scene.collection.objects.link(merged)
    merged.parent=part
    if transparent:
        geo.materials.append(alpha_mat)
    else:
        geo.materials.append(runtime_material)
        attr=geo.color_attributes.new(name="Palette",type="BYTE_COLOR",domain="POINT")
        cl=[c for color in colors for c in color]
        attr.data.foreach_set("color",cl)
    for p,v in zip(geo.polygons,smooth):p.use_smooth=v
    return merged


alpha_mat=paint("B4D8E0").copy()
alpha_mat.name="Umbrella | smoked clear vinyl"
alpha_mat.diffuse_color=(*alpha_mat.diffuse_color[:3],.14)
bs=alpha_mat.node_tree.nodes.get("Principled BSDF")
bs.inputs["Alpha"].default_value=.14
bs.inputs["Roughness"].default_value=.23
alpha_mat.surface_render_method="BLENDED"
alpha_mat.use_backface_culling=False

roots=[cast_member(i,data) for i,data in enumerate(ROSTER)]
# The source opens as an arranged cast sheet while each exported tree stands at its own origin.
scene.render.engine="BLENDER_WORKBENCH"
shade=scene.display.shading
shade.light="STUDIO"
shade.color_type="MATERIAL"
shade.show_shadows=True
shade.show_cavity=True
shade.cavity_type="WORLD"
shade.background_type="WORLD"
world=bpy.data.worlds.new("Indigo sketch stage")
world.color=(.07,.094,.13)
scene.world=world
for area in bpy.context.screen.areas:
    if area.type=="VIEW_3D":
        sp=area.spaces.active
        sp.region_3d.view_distance=6.4
        sp.region_3d.view_location=(0,.95,.82)
        sp.region_3d.view_rotation=Vector((0,7,-2)).to_track_quat('-Z','Y')
        sp.shading.color_type="MATERIAL"
        sp.overlay.show_overlays=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"cast.blend"),compress=True)

runtime_material=bpy.data.materials.new("OOO | enamel and fabric")
runtime_material.use_nodes=True
bs=runtime_material.node_tree.nodes.get("Principled BSDF")
bs.inputs["Roughness"].default_value=.68
node=runtime_material.node_tree.nodes.new("ShaderNodeVertexColor")
node.layer_name="Palette"
runtime_material.node_tree.links.new(node.outputs["Color"],bs.inputs["Base Color"])
exports=[]
for root in roots:
    root.location=(0,0,0)
    exports.append(root)
    for part in root_parts[root.name].values():
        children=list(part.children)
        opaque=[c for c in children if c.data.materials[0]!=alpha_mat]
        glass=[c for c in children if c.data.materials[0]==alpha_mat]
        exports.append(part)
        for group_,trans in ((opaque,False),(glass,True)):
            if group_:
                exports.append(merge_draws(root,part,group_,trans))
        for source in children:
            bpy.data.objects.remove(source,do_unlink=True)
    if root.name=="Player":
        canopy=root_parts[root.name]["Umbrella"]
        canopy.parent=root_parts[root.name]["ArmR"]
        canopy.location=(0,0,0)
bpy.ops.object.select_all(action="DESELECT")
for o in exports:
    o.select_set(True)
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(WEB/"cast.glb"),export_format="GLB",use_selection=True,
    export_yup=True,export_texcoords=False,export_cameras=False,export_lights=False,
    export_animations=False,export_attributes=False,export_all_vertex_colors=True,export_image_format="AUTO")
print("Editable models and grouped web cast written.")
