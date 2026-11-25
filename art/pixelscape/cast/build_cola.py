"""Model the café's 250 mL returnable bottle and pressed steel crown in metres.
The runtime wraps the paper at R 0.0385 m, centred at height 0.124 m.
"""
import math
from pathlib import Path
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
GAME=HERE.parents[2]/'public/sumiyoshi/models'
TAU=2*math.pi
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1


def srgb(h):
    def lin(i):
        v=int(h[i:i+2],16)/255
        return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
    return (lin(0),lin(2),lin(4),1)


def pigment(name,col,rough,metal=0,coat=0,alpha=1):
    m=bpy.data.materials.new(name);m.use_nodes=True
    m.diffuse_color=srgb(col)
    bs=m.node_tree.nodes.get('Principled BSDF')
    for slot,value in [('Base Color',m.diffuse_color),('Roughness',rough),('Metallic',metal),('Coat Weight',coat),('Coat Roughness',.15),('Alpha',alpha)]:
        bs.inputs[slot].default_value=value
    if alpha<1:
        m.surface_render_method='BLENDED';m.use_backface_culling=True
    return m


body=pigment('Bottle glass · flint brown, filled','362720',.21,.08,.85)
neck=pigment('Bottle glass · green rim','77968a',.16,.10,.8,.35)
edge=pigment('Mould edge · teal glass','57736a',.23,.20,.76)
cream=pigment('Crown lithograph · ivory','e6d5ac',.39,.23,.48)
red=pigment('Pressed steel · oxblood enamel','893d37',.31,.53,.59)
gold=pigment('Rolled and chipped plating','95865f',.30,.70,.40)
dark=pigment('Raised batch number · dark glass','635345',.32,.14,.60)
syrup=pigment('Cola and meniscus','2f211b',.18,.05,.85)
bead=pigment('Cold condensation','a7bdb1',.13,.25,.86,.54)


def geom(name,verts,faces,material,smooth=True):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);mesh.materials.append(material)
    for p in mesh.polygons:p.use_smooth=smooth
    return obj


def lathe(name,levels,material,steps=96,flutes=12,shift=0):
    # A level contains height, mean radius, and the mould's scallop amplitude.
    verts=[]
    for z,r,f in levels:
        for i in range(steps):
            a=TAU*i/steps
            radius=r+f*(.5+.5*math.cos(flutes*a+shift))
            verts.append((radius*math.cos(a),radius*math.sin(a),z))
    inds=[(j*steps+i,j*steps+(i+1)%steps,(j+1)*steps+(i+1)%steps,(j+1)*steps+i)
          for j in range(len(levels)-1) for i in range(steps)]
    inds+=[tuple(reversed(range(steps))),tuple((len(levels)-1)*steps+i for i in range(steps))]
    return geom(name,verts,inds,material)


def strand(name,points,radii,mat,n=8):
    pts=[Vector(p) for p in points];rings=[];prev=None
    for j,p in enumerate(pts):
        d=(pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)]).normalized()
        side=prev or (Vector((1,0,0)) if abs(d.x)<.9 else Vector((0,1,0)))
        side=(side-d*side.dot(d)).normalized();next_axis=d.cross(side)
        ring=[tuple(p+radii[j]*(math.cos(TAU*k/n)*side+math.sin(TAU*k/n)*next_axis)) for k in range(n)]
        rings+=ring;prev=side
    return geom(name,rings,[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i)
                             for j in range(len(pts)-1) for i in range(n)],mat)


def bead_at(name,x,y,z,rx,ry,rz,m):
    nv=10;nh=7;verts=[];faces=[]
    for j in range(nh+1):
        a=-math.pi*.495+j/nh*math.pi*.99
        for i in range(nv):
            th=TAU*i/nv
            verts.append((x+rx*math.cos(th)*math.cos(a),y+ry*math.sin(th)*math.cos(a),z+rz*math.sin(a)))
        if j:
            for k in range(nv):
                faces.append(((j-1)*nv+k,(j-1)*nv+(k+1)%nv,j*nv+(k+1)%nv,j*nv+k))
    return geom(name,verts,faces,m)


lathe('Pressed heel, punt, ribbed skirt and label bed',[
    (.003,.014,0),(0,.0255,0),(.0005,.0285,0),(.002,.0315,.0002),(.006,.0337,.0004),
    (.010,.0349,.0008),(.014,.0350,.0008),(.016,.0349,.0008),(.021,.0336,.0012),
    (.030,.0320,.0020),(.042,.0319,.0025),(.056,.0327,.0023),(.066,.034,.0017),
    (.071,.0353,.0011),(.074,.0372,.0002),(.0755,.0377,0),(.077,.0372,0),
    (.081,.0369,0),(.167,.0369,0),(.171,.0372,0),(.173,.0377,0),
    (.175,.0373,.0001),(.179,.0359,.0005),(.185,.0336,.0011),(.191,.0299,.0016),
    (.197,.0254,.00125),(.201,.0217,.00075),(.203,.0194,.0003),(.204,.0182,0)],body)
lathe('Hollow upper neck and moulded lip',[
    (.201,.0200,.0004),(.204,.0189,.0002),(.211,.0164,.0001),(.221,.0143,0),
    (.229,.0133,0),(.234,.0132,0),(.237,.0148,0),(.239,.0150,0),
    (.241,.0137,0),(.243,.0137,0),(.245,.0154,0),(.248,.0155,0),
    (.2485,.0122,0),(.246,.0110,0),(.222,.0117,0),(.209,.0143,0)],neck)
lathe('Fill and dished meniscus',[(.199,.019,0),(.204,.017,0),(.211,.0140,0),
    (.213,.0137,0),(.2138,.0139,0),(.2132,.0125,0)],syrup)
lathe('Light caught in the foot',[(.0035,.0317,.0002),(.005,.0331,.0002),(.0058,.0332,.0002)],edge)
for z,r in [(.0725,.0362),(.0754,.03776),(.1732,.0378),(.2377,.0149)]:
    lathe('Mould witness line',[(z-.0004,r,0),(z,r+.00032,0),(z+.00042,r,0)],edge)
lathe('Crimped steel crown · 21 teeth',[(.2448,.0151,.0020),(.2455,.0159,.0020),
    (.2474,.0155,.0018),(.2495,.0149,.0011),(.2520,.0144,.0002),(.2525,.0136,0)],red,126,21)
lathe('Bare rolled hem',[(.2446,.0152,.0019),(.2450,.01585,.0020),(.2454,.01590,.0020)],gold,126,21)
lathe('Ivory enamel top disc',[(.25243,.01350,0),(.25260,.01332,0),(.25263,.01277,0)],cream,56)
# Three interlocking, offset ovals are stamped on the cap, with one tiny
# registration tab to retain a directional mark when the player rotates it.
for k in range(3):
    points=[]
    for j in range(33):
        a=TAU*j/32;dx=.0034*math.cos(a);dy=.0061*math.sin(a)
        points.append(((k-1)*.0052+dx*.94+dy*.32,dy*.94-dx*.32,.25277))
    strand('OOO crown print',points,[.00043]*len(points),red,6)
for k in range(8):
    a=.20+k*.21
    strand('Etched bearing mark',[(.0255*math.cos(a),.0255*math.sin(a),.198),
           (.0264*math.cos(a),.0264*math.sin(a),.1965)],[.00036,.00036],dark,5)
for j in range(22):
    a=j*2.399+.4;z=.019+(j%8)*.0061 if j%3 else .183+(j%4)*.002
    rad=(.034+.0009*math.cos(12*a)) if z<.1 else .034-(z-.183)*.58
    rz=.0008+.00028*(j%4);r=rz*.70
    bead_at('Condensation',rad*math.cos(a),rad*math.sin(a),z,r,r,rz,bead)

# The blend keeps manufacturing parts editable. The GLB batches those parts
# by finish; the inspection camera needs only one draw per glass/ink material.
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        sp=area.spaces.active;sp.overlay.show_overlays=False;sp.shading.color_type='MATERIAL'
        sp.region_3d.view_location=(0,0,.128);sp.region_3d.view_distance=.47
        sp.region_3d.view_rotation=Vector((0,1,-.11)).to_track_quat('-Z','Y')
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'Returnable-Cola.blend'),compress=True)
for m in (body,neck,edge,cream,red,gold,dark,syrup,bead):
    meshes=[o for o in scene.objects if o.type=='MESH' and o.active_material==m]
    if len(meshes)>1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes:o.select_set(True)
        bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join()
    meshes[0].name=m.name
bpy.ops.export_scene.gltf(filepath=str(GAME/'cola.glb'),export_format='GLB',
    export_yup=True,export_cameras=False,export_lights=False,export_animations=False)
