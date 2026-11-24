"""Blender geometry utilities. Positions and dimensions use Three.js coordinates."""
import math
import random
from collections import defaultdict
import bpy
from mathutils import Vector

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

def blender(p):
    return (p[0], -p[2], p[1])

batches = defaultdict(lambda: [[],[],[]])
group = "Street"
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
