"""Rebuild the Sumiyoshi sitting room and rain court. Units are metres.
Run: blender --background --python art/sumiyoshi/house/build.py
Design coordinates are right, up, rear (Three.js). Botanical mesh groups and
their packed materials are editable in the resulting Blender file.
"""
import bpy
import math
import random
import struct
import zlib
import subprocess
from pathlib import Path
import numpy as np
from mathutils import Vector as V

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
MODELS=ROOT/'public'/'sumiyoshi'/'models'
QA=ROOT/'.next'/'sumiyoshi-house-check'
for p in (MODELS,QA):p.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
random.seed(2402)
R=random.Random(4311)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
groups={}
stock={}
group="Architecture / room shell"
def vc(p):return (p[0],-p[2],p[1])
def linear(x):
    x=x/255
    return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
def rgb(hexcode):
    return tuple(int(hexcode[i:i+2],16) for i in (0,2,4))
def color(h,m=1):
    c=rgb(h) if isinstance(h,str) else h
    return tuple(linear(max(0,min(255,a*m))) for a in c)+(1,)
def raw_png(file,arr):
    y,x=arr.shape[:2]
    def block(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    body=b''.join(b'\0'+line.tobytes() for line in arr)
    file.write_bytes(b'\x89PNG\r\n\x1a\n'+block(b'IHDR',struct.pack('>2I5B',x,y,8,2,0,0,0))+block(b'IDAT',zlib.compress(body,7))+block(b'IEND',b''))
def noise(gridx,gridy,w=512):
    t=np.random.default_rng(gridx*121+gridy).uniform(-1,1,(gridy,gridx))
    x=np.arange(w)*gridx/w;y=np.arange(w)*gridy/w
    xi=x.astype(int);yi=y.astype(int)
    xf=x-xi;yf=y-yi
    xf=xf*xf*(3-2*xf);yf=yf*yf*(3-2*yf)
    a=t[np.ix_(yi%gridy,xi%gridx)]*(1-xf)+t[np.ix_(yi%gridy,(xi+1)%gridx)]*xf
    b=t[np.ix_((yi+1)%gridy,xi%gridx)]*(1-xf)+t[np.ix_((yi+1)%gridy,(xi+1)%gridx)]*xf
    return a*(1-yf[:,None])+b*yf[:,None]
def texture(name,base,pattern):
    y,x=np.indices((512,512))
    if pattern=='grain':
        phase=2*math.pi*(14*y/512+1.28*noise(3,4)+.34*noise(5,17))
        a=5*noise(2,31)+6*noise(5,100)+4*np.cos(phase)+3*np.cos(phase*2.0)+3*noise(83,161)
    elif pattern=='stone':
        a=3*noise(3,3)+3*noise(9,10)+3*noise(50,60)+2*noise(203,201)
        a+=np.maximum(0,1-np.abs(noise(7,7)*15))*4
    else:
        a=2.5*np.cos(2*math.pi*x/4)+2.5*np.cos(2*math.pi*y/5)+2*noise(201,131)+2*noise(12,14)
    c=np.array(rgb(base))[None,None,:]
    arr=np.clip(c+a[:,:,None]*np.array([1,.95,.86]),0,255).astype('uint8')
    fp=QA/(name+'.png')
    raw_png(fp,arr)
    img=bpy.data.images.load(str(fp))
    img.name=name
    img.pack()
    return img
def material(name,rough,metal=0,image=None,coloured=True,emission=0):
    m=bpy.data.materials.new(name)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=rough
    bs.inputs['Metallic'].default_value=metal
    if image:
        n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=image
        m.node_tree.links.new(n.outputs['Color'],bs.inputs['Base Color'])
        m.diffuse_color=(.2,.18,.15,1)
    else:
        n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Pigment'
        m.node_tree.links.new(n.outputs['Color'],bs.inputs['Base Color'])
        if emission:
            m.node_tree.links.new(n.outputs['Color'],bs.inputs['Emission Color'])
            bs.inputs['Emission Strength'].default_value=emission
    return m
wood=material('Smoked cedar • long grain',.72,image=texture('smoked-cedar','382E25','grain'))
walnut=material('Oiled chestnut • long grain',.46,image=texture('oiled-chestnut','8D6848','grain'))
basalt=material('Wet honed basalt',.40,.04,image=texture('honed-basalt','514F49','stone'))
wash=material('Sumi plaster with mineral fleck',.89,image=texture('sumi-plaster','393B37','stone'))
linen=material('Linen • fine basket weave',.95,image=texture('basket-weave','82796B','linen'))
mineral=material('Pigmented stone and moss',.88)
botany=material('Foliage • two-sided folded blades',.73)
bark=material('Weathered branch bark',.89)
metal=material('Powder-coated iron and hardware',.46,.25)
water=material('Quiet blue-green water',.19,.26)
glow=material('Ochre light and water glints',.6,emission=.53)
gravel=material('Granite gravel',.85)
textured={wood,walnut,basalt,wash,linen}
atlas_file=QA/'botanical-studies.png'
subprocess.run(['node',str(OUT/'botanical-studies.cjs'),str(atlas_file)],cwd=ROOT,check=True)
atlas_img=bpy.data.images.load(str(atlas_file));atlas_img.pack()
canopy=material('Painted botanical sprays • alpha cutout',.88,image=atlas_img)
tex=next(n for n in canopy.node_tree.nodes if n.type=='TEX_IMAGE')
bs=canopy.node_tree.nodes.get('Principled BSDF')
canopy.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha'])
bs.inputs['Specular IOR Level'].default_value=.12
canopy.surface_render_method='DITHERED'
textured.add(canopy)

class Batch:
    def __init__(self):
        self.p=[];self.faces=[];self.colors=[];self.uv=[];self.sm=[]
def part(mat):
    return stock.setdefault((group,mat),Batch())
def shape(mat,points,faces,col='ffffff',shades=None,smooth=False,uv=None):
    a=part(mat);k=len(a.p)
    coords=[tuple(v) for v in points]
    a.p.extend(coords)
    for j,f in enumerate(faces):
        pp=[coords[i] for i in f]
        if mat in textured:
            uvs=[]
            if uv:
                uvs=[uv[i] for i in f]
            else:
                n=(V(pp[1])-V(pp[0])).cross(V(pp[2])-V(pp[0]))
                for x,y,z in pp:
                    if abs(n.y)>=max(abs(n.x),abs(n.z)):u,v=(x,z)
                    elif abs(n.z)>=abs(n.x):u,v=(x,y)
                    else:u,v=(z,y)
                    if mat==basalt:u,v=u*.85,v*.85
                    if mat==wood or mat==walnut:u,v=u*.37,v*1.95
                    if mat==linen:u,v=u*1.7,v*1.7
                    uvs.append((u,v))
            a.uv.extend(uvs)
        else:
            if shades:a.colors.extend(shades[i] for i in f)
            else:a.colors.extend([color(col)]*len(f))
        a.faces.append(tuple(i+k for i in f));a.sm.append(smooth)
def box(name,ctr,size,m,c='ffffff'):
    x,y,z=ctr;w,h,d=(a/2 for a in size)
    p=[(x+a*w,y+b*h,z+e*d) for a,b,e in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    shape(m,p,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],c)
def line(points,radii,m,c,n=7):
    pts=[V(p) for p in points];out=[];cols=[]
    if isinstance(radii,(int,float)):radii=[radii]*len(pts)
    ref=V((0,1,0))
    if abs((pts[-1]-pts[0]).normalized().dot(ref))>.88:ref=V((0,0,1))
    for i,p in enumerate(pts):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        a=tangent.cross(ref).normalized();b=tangent.cross(a).normalized()
        for j in range(n):
            t=math.tau*j/n
            out.append(p+radii[i]*(a*math.cos(t)+b*math.sin(t)))
            cols.append(color(c,.87+.14*math.sin(t*.97+.27)**2))
    faces=[tuple(range(n))[::-1],tuple(range(len(out)-n,len(out)))]
    for i in range(len(pts)-1):
        for j in range(n):
            v=i*n+j;w=i*n+(j+1)%n;faces.append((v,w,w+n,v+n))
    shape(m,out,faces,c,cols,smooth=n>=7)
def stone(ctr,r,m= mineral,tone='48514B',moss=False,n=13):
    x,y,z=ctr;rx,ry,rz=r;ang=R.random()*6;pts=[];cs=[];fs=[]
    jitter=[R.uniform(.81,1.12) for j in range(n)]
    for i,(hh,rr) in enumerate([(-.52,.71),(-.29,1),(.1,.99),(.59,.78),(.91,.42)]):
        for j in range(n):
            a=math.tau*j/n+ang+.08*math.sin(j*5+i*1.3)
            v=1+.075*math.sin(a*4+i*.38)
            pts.append((x+rx*math.cos(a)*rr*jitter[j]*v,y+ry*(hh+.072*math.sin(j*3+i*.8)),z+rz*math.sin(a)*rr*jitter[j]*v))
            cl=tone
            if moss and i>=3 and math.sin(a*3.5+i)>.13:cl='596247' if i==3 else '68734A'
            cs.append(color(cl,.90+.19*R.random()+i*.02))
    for i in range(4):
        for j in range(n):
            a=i*n+j;b=i*n+(j+1)%n;fs.extend([(a,b,a+n),(b,b+n,a+n)])
    fs+=[tuple(range(4*n,5*n))[::-1],tuple(range(n))]
    shape(m,pts,fs,tone,cs,smooth=True)
def pad(c,d,m,exp=.33):
    x,y,z=c;rx,ry,rz=[i/2 for i in d];pts=[];fs=[];rings=12;n=36
    def pow0(v):return math.copysign(abs(v)**exp,v)
    for i in range(rings+1):
        lo=math.pi*(i/rings-.5)
        for j in range(n):
            a=math.tau*j/n
            xx=rx*pow0(math.cos(lo))*pow0(math.cos(a))
            zz=rz*pow0(math.cos(lo))*pow0(math.sin(a))
            yy=ry*pow0(math.sin(lo))
            # Six gentle fabric gathers at the seams.
            de=.0018*math.cos(10*a+2.3)*math.sin(lo*2)
            pts.append((x+xx*(1+de),y+yy,z+zz*(1+de)))
    for i in range(rings):
        for j in range(n):
            a=i*n+j;b=i*n+(j+1)%n
            fs.append((a,a+n,b+n,b))
    shape(m,pts,fs,smooth=True)
def piping(c,whd,mat,shade):
    x,y,z=c;w,d=whd
    dots=[]
    for j in range(49):
        t=math.tau*j/48
        def s(v):return math.copysign(abs(v)**.29,v)
        dots.append((x+w/2*s(math.cos(t)),y,z+d/2*s(math.sin(t))))
    line(dots,.007,mat,shade,5)
# Thick return walls and a thin, uninterrupted horizontal court opening.
box('floor substrate',(0,-.125,0),(10.47,.24,8.52),mineral,'272A28')
for ix in range(8):
    for iz in range(7):
        xa=-5.2+ix*1.30;za=-4.20+iz*1.2
        box('honed dining room flags',(xa+.65,-.025,za+.6),(1.294,.049,1.194),basalt)
for side in (-1,1):
    group="Cutaway / room returns"
    x=side*5.13
    box('charcoal return wall',(x,1.84,-.02),(.21,3.70,8.47),wash)
    box('skirting shadow reveal',(side*5.018,.066,-.08),(.04,.124,8.3),metal,'252824')
    group="Architecture / room shell"
    box('black stain lintel jamb',(side*4.83,1.78,-3.87),(.48,3.55,.50),wood)
    box('window edge',(side*4.574,1.78,-3.78),(.043,3.4,.17),metal,'30342D')
group="Cutaway / ceiling and upper window reveals"
box('wood header',(0,3.49,-3.67),(10.27,.46,.96),wood)
box('charcoal transom over the garden',(0,4.90,-3.89),(10.27,2.83,.25),mineral,'252A26')
box('soffit over window threshold',(0,3.55,-3.21),(10.26,.15,1.26),wood)
box('deep shadow ceiling across seated camera',(0,3.65,.11),(10.49,.12,8.66),mineral,'282923')
box('steel upper reveal',(0,3.265,-3.60),(9.20,.045,.23),metal,'252B28')
group="Architecture / room shell"
box('rear concrete foundation',(0,.146,-3.92),(9.45,.29,.13),wash)
box('narrow upper sill',(0,.241,-3.856),(9.34,.085,.14),basalt)
group="Architecture / genkan to Sumiyoshi"
box('recessed genkan shoe stone',(3.9,.023,3.76),(1.56,.045,.80),mineral,'5D6058')
for j in range(9):
    box('fine nonslip grooves',(3.9,.047,3.49+j*.044),(1.27,.005,.009),metal,'4A5048')
box('bronze sill',(3.9,.055,4.12),(1.62,.024,.045),metal,'9D855D')
box('low side jamb',(3.075,.28,4.088),(.105,.56,.157),wood)
box('entry return beside doorway',(4.906,1.23,4.116),(.51,2.46,.156),wood)
for j in range(6):
    box('genkan striated side screen',(4.695+j*.076,1.22,4.017),(.034,2.37,.06),wood)
box('night lantern case',(4.83,1.22,3.956),(.175,.329,.069),metal,'333932')
box('night lantern paper',(4.83,1.22,3.914),(.127,.280,.014),glow,'F2CE92')
box('lantern crossbar',(4.83,1.22,3.899),(.141,.010,.014),metal,'42443C')
# Black reflecting trough beneath the window, with irregular contour glints.
group="Architecture / reflecting sill and bench"
box('low black water trough',(0,.039,-3.368),(9.61,.077,1.03),metal,'242B28')
box('still water',(0,.094,-3.40),(9.38,.026,.89),water,'344440')
for x in (-4.77,4.77):
    box('basin cheeks',(x,.124,-3.366),(.074,.19,1.05),basalt)
box('cut drainage lip',(0,.132,-2.865),(9.61,.20,.077),basalt)
box('warm reveal',(0,.085,-2.818),(8.72,.013,.009),glow,'B5824F')
for x in (-4.05,-1.5):
    box('concealed bench support',(x,.246,-3.44),(.12,.27,.325),metal,'393933')
box('floating solid bench',(-2.67,.43,-3.41),(3.33,.145,.48),walnut)
box('bench drip shadow',(-2.67,.351,-3.43),(3.24,.013,.430),wood)
stone((3.02,.19,-3.44),(1.11,.41,.38),tone='3E443D',moss=True)
stone((2.02,.165,-3.46),(.38,.145,.26),tone='4A4F46',moss=True)
for j in range(14):
    x=R.uniform(-4.2,4.3);z=R.uniform(-3.76,-3.06);rad=R.uniform(.04,.15)
    arc=[(x+rad*math.cos(i*.32),.111,z+.44*rad*math.sin(i*.32)) for i in range(12)]
    line(arc,.0017,water,'67736A',3)
# Seating, including plinth, three individual cushions and a tailored piping seam.
group="Furnishings / linen settee"
box('sofa frame',(0,.239,1.22),(3.04,.235,1.04),wood)
for x in (-1.33,1.33):
    for z in (.81,1.6):box('feet',(x,.093,z),(.112,.16,.112),wood)
for x in (-.96,0,.96):
    pad((x,.406,1.12),(.949,.173,.91),linen)
    piping((x,.438,1.12),(.937,.897),mineral,'958674')
    pad((x,.672,1.606),(.968,.467,.236),linen,.38)
for x in (-1.52,1.52):
    pad((x,.486,1.208),(.178,.424,1.08),linen)
box('sofa rear apron',(0,.448,1.684),(2.918,.357,.116),wood)
# Thin free-standing monitor in the garden foreground.
group="Furnishings / freestanding television"
for x in (-.91,.91):
    box('folded steel foot',(x,.022,-2.484),(.41,.039,.33),metal,'353A35')
    box('upright',(x,.657,-2.486),(.033,1.23,.046),metal,'343B36')
box('display carcass',(0,1.59,-2.447),(3.378,1.925,.078),metal,'222822')
box('display active face',(0,1.59,-2.404),(3.32,1.8675,.007),metal,'19201E')
box('screen status diode',(1.62,.643,-2.405),(.014,.004,.004),glow,'96C8AF')
line([(0,.78,-2.50),(.02,.439,-2.52),(.12,.032,-2.56),(.50,.022,-2.59)],.005,metal,'292D29')

# The water garden is built as an actual section. The channel widens behind
# the sill and disappears around a low planted island instead of ending in a box.
group="Court / gravel bed, pond and stepping stones"
box('garden soil',(0,-.12,-7.46),(11.30,.33,7.57),mineral,'343A2A')
box('wet garden boundary',(0,2.08,-10.97),(12,.38+4.1,.19),wood)
for si in (-1,1):
    box('retaining garden fence',(si*5.68,2.69,-7.57),(.22,5.54,7.19),mineral,'344735')
for j in range(72):
    xx=-6.02+j*.168
    box('vertical screen slat',(xx,2.41,-10.846),(.133,4.85,.055),wood)
def bank(x,z):
    return .17+.34*(.5+.5*math.cos(x*.86+z*.49))+.15*math.sin(z*1.8+x*.38)
def pondx(z):return -.88+1.42*math.sin((z+5.46)*.73)
def pondr(z):return .50+.72*math.exp(-((z+5.8)/1.4)**2)+.14*math.cos(z*1.8)
def turf(x,z):
    proximity=abs(x-pondx(z))-pondr(z)
    f=max(0,min(1,(proximity+.42)/.86))
    return .035+f*bank(x,z)
pts=[];cs=[];fs=[];nx=40;nz=29
for iz in range(nz):
    for ix in range(nx):
        x=-5.63+ix*11.31/(nx-1)
        z=-10.84+iz*6.89/(nz-1)
        if ix not in (0,nx-1):x+=R.uniform(-.057,.057)
        if iz not in (0,nz-1):z+=R.uniform(-.061,.061)
        y=turf(x,z)+R.uniform(-.012,.009)
        pts.append((x,y,z))
        sh=.5+.26*math.sin(x*1.8+z*.8)+.23*math.sin(z*1.23-x*.64)
        cs.append(color(('475133','535C38','626A42','77804A')[int(sh*3.41)],R.uniform(.90,1.1)))
for iz in range(nz-1):
    for ix in range(nx-1):
        a=iz*nx+ix;fs.extend([(a,a+nx,a+1),(a+1,a+nx,a+nx+1)])
shape(mineral,pts,fs,shades=cs,smooth=True)
p=[];cs=[];fs=[]
for i in range(52):
    z=-10.60+i*6.63/51
    for a in (-1,0,1):
        p.append((pondx(z)+pondr(z)*a,.11,z))
        cs.append(color('3D514B' if a==0 else '394A3B',1+.10*math.sin(z*2.3)))
for i in range(51):
    for j in range(2):
        a=3*i+j;fs.append((a,a+3,a+4,a+1))
shape(water,p,fs,shades=cs)
for i in range(74):
    z=R.uniform(-10.4,-4.12);s=R.choice((-1,1));r=R.uniform(.09,.31)
    x=pondx(z)+s*(pondr(z)+R.uniform(-.14,.35))
    stone((x,turf(x,z)+.018,z),(r,R.uniform(.04,.17),r*R.uniform(.58,1.2)),tone=R.choice(['53604E','444C41','62695B','5A5D50']),moss=i%4==0,n=8)
for x,z,w,h,d in [(-3.7,-5.23,1.12,.63,.68),(-4.09,-5.83,.69,.47,.56),(2.24,-6.08,.81,.48,.67),(3.0,-6.65,.51,.42,.42),(.39,-8.14,1.03,.62,.67),(-2.42,-7.75,.62,.44,.47)]:
    stone((x,turf(x,z),z),(w,h,d),tone='555A50',moss=True)
for i in range(10):
    z=-4.42-i*.55;x=.58+2.0*math.sin(.95*i+.12)*.23+1.68*i/9
    stone((x,turf(x,z)+.025,z),(.313,.108,.249),tone='7D8072',n=9)
for i in range(148):
    z=R.uniform(-10.25,-4.11)
    rad=R.uniform(.027,.116)
    x=pondx(z)+R.uniform(-.75,.75)*pondr(z)
    a=R.uniform(0,2.1);length=R.uniform(1.4,4.1)
    arc=[(x+rad*math.cos(a+j*length/7),.115,z+rad*.62*math.sin(a+j*length/7)) for j in range(8)]
    line(arc,.002+rad*.007,water,R.choice(['6E7C6C','53665A','839184']),3)
# Weathered garden boundary and espalier shadows form the deepest backdrop.
group="Court / rear cedar garden boundary"
for j in range(7):
    x=-5.1+j*1.73
    line([(x,.14,-10.61),(x+.06,2.20,-10.65),(x-.01,4.12,-10.73)],[.065,.064,.049],bark,'535741',8)
for j in range(3):line([(-5.52,.74+j*.51,-10.63),(0,.77+j*.51,-10.65),(5.51,.74+j*.51,-10.66)],.028,bark,'555942',8)
# Botanical silhouettes use folded individual blades, fern pinnae and
# tiered pine sprays; there are no ellipsoids used as foliage.
def blade(a,b,width,k,tone,fac=.8):
    a=V(a);b=V(b);d=(b-a)
    tip=d.normalized();cross=tip.cross(V((0,1,0)))
    if cross.length<.02:cross=V((1,0,0))
    cross.normalize();up=V((0,1,0));mid=a+d*.44+up*width*.21
    pts=[a,mid-cross*width,mid+up*width*.30,mid+cross*width,b]
    cs=[color(tone,fac*.82),color(tone,fac),color(tone,fac*1.11),color(tone,fac*.91),color(tone,fac*1.12)]
    shape(k,pts,[(0,1,2),(0,2,3),(1,4,2),(2,4,3)],shades=cs,smooth=True)
def holly(p,ang,L,tone,v):
    p=V(p)
    tip=p+V((math.cos(ang)*L,R.uniform(-.33,.48)*L,math.sin(ang)*L))
    blade(p,tip,L*R.uniform(.18,.29),botany,tone,v)
def momiji(p,a,length,c,tint):
    # Distinct multi-tipped lobes made as a single folded, continuous palmate leaf.
    P=V(p);u=V((math.cos(a),R.uniform(-.49,.22),math.sin(a))).normalized()
    v=V((-math.sin(a),R.uniform(-.22,.22),math.cos(a))).normalized()
    coords=[P,P+u*.32*length+V((0,length*.12,0))]
    for ang,frac in [(-1.48,.49),(-.99,.24),(-.82,.83),(-.44,.34),(0,1.0),(.42,.34),(.81,.81),(1,.24),(1.43,.53)]:
        coords.append(P+(u*math.cos(ang)+v*math.sin(ang))*length*frac)
    faces=[(0,2,1),(0,1,10)]+[(1,i,i+1) for i in range(2,10)]
    shade=[color(c,tint*.78),color(c,tint*1.10)]+[color(c,tint*(1.02 if i%2==0 else .87)) for i in range(9)]
    shape(botany,coords,faces,shades=shade,smooth=True)
lpalette=['445F34','53723D','648549','6C8A4D','74964E','8DA858','A0B766']
mpalette=['3D5A32','4C6736','5E7D3E','738F49','8DA753','A1B85E','AEBC68']
ppalette=['294B3C','365744','426A50','51785A','668659']
def twig(points,radii,col):
    line(points,radii,bark,col,5)
def spray(p,width,height,rotation,kind,pitch=0):
    # Textured blades are used below perceptual leaf scale. The geometry above
    # supplies a real branch silhouette and parallax in the foreground.
    p=V(p);side=V((math.cos(rotation),0,math.sin(rotation)))
    facing=V((-side.z,0,side.x))
    up=V((0,1,0))*height*math.cos(pitch)+facing*height*math.sin(pitch)
    base=p-up*.18
    points=[base-side*width*.55,base+side*width*.55,base+up+side*width*.49,base+up-side*width*.49]
    left=.50*(kind%2);bottom=.5-.5*(kind//2)
    uv=[(left+.002,bottom+.002),(left+.498,bottom+.002),(left+.498,bottom+.498),(left+.002,bottom+.498)]
    shape(canopy,points,[(0,1,2,3)],uv=uv)
def deciduous(x,z,height,spread,kind,rot,level=1):
    y=turf(x,z)-.07;O=V((x,y,z));tr=V((math.cos(rot),0,math.sin(rot)))
    bend=tr*.25*spread
    q=[O,O+bend*.55+V((0,.22*height,0)),O+bend+V((0,.41*height,0)),O+.45*bend+V((0,.66*height,0)),O-.30*bend+V((0,.90*height,0))]
    trunkcol='727064' if kind=='maple' else '676859'
    twig(q,[height*.031,height*.026,height*.021,height*.013,.018],trunkcol)
    for rr in range(4):
        an=rot+rr*1.76
        root=O+V((math.cos(an)*.50,.01,math.sin(an)*.50))
        twig([q[0]+V((0,.16,0)),(q[0]+root)/2+V((0,.08,0)),root],[.047,.039,.012],trunkcol)
    for i in range(11):
        a=rot+i*2.39+R.uniform(-.23,.23)
        dir=V((math.cos(a),0,math.sin(a)));per=V((-math.sin(a),0,math.cos(a)))
        h=(.28+.52*i/10)*height
        base=O+bend*(1-min(1,abs(h/height-.44)*1.6))+V((0,h,0))
        dist=spread*(1.05-.24*i/10)*R.uniform(.68,1.11)
        elbow=base+dir*dist*.48+per*R.uniform(-.17,.17)+V((0,height*.12,0))
        end=base+dir*dist+V((0,height*(.18+.065*R.random()),0))
        twig([base,elbow,end],[.019*height,.012*height,.014],trunkcol)
        for j in range(5):
            u=(j+.79)/5.2
            center=elbow.lerp(end,u)
            lateral=(-1 if j%2 else 1)*R.uniform(.19,.62)*spread
            far=center+per*lateral+dir*R.uniform(.03,.24)*spread+V((0,R.uniform(.02,.2)*height,0))
            twig([center,center.lerp(far,.54)+V((0,.04,0)),far],[.023,.015,.0065],trunkcol)
            for spr in range(4):
                spray(center.lerp(far,(spr+1)/4),R.uniform(.76,1.30),R.uniform(.61,1.17),
                      a+R.uniform(-1.18,1.18),0 if kind=='maple' else 1,R.uniform(.37,1.30))
            for n in range(4 if level else 3):
                origin=center.lerp(far,(n+1)/4.1)
                subdir=dir*R.uniform(-.37,.4)+per*R.uniform(-.3,.3)
                stop=origin+subdir*spread+V((0,R.uniform(-.16,.18),0))
                twig([origin,stop],[.009,.0028],trunkcol)
                for k in range(6):
                    t=(k+.45)/6
                    p=origin.lerp(stop,t)
                    # Opposite light-facing tips on exposed upper and front branches.
                    top=(p.y-y)/height
                    idx=min(6,max(0,round(2.1+1.5*top+R.uniform(-1.65,1.25)+(1 if p.z>z else -.6))))
                    ca=a+(math.pi if k%2==0 else 0)+R.uniform(-.72,.72)
                    if kind=='maple':momiji(p,ca,R.uniform(.087,.158)*(.77+.10*height),mpalette[idx],R.uniform(.82,1.10))
                    else:holly(p,ca,R.uniform(.115,.205)*(.8+.07*height),lpalette[idx],R.uniform(.78,1.10))
def pine(x,z,height,spread,rot):
    y=turf(x,z)-.12;O=V((x,y,z));d=V((math.cos(rot),0,math.sin(rot)));v=V((-d.z,0,d.x))
    q=[O,O+d*.35+V((0,height*.22,0)),O+d*.65+v*.3+V((0,height*.42,0)),O+d*.10+V((0,height*.70,0)),O+d*.29-v*.21+V((0,height*.91,0))]
    line(q,[.24,.19,.16,.111,.024],bark,'655E4E',10)
    for i in range(10):
        p=q[0].lerp(q[1],i/17)
        a=rot+i*2.399
        line([p+V((.15*math.cos(a),0,.15*math.sin(a))),p+V((.57*math.cos(a),.01,.57*math.sin(a)))],[.055,.008],bark,'686655',6)
    for i in range(12):
        a=rot+i*2.399+R.uniform(-.33,.33);D=V((math.cos(a),0,math.sin(a)));P=V((-D.z,0,D.x))
        tier=.31+.58*i/11;idx=min(3,int(tier*4));base=q[idx].lerp(q[idx+1],(tier*4)%1)
        ext=spread*(1.36-.70*tier)*R.uniform(.74,1.25)
        p1=base+D*ext*.37+V((0,.29,0));p2=p1+D*ext*.65+P*.15+V((0,-.08,0))
        line([base,p1,p2],[.128*(1.28-tier),.079*(1.25-tier),.018],bark,'655F4F',8)
        for j in range(6):
            at=p1.lerp(p2,(j+.55)/6)
            tip=at+P*((1 if j%2 else -1)*R.uniform(.25,.72))+D*R.uniform(.06,.37)+V((0,R.uniform(.06,.26),0))
            twig([at,tip],[.032,.009],'6D6956')
            for spr in range(6):
                spray(at.lerp(tip,(spr+1)/6),R.uniform(.90,1.36),R.uniform(.68,.95),
                      R.uniform(-2.1,2.1),2,R.uniform(.55,1.37))
            for f in range(6):
                a2=R.random()*math.tau;rr=.14+.32*math.sqrt(R.random())
                crown=tip+V((math.cos(a2)*rr,.12*(1-rr)+R.uniform(-.05,.13),math.sin(a2)*rr*.72))
                twig([tip,crown],[.013,.0035],'6A6B4E')
                for k in range(6):
                    aa=a2+k*math.tau/8+R.uniform(-.2,.2);ll=R.uniform(.115,.215)
                    stop=crown+V((math.cos(aa)*ll,R.uniform(.07,.19),math.sin(aa)*ll))
                    tone=ppalette[min(4,max(0,round(1.65+.63*math.sin(aa)+.88*tier+R.uniform(-1.33,1.3))))]
                    blade(crown,stop,.0095,botany,tone,1)

for i,cfg in enumerate([(-4.19,-6.88,4.64,2.63,.3),(3.91,-9.2,4.75,2.12,2.4)]):
    group='Court / cloud-pruned pine '+str(i+1)
    pine(*cfg)
for i,cfg in enumerate([(-2.88,-9.99,5.87,2.35,'laurel',1.72,0),(.13,-10.05,5.6,2.7,'laurel',.81,0),(3.93,-10.10,5.8,2.54,'laurel',2.5,0),(-5.08,-9.79,5.38,2.0,'maple',3.8,0),(-1.01,-7.72,4.43,2.38,'maple',2.68,1),(1.82,-8.15,4.82,2.35,'maple',.64,1),(4.36,-6.85,4.54,2.20,'laurel',1.74,1),(4.89,-5.19,2.26,1.10,'maple',2.10,0)]):
    group="Court / "+cfg[4]+' '+str(i+1)
    deciduous(*cfg)
group="Court / sheltered laurel and deep canopy"
for i in range(2300):
    xx=R.uniform(-5.65,5.65);zz=R.uniform(-10.70,-8.87)
    yy=R.uniform(.16,5.70)
    spray((xx,yy,zz),R.uniform(.63,1.17),R.uniform(.65,1.35),R.uniform(-1.85,1.85),R.choice((1,3,3)),R.uniform(-.65,.95))
for side in (-1,1):
    for i in range(460):
        zz=R.uniform(-9.09,-4.25);xx=side*R.uniform(4.45,5.56);yy=R.uniform(.28,4.63)
        spray((xx,yy,zz),R.uniform(.51,1.17),R.uniform(.63,1.22),R.uniform(-1.85,1.85),R.choice((0,1,3)),R.uniform(-.65,.95))
group="Court / broadleaf understory"
for i in range(88):
    x=R.uniform(-5.49,5.49);z=R.uniform(-10.61,-4.12)
    if abs(pondx(z)-x)<pondr(z)+.21:continue
    y=turf(x,z);sz=R.uniform(.23,.77)*(1.23 if z<-8 else 1)
    for j in range(R.randint(4,8)):
        a=j*2.399+R.uniform(-.45,.45);d=V((math.cos(a),0,math.sin(a)))
        root=V((x,y,z));tip=root+d*sz*.68+V((0,R.uniform(.39,.87)*sz,0))
        line([root,root.lerp(tip,.54)+V((0,.06,0)),tip],[.012,.009,.003],bark,'727653',5)
        spray(root.lerp(tip,.56),sz*1.2,sz*1.12,a,1,R.uniform(.31,.97))
        for n in range(7):
            at=root.lerp(tip,.32+.63*n/7)
            holly(at,a+(1.38 if n%2 else -1.38),sz*R.uniform(.14,.40),lpalette[R.choice([0,1,2,2,3,4,5])],R.uniform(.87,1.15))
group="Court / fine fern and irises"
for i in range(65):
    z=R.uniform(-10.1,-4.03);x=pondx(z)+R.choice((-1,1))*(pondr(z)+R.uniform(.14,1.3))
    if abs(x)>5.48:continue
    y=turf(x,z)
    O=V((x,y,z));sz=R.uniform(.26,.56)
    for j in range(R.randint(4,7)):
        a=R.random()*math.tau;d=V((math.cos(a),0,math.sin(a)));v=V((-d.z,0,d.x));L=sz*R.uniform(.64,1.13)
        root=O+V((R.uniform(-.027,.027),0,R.uniform(-.027,.027)))
        def stem(t):return root+d*L*t+V((0,L*(1.62*t-1.06*t*t),0))
        line([stem(t) for t in (0,.25,.5,.75,1)],[.006,.005,.004,.003,.001],botany,'84965E',5)
        for k in range(1,8):
            t=(k+.25)/8.3;start=stem(t)
            wid=.24*L*(math.sin(math.pi*t)**.63)*(1.13-.29*t)
            for side in (-1,1):
                end=start+v*side*wid+L*d*(.05+t*.065)+V((0,.02*L,0))
                blade(start,end,L*.026,botany,R.choice(['586E3E','698149','809453','8E9C5D']),R.uniform(.9,1.08))
# Tiny pockets of groundcover leave the moss lawn visible between planting masses.
group="Court / moss shoots and stone lichen"
for j in range(1230):
    z=R.uniform(-10.75,-4.02);x=R.uniform(-5.48,5.48)
    if abs(pondx(z)-x)<pondr(z):continue
    y=turf(x,z)+.006
    for k in range(2):
        a=R.random()*math.tau;ll=R.uniform(.027,.11)
        blade((x,y,z),(x+math.cos(a)*ll*.51,y+ll,z+math.sin(a)*ll*.51),ll*.096,botany,R.choice(['5B6C3D','72854C','889959','A0A368']),1)
# Optical rain rings and a small dripping bamboo spout remain legible at couch view.
group="Court / kakehi and pond detail"
L=(2.73,turf(2.73,-5.25),-5.25)
line([L,(L[0]+.043,.91,L[2]-.04)],[.045,.043],bark,'877E50',10)
line([(2.75,.81,-5.27),(2.20,.680,-5.07)],[.045,.048],bark,'A49467',10)
line([(2.218,.686,-5.078),(2.20,.680,-5.07)],[.034,.034],bark,'4F5342',10)
for j in range(3):
    y=.57-.126*j
    line([(2.204,y,-5.074),(2.201,y-.022,-5.068)],[.004,.006],water,'9DAF9F',6)

def mesh_from(key,batch,collection,name):
    mat=key[1]
    objdata=bpy.data.meshes.new(name)
    objdata.from_pydata([vc(p) for p in batch.p],[],batch.faces)
    objdata.update()
    objdata.materials.append(mat)
    smooth=np.asarray(batch.sm,dtype=bool)
    objdata.polygons.foreach_set('use_smooth',smooth)
    if batch.colors:
        att=objdata.color_attributes.new(name='Pigment',type='BYTE_COLOR',domain='CORNER')
        att.data.foreach_set('color',np.asarray(batch.colors,dtype=np.float32).ravel())
        objdata.color_attributes.active_color=att
    if batch.uv:
        uv=objdata.uv_layers.new(name='Material grain')
        uv.data.foreach_set('uv',np.asarray(batch.uv,dtype=np.float32).ravel())
    ob=bpy.data.objects.new(name,objdata)
    collection.objects.link(ob)
    return ob
for (g,m),data in stock.items():
    if g not in groups:
        coll=bpy.data.collections.new(g);scene.collection.children.link(coll);groups[g]=coll
    mesh_from((g,m),data,groups[g],m.name)
# Preview lighting rigs and camera are stored in the editable source. The GLB
# has no active camera or permanent lights, allowing the game to animate rain.
rig=bpy.data.collections.new("Study / seated and garden views");scene.collection.children.link(rig)
def orient(ob,at,to):
    ob.location=vc(at)
    ob.rotation_euler=(V(vc(to))-ob.location).to_track_quat('-Z','Y').to_euler()
def area(name,at,to,power,col,w,h):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=col;d.shape='RECTANGLE';d.size=w;d.size_y=h
    ob=bpy.data.objects.new(name,d);rig.objects.link(ob);orient(ob,at,to)
def cam(name,at,to,lens):
    d=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,d);rig.objects.link(ob);orient(ob,at,to);d.lens=lens;d.clip_start=.03;return ob
camera=cam('01 • Seated, left of player',(-.65,1.35,3.15),(0,1.52,-3.13),20.0)
gardenCam=cam('02 • Sitting room and rain court',(6.1,4.87,7.35),(-.72,1.03,-3.17),31)
scene.camera=camera
area('Cool court skylight',(-1,6.4,-6.1),(0,.3,-6.9),1350,(.79,.88,1),8,4.5)
area('Cloud break on acer tips',(-3.4,5.86,-4.90),(1.3,.39,-8.23),820,(.97,1,.81),4.2,3.2)
area('Reflected court daylight',(-.4,3.4,-4.15),(.4,2.8,-8.64),550,(.81,.93,.83),7.6,3.5)
area('Pale moss light',(3.17,2.50,-4.12),(3.25,.33,-6.60),180,(.91,1,.76),2.0,2.5)
area('Light returned from garden',(.35,2.45,-3.54),(0,.41,1.3),210,(.73,.86,.82),6.2,1.2)
area('Lamplight on the floor',(-3.0,2.76,2.87),(-.41,.1,.11),135,(1,.70,.44),1.8,1.8)
area('Softbox behind seated camera',(1.23,3.36,3.70),(0,.50,.25),145,(.86,.84,.77),4.3,2.4)
world=bpy.data.worlds.new('Rain cloud');world.use_nodes=True;bg=world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value=(.153,.192,.160,1);bg.inputs['Strength'].default_value=.48;scene.world=world
scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True
scene.render.resolution_x=1080;scene.render.resolution_y=660;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
for a in bpy.context.screen.areas:
    if a.type=='VIEW_3D':
        a.spaces.active.region_3d.view_perspective='CAMERA';a.spaces.active.shading.color_type='MATERIAL'
        a.spaces.active.overlay.show_overlays=False
scene.render.filepath=str(QA/'seated-interior.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Garden room.blend'),compress=True)
# One mesh per shader for web draw calls. Combine batches directly to preserve
# sharp split normals, UVs and the thousands of per-leaf tip colours.
by_material={}
for (g,m),data in stock.items():
    cut=g.startswith('Cutaway')
    out=by_material.setdefault((m,cut),Batch());offset=len(out.p)
    out.p.extend(data.p);out.faces.extend([tuple(i+offset for i in f) for f in data.faces])
    out.colors.extend(data.colors);out.sm.extend(data.sm);out.uv.extend(data.uv)
bpy.ops.object.select_all(action='DESELECT')
web=bpy.data.collections.new("Runtime batches");scene.collection.children.link(web)
objects=[]
for (m,cut),data in by_material.items():
    name=('Cutaway ' if cut else '')+m.name
    obj=mesh_from(('',m),data,web,name);obj.select_set(True);objects.append(obj)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(MODELS/'house.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True,export_vertex_color='MATERIAL',export_all_vertex_colors=False)
import sys
sys.dont_write_bytecode=True
sys.path.insert(0,str(OUT))
from pack_web import optimize
optimize(MODELS/'house.glb')
for obj in objects:
    geo=obj.data;bpy.data.objects.remove(obj,do_unlink=True);bpy.data.meshes.remove(geo)
scene.camera=camera
bpy.ops.render.render(write_still=True)
print('Finished Garden room and seated camera validation.')
