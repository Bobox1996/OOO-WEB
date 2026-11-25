"""Blender masters for the Forest House coffee bar on the Sumiyoshi street.

Run Blender -b -t 4 -P build_cafe.py [-- cafe-front cafe]. Dimensions are in
metres, given as (street east, height, street south) to match Three.js. The
masters keep construction systems as collections. GLBs are batched by finish.
"""
import bpy
import math
import random
import sys
from collections import defaultdict
from itertools import product
from pathlib import Path
from mathutils import Vector

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[2]/'public'/'sumiyoshi'/'models'
OUT.mkdir(exist_ok=True, parents=True)
TAU=math.tau
PALETTE={
    'porcelain':'efe9d8','snow':'e7e7da','pearl':'cecfbf','grey':'96a497',
    'bronze':'958153','brass':'c19b5e','gold':'dcad59','brassLight':'ffe2a7',
    'wood':'b68b57','oak':'d0a673','veneer':'856849','teak':'77503a','walnut':'513f32',
    'iodine':'43312c','iron':'414849','char':'373c38','mortar':'aa8d76',
    'clay':'a95f4e','clayLight':'be705a','clayRose':'b96d5c','oxblood':'683632',
    'wine':'623936','cinnabar':'9b5040','ceramic':'f0deba','turquoise':'7a998d',
    'spruce':'425e4f','moss':'68835a','leaf':'829963','shoot':'a6b578','fern':'617b53',
    'bark':'786454','earth':'504a3b','water':'9cb2aa','glass':'c6ddd4',
    'poly':'f4f3e6','polyline':'f1efdc','chrome':'aab6ad','espresso':'624332',
    'amber':'d39550','plum':'937c8b','orange':'d79464','bulb':'ffdaa2',
    'glowOak':'dbb784',
}
ALPHA={'glass':.12,'poly':.39,'polyline':.72}
EMIT={'bulb':1.25,'brassLight':.65,'poly':.095,'polyline':.055,'glowOak':.32}
sects={}; current=None; materials={}; font=None


def swizzle(v): return v[0],-v[2],v[1]


def reset():
    global sects,materials,font
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    sects={};materials={}
    def channel(s):
        f=int(s,16)/255
        return f/12.92 if f<=.04045 else ((f+.055)/1.055)**2.4
    for name,hexnum in PALETTE.items():
        rgb=tuple(channel(hexnum[i:i+2]) for i in (0,2,4));alpha=ALPHA.get(name,1)
        mat=bpy.data.materials.new(name);mat.diffuse_color=(*rgb,alpha);mat.use_nodes=True
        bs=mat.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Alpha'].default_value=alpha
        bs.inputs['Roughness'].default_value=.27 if name in ('glass','water','ceramic','porcelain','brass','chrome') else .67
        if name in ('chrome','brass','bronze'):bs.inputs['Metallic'].default_value=.43
        if name in EMIT:
            bs.inputs['Emission Color'].default_value=(*rgb,1);bs.inputs['Emission Strength'].default_value=EMIT[name]
        if alpha<1:mat.surface_render_method='BLENDED'
        materials[name]=mat
    font=None
    for p in ['C:/Windows/Fonts/georgia.ttf','C:/Windows/Fonts/arial.ttf']:
        if Path(p).exists():font=bpy.data.fonts.load(p);break


def section(name):
    global current
    if name not in sects:
        col=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(col)
        sects[name]=(col,defaultdict(lambda:[[],[]]))
    current=sects[name]


def solid(vs,fs,mat):
    verts,faces=current[1][mat]; k=len(verts);verts.extend(swizzle(v) for v in vs)
    faces.extend(tuple(k+i for i in f) for f in fs)


def faceout(vs,ids,ctr):
    a,b,c=[Vector(vs[i]) for i in ids[:3]]
    mid=sum((Vector(vs[i]) for i in ids),Vector())/len(ids)
    return ids if (b-a).cross(c-a).dot(mid-Vector(ctr))>=0 else list(reversed(ids))


def box(x,y,z,w,h,d,m,b=.014):
    center=(x,y,z);half=(w/2,h/2,d/2);b=min(b,min(half)*.67)
    if b<.0001:
        v=[(x+s*half[0],y+t*half[1],z+u*half[2]) for s,t,u in product((-1,1),repeat=3)]
        solid(v,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],m);return
    v=[];idx={};fs=[]
    for signs in product((-1,1),repeat=3):
        for n in range(3):
            idx[(*signs,n)]=len(v)
            v.append(tuple(center[i]+signs[i]*(half[i]-(0 if i==n else b)) for i in range(3)))
    for n in range(3):
        a,b1=(n+1)%3,(n+2)%3
        for s in (-1,1):
            f=[]
            for t,u in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                p=[0]*3;p[n],p[a],p[b1]=s,t,u;f.append(idx[(*p,n)])
            fs.append(faceout(v,f,center))
        for t,u in product((-1,1),repeat=2):
            f=[]
            for s,k in [(-1,a),(1,a),(1,b1),(-1,b1)]:
                p=[0]*3;p[n],p[a],p[b1]=s,t,u;f.append(idx[(*p,k)])
            fs.append(faceout(v,f,center))
    for s in product((-1,1),repeat=3):fs.append(faceout(v,[idx[(*s,n)] for n in range(3)],center))
    solid(v,fs,m)


def profile(x,y,z,rings,m,n=18):
    v=[(x+r*math.cos(i*TAU/n),y+h,z+r*math.sin(i*TAU/n)) for h,r in rings for i in range(n)]
    faces=[tuple(range(n)),tuple(reversed(range((len(rings)-1)*n,len(rings)*n)))]
    for row in range(len(rings)-1):
        for i in range(n):
            j=(i+1)%n;faces.append((row*n+i,(row+1)*n+i,(row+1)*n+j,row*n+j))
    solid(v,faces,m)


def cyl(x,y,z,r,h,m,n=16,rt=None):profile(x,y-h*.5,z,[(0,r),(h,rt if rt is not None else r)],m,n)


def rod(a,b,r,m,n=8,r2=None):
    p,q=Vector(a),Vector(b);delta=q-p
    if delta.length<.00001:return
    direction=delta.normalized()
    u=direction.cross(Vector((1,0,0)) if abs(direction.x)<.8 else Vector((0,0,1))).normalized()
    v=direction.cross(u);r2=r if r2 is None else r2
    points=[tuple(center+rad*(math.cos(i*TAU/n)*u+math.sin(i*TAU/n)*v)) for center,rad in [(p,r),(q,r2)] for i in range(n)]
    faces=[list(reversed(range(n))),list(range(n,2*n))]+[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]
    solid(points,faces,m)


def tube(points,r,m,n=8):
    for p,q in zip(points,points[1:]):rod(p,q,r,m,n)


def label(x,y,z,string,size,m='walnut',angle=0):
    cr=bpy.data.curves.new(string,'FONT');cr.body=string;cr.size=size;cr.align_x='CENTER';cr.align_y='CENTER';cr.resolution_u=3
    if font:cr.font=font
    ob=bpy.data.objects.new(string,cr);current[0].objects.link(ob);ob.location=swizzle((x,y,z));ob.rotation_euler=(math.pi/2,0,angle)
    cr.materials.append(materials[m])


def card(x,y,z,w,h,i,name='House print'):
    mat=bpy.data.materials.get('Forest House printed matter')
    if not mat:
        mat=bpy.data.materials.new('Forest House printed matter');mat.use_nodes=True
        bs=mat.node_tree.nodes.get('Principled BSDF');im=mat.node_tree.nodes.new('ShaderNodeTexImage')
        im.image=bpy.data.images.load(str(HERE/'paper.png'));im.image.pack()
        mat.node_tree.links.new(im.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.79
    v=[swizzle((x+sx*w/2,y+sy*h/2,z)) for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],[(0,1,2,3)])
    uv=mesh.uv_layers.new(name='Print sheet')
    for k,coords in enumerate([((i+.002)/4,.002),((i+.998)/4,.002),((i+.998)/4,.998),((i+.002)/4,.998)]):uv.data[k].uv=coords
    mesh.materials.append(mat);current[0].objects.link(bpy.data.objects.new(name,mesh))


def holed(x,y,z,w,h,diam=.038,spacing=.085):
    # True punched-metal mesh. Each cell triangulates a hexagonal hole to the
    # square perimeter, so a viewer sees the plants through actual openings.
    cols,rows=max(2,round(w/spacing)),max(2,round(h/spacing))
    dx,dy=w/cols,h/rows;radius=min(diam/2,min(dx,dy)*.41)
    perimeter=[(1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1),(0,-1),(1,-1)]
    for j in range(rows):
        for i in range(cols):
            xx=x+(i+.5-cols*.5)*dx;yy=y+(j+.5-rows*.5)*dy
            vs=[(xx+px*dx*.5,yy+py*dy*.5,z) for px,py in perimeter]
            vs+= [(xx+math.cos(k*TAU/8)*radius,yy+math.sin(k*TAU/8)*radius,z) for k in range(8)]
            solid(vs,[(k,(k+1)%8,8+(k+1)%8,8+k) for k in range(8)],'snow')


def leaf(center,angle,l,w,tilt,material,rng):
    p=Vector(center);s=math.sin(angle);c=math.cos(angle);tip=p+Vector((c*l*.52,tilt*l,s*l*.52))
    base=p-Vector((c*l*.47,tilt*l*.34,s*l*.47))
    side=Vector((-s*w*.5,0,c*w*.5))
    middle=p+Vector((0,min(.052,l*.12),0))
    vs=[base,p+side,tip,p-side,middle];fs=[(0,4,1),(1,4,2),(2,4,3),(3,4,0)]
    # Normal toward sky. Canopies are made of folded leaves and stay legible in silhouette.
    fs=[f if (Vector(vs[f[1]])-vs[f[0]]).cross(Vector(vs[f[2]])-vs[f[0]]).y>0 else tuple(reversed(f)) for f in fs]
    solid(vs,fs,material)


def tree(x,y,z,s,seed,bonsai=False):
    rnd=random.Random(seed);p=Vector((x,y,z));height=s;radius=s*(.53 if bonsai else .39)
    trunk=Vector((x+s*.075,y+s*.57,z+s*.035));fork=Vector((x-s*.028,y+s*.26,z+s*.02))
    rod(p,fork,s*(.038 if bonsai else .025),'bark',9,s*.027);rod(fork,trunk,s*.027,'bark',9,s*.020)
    count=12 if bonsai else 11
    for i in range(count):
        a=i*2.41+seed*.31
        t=(i+.45)/count
        joint=p.lerp(trunk,.48+t*.60)
        ext=radius*(.60+.36*math.sin(t*math.pi))
        tip=Vector((x+math.cos(a)*ext,y+s*(.54+.38*t),z+math.sin(a)*ext))
        bend=joint.lerp(tip,.54)+Vector((0,-s*.025,0))
        rod(joint,bend,s*(.015 if bonsai else .011),'bark',7,s*.008)
        rod(bend,tip,s*.008,'bark',6,s*.003)
        for g in range(3):
            t2=a+rnd.uniform(-1.1,1.1)
            cluster=tip+Vector((math.cos(t2)*s*.105,rnd.uniform(-.025,.085)*s,math.sin(t2)*s*.105))
            rod(tip,cluster,s*.004,'fern',5,s*.002)
            for k in range(11):
                angle=rnd.uniform(0,TAU);spread=math.sqrt(rnd.random())*s*(.125 if bonsai else .106)
                spot=cluster+Vector((math.cos(angle)*spread,rnd.uniform(-.018,.025)*s,math.sin(angle)*spread))
                leaf(spot,rnd.uniform(0,TAU),rnd.uniform(.073,.13)*s,rnd.uniform(.040,.072)*s,rnd.uniform(-.38,.31),rnd.choice(('leaf','moss','shoot','fern','moss')),rnd)


def pot(x,y,z,r,h,color='mortar'):
    profile(x,y,z,[(0,r*.74),(.035*h,r*.80),(.86*h,r),(.94*h,r*1.016),(h,r*.99)],color,20)
    cyl(x,y+h+.002,z,r*.924,.008,'earth',18)


def grasses(x,y,z,w,d,n,seed):
    rng=random.Random(seed)
    for j in range(n):
        xx=x+rng.uniform(-w*.46,w*.46);zz=z+rng.uniform(-d*.42,d*.42);h=rng.uniform(.16,.42)
        for k in range(5):
            a=rng.uniform(0,TAU); c,s=math.cos(a),math.sin(a);width=rng.uniform(.015,.043)
            pts=[(xx-s*width,y,zz+c*width),(xx+c*.08,y+h*.66,zz+s*.08),(xx+c*.18,y+h,zz+s*.18),(xx+c*.09+s*width*.48,y+h*.40,zz+s*.09-c*width*.48),(xx+s*width,y,zz-c*width)]
            solid(pts,[(0,1,3,4),(1,2,3)],rng.choice(('moss','leaf','shoot','fern')))


def casing(x,y,z,w,h,d,m='oak',thick=.054):
    for xx in (-1,1):box(x+xx*(w-thick)/2,y,z,thick,h,d,m,.005)
    for yy in (-1,1):box(x,y+yy*(h-thick)/2,z,w,thick,d,m,.005)


def pergola(x,y,z,w,d,axis_pitch=.21,m='wood'):
    count=max(2,int(w/axis_pitch))
    for i in range(count):box(x+(i+.5-count*.5)*w/count,y,z,.052,.10,d,m,.004)


def front():
    reset();section('01 / raised sill, party walls and garden deck')
    # Balconies and screens overhang an entirely independent warm timber house.
    box(0,.08,-2.55,7.18,.16,5.10,'grey',.04)
    for side in (-1,1):
        box(side*3.51,1.53,-2.42,.17,3.03,4.88,'pearl',.015)
        if side<0:box(side*3.51,4.55,-2.42,.17,3.12,4.88,'pearl',.015)
        else:box(side*3.51,4.45,-4.47,.17,2.98,.75,'pearl',.015)
    box(0,3.03,-2.34,7.07,.18,4.70,'porcelain',.02)
    box(0,2.90,-4.83,7.13,5.75,.125,'pearl',.02)
    # A set-back roof keeps the white envelope free along its sloping edge.
    # Three opaque strips form a planted rooflight over the internal court.
    for xx in (-2.43,2.43):
        box(xx,5.81,-2.60,2.16,.14,4.34,'pearl',.012)
        box(xx,5.90,-2.60,2.01,.044,4.24,'grey',.006)
    box(0,5.81,-4.39,2.77,.14,.78,'pearl',.008)
    for xx in (-1.37,1.37):
        box(xx,5.88,-2.20,.082,.15,3.62,'snow',.009)
    for zz in (-.43,-3.98):box(0,5.88,zz,2.80,.15,.07,'snow',.006)
    box(0,5.86,-2.19,2.67,.028,3.54,'glass',0)
    for i in range(30):
        xx=(i-14.5)*.23
        box(xx,.179,-1.64,.223,.06,3.12,'oak' if i%5 else 'wood',.002)
    for xx in (-3.36,-1.76,1.75,3.36):
        box(xx,2.94,-.63,.15,5.70,.17,'oak',.016)
    for yy in (.32,2.71,3.21,5.66):
        box(0,yy,-.64,6.85,.12,.17,'wood',.012)
    section('02 / wood-framed sliding garden doors')
    for i in range(6):
        x=(i-2.5)*1.11
        for y in (1.54,4.42):
            if y<2 and abs(x)<.6:continue
            casing(x,y,-.69,1.08,2.26,.12)
            box(x,y,-.71,.974,2.14,.022,'glass',0)
    box(0,2.82,-.72,6.85,.22,.13,'wood',.005)
    box(0,5.61,-1.01,6.86,.145,.98,'oak',.014)
    for x in (-2.69,2.68):
        box(x,1.26,-2.76,1.0,2.13,.15,'oak',.012)
        box(x,1.26,-2.648,.81,1.91,.062,'brassLight',.009)
    section('03 / garden court and ground floor benches')
    for x,sz,seed in [(-2.75,2.62,42),(2.38,2.19,71)]:
        pot(x,.18,-1.70,.43,.42,'mortar');tree(x,.60,-1.70,sz,seed)
    grasses(-2.62,.25,-.80,1.38,.46,15,11)
    pot(1.15,.18,-.94,.25,.38,'clay');tree(1.15,.56,-.94,1.18,54)
    # A miniature view of the coffee room is visible through the open door.
    # The full walkable room has its own asset and does not duplicate geometry.
    box(0,1.50,-3.72,4.81,2.60,.12,'glowOak',.02)
    box(0,.60,-3.06,3.35,.89,.56,'teak',.03)
    box(0,1.09,-3.06,3.42,.107,.62,'walnut',.019)
    for i in range(3):mug(-.79+i*.35,1.15,-2.99,.89,'turquoise' if i==1 else 'ceramic')
    box(-.17,2.07,-3.45,2.52,.071,.41,'teak',.009)
    for i in range(5):
        carafe(-1.15+i*.39,2.11,-3.45,.83,('turquoise','amber','spruce','porcelain','clayRose')[i])
    card(1.40,2.1,-3.63,.63,.79,1,'Botanical interior display')
    for xx in (-.88,.80):lantern(xx,2.70,-2.61,.80)
    section('04 / individual punched-steel sliding screens')
    for xx,w in [(-2.73,1.47),(-1.65,.62),(2.83,1.18)]:
        casing(xx,1.43,-.04,w,2.56,.105,'snow',.054)
        # Screen panels are drawn partly aside, exposing the central entry.
        holed(xx,1.43,-.009,w-.105,2.46,.052,.09)
        box(xx+.26*w,1.34,.055,.026,.30,.034,'bronze',.006)
        for xx2 in (xx-w*.40,xx+w*.40):cyl(xx2,.12,-.04,.045,.042,'iron',8)
    for side in (-1,1):
        box(side*2.34,.134,.035,2.32,.036,.13,'chrome',.005)
    box(0,2.88,-.016,7.14,.11,.26,'snow',.010)
    section('05 / open awning sash, upper galleries and milky multiwall sheets')
    # Asymmetric folded elevation slopes up to the right. Silvery flutes are
    # individually modelled with alternating transparent skin and pale crests.
    roof_y=lambda x: 6.11+(x+3.59)*.104
    for i in range(6):
        x=(i-2.5)*1.18
        low=3.04;high=roof_y(x)
        # Balcony pocket occupies a pair of middle bays.
        if i not in (2,3):
            box(x,(low+high)*.5,-.14,1.17,high-low,.033,'poly',0)
            for j in range(18):
                xx=x+(j-8.5)*.065
                top=roof_y(xx)
                box(xx,(low+top)*.5,-.111,.017,top-low,.019,'polyline',0)
        else:
            box(x,high-.23,-.14,1.17,.45,.032,'poly',0)
            for j in range(18):
                box(x+(j-8.5)*.065,high-.23,-.111,.017,.45,.019,'polyline',0)
        box(x-.59,(low+high)*.5,-.095,.045,high-low,.060,'snow',.005)
    upper=roof_y(3.54)
    box(3.54,(upper+3.04)/2,-.1,.050,upper-3.04,.065,'snow',.004)
    rod((-3.58,roof_y(-3.58),-.13),(3.57,roof_y(3.57),-.13),.045,'snow')
    # Acrylic ribbon returns down the east side of the planted upper floor.
    for i in range(26):
        zz=-.20-i*.14
        box(3.58,4.95,zz,.033,3.58,.141,'poly',0)
        box(3.60,4.95,zz,.020,3.58,.023,'polyline',0)
    # Timber operating sash at the pocket, projected open with real metal stays.
    x=-.50;y=5.63;z=-.14
    for a,b in [((x-.58,y,z),(x+.58,y,z)),((x-.58,y+.32,z+.55),(x+.58,y+.32,z+.55)),
                ((x-.58,y,z),(x-.58,y+.32,z+.55)),((x+.58,y,z),(x+.58,y+.32,z+.55))]:
        rod(a,b,.032,'oak',8)
    solid([(x-.57,y,z),(x+.57,y,z),(x+.57,y+.32,z+.55),(x-.57,y+.32,z+.55)],[(0,3,2,1)],'glass')
    for side in (-1,1):rod((x+side*.53,y-.30,z),(x+side*.53,y+.25,z+.46),.011,'chrome',6)
    section('06 / cantilevered planting ledges and layered foliage')
    for x,y,z,w,d in [(-.04,3.13,.16,2.95,.84),(2.20,4.21,.02,1.39,.61),(-2.78,3.40,.03,1.14,.58)]:
        box(x,y,z,w,.34,d,'snow',.019)
        box(x,y+.17,z,w-.09,.032,d-.08,'earth',.007)
        box(x,y-.186,z,w+.03,.036,d+.04,'pearl',.005)
        grasses(x,y+.18,z,w-.17,d-.15,round(w*10),int((x+5)*41))
    tree(-.66,3.31,.02,1.86,231,True);tree(.48,3.31,-.23,2.44,106);tree(2.17,4.40,-.14,1.39,421,True)
    tree(-2.75,3.57,-.15,1.0,435,True)
    tree(-2.10,3.15,-.72,2.10,313);tree(2.68,3.13,-.91,2.43,341)
    section('07 / entry inscription, pavement and display card')
    box(1.20,1.65,-.04,.55,.75,.07,'brass',.018)
    card(1.2,1.65,.002,.49,.69,2,'House plaque')
    box(-.92,1.36,.055,.055,.37,.08,'brass',.012)
    box(0,.030,.32,2.02,.066,.64,'grey',.017)
    box(0,.066,.32,1.76,.027,.45,'mortar',.012)
    for i in range(13):box((i-6)*.124,.081,.32,.05,.007,.35,'veneer',0)
    box(0,2.77,.025,1.71,.12,.07,'walnut',.008)
    label(0,2.77,.065,'F O R E S T   H O U S E',.088,'porcelain')
    finish('cafe-front')


def mug(x,y,z,scale=1,color='ceramic',with_saucer=True,handle=True):
    s=scale
    if with_saucer:profile(x,y,z,[(0,.133*s),(.016*s,.144*s),(.027*s,.129*s)],color,18)
    by=y+.028*s
    profile(x,by,z,[(0,.066*s),(.025*s,.079*s),(.135*s,.098*s),(.15*s,.097*s)],color,18)
    cyl(x,by+.149*s,z,.084*s,.003*s,'espresso',18)
    cyl(x,by+.152*s,z,.043*s,.003*s,'amber',14)
    if handle:
        offsets=[(.087,.13),(.129,.14),(.152,.115),(.148,.081),(.106,.062),(.087,.069)]
        tube([(x+a*s,by+b*s,z) for a,b in offsets],.014*s,color,7)


def carafe(x,y,z,s,color):
    profile(x,y,z,[(0,.09*s),(.02*s,.105*s),(.19*s,.137*s),(.28*s,.110*s),(.33*s,.07*s),(.345*s,.07*s)],color,16)
    tube([(x+.075*s,y+.29*s,z),(x+.172*s,y+.29*s,z),(x+.192*s,y+.18*s,z),(x+.104*s,y+.12*s,z)],.014*s,'walnut',7)


def platter(x,y,z,r,color='porcelain'):
    profile(x,y,z,[(0,r*.72),(.014,r*.87),(.027,r),(.044,r*.98)],color,20)


def espresso_machine(x,y,z):
    # Group heads, polished counter, striped service vents and two portafilters.
    box(x,y+.087,z,1.28,.16,.62,'iodine',.045)
    box(x,y+.19,z-.06,1.20,.16,.46,'chrome',.035)
    box(x,y+.50,z-.16,1.22,.55,.29,'cinnabar',.076)
    box(x,y+.715,z-.03,1.31,.19,.61,'clayRose',.075)
    box(x,y+.674,z+.266,1.19,.121,.054,'chrome',.014)
    for i in range(9):box(x+(i-4)*.122,y+.647,z+.297,.068,.018,.013,'walnut',.003)
    for i in (-1,1):
        xx=x+i*.285
        cyl(xx,y+.506,z+.072,.109,.087,'chrome')
        rod((xx,y+.477,z+.084),(xx+i*.098,y+.458,z+.237),.021,'iodine')
        cyl(xx,y+.435,z+.09,.025,.088,'brass')
        mug(xx,y+.20,z+.097,.72,'porcelain',False)
        cyl(xx,y+.805,z-.068,.13,.035,'iron')
    box(x,y+.805,z-.09,1.14,.045,.50,'chrome',.015)
    for i in range(4):cyl(x+(i-1.5)*.21,y+.881,z-.085,.078,.14,'ceramic',12,.068)
    for j in range(6):box(x,y+.179,z+.096+j*.030,1.13,.013,.009,'char',0)
    label(x,y+.527,z-.002,'M O R I',.082,'ceramic')


def grinder(x,y,z):
    box(x,y+.047,z,.40,.09,.40,'walnut',.025)
    box(x,y+.32,z-.027,.29,.51,.31,'wine',.040)
    cyl(x,y+.661,z,.205,.27,'espresso',16,.254);cyl(x,y+.82,z,.27,.052,'iron',18)
    rod((x,y+.48,z+.092),(x,y+.375,z+.20),.050,'chrome',9)
    cylinder_y=y+.109
    cyl(x,cylinder_y,z+.072,.09,.08,'chrome',16,.098)


def bun(x,y,z,s,seed):
    rnd=random.Random(seed)
    profile(x,y,z,[(0,.11*s),(.025*s,.16*s),(.082*s,.15*s),(.126*s,.102*s),(.145*s,.045*s)],'amber',16)
    for i in range(6):
        a=rnd.uniform(0,TAU);rr=rnd.uniform(.017,.082)*s
        cyl(x+math.cos(a)*rr,y+.125*s,z+math.sin(a)*rr,.008*s,.012*s,'ceramic',5)


def lantern(x,y,z,s=1):
    rod((x,y+.41*s,z),(x,y+.06*s,z),.012*s,'walnut')
    profile(x,y-.23*s,z,[(0,.21*s),(.018*s,.25*s),(.073*s,.27*s),(.163*s,.17*s),(.23*s,.058*s)],'wine',18)
    profile(x,y-.224*s,z,[(0,.228*s),(.012*s,.243*s)],'bulb',18)
    cyl(x,y-.255*s,z,.064*s,.071*s,'bulb',14)


def counter():
    section('04 / solid walnut bar, brass foot rail and till')
    x,z=-3.615,-1.675
    box(x,.52,z,4.37,.99,1.00,'walnut',.045)
    # Band inlays, stiles, panel rails and the projecting timber nosing.
    for i in range(6):
        xx=x+(i-2.5)*.68
        box(xx,.52,-1.163,.65,.71,.036,'teak',.018)
        box(xx,.52,-1.139,.57,.59,.026,'walnut',.012)
        box(xx,.528,-1.123,.486,.50,.015,'teak',.008)
    box(x,.156,-1.144,4.32,.12,.048,'iodine',.009)
    box(x,.894,-1.13,4.35,.077,.050,'wood',.007)
    box(x,1.041,z,4.43,.168,1.10,'iodine',.052)
    for i in range(4):
        box(x,1.129,z+(i-1.5)*.255,4.34,.023,.247,'teak' if i%2 else 'walnut',.005)
    for xx in (-5.48,-3.56,-1.78):rod((xx,.17,-1.136),(xx,.19,-1.055),.027,'brass')
    rod((-5.60,.19,-1.059),(-1.64,.19,-1.059),.027,'brass',10)
    # Pastry plate, cloche, three service settings, and timber check presenter.
    platter(-4.82,1.15,-1.62,.37,'turquoise')
    for i in range(3):bun(-4.82+(i-1)*.13,1.187,-1.59+.08*(i%2),.73,23+i)
    profile(-4.82,1.20,-1.62,[(0,.367),(.10,.349),(.20,.285),(.28,.154),(.30,.034)],'glass',22)
    cyl(-4.82,1.52,-1.62,.055,.054,'brass',12)
    mug(-3.65,1.15,-1.65,.95,'porcelain')
    mug(-3.23,1.15,-1.61,.9,'turquoise')
    box(-1.89,1.17,-1.66,.43,.08,.34,'brass',.022)
    box(-1.89,1.30,-1.72,.31,.22,.11,'walnut',.017)
    box(-1.89,1.30,-1.658,.26,.147,.014,'water',.005)
    for j in range(3):box(-1.89,1.181,-1.57+j*.033,.25,.013,.015,'iodine',0)
    section('05 / backbar, espresso service and hand thrown cups')
    box(-2.30,.56,-4.315,7.4,1.08,.63,'teak',.032)
    for i in range(10):
        xx=-2.30+(i-4.5)*.71
        box(xx,.59,-3.986,.63,.78,.032,'walnut',.022)
        box(xx,.868,-3.959,.26,.027,.031,'brass',.006)
    box(-2.30,1.129,-4.315,7.4,.108,.67,'ceramic',.026)
    espresso_machine(-3.92,1.19,-4.28);grinder(-2.94,1.19,-4.27)
    for i in range(3):
        mug(-5.68+.34*i,1.19,-4.26,.9,('porcelain','clayRose','turquoise')[i])
    for i in range(3):carafe(-2.16+i*.42,1.19,-4.25,.88,('turquoise','amber','chrome')[i])
    # A wall-level timber cabinet, horizontally quartered like Japanese fittings.
    box(-2.27,2.41,-4.64,7.39,1.87,.12,'teak',.02)
    box(-2.27,2.41,-4.557,7.20,1.70,.068,'veneer',.01)
    for j in range(2):
        yy=2.12+j*.58
        box(-3.67,yy,-4.444,4.53,.073,.29,'teak',.015)
        for xx in (-5.64,-3.66,-1.69):box(xx,yy-.102,-4.51,.048,.19,.14,'brass',.006)
        for i in range(9):
            xx=-5.66+i*.49
            if i in (2,3,6):
                h=.29 if i in (2,6) else .34
                profile(xx,yy+.041,-4.38,[(0,.077),(.04,.10),(.12,.11),(.19,.094),(h,.059)],('turquoise','clayRose','ceramic')[i%3],14)
            else:
                mug(xx,yy+.04,-4.37,.73,('porcelain','turquoise','ceramic')[(i+j)%3],False)
    card(-.50,2.62,-4.438,.75,.95,0,'Coffee room menu')
    card(.45,2.62,-4.438,.75,.95,3,'Evening roast print')


def clock(x,y,z,s):
    rod((x,y,z-.07),(x,y,z+.019),s,'brass',32)
    rod((x,y,z+.02),(x,y,z+.034),s*.91,'ceramic',32)
    for i in range(12):
        a=i*TAU/12; c=math.cos(a);si=math.sin(a)
        rod((x+.73*s*c,y+.73*s*si,z+.045),(x+.83*s*c,y+.83*s*si,z+.045),s*.019,'walnut',5)
    rod((x,y,z+.058),(x-s*.16,y+s*.46,z+.058),s*.035,'walnut')
    rod((x,y,z+.071),(x+s*.55,y+s*.16,z+.071),s*.023,'walnut')
    rod((x,y,z+.071),(x,y,z+.089),s*.073,'brass')


def table(x,z,seed):
    profile(x,.048,z,[(0,.31),(.027,.35),(.072,.31),(.12,.15)],'iron',20)
    cyl(x,.418,z,.077,.66,'walnut',14);cyl(x,.715,z,.163,.05,'brass')
    profile(x,.739,z,[(0,.49),(.027,.57),(.084,.58),(.099,.544)],'teak',30)
    cyl(x,.84,z,.521,.014,'walnut',28)
    mug(x-.164,.85,z+.065,.86,'porcelain')
    carafe(x+.18,.85,z-.14,.60,'turquoise')
    box(x+.135,.861,z+.195,.21,.020,.159,'ceramic',.004)
    box(x+.135,.874,z+.21,.183,.005,.023,'clay',0)
    if seed==2:
        platter(x+.15,.852,z+.16,.125);bun(x+.15,.899,z+.16,.64,67)


def cafe():
    reset();section('01 / individually laid terracotta quarry tile')
    box(0,-.12,0,13.24,.27,9.62,'teak',.06)
    box(0,.013,0,13.12,.045,9.53,'mortar',.015)
    r=random.Random(451)
    for i in range(36):
        for j in range(26):
            x=(i-17.5)*.365;z=(j-12.5)*.366
            color=r.choices(('clay','clayLight','clayRose'),(.57,.18,.25))[0]
            # A single face per tile preserves a readable mortar joint without
            # loading six hidden sides for every piece of fixed floor finish.
            r1,r2=.1765,.177
            solid([(x-r1,.051,z-r2),(x-r1,.051,z+r2),(x+r1,.051,z+r2),(x+r1,.051,z-r2)],[(0,1,2,3)],color)
    section('02 / cutaway oxblood ceiling, rooflight grid and lime plaster')
    box(0,1.86,-4.775,13.23,3.80,.17,'ceramic',.035)
    box(0,.61,-4.646,13.18,1.24,.12,'walnut',.019)
    for side in (-1,1):
        xx=side*6.54
        for z,dep,h in [(-3.42,2.79,3.49),(-.99,2.06,1.86),(2.35,4.54,.64)]:
            box(xx,h*.5,z,.18,h,dep,'ceramic',.022)
            box(xx-side*.007,.27,z,.188,.51,dep,'teak',.008)
            box(xx-side*.010,h,z,.20,.079,dep,'wine',.008)
    for h,m,d in [(1.18,'veneer',.11),(3.37,'wine',.15),(3.64,'oxblood',.18)]:
        box(0,h,-4.63,13.19,.096,d,m,.012)
    # Cut the ceiling above circulation; retain a substantial dark-red back
    # ribbon, deep joists and a sawtooth shadow on the rear wall.
    for i in range(5):
        zz=-4.56+i*.205
        box(0,3.60,zz,13.12,.17,.201,'wine' if i%2 else 'oxblood',.008)
    for x in (-5.86,-3.86,-1.86,.14,2.14,4.14,5.87):
        box(x,3.48,-4.00,.091,.23,1.31,'iodine',.008)
    box(0,3.52,-3.43,13.02,.20,.13,'oxblood',.012)
    # The lattice above the coffee service casts the rectilinear skylight pattern.
    for x in (-4.26,4.10):
        pergola(x,3.67,-3.57,3.0,1.45,.28,'teak')
        for zz in (-4.22,-3.61,-3.00):box(x,3.64,zz,3.11,.078,.053,'walnut',.006)
        for xx in (x-1.55,x+1.55):box(xx,3.64,-3.59,.079,.094,1.44,'walnut',.008)
    section('03 / timber glass partition, lattice and wall display')
    for i in range(4):
        xx=2.23+i*.99
        casing(xx,2.29,-4.61,.961,1.97,.088,'walnut',.05)
        box(xx,2.29,-4.622,.88,1.88,.018,'glass',0)
        for j in range(3):box(xx,1.68+j*.55,-4.550,.91,.03,.045,'oak',.004)
        box(xx,2.28,-4.549,.039,1.93,.045,'oak',.004)
    card(5.72,2.53,-4.518,.75,.94,1,'Botanical plate')
    clock(1.21,2.65,-4.48,.32)
    section('03 / three-bladed timber fan')
    # Back-wall-mounted fan faces the open room, visible during conversations.
    cx,cy,cz=-2.32,3.00,-4.39
    rod((cx,cy,cz-.10),(cx,cy,cz+.074),.115,'brass',16)
    for j in range(3):
        a=.26+j*TAU/3;c,s=math.cos(a),math.sin(a)
        outline=[(.04,-.035),(.17,-.096),(.44,-.091),(.485,-.033),(.418,.040),(.20,.073),(.06,.034)]
        vs=[(cx+u*c-v*s,cy+u*s+v*c,cz+.106) for u,v in outline]
        solid(vs,[tuple(range(len(vs)))],'walnut')
    rod((cx,cy,cz+.109),(cx,cy,cz+.14),.071,'brass',13)
    counter()
    section('06 / banquette, brass pedestal tables and pottery')
    bx,bz=5.94,-1.235
    box(bx,.257,bz,.80,.46,4.93,'walnut',.043)
    box(6.29,.87,bz,.15,1.0,4.92,'teak',.039)
    for i in range(5):
        zz=bz+(i-2)*.964
        box(5.93,.54,zz,.76,.16,.938,'spruce',.057)
        box(6.19,.96,zz,.13,.70,.938,'spruce',.049)
        for j in range(3):box(6.116,.96,zz+(j-1)*.28,.015,.59,.017,'fern',.005)
    for i,(x,z) in enumerate(((4.48,-2.75),(4.62,.30),(-4.87,2.46))):table(x,z,i)
    section('07 / ceramic planting vessel, bonsai and pendant lighting')
    pot(5.85,.058,3.32,.414,.52,'turquoise')
    tree(5.85,.586,3.32,1.57,501,True)
    # Repeated coffee-room greenery also ties the shop to its planted facade.
    pot(-5.70,1.15,-1.71,.175,.194,'mortar')
    tree(-5.7,1.35,-1.71,.68,790,True)
    for i in range(3):lantern(-5.06+1.36*i,2.76,-3.40,.87)
    section('08 / brass threshold and woven runner')
    box(0,.06,4.39,2.16,.019,.56,'spruce',.013)
    for j in range(9):box(0,.075,4.149+j*.056,2.04,.009,.019,'fern',0)
    for x in (-1.0,1.0):box(x,.08,4.39,.021,.009,.49,'brass',0)
    finish('cafe')


def finish(name):
    for title,(col,group) in sects.items():
        for m,(v,f) in group.items():
            mesh=bpy.data.meshes.new(title+' / '+m);mesh.from_pydata(v,[],f);mesh.materials.append(materials[m])
            obj=bpy.data.objects.new(mesh.name,mesh);col.objects.link(obj)
    scene=bpy.context.scene
    scene['Model']='Forest House · Sumiyoshi / '+name
    scene['Units']='metres. +X east. Front is Blender -Y, game +Z.'
    scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.resolution_x=900;scene.render.resolution_y=720;scene.render.resolution_percentage=100
    world=bpy.data.worlds.new('Garden light');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.26,.28,.25,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.50
    studio=bpy.data.collections.new('Preview camera and studio lights');scene.collection.children.link(studio)
    is_front=name=='cafe-front'
    focus=Vector(swizzle((0,3.0,-.7) if is_front else (0,.97,-.25)))
    ce=bpy.data.cameras.new('Study');cam=bpy.data.objects.new('Study',ce);studio.objects.link(cam)
    cam.location=swizzle((4.3,5.5,14.3) if is_front else (5.8,9.4,12.3));cam.rotation_euler=(focus-cam.location).to_track_quat('-Z','Y').to_euler()
    ce.type='ORTHO';ce.ortho_scale=12.90 if is_front else 17.6;scene.camera=cam
    for coord,energy,color,size in [((0,9,8),1750,(1,.85,.66),7),((-8,6,2),970,(.75,.86,1),5),((5,6,-2),740,(.96,1,.85),4)]:
        light=bpy.data.lights.new('Broad daylight','AREA');light.energy=energy;light.color=color;light.shape='DISK';light.size=size
        ob=bpy.data.objects.new(light.name,light);studio.objects.link(ob);ob.location=swizzle(coord)
        ob.rotation_euler=(focus-ob.location).to_track_quat('-Z','Y').to_euler()
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                view=area.spaces.active;view.region_3d.view_distance=ce.ortho_scale*1.15;view.region_3d.view_location=focus
                view.region_3d.view_rotation=cam.rotation_euler.to_quaternion();view.shading.color_type='MATERIAL'
    if font and font.filepath:font.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/(name+'.blend')),compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    text=[o for o in scene.objects if o.type=='FONT']
    if text:
        for o in text:o.select_set(True)
        bpy.context.view_layer.objects.active=text[0];bpy.ops.object.convert(target='MESH')
    bpy.ops.object.select_all(action='DESELECT')
    bymat=defaultdict(list)
    for o in scene.objects:
        if o.type=='MESH' and o.material_slots:bymat[o.material_slots[0].material.name].append(o)
    exports=[]
    for material,objects in bymat.items():
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        obj=bpy.context.view_layer.objects.active;obj.name='ForestHouse_'+material;exports.append(obj);obj.select_set(False)
    for o in exports:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,
                              export_apply=True,export_animations=False,export_cameras=False,export_lights=False)


if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    if not args or 'cafe-front' in args:front()
    if not args or 'cafe' in args:cafe()
