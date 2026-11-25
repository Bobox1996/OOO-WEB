"""Build the OOO cinema truck and its seated-view cabin in Blender.
Run blender -b --python art/drive-in/truck/build.py from any folder.
Distances are metres. All design coordinates are (right, up, rear).
"""
import bpy
import bmesh
import math
from mathutils import Vector
from pathlib import Path

OUT = Path(__file__).resolve().parent
MODELS = OUT.parents[2] / "public" / "drive-in" / "models"
MODELS.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
bpy.context.preferences.filepaths.save_version = 0
EX = bpy.data.collections.new("01 / Folded body, wheel sets and lamps")
CAB = bpy.data.collections.new("02 / Driver's cabin, display and trim")
scene.collection.children.link(EX)
scene.collection.children.link(CAB)
group = EX

def pt(p):
    return Vector((p[0], -p[2], p[1]))

def put(obj, name, mat):
    obj.name = name
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    group.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj

def material(name, color, rough=.5, metal=0, glow=0):
    rgb = tuple(int(color[i:i+2],16)/255 for i in (0,2,4))
    rgb = tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1)
    bs=m.node_tree.nodes.get("Principled BSDF") if m.use_nodes else None
    if not bs:
        m.use_nodes=True
        bs=m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value=(*rgb,1)
    bs.inputs["Metallic"].default_value=metal
    bs.inputs["Roughness"].default_value=rough
    if glow:
        bs.inputs["Emission Color"].default_value=(*rgb,1)
        bs.inputs["Emission Strength"].default_value=glow
    return m

steel=material("01 · satin rain silver","A8B9C0",.33,.33)
sill=material("02 · lower folded aluminium","7C909A",.39,.27)
lightsteel=material("03 · brushed fold highlight","CED7D4",.32,.35)
ink=material("04 · graphite rubber","222A34",.62)
tyre=material("05 · bluish tyre wall","313943",.8)
tread=material("06 · tyre raised detail","47505A",.77)
trim=material("07 · midnight gunmetal","37444D",.45,.22)
glass=material("08 · indigo coated exterior glass","293F51",.34,.04)
glass.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value=.19
glasshi=material("09 · evening sky on glazing","435B6C",.43,.04)
lamp=material("10 · warm white running lamps","FFF0B4",.33,.08,2.1)
red=material("11 · tail light lens","F96A58",.29,.08,1.45)
amber=material("12 · amber marker lens","F6A257",.38,.05,1.15)
cork=material("13 · cinnamon woven trim","AD8060",.95)
sand=material("14 · warm shale upholstery","88847C",.85)
seam=material("15 · wheat stitching","D9BD94",.86)
soft=material("16 · deep spruce dashboard","333F42",.82)
felt=material("17 · slate floor carpet","454A49",.98)
screen=material("18 · sleeping LCD","18282E",.25)
phosphor=material("19 · dashboard cool glow","90DFD3",.35,.05,.85)
leather=material("20 · wheel leather","464741",.7)
reflection=material("21 · rain on glass","859FA8",.26,.09)

def mesh(name,points,faces,mat,rounding=0,recalc=False):
    data=bpy.data.meshes.new(name)
    data.from_pydata([pt(p) for p in points],[],faces)
    data.update()
    if recalc:
        bm=bmesh.new()
        bm.from_mesh(data)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(data)
        bm.free()
    ob=bpy.data.objects.new(name,data)
    group.objects.link(ob)
    data.materials.append(mat)
    if rounding: bevel(ob,rounding)
    return ob

def bevel(ob,r):
    mod=ob.modifiers.new("Soft cast edges","BEVEL")
    mod.width=r
    mod.segments=3 if r>.012 else 2
    mod.affect='EDGES'
    mod.limit_method='ANGLE'
    norm=ob.modifiers.new("Flat primary faces","WEIGHTED_NORMAL")
    norm.keep_sharp=True

def box(name,center,dims,mat,r=0,tilt=0):
    x,y,z=center
    a,b,c=(v/2 for v in dims)
    pts=[(xx,yy,zz) for xx,yy,zz in [(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),(-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)]]
    # Positive Three X tilt moves the upper edge towards the rear.
    t=math.radians(tilt)
    pts=[(x+xx,y+yy*math.cos(t)-zz*math.sin(t),z+yy*math.sin(t)+zz*math.cos(t)) for xx,yy,zz in pts]
    return mesh(name,pts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],mat,r,True)

def tube(name,points,r,mat,poly=False):
    c=bpy.data.curves.new(name,'CURVE')
    c.dimensions='3D'
    c.resolution_u=1
    c.bevel_depth=r
    c.bevel_resolution=2 if r>.008 else 1
    c.resolution_u=1
    c.use_fill_caps=True
    sp=c.splines.new('POLY')
    sp.points.add(len(points)-1)
    for a,p in zip(sp.points,points): a.co=(*pt(p),1)
    sp.use_cyclic_u=poly
    obj=bpy.data.objects.new(name,c)
    group.objects.link(obj)
    c.materials.append(mat)
    return obj

def rod(name,a,b,r,mat,n=12):
    v=pt(b)-pt(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=v.length,location=(pt(a)+pt(b))*.5)
    ob=put(bpy.context.object,name,mat)
    ob.rotation_euler=v.to_track_quat('Z','Y').to_euler()
    return ob

def sphere(name,p,dims,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=pt(p))
    ob=put(bpy.context.object,name,mat)
    ob.scale=(dims[0]/2,dims[2]/2,dims[1]/2)
    for face in ob.data.polygons: face.use_smooth=True
    return ob

def face(name,pts,mat):
    return mesh(name,pts,[tuple(range(len(pts)))],mat)

def word(name,txt,x,y,z,size,mat,facing='rear'):
    data=bpy.data.curves.new(name,'FONT')
    data.body=txt
    data.size=size
    data.align_x='CENTER'
    data.align_y='CENTER'
    ob=bpy.data.objects.new(name,data)
    group.objects.link(ob)
    data.materials.append(mat)
    ob.location=pt((x,y,z))
    ob.rotation_euler=(math.pi/2,0,0 if facing=='rear' else math.pi)
    return ob

def loft(name,stations,mat,r):
    # closed transverse slices, narrower lower edge
    pts=[]
    for z,h,w,base in stations:
        pts.extend([(-w+.05,base,z),(w-.05,base,z),(w,h,z),(-w,h,z)])
    faces=[(0,3,2,1),tuple(range(len(pts)-4,len(pts)))]
    for j in range(len(stations)-1):
        for i in range(4):
            k=j*4+i; n=j*4+(i+1)%4
            faces.append((k,n,n+4,k+4))
    return mesh(name,pts,faces,mat,r,True)

# Body structure and the two creases that give the pickup its familiar profile.
box("EV battery skid plate",(0,.36,0),(1.56,.22,3.94),ink,.08)
loft("Front vault and hood",[(-2.34,.86,.90,.57),(-2.18,1.00,1.00,.68),(-1.27,1.113,1.025,.90)],steel,.028)
loft("Cabin floor and shoulder",[(-1.30,1.111,.998,.84),(.10,1.145,1.01,.75),(1.12,1.116,1.012,.86)],steel,.025)
loft("Tailgate core",[(1.18,1.116,.97,.89),(2.16,1.045,.99,.69),(2.34,1.005,.95,.59)],sill,.029)
box("Front protective bumper",(0,.583,-2.302),(1.89,.247,.19),ink,.067)
box("Rear protective bumper",(0,.555,2.284),(1.90,.23,.19),ink,.054)
box("Lower nose silver skid",(0,.454,-2.276),(1.25,.08,.19),sill,.03)
box("Lower rear step",(0,.431,2.30),(1.26,.075,.18),trim,.023)
for sign in (-1,1):
    X=lambda x: sign*x
    # Side skin polygon cuts away each wheel aperture, leaving real clearances.
    yz=[(-2.32,.82),(-2.18,.995),(-1.27,1.112),(.09,1.151),(1.24,1.125),(2.28,1.015),(2.33,.65),(1.97,.58),(1.91,.719),(1.68,.929),(1.18,.929),(.964,.718),(.89,.525),(-.878,.525),(-.966,.72),(-1.16,.930),(-1.65,.930),(-1.876,.722),(-1.946,.55),(-2.27,.58)]
    side=[(X(1.012),y,z) for z,y in yz]
    verts=side+[(X(.953),y,z) for z,y in yz]
    n=len(side)
    mesh("Pressed outer side panel "+str(sign),verts,[tuple(range(n)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],steel,.012,True)
    face("Lower door facet "+str(sign),[(X(1.016),.555,-.865),(X(1.016),.716,-.974),(X(1.016),.765,.969),(X(1.016),.55,.866)],sill)
    tube("Door reveals front",[(X(1.022),1.105,-1.19),(X(1.023),.93,-.95),(X(1.023),.562,-.84)],.007,trim)
    tube("Door reveals center",[(X(1.024),1.13,-.03),(X(1.024),.563,.045)],.007,trim)
    tube("Door reveals rear",[(X(1.022),1.104,.974),(X(1.022),.93,1.07),(X(1.022),.564,.86)],.007,trim)
    box("Rock slider "+str(sign),(X(1.007),.5,0),(.13,.095,1.79),ink,.026)
    for zz in (-.13,.82):
        box("Flush door handle",(X(1.026),1.06,zz),(.029,.037,.17),trim,.011)
    for zz in (-1.417,1.428):
        # A faceted black wheel-arch lip spans 160 degrees like a toy cast panel.
        angles=[math.radians(a) for a in (11,35,66,90,114,145,169)]
        coords=[]
        for radius in (.503,.567):
            coords += [(X(1.048),.418+radius*math.sin(a),zz+radius*math.cos(a)) for a in angles]
        n=len(angles)
        mesh("Bolt-on wheel eyebrow",coords,[(i,i+1,i+1+n,i+n) for i in range(n-1)],ink)
        tube("Eyebrow edge",[(X(1.049),.418+.565*math.sin(a),zz+.565*math.cos(a)) for a in angles],.009,trim)
        for a in (angles[1],angles[-2]):
            rod("Fender rivet",(X(1.043),.418+.538*math.sin(a),zz+.538*math.cos(a)),(X(1.056),.418+.538*math.sin(a),zz+.538*math.cos(a)),.015,sill)
        # Torus-like tyre silhouette with broad, rounded sidewall and chamfered tread.
        profile=[(.79,.325),(.79,.369),(.833,.408),(.89,.425),(1.032,.425),(1.083,.402),(1.10,.369),(1.09,.287),(1.067,.263),(.84,.263)]
        pts=[]; faces=[]; N=32
        for xx,rr in profile:
            for j in range(N):
                a=math.tau*j/N
                pts.append((X(xx),.434+rr*math.sin(a),zz+rr*math.cos(a)))
        for k in range(len(profile)):
            for j in range(N):
                faces.append((k*N+j,k*N+(j+1)%N,((k+1)%len(profile))*N+(j+1)%N,((k+1)%len(profile))*N+j))
        tire=mesh("All-terrain moulded tyre",pts,faces,tyre,0,True)
        for f in tire.data.polygons:f.use_smooth=True
        rod("Wheel inset",(X(.99),.434,zz),(X(1.089),.434,zz),.302,trim,20)
        for j in range(24):
            a=math.tau*j/24
            tube("Raised sidewall notch",[(X(1.095),.434+.388*math.sin(a),zz+.388*math.cos(a)),(X(1.101),.434+.344*math.sin(a+.039),zz+.344*math.cos(a+.039))],.006,tread)
        for j in range(6):
            a=math.tau*j/6
            def spoke(rr,angle,xx):
                return (X(xx),.434+rr*math.sin(angle),zz+rr*math.cos(angle))
            face("Turbine blade", [spoke(.080,a-.22,1.101),spoke(.268,a+.01,1.094),spoke(.277,a+.63,1.094),spoke(.126,a+.31,1.102)],sill)
            face("Blade machined edge",[spoke(.136,a+.28,1.104),spoke(.266,a+.52,1.096),spoke(.272,a+.63,1.096)],lightsteel)
        rod("Wheel central cap",(X(1.088),.434,zz),(X(1.114),.434,zz),.096,ink,12)
        rod("Machined hub",(X(1.112),.434,zz),(X(1.117),.434,zz),.041,lightsteel,6)
    wing=[(X(1.009),1.113,.69),(X(.934),1.325,.77),(X(.974),1.098,2.237),(X(1.009),1.013,2.23)]
    face("Sloping sail panel",wing,steel)
    tube("Bed rail trim",[wing[1],wing[2]],.024,trim)
# The windows form a shallow pyramid with a shortened rear glass.
wind=[(-.932,1.132,-1.267),(.932,1.132,-1.267),(.777,1.749,.078),(-.777,1.749,.078)]
face("Panoramic windscreen",wind,glass)
tube("Windshield glazing gasket",wind,.024,ink,True)
def on_glass(u,v):
    # u maps across the tapered glass; v rises from cowl to roof.
    return (u*(.932-.155*v),1.135+.617*v,-1.269+1.345*v)
face("Broad reflected horizon band",[on_glass(-.954,.79),on_glass(-.954,.905),on_glass(.949,.842),on_glass(.949,.794)],glasshi)
face("Lower dash reflection",[on_glass(-.93,.063),on_glass(-.93,.084),on_glass(-.42,.109),on_glass(-.31,.105)],glasshi)
face("Corner paper parking permit",[on_glass(.757,.090),on_glass(.899,.090),on_glass(.899,.143),on_glass(.757,.143)],cork)
for j in range(3):
    p=[on_glass(.780+.019*j+.006*math.cos(i*math.tau/12),.118+.008*math.sin(i*math.tau/12)) for i in range(12)]
    tube("Permit studio mark",[(x,y+.003,z-.003) for x,y,z in p],.0022,seam,True)
for s in (-1,1):
    S=lambda a: s*a
    sidewin=[(S(.967),1.135,-1.208),(S(.792),1.739,.055),(S(.790),1.732,.298),(S(.934),1.315,.787),(S(.975),1.145,.971)]
    face("Blue-grey side glass",sidewin,glass)
    tube("Continuous glazed outline",sidewin,.028,ink,True)
    tube("Silver A post",[(S(.957),1.129,-1.25),(S(.794),1.750,.075)],.033,steel)
    tube("Silver C post",[(S(.788),1.745,.279),(S(.944),1.277,.866),(S(.972),1.14,.99)],.044,steel)
    tube("Piano black dividing pillar",[(S(.914),1.148,.018),(S(.815),1.632,.19)],.029,ink)
    tube("Glass reflected shoulder",[(S(.961),1.19,-1.014),(S(.964),1.197,-.21)],.009,glasshi)
    rod("Mirror base",(S(.928),1.24,-.832),(S(1.119),1.228,-.884),.036,trim)
    box("Mirror shell",(S(1.123),1.257,-.877),(.213,.128,.24),steel,.054)
    box("Mirror face",(S(1.122),1.255,-.759),(.165,.083,.017),glass,.027)
    box("Side amber reflector",(S(.951),.784,-2.297),(.067,.051,.104),amber,.016)
roof=[(-.80,1.739,.038),(.80,1.739,.038),(.795,1.746,.299),(-.795,1.746,.299)]
face("Creased silver roof header",roof,steel)
rear=[(-.778,1.726,.299),(.778,1.726,.299),(.895,1.309,.781),(-.895,1.309,.781)]
face("Rear window",rear,glass)
tube("Rear glass frame",rear,.025,ink,True)
bed=[(-.908,1.303,.793),(.908,1.303,.793),(.906,1.056,2.215),(-.906,1.056,2.215)]
face("Roll-top tonneau",bed,trim)
for j in range(13):
    z=.855+j*.105
    y=1.303-(z-.793)*.174
    box("Tonneau slat",(0,y+.012,z),(1.795,.026,.072),sill if j in (0,12) else trim,.009,tilt=9.8)
box("Light bar black bezel",(0,.854,-2.356),(1.855,.104,.052),ink,.023)
box("Full width running light",(0,.866,-2.387),(1.805,.034,.018),lamp,.008)
for s in (-1,1):
    box("Lower fog lamp pod",(s*.748,.623,-2.402),(.288,.087,.018),trim,.018)
    box("Fog lamp strip",(s*.755,.626,-2.414),(.192,.028,.012),lamp,.006)
    box("Rear lamp bumper",(s*.78,.854,2.349),(.278,.094,.039),ink,.019)
box("Rear red band",(0,.936,2.347),(1.87,.052,.031),red,.013)
box("Registration plate",(0,.680,2.361),(.421,.152,.024),seam,.015)
word("Plate lettering","OOO  07",0,.682,2.377,.076,ink)
tube("Windscreen resting wiper",[(-.76,1.166,-1.173),(-.548,1.189,-1.131),(.34,1.19,-1.137)],.018,ink)
# Three concentric-studio marks, painted on the tailgate.
for j in range(3):
    tube("Three O tail emblem",[(.575+.065*j+.022*math.cos(a*math.tau/16),.762+.023*math.sin(a*math.tau/16),2.346) for a in range(16)],.0045,lightsteel,True)

# The cabin is a second export in identical vehicle space. The driving view gets
# open glass; the exterior export carries the darker, reflective glazing.
group=CAB
box("Cabin floor",(0,.482,0),(1.78,.15,2.48),felt,.08)
for side in (-1,1):
    s=side
    X=lambda a: s*a
    panels=[(X(.91),.525,-1.19),(X(.91),1.114,-1.18),(X(.936),1.157,.98),(X(.936),.520,.98)]
    face("Fabric inner door panel",panels,soft)
    tube("Door shoulder beam",[(X(.91),1.124,-1.21),(X(.945),1.149,.99)],.051,soft)
    tube("Door woven welt",[(X(.892),1.094,-1.17),(X(.917),1.115,.87)],.017,cork)
    box("Door elbow rest",(X(.86),.856,.071),(.13,.103,.76),sand,.046)
    box("Interior latch",(X(.876),.998,-.32),(.044,.052,.205),sill,.017)
    for j in range(4):
        tube("Door woofer perforation",[(X(.905),.707+.02*j,-.8),(X(.905),.707+.02*j,-.56)],.004,ink)
    tube("Inner A pillar",[(X(.92),1.103,-1.24),(X(.774),1.737,.075)],.043,sand)
    tube("Pillar dark seal",[(X(.945),1.115,-1.243),(X(.795),1.748,.075)],.014,ink)
    tube("Cabin roof rail",[(X(.773),1.735,.07),(X(.778),1.730,.39),(X(.896),1.32,.81)],.052,sand)
    # Mirrors are visible through the side windows from the driver's seat.
    rod("Cabin mirror stalk",(X(.93),1.235,-.79),(X(1.093),1.246,-.858),.031,trim)
    box("Cabin mirror casing",(X(1.114),1.256,-.866),(.202,.122,.231),steel,.052)
    box("Cabin mirror silvering",(X(1.114),1.255,-.748),(.165,.089,.012),glasshi,.024)
    # Seats include a gently creased cushion, wraparound shell and two supports.
    xx=X(.457)
    box("Cushioned seat pan",(xx,.685,.192),(.624,.172,.704),sand,.071)
    for off in (-.273,.273):
        box("Seat side bolster",(xx+off,.763,.204),(.101,.139,.536),soft,.044)
    box("Seat back",(xx,1.024,.514),(.626,.68,.186),sand,.09,tilt=11)
    for off in (-.23,.23):
        tube("Seat back welt",[(xx+off,.822,.365),(xx+off,1.258,.455)],.009,seam)
    for off in (-.132,.132):
        rod("Head restraint stay",(xx+off,1.284,.567),(xx+off,1.424,.584),.018,sill)
    box("Pillow headrest",(xx,1.453,.578),(.411,.246,.178),sand,.077,tilt=9)
    for zz in (-.02,.05,.12,.19):
        tube("Seat cushion stitch",[(xx-.186,.773,zz),(xx+.186,.773,zz)],.005,seam)
    box("Footwell glow",(xx,.757,-.832),(.31,.021,.022),amber,.007)

# Dashboard apron, speaker perforations, open air seam and stitched roll.
loft("Instrument panel top shelf",[(-1.241,1.119,.927,.888),(-.94,1.081,.9,.854),(-.686,1.027,.872,.87)],soft,.025)
tube("Windshield lower rubber seal",[(-.92,1.125,-1.236),(0,1.125,-1.256),(.92,1.125,-1.236)],.017,ink)
tube("Padded scuttle roll",[(-.877,1.033,-.684),(-.59,1.036,-.674),(.16,1.036,-.671),(.876,1.033,-.684)],.026,leather)
box("Passenger dashboard textile",(0,.903,-.736),(1.722,.205,.135),sand,.048)
box("Woven air register fascia",(0,.978,-.673),(1.698,.061,.042),cork,.018)
box("Continuous air slot",(0,.983,-.649),(1.618,.019,.016),ink,.007)
for x in (-.65,-.613,.64,.675):
    box("Air register tab",(x,.981,-.636),(.016,.032,.018),lightsteel,.005)
for s in (-1,1):
    for j in range(6):
        x=s*(.515+j*.034)
        tube("Dashtop speaker grille",[(x,1.101,-1.102),(x-s*.042,1.093,-1.012)],.0037,ink)
tube("Warm stitched dash edge",[(-.832,.896,-.666),(-.59,.894,-.657),(.84,.896,-.666)],.005,seam)
box("Glove compartment seam",(.553,.822,-.709),(.566,.012,.039),ink,.005)
box("Glove pull",(.53,.841,-.680),(.104,.023,.021),trim,.006)
# A small bonnet lip enables rain and headlight context without a tinted pane.
loft("Visible nose through windshield",[(-2.36,.873,.896,.82),(-2.17,.982,.98,.91),(-1.27,1.107,.995,1.05)],steel,.018)
tube("Bonnet centre fold",[(0,1.112,-1.288),(0,.986,-2.151),(0,.883,-2.324)],.006,lightsteel)
tube("Parked wiper arm",[(-.76,1.151,-1.199),(-.50,1.168,-1.171),(.28,1.161,-1.183)],.014,ink)
rod("Wiper pivot",(-.76,1.133,-1.212),(-.76,1.155,-1.203),.029,trim)

# Slightly flattened wheel rim with thumb pads and stitched leather sections.
def wheel_at(x,y,d=0):
    # Plane normal towards driver and subtly upward, top is further from viewer.
    return (-.456+x,.978+y,-.42-.30*y+d)
rim=[(-.178,-.136),(-.208,-.117),(-.235,-.073),(-.242,.042),(-.218,.102),(-.179,.135),(-.102,.155),(.103,.155),(.179,.135),(.218,.102),(.242,.042),(.235,-.073),(.208,-.117),(.178,-.136),(.111,-.153),(-.111,-.153)]
tube("Softly squared leather wheel",[wheel_at(x,y) for x,y in rim],.026,leather,True)
tube("Inner steering welt",[wheel_at(x*.911,y*.877,.011) for x,y in rim],.004,cork,True)
rod("Steering column",(-.456,.923,-.702),(-.456,.976,-.445),.081,ink)
for s in (-1,1):
    a=wheel_at(s*.064,-.008); b=wheel_at(s*.203,.052)
    rod("Steering spoke",a,b,.024,trim)
    bb=wheel_at(s*.116,.030,.013)
    box("Wheel toggle",bb,(.048,.03,.022),sill,.008)
box("Driver airbag horn pad",wheel_at(0,0,.018),(.186,.108,.057),soft,.032)
for j in range(3):
    tube("Wheel embroidery",[wheel_at((j-1)*.025+.009*math.cos(i*math.tau/14),.011*math.sin(i*math.tau/14),.050) for i in range(14)],.0025,seam,True)
rod("Blinker stalk",(-.491,.96,-.53),(-.703,1.008,-.528),.015,trim)
box("Blinker stalk grip",(-.687,1.006,-.53),(.075,.029,.042),ink,.012)
# Tablet coating normal (0,.13917,.99027); cover is behind the active face.
box("Display pedestal",(.18,.879,-.707),(.095,.147,.075),trim,.016)
box("Landscape tablet housing",(.18,1.012,-.646),(.538,.339,.042),ink,.025,tilt=-8)
box("Landscape tablet glass",(.18,1.014,-.626),(.505,.306,.009),screen,.007,tilt=-8)
# No baked pixels on the active glass, so covers can align to its entire face.
sphere("Tablet status LED",(.418,1.166,-.643),(.01,.01,.007),phosphor)
box("Central floor console",(0,.653,.05),(.273,.273,.753),soft,.047)
box("Console tray",(0,.816,-.082),(.244,.067,.375),trim,.022)
box("Console lambswool pad",(0,.841,.275),(.258,.104,.279),sand,.036)
rod("Cup well outer",(0,.843,-.131),(0,.862,-.131),.081,sill,24)
rod("Cup well insert",(0,.855,-.131),(0,.865,-.131),.069,ink,24)
box("Drive selector",(0,.872,.017),(.097,.033,.057),sill,.012)
# Headliner stays behind the forward cone. Mirror is offset from the film image.
box("Roof cross member",(0,1.737,.159),(1.58,.073,.191),sand,.029)
for xx in (-.447,.447):
    box("Folded sun visor",(xx,1.686,.148),(.486,.039,.149),sand,.016)
rod("Mirror stem",(.164,1.624,-.100),(.164,1.493,-.228),.016,trim)
box("Rearview mirror housing",(.164,1.488,-.218),(.278,.094,.043),ink,.023)
box("Rearview mirror glass",(.164,1.489,-.192),(.246,.067,.010),glasshi,.014)
# A woven charm swings from the mirror; three seed beads in the studio palette.
tube("Mirror charm cord",[(.283,1.467,-.212),(.291,1.401,-.209),(.284,1.359,-.211)],.0028,cork)
for idx,m in enumerate((cork,phosphor,seam)):
    sphere("Ceramic raindrop bead",(.285,1.358-.014*idx,-.211),(.012,.015,.012),m)
# Safety reflections are confined to the corners; the central screen is visible.
for s in (-1,1):
    for j in range(4):
        z=-1.065+j*.12
        y=1.132+(z+1.267)*.46
        xx=s*(.88-(z+1.26)*.112-(j%2)*.035)
        tube("Residual side rain streak",[(xx,y+.004,z),(xx-s*.002,y+.015,z+.022)],.0033,reflection)

def publish(collection,filename):
    """Pack by material for WebGL. The .blend retains individually named parts."""
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    batched={}
    for obj in collection.objects:
        ev=obj.evaluated_get(deps)
        geo=ev.to_mesh()
        if geo is None or not geo.polygons:
            ev.to_mesh_clear()
            continue
        mat=obj.data.materials[0]
        rec=batched.setdefault(mat,([],[],[]))
        coords,polys,smooth=rec
        off=len(coords)
        world=ev.matrix_world
        coords.extend([tuple(world @ v.co) for v in geo.vertices])
        for f in geo.polygons:
            polys.append(tuple(off+k for k in f.vertices))
            smooth.append(f.use_smooth)
        ev.to_mesh_clear()
    bpy.ops.object.select_all(action='DESELECT')
    packed=[]
    for mat,(coords,polys,smooth) in batched.items():
        data=bpy.data.meshes.new(mat.name)
        data.from_pydata(coords,[],polys)
        data.update()
        for f,flag in zip(data.polygons,smooth):f.use_smooth=flag
        data.materials.append(mat)
        ob=bpy.data.objects.new(mat.name,data)
        scene.collection.objects.link(ob)
        ob.select_set(True)
        packed.append(ob)
    bpy.context.view_layer.objects.active=packed[0]
    bpy.ops.export_scene.gltf(filepath=str(MODELS/filename),export_format="GLB",use_selection=True,export_yup=True,export_texcoords=False,export_cameras=False,export_animations=False,export_lights=False)
    for ob in packed:
        data=ob.data
        bpy.data.objects.remove(ob,do_unlink=True)
        bpy.data.meshes.remove(data)

publish(EX,"truck.glb")
publish(CAB,"cockpit.glb")
# Present the exterior first when opened; toggle the collections to work on cabin.
scene.view_settings.view_transform='AgX'
CAB.hide_viewport=True
CAB.hide_render=True
bpy.ops.object.select_all(action='DESELECT')
for screen_area in bpy.context.screen.areas:
    if screen_area.type=='VIEW_3D':
        space=screen_area.spaces.active
        space.shading.color_type='MATERIAL'
        space.overlay.show_overlays=False
        space.region_3d.view_distance=7.2
        space.region_3d.view_location=pt((0,.85,0))
        space.region_3d.view_rotation=(pt((0,.8,0))-pt((4,3.1,-4.7))).to_track_quat('-Z','Y')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"Afterhours.blend"),compress=True)
print("OOO Cinema pickup built.")
