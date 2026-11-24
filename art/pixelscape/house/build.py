"""Build the meter-scale Sumiyoshi garden room, its editable Blender study and game GLB.

    node art/pixelscape/house/paint.cjs
    blender --background --python art/pixelscape/house/build.py

The source embeds all pixel plates. Repaint a PNG and rerun only the second command
to keep the edit. Design coordinates below match the game (x right, y up, z front).
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
GLB = ROOT / "public/sumiyoshi/models/house.glb"
R = random.Random(10822)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.name = "Sumiyoshi | listening room and rain court"


def linear(v):
    v /= 255
    return v / 12.92 if v < .04045 else ((v+.055)/1.055)**2.4


def rgba(value):
    return tuple(linear(int(value[i:i+2], 16)) for i in (0,2,4)) + (1,)


def xyz(p):
    return p[0], -p[2], p[1]


def finish(name, swatch, rough=.76, metal=0, emission=0, image=None, plate=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    base = rgba(swatch)
    shader.inputs["Base Color"].default_value = base
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Emission Color"].default_value = base
    shader.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = base
    if image:
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(str(HERE/"paint"/(image+".png")),check_existing=True)
        node.image.pack()
        node.interpolation = "Closest"
        mat.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
        if emission:
            mat.node_tree.links.new(node.outputs["Color"], shader.inputs["Emission Color"])
        if plate:
            mat.node_tree.links.new(node.outputs["Alpha"], shader.inputs["Alpha"])
            shader.inputs["Specular IOR Level"].default_value = 0
    return mat


cedar = finish("Sawn cedar lining", "363d3c", image="charred-cedar")
walnut = finish("Oiled black walnut veneer", "594638", .64, image="oiled-walnut")
basalt = finish("Honed blue basalt flags", "465353", .49, .12, image="thermal-basalt")
linen = finish("Woven sage upholstery", "768074", .90, image="linen-weave")
matte = finish("Ink black steel", "222b2d", .59, .29)
bezel = finish("Anodised display surround", "171e21", .5, .33)
seam = finish("Dark recessed joints", "242c2e", .83)
plaster = finish("Charcoal lime render", "444a48", .82)
brass = finish("Aged honey brass", "8a7256", .34, .57)
reed = finish("Smoke blue ceramic", "5b7777", .35, .12)
paper = finish("Washi shade | light source", "efc18a", .79, emission=1.25)
lamp_paper = finish("Tosa paper | luminous fiber and spiral rib", "d5aa73", .88, emission=.91, image="lit-washi")
rattan = finish("Linen binding", "a39174", .8)
bluebook = finish("Clothbound book", "647f81", .86)
cream = finish("Uncoated ivory sheets", "c1b498", .87)
clay = finish("Brick red book jacket", "9a5f4c", .76)
glimmer = finish("Frame dew and brass lamp seam", "d3b486", .44, emission=.31)
trough = finish("Wet court | basalt basin", "304b4d", .26, .22)
soil = finish("Damp humus", "273b35", .86)
ground = finish("Wet moss lawn", "365443", .84)
rock = finish("Andesite | blue shadow", "495951", .62, image="garden-andesite")
rocklight = finish("Andesite | rain catching faces", "5e6b5c", .63, image="garden-andesite")
lich = finish("Lichen crust", "657054", .86, image="garden-andesite")
city = finish("Pixel plate | far apartments and Osaka sky","34626a",1,emission=.8,image="distant-nagaya",plate=True)
pine = finish("Painted botanical sprays | trained black pine","315f51",1,emission=.8,image="black-pine",plate=True)
maple = finish("Painted botanical sprays | rain maple","39714f",1,emission=.8,image="rain-maple",plate=True)
oak = finish("Painted botanical sprays | rain oak","335b5b",1,emission=.8,image="blue-oak",plate=True)
distantoak = finish("Far oak silhouettes in blue air","36516b",1,emission=.8,image="blue-oak",plate=True)
ferns = finish("Botanical Japanese fern","4a8052",1,emission=.8,image="fern-bank",plate=True)
camellia = finish("Botanical camellia","455a4c",1,emission=.8,image="camellia-branches",plate=True)
hosta = finish("Botanical striped hosta","628159",1,emission=.8,image="ribbed-hosta",plate=True)
meadow = finish("Botanical woodland grass","576f52",1,emission=.8,image="woodland-grass",plate=True)
lily = finish("Spathiphyllum | indoor ivory flowers","71886d",1,emission=.8,image="peace-lily",plate=True)
indoorfern = finish("Leatherleaf fern | reading ledge","647b55",1,emission=.8,image="fern-bank",plate=True)
philodendron = finish("Brass-slung heartleaf philodendron","798456",1,emission=.8,image="trailing-philodendron",plate=True)
unlit = {m.name for m in (city,pine,maple,oak,distantoak,ferns,camellia,hosta,meadow,lily,indoorfern,philodendron)}

parts = defaultdict(lambda: [[], [], []])
section = ""


def mesh(part, material, verts, faces, uvs=None):
    points, polygons, uv = parts[(section, part, material)]
    n = len(points)
    points.extend(verts)
    for i,face in enumerate(faces):
        polygons.append(tuple(idx+n for idx in face))
        if uvs is None:
            a,b,c = [Vector(verts[k]) for k in face[:3]]
            axis = (b-a).cross(c-a)
            for k in face:
                x,y,z=verts[k]
                if abs(axis.y) >= max(abs(axis.x),abs(axis.z)): u,v=x,z
                elif abs(axis.z) > abs(axis.x): u,v=x,y
                else: u,v=z,y
                if material in (cedar,walnut):u,v = u*.50, v*.95
                if material == linen: u,v = u*.86,v*.9
                uv.append((u,v))
        else: uv.extend(uvs[i])


def box(part, material, center, dims):
    x,y,z = center
    a,b,c = [d*.5 for d in dims]
    corners = [(x+i*a,y+j*b,z+k*c) for i,j,k in [
        (-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
        (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    mesh(part,material,corners,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)])


def tube(part,material,coords,radii,segments=8):
    points=[Vector(v) for v in coords]
    if isinstance(radii,(int,float)):radii=[radii]*len(points)
    verts=[];faces=[]
    for i,p in enumerate(points):
        direction=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized()
        ref=Vector((0,1,0)) if abs(direction.y)<.85 else Vector((1,0,0))
        side=direction.cross(ref).normalized()
        up=direction.cross(side).normalized()
        for j in range(segments):
            ang=j*math.tau/segments
            verts.append(tuple(p+(side*math.cos(ang)+up*math.sin(ang))*radii[i]))
    faces.append(tuple(reversed(range(segments))))
    for j in range(len(points)-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.append(tuple(range((len(points)-1)*segments,len(points)*segments)))
    mesh(part,material,verts,faces)


def vertical_plate(part,mat,x,bottom,z,width,height,angle=0,flip=False):
    dx=width*math.cos(angle)/2; dz=width*math.sin(angle)/2
    corners=[(x-dx,bottom,z-dz),(x+dx,bottom,z+dz),(x+dx,bottom+height,z+dz),(x-dx,bottom+height,z-dz)]
    us=(1,0) if flip else (0,1)
    mesh(part,mat,corners,[(0,1,2,3)], [[(us[0],0),(us[1],0),(us[1],1),(us[0],1)]])

def planting(part, mat, x, bottom, z, width, height, angle=0, flip=False):
    """Bend the edge of a spray away from the centre to give its tips a real footprint."""
    verts, faces, uvs = [], [], []
    for row in range(3):
        v = row/2
        for col in range(5):
            u = col/4
            across = (u-.5)*width
            depth = width*(.5-abs(u-.5)*2)*(.06+.11*v) + height*.07*v
            verts.append((x+across*math.cos(angle)-depth*math.sin(angle),
                          bottom+v*height,z+across*math.sin(angle)+depth*math.cos(angle)))
    for row in range(2):
        for col in range(4):
            idx = row*5+col
            face = (idx,idx+1,idx+6,idx+5)
            faces.append(face)
            uvs.append([((1-i%5/4) if flip else i%5/4,(i//5)/2) for i in face])
    mesh(part,mat,verts,faces,uvs)


def cushion(part, center, dims, mat=linen, welt=True):
    # Tailored corners and a crowned section; real seams survive a near camera.
    x,y,z=center;a,b,c=[v*.5 for v in dims];radius=min(a,c)*.22
    layers=[(-1,.94),(-.76,.987),(0,1),(.74,.985),(1,.91)]
    verts=[];faces=[]
    for yy, scale in layers:
        for sx,sz,start in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)]:
            for j in range(4):
                angle=math.radians(start+j*30)
                verts.append((x+scale*((a-radius)*sx+math.cos(angle)*radius), y+yy*b,
                              z+scale*((c-radius)*sz+math.sin(angle)*radius)))
    # In x-y-z (y-up), a ring traversed from front right toward front left is CCW from below.
    for j in range(len(layers)-1):
        for i in range(16):
            a0=j*16+i; a1=j*16+(i+1)%16
            faces.append((a0,a0+16,a1+16,a1))
    faces.extend([tuple(range(16)),tuple(reversed(range(64,80)))])
    mesh(part,mat,verts,faces)
    if welt:
        loop=verts[48:64]
        tube(part+" / welt",rattan,loop+[loop[0]],.008,5)


section="01 | Sumi plaster, ground and structure"
box("Recessed joint bedding",seam,(0,-.079,.70),(10.75,.08,7.33))
for row in range(8):
    z=-2.86+row*.95
    left=-5.38
    while left<5.36:
        right=min(5.37,left+(1.15 if row%2 and left < -5.37 else 2.30))
        box("Honed basalt flags",basalt,((left+right)/2,-.024,z+.448),(right-left-.009,.048,.938))
        left=right
box("Left return wall",plaster,(-5.42,1.63,.68),(.17,3.26,7.26))
box("Right return wall",plaster,(5.42,1.63,.68),(.17,3.26,7.26))
for sx in (-1,1):
    box("Stained cedar lower skirting",walnut,(sx*5.315,.13,.60),(.075,.24,7.24))
    for i in range(9):
        z=-2.70+i*.81
        box("Interior shadow battens",cedar,(sx*5.313,1.75,z),(.07,2.86,.052))

section="Cutaway | timber ceiling and street-side return"
box("Tongue and groove ceiling",cedar,(0,3.37,.72),(10.90,.16,7.50))
for i in range(29):
    z=-2.96+i*.26
    box("Soffit lining joints",seam,(0,3.277,z),(10.81,.018,.018))
for z in (-2.78,-.70,1.38,3.42):
    box("Exposed header",cedar,(0,3.21,z),(10.82,.18,.106))
for x in (-3.90,3.90):
    for z in (-1.53,.56,2.64):
        box("Recessed downlight trim",matte,(x,3.265,z),(.16,.026,.16))
        box("Warm downlight aperture",paper,(x,3.246,z),(.068,.02,.068))
box("Entry panel west",walnut,(-1.14,1.09,4.28),(8.44,2.18,.12))
box("Entry panel east",walnut,(5.02,1.09,4.28),(.68,2.18,.12))
box("Lintel above 2.1 m clear entry",cedar,(3.89,2.69,4.28),(2.14,1.16,.14))
for x in (3.03,4.76):box("Rebated entry jamb",walnut,(x,1.06,4.23),(.13,2.12,.17))
box("Entry head",walnut,(3.90,2.135,4.23),(1.87,.095,.17))

section="01 | Sumi plaster, ground and structure"
box("Street entrance brass threshold",brass,(3.90,.012,4.11),(1.67,.024,.084))
box("Entry grate and shoe landing",seam,(3.90,.005,3.86),(1.49,.01,.39))
for n in range(18):
    box("Cedar strips across the shoe landing",cedar,(3.215+n*.080,.018,3.86),(.064,.026,.385))

section="02 | recessed picture window and rain trough"
for x in (-5.16,5.16):
    box("Portal side reveal",plaster,(x,1.55,-3.43),(.44,3.12,1.10))
    box("Bronze window jamb",matte,(x*.965,1.56,-3.74),(.081,3.11,.11))
box("Portal head and shadow",cedar,(0,3.20,-3.42),(10.63,.22,1.08))
box("Extruded window header",matte,(0,3.055,-3.75),(9.99,.074,.13))
box("Steel bottom track",matte,(0,.157,-3.78),(10.01,.055,.11))
# The two sliders stack at the sides of a wide, uninterrupted principal pane.
for x in (-3.72,3.70):
    box("Meeting rail",matte,(x,1.62,-3.75),(.041,2.91,.079))
    box("Glass gasket",rock,(x+.030,1.62,-3.76),(.018,2.88,.054))
box("Water mirror | still basin",trough,(0,.086,-3.37),(9.83,.040,.96))
for z in (-3.84,-2.86):
    box("Chiselled sill",basalt,(0,.116,z),(9.97,.074,.095))
for x in (-4.93,4.93):box("Short basin curb",basalt,(x,.12,-3.35),(.13,.08,.92))
for x in (-4.19,-2.5):
    box("Bench blade",matte,(x,.224,-3.43),(.049,.25,.30))
box("Monolithic cypress perch",walnut,(-3.34,.42,-3.45),(2.83,.138,.46))
box("Perch edge shadow",cedar,(-3.34,.350,-3.43),(2.76,.021,.391))

section="03 | freestanding display"
box("TV housing",bezel,(0,1.59,-2.45),(3.381,1.932,.09))
box("TVDisplaySlot",matte,(0,1.59,-2.402),(3.32,1.8675,.005))
for x in (-.92,.92):
    box("Steel feet",matte,(x,.035,-2.51),(.50,.05,.34))
    box("Uprights",matte,(x,.344,-2.51),(.034,.61,.049))
box("Receiver and pilot light",glimmer,(1.58,.639,-2.40),(.023,.009,.006))
tube("Fabric power cord",matte,[(.90,.65,-2.50),(.86,.32,-2.54),(.82,.04,-2.60),(1.13,.013,-2.72),(1.75,.011,-2.81)],.009,6)

section="04 | low settee, timber apron and wool throw"
box("Walnut platform",walnut,(0,.23,1.21),(3.18,.137,1.09))
for x in (-1.38,1.38):
    for z in (.79,1.64):box("Recessed feet",cedar,(x,.108,z),(.084,.215,.084))
for x in (-.98,0,.98):
    cushion("Seat cushion",(x,.394,1.16),(.973,.215,.89))
    cushion("Low back bolster",(x,.633,1.638),(.971,.495,.216))
for x in (-1.51,1.51):
    cushion("Arms",(x,.495,1.22),(.175,.392,1.025))
box("Open-backed timber frame",walnut,(0,.46,1.72),(2.95,.287,.068))
for x in (-1.30,-.59,.59,1.30):box("Upholstery cleats",matte,(x,.398,1.75),(.050,.28,.040))
# Draped linen gives the dark back edge a soft asymmetrical break.
drape=finish("Indigo hand towel", "516c70",.97)
stripes=finish("Unbleached twill stripe", "a3a294",.95)
def cloth(x0,x1,mat):
    zys=[(1.46,.855),(1.61,.884),(1.72,.872),(1.757,.785),(1.768,.53),(1.787,.386)]
    verts=[]
    for i,(z,y) in enumerate(zys):
        for j in range(8):
            t=j/7;x=x0+(x1-x0)*t;fold=math.sin(30*x+i*.33)*.012
            verts.append((x,y+fold,z+fold*.6))
    faces=[(k*8+j,k*8+j+1,(k+1)*8+j+1,(k+1)*8+j) for k in range(5) for j in range(7)]
    mesh("Wool throw and narrow woven selvage",mat,verts,faces)
cloth(-1.24,-.74,drape)
for x in (-1.19,-1.13,-.82):cloth(x,x+.019,stripes)

section="05 | evening reading gallery"
def stoneware(x,y,z,scale):
    tube("Glazed tea beaker",reed,[(x,y,z),(x,y+.02*scale,z),(x,y+.13*scale,z),(x,y+.145*scale,z)],
         [.043*scale,.056*scale,.062*scale,.060*scale],14)
    tube("Dark tea surface",seam,[(x,y+.145*scale,z),(x,y+.147*scale,z)],.051*scale,14)

for x in (-3.87,-2.81):
    for z in (-.24,.14):box("Reading ledge supports",matte,(x,.235,z),(.040,.46,.043))
box("Side reading ledge",walnut,(-3.30,.48,-.04),(1.47,.079,.71))
for row,(dx,dz,mat) in enumerate([(.01,.01,bluebook),(.038,-.012,clay)]):
    y=.525+row*.054
    for offset in (0,.045):box("Case binding",mat,(-3.58+dx,y+offset,-.05+dz),(.44,.009,.298))
    box("Fore-edge of pages",cream,(-3.58+dx,y+.022,-.054+dz),(.429,.035,.281))
stoneware(-2.95,.52,-.08,1.02)
# The lamp stands in the side of the opening and lights the reading ledge.
x,z=-3.45,-1.10
tube("Lamp foot",matte,[(x,.025,z),(x,.065,z)],.228,24)
tube("Floor lamp stem",brass,[(x,.06,z),(x,.92,z)],.022,10)
levels=[(.875,.109),(.894,.152),(.927,.181),(.982,.195),(1.067,.203),(1.166,.208),
        (1.260,.203),(1.365,.191),(1.439,.168),(1.492,.135),(1.515,.095)]
for j in range(len(levels)-1):
    y0,r0=levels[j];y1,r1=levels[j+1]
    for i in range(24):
        a=i*math.tau/24;b=(i+1)*math.tau/24
        corners=[(x+math.cos(a)*r0,y0,z+math.sin(a)*r0),(x+math.cos(a)*r1,y1,z+math.sin(a)*r1),
            (x+math.cos(b)*r1,y1,z+math.sin(b)*r1),(x+math.cos(b)*r0,y0,z+math.sin(b)*r0)]
        u0=i/24;u1=(i+1)/24;v0=(y0-.875)/.64;v1=(y1-.875)/.64
        mesh("Hand-stretched washi shell",lamp_paper,corners,[(0,1,2,3)],[[(u0,v0),(u0,v1),(u1,v1),(u1,v0)]])
for y,r in ((.884,.13),(1.507,.106)):
    tube("Shade binding ring",brass,[(x,y,z),(x,y+.011,z)],r,24)
for k in range(3):
    a=k*math.tau/3-.44
    tube("Split bamboo binding",rattan,[(x+math.cos(a)*r,y,z+math.sin(a)*r) for y,r in levels],.0034,5)

section="05b | porcelain, hanging vines and the evening fern"
celadon=finish("Celadon | blue ash glaze","67877e",.34,.12)
shino=finish("Shino | burnt sienna glaze","8e614d",.49)
slip=finish("Amber slip | glazed pottery rim","ae8b6e",.38)
stem=finish("Pothos | trailing stem","585c3e",.86)
vine_shadow=finish("Pothos | deep leaf face","365a46",.72,emission=.20)
vine_green=finish("Pothos | folded blade","6c8853",.70,emission=.21)
vine_cream=finish("Pothos | marbled leaf tip","9d9e65",.7,emission=.19)

def ceramic_bowl(label, x,y,z,h,r,glaze):
    rings=[(0,.54),(.062,.55),(.11,.50),(.17,.62),(.38,.77),(.69,.93),(.88,1),(.94,.99),(1,1.04)]
    tube(label,glaze,[(x,y+t*h,z) for t,_ in rings],[s*r for _,s in rings],28)
    tube(label+" | turned lip",slip,[(x,y+h*.945,z),(x,y+h*.99,z)],[r*1.046,r*1.04],28)
    tube(label+" | recessed planting",soil,[(x,y+h*1.002,z),(x,y+h*1.008,z)],r*.96,26)

# The perch is outside the television silhouette even from the seated portrait camera.
ceramic_bowl("Petite ash-glazed fern bowl",-2.16,.49,-3.40,.24,.195,celadon)
planting("Layered leatherleaf over the cypress perch",indoorfern,-2.16,.72,-3.40,.78,.53,.19)
planting("Leatherleaf side spray",indoorfern,-2.21,.72,-3.43,.48,.39,-1.25,True)
ceramic_bowl("Footed Shino lily vessel",1.99,.005,-2.69,.39,.22,shino)
planting("Evening spathes and dark glossy leaves",lily,1.99,.39,-2.68,.74,.88,-.19)
planting("Turned leaves behind Spathiphyllum",lily,2.00,.391,-2.72,.54,.69,1.21,True)

# Tsuri-bachi in the window return. The falling stems taper and carry alternate
# cordate leaves; each bowed fold and terminal drip tip remains legible in side view.
hx,hz=-2.42,-3.39
ceramic_bowl("Hanging copper-brown bowl",hx,2.65,hz,.205,.221,shino)
for dx,dz in ((-.17,-.06),(.15,-.065),(.033,.18)):
    tube("Three-strand brass suspension",brass,[(hx,3.234,hz),(hx+dx,2.84,hz+dz)],.006,6)
for n in range(7):
    angle = n*math.tau/7
    length = [.39,.61,.45,.22,.55,.82,.42][n]
    vine=[]
    for k in range(10):
        t=k/9
        radius=.085+.22*math.sin(min(t/.4,1)*math.pi*.5)
        vine.append(Vector((hx+math.cos(angle)*radius+.077*math.sin(t*5+angle)*t,
                            2.886-.93*length*t**1.36,hz+math.sin(angle)*radius+math.sin(t*4+angle)*.025)))
    tube("Tsuri-bachi trailing stems",stem,vine,[.008-i*.00055 for i in range(10)],6)
    for k in range(1,10):
        p=vine[k]
        side=(-1 if (k+n)%2 else 1)
        size=(.12 if k<6 else .094)*(1+.16*math.sin(k+n))
        direction=Vector((side*.62,-.64,.23))
        across=Vector((.70,side*.58,.09))
        center=p+direction*size*.48+Vector((0,0,.021))
        tip=p+direction*size
        a=p+direction*.025+across*size*.34
        b=p+direction*.025-across*size*.34
        left=p+direction*size*.48+across*size*.40
        right=p+direction*size*.48-across*size*.40
        verts=[p,a,left,tip,right,b,center]
        mesh("Trailing pothos heart blades",vine_shadow,verts,[(0,1,6),(1,2,6),(2,3,6)])
        mesh("Trailing pothos heart blades",vine_green,verts,[(0,6,5),(5,6,4),(4,6,3)])
        if (k+n)%3==1:
            mesh("Cream variegation in pothos",vine_cream,[center.lerp(p,.77),center,
                 center.lerp(right,.42)+Vector((0,0,.002))],[(0,1,2)])

section="Cutaway | heartleaf Philodendron above the reading gallery"
# This close silhouette brings a sense of depth to the high portrait crop.
hx,hz=-1.42,.02
vertical_plate("Pendant heartleaf philodendron",philodendron,hx,2.42,hz+.078,.62,.76,-.075)
body_x=hx-.079
ceramic_bowl("Cochin stoneware hanging pot",body_x,2.827,hz-.012,.145,.108,shino)
for dx,dz in ((-.091,-.037),(.091,-.039),(-.012,.099)):
    tube("Waxed cord from the cedar soffit",brass,[(body_x,3.245,hz),(body_x+dx,2.969,hz+dz)],.006,7)

section="06 | distant silhouettes beyond the garden"
vertical_plate("Sumiyoshi apartments beyond retaining wall",city,0,-1.36,-23.5,46,13.94)
for i,(x,z,h) in enumerate([(-16,-15.6,5.8),(-11.9,-16.3,4.5),(-8.4,-17.6,4.3),
        (-4.9,-14.8,3.0),(-.4,-17.1,3.6),(3.4,-14.3,2.9),(8.2,-16.5,4.3),
        (11.5,-14.2,5.1),(16.3,-15.4,5.5)]):
    vertical_plate("Second-growth oak silhouettes",distantoak,x,-.35,z,h*1.03,h,(-1)**i*.19,i%2)

section="07 | courtyard terrain, gravel and planting beds"
box("Damp earth",soil,(0,-.12,-9.06),(17.4,.39,11.1))
box("Low rain mirror",trough,(0,.089,-5.32),(4.10,.032,2.29))
for x in (-6.77,6.77):box("Garden retaining curb",basalt,(x,.24,-8.31),(.20,.42,9.18))
for i in range(5):
    x=-4.84+i*2.44
    box("Rear cedar garden screen",cedar,(x,.85,-12.68),(2.40,1.58,.11))
    box("Dark rain cap",matte,(x,1.64,-12.68),(2.44,.07,.18))
for i in range(36):
    x=R.uniform(-6.6,6.6);z=R.uniform(-11.6,-4.02)
    if -2.15<x<2.15 and -6.5<z<-4.08:continue
    size=R.uniform(.16,.50)
    points=[(x,.117,z)]
    for j in range(14):
        theta=j*math.tau/14
        radius=size*(1+.22*math.sin(theta*3+i))
        points.append((x+1.45*radius*math.cos(theta),.111,z+radius*math.sin(theta)))
    mesh("Moss islands at the waterline",ground,points,[(0,(j+1)%14+1,j+1) for j in range(14)])


def boulder(x,y,z,a,b,c,lichen=True):
    n=15 if a>.28 else 8;verts=[];angles=[i*math.tau/n+R.uniform(-.07,.07) for i in range(n)]
    jitter=[R.uniform(.81,1.12) for _ in range(n)]
    for height,rad in ((-.58,.66),(-.23,1),(.22,.95),(.59,.80),(.82,.62),(.91,.25)):
        for i,ang in enumerate(angles):
            verts.append((x+math.cos(ang)*a*jitter[i]*rad,y+height*b+(math.sin(ang*2.7)*.11+math.cos(ang+height)*.09)*b,z+math.sin(ang)*c*jitter[i]*rad))
    for j in range(5):
        for i in range(n):
            ix=j*n+i;nx=j*n+(i+1)%n
            mat=rock if j<2 else (lich if lichen and j==3 and i%3!=0 else rocklight)
            mesh("Rain-darkened stones",mat,[verts[v] for v in (ix,ix+n,nx+n,nx)],[(0,1,2,3)])
    mesh("Rain-darkened stones",rocklight,verts[-n:],[tuple(reversed(range(n)))])


boulder(3.15,.22,-3.46,1.09,.46,.35)
boulder(2.16,.155,-3.48,.33,.14,.21)
for coords in [(-3.41,.29,-5.52,1.02,.58,.69),(-2.62,.19,-5.81,.57,.31,.46),(3.11,.32,-5.08,.92,.57,.61),
               (2.52,.21,-5.45,.43,.41,.32),(-1.01,.21,-7.2,.81,.32,.49),(.52,.28,-8.1,.63,.50,.55)]:
    boulder(*coords)
for i in range(14):
    z=-4.01-i*.48;x=2.23+math.sin(i*.52)*.41+i*.078
    boulder(x,.127,z,.32+.09*R.random(),.09,.21+.09*R.random(),False)
for i in range(98):
    x=R.uniform(-5.85,5.85);z=R.uniform(-10.6,-4.12)
    if -1.98<x<1.91 and z>-6.44: continue
    a=R.uniform(.035,.12);boulder(x,.105,z,a,a*.49,a*R.uniform(.72,1.16))

section="08 | framed garden, pine and maple canopies"
# The pine anchors the left reveal while the right maple frames a view to Osaka.
for x,z,w,h,mat,angle,flip in [
        (-7.04,-8.62,4.7,4.94,oak,.29,True),(-5.71,-11.83,4.44,4.33,maple,.17,True),
        (-2.86,-7.43,3.94,3.65,pine,.14,False),(-.42,-11.62,3.42,3.82,oak,.25,False),
        (1.91,-9.57,3.39,3.43,maple,-.19,True),(4.52,-6.52,3.69,3.76,maple,-.41,False),
        (6.91,-9.68,3.76,3.93,pine,-.19,True),(-6.12,-5.29,3.22,3.93,oak,.53,False)]:
    vertical_plate("Garden tree in elevation",mat,x,.10,z,w,h,angle,flip)

section="09 | layered shade border and water garden"
# Curated drifts reveal the basalt steps. Dark gaps between the variegated
# leaves keep the garden from becoming an undifferentiated wall of detail.
drifts = [
    (camellia,-4.62,-6.31,2.35,1.69,.32),(camellia,-2.80,-9.02,1.66,1.29,-.23),
    (camellia,.13,-9.78,1.84,1.44,.12),(camellia,3.25,-6.75,1.84,1.34,-.30),
    (camellia,5.53,-4.95,2.07,1.67,-.49),(camellia,6.48,-7.51,1.77,1.51,.38),
    (hosta,-3.14,-4.95,1.40,.79,.28),(hosta,-4.86,-4.54,1.42,.78,.46),
    (hosta,-1.86,-7.01,1.14,.63,-.18),(hosta,2.66,-5.61,1.34,.77,-.28),
    (hosta,3.99,-6.31,1.17,.64,.06),(hosta,5.19,-5.10,1.25,.72,-.42),
    (ferns,-3.95,-5.12,1.72,.99,.27),(ferns,-2.38,-6.19,1.42,.90,-.13),
    (ferns,-5.94,-4.36,1.75,1.10,.52),(ferns,-.59,-7.62,1.45,.72,.03),
    (ferns,1.55,-7.27,1.68,.91,-.11),(ferns,3.63,-5.94,1.48,.97,-.04),
    (ferns,4.78,-4.58,1.83,1.13,-.24),
    (meadow,-4.21,-4.43,1.48,.78,.30),(meadow,-2.69,-4.49,.92,.55,-.13),
    (meadow,-1.70,-6.67,1.1,.63,.22),(meadow,.49,-7.17,1.27,.67,-.19),
    (meadow,2.02,-5.40,.92,.59,-.08),(meadow,3.53,-4.62,1.14,.76,-.29),
    (meadow,5.54,-4.29,1.45,.90,-.41)]
for i,(mat,x,z,w,h,angle) in enumerate(drifts):
    planting("Drifts of "+mat.name,mat,x,.113,z,w,h,angle,i%3==1)

for i,(x,z) in enumerate([(-6.8,-6.8),(-5.2,-8.2),(-3.9,-8.4),(-1.55,-8.9),
                          (.9,-9.4),(2.8,-9.7),(4.4,-8.6),(6.1,-8.5)]):
    planting("Upland woodland margin",ferns if i%3 else camellia,x,.112,z,
             1.45+.15*(i%3),.66+.15*(i%4),.24*math.sin(i),i%2)


def construct(name,data,mat,collection):
    verts,faces,uv=data
    geo=bpy.data.meshes.new(name)
    geo.from_pydata([xyz(p) for p in verts],[],faces);geo.update()
    geo.materials.append(mat)
    layer=geo.uv_layers.new(name="Paint mapping")
    layer.data.foreach_set("uv",[axis for point in uv for axis in point])
    ob=bpy.data.objects.new(name,geo);collection.objects.link(ob)
    return ob

def aim(ob,at,target):
    ob.location=xyz(at)
    ob.rotation_euler=(Vector(xyz(target))-ob.location).to_track_quat("-Z","Y").to_euler()

collections={}
for (group,part,mat),data in parts.items():
    if group not in collections:
        collection=bpy.data.collections.new(group);scene.collection.children.link(collection);collections[group]=collection
    construct(part,data,mat,collections[group])
rig=bpy.data.collections.new("10 | Opening shot, practicals and overcast light");scene.collection.children.link(rig)
camera=bpy.data.cameras.new("Opening perspective, 48° vertical at 1.9:1");ob=bpy.data.objects.new("Seated view toward court",camera);rig.objects.link(ob)
camera.lens=21.28;camera.sensor_width=36;camera.clip_start=.035;scene.camera=ob
aim(ob,(-.70,1.50,3.85),(.04,1.43,-2.45))
def lamp(name,pos,target,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);rig.objects.link(ob);aim(ob,pos,target)
lamp("Blue ambient from the garden",(-2,4.7,-5.2),(0,.7,.6),510,(.60,.83,.95),6.7)
lamp("Soft return off the rear wall",(1.3,2.9,3.37),(0,.64,-2.4),180,(.71,.81,.79),5.4)
lamp("Warm pool beside the reading ledge",(-3.45,1.27,-1.1),(-3.18,.04,-.69),36,(1,.64,.31),.67)
scene.world=bpy.data.worlds.new("Osaka after rain");scene.world.color=(.08,.12,.13)
scene.render.engine="CYCLES";scene.cycles.samples=12
scene.render.resolution_x=960;scene.render.resolution_y=506;scene.render.resolution_percentage=100
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL'
        area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/"Garden-room.blend"),compress=True)

# Editable individual fixtures stay in the .blend. The game receives material
# batches and a separately named replaceable screen underneath the live TV.
web=bpy.data.collections.new("Web batches");scene.collection.children.link(web)
bins=defaultdict(lambda:[[],[],[]])
for (group,name,mat),(points,polys,uvs) in parts.items():
    tag="TVDisplaySlot" if name=="TVDisplaySlot" else "Cutaway " if group.startswith("Cutaway") else ""
    a,b,c=bins[(tag,mat)];start=len(a);a.extend(points);b.extend(tuple(v+start for v in face) for face in polys);c.extend(uvs)
bpy.ops.object.select_all(action='DESELECT')
for (tag,mat),data in bins.items():
    ob=construct("TVDisplaySlot" if tag=="TVDisplaySlot" else tag+mat.name,data,mat,web)
    ob.select_set(True);bpy.context.view_layer.objects.active=ob
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,
                         export_yup=True,export_texcoords=True,export_normals=True,export_image_format="AUTO")

# glTF unlit cutouts retain the painted value relationships as the role of the
# 3D lights changes indoors. Cutout shadows and subpixel coverage remain crisp.
raw=GLB.read_bytes();l=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+l]);tail=raw[20+l:]
for item in g["nodes"]+g["meshes"]:
    if item.get("name","").startswith("TVDisplaySlot"):
        item["name"]="TVDisplaySlot"
g["extensionsUsed"]=sorted(set(g.get("extensionsUsed",[]))|{"KHR_materials_unlit"})
for mat in g["materials"]:
    if mat.get("name") in unlit:
        mat.setdefault("extensions",{})["KHR_materials_unlit"]={}
        mat["alphaMode"]="MASK";mat["alphaCutoff"]=.48;mat["doubleSided"]=True
        mat.pop("emissiveTexture",None);mat.pop("emissiveFactor",None)
        if mat["name"] == distantoak.name:
            mat["pbrMetallicRoughness"]["baseColorFactor"]=[.48,.64,.85,1]
        elif mat["name"] == indoorfern.name:
            mat["pbrMetallicRoughness"]["baseColorFactor"]=[1,.92,.68,1]
for sampler in g.get("samplers",[]):
    sampler["magFilter"]=9728;sampler["minFilter"]=9987
s=json.dumps(g,separators=(',',':')).encode();s+=b' '*(-len(s)%4)
GLB.write_bytes(struct.pack('<4sIII4s',b'glTF',2,20+len(s)+len(tail),len(s),b'JSON')+s+tail)
print("Garden room: %d game meshes, %d embedded paint images, %d bytes" % (len(g['meshes']),len(g['images']),GLB.stat().st_size))
