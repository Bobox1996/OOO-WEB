"""Model the OOO Night Mart in Blender. Run blender -b -P make_shop.py.

All authoring functions take (east, height, south), matching the game floor
plan. Front-facing graphics face south. The .blend files preserve fixtures
as named collections. A material-batched copy is exported for the game.
"""
import bpy
import math
import random
import sys
from collections import defaultdict
from itertools import product
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / "public" / "drive-in" / "models"
OUT.mkdir(parents=True, exist_ok=True)
TAU = math.tau

# Swatches for enamel, paper, wood, produce and light boxes.
SWATCHES = {
    'ink': '#263741', 'coal': '#38474c', 'slate': '#526974',
    'tin': '#97a8a5', 'stone': '#87979c', 'pave': '#a4a3a0',
    'grout': '#b9b2a3', 'floor': '#dfd9c4', 'tile': '#ede8d3',
    'cream': '#eee4cc', 'paper': '#fcf1ce', 'ice': '#bce3d8',
    'aqua': '#76bfba', 'teal': '#227f7e', 'petrol': '#245559',
    'mustard': '#cf993e', 'gold': '#f2c45c', 'yolk': '#e3a742',
    'red': '#bd5046', 'coral': '#e67d61', 'plum': '#855466',
    'blue': '#5b819f', 'sage': '#8ea971', 'forest': '#427b66',
    'wood': '#ab805f', 'maple': '#d2a474', 'toast': '#be8957',
    'glass': '#90ccd2', 'light': '#fff0bd', 'whiteLight': '#eeffed',
    'mintLight': '#b1f4d9', 'amberLight': '#ffd27a', 'roseLight': '#ff9d79',
    'warmWall': '#e4bb84', 'litWood': '#d69b5f',
}
EMISSIONS = {'light':1.05,'whiteLight':1.15,'mintLight':0.85,'amberLight':1.0,'roseLight':0.68,
             'warmWall':.55,'litWood':.24}
swatches = {}
sections = {}
current = None
type_objects = []
font = None


def axis(p):
    return (p[0], -p[2], p[1])


def lin(channel):
    value = int(channel, 16) / 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def reset():
    global swatches, sections, type_objects, font
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    swatches, sections, type_objects = {}, {}, []
    for name, h in SWATCHES.items():
        rgb = tuple(lin(h[i:i+2]) for i in (1,3,5))
        alpha = .13 if name == 'glass' else 1
        m = bpy.data.materials.new(name)
        m.diffuse_color = (*rgb, alpha)
        m.use_nodes = True
        bs = m.node_tree.nodes.get("Principled BSDF")
        bs.inputs['Base Color'].default_value = (*rgb, 1)
        bs.inputs['Alpha'].default_value = alpha
        bs.inputs['Roughness'].default_value = .18 if name == 'glass' else .57
        if name in EMISSIONS:
            bs.inputs['Emission Color'].default_value = (*rgb, 1)
            bs.inputs['Emission Strength'].default_value = EMISSIONS[name]
        if name == 'glass':
            m.surface_render_method = 'BLENDED'
        swatches[name] = m
    font = bpy.data.fonts.get('Bfont Regular')
    for path in ['C:/Windows/Fonts/arialbd.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
        if Path(path).exists():
            font = bpy.data.fonts.load(path)
            break


def section(name):
    global current
    if name not in sections:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
        sections[name] = (col, defaultdict(lambda: [[], []]))
    current = sections[name]


def solid(vertices, faces, material):
    verts, polys = current[1][material]
    offset = len(verts)
    verts.extend(axis(v) for v in vertices)
    polys.extend(tuple(offset+i for i in f) for f in faces)


def oriented(vertices, ids, center):
    a,b,c = [Vector(vertices[i]) for i in ids[:3]]
    mid = sum((Vector(vertices[i]) for i in ids), Vector()) / len(ids)
    return ids if (b-a).cross(c-a).dot(mid-Vector(center)) >= 0 else list(reversed(ids))


def box(x,y,z,w,h,d,mat,bevel=.018):
    a,b,c = w/2,h/2,d/2
    r = min(bevel, a*.65,b*.65,c*.65)
    center=(x,y,z)
    if r <= .0001:
        vs=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in product((-1,1),repeat=3)]
        f=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]]
        solid(vs,f,mat)
        return
    vs=[]; ids={}; fs=[]
    for sx,sy,sz in product((-1,1),repeat=3):
        for normal in range(3):
            p=tuple(cen+s*(half-(0 if normal==i else r))
                    for i,(cen,s,half) in enumerate(zip(center,(sx,sy,sz),(a,b,c))))
            ids[(sx,sy,sz,normal)] = len(vs)
            vs.append(p)
    for n in range(3):
        n1,n2=(n+1)%3,(n+2)%3
        for sign in (-1,1):
            face=[]
            for t,u in [(-1,-1),(1,-1),(1,1),(-1,1)]:
                s=[0]*3; s[n],s[n1],s[n2]=sign,t,u
                face.append(ids[(*s,n)])
            fs.append(oriented(vs,face,center))
        for p,q in product((-1,1),repeat=2):
            face=[]
            for t,normal in [(-1,n1),(1,n1),(1,n2),(-1,n2)]:
                s=[0]*3; s[n],s[n1],s[n2]=t,p,q
                face.append(ids[(*s,normal)])
            fs.append(oriented(vs,face,center))
    for signs in product((-1,1),repeat=3):
        fs.append(oriented(vs,[ids[(*signs,n)] for n in range(3)],center))
    solid(vs,fs,mat)


def cylinder(x,y,z,r,h,mat,n=12,top=None,direction='y'):
    top = r if top is None else top
    vs=[]
    for elevation,rad in ((-h/2,r),(h/2,top)):
        for i in range(n):
            u,v=rad*math.cos(TAU*i/n),rad*math.sin(TAU*i/n)
            delta = (u,elevation,v) if direction=='y' else (u,v,elevation) if direction=='z' else (elevation,u,v)
            vs.append(tuple(q+t for q,t in zip((x,y,z),delta)))
    fs=[list(range(n)),list(range(n,2*n))]
    fs.extend([i,(i+1)%n,n+(i+1)%n,n+i] for i in range(n))
    solid(vs,[oriented(vs,f,(x,y,z)) for f in fs],mat)


def tube(a,b,r,mat,n=10):
    start,end = Vector(a),Vector(b)
    direction = (end-start).normalized()
    u=direction.cross(Vector((1,0,0)) if abs(direction.x)<.85 else Vector((0,0,1))).normalized()
    v=direction.cross(u)
    vs=[tuple(c+r*(u*math.cos(TAU*i/n)+v*math.sin(TAU*i/n))) for c in (start,end) for i in range(n)]
    fs=[list(range(n)),list(range(n,2*n))]+[[i,(i+1)%n,n+(i+1)%n,n+i] for i in range(n)]
    solid(vs,[oriented(vs,f,(start+end)/2) for f in fs],mat)


def label(x,y,z,value,height,mat='ink',align='CENTER',yaw=0):
    data=bpy.data.curves.new(value[:35],'FONT')
    data.body=value; data.size=height; data.align_x=align; data.align_y='CENTER'
    data.resolution_u=3
    if font: data.font=font
    obj=bpy.data.objects.new(value[:35],data)
    current[0].objects.link(obj); obj.location=axis((x,y,z))
    obj.rotation_euler=(math.pi/2,0,yaw)
    data.materials.append(swatches[mat]); type_objects.append(obj)


def finish_meshes():
    for name,(col,materials) in sections.items():
        for mat,(vs,fs) in materials.items():
            if not vs: continue
            mesh=bpy.data.meshes.new(name+' / '+mat)
            mesh.from_pydata(vs,[],fs); mesh.materials.append(swatches[mat])
            obj=bpy.data.objects.new(mesh.name,mesh); col.objects.link(obj)


def printed_panel(name,cell,x,y,z,w,h,yaw=0,pitch=0):
    """An original printed illustration, mounted at a fixture's actual scale."""
    mat=bpy.data.materials.get('Screen printed food posters and periodicals')
    if not mat:
        mat=bpy.data.materials.new('Screen printed food posters and periodicals')
        mat.use_nodes=True
        bs=mat.node_tree.nodes.get('Principled BSDF')
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image=bpy.data.images.load(str(HERE/'night-mart-print.png')); tex.image.pack()
        mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
        bs.inputs['Roughness'].default_value=.8
    a,t=math.radians(yaw),math.radians(pitch)
    right=Vector((math.cos(a),0,-math.sin(a)))
    up=Vector((-math.sin(a)*math.sin(t),math.cos(t),-math.cos(a)*math.sin(t)))
    pts=[axis(Vector((x,y,z))+i*w*.5*right+j*h*.5*up) for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(pts,[],[(0,1,2,3)])
    x0=(cell%4+.004)/4; x1=(cell%4+.996)/4
    y1=1-(cell//4+.004)/3; y0=1-(cell//4+.996)/3
    uv=mesh.uv_layers.new(name='Print atlas')
    for loop,p in zip(uv.data,[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]): loop.uv=p
    mesh.materials.append(mat); current[0].objects.link(bpy.data.objects.new(name,mesh))


def editor_lighting(kind):
    col=bpy.data.collections.new('Studio lighting and camera | Blender preview')
    bpy.context.scene.collection.children.link(col)
    cam=bpy.data.cameras.new('Model study'); ob=bpy.data.objects.new(cam.name,cam); col.objects.link(ob)
    focus=Vector(axis((0,1,0)))
    loc=(6,4.6,10) if kind=='exterior' else (7.6,11,14.5)
    ob.location=axis(loc); ob.rotation_euler=(focus-ob.location).to_track_quat('-Z','Y').to_euler()
    cam.type='ORTHO'; cam.ortho_scale=10.8 if kind=='exterior' else 18.8
    sc=bpy.context.scene; sc.camera=ob
    for name,coord,energy,color,size in [
        ('Softbox',(2,9,7),2100,(1,.85,.67),8),
        ('Sky fill',(-7,6,1),1600,(.55,.71,1),6),
        ('Window bounce',(3,4,-5),1000,(.69,1,.94),5)]:
        lamp=bpy.data.lights.new(name,'AREA'); lamp.energy=energy; lamp.color=color; lamp.shape='DISK'; lamp.size=size
        obj=bpy.data.objects.new(name,lamp); col.objects.link(obj); obj.location=axis(coord)
        obj.rotation_euler=(focus-obj.location).to_track_quat('-Z','Y').to_euler()
    world=bpy.data.worlds.new('Paper backdrop'); world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.27,.34,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.5; sc.world=world
    sc.render.engine='CYCLES'; sc.cycles.samples=12; sc.render.resolution_x=1000; sc.render.resolution_y=750
    sc.view_settings.view_transform='AgX'; sc.render.resolution_percentage=100
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_rotation=ob.rotation_euler.to_quaternion()
                area.spaces.active.region_3d.view_distance=cam.ortho_scale*1.15
                area.spaces.active.region_3d.view_location=focus
                area.spaces.active.shading.color_type='MATERIAL'


def save_models(kind):
    finish_meshes(); editor_lighting(kind)
    scene=bpy.context.scene
    scene['asset']='OOO Night Mart | '+kind
    scene['scale']='One unit equals one metre. The main entrance faces Blender -Y / game +Z.'
    if font and font.filepath: font.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/('shop-'+kind+'.blend')),compress=True)
    # Keep the source modular. Pack the game version to one primitive per swatch.
    groups=defaultdict(list)
    for obj in type_objects:
        bpy.context.view_layer.objects.active=obj; obj.select_set(True)
    if type_objects:
        bpy.ops.object.convert(target='MESH')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in scene.objects:
        if obj.type=='MESH' and len(obj.material_slots):
            groups[obj.material_slots[0].material.name].append(obj)
    exported=[]
    for name,objs in sorted(groups.items()):
        for obj in objs: obj.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]
        if len(objs)>1: bpy.ops.object.join()
        target=bpy.context.view_layer.objects.active
        target.name='Night Mart / '+name; exported.append(target)
        target.select_set(False)
    for obj in exported: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/('shop-'+kind+'.glb')),export_format='GLB',
                              use_selection=True,export_apply=True,export_texcoords=True,
                              export_animations=False,export_cameras=False,export_lights=False)


def brand_mark(x,y,z,scale,mat='teal'):
    for i in range(3):
        cx=x+(i-1)*scale*.67
        cylinder(cx,y,z,scale*.477,.015,mat,18,direction='z')
        cylinder(cx,y,z+.010,scale*.245,.015,'light',16,direction='z')


def pack(x,y,z,w,h,d,color,variant=0,front=True):
    # Reverse the front graphic for two-sided gondolas.
    facing=1 if front else -1
    face_z=z+facing*(d/2+.002)
    box(x,y+h*.5,z,w,h,d,color,.012)
    box(x,y+h*(.61 if variant%2==0 else .5),face_z,w*.81,h*.24,.005,'paper',0)
    box(x-w*.09,y+h*.6,face_z+facing*.004,w*.31,h*.075,.004,'teal' if variant%3 else 'red',0)
    if variant%3==0: box(x,y+h*.15,face_z,w*.96,h*.08,.006,'gold',0)


def bottle(x,y,z,h,col,variant=0):
    r=h*(.18 if variant%2==0 else .20)
    cylinder(x,y+h*.32,z,r,h*.64,col,9)
    cylinder(x,y+h*.71,z,r,h*.16,col,9,top=r*.47)
    cylinder(x,y+h*.84,z,r*.47,h*.11,col,9)
    cylinder(x,y+h*.93,z,r*.57,h*.09,'paper' if variant%3 else 'gold',9)
    cylinder(x,y+h*.39,z,r*1.02,h*.22,'paper' if variant%3 else 'cream',9)


def tin(x,y,z,h,color,variant=0):
    r=h*.33
    cylinder(x,y+h*.5,z,r,h,color,10)
    cylinder(x,y+h*.14,z,r*1.018,h*.12,'paper',10)
    cylinder(x,y+h*.94,z,r*1.025,h*.09,'tin',10)
    if variant%3==0: box(x,y+h*.56,z+r*.98,r*.95,h*.17,.006,'gold',0)


def price_rail(x,y,z,width,front=True):
    sign=1 if front else -1
    box(x,y,z,width,.059,.045,'tin',.003)
    count=max(1,round(width/.49))
    for i in range(count):
        a=x+width*((i+.5)/count-.5)
        box(a,y,z+sign*.026,.19,.041,.012,'paper',.001)
        box(a-.035,y,z+sign*.034,.069,.012,.006,'ink',0)
        box(a+.049,y,z+sign*.034,.034,.021,.006,'yolk',0)


def fill_row(x,y,z,width,level,theme,front=True,dense=1):
    palettes=(('coral','yolk','red','sage'),('blue','teal','forest','mustard'),
              ('red','aqua','plum','gold'),('sage','teal','red','maple'))
    palette=palettes[theme%len(palettes)]
    count=max(3,int(width/(.29 if dense else .40)))
    spacing=width/count; rnd=random.Random(131*level+53*theme+round(100*z))
    for i in range(count):
        if (i+level+theme)%17==16: continue
        a=x+(i+.5-count*.5)*spacing
        variant=(i//3+level+theme)%5; color=palette[(i//3+level)%4]
        h=.24+.06*((i//3+theme)%3)
        if variant==0: bottle(a,y,z,h*1.17,color,i)
        elif variant==1: tin(a,y,z,h*.88,color,i)
        else: pack(a,y,z,spacing*.78,h+rnd.uniform(-.012,.012),.2,color,i+level,front)


def gondola(name,x,z,w,d,theme):
    section(name); top=1.44
    box(x,.12,z,w,.24,d,'petrol',.045)
    box(x,.22,z,w+.04,.12,d+.04,'cream',.03)
    box(x,.83,z,w-.16,1.25,.115,'slate',.015)
    for xx in (x-w/2+.06,x+w/2-.06):
        box(xx,.80,z,.105,1.3,d*.75,'teal',.025)
    for j,y in enumerate((.32,.77,1.20)):
        for sign in (-1,1):
            face=z+sign*(d/2-.03)
            box(x,y,z+sign*d*.27,w,.065,d*.46,'cream',.017)
            price_rail(x,y,face,w,sign>0)
            fill_row(x,y+.04,z+sign*(d/2-.17),w-.22,j,theme+(0 if sign>0 else 1),sign>0)
    box(x,top+.08,z,w+.04,.13,.21,'mustard',.02)
    box(x,top+.08,z+.11,w*.44,.088,.012,'paper',.004)
    label(x,top+.079,z+.122,'PANTRY' if theme%2==0 else 'DAILY GOODS',.082)


def magazine(x,z,w=2.2):
    section('06 / New print rack and periodicals')
    box(x,.2,z,w,.38,.83,'petrol',.045)
    for j in range(3):
        zz=z+.29-j*.235; base=.35+j*.26
        box(x,base+.16,zz-.09,w,.33,.16,'maple',.02)
        sequence=((0,1,2,3),(4,5,0,1),(2,3,4,5))[j]
        count=len(sequence)
        for i,cover in enumerate(sequence):
            xx=x+(i+.5-count*.5)*(w-.12)/count
            book_w=(w-.23)/count
            box(xx,base+.276,zz,book_w,.552,.068,'cream',.008)
            printed_panel(('FIELD NOTES','FORM','DUSK','TABLE','FRAME','OUTSIDE')[cover],
                          cover,xx,base+.276,zz+.038,book_w*.992,.55)
        box(x,base+.085,zz+.066,w,.046,.036,'cream',.005)
    printed_panel('Print Room fascia',11,x,.21,z+.425,1.46,.30)


def milk(x,y,z,w,h,color):
    # Folded gable, sealed ridge, dairy stripe and a small contrasting label.
    d=w*.77
    box(x,y+h*.38,z,w,h*.76,d,'paper',.011)
    roof=[(x+dx*w*.5,y+h*.76,z+dz*d*.5) for dx,dz in [(-1,1),(1,1),(1,-1),(-1,-1)]]
    roof.extend([(x-w*.5,y+h*.99,z),(x+w*.5,y+h*.99,z)])
    faces=[[0,1,5,4],[3,4,5,2],[0,4,3],[1,2,5]]
    solid(roof,[oriented(roof,f,(x,y+h*.75,z)) for f in faces],color)
    box(x,y+h*.987,z,w,.030,.038,color,.001)
    box(x,y+h*.22,z+d*.5+.003,w*.97,h*.21,.005,color,0)
    box(x-w*.025,y+h*.53,z+d*.5+.007,w*.61,h*.075,.006,'teal',0)


def sealed_cup(x,y,z,h,color):
    r=h*.53
    cylinder(x,y+h*.44,z,r*.76,h*.85,'cream',11,top=r)
    cylinder(x,y+h*.55,z,r*.975,h*.22,color,11)
    cylinder(x,y+h*.90,z,r*1.1,h*.095,color,12)
    cylinder(x,y+h*.955,z,r*.65,h*.026,'paper',11)


def refrigeration(x,z,w,mini=False):
    section('04 / Refrigerated drinks and cold pantry')
    modules=3 if mini else 6; each=w/modules
    for k in range(modules):
        a=x+(k+.5-modules*.5)*each
        box(a,1.43,z,each-.036,2.85,.82,'petrol',.05)
        box(a,1.43,z+.38,each-.125,2.33,.08,'aqua',.03)
        for j,y in enumerate((.44,.91,1.38,1.85)):
            box(a,y,z+.59,each-.15,.042,.38,'cream',.009)
            count=3 if mini else 5
            for i in range(count):
                xx=a+(i+.5-count*.5)*(each-.16)/count
                color=('teal','red','yolk','sage','blue','plum')[(k+j+i//2)%6]
                if mini:
                    if (k+j)%3==2: pack(xx,y+.028,z+.66,min(.23,each/count*.73),.32,.18,color,i)
                    elif (k+j)%3==1: tin(xx,y+.028,z+.65,.29,color,i)
                    else: bottle(xx,y+.027,z+.65,.36,color,i)
                elif k==0: milk(xx,y+.027,z+.64,.24,.34+.035*(j%2),('blue','coral','sage')[j%3])
                elif k==1: bottle(xx,y+.028,z+.65,.35+.037*(j%2),('forest','sage','mustard')[(j+i//3)%3],j)
                elif k==2: tin(xx,y+.028,z+.65,.33,('red','blue','gold')[(i//3+j)%3],i)
                elif k==3: milk(xx,y+.027,z+.64,.23,.36,('coral','yolk','forest')[(i//3+j)%3])
                elif k==4: bottle(xx,y+.028,z+.65,.34+.02*(j%2),'wood' if j%2 else 'coal',i)
                else: sealed_cup(xx,y+.027,z+.65,.238,('aqua','plum','coral')[(i//3+j)%3])
            price_rail(a,y,z+.8,each-.14)
        for xx in (a-each*.5+.038,a+each*.5-.038):
            box(xx,1.42,z+.84,.065,2.27,.06,'tin',.012)
        box(a,1.38,z+.845,each-.15,2.18,.012,'glass',0)
        box(a+each*.33,1.27,z+.914,.047,.45,.074,'ink',.018)
        box(a,2.72,z+.46,each-.11,.18,.27,'mintLight',.025)
        if not mini: label(a,2.72,z+.602,('FRESH MILK','ICED TEA','SODA CLUB','FRUIT JUICE','COLD BREW','DAIRY')[k],.136)
        for j in range(5):
            box(a, .125+j*.035,z+.426,each*.68,.012,.012,'slate',0)


def cash_register(x,z,base):
    box(x,base+.055,z,.59,.11,.44,'cream',.025)
    box(x,base+.14,z,.49,.085,.35,'ink',.025)
    box(x,base+.27,z-.09,.20,.20,.13,'slate',.02)
    box(x,base+.405,z-.09,.51,.32,.072,'ink',.025)
    box(x,base+.415,z-.045,.443,.246,.015,'ice',.012)
    for i in range(3): box(x-.033,base+.36+i*.048,z-.033,.29-i*.03,.016,.009,'teal',0)
    for i in range(4):
        for j in range(2):
            box(x+(i-1.5)*.09,base+.19,z+.07+j*.065,.063,.016,.046,'mustard' if i==3 else 'tin',.003)


def service_counter():
    section('03 / Checkout, pastry cabinet and coffee service')
    x,z=-4.45,.77
    box(x,.52,z,3.60,1.04,1.15,'teal',.055)
    for i in range(18): box(x+(i-8.5)*.18,.50,z+.59,.135,.75,.047,'maple',.014)
    box(x,1.07,z,3.67,.155,1.25,'paper',.042)
    box(x,.12,z+.60,3.55,.10,.045,'ink',.01)
    cash_register(-3.45,z,1.15)
    # A red-lacquered heated display with recognizable wrapped rice triangles.
    box(-5.11,1.22,z,1.38,.12,.67,'red',.023)
    for i in range(4):
        for j in range(2):
            xx=-5.11+(i-1.5)*.28; zz=z+(j-.5)*.26
            pts=[(xx+a,1.31+b,zz+d) for d in (-.074,.074) for a,b in [(-.11,0),(.11,0),(.015,.19)]]
            faces=[[0,1,2],[3,5,4],[0,3,4,1],[1,4,5,2],[2,5,3,0]]
            solid(pts,[oriented(pts,f,(xx,1.37,zz)) for f in faces],'cream' if i<2 else 'toast')
            box(xx,1.349,zz+.077,.085,.085,.014,'petrol',.005)
    for xx in (-5.78,-4.44):
        for zz in (z-.31,z+.31): box(xx,1.51,zz,.028,.52,.028,'tin',.002)
    box(-5.11,1.79,z,1.37,.05,.68,'red',.011)
    box(-5.11,1.755,z+.292,1.29,.023,.033,'amberLight',.004)
    box(-5.11,1.53,z+.315,1.32,.48,.01,'glass',0)
    printed_panel('Heated display / hot food',9,-5.11,.64,z+.622,1.59,.42)
    printed_panel('Register enamel plate',10,-3.42,.67,z+.622,1.20,.31)
    for i in range(2):
        xx=-4.16+i*.20; zz=z-.065-i*.045
        box(xx,1.30,zz,.16,.31,.115,'maple',.009)
        box(xx,1.44,zz,.168,.025,.122,'wood',.004)
        box(xx,1.32,zz+.065,.095,.066,.012,'teal',.005)
        for dx in (-.037,.037): tube((xx+dx,1.45,zz),(xx+dx,1.51,zz),.008,'wood')
        tube((xx-.037,1.51,zz),(xx+.037,1.51,zz),.008,'wood')
    section('03 / Staff wall, coffee machine and collection hatch')
    box(-6.43,.59,-2.55,.75,1.18,3.06,'teal',.04)
    box(-6.43,1.21,-2.55,.82,.12,3.14,'paper',.022)
    for j in range(2):
        zz=-3.4+j*.78
        box(-6.44,1.67,zz,.52,.73,.62,'slate',.055)
        box(-6.15,1.78,zz,.065,.43,.48,'ink',.013)
        box(-6.111,1.82,zz,.016,.11,.19,'mintLight',.003)
        cylinder(-6.11,1.42,zz,.083,.19,'paper',10,top=.096)


def interior():
    reset()
    section('01 / Tiled floor, entrance mat and threshold')
    box(0,-.13,0,14.0,.28,11.60,'petrol',.07)
    box(0,-.025,0,13.86,.12,11.46,'grout',.02)
    random.seed(23)
    for i in range(16):
        for j in range(14):
            x=(i-7.5)*.86; z=(j-6.5)*.81
            if (i+j)%2==0: m='tile'
            else: m='floor'
            box(x,.038,z,.848,.016,.798,m,0)
    box(0,.063,5.04,2.55,.035,1.04,'teal',.016)
    for j in range(8): box(0,.084,4.68+j*.102,2.36,.008,.023,'petrol',0)
    box(0,.075,5.64,2.7,.045,.12,'gold',.008)
    section('02 / Cutaway walls, glazed tile and mint picture rail')
    box(0,1.71,-5.76,14.0,3.58,.19,'cream',.035)
    for side in (-1,1):
        # Front is open to the dollhouse camera. Side walls step down toward the entrance.
        for zz,height,depth in [(-4.03,3.40,3.30),(-.98,1.74,2.80),(2.88,.65,4.91)]:
            xx=side*6.92
            box(xx,height*.5,zz,.16,height,depth,'cream',.022)
            box(xx-side*.015,height,zz,.21,.075,depth,'teal',.014)
        box(side*6.88,.19,0,.16,.29,11.40,'petrol',.018)
        for x in (side*2.44,side*4.97):
            box(x,.14,5.70,2.48,.21,.14,'teal',.015)
    for y,mat,h in [(2.94,'teal',.11),(3.09,'mustard',.047),(3.52,'petrol',.09)]:
        box(0,y,-5.64,13.95,h,.078,mat,.009)
    refrigeration(0,-5.49,11.84)
    section('02 / Back wall wayfinding')
    box(0,3.21,-5.655,5.0,.49,.12,'light',.03)
    label(0,3.21,-5.575,'O O O    /    N I G H T    M A R T',.27,'petrol')
    service_counter()
    gondola('05 / Left pantry island',-4.46,-2.28,1.96,1.55,2)
    gondola('05 / Right daily goods island',4.05,-.75,2.96,1.53,1)
    magazine(4.35,2.83)
    section('07 / Woven market baskets')
    for j in range(3):
        y=.14+j*.097; xx=-6.2; zz=3.24
        box(xx,y,zz,.65,.15,.46,'mustard',.018)
        box(xx,y+.09,zz,.69,.058,.50,'teal',.01)
        for i in range(5): box(xx+(i-2)*.113,y,zz+.233,.058,.083,.008,'petrol',.002)
    section('07 / Original illustrated night shift posters')
    # Corner POP boards face the aisle. Their supports fit beside the existing
    # cold cabinet and coffee-service footprints.
    for x,cell,title in [(-6.35,6,'Hand wrapped onigiri'),(6.34,8,'Citrus soda club')]:
        y,z=1.96,-4.71
        box(x,y,z,.985,1.36,.08,'wood',.018)
        printed_panel(title,cell,x,y,z+.045,.936,1.30)
        box(x,y+.705,z,.92,.033,.12,'ink',.004)
    # Long side-wall placard, fully backed by the west wall.
    printed_panel('Midnight Roast counter poster',7,-6.829,2.04,-3.63,1.08,1.40,yaw=90)
    save_models('interior')


def fan(x,z,size):
    box(x,3.19,z,size,.45,size*.83,'slate',.05)
    box(x,3.43,z,size*.94,.07,size*.8,'tin',.02)
    cylinder(x,3.48,z,size*.292,.046,'ink',24)
    for j in range(9):
        delta=(j-4)*size*.058
        span=2*math.sqrt(max(.001,(size*.28)**2-delta**2))
        box(x,3.52,z+delta,span,.017,.016,'slate',.002)
    cylinder(x,3.528,z,size*.055,.03,'tin',12)


def bins(x,z):
    for j,(mat,tag) in enumerate([('sage','01'),('teal','02'),('mustard','03')]):
        xx=x+j*.325
        box(xx,.38,z,.31,.68,.42,'slate',.026)
        box(xx,.74,z,.325,.11,.45,mat,.018)
        box(xx,.66,z+.215,.18,.095,.015,'ink',.008)
        label(xx,.38,z+.218,tag,.083,'paper')


def poster(x,y,z,title,color):
    box(x,y,z,.39,.56,.022,'paper',.008)
    box(x,y+.102,z+.016,.341,.296,.012,color,.003)
    cylinder(x,y+.101,z+.027,.087,.012,'gold',14,direction='z')
    label(x,y-.112,z+.024,title,.061,'ink')
    box(x,y-.202,z+.020,.212,.013,.006,'ink',0)


def exterior():
    reset()
    section('01 / Plinth, ceramic stoop and glazing sill')
    box(0,.035,0,7.19,.18,5.35,'slate',.063)
    box(0,.105,2.72,7.19,.13,.57,'grout',.025)
    for i in range(13):
        for j in range(2):
            box((i-6)*.543,.18,2.58+j*.28,.536,.018,.273,'pave' if (i+j)%3 else 'stone',0)
    box(0,.202,2.76,1.62,.022,.44,'ink',.008)
    for i in range(10): box((i-4.5)*.145,.218,2.76,.062,.008,.38,'slate',0)
    section('02 / Shell, seam joints and rooftop plant')
    box(0,1.52,-2.58,7.12,2.95,.18,'cream',.03)
    for side in (-1,1):
        x=side*3.49
        box(x,1.53,0,.16,2.96,5.29,'cream',.025)
        for j in range(9):
            zz=-2.4+j*.59
            box(x+side*.082,1.5,zz,.012,2.73,.018,'grout',0)
        box(x+side*.093,.31,0,.035,.37,5.27,'slate',.008)
        box(x+side*.095,2.34,0,.037,.086,5.24,'teal',.008)
    box(0,2.94,0,7.29,.18,5.42,'slate',.04)
    box(0,3.047,0,7.12,.073,5.21,'coal',.035)
    for xx in (-3.53,3.53):
        box(xx,3.13,0,.105,.17,5.27,'tin',.012)
    for zz in (-2.57,2.57): box(0,3.13,zz,7.05,.17,.105,'tin',.012)
    fan(-1.14,-.76,.97); fan(.13,-.76,.97)
    tube((.55,3.106,-.8),(2.7,3.106,-.8),.033,'tin')
    tube((2.7,3.106,-.8),(2.7,3.106,-2.4),.033,'tin')
    for xx in (-2.48,-1.83):
        cylinder(xx,3.21,-1.97,.115,.29,'tin')
        cylinder(xx,3.39,-1.97,.18,.11,'slate',12,top=.11)
    section('02 / East service wall and condenser grilles')
    for zz in (-1.74,-.68):
        box(3.60,.64,zz,.28,.74,.90,'tin',.04)
        box(3.76,.64,zz,.040,.61,.76,'slate',.016)
        cylinder(3.787,.64,zz-.07,.245,.026,'ink',18,direction='x')
        for row in range(7):
            dy=(row-3)*.058
            span=2*math.sqrt(.235**2-dy**2)
            box(3.811,.64+dy,zz-.07,.015,.020,span,'tin',.002)
        for y in (.24,1.09):
            box(3.59,y,zz,.34,.048,.61,'slate',.008)
        tube((3.586,1.12,zz+.105),(3.586,1.65,zz+.105),.034,'tin')
    # A wraparound side sign is readable from the car to the east.
    box(3.595,2.64,1.38,.080,.61,1.59,'ink',.038)
    box(3.642,2.64,1.38,.037,.526,1.50,'light',.025)
    box(3.666,2.448,1.38,.013,.044,1.43,'teal',.003)
    label(3.665,2.685,1.38,'TEAM',.385,'petrol',yaw=math.pi/2)
    section('03 / Storefront mullions and sliding glass')
    spans=[(-3.39,-1.01),(1.01,3.39)]
    for a,b in spans:
        mid=(a+b)/2; w=b-a
        box(mid,.34,2.57,w,.49,.17,'teal',.015)
        box(mid,.58,2.60,w,.06,.18,'tin',.008)
        for k in (-1,1):
            box(mid+k*w*.25,1.63,2.56,w*.485,2.03,.018,'glass',0)
        for xx in (a,mid,b):
            box(xx,1.60,2.61,.075,2.61,.13,'ink',.01)
        box(mid,1.06,2.623,w,.056,.043,'teal',.004)
        box(mid,1.12,2.625,w,.024,.037,'gold',.003)
    for i in (-1,1):
        xx=i*.785
        box(xx,1.51,2.61,.412,2.58,.024,'glass',0)
        for s in (-1,1):
            box(xx+s*.212,1.49,2.65,.042,2.62,.054,'slate',.005)
        for y in (.215,1.03,2.76):
            box(xx,y,2.66,.44,.046,.068,'tin',.006)
        box(i*.595,1.20,2.69,.048,.27,.055,'tin',.01)
    box(0,2.74,2.64,7.08,.11,.17,'ink',.016)
    section('04 / Illuminated fascia and hand set lettering')
    box(0,2.998,2.72,7.28,.47,.43,'ink',.047)
    box(0,3.005,2.946,7.18,.388,.045,'light',.019)
    box(0,2.858,2.975,7.08,.048,.018,'teal',.004)
    box(0,2.894,2.976,7.08,.018,.018,'mustard',.003)
    brand_mark(-2.99,3.035,2.983,.188)
    label(-2.60,3.04,2.982,'NIGHT MART',.269,'petrol','LEFT')
    label(2.93,3.04,2.982,'TEAM',.335,'red')
    box(2.34,3.030,2.982,.018,.196,.01,'mustard',0)
    for x in (-2.55,-.88,.88,2.55):
        cylinder(x,2.755,2.79,.074,.022,'amberLight',14)
    section('05 / Warm window displays')
    # Small-scale dressing behind exterior panes. The full room loads separately.
    box(0,.16,0,6.8,.12,5.0,'floor',.02)
    for x in (-2.25,2.25):
        # The fixture and back panel supply a warm photographic window even
        # when the surrounding game has only cool moonlight.
        box(x,1.58,1.05,2.30,2.34,.09,'warmWall',.012)
        for y in (1.50,2.02,2.51):
            box(x,y,1.27,2.30,.075,.44,'litWood',.01)
            box(x,y-.051,1.48,2.16,.028,.024,'amberLight',.005)
        for j,y in enumerate((1.55,2.07)):
            fill_row(x,y,1.40,2.10,j,2 if x<0 else 3)
    box(0,2.73,1.74,6.75,.09,.12,'light',.016)
    for x in (-2.25,2.25):
        box(x,.67,1.87,2.17,.93,.57,'maple',.023)
        box(x,1.17,1.87,2.25,.10,.64,'paper',.014)
    cash_register(-1.66,1.84,1.23)
    for k in range(2):
        for i in range(7):
            x=1.33+i*.27
            pack(x,1.22,1.72+k*.24,.213,.29+.055*(i%2),.17,('sage','red','blue','mustard')[(i//2+k)%4],i)
    refrigeration(.9,-2.30,4.47,mini=True)
    section('05 / Posters, queue decals and open sign')
    poster(-2.84,1.99,2.642,'COFFEE','teal')
    poster(2.81,1.93,2.643,'PRINTS','red')
    box(.81,1.94,2.68,.30,.19,.022,'petrol',.01)
    label(.81,1.94,2.697,'OPEN',.081,'paper')
    section('06 / Recycling bins, umbrella stand and downspouts')
    bins(-3.14,2.77)
    # Umbrella rack with curved crook handles and several folded canopies.
    rx=2.20; zz=2.86
    box(rx,.19,zz,.61,.09,.29,'tin',.015)
    for off in (-.27,.27):
        box(rx+off,.37,zz,.035,.37,.035,'slate',.005)
    box(rx,.55,zz,.63,.052,.22,'slate',.008)
    for j in range(3):
        xx=rx+(j-1)*.17
        cylinder(xx,.42,zz,.015,.42,('teal','red','mustard')[j],8,top=.069)
        tube((xx,.63,zz),(xx,.83+j*.026,zz),.013,'wood')
        tube((xx,.83+j*.026,zz),(xx+.044,.86+j*.026,zz),.013,'wood')
        tube((xx+.044,.86+j*.026,zz),(xx+.066,.81+j*.026,zz),.013,'wood')
    for side in (-1,1):
        tube((side*3.54,2.94,-2.41),(side*3.54,.21,-2.41),.053,'slate')
        for y in (.55,1.53,2.62): box(side*3.52,y,-2.41,.118,.043,.15,'tin',.007)
    save_models('exterior')


if __name__ == '__main__':
    requested = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    if not requested or 'exterior' in requested: exterior()
    if not requested or 'interior' in requested: interior()
