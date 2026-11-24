"""Build the editable sea-facing listening room and the equivalent batched web model.

Run node art/pixelscape/house/interior-finishes/make.cjs then run this file in Blender.
Coordinates are metres, x east, y up, +z toward the street door.
"""
import bpy
import json
import math
import random
import struct
from collections import defaultdict
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FINISHES = HERE / "interior-finishes"
GLB = ROOT / "public/sumiyoshi/models/house.glb"
R = random.Random(10823)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.name = "OOO | Sea lounge"

def color(hex_value):
    srgb = [int(hex_value[k:k+2], 16) / 255 for k in (0, 2, 4)]
    return tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in srgb) + (1,)

tile = {}
def finish(name, swatch, rough=.65, metal=0, light=0, image=None, period=(1,1), alpha=1):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color(swatch)
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Emission Color"].default_value = color(swatch)
    shader.inputs["Emission Strength"].default_value = light
    shader.inputs["Alpha"].default_value = alpha
    mat.diffuse_color = color(swatch)
    if image:
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str(FINISHES / (image+".png")), check_existing=True)
        tex.image.pack()
        tex.interpolation = "Closest"
        mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
        tile[mat] = period
    return mat

oak = finish("Honey oak | flitch-matched panels", "ae7c50", .49, image="honey-oak", period=(3.87,2.79))
plaster = finish("Ceiling_Lounge shell | limewash", "c8b6a3", .91, image="ecru-plaster", period=(3,3))
limestone = finish("Satin limestone floor", "a7a39d", .46, image="smoke-screed", period=(2.5,2.5))
travertine = finish("Honed Roman travertine", "c5afa5", .49, image="dune-travertine", period=(1.65,.82))
rug = finish("Oat handtuft wool | tight loop", "bfac91", .93, image="oat-boucle", period=(.46,.46))
linen = finish("Parchment lounge linen", "d4c8b5", .87, image="ivory-linen", period=(.50,.50))
leather = finish("Carbon aniline leather", "373735", .46, image="graphite-leather", period=(.38,.38))
sheer = finish("Ivory voile at window", "dad6c8", .89, alpha=.70)
blind = finish("Sea mist | translucent reed fabric", "c5c2af", .87,
    image="mist-sudare", period=(.40,.33), alpha=.50)
reed = finish("Woven cane blind | face", "a49880", .81)
reedShadow = finish("Woven cane blind | thread", "655f55", .89)
black = finish("Blackened steel", "232323", .48,.35)
dark = finish("Shadow reveal", "262220", .88)
bronze = finish("Aged champagne bronze", "a78b63", .37,.58)
lining = finish("Inside of hearth | smoked bronze", "685445", .46,.16)
reglet = finish("Soft timber-grey ceiling inset", "968b7f", .87)
amber = finish("Recess | warm diffused lamp", "ffd39b", .78, light=2.0)
milk = finish("Frosted opal glass", "ffe2b5", .65, light=1.1)
binding = finish("Graphite upholstery welt", "4a4742", .72)
piping = finish("Linen seam", "b6a78e", .87)
walnut = finish("Smoked walnut", "5c4233", .53)
paper = finish("Book block / ivory paper", "c6bca4", .88)
record_colors = [finish("Record sleeve | "+name,c,.78) for name,c in [
    ("vellum","c8bb9a"),("sage","899180"),("ecru","a59c8b"),("claret","8b493a"),
    ("slate","576274"),("charcoal","424747"),("ochre","b08348"),("bone","d1c8b5")]]
labels = finish("Record spindle and spine ink", "97918a", .63)
smooth = {leather, linen, sheer, binding, piping}
parts = defaultdict(lambda: [[],[],[]])
section = ""

def mesh(name, mat, vertices, faces, uvs=None):
    verts, polys, uv = parts[(section,name,mat)]
    start = len(verts)
    verts.extend(vertices)
    sx, sy = tile.get(mat,(1,1))
    for idx,f in enumerate(faces):
        polys.append(tuple(start+i for i in f))
        if uvs is not None:
            uv.extend(uvs[idx])
            continue
        a,b,c = [Vector(vertices[i]) for i in f[:3]]
        n = (b-a).cross(c-a)
        for i in f:
            x,y,z = vertices[i]
            if abs(n.y) >= max(abs(n.x),abs(n.z)):
                u,v=x,z
            elif abs(n.x)>abs(n.z):
                u,v=z,y
            else:
                u,v=x,y
            uv.append((u/sx,v/sy))

def box(name,mat,center,dims,yaw=0):
    x,y,z=center
    a,b,c=(v*.5 for v in dims)
    co,si=math.cos(yaw),math.sin(yaw)
    v=[(x+dx*a*co+dz*c*si,y+dy*b,z-dx*a*si+dz*c*co) for dx,dy,dz in
       [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    mesh(name,mat,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)])

def tube(name,mat,path,radii,segments=12):
    points = [Vector(p) for p in path]
    if isinstance(radii,(float,int)):
        radii = [radii]*len(points)
    v,f=[],[]
    for j,p in enumerate(points):
        direction=(points[min(j+1,len(path)-1)]-points[max(0,j-1)]).normalized()
        base=Vector((0,1,0)) if abs(direction.y)<.85 else Vector((1,0,0))
        side=direction.cross(base).normalized()
        up=direction.cross(side).normalized()
        for i in range(segments):
            t=math.tau*i/segments
            v.append(tuple(p+(side*math.cos(t)+up*math.sin(t))*radii[j]))
    f.append(tuple(reversed(range(segments))))
    for j in range(len(points)-1):
        for i in range(segments):
            a=j*segments+i
            b=j*segments+(i+1)%segments
            f.append((a,b,b+segments,a+segments))
    f.append(tuple(range((len(points)-1)*segments,len(points)*segments)))
    mesh(name,mat,v,f)

def lathe(name,mat,x,z,profile,sides=36):
    tube(name,mat,[(x,y,z) for y,r in profile],[r for y,r in profile],sides)

section="01 | continuous shell, oak joinery and threshold"
box("Continuous warm limestone slab",limestone,(0,-.06,.17),(10.9,.12,8.28))
# Full-height sheets sit on a recessed dark skirting. World-aligned texture mapping
# keeps the matched leaves continuous across fine joint widths and door reveals.
for side in (-1,1):
    x=side*5.4
    # Carry the backing past both corners and into the lid. The slim reveal at
    # the top of the veneer sees this dark return from every indoor viewpoint.
    box("Oak panel backing",dark,(x,1.685,.20),(.13,3.39,8.4))
    for i in range(7):
        z=-3.78+(i+.5)*1.15
        box("Bookmatched return panel %02d"%i,oak,(x-side*.075,1.6725,z),(.065,3.215,1.143))
    box("Recessed shadow plinth",walnut,(x-side*.048,.045,.20),(.10,.08,8.06))
box("Entrance wall backing",dark,(0,1.675,4.33),(10.91,3.41,.13))
for a,b in [(-5.37,-4.25),(-4.25,-3.13),(-3.13,-2.01),(-2.01,-.89),(-.89,.23),(.23,1.35),(1.35,2.47),(2.47,3.29),(4.50,5.37)]:
    box("Entrance full-height panel",oak,((a+b)/2,1.66,4.235),(b-a-.009,3.21,.082))
box("Architrave-free street door",oak,(3.90,1.145,4.248),(1.176,2.18,.085))
box("Flush overpanel",oak,(3.90,2.76,4.235),(1.20,.99,.082))
box("Oak pocket handle",black,(4.28,1.055,4.184),(.041,.31,.025))
box("Lever face",bronze,(4.274,1.057,4.165),(.018,.207,.012))
box("Door threshold",bronze,(3.90,.007,4.10),(1.18,.014,.10))
box("Recessed reveal beneath entry credenza",dark,(-4.06,.085,3.93),(2.05,.17,.54))
box("Floating oak entry credenza",oak,(-4.06,.322,3.88),(2.20,.376,.72))
for x in (-4.77,-4.06,-3.35):
    box("Edge pull at flush door",walnut,(x,.479,3.516),(.43,.009,.009))
lathe("Oxidised bronze bottle",bronze,-4.82,3.92,
    [(.51,.066),(.524,.074),(.68,.078),(.74,.053),(.81,.031),(.819,.033)],22)

section="02 | seamless plaster lid, lighting apertures and perimeter pocket"
box("Ceiling_Lounge",plaster,(0,3.37,.19),(10.95,.14,8.37))
for z in (-2.90,2.73):
    box("Flush linear ceiling reglet",reglet,(-1.23,3.298,z),(7.40,.007,.055))
for x in (-5.28,5.28):
    box("Continuous ceiling perimeter reglet",dark,(x,3.292,.19),(.014,.007,8.09))
for x,z in [(-1.31,.94),(-.84,.94),(-.37,.94),(2.84,-1.93),(3.31,-1.93)]:
    lathe("Trimless dark downlight",dark,x,z,[(3.296,.050),(3.301,.050)],20)
    lathe("Recessed lamp face",milk,x,z,[(3.295,.019),(3.297,.021)],16)
box("Deep pelmet at glazing head",oak,(1.39,3.15,-3.65),(7.85,.32,.44))
box("Curtain track shadow",dark,(1.39,2.99,-3.67),(7.8,.035,.21))

section="03 | floating oak hearth pier and shadow gaps"
# The light slot is cut into the front wall, exposing a real soffit, back and
# hearth shelf. Its narrow end-stop keeps the big wood plane visually quiet.
x0,x1,left,right=-5.37,-2.48,-5.03,-2.79
box("Hearth pier backing",dark,(-3.9575,1.67,-3.775),(3.005,3.42,.065))
box("Coastal window continuous lintel backing",dark,(1.46,3.185,-3.80),(8.00,.39,.12))
box("Coastal window east return",oak,(5.352,1.51,-3.74),(.25,3.04,.21))
box("Solid wall behind record library",dark,(1.46,.32,-3.83),(8.00,.75,.11))
def panel_strip(name,a,b,bottom,top,z):
    box(name,oak,((a+b)/2,(bottom+top)/2,z),(b-a,top-bottom,.13))
panel_strip("Wide timber hearth plinth",x0,x1,.045,.285,-3.51)
for a,b in [(x0,-3.93),(-3.921,x1)]:
    panel_strip("Veneered hearth pier",a,b,.535,3.225,-3.51)
panel_strip("Recess west end",x0,left,.285,.535,-3.51)
panel_strip("Recess east end",right,x1,.285,.535,-3.51)
box("Firebox lined recess",lining,((left+right)/2,.408,-3.66),(right-left,.246,.025))
box("Long steel hearth plate",black,((left+right)/2,.287,-3.54),(right-left,.023,.24))
box("Dark reveal over concealed line",dark,((left+right)/2,.522,-3.55),(right-left,.028,.21))
box("Amber hearth filament",amber,((left+right)/2,.332,-3.578),(right-left-.028,.014,.034))
box("Amber return under shelf",bronze,((left+right)/2,.316,-3.55),(right-left-.032,.021,.068))
box("Dark band above hearth",dark,((x0+x1)/2,3.254,-3.5),(x1-x0,.058,.12))
box("Oak jamb return at glass",oak,(-2.48,1.53,-3.68),(.084,3.03,.52))

section="04 | picture window, fine woven shades and curtain stacks"
for x in (-2.435,5.215):
    box("Bronze jamb",bronze,(x,1.85,-3.76),(.032,2.28,.07))
box("Inset glass threshold",black,(1.39,.726,-3.776),(7.68,.034,.08))
for x in (-.32,2.73):
    box("Fine glazed panel meeting stile",bronze,(x,1.86,-3.775),(.021,2.26,.037))
for i,(left,right,ybase) in enumerate([(-2.42,.03,2.62),(.07,2.62,2.68),(2.66,5.20,2.64)]):
    vertices,faces=[],[]
    for j in range(13):
        u=j/12
        x=left+(right-left)*u
        # A weighted, slightly relaxed lower edge. Individual reed filaments
        # live on a filtered texture, so the far blind reads as a single veil.
        y=ybase-.017*math.sin(math.pi*u)
        vertices.extend([(x,y,-3.700+.010*math.sin(math.pi*u)),(x,2.99,-3.73)])
    for j in range(12):faces.append((2*j,2*j+2,2*j+3,2*j+1))
    mesh("Drawn woven sea blind",blind,vertices,faces)
    for j in range(3):
        x=left+.13+j*(right-left-.26)/2
        box("Silk ladder cord",reed,(x,(ybase+2.98)/2,-3.688),(.009,2.98-ybase,.007))
    tube("Slim weighted blind hem",reedShadow,[(left,ybase,-3.699),((left+right)/2,ybase-.017,-3.69),
        (right,ybase,-3.699)],.010,8)
    x=right-.10
    tube("Drop cord",reedShadow,[(x,2.94,-3.69),(x+.015,ybase-.12,-3.687),(x+.027,ybase-.15,-3.686)],.005,5)
def curtain(label,x0,x1,phase):
    vertices,faces=[],[]
    rows,cols=9,54
    for j in range(rows+1):
        t=j/rows
        for i in range(cols+1):
            u=i/cols
            x=x0+(x1-x0)*u+(u-.5)*(.056*(1-t))
            fold=math.sin(u*math.tau*6.1+phase+.14*(1-t))
            y=.75+t*2.24 + .018*fold*(1-t)**5
            z=-3.62+.071*fold*(1.12-.16*t)+.016*math.sin(u*math.tau*12+phase)
            vertices.append((x,y,z))
    for j in range(rows):
        for i in range(cols):
            k=j*(cols+1)+i
            faces.append((k,k+1,k+cols+2,k+cols+1))
    mesh(label,sheer,vertices,faces)
curtain("Gathered west voile",-2.45,-2.09,.23)
curtain("Gathered east voile",4.63,5.24,.80)

section="05 | low oak record library"
box("Recessed library toe kick",dark,(1.39,.046,-3.65),(7.67,.092,.48))
box("Continuous oak window seat",oak,(1.39,.689,-3.55),(7.77,.062,.62))
box("LP cabinet back",walnut,(1.39,.37,-3.78),(7.65,.57,.074))
for y in (.115,.369):
    box("Oak shelf with thin solid edge",oak,(1.39,y,-3.55),(7.67,.035,.535))
for x in (-2.44,-1.56,-.80,-.02,.77,1.55,2.33,3.10,3.88,4.62,5.20):
    box("Record compartment divider",oak,(x,.384,-3.55),(.033,.57,.54))
# Cane-front doors at the ends frame the open LP bays.
for x,w in [(-2.00,.82),(4.92,.52)]:
    box("Cane frame",oak,(x,.395,-3.268),(w,.53,.04))
    box("Cane inset",reedShadow,(x,.395,-3.239),(w-.06,.461,.020))
    for j in range(14):
        box("Cane horizontal ribbons",reed,(x,.184+j*.032,-3.227),(w-.071,.008,.005))
    for j in range(round((w-.08)/.028)):
        box("Cane vertical ribbons",reed,(x-w/2+.043+j*.028,.395,-3.224),(.008,.45,.004))
for bay,(a,b) in enumerate([(-1.56,-.8),(-.8,-.02),(-.02,.77),(.77,1.55),(1.55,2.33),(2.33,3.10),(3.10,3.88),(3.88,4.62)]):
    for row,y in enumerate((.132,.3865)):
        x=a+.025
        stop=b-R.uniform(.043,.14)
        while x<stop-.027:
            w=min(R.uniform(.014,.047),stop-x)
            height=R.uniform(.191,.231) if row==0 else R.uniform(.235,.265)
            z=-3.31+R.uniform(-.026,.003)
            mat=R.choice(record_colors)
            box("Record jacket spines",mat,(x+w/2,y+height/2,z-.095),(max(.01,w-.002),height,.19))
            if R.random()<.35:
                box("Short paper spine label",paper,(x+w/2,y+height*.72,z+.001),(w*.70,.014,.002))
            x+=w+.0035

# The receiver and record player rest below the horizon on the window sill.
def component(name,mat,x,y,z,w,h,d):box(name,mat,(x,y+h/2,z),(w,h,d))
component("Low turntable / walnut plinth",walnut,-1.80,.725,-3.49,.50,.061,.34)
component("Brushed turntable plate",black,-1.80,.786,-3.49,.486,.014,.331)
lathe("Vinyl and label",black,-1.862,-3.49,[(.797,.119),(.804,.122)],40)
lathe("Paper record label",record_colors[3],-1.862,-3.49,[(.805,.042),(.807,.042)],24)
lathe("Polished spindle",bronze,-1.862,-3.49,[(.806,.005),(.817,.004)],10)
tube("Pick-up arm",bronze,[(-1.642,.827,-3.58),(-1.685,.83,-3.495),(-1.714,.82,-3.46)],.006,8)
component("Hi-fi receiver chassis",black,-1.21,.724,-3.49,.51,.118,.279)
component("Brushed aluminium receiver fascia",lining,-1.21,.733,-3.344,.50,.10,.012)
for j in range(11):
    box("Receiver scale ticks",labels,(-1.41+j*.018,.79,-3.333),(.006,.011 if j%3 else .02,.004))
for j in range(2):
    x=-1.078+j*.062
    tube("Knurled hi-fi control",bronze,[(x,.785,-3.337),(x,.785,-3.316)],.019 if j else .025,14)
for x in (-2.252,4.90):
    box("Compact oak monitor",walnut,(x,.93,-3.49),(.218,.416,.214))
    box("Monitor baffle",black,(x,.93,-3.371),(.198,.392,.022))
    for y,r in [(.883,.073),(1.03,.035)]:
        tube("Cloth speaker surround",dark,[(x,y,-3.358),(x,y,-3.349)],[r,r*.96],20)
        tube("Paper driver and dust cap",lining,[(x,y,-3.348),(x,y,-3.342)],[r*.78,r*.36],20)

section="06 | freestanding screen on fluted timber pedestal"
tx=1.70
box("Television outer surround",black,(tx,1.59,-2.45),(3.381,1.932,.09))
box("TVDisplaySlot",black,(tx,1.59,-2.402),(3.32,1.8675,.005))
box("Pedestal foot",black,(tx,.022,-2.50),(.81,.044,.42))
box("Pedestal core",walnut,(tx,.337,-2.495),(.55,.60,.259))
for i in range(17):
    x=tx-.256+i*.032
    box("Fluted walnut slat",oak,(x,.334,-2.349),(.021,.60,.035))
box("Receiver pilot",milk,(tx+1.59,.639,-2.396),(.021,.007,.008))

section="07 | bound wool rug and charcoal modular sofa"
box("Handtuft wool field",rug,(-.65,.018,.08),(7.85,.033,4.98))
for z in (-2.391,2.55):box("Marled bound edge",piping,(-.65,.034,z),(7.84,.008,.023))
for x in (-4.56,3.26):box("Marled bound edge",piping,(x,.034,.08),(.021,.008,4.94))

def signed_power(a,n):
    return math.copysign(abs(a)**n,a)

def soft_block(label,mat,center,dims,seam=False):
    x,y,z=center
    a,b,c=(v*.5 for v in dims)
    rings=[-1.49,-1.30,-1.02,-.70,-.36,-.12,.12,.36,.66,.95,1.18,1.38,1.49]
    sides=48
    v,f=[],[]
    for t in rings:
        yy=signed_power(math.sin(t),.64)
        bulge=math.cos(t)**.39
        for i in range(sides):
            q=math.tau*i/sides
            xx=signed_power(math.cos(q),.39)*bulge
            zz=signed_power(math.sin(q),.36)*bulge
            fold=.010*math.sin(q*13+.6)*max(0,1-abs(t-.4)*1.5)
            v.append((x+xx*(a+fold),y+b*yy,z+zz*(c+fold)))
    f.append(tuple(range(sides)))
    for j in range(len(rings)-1):
        for i in range(sides):
            k=j*sides+i
            f.append((k,k+sides,j*sides+(i+1)%sides+sides,j*sides+(i+1)%sides))
    f.append(tuple(reversed(range((len(rings)-1)*sides,len(rings)*sides))))
    mesh(label,mat,v,f)
    if seam:
        loop=v[9*sides:10*sides]
        tube(label+" | rolled seam",binding,loop+[loop[0]],.0048,5)

box("Sofa recessed feet and shadow rail",dark,(.0,.117,1.22),(2.93,.155,.89))
soft_block("Bowed leather base",leather,(0,.262,1.22),(3.13,.254,1.04))
for x in (-.975,.0,.975):
    soft_block("Overstuffed seat pad",leather,(x,.405,1.132),(.974,.19,.828),True)
    soft_block("Tucked leather back cushion",leather,(x,.664,1.628),(.994,.623,.35),True)
for x in (-1.505,1.505):soft_block("Soft square arm",leather,(x,.499,1.220),(.195,.48,1.037),True)
for x in (-.48,.49):
    for z in (1.062,1.249):
        lathe("Drawn-in leather button",dark,x,z,[(.494,.018),(.496,.014)],10)

section="08 | ecru sculpted chaise and honed stone conversation table"
# The lounger is a low folded envelope. Its cross-section dips under the sitter
# then curls upwards into a deep headrest at the west end.
def chaise(label,body,profiles,welt):
    vertices,faces=[],[]
    sides=40
    root_x,root_z=-3.30,-1.03
    angle=math.radians(24)
    for t,width,bottom,top in profiles:
        for i in range(sides):
            a=math.tau*i/sides
            cross=signed_power(math.cos(a),.70)*width
            h=bottom+(top-bottom)*(.50+.50*signed_power(math.sin(a),.84))
            vertices.append((root_x+t*math.cos(angle)-cross*math.sin(angle),h,
                root_z-t*math.sin(angle)-cross*math.cos(angle)))
    # Cross section normal points down the long axis.
    faces.append(tuple(reversed(range(sides))))
    for j in range(len(profiles)-1):
        for i in range(sides):
            k=j*sides+i
            faces.append((k,j*sides+(i+1)%sides,j*sides+(i+1)%sides+sides,k+sides))
    faces.append(tuple(range((len(profiles)-1)*sides,len(profiles)*sides)))
    # Check and correct the closed envelope orientation in game axes.
    vs=[Vector(p) for p in vertices]
    volume=sum(vs[f[0]].dot(vs[f[k]].cross(vs[f[k+1]]))/6 for f in faces for k in range(1,len(f)-1))
    if volume<0:faces=[tuple(reversed(f)) for f in faces]
    mesh(label,body,vertices,faces)
    if welt:
        for side in (0,sides//2):
            tube("Chaise corded welt",piping,[vertices[j*sides+side] for j in range(len(profiles))],.009,6)
chaise("Chaise / cinched down base",linen,[(-.84,.13,.09,.20),(-.76,.41,.06,.37),(-.57,.56,.049,.43),
    (-.30,.60,.045,.36),(.03,.59,.041,.27),(.36,.56,.044,.23),(.64,.46,.055,.21),(.78,.20,.085,.16)],True)
chaise("Chaise / folding feather crown",linen,[(-.83,.18,.32,.55),(-.75,.42,.35,.73),(-.65,.54,.40,.82),
    (-.52,.60,.38,.81),(-.36,.60,.29,.66),(-.17,.58,.25,.45),(.04,.56,.225,.332),(.30,.55,.222,.323),
    (.53,.51,.214,.308),(.72,.42,.181,.276),(.79,.12,.161,.207)],True)
box("Table recessed pencil plinth",dark,(-.71,.090,-.48),(1.42,.136,.68))
def eased_slab(name,mat,cx,cz,w,d,layers):
    v=[]
    for y,amount in layers:
        a=w*.5-amount
        b=d*.5-amount
        r=.025
        v.extend([(cx+p,y,cz+q) for p,q in [(a,b-r),(a-r,b),(-a+r,b),(-a,b-r),(-a,-b+r),(-a+r,-b),(a-r,-b),(a,-b+r)]])
    faces=[tuple(range(8))]
    for j in range(len(layers)-1):
        for i in range(8):
            k=j*8+i
            faces.append((k,k+8,j*8+(i+1)%8+8,j*8+(i+1)%8))
    faces.append(tuple(reversed(range((len(layers)-1)*8,len(layers)*8))))
    mesh(name,mat,v,faces)
eased_slab("Single slab of travertine",travertine,-.71,-.48,1.68,.90,[(.143,.021),(.158,0),(.274,0),(.288,.015)])
def book(label,cx,bottom,cz,width,depth,thickness,mat,angle):
    for h in (.004,thickness-.004):
        box(label+" | cover",mat,(cx,bottom+h,cz),(width,.008,depth),angle)
    box(label+" | leaves",paper,(cx,bottom+thickness*.5,cz),(width-.012,thickness-.010,depth-.016),angle)
    for i in range(3):
        x=(-.31+i*.035)*width
        z=-depth*.24
        box("Blind debossed title",bronze,(cx+x*math.cos(angle)+z*math.sin(angle),
            bottom+thickness+.002,cz-x*math.sin(angle)+z*math.cos(angle)),(.006,.003,depth*(.45-i*.07)),angle)
book("Linen monograph",-.49,.289,-.55,.35,.28,.046,record_colors[5],-.12)
book("OOO architecture journal",-.451,.336,-.535,.31,.241,.026,record_colors[0],-.06)
book("Soft cover catalogue",-.133,.289,-.683,.30,.205,.033,record_colors[2],.27)
book("Folded plate folio",-1.25,.289,-.659,.254,.22,.019,record_colors[3],.13)
def reading_lamp(name,x,z,base,yshade,radius,brushed=False):
    metal=bronze if brushed else black
    lathe(name+" | foot",metal,x,z,[(base,.091),(base+.012,.093),(base+.023,.071)],34)
    tube(name+" | slender stem",metal,[(x,base+.017,z),(x,yshade-.014,z)],.011 if brushed else .012,10)
    lathe(name+" | opal reflector",milk,x,z,[(yshade-.009,radius*.87),(yshade+.002,radius*.97)],34)
    lathe(name+" | domed shade",metal,x,z,[(yshade,radius),(yshade+.013,radius*1.01),
        (yshade+radius*.37,radius*.91),(yshade+radius*.69,radius*.61),(yshade+radius*.83,radius*.09)],36)
reading_lamp("Ebony mushroom lamp",-.98,-.24,.289,.566,.145)
reading_lamp("Low brass reading lamp",-2.09,-1.38,.039,.350,.124,True)
# A bent-steel bridge table hugs the sofa's left end, under the seated eye.
for x in (-2.046,-1.645):box("Bronze bridge feet",lining,(x,.178,1.22),(.025,.32,.459))
box("Patinated bridge table",lining,(-1.845,.345,1.22),(.426,.037,.459))
book("Small night reader",-1.84,.364,1.22,.221,.153,.022,record_colors[1],.13)

def construct(name,data,mat,collection):
    vertices,faces,uv=data
    geo=bpy.data.meshes.new(name)
    geo.from_pydata([(x,-z,y) for x,y,z in vertices],[],faces)
    geo.update()
    geo.materials.append(mat)
    if mat in smooth:
        for face in geo.polygons:face.use_smooth=True
    geo.uv_layers.new(name="Built finish coordinates").data.foreach_set("uv",[n for pair in uv for n in pair])
    ob=bpy.data.objects.new(name,geo)
    collection.objects.link(ob)
    return ob

def point(ob,at,target):
    def to_blender(p):return Vector((p[0],-p[2],p[1]))
    ob.location=to_blender(at)
    ob.rotation_euler=(to_blender(target)-ob.location).to_track_quat("-Z","Y").to_euler()

collections={}
for (sec,name,mat),data in parts.items():
    if sec not in collections:
        collections[sec]=bpy.data.collections.new(sec)
        scene.collection.children.link(collections[sec])
    construct(name,data,mat,collections[sec])
rig=bpy.data.collections.new("09 | Room camera and studio lighting")
scene.collection.children.link(rig)
cam=bpy.data.cameras.new("Sea lounge opening lens")
camera=bpy.data.objects.new("Opening across the rug",cam)
rig.objects.link(camera)
cam.lens=24
cam.clip_start=.035
scene.camera=camera
point(camera,(-2.4,1.61,3.8),(-.35,1.25,-2.5))
def lamp(name,at,target,energy,tint,size):
    lamp_data=bpy.data.lights.new(name,"AREA")
    lamp_data.energy=energy
    lamp_data.color=tint
    lamp_data.shape="DISK"
    lamp_data.size=size
    obj=bpy.data.objects.new(name,lamp_data)
    rig.objects.link(obj)
    point(obj,at,target)
lamp("Ocean window daylight",(1.6,2,-3.95),(-.4,.64,1.26),520,(.62,.77,1),5.5)
lamp("Reflected amber at the pier",(-3.93,.42,-3.45),(-3.49,1.0,-1.2),77,(1,.63,.34),1.95)
lamp("Mushroom over book cloth",(-.98,.55,-.24),(-.87,.25,-.46),9,(1,.76,.50),.26)
lamp("Diffuse softbox at entrance",(1.2,2.78,4.05),(-.4,.40,-.75),295,(1,.77,.60),5)
# The editable source uses the same offshore painting as the game. Three.js
# supplies the moving seascape and near water, so this preview mesh stays in the rig.
coast = bpy.data.materials.new("Blender preview | painted rain at sea")
coast.use_nodes = True
tree = coast.node_tree
coast_image = tree.nodes.new("ShaderNodeTexImage")
coast_image.image = bpy.data.images.load(str(HERE/"rain-coast.png"), check_existing=True)
coast_image.image.pack()
coast_image.interpolation = "Closest"
sky_light = tree.nodes.new("ShaderNodeEmission")
tree.links.new(coast_image.outputs["Color"],sky_light.inputs["Color"])
tree.links.new(sky_light.outputs[0],tree.nodes.get("Material Output").inputs["Surface"])
height=11.2
bottom=1.49-height*.515
backdrop=construct("Preview only | rainy offshore horizon",[
    [(-16.8,bottom,-17.5),(16.8,bottom,-17.5),(16.8,bottom+height,-17.5),(-16.8,bottom+height,-17.5)],
    [(0,1,2,3)],[(0,0),(1,0),(1,1),(0,1)]],coast,rig)
backdrop.visible_shadow=False
scene.world=bpy.data.worlds.new("Coastal air")
scene.world.color=(.18,.25,.36)
scene.render.engine="CYCLES"
scene.cycles.samples=16
scene.render.resolution_x=960
scene.render.resolution_y=510
scene.render.resolution_percentage=100
for area in bpy.context.screen.areas:
    if area.type=="VIEW_3D":
        area.spaces.active.region_3d.view_perspective="CAMERA"
        area.spaces.active.shading.color_type="MATERIAL"
        area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/"Sea-lounge.blend"),compress=True)

web=bpy.data.collections.new("Web material batches")
scene.collection.children.link(web)
bins=defaultdict(lambda:[[],[],[]])
for (sec,name,mat),(verts,faces,uv) in parts.items():
    if name=="TVDisplaySlot":tag=name
    elif sec.startswith("02 |"):tag="Ceiling_Lounge"
    else:tag="Lounge"
    a,b,c=bins[(tag,mat)]
    start=len(a)
    a.extend(verts)
    b.extend(tuple(v+start for v in f) for f in faces)
    c.extend(uv)
bpy.ops.object.select_all(action="DESELECT")
for (tag,mat),data in bins.items():
    name=tag if tag=="TVDisplaySlot" else tag+"_"+mat.name
    ob=construct(name,data,mat,web)
    ob.select_set(True)
    bpy.context.view_layer.objects.active=ob
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format="GLB",use_selection=True,export_animations=False,
    export_cameras=False,export_lights=False,export_yup=True,export_texcoords=True,export_normals=True,export_image_format="AUTO")
raw=GLB.read_bytes()
length=struct.unpack_from("<I",raw,12)[0]
doc=json.loads(raw[20:20+length])
for entry in doc["nodes"]+doc["meshes"]:
    if entry["name"].startswith("TVDisplaySlot"):entry["name"]="TVDisplaySlot"
for sampler in doc.get("samplers",[]):
    sampler["magFilter"]=9728
    sampler["minFilter"]=9987
payload=json.dumps(doc,separators=(",",":")).encode()
payload+=b" "*(-len(payload)%4)
tail=raw[20+length:]
GLB.write_bytes(struct.pack("<4sIII4s",b"glTF",2,20+len(payload)+len(tail),len(payload),b"JSON")+payload+tail)
print(f'Sea lounge: {len(doc["meshes"])} persistent game batches, {len(doc["images"])} embedded finishes, {GLB.stat().st_size} bytes')
