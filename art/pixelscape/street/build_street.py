"""Build OOO's metred night street. Run with Blender -b -P build_street.py."""
import math
import json
import random
import struct
import sys
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
sys.dont_write_bytecode=True
sys.path.insert(0,str(HERE))
from paint import atlas, rgb

bpy.ops.wm.read_factory_settings(use_empty=True)
tiles,canvas=atlas(HERE/'street-atlas.png')
image=bpy.data.images.load(str(HERE/'street-atlas.png'));image.pack();image.filepath='//street-atlas.png'
rng=random.Random(1963)
geometry=defaultdict(lambda: [[],[],[],[]])
sector='00 Civic surfaces'

def linear(channel):
    c=channel/255
    return c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4

def material(name,graphic=False,emission=0,leaves=False,rough=.76):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    source=m.node_tree.nodes.new('ShaderNodeTexImage' if graphic else 'ShaderNodeVertexColor')
    if graphic:source.image=image;source.interpolation='Closest';source.extension='EXTEND'
    else:source.layer_name='Ink'
    m.node_tree.links.new(source.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=rough
    if emission:
        m.node_tree.links.new(source.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=emission
    if leaves:
        m.node_tree.links.new(source.outputs['Alpha'],bs.inputs['Alpha'])
        m.surface_render_method='DITHERED'
        # One-bit ink edges. The glTF exporter recognizes the legacy clip method.
        try:m.blend_method='CLIP'
        except (AttributeError,TypeError):pass
        m.alpha_threshold=.5
    m.use_backface_culling=not leaves
    return m

ink=material('00 | Building pigments and steel',True,emission=.16)
light=material('01 | Lamp phosphors and enamel signs',True,emission=1.05)
skin=material('02 | Pixel facade silkscreen',True,.15)
coolRoom=material('03 | Rooms without light',True,.34)
warmRoom=material('04 | Curtains with interior light',True,.9)
store=material('05 | Illuminated store shelves',True,1.03)
horizon=material('06 | Flats in aerial perspective',True,.53)
skyMat=material('07 | Twilight sky',True,.85)
leafMat=material('Botanical Street | Wet leaves and boughs',True,.34,True,rough=.61)
stone='405358';deep='182e34';shadow='21383d';iron='364747';tin='80908a';zinc='617777'
wood='68534a';soot='343d3f';cream='c8bf9b';amber='ffcf83';sodium='f4d69c';teal='39736c'

def face(points,color='ffffff',material=ink,uv=None):
    vertices, polygons, colors, coords=geometry[(sector,material)]
    offset=len(vertices)
    vertices.extend((x,-z,y) for x,y,z in points)
    polygons.append(tuple(range(offset,offset+len(points))))
    colors.extend([rgb(color)[:3]]*len(points))
    coords.extend(uv or [(0,0)]*len(points))

def box(x,y,z,w,h,d,color,mat=ink):
    a,b=x-w/2,x+w/2;c,e=y-h/2,y+h/2;f,g=z-d/2,z+d/2
    for q in [[(a,c,g),(b,c,g),(b,e,g),(a,e,g)],[(b,c,f),(a,c,f),(a,e,f),(b,e,f)],
              [(a,c,f),(a,c,g),(a,e,g),(a,e,f)],[(b,c,g),(b,c,f),(b,e,f),(b,e,g)],
              [(a,e,g),(b,e,g),(b,e,f),(a,e,f)],[(a,c,f),(b,c,f),(b,c,g),(a,c,g)]]:
        face(q,color,mat)

def clipped_uv(name,uv):
    x,y,w,h=tiles[name]
    return [((x+.5+u*(w-1))/canvas[0],1-(y+.5+(1-v)*(h-1))/canvas[1]) for u,v in uv]

def placard(name,x,y,z,w,h,mat,section=(0,0,1,1), angle=0):
    u,v,U,V=section
    co,si=math.cos(angle)*w/2,math.sin(angle)*w/2
    face([(x-co,y-h/2,z+si),(x+co,y-h/2,z-si),(x+co,y+h/2,z-si),(x-co,y+h/2,z+si)],
         material=mat,uv=clipped_uv(name,[(u,v),(U,v),(U,V),(u,V)]))

def rod(a,b,r,c,sides=6):
    a,b=Vector(a),Vector(b);axis=(b-a).normalized();normal=axis.cross(Vector((0,1,0)))
    if normal.length<.001:normal=axis.cross(Vector((1,0,0)))
    normal.normalize();n=axis.cross(normal)
    points=[(normal*math.cos(i*math.tau/sides)+n*math.sin(i*math.tau/sides))*r for i in range(sides)]
    for i,d in enumerate(points):
        j=points[(i+1)%sides];face([a+d,a+j,b+j,b+d],c)

def wire(a,b,sag,width,color,segments=12):
    a,b=Vector(a),Vector(b)
    def at(t):return a.lerp(b,t)-Vector((0,4*sag*t*(1-t),0))
    for i in range(segments):rod(at(i/segments),at((i+1)/segments),width,color,5)

def lettering(text,x,y,z,size,c):
    curve=bpy.data.curves.new(text,'FONT');curve.body=text;curve.size=size
    curve.align_x='CENTER';curve.align_y='CENTER';curve.resolution_u=3
    obj=bpy.data.objects.new(text,curve);bpy.context.collection.objects.link(obj)
    obj.location=(x,-z,y);obj.rotation_euler.x=math.pi/2
    dg=bpy.context.evaluated_depsgraph_get();ev=obj.evaluated_get(dg);mesh=ev.to_mesh()
    mesh.calc_loop_triangles()
    vertices=[ev.matrix_world@v.co for v in mesh.vertices]
    for tri in mesh.loop_triangles:
        face([(vertices[i].x,vertices[i].z,-vertices[i].y) for i in tri.vertices],c,light)
    ev.to_mesh_clear();bpy.data.objects.remove(obj,do_unlink=True);bpy.data.curves.remove(curve)

def sign_plate(txt,x,y,z,w,h,bg,txtcol,scale):
    box(x,y,z,w,h,.055,deep)
    box(x,y,z+.033,w-.047,h-.047,.018,bg)
    lettering(txt,x,y,z+.044,scale,txtcol)

def tea_lantern(x,y,z):
    box(x,y,z,.36,.86,.22,'755e48');box(x,y,z+.12,.30,.78,.032,'d2b888',light)
    # 茶, drawn with a few broad brush strokes at a physical letter height of 0.27m.
    strokes=[(-.10,.09,.10,.09),(-.06,.14,-.06,.055),(.061,.14,.061,.055),(0,.06,-.105,-.03),(0,.06,.105,-.03),
             (-.089,-.046,.089,-.046),(0,-.02,0,-.137),(-.04,-.073,-.09,-.12),(.04,-.073,.09,-.12)]
    for a,b,c,d in strokes:rod((x+a,y+b,z+.145),(x+c,y+d,z+.145),.012,'6e4c3b',5)
    for dy in (-.26,.26):box(x,y+dy,z+.145,.18,.018,.012,'92684e')
    box(x,y+.48,z-.065,.075,.18,.31,'74817a')

def wall(x,w,h,fr,openings,tile):
    """Cut through the face and map its partial UVs across the remaining walls."""
    l,r=x-w/2,x+w/2
    cuts=[(xx-ww/2,xx+ww/2,yy-hh/2,yy+hh/2) for xx,yy,ww,hh in openings]
    xs=sorted({l,r,*[a for u in cuts for a in u[:2]]});ys=sorted({0,h,*[a for u in cuts for a in u[2:]]})
    for a,b in zip(xs,xs[1:]):
        for e,f in zip(ys,ys[1:]):
            mx=(a+b)/2;my=(e+f)/2
            if not l<=mx<=r or not 0<=my<=h or any(aa<mx<bb and ee<my<ff for aa,bb,ee,ff in cuts):continue
            placard(tile,mx,my,fr,b-a,f-e,skin,((a-l)/w,e/h,(b-l)/w,f/h))

def opening(x,y,w,h,z,kind,variant,depth,divs=2):
    a,b=x-w/2,x+w/2;bot,top=y-h/2,y+h/2
    timber=kind in ('room','genkan') and variant%3
    frame='4d4d44' if timber else '47585a'
    for s in (a,b):
        box(s,y,z-depth/2,.085,h+.09,depth+.16,frame)
        box(s+.011,y,z+.096,.033,h+.10,.035,'899488' if not timber else '867863')
    for hh in (bot,top):
        box(x,hh,z-depth/2,w+.12,.08,depth+.15,frame)
    if kind=='shop':
        placard('shop'+str(variant%2),x,y,z-depth,w,h,store)
        for j in range(4):
            xx=x-w*.36+j*w*.23
            box(xx,y+.27,z-depth*.65,.18,.31,.16,['b4a682','8b746c','93a69b','a98b63'][j])
        box(x,top-.10,z-depth*.76,w*.88,.045,.09,'ffdfa5',light)
        box(x,bot+.16,z-depth*.45,w,.29,.20,'6c5640')
    elif kind=='genkan':
        box(x,y,z-depth,w,h,.05,'473e36')
        if variant in (0,2,5):
            placard('room'+str(variant%2*2+1),x,y+h*.13,z-depth+.035,w*.84,h*.63,warmRoom)
            for j in range(1,8):
                bx=a+w*j/8
                box(bx,y+h*.09,z-depth+.06,.028,h*.79,.025,'554e3f')
        else:
            box(x,y,z-depth+.046,w*.88,h*.88,.026,'475556' if variant%2 else '5a5146')
            placard('room3',x,y+h*.35,z-depth+.072,w*.71,h*.16,coolRoom)
            box(x-w*.31,y+.03,z-depth+.071,.055,h*.48,.035,'83938b')
        box(x,y-h*.34,z-depth+.06,w*.85,h*.22,.028,'5c4e3c')
        box(b-.16,y-.08,z-depth+.108,.033,.32,.05,'9a967e')
    else:
        placard('room'+str(variant%6),x,y,z-depth,w,h,warmRoom if variant%2 else coolRoom)
    for j in range(1,divs):
        box(a+w*j/divs,y,z+.055,.045,h,.062,frame)
    if kind=='room':
        box(x,y+h*.23,z+.064,w,.044,.052,frame)
        box(x,bot-.07,z+.048,w+.20,.09,.28,'6b7773')
    if kind=='shop':
        box(x,top-h*.22,z+.08,w,.055,.065,frame)
        box(x,bot+.055,z+.10,w+.18,.09,.25,'908c75')

def balcony(x,y,z,w):
    box(x,y-.07,z+.15,w+.25,.15,.62,'465454')
    box(x,y+.44,z+.44,w+.16,.057,.085,'748481')
    box(x,y+.11,z+.44,w+.15,.12,.07,'425350')
    for j in range(round(w/.19)+1):
        xx=x-w/2+w*j/round(w/.19);box(xx,y+.24,z+.42,.031,.42,.04,'52615e')

def ac(x,y,z):
    box(x,y,z,.77,.51,.29,'92978a')
    box(x-.11,y,z+.15,.39,.36,.025,'404f50')
    for j in range(6):box(x-.11,y-.138+j*.053,z+.175,.37-(abs(j-2.5)*.022),.019,.019,'7e8980')
    for j in range(4):box(x+.21,y-.096+j*.071,z+.163,.16,.028,.02,'6d7974')
    box(x,y-.285,z,.69,.06,.32,'3f5051')

def stoneware(x,z,diameter,height,glaze):
    # Unglazed foot, glazed rings and a rolled rim around an exposed soil disc.
    dark,body,rim = [('684c43','916654','a37d64'),('415a60','607677','87918b'),
                     ('535448','727762','999981')][glaze % 3]
    rings=[(.025,.31,dark),(.05,.35,dark),(.13,.36,body),(.76,.48,body),
           (.80,.48,dark),(.84,.51,rim),(.96,.51,body),(1,.48,rim),(.98,.43,dark)]
    sides=12
    def vertex(level,radius,j):
        a=math.tau*j/sides
        return (x+math.cos(a)*diameter*radius,.025+level*height,z+math.sin(a)*diameter*radius)
    for (level,radius,_),(top,outer,color) in zip(rings,rings[1:]):
        for j in range(sides):
            face([vertex(level,radius,j+1),vertex(level,radius,j),vertex(top,outer,j),vertex(top,outer,j+1)],color)
    face([vertex(.97,.43,j) for j in reversed(range(sides))],'47463d')


def plant(x,z,h,index):
    species=4 if h>1.4 else index%5
    diameter=.33 if h<.66 else (.46 if h>1.4 else .39)
    pot_height=.22 if h<.66 else (.34 if h>1.4 else .27)
    stoneware(x,z,diameter,pot_height,index)
    leaf_width=h*(.85 if h>1.4 else 1.15)
    direction=1 if math.sin(x*4)>0 else -1
    flip=(1,0,0,1) if direction<0 else (0,0,1,1)
    for layer in (0,1):
        stand_off=(layer-.5)*diameter*.21
        placard(f'herb{species}-{layer}',x,pot_height+h/2,z+stand_off,
                leaf_width,h,leafMat,section=flip,angle=direction*(.32 if layer else -.29))


def gutter_herbs(x,z,width,height,angle=0):
    placard('gutter growth',x,.014+height/2,z,width,height,leafMat,angle=angle)

def bike(x,z,color):
    def v(a,b,c=0):return (x+a,b,z+c)
    for xx in (-.53,.53):
        for j in range(20):
            a=j*math.tau/20;b=(j+1)*math.tau/20
            rod(v(xx+math.cos(a)*.298,.335+math.sin(a)*.298),v(xx+math.cos(b)*.298,.335+math.sin(b)*.298),.025,'283739',5)
        for j in range(5):
            a=j*math.tau/10
            rod(v(xx+math.cos(a)*.27,.335+math.sin(a)*.27),v(xx-math.cos(a)*.27,.335-math.sin(a)*.27),.009,'919a8e',4)
    for a,b in [((-.53,.335),(-.18,.74)),((-.18,.74),(.01,.31)),((-.53,.335),(.01,.31)),((.01,.31),(.29,.72)),((-.15,.62),(.28,.51)),((.29,.72),(.53,.335))]:
        rod(v(*a),v(*b),.021,color,6)
    rod(v(.26,.65),v(.19,.96),.017,'a1a397',6);rod(v(.19,.96,-.11),v(.19,.96,.10),.022,'485656',6)
    rod(v(-.18,.73),v(-.19,.84),.025,'96a399')
    box(x-.20,.84,z,.24,.063,.14,'514941');box(x+.48,.80,z,.29,.035,.20,'6e7e77')
    for j in range(5):box(x+.35+j*.064,.86,z+.099,.013,.13,.014,'838f84')
    box(x+.48,.925,z,.30,.022,.225,'8b9487')

def noren(x,y,z,width):
    # Two indigo panels, parted along the doorway centre. The slits reveal the door behind.
    rod((x-width*.6,y+.035,z),(x+width*.6,y+.035,z),.022,'87765d')
    for j in range(3):
        xx=x+(j-1)*width*.326
        box(xx,y-.17+(j%2)*.014,z+.005*j,width*.308,.37,.023,'456262' if j==1 else '506967')
        box(xx,y-.29,z+.026+.005*j,width*.298,.014,.012,'a5a995')
    box(x,y-.14,z+.037,.10,.024,.017,'c4bda1')
    box(x,y-.15,z+.037,.025,.10,.017,'c4bda1')

def roof(x,w,y,z,depth,flat,material):
    if flat:
        box(x,y+.12,z-depth*.48,w+.18,.26,depth+.1,material)
        box(x,y+.33,z+.02,w+.15,.23,.17,'526363')
        box(x,y+.47,z+.08,w+.25,.048,.23,'84918c');return
    rise=1.12;ridge=z-depth*.46
    for zz,yy in [(z+.39,y-.08),(z-depth-.20,y)]:
        p=[(x-w/2-.18,yy,zz),(x+w/2+.18,yy,zz),(x+w/2+.18,y+rise,ridge),(x-w/2-.18,y+rise,ridge)]
        if zz<ridge:p.reverse()
        face(p,material);box(x,yy-.04,zz,w+.42,.14,.13,'283f45')
    for i in range(1,10):
        t=i/10;zz=z+.39+(ridge-z-.39)*t;yy=y-.08+(rise+.08)*t
        box(x,yy+.012,zz,w+.33,.031,.08,'526368' if i%3 else '324a51')
    for side in (-1,1):
        sx=x+side*(w/2+.16);face([(sx,y-.10,z+.38),(sx,y+rise,ridge),(sx,y-.10,z-depth-.21)],'405257')
    box(x,y+rise+.03,ridge,w+.44,.11,.17,'657772')

def frontage(i,lo,hi,h,dep,cladding):
    global sector
    sector='20 / '+['Laundry','Rooming house','Timber row','Tatami rooms','Stationer','Sundry shop','Blue row'][i]
    x=(lo+hi)/2;w=hi-lo;fr=-.18-.07*(i%3);flat=i in (0,3,5)
    box(x,h/2,fr-dep+.12,w,h,.24,'35464a')
    for xx in (lo+.09,hi-.09):box(xx,h/2,fr-dep/2,.18,h,dep,'3f5052')
    box(x,h-.08,fr-dep/2,w,.14,dep,'48595b')
    dw=.92;door=(lo+.29+dw/2,1.068,dw,2.10)
    lx=lo+1.46;rx=hi-.39
    lower=((lx+rx)/2,1.43,rx-lx,1.40)
    high_y=h-1.20; high_w=(w-.99)/2
    upper=[(lo+.31+high_w/2,high_y,high_w,1.32),(hi-.31-high_w/2,high_y,high_w,1.32)]
    openings=[door,lower,*upper]
    wall(x,w,h,fr,openings,'skin'+str(cladding))
    box(x,h/2,fr-.82,w,h,.13,'2c3c3e')
    opening(*door,fr,'genkan',i,.32,1)
    if i in (0,5):
        opening(*lower,fr,'shop',i,.61,3)
    elif i==4:
        xx,yy,ww,hh=lower
        box(xx,yy,fr-.15,ww,hh,.11,'586867')
        for j in range(15):box(xx,yy-hh*.46+j*hh/15,fr-.085,ww,.035,.05,'46595a')
    else:opening(*lower,fr,'room',(i*2)%6,.26,3)
    for j,upperWindow in enumerate(upper):
        number=[[5,0],[4,2],[1,0],[2,3],[2,0],[4,0],[4,1]][i][j]
        opening(*upperWindow,fr,'room',number,.20,2)
    if i in (0,2,3,4,6):
        balcony(upper[i%2][0],high_y-.76,fr,high_w+.17)
    roof(x,w,h,fr,dep,flat,['43565a','3b5057','42565d'][i%3])
    box(x,.12,fr+.025,w,.24,.14,'596863')
    rod((hi-.16,.14,fr+.12),(hi-.16,h-.07,fr+.12),.061,'53696a',8)
    for y in (.5,2.1,3.27):box(hi-.16,y,fr+.16,.16,.05,.10,'7d8983')
    if i not in (2,5):
        ac(hi-.70,2.58 if i%2 else .53,fr+.23)
    if i in (0,5):
        xx,yy,ww,hh=lower
        sign_plate('HINODE' if i==0 else 'SUMI TEA',xx,2.52,fr+.19,ww+.15,.41,
                   '497274' if i==0 else '8c503c','d8d5b0',.25)
        box(xx,2.26,fr+.28,ww+.26,.073,.62,'5a6764')
        box(xx,2.23,fr+.40,ww*.88,.037,.09,'ffe1aa',light)
    else:
        # Deep thin eave with a visible end section and a galvanized edge.
        box(x,2.49,fr+.18,w-.21,.12,.60,'344c50');box(x,2.51,fr+.49,w-.11,.052,.07,'7d8d87')
    # Intercom, small domestic lamp and mailbox at the genkan, in different depth planes.
    xx=door[0]+.65
    box(xx,1.41,fr+.061,.14,.18,.072,'7b847d')
    box(xx,1.46,fr+.113,.083,.037,.020,deep)
    box(xx,.97,fr+.13,.28,.26,.17,'576867' if i!=1 else '855347')
    box(xx,1.031,fr+.219,.21,.030,.02,deep)
    box(door[0],2.24,fr+.12,.21,.073,.16,'454b45')
    box(door[0],2.195,fr+.14,.135,.053,.11,'e2be81',light)
    if i in (1,2,6):
        plant(lo+.20,fr+.43,.88,2+i);plant(lo+.59,fr+.47,.58,i)
    if i in (2,5):
        bike(x+.68,fr+.61,'809592' if i==2 else '995e4b')
    if i in (0,5):
        noren(door[0],2.04,fr+.19,.84)
        xx=door[0]+.64
        placard('notice',xx,1.77,fr+.058,.33,.43,skin)
        # A price-board and two crates sit in the spill just below the shop's glass.
        bx=hi-.69
        for j in range(2):
            box(bx,.135+j*.23,fr+.36,.46,.21,.30,'8c7455')
            for k in range(2):box(bx,.11+j*.23+k*.08,fr+.518,.39,.024,.012,'584c3c')
        box(xx+.28,.40,fr+.37,.38,.68,.075,'75664e')
        placard('notice',xx+.28,.41,fr+.42,.30,.48,skin)
        if i==5:tea_lantern(hi-.21,2.18,fr+.28)
    if i in (2,3,6):
        plant(hi-.36,fr+.41,2.1 if i==2 else 1.58,0)
        xx=hi-.47
        box(xx,1.57,fr+.065,.23,.34,.11,'8a9084')
        box(xx,1.63,fr+.125,.14,.10,.027,'455958')
        rod((xx-.11,.18,fr+.10),(xx-.11,1.6,fr+.10),.023,'72827d')


# Working plane and gutters. All ground elevations are shared with rain rendering.
box(0,-.18,1,112,.20,58,'293c40')
for x in range(-48,48,4):
    for z in range(1,25,4):
        face([(x,-.04,z),(x,-.04,z+4),(x+4,-.04,z+4),(x+4,-.04,z)],material=skin,
             uv=clipped_uv('road',[(0,0),(0,1),(1,1),(1,0)]))
for j in range(-35,35):
    x=j*.75
    box(x,-.007,.27,.744,.06,1.08,['62706e','626f6b','5e6c69'][abs(j)%3])
    box(x,-.028,.93,.741,.026,.22,'3e5153')
    if j%9==1:
        box(x,-.006,.91,.59,.026,.17,'23373b')
        for k in range(8):box(x-.25+k*.072,.009,.91,.025,.009,.15,'6b7a76')
for j in [-15,1.55,13.7]:
    for i in range(18):
        a=i*math.tau/18;b=(i+1)*math.tau/18;y=-.035;z=3.08
        face([(j,y,z),(j+.30*math.cos(b),y,z+.30*math.sin(b)),(j+.30*math.cos(a),y,z+.30*math.sin(a))],'34474a')
    for i in range(7):
        dy=(i-3)*.064;dx=math.sqrt(.26**2-dy**2)
        box(j,-.032,z+dy,dx*2,.004,.018,'526463')

# Plate widths preserve the two party lines and the separate Forest cafe plot.
for args in [(0,-24.35,-19.58,5.57,8.9,0),(1,-19.55,-15.46,5.05,7.6,1),
             (2,-8.13,-1.78,4.89,9,2),(3,1.78,7.17,6.30,9.4,3),
             (4,7.20,11.80,4.96,8.5,4),(5,11.83,17.35,5.64,8.1,5),(6,17.38,23.85,5.49,9.1,6)]:
    frontage(*args)

sector='21 / Central concrete row house'
wall(0,3.5,6,0,[(0,1.15,.80,2.3)],'skin7')
for xx in (-1.66,1.66):box(xx,2.97,-7,.18,5.94,14,'5a6a6c')
for dz in (-2.07,-11.65):box(0,5.86,dz,3.47,.20,4.22,'5a6c70')
box(0,2.85,-13.91,3.50,5.7,.18,'495a5c')
for s in (-1,1):box(s*.458,1.15,-.43,.115,2.30,.86,'4e5d60')
box(0,2.346,-.43,.92,.09,.86,'4c5d5e');box(0,1.10,-.83,.80,2.2,.08,'313e3d')
box(0,1.07,-.773,.69,2.10,.04,'5c5146');box(.211,1.06,-.734,.032,.28,.045,'a29e89')
box(0,.023,-.17,.82,.045,.65,'75807a');box(0,2.18,-.73,.37,.025,.09,'b0a487',light)
plant(-1.31,.21,.77,0);plant(-.91,.18,.49,2);plant(1.33,.22,.86,3)

# Small additions stay beside thresholds and downpipes. Keep door swings and
# the walkable lane clear, especially at the two interactive entrances.
sector='22 / Domestic threshold gardens'
for x,z,height,species in [(-23.83,.34,.72,3),(-19.10,.36,.79,0),
                          (-15.85,.27,.61,2),(-7.62,.41,.74,1),(-7.22,.36,.69,3),
                          (-2.55,.37,.49,2),(2.11,.32,1.08,4),(5.78,.32,.51,1),
                          (7.26,.39,.63,2),(10.96,.31,.79,0),(16.47,.35,.58,3),
                          (20.96,.35,.65,1),(23.05,.37,.49,2)]:
    plant(x,z,height,species)
for x,z,w,h in [(-24.55,.47,.40,.18),(-18.9,.35,.50,.15),(-15.62,.47,.52,.19),
                 (-7.89,.49,.57,.21),(-2.08,.47,.33,.14),(-1.57,.52,.31,.14),
                 (1.58,.46,.29,.12),(6.96,.43,.42,.18),(8.86,.31,.29,.16),
                 (11.46,.37,.51,.17),(17.15,.46,.44,.16),(23.48,.45,.54,.21)]:
    gutter_herbs(x,z,w,h)
for x,z,h,flipped in [(-15.78,-.10,2.24,True),(-2.16,-.16,2.55,False),
                      (6.8,-.03,2.06,True),(23.34,-.02,2.48,False)]:
    placard('teika climber',x,.12+h/2,z,h*.54,h,leafMat,
            section=(1,0,0,1) if flipped else (0,0,1,1))

sector='30 / VISION illuminated beverage dispenser'
x,z=8.10,.11
box(x,.10,z,.96,.19,.70,'283d40');box(x,1.035,z,1.02,1.90,.74,'953f38')
box(x-.46,1.06,z+.372,.065,1.81,.038,'bf6750')
box(x+.38,1.07,z+.37,.19,1.68,.05,'743d39')
box(x-.02,1.51,z+.393,.82,.73,.082,'c6caba')
box(x-.02,1.48,z+.440,.74,.55,.02,'456568')
for row in range(2):
    for j in range(6):
        xx=x-.316+j*.115;yy=1.34+row*.22
        col=['bb7b4d','71a0a3','cdaf5a','dbb797','77a591','a95443'][(j+row*3)%6]
        box(xx,yy,z+.455,.065,.117,.042,col,light)
        box(xx,yy+.068,z+.458,.039,.030,.041,cream)
        box(xx,yy-.008,z+.48,.059,.038,.009,'d5ccb0',light)
    box(x-.024,1.245+row*.22,z+.473,.73,.026,.025,'f5dba3',light)
sign_plate('VISION',x,1.862,z+.393,.94,.245,'314e51','ffe6a6',.187)
box(x+.25,.98,z+.39,.24,.24,.053,'263d41');box(x+.25,1.03,z+.425,.14,.058,.02,'77bfa3',light)
box(x-.15,.89,z+.39,.46,.064,.044,'c08d73')
box(x,.49,z+.40,.65,.24,.065,'283739');box(x,.55,z+.445,.54,.044,.043,'89968b')
for i in range(9):box(x-.32+i*.075,.245,z+.387,.049,.09,.02,'603d38')

sector='40 / Poles, insulated drops and street address plates'
poles=[(-24.7,-.38,7.28),(-8.01,-.14,7.02),(11.97,-.11,7.3),(24.8,-.40,7.2)]
for xx,zz,hh in poles:
    rod((xx,0,zz),(xx,hh,zz),.102,'455959',12)
    for yy in [.53,1.64,2.65,4.32,5.63]:
        box(xx,yy,zz,.232,.04,.23,'72807b')
    box(xx+.07,hh-1.35,zz-.03,.37,.67,.41,'687778')
    for k in range(7):box(xx+.073,hh-1.60+k*.085,zz+.19,.38,.039,.09,'445758')
    for yy in (hh-.69,hh-.30):
        box(xx,yy,zz,.155,.135,1.38,'35474b')
        for dz in (-.53,.04,.56):
            rod((xx,yy,zz+dz),(xx,yy+.21,zz+dz),.043,'a0a69b',7)
            for k in range(3):rod((xx,yy+.075+k*.04,zz+dz),(xx,yy+.09+k*.04,zz+dz),.071,'83918b',7)
    sign_plate('2 - 3',xx,2.09,zz+.123,.32,.21,'406d63','c6d1af',.11)
for (xa,za,ha),(xb,zb,hb) in zip(poles,poles[1:]):
    for i,(dz,dy,dip,rad) in enumerate([(-.60,-.13,.40,.032),(.03,-.16,.63,.022),(.54,-.14,.36,.024),(.4,-1.17,.92,.044)]):
        wire((xa,ha+dy,za+dz),(xb,hb+dy,zb+dz),dip,rad,'20343a')
for a,b in [((-8,5.9,-.1),(-4.8,3.8,-.13)),((12,5.98,-.2),(5.7,4.9,-.24)),((-24.7,5.9,-.4),(-17,4.5,-.2))]:
    wire(a,b,.46,.023,'344548',10)

sector='50 / Gardens behind the party line'
for i in range(34):
    xx=-37+i*2.2+rng.uniform(-.6,.6);zz=rng.uniform(-14,-9.6);h=rng.uniform(4.6,9.9)
    species=(0,2,1,3,2,4,3)[i%7]
    flip=(1,0,0,1) if i%3==0 else (0,0,1,1)
    placard('tree'+str(species),xx,h/2,zz,h*(.78 if species in (1,4) else 1.02),
            h,leafMat,section=flip,angle=rng.uniform(-.26,.26))

sector='60 / Rear tenement terraces'
for layer,(z,interval,start,n) in enumerate([(-17.3,8.3,-44,12),(-29.8,10.7,-59,13)]):
    for i in range(n):
        xx=start+i*interval+rng.uniform(-.8,.8);w=interval*rng.uniform(.72,.97)
        h=rng.uniform(7,17) if layer==0 else rng.uniform(11.0,22.3)
        dz=z+rng.uniform(-2,1.8);dt=rng.uniform(3,5.8)
        box(xx,h/2,dz-dt/2,w,h,dt,['424e66','3b4860','484b59'][i%3])
        placard('tower'+str((i+layer)%6),xx,h/2,dz+.012,w,h,horizon)
        box(xx,h+.045,dz-.30,w+.16,.11,.69,'4e6266')
        if i%2==1:
            box(xx-w*.29,h+.51,dz-1,w*.44,.91,1.64,'415759')
            box(xx-w*.29,h+1.0,dz-1,w*.45,.13,1.75,'516164')
        if i%3!=1:
            xx1=xx+w*.36
            rod((xx1,h,dz-1),(xx1,h+1.44,dz-1),.041,'40555b')
            box(xx1,h+1.12,dz-1,1.66,.052,.052,'43585e')
        if layer==0 and i%3==0:
            for j in range(5):
                box(xx-w*.45,j*h/6+1.13,dz+.25,w*.56,.09,.46,'4d5b5d')
sector='70 / Rain band behind skyline'
placard('sky',0,17,-50,171,58,skyMat)


def emit(records,global_batches):
    objects=[]
    for (collection,mat),(verts,indices,colors,uvs) in records.items():
        bucket=bpy.data.collections.get(collection)
        if not bucket:
            bucket=bpy.data.collections.new(collection);bpy.context.scene.collection.children.link(bucket)
        mesh=bpy.data.meshes.new(collection+' • '+mat.name);mesh.from_pydata(verts,[],indices);mesh.materials.append(mat);mesh.update()
        uv=mesh.uv_layers.new(name='Painted coordinates')
        mapped=[pigment_uv[c] for c in colors] if mat in (ink,light) else uvs
        uv.data.foreach_set('uv',[v for f in indices for j in f for v in mapped[j]])
        ob=bpy.data.objects.new(mesh.name,mesh);bucket.objects.link(ob);objects.append(ob)
    return objects

scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
pigments=sorted({c for (_,mat),(_,_,cs,_) in geometry.items() if mat in (ink,light) for c in cs})
tiles,canvas=atlas(HERE/'street-atlas.png',pigments)
image.filepath=str(HERE/'street-atlas.png');image.unpack(method='USE_ORIGINAL');image.reload()
image.pack();image.filepath='//street-atlas.png'
cx,cy,_,_=tiles['chips']
pigment_uv={c:((cx+(i%16)*8+4)/canvas[0],1-(cy+(i//16)*8+4)/canvas[1]) for i,c in enumerate(pigments)}
source=emit(geometry,False)
scene['Scale']='Street and windows in metres. Azuma entrance 0.8 m x 2.3 m. Local genkan openings 2.1 m.'
scene['Atlas']='Original nearest-sampled ink and gouache plates. See paint.py and street-atlas.png.'
scene['Street datum']='Road y = -0.04, curb z = 0.82, rain puddles at -0.029. Street entrance at x = 0.'
for a in bpy.context.screen.areas:
    if a.type=='VIEW_3D':
        sp=a.spaces.active;sp.shading.color_type='MATERIAL';sp.region_3d.view_distance=28
        sp.region_3d.view_location=(0,1,3);sp.region_3d.view_rotation=Vector((0,-1,.24)).to_track_quat('Z','Y')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'Sumiyoshi-night.blend'),compress=True)
for o in source:o.hide_set(True)
# The editor keeps per-building collections. A material-level batch is sufficient for
# the fixed runtime backdrop and reduces state changes for the walking camera.
runtime=defaultdict(lambda:[[],[],[],[]])
for (_,mat),(verts,indices,colors,uvs) in geometry.items():
    vs,fs,cs,uv=runtime[('Night street',mat)];base=len(vs)
    vs.extend(verts);fs.extend(tuple(base+j for j in f) for f in indices);cs.extend(colors);uv.extend(uvs)
objects=emit(runtime,True)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
out=ROOT/'public'/'sumiyoshi'/'models'/'street.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,
                          export_lights=False,export_cameras=False,export_yup=True)
# Every plate uses one indexed colour atlas and the same nearest sampler. Let Three
# upload it once. Leaves have binary coverage and should write to the depth buffer.
binary=out.read_bytes();size=struct.unpack_from('<I',binary,12)[0]
manifest=json.loads(binary[20:20+size]);tail=binary[20+size:]
textures=manifest['textures']
if len({(t.get('source'),t.get('sampler')) for t in textures})!=1:raise ValueError('Unexpected secondary atlas')
manifest['textures']=textures[:1]
for mat in manifest['materials']:
    for tex in [mat.get('emissiveTexture'),mat.get('pbrMetallicRoughness',{}).get('baseColorTexture')]:
        if tex is not None:tex['index']=0
    if mat['name']==leafMat.name:
        mat['alphaMode']='MASK';mat['alphaCutoff']=.5
data=json.dumps(manifest,separators=(',',':')).encode();data+=b' '*(-len(data)%4)
out.write_bytes(struct.pack('<4sIIII',b'glTF',2,20+len(data)+len(tail),len(data),0x4e4f534a)+data+tail)
print('Street pixel plates',canvas,'/ runtime material batches',len(objects),'/ GLB',out.stat().st_size)
