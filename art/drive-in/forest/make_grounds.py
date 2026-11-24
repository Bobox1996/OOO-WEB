"""Build the original OOO forest drive-in, in metres. Run with blender -b -P.

Authoring positions below use (east, up, south), the web game's coordinate
system. The coordinate change is applied once when writing Blender meshes.
Each set piece is grouped, with materials shared across the entire landscape.
"""
import bpy
import math
import random
import struct
import tempfile
import zlib
from collections import defaultdict
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public" / "drive-in" / "models"
HERE = Path(__file__).resolve().parent
OUT.mkdir(exist_ok=True, parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(71803)
TAU = math.tau

def lin(c):
    c = c / 255
    return c / 12.92 if c < 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def mat(name, rgb, rough=.64, metal=0, emission=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    col = tuple(lin(int(rgb[i:i+2], 16)) for i in (0, 2, 4)) + (1,)
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = col
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emission:
        p.inputs["Emission Color"].default_value = col
        p.inputs["Emission Strength"].default_value = emission
    m.diffuse_color = col
    return m

road = mat("Rain-washed basalt", "535764", .37)
tarmac = mat("Fine blacktop", "484b57", .34)
wet = mat("Rain pools – cobalt", "58677b", .12, .20)
wet2 = mat("Shallow water", "505b6a", .23, .15)
water_glint = mat("Water crests", "62748b", .22, .10)
lanes = mat("Worn buttercream paint", "c5bd91", .48)
amberpaint = mat("Amber safety enamel", "db9e5e", .45)
paving = [mat("Paver "+str(i), c, .47) for i,c in enumerate(("83818a","767881","85868b","6c7581"))]
curb = mat("Wet granite curbs", "898995", .55)
ground = mat("Mossy soil", "414d47", .75)
soil = mat("Aurora forest floor", "3c5450")
stone = [mat("Moss stone "+str(i),c) for i,c in enumerate(("6e7a78","778778","546466"))]
wood = mat("Oiled cedar", "937152")
wooddark = mat("Cedar endgrain", "654e40")
leaf = [mat("Cedar needles "+str(i),c,.82) for i,c in enumerate(("31544f","3d6657","497762","5b876b","304647","56765e"))]
oakleaf = [mat("Roundleaf "+str(i),c) for i,c in enumerate(("496d52","608453","74945f","456250","658066"))]
grass = [mat("Sword fern "+str(i),c) for i,c in enumerate(("4f705d","70906d","8d9a71"))]
iron = mat("Midnight enamel", "475462", .4, .35)
black = mat("Cast charcoal", "303942", .55, .12)
steel = mat("Galvanised blue steel", "8a99a0", .37, .45)
frame = mat("Cream screen rim", "d9cfaa", .53, .07)
mint = mat("Sea-glass lacquer", "72aca1", .36, .12)
teal = mat("Deep bottle enamel", "366f68", .39, .15)
paper = mat("Warm ticket stock", "eddaa7", .76)
red = mat("Coral lacquer", "db795e", .44)
neon = mat("Amber filament", "ffe2a1", .32, 0, 2.2)
neonred = mat("Candy pink neon", "ffa8b8", .35, 0, 1.6)
lens = mat("Glazed seafoam", "92d6c8", .22, .1, .35)
rasp = mat("Berry rose", "ae6570", .52)
hazel = mat("Wet hazel bark", "796854", .53)
elder = mat("Elder leaves", "69834f", .72)
russet = mat("Copper beech leaves", "9d694f", .65)
russetshade = mat("Burgundy beech leaves", "815446", .67)
lichen = mat("Lichen on bark", "829083", .74)
gill = mat("Mushroom gills", "d4b986", .72)
shroom = mat("Ochre woodland caps", "b87c45", .56)
bulb = mat("Honey glass bulbs", "ffd084", .23, 0, 3.8)
soilshadow = mat("Damp forest humus", "38453d", .84)

def asphalt_texture():
    """Tileable aggregate and tar patches, hand tuned at walking-eye scale."""
    size=384; rng=random.Random(8192)
    grids={k:[[rng.random() for _ in range(k)] for _ in range(k)] for k in (4,12,32)}
    def noise(x,y,k):
        gx=x*k/size;gy=y*k/size;i=int(gx);j=int(gy)
        u=gx-i;v=gy-j;u=u*u*(3-2*u);v=v*v*(3-2*v);grid=grids[k]
        a=grid[j%k][i%k]*(1-u)+grid[j%k][(i+1)%k]*u
        b=grid[(j+1)%k][i%k]*(1-u)+grid[(j+1)%k][(i+1)%k]*u
        return a*(1-v)+b*v
    color=bytearray();rough=bytearray()
    for y in range(size):
        color.append(0);rough.append(0)
        for x in range(size):
            a,b,c=[noise(x,y,k)-.5 for k in (4,12,32)]
            grit=rng.uniform(-1,1)
            d=round(13*a+7*b+6*c+grit*5+(4 if grit>.94 else 0))
            color.extend([77+d,79+d,89+d])
            rough.append(round(99+67*a+39*b+21*c+grit*9))
    def png_image(name,raw,ch):
        def chunk(t,b):
            return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b))
        code=2 if ch==3 else 0
        buf=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,code,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder) / (name.lower().replace(' ','-')+'.png')
            path.write_bytes(buf)
            im=bpy.data.images.load(str(path));im.name=name;im.pack()
            im.filepath="//"+path.name
        return im
    col=png_image("Pavement aggregate",color,3);rg=png_image("Patches of water",rough,1);rg.colorspace_settings.name='Non-Color'
    for m in (road,tarmac):
        nt=m.node_tree;p=nt.nodes.get("Principled BSDF")
        for im,socket in ((col,'Base Color'),(rg,'Roughness')):
            t=nt.nodes.new('ShaderNodeTexImage');t.image=im;t.interpolation='Linear'
            nt.links.new(t.outputs['Color'],p.inputs[socket])
asphalt_texture()

def blender(p):
    return (p[0], -p[2], p[1])

batches = defaultdict(lambda: [[],[],[]])
group = "00 · Lot"
V = Vector
up = V((0,1,0))
def mesh(material, pts, faces, smooth=False):
    vs,fs,ss = batches[(group,material)]
    n = len(vs)
    vs.extend(blender(v) for v in pts)
    fs.extend(tuple(n+j for j in f) for f in faces)
    ss.extend([smooth]*len(faces))

def outward(verts, face, origin=(0,0,0)):
    a,b,c=(V(verts[i]) for i in face[:3])
    center=sum((V(verts[i]) for i in face), V((0,0,0))) / len(face)
    return face if (b-a).cross(c-a).dot(center - V(origin))>=0 else tuple(reversed(face))

def box(p,size,material,bevel=.03,angle=0):
    h=[s/2 for s in size]
    b=min(bevel,*[s*.42 for s in h])
    points=[]; lookup={}; faces=[]
    def corner(s,ax):
        key=(tuple(s),ax)
        if key not in lookup:
            lookup[key]=len(points)
            points.append(tuple(s[i]*(h[i] if i==ax else h[i]-b) for i in range(3)))
        return lookup[key]
    for ax in range(3):
        a=(ax+1)%3; c=(ax+2)%3
        for sign in (-1,1):
            f=[]
            for m,n in ((-1,-1),(1,-1),(1,1),(-1,1)):
                s=[sign]*3; s[a]=m; s[c]=n; f.append(corner(s,ax))
            faces.append(outward(points,tuple(f)))
        for m in (-1,1):
            for n in (-1,1):
                f=[]
                for sg,edge in ((-1,a),(-1,c),(1,c),(1,a)):
                    s=[sg]*3; s[a]=m; s[c]=n; f.append(corner(s,edge))
                faces.append(outward(points,tuple(f)))
    for i in (-1,1):
        for j in (-1,1):
            for k in (-1,1):
                f=tuple(corner((i,j,k),ax) for ax in range(3))
                faces.append(outward(points,f))
    ca,sa=math.cos(angle),math.sin(angle)
    mesh(material,[(p[0]+x*ca-z*sa,p[1]+y,p[2]+x*sa+z*ca) for x,y,z in points],faces)

def rod(a,b,r1,r2,material,sides=8):
    a,b=V(a),V(b); w=(b-a).normalized()
    helper=up if abs(w.dot(up))<.9 else V((1,0,0))
    u=w.cross(helper).normalized(); v=w.cross(u)
    cross=[math.cos(TAU*i/sides)*u+math.sin(TAU*i/sides)*v for i in range(sides)]
    verts=[a+r1*d for d in cross]+[b+r2*d for d in cross]
    faces=[tuple(reversed(range(sides))),tuple(range(sides,sides*2))]
    faces += [(i,(i+1)%sides,sides+(i+1)%sides,sides+i) for i in range(sides)]
    mesh(material,verts,faces)

def blob(p,scale,material,quality=8,smooth=True):
    phase=random.random()*TAU
    verts=[(p[0],p[1]-scale[1],p[2])]
    rings=4
    for j in range(1,rings):
        lat=math.pi*j/rings-math.pi/2
        for i in range(quality):
            a=phase+TAU*(i+.28*(j%2))/quality
            verts.append((p[0]+scale[0]*math.cos(lat)*math.cos(a),p[1]+scale[1]*math.sin(lat),p[2]+scale[2]*math.cos(lat)*math.sin(a)))
    top=len(verts);verts.append((p[0],p[1]+scale[1],p[2]))
    f=[]
    for i in range(quality):
        n=(i+1)%quality
        f.append((0,1+i,1+n));f.append((top,1+n+(rings-2)*quality,1+i+(rings-2)*quality))
        for j in range(rings-2):
            a=1+j*quality;f.append((a+i,a+quality+i,a+quality+n,a+n))
    mesh(material,verts,[outward(verts,face,p) for face in f],smooth)

def flat(material,points):
    vs=[(x,y,z) for x,y,z in points]
    # Ground plane; positive Y normal.
    f=tuple(range(len(vs)))
    if (V(vs[1])-V(vs[0])).cross(V(vs[2])-V(vs[0])).y<0:f=tuple(reversed(f))
    mesh(material,vs,[f])

def stripe(x,z,w,d,m=lanes,y=.0025):
    flat(m,[(x-w/2,y,z-d/2),(x-w/2,y,z+d/2),(x+w/2,y,z+d/2),(x+w/2,y,z-d/2)])

def sign(body,x,y,z,size,material,align='CENTER',tracking=1):
    curve=bpy.data.curves.new(body, 'FONT')
    curve.body=body;curve.size=size;curve.align_x=align;curve.align_y='CENTER'
    curve.space_character=tracking;curve.extrude=.001;curve.bevel_depth=.0005;curve.bevel_resolution=0
    ob=bpy.data.objects.new(body,curve);bpy.context.collection.objects.link(ob)
    ob.location=blender((x,y,z));ob.rotation_euler.x=math.pi/2
    ob.data.materials.append(material)
    dg=bpy.context.evaluated_depsgraph_get();ev=ob.evaluated_get(dg)
    # Convert typography into the grouped, material-batched meshes.
    source=ev.to_mesh();M=ob.matrix_world
    coords=[M@v.co for v in source.vertices]
    vs,fs,ss=batches[(group,material)];n=len(vs)
    vs.extend(tuple(v) for v in coords);fs.extend(tuple(n+j for j in f.vertices) for f in source.polygons);ss.extend([False]*len(source.polygons))
    ev.to_mesh_clear();bpy.data.objects.remove(ob,do_unlink=True);bpy.data.curves.remove(curve)

# Graded site, a ribbon of brick, bays, patched asphalt and roadside drains.
box((0,-.37,-2),(115,.55,96),ground,.18)
box((0,-.105,.1),(31.6,.18,29.8),tarmac,.08)
stripe(0,2,28.0,22.0,road,-.008)
for x in (-7,-3.55,0,3.55,7):
    for z in (-5.6,3.9):
        if x< -4 and z>0: continue
        for dx in (-1.52,1.52):
            stripe(x+dx,z,.057,5.85)
        stripe(x,z-2.90,3.07,.055)
for i in range(13):
    z=-8.6+i*1.67
    stripe(12.55,z,.075,.72)
# Entrance on the shop side: setback bollards/pavers and an access crossing.
for idx in range(7):
    stripe(-10.2+idx*.62,8.08,.29,1.72,paving[2])
for i in range(37):
    x=-14.9+i*.83
    box((x,-.009,12.25),(.8,.15,.28),curb,.038)
for row in range(3):
    for col in range(45):
        x=-15.1+col*.69+(.345 if row%2 else 0)
        box((x,-.044,12.52+row*.34),(.675,.18,.325),random.choice(paving),.025)
for x in (-14.95,14.95):
    for j in range(33):
        box((x,-.045,-13.5+j*.81),(.28,.19,.785),curb,.038)

def puddle(x,z,w,d,bright=False):
    seed=random.random()*TAU;n=22
    pts=[]
    for i in range(n):
        a=TAU*i/n
        s=1+.12*math.sin(3*a+seed)+.06*math.cos(5*a-2*seed)
        pts.append((x+w*math.cos(a)*s,-.004,z+d*math.sin(a)*s))
    flat(wet if bright else wet2,pts)
    if bright:
        for i in range(3):
            zz=z+(i-1)*d*.32
            stripe(x+math.sin(i*4)*w*.15,zz,w*random.uniform(.16,.49),.016,water_glint,-.0032)
for x,z,w,d,bright in [(-4.1,8.7,1.4,.36,True),(-9.2,7.0,1.2,.17,True),(-6.2,0,1.5,.49,False),
        (2.2,3.3,.67,.8,False),(5.5,-3.8,2,.55,True),(9.2,.1,1.15,.42,True),
        (11.5,7.3,1.5,.66,False),(-6.4,-7.3,1.9,.38,True),(.9,-8.7,2.3,.51,True),
        (-12.9,-4,.91,.60,False),(-.8,9.3,1.34,.63,False),(-8.5,10.5,.84,.31,True)]:
    puddle(x,z,w,d,bright)
for x,z in [(-11.8,8.8),(11.8,-2),(-4.8,-8.1),(10.8,10.2)]:
    box((x,.004,z),(.82,.045,.48),iron,.04)
    for i in range(8):
        stripe(x-.31+i*.09,z,.045,.36,black,.029)
# Rain-dark wheel stops for the back row. Two reflector inlays mark each end.
for x in (-7,-3.55,0,3.55,7):
    box((x,.061,-8.38),(1.23,.14,.23),paving[3],.052)
    for dx in (-.47,.47):
        box((x+dx,.078,-8.267),(.14,.049,.022),lanes,.008)

# Giant freestanding cinema screen. The web projector fills the open rectangle.
group="01 · Screen gantry"
sx,sy,sz=0,6,-16.5
hw,hh=8.5,4.78125
for s in (-1,1):
    box((s*(hw+.18),sy,sz-.09),(.34,2*hh+.66,.36),black,.074)
    box((s*(hw+.145),sy,sz+.105),(.23,2*hh+.43,.13),frame,.05)
for s in (-1,1):
    box((sx,sy+s*(hh+.19),sz-.09),(2*hw+.60,.37,.37),black,.06)
    box((sx,sy+s*(hh+.14),sz+.105),(2*hw+.48,.23,.13),frame,.045)
for x in (-7.1,0,7.1):
    box((x,.15,sz-1.15),(1.06,.3,2.8),stone[0],.09)
    rod((x,.2,sz-.13),(x,10.94,sz-.25),.125,.105,steel)
    rod((x,.19,sz-2.32),(x,9.8,sz-.43),.11,.095,iron)
    for h in (1.1,3.4,5.7,8):
        rod((x,h,sz-.23),(x,h+.98,sz-(2.3-(h+1)*.19)),.043,.043,steel)
for x in [-5.56+i*1.86 for i in range(7)]:
    rod((x,11.27,sz-.07),(x,11.27,sz+.25),.037,.037,black)
    blob((x,11.18,sz+.23),(.087,.115,.087),neon,8)
for x in (-8.9,8.9):
    box((x,1.08,-15.3),(.72,1.3,.51),black,.095)
    for y in (.82,1.30):
        rod((x,y,-15.03),(x,y,-14.98),.205,.205,iron,16)
        rod((x,y,-14.97),(x,y,-14.94),.104,.113,black,14)
    rod((x,.02,-15.3),(x,.48,-15.3),.12,.11,steel)

# Forest bowl: natural islands, tall scalloped conifers and round-canopied trees.
def cedar(x,z,h,tint,distant=False):
    r=h*.265
    rod((x,-.36,z),(x+.02,h*.77,z),h*.073,h*.032,wooddark,8)
    if not distant:
        for k in range(5):
            a=TAU*k/5+.7;u,v=math.cos(a),math.sin(a)
            rod((x,.57,z),(x+.42*u,.21,z+.42*v),h*.047,h*.024,wooddark,7)
            rod((x+.42*u,.21,z+.42*v),(x+.87*u,-.10,z+.87*v),h*.024,.012,wooddark,7)
        # Exposed, knuckled low boughs visually connect the skirt to the trunk.
        for j in range(3):
            a=TAU*j/3+.54; dx,dz=math.cos(a),math.sin(a)
            joint=(x+dx*r*.53,h*(.235+j*.011),z+dz*r*.53)
            rod((x,h*.20,z),joint,h*.030,h*.019,wooddark,8)
            rod(joint,(x+dx*r*.82,h*.325,z+dz*r*.82),h*.019,h*.009,wooddark,7)
    for k,(yy,rr) in enumerate(((.27,1),(.45,.84),(.62,.64),(.77,.43))):
        m=leaf[(tint+k//2)%4];phase=k*.38+.13
        vs=[];n=14
        for ry,rad in ((-.015,.42),(.012,.90),(.082,1.0),(.22,.63),(.35,.15)):
            for i in range(n):
                a=phase+TAU*i/n
                ripple=(.93 if i%2 else 1.045)
                lift=.022*h*(i%2) if ry<=.082 else 0
                vs.append((x+r*rr*rad*ripple*math.cos(a),
                           h*(yy+ry*(1-k*.12))+lift,z+r*rr*rad*ripple*math.sin(a)))
        vs.append((x,h*(yy+.35*(1-k*.12))+.031,z))
        f=[tuple(range(n))]
        for j in range(4):
            for i in range(n):f.append((j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n))
        for i in range(n):f.append((4*n+i,5*n,4*n+(i+1)%n))
        mesh(m,vs,f,True)

def roundtree(x,z,h):
    r=h*.235;phase=random.random()*TAU
    rod((x,-.32,z),(x+.095,h*.77,z),h*.066,h*.024,wood,9)
    for j in range(4):
        a=phase+j*TAU/4;dx,dz=math.cos(a)*r*.7,math.sin(a)*r*.7
        rod((x,h*.35,z),(x+dx,h*.68,z+dz),h*.04,h*.019,wood,7)
        blob((x+dx,h*.68+(j%2)*h*.05,z+dz),(r*.88,r*.84,r*.88),oakleaf[j%4],10)
    blob((x,h*.83,z),(r,r*.85,r),oakleaf[random.choice((1,2,4))],11)
    for j in range(3):
        a=phase+j*2.07
        blob((x+r*math.cos(a)*1.15,h*.70,z+r*1.15*math.sin(a)),(r*.28,r*.20,r*.26),oakleaf[2],7)

group="02 · Outer forest"
# Backdrop trees cover the horizon, side trees frame the experience from the lot.
for row in range(2):
    for i in range(25 if row==0 else 21):
        x=-46+i*(3.85 if row==0 else 4.6)+random.uniform(-1,1)
        z=-31.5-row*7+random.uniform(-2.0,1.8)
        h=random.uniform(5.3,9.4)+(2.7 if row else 0)
        if i%6==2: roundtree(x,z,h*.86)
        else:cedar(x,z,h,random.choice((0,0,1)),True)
for side in (-1,1):
    for j in range(16):
        x=side*random.uniform(24.4,31)
        z=-25+j*3.35+random.uniform(-1.7,1.0)
        h=random.uniform(5.5,10.5)
        if j%4==1:roundtree(x,z,h*.9)
        else:cedar(x,z,h,random.randint(0,2),True)
group="03 · Verge trees and understory"
for x,z,h,kind in [(-14,-19,7.9,0),(-18,-14,6.8,1),(-15.6,-8.5,5.9,0),(-18.6,-4,6.4,0),(-17.3,2.5,7.9,1),(-17.8,8.8,6,0),
    (15.5,-18.5,8.4,0),(18,-14,6.7,0),(15.5,-9.5,6.2,1),(18.6,-5.2,8.1,0),(16.8,1.8,6.4,1),(19.6,6.8,7.3,0),
    (-10.8,-22,5.9,1),(-5,-23.9,7.2,0),(6.8,-23.7,7.6,0),(11.4,-23,5.4,1)]:
    blob((x,-.53,z),(2.9,.70,2.8),soil,10)
    if kind:roundtree(x,z,h)
    else: cedar(x,z,h,random.randint(0,2))
def fern(x,z,scale):
    phase=random.random()*TAU
    for j in range(7):
        a=phase+j*TAU/7;d=V((math.cos(a),0,math.sin(a))); side=V((-d.z,0,d.x))
        length=scale*random.uniform(.65,1)
        root=V((x,.055,z)); mid=root+d*length*.45+up*length*.49;tip=root+d*length*.92+up*length*.34
        for frac in (.30,.58,.82):
            v=root+d*frac*length+up*(.52*math.sin(frac*math.pi)*length)
            for sg in (-1,1):
                w=(side*sg*(1-frac*.6)+d*.55)*.23*length
                verts=[v,v+w*.42-d*length*.10,v+w,v+w*.53+d*length*.08]
                # The upper surface and a narrow central taper.
                mesh(grass[j%3],verts,[(0,1,2),(2,3,0),(2,1,0),(0,3,2)])
        rod(root,mid,.015*scale,.011*scale,grass[0],4);rod(mid,tip,.012*scale,.003*scale,grass[1],4)
for side in (-1,1):
    for i in range(26):
        x=side*random.uniform(15.6,20.7);z=random.uniform(-20,12.3)
        if i%3==0:
            r=random.uniform(.34,.87)
            blob((x,r*.19,z),(r,r*.58,r*.75),random.choice(stone),7,False)
        else:fern(x,z,random.uniform(.39,.91))
# Raised native planting pockets buffer the service lane and screen gantry.
# Individual reed blades, basalt stones and fern leaves break the open horizon.
def blade_clump(x,z,scale):
    phase=random.random()*TAU
    for i in range(11):
        a=phase+TAU*i/11
        d=V((math.cos(a),0,math.sin(a))); side=V((-d.z,0,d.x))
        off=scale*random.uniform(.0,.18);h=scale*random.uniform(.32,.82)
        root=V((x,.025,z))+d*off
        verts=[root-side*.036,root+side*.036,root+.13*d+up*h*.66+side*.021,
               root+.23*d+up*h,root+.13*d+up*h*.66-side*.021]
        mesh(grass[i%3],verts,[(0,1,2,4),(4,2,3)])
for x,z,r in [(-11.7,-13.5,1.55),(11.4,-13.4,1.95),(-8.4,-16.8,1.28),(8.8,-17.2,1.35)]:
    blob((x,-.25,z),(r,.31,r*.68),soil,10)
    for j in range(7):
        dx=x+random.uniform(-r*.78,r*.78);dz=z+random.uniform(-r*.48,r*.48)
        if j==0:fern(dx,dz,random.uniform(.68,.84))
        elif j%3==1:blob((dx,.10,dz),(.40,.26,.31),stone[j%3],7,False)
        else:blade_clump(dx,dz,random.uniform(.50,.88))
for side in (-1,1):
    for j in range(15):
        blade_clump(side*random.uniform(15.5,17.3),-14+j*1.77,random.uniform(.40,.80))

def broadleaf(origin, direction, length, width, material):
    axis=V(direction).normalized()
    lateral=axis.cross(up)
    if lateral.length<.01:return
    lateral.normalize()
    root=V(origin);mid=root+axis*length*.52;tip=root+axis*length
    ridge=mid+up*width*.36
    verts=[root,mid+lateral*width,ridge,tip,mid-lateral*width]
    mesh(material,verts,[(0,1,2),(1,3,2),(2,3,4),(0,2,4)])

def bent_stem(path,radii,material):
    for a,b,ra,rb in zip(path,path[1:],radii,radii[1:]):
        rod(a,b,ra,rb,material,8)

def gnarled_hazel(x,z,h,autumn=False):
    # Knotted, broad candelabra crown. Bent forks remain visible under leaf tips.
    a=V((x,-.22,z)); b=a+V((.14*h,.43*h,-.04*h))
    c=a+V((.05*h,.70*h,.075*h))
    bent_stem([a,b,c],[h*.076,h*.050,h*.030],hazel)
    for j in range(5):
        ang=TAU*j/5+.6;d=V((math.cos(ang),0,math.sin(ang)))
        root=b if j%2 else c; elbow=root+d*h*(.20+.028*j)+up*h*.07
        end=elbow+d*h*.11+up*h*(.16+.018*(j%3))
        bent_stem([root,elbow,end],[h*.037,h*.023,h*.012],hazel)
        branch=end+V((-d.z,.60,d.x))*h*.16
        rod(elbow,branch,h*.019,h*.009,hazel,7)
        for index,tip in enumerate((end,branch)):
            m=(russet,russetshade)[(j+index)%2] if autumn else (elder,oakleaf[1],oakleaf[3])[(j+index)%3]
            r=h*(.195 if index==0 else .13)
            blob(tuple(tip),(r*1.34,r*.71,r),m,9)
            for k in range(4):
                ang=TAU*k/4+1.1*j
                ray=V((math.cos(ang),-.16,math.sin(ang)))
                broadleaf(tip+ray*r*.82,ray,r*.47,r*.15,m)
    for dx,dz in [(-.36,-.16),(.33,-.19),(-.10,.45)]:
        bent_stem([(x+.10,.43,z),(x+dx,.15,z+dz),(x+dx*2,-.1,z+dz*2)],[.20,.115,.024],hazel)
    # Root flare contact patch and lichen catches on the shaded side.
    blob((x,-.1,z),(.84,.15,.71),soilshadow,9)
    for n in range(3):
        q=V((x,.05,z)).lerp(b,.25+n*.18)
        blob((q.x-.11,q.y,q.z+.085),(.10,.053,.03),lichen,6)

def salal(x,z,r):
    # Glossy leaf sprays tip downward at the periphery of the foliage bank.
    stem=V((x,.16,z))
    for k in range(5):
        a=k*TAU/5+.61;d=V((math.cos(a),0,math.sin(a)))
        tip=stem+d*r*.64+up*r*(.48+.12*(k%3))
        rod(stem,tip,r*.024,r*.01,hazel,5)
        blob(tuple(tip),(r*.40,r*.22,r*.34),oakleaf[k%4],7)
        for j in range(4):
            a+=1.51
            v=V((math.cos(a),.16*(j%2)-.05,math.sin(a)))
            broadleaf(tip+v*r*.19,v,r*.57,r*.14,grass[(k+j)%3])

def mushroom(x,z,h,color):
    rod((x,.01,z),(x+.012,h*.73,z),h*.115,h*.135,gill,7)
    blob((x,h*.71,z),(h*.44,h*.075,h*.42),gill,10)
    blob((x,h*.77,z),(h*.47,h*.245,h*.44),color,10)
    for k in range(3):
        a=k*2.3;d=h*.22
        blob((x+math.cos(a)*d,h*.945,z+math.sin(a)*d),(.014,.005,.013),gill,6)

# Tall trees emerge from overlapping wooded berms. The shaded understorey is
# continuous from the driver's low eye, with distinct cedar, beech and hazel layers.
for sx,sz,rx,rz,rise in [(-18,-17,8.2,9.4,1.03),(-21,-7,6.7,8.3,.83),
    (18,-16,8,9.7,1.17),(21,-6,6.6,8.8,.88),(-10,-25,10,5,.87),
    (8,-24.5,11,6.2,1.13),(0,-32,22,6,.92)]:
    blob((sx,-.58,sz),(rx,rise+.57,rz),soil,14)
for x,z,h,autumn in [(-12,-17.5,4.5,True),(-17,-10,3.7,False),
    (12.6,-17.3,4.25,False),(16.1,-11.3,4.45,True),(-9.8,-24,4.7,False),
    (9.6,-23,3.9,True)]:
    gnarled_hazel(x,z,h,autumn)
for x,z,r in [(-11.9,-14.6,1.51),(-13.2,-14.0,.98),(-14.1,-12.8,.92),
    (-15.1,-10.1,1.30),(-16.2,-8.2,.97),(11.1,-15.0,1.51),
    (12.1,-14.3,1.21),(13.4,-13.9,.97),(14.4,-12.3,1.36),(15.5,-11.0,.87),
    (15.3,-8.4,1.18),(15.9,-4.6,1.24),(-9.3,-20.5,1.1),(9.6,-20,1.26)]:
    salal(x,z,r)
    fern(x-.31,z+.42,r*.93); blade_clump(x+r*.53,z-.41,r*.72)
for x,z,angle in [(-13.3,-12.65,.45),(12.2,-13.05,-.38),(15.4,-6.6,-.7)]:
    # Windfall nursing a bed of mushrooms: sawn end rings face the parking lot.
    dx,dz=math.cos(angle),math.sin(angle);s=V((x,.19,z));end=s+V((dx*1.42,.15,dz*1.42))
    rod(s,end,.225,.17,wooddark,12)
    cap=end+V((dx*.012,0,dz*.012))
    rod(end,cap,.158,.158,wood,12)
    rod(cap,cap+V((dx*.005,0,dz*.005)),.075,.075,hazel,10)
    elbow=s+V((dx*.56,.28,dz*.56+.14))
    rod(s+V((dx*.4,.09,dz*.4)),elbow,.083,.048,wooddark,7)
    for j,(ox,oz,h) in enumerate([(-.14,.48,.26),(.07,.40,.37),(.27,.48,.19),(.94,.33,.25),(.81,.21,.18)]):
        mushroom(x+ox,z+oz,h,(shroom,russet)[j%2])

# Split-rail boundary, seating, lamps, and vintage drive-in identity panel.
group="04 · Furniture"
for side in (-1,1):
    x=side*14.6
    for i in range(11):
        z=-11.9+i*2.24
        box((x,.47,z),(.17,.93,.19),wood,.035)
        if i<10:
            for y in (.34,.67):box((x,y,z+1.12),(.092,.12,2.26),wooddark,.024)
def bench(x,z):
    for dx in (-.7,.7):
        for dz in (-.18,.18):rod((x+dx,.02,z+dz),(x+dx,.48,z+dz),.038,.044,iron)
        rod((x+dx,.42,z-.20),(x+dx,.92,z-.32),.036,.036,iron)
    for j in range(3):box((x,.49,z-.15+j*.15),(1.93,.094,.137),wood,.024)
    for j in range(2):box((x,.68+j*.15,z-.28-j*.03),(1.93,.113,.065),wood,.016)
bench(11.8,-7.35);bench(-11.0,-8.8)
# Restored window-speaker posts to either side of the central bays.
for x,z in ((-5.26,-5.8),(5.26,3.8)):
    rod((x,.018,z),(x,.13,z),.19,.16,curb,10)
    rod((x,.12,z),(x,1.02,z),.05,.046,teal,10)
    box((x,1.06,z),(.31,.30,.20),mint,.055)
    for k in range(3):
        box((x,1.015+k*.044,z+.104),(.18,.014,.014),teal,.004)
    rod((x+.08,.92,z-.02),(x+.15,.80,z-.01),.018,.016,black,6)
    rod((x+.15,.80,z-.01),(x+.10,.70,z),.016,.012,black,6)
# Slatted litter bin, raised rim, lid and two small rivets.
for x,z in ((13.1,-7.2),(-12.35,-8.7)):
    rod((x,.025,z),(x,.71,z),.225,.26,teal,12)
    rod((x,.68,z),(x,.76,z),.28,.28,wood,12)
    rod((x,.763,z),(x,.789,z),.215,.215,black,12)
    for k in range(10):
        a=k*TAU/10
        rod((x+.223*math.cos(a),.10,z+.223*math.sin(a)),
            (x+.254*math.cos(a),.62,z+.254*math.sin(a)),.009,.009,mint,4)
def lamp(x,z,h):
    box((x,.10,z),(.46,.20,.45),curb,.055)
    rod((x,.2,z),(x,h,z),.093,.061,iron,10)
    rod((x,h-.19,z),(x,h+.04,z+.38),.052,.052,iron,8)
    rod((x,h+.035,z+.38),(x,h+.035,z+.69),.048,.048,iron)
    rod((x,h+.02,z+.65),(x,h-.15,z+.65),.053,.052,iron)
    rod((x,h-.28,z+.65),(x,h-.12,z+.65),.305,.105,iron,12)
    rod((x,h-.336,z+.65),(x,h-.28,z+.65),.235,.27,neon,12)
for p in [(-13.3,-7.5,2.8),(13.2,-7.5,2.8),(12.9,7.8,2.8)]:lamp(*p)
# A garland follows each verge into the trees. The innermost hooks are
# beyond the image aperture so every project remains legible in the cabin.
def garland(start,end,droop,count):
    a,b=V(start),V(end)
    def at(t):
        return a.lerp(b,t)-up*(4*t*(1-t)*droop)
    for k in range(12):rod(at(k/12),at((k+1)/12),.014,.014,black,5)
    for i in range(count):
        p=at((i+.50)/count);tail=p-up*(.13+.053*(i%3))
        rod(p,tail,.013,.013,black,5)
        rod(tail-up*.061,tail,.035,.037,iron,7)
        c=tail-up*.111
        blob(tuple(c),(.059,.085,.059),bulb if i%4 else neon,8)
        rod(c-up*.07,c+up*.052,.008,.012,neon,5)
for side in (-1,1):
    inner=(side*8.95,5.30,-16.5);mid=(side*13.7,3.45,-13.5);outer=(side*15.65,3.58,-8.8)
    for tip in (mid,outer):
        rod((tip[0],.025,tip[2]),tip,.102,.061,wood,9)
        rod((tip[0],tip[1]-.15,tip[2]),(tip[0],tip[1]+.085,tip[2]),.076,.06,iron,8)
    garland(inner,mid,.67,6);garland(mid,outer,.61,5)
for x,z in ((-12,7.35),(-8.2,7.45),(7.50,-.9),(9.55,-.9)):
    rod((x,.02,z),(x,.66,z),.075,.068,amberpaint)
    rod((x,.49,z),(x,.55,z),.071,.071,frame)
# Two-part roadside marquee with a wing, a star, a real miniature letter board.
x,z=-11.6,-10.7
for dx in (-.81,.81):
    rod((x+dx,.01,z),(x+dx,3.9,z),.098,.088,teal)
box((x,3.25,z),(3.3,1.08,.28),mint,.14)
box((x,3.22,z+.158),(3.05,.87,.046),teal,.075)
sign("OOO",x,3.38,z+.197,.54,neonred,tracking=1.12)
sign("DRIVE-IN",x,3.015,z+.196,.208,paper,tracking=1.15)
box((x,2.30,z),(2.7,.61,.21),iron,.043)
box((x,2.30,z+.12),(2.57,.51,.041),paper,.024)
sign("FOREST CINEMA",x,2.30,z+.148,.205,black,tracking=1.03)
for j,w in enumerate((.76,.56,.34)):
    box((x-1.50-w*.4,3.43-j*.18,z),(w,.076,.16),neonred,.026)

# A projectionist's road case beside the roadside sign. Hardware, reel
# perforations, spool hub and an envelope are visible from the nearest bay.
x,z=-10.7,-11.55
box((x,.34,z),(1.18,.59,.62),black,.061)
box((x,.63,z),(1.20,.094,.64),teal,.026)
for dx in (-.43,.43):
    box((x+dx,.38,z+.315),(.057,.47,.026),steel,.007)
    box((x+dx,.56,z+.340),(.102,.085,.027),steel,.013)
    for dy in (.18,.55):blob((x+dx,dy,z+.357),(.011,.011,.005),paper,6)
box((x,.42,z+.336),(.255,.06,.035),iron,.012)
sign("PROJECTION",x,.27,z+.327,.072,paper)
for radius,depth,material,y in ((.265,.045,steel,.91),(.218,.05,iron,.91),(.265,.035,steel,.91)):
    rod((x-.22,y,z),(x-.22,y,z+depth),radius,radius,material,24)
    z+=depth
for j in range(5):
    a=TAU*j/5
    px=x-.22+math.sin(a)*.146;py=.91+math.cos(a)*.146
    rod((px,py,z+.002),(px,py,z+.009),.052,.052,black,9)
rod((x-.22,.91,z+.002),(x-.22,.91,z+.011),.033,.033,black,10)
box((x+.23,.707,z-.09),(.4,.037,.28),paper,.01,angle=.14)

# Thermos, cup, and a folded cinema program left beneath a bench light.
x,z=11.8,-7.35
rod((x-.6,.56,z),(x-.6,.83,z),.056,.061,teal,12)
rod((x-.6,.835,z),(x-.6,.91,z),.053,.053,steel,12)
rod((x-.6,.723,z),(x-.6,.764,z),.063,.063,paper,12)
rod((x-.42,.55,z+.065),(x-.42,.615,z+.065),.033,.046,paper,10)
rod((x-.42,.615,z+.065),(x-.42,.619,z+.065),.036,.036,wooddark,10)
box((x+.44,.55,z+.035),(.31,.013,.22),paper,.004,angle=.11)

group="05 · Vision ticket machine"
x,z=8.5,-1.65
box((x,.075,z),(2.4,.15,1.91),curb,.085)
box((x,.23,z),(1.18,.17,.79),teal,.075)
box((x,1.10,z),(1.22,1.67,.72),mint,.10)
box((x,1.13,z+.36),(1.046,1.50,.092),teal,.059)
box((x,.92,z+.412),(.91,.84,.031),mint,.032)
box((x,2.02,z),(1.31,.34,.80),teal,.10)
box((x,2.05,z+.414),(1.19,.27,.04),paper,.038)
sign("VISION",x,2.055,z+.445,.222,teal,tracking=1.11)
# Curved overhang in strips, orange trim and luminous undercut.
box((x,2.31,z+.01),(1.57,.17,1.00),mint,.075)
box((x,2.255,z+.052),(1.57,.059,.98),amberpaint,.025)
box((x,2.215,z+.37),(1.32,.052,.31),neon,.014)
box((x,1.61,z+.414),(.94,.43,.044),black,.034)
box((x,1.63,z+.446),(.83,.32,.022),lens,.018)
sign("ADMIT ONE",x,1.67,z+.467,.132,teal)
sign("RAIN OR SHINE",x,1.54,z+.467,.06,teal,tracking=1.06)
for i,col in enumerate((amberpaint,red,lens)):
    dx=(i-1)*.274
    box((x+dx,1.23,z+.445),(.23,.20,.035),paper,.013)
    box((x+dx,1.25,z+.468),(.19,.093,.014),col,.006)
    rod((x+dx,1.02,z+.46),(x+dx,1.02,z+.494),.055,.048,col,12)
sign("PUSH TO PRINT",x,.835,z+.45,.074,teal,tracking=1.05)
box((x,.63,z+.432),(.71,.17,.16),black,.038)
box((x,.647,z+.521),(.55,.045,.012),iron,.009)
box((x-.03,.627,z+.584),(.225,.018,.18),paper,.005)
for i in range(6):box((x-.31+i*.125,.367,z+.373),(.076,.062,.018),teal,.009)
for dx in (-.45,.45):
    rod((x+dx,1.38,z+.406),(x+dx,1.38,z+.427),.016,.016,steel,8)
# A film-program dispenser is bolted directly to the vending machine side.
# Printed leaflets keep their paper edges and colored graphic blocks even up close.
box((x+.68,.78,z+.006),(.24,.24,.32),teal,.024)
for i in range(4):
    px=x+.632+i*.030
    box((px,.918+i*.012,z+.005),(.023,.24,.215),paper,.006)
    box((px,.990+i*.012,z+.117),(.021,.045,.004),(red,mint,amberpaint,teal)[i],.001)

# Emit shared material primitives in small semantic sections. No lights/cameras
# are exported; the game owns the rainy-night illumination and projection.
for (category,material),(vs,fs,ss) in batches.items():
    col=bpy.data.collections.get(category)
    if col is None:
        col=bpy.data.collections.new(category);bpy.context.scene.collection.children.link(col)
    data=bpy.data.meshes.new(category+" / "+material.name)
    data.from_pydata(vs,[],fs);data.materials.append(material);data.update()
    if material in (road,tarmac):
        uv=data.uv_layers.new(name="Pavement grain, 3.2m repeat")
        coords=[]
        for loop in data.loops:
            vert=data.vertices[loop.vertex_index].co
            coords.extend((vert.x/3.2,vert.y/3.2))
        uv.data.foreach_set("uv",coords)
    data.polygons.foreach_set('use_smooth',ss)
    ob=bpy.data.objects.new(data.name,data);col.objects.link(ob)
    ob["assembly"]=category

scene=bpy.context.scene
world=bpy.data.worlds.new("Overcast midnight");world.color=(.08,.10,.14);scene.world=world
scene["projection_bounds_web"] ="centre [0,6,-16.5] · 17 × 9.5625 m · front +Z"
scene["ticket_station_web"] ="[8.5,0,-1.65] · front +Z"
# The opening view in Blender frames the actual architecture and keeps every
# authored group accessible by name.
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        sp=area.spaces.active
        sp.region_3d.view_distance=38
        sp.region_3d.view_location=(0,5,3)
        sp.region_3d.view_rotation=V((-.65,-1.4,1.03)).to_track_quat('Z','Y')
        sp.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "Forest drive-in.blend"), compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "grounds.glb"),export_format='GLB',
    export_cameras=False,export_lights=False,export_animations=False,export_yup=True)
print("OOO forest exported:", OUT / "grounds.glb")
