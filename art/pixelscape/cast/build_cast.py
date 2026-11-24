"""Build the Sumiyoshi players, café residents and stamped returnable cola.

Run portrait_atlas.cjs once, then Blender -b -t 2 -P build_cast.py.
Figure coordinates are metres, +Z up, -Y forward. Each articulated node keeps
its joint in local coordinates. The seated origin is the sofa cushion surface.
"""
import json
import math
import random
from pathlib import Path
from mathutils import Vector
import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
GAME = ROOT / "public/sumiyoshi/models"
ROSTER = json.loads((ROOT / "art/sumiyoshi/cast/roster.json").read_text(encoding="utf8"))["people"]
TAU = 2 * math.pi
S, C = math.sin, math.cos


def linear(v):
    v /= 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def color(h, gain=1.0):
    h = h.lstrip('#')
    return tuple(min(1, linear(int(h[i:i+2], 16)) * gain) for i in (0, 2, 4)) + (1,)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    return scene


def material(name, base="ffffff", metal=0, rough=.78, palette=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = color(base)
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs['Base Color'].default_value = m.diffuse_color
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    if palette:
        attr = m.node_tree.nodes.new('ShaderNodeVertexColor')
        attr.layer_name = "Pigment"
        m.node_tree.links.new(attr.outputs['Color'], bs.inputs['Base Color'])
    return m


def empty(name, coll, parent=None, p=(0,0,0)):
    o = bpy.data.objects.new(name, None)
    coll.objects.link(o)
    o.parent = parent
    o.location = p
    o.empty_display_size = .03
    return o


class Surface:
    """One small indexed mesh per articulated piece; shapes share its draw call."""
    def __init__(self, name, coll, pivot=(0,0,0), scale=1, mat=None):
        self.name, self.coll, self.piv, self.scale = name, coll, Vector(pivot), scale
        self.material = mat or inks
        self.verts, self.polys, self.swatches, self.smooth, self.uv = [], [], [], [], []

    def add(self, points, polys, coat, smooth=True, tex=None, gains=None):
        start = len(self.verts)
        self.verts.extend([tuple((Vector(p)-self.piv)*self.scale) for p in points])
        self.polys.extend([tuple(start+i for i in face) for face in polys])
        self.smooth.extend([smooth]*len(polys))
        if isinstance(coat, str):
            if gains is None: self.swatches.extend([color(coat)]*len(points))
            else: self.swatches.extend([color(coat,g) for g in gains])
        else: self.swatches.extend(coat)
        if tex: self.uv.extend(tex)

    def loft(self, rows, shade, smooth=True, caps=True, gains=None):
        n, count = len(rows[0]), len(rows)
        polys = [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i)
                 for j in range(count-1) for i in range(n)]
        if caps: polys.extend([tuple(reversed(range(n))),tuple((count-1)*n+i for i in range(n))])
        self.add([p for row in rows for p in row],polys,shade,smooth,gains=gains)

    def ovoid(self, p, dims, shade, n=12):
        x,y,z=p; rx,ry,rz=dims
        rows=[]
        for j in range(9):
            a=-math.pi/2+.005+(math.pi-.010)*j/8
            rows.append([(x+rx*C(a)*C(TAU*i/n),y+ry*C(a)*S(TAU*i/n),z+rz*S(a)) for i in range(n)])
        self.loft(rows,shade)

    def ring_body(self, levels, shade, n=20, crease=0, phase=0, squash=1.0):
        rows=[];gains=[]
        for j,(z,x,y,rx,ry) in enumerate(levels):
            row=[]
            for k in range(n):
                t=TAU*k/n
                # Cloth dips remain coherent across the waist, elbow and hem.
                fold=1+crease*(.64*C(5*t+phase+j*.29)+.36*C(9*t-phase-j*.19))
                cx=C(t); sy=S(t)
                row.append((x+rx*math.copysign(abs(cx)**squash,cx)*fold,
                            y+ry*math.copysign(abs(sy)**squash,sy)*fold,z))
                gains.append(1+crease*(1.35*C(5*t+phase+j*.29)+C(9*t-phase-j*.19)))
            rows.append(row)
        self.loft(rows,shade,gains=gains)

    def tube(self, path, radii, shade, n=9, cloth=False):
        pts=[Vector(p) for p in path]
        radii=[radii]*len(pts) if isinstance(radii,(int,float)) else radii
        rows=[]; gains=[]
        prev=None
        for j,(p,r) in enumerate(zip(pts,radii)):
            axis=(pts[min(j+1,len(pts)-1)]-pts[max(j-1,0)]).normalized()
            side=prev or (Vector((1,0,0)) if abs(axis.x)<.95 else Vector((0,1,0)))
            side=(side-axis*side.dot(axis)).normalized()
            other=axis.cross(side).normalized()
            rx, ry = (r,r) if isinstance(r,(int,float)) else r
            row=[]
            for i in range(n):
                a=TAU*i/n;fold=1+(.058*C(5*a+.25*j)+.03*S(7*a-.5*j) if cloth else 0)
                row.append(tuple(p+(rx*C(a)*side+ry*S(a)*other)*fold))
                gains.append(1+(.12*C(5*a+.25*j) if cloth else 0))
            rows.append(row);prev=side
        self.loft(rows,shade,gains=gains)

    def patch(self, points, shade):
        # A slightly crowned cloth panel makes lapels, pressed plackets and pockets
        # catch the window instead of disappearing into the jacket's front.
        mid=sum((Vector(p) for p in points),Vector())/len(points)
        mid.y-=.002
        self.add([tuple(mid),*points],[(0,i+1,(i+1)%len(points)+1) for i in range(len(points))],shade)

    def finish(self, parent, node_name=None):
        geo=bpy.data.meshes.new(self.name)
        geo.from_pydata(self.verts,[],self.polys)
        geo.update()
        ob=bpy.data.objects.new(node_name or self.name,geo)
        self.coll.objects.link(ob)
        ob.parent=parent
        geo.materials.append(self.material)
        if self.uv:
            uv=geo.uv_layers.new(name="Face study")
            uv.data.foreach_set('uv',[v for loop in geo.loops for v in self.uv[loop.vertex_index]])
        else:
            pig=geo.color_attributes.new(name="Pigment",type='BYTE_COLOR',domain='POINT')
            pig.data.foreach_set('color',[v for col in self.swatches for v in col])
        for p,smooth in zip(geo.polygons,self.smooth):p.use_smooth=smooth
        return ob


scene=reset()
inks=material("Piece-dyed cloth, hair and skin",palette=True)
face_mat=material("Registered portrait ink on the cheek planes",rough=.86)
pic=bpy.data.images.load(str(HERE/'faces.png'))
pic.pack()
node=face_mat.node_tree.nodes.new("ShaderNodeTexImage")
node.interpolation='Closest';node.extension='EXTEND';node.image=pic
face_bs=face_mat.node_tree.nodes.get('Principled BSDF')
# The original portrait plates already carry broad key and fill lighting.
# Keep the photograph visible below saturated café practicals, while a small
# shaded component still models the live nose, cheeks, and moving silhouette.
face_bs.inputs['Base Color'].default_value=color('302827')
face_bs.inputs['Specular IOR Level'].default_value=.035
face_bs.inputs['Emission Strength'].default_value=.78
face_mat.node_tree.links.new(node.outputs['Color'],face_bs.inputs['Emission Color'])

complexions={'biscuit':'bd9a81','apricot':'bf9982','honey':'b08d72'}
hair_pigments={'umber':('302b29','494037'),'ink':('23262a','393b3b'),
               'cocoa':('292727','403731'),'ash':('b6b7ad','d7d3c1')}
heights=[1.715,1.684,1.641,1.764,1.752,1.734,1.77,1.651]
# width, rear skull and lower-jaw modifiers established from the source silhouettes.
widths=[1,.96,1,1.04,.96,1.04,1.01,.96]


def make_head(head, face, data, index, base):
    cx=widths[index];skin=complexions[data['complexion']]
    hcol,hi=hair_pigments[data['hairColor']]
    levels=[(0,.031,.045,-.011),(.014,.047,.055,-.010),(.035,.062,.067,-.006),
            (.060,.070,.074,-.004),(.082,.077,.078,-.002),(.104,.080,.081,0),
            (.119,.081,.081,.001),(.139,.082,.083,.003),(.161,.082,.087,.006),
            (.181,.079,.086,.009),(.205,.065,.076,.011),(.226,.035,.043,.011),(.234,.006,.010,.009)]
    def pt(level,a):
        z,rx,ry,y0=level;x=rx*C(a)*cx
        f=max(0,-S(a))
        # Nose bridge, tip, orbital hollow, cheeks, philtrum and lips in side profile.
        nose=(.014*math.exp(-((z-.099)/.044)**2)+.022*math.exp(-((z-.078)/.014)**2))*math.exp(-(x/.016)**2)
        cheek=.007*math.exp(-((abs(x)-.044)/.022)**2-((z-.087)/.024)**2)
        orbit=.004*math.exp(-((abs(x)-.031)/.016)**2-((z-.118)/.011)**2)
        lip=.007*math.exp(-((z-.045)/.024)**2-(x/.038)**2)
        return (x,y0+ry*S(a)-(nose+lip+cheek-orbit)*f**2,base+z)
    hull_angles=([math.radians(-20+220*i/30) for i in range(31)] if index
                 else [TAU*i/36 for i in range(36)])
    rows=[[pt(l,a) for a in hull_angles] for l in levels]
    if index:
        # Cut a real aperture for the portrait. The two surfaces share their
        # temple edges, so the face never intersects a second hidden skull.
        count=len(hull_angles)
        shell=[(j*count+k,j*count+k+1,(j+1)*count+k+1,(j+1)*count+k)
               for j in range(len(rows)-1) for k in range(count-1)]
        head.add([p for row in rows for p in row],shell,skin)
    else:head.loft(rows,skin)
    if index:
        # An open, curved patch shares the underlying anatomy; only its UVs come
        # from the photographed face, so profiles retain actual physical depth.
        steps=32;points=[];uv=[];faces=[]
        for j,lev in enumerate(levels):
            for k in range(steps+1):
                a=math.radians(-160+140*k/steps)
                x,y,z=pt(lev,a)
                points.append((x,y,z))
                u=(x/cx/.192+.5);v=max(.005,min(.995,lev[0]/.240))
                uv.append(((index-1+u)/7,v))
                if j and k:
                    ix=j*(steps+1)+k
                    faces.append((ix-steps-2,ix-steps-1,ix,ix-1))
        face.add(points,faces,'ffffff',tex=uv)
    else:
        for sign in (-1,1):
            x=sign*.031
            head.tube([(x-sign*.011,-.078,base+.118),(x,-.082,base+.121),(x+sign*.013,-.075,base+.121)],
                      [.0013,.0023,.0011],'373531')
            head.tube([(x-sign*.011,-.076,base+.135),(x,-.079,base+.137),(x+sign*.014,-.074,base+.135)],
                      [.0020,.0031,.0016],hcol)
        head.tube([(-.019,-.080,base+.046),(-.005,-.085,base+.044),(.009,-.084,base+.044),(.019,-.080,base+.046)],
                  [.0015,.0022,.0021,.0012],'815d54')
    for sign in (-1,1):
        head.ovoid((sign*.079*cx,.004,base+.100),(.013,.014,.027),skin)
        head.ovoid((sign*.089*cx,.002,base+.100),(.003,.008,.015),'986e5e',9)
    style=data['hair'];phase=.9*index
    # A cropped hair shell with individual temple, nape and fringe cut lines.
    n=44
    def silhouette(a):
        front=max(0,-S(a));back=max(0,S(a))
        end=2.12-.78*front**2+.045*S(7*a+phase)
        if style in ('ripple','quiff','broken','curtain','wing'):
            end-=.12*front+.19*front*S(a*2+phase*.7)
        if style in ('quiff','broken','brush'):end-=.20*(1-front)
        if style in ('blunt','wing','page','curtain'):end+=.10*(1-front)
        if style in ('ripple','blunt','wing'):end+=.11*back
        return end
    def hp(a,t,e=0):
        phi=.025+t*(silhouette(a)-.025)
        swept=.017 if style in ('quiff','brush') else .006
        x=(.086*cx+e)*S(phi)*C(a)+swept*(1-t)*C(1.2+phase)
        y=(.094+e)*S(phi)*S(a)+.008
        z=.144+(.103+(swept if style in ('brush','quiff','broken') else 0)+e)*C(phi)
        # At the occipital ridge the skull projects past an ellipsoid. Conform
        # every hair ring to the true section; no scalp can cut the rear crown.
        for lower,upper in zip(levels,levels[1:]):
            if lower[0]<=z<=upper[0]:
                v=(z-lower[0])/(upper[0]-lower[0])
                rx,ry,cy=[lo+(hi-lo)*v for lo,hi in zip(lower[1:],upper[1:])]
                rad=math.hypot(x/(rx*cx+.004+e),(y-cy)/(ry+.004+e))
                if 0<rad<1:x/=rad;y=cy+(y-cy)/rad
                break
        return x,y,base+z
    rows=[]
    for j in range(13,-1,-1): rows.append([hp(TAU*i/n,j/13) for i in range(n)])
    head.loft(rows,hcol)
    for k in range(22):
        a=TAU*k/22+.04*S(k*3)
        path=[hp(a+(1-t)*(.6 if style in ('quiff','brush','page') else .27),t,.0018) for t in (.17,.40,.65,.86,.98)]
        head.tube(path,[.0004,.0015,.0022,.0013,.0004],hi,5)
    rng=random.Random(454+index)
    for k in range(30):
        a=TAU*k/30;front=max(0,-S(a));back=max(0,S(a))
        if front>(.60 if style=='ripple' else .75) and style in ('ripple','quiff','brush'):continue
        p=Vector(hp(a,.78,.002));mid=Vector(hp(a+.08,.98,.004))
        length=(.028+.032*rng.random())*(.50+.6*(1-front))
        if style in ('blunt','wing'):length+=.037*(1-front)
        if style=='ripple':length+=.245*(1-front)**.6
        if style=='brush' and k%3!=0:
            p=Vector(hp(a,.30,.004));mid=Vector(hp(a,.53,.005));length=-.025-rng.random()*.012
        tip=mid+Vector((.013*C(a),.016*S(a),-length))
        if style=='ripple':tip.x+=.017*S(k*3);tip.y+=.013
        q=mid.lerp(tip,.55);q.x+=.011*S(k*1.4)
        breadth=1.8 if style=='ripple' else 1
        head.tube([p,mid,q,tip],[(.013*breadth,.005),(.011*breadth,.005),(.010*breadth,.004),(.0008,.001)],hcol if k%4 else hi,8)
    if data["glasses"]!="none":
        frame='373a39' if data['glasses']=='square' else '8d8773'
        thick=.0027 if data['glasses']=='square' else .0013
        for sign in (-1,1):
            # Real acetate fronts are already present in the printed portrait.
            # Hinges and temples supply depth behind the frontal glass.
            head.tube([(sign*.061,-.064,base+.125),(sign*.074,-.045,base+.128),
                       (sign*.082,.005,base+.117)],thick,frame,6)


def make_body(body, data, index, off):
    style=data['outfit']
    fabric='475956' if index==0 else data['fabric']
    trim='9c9a79' if index==0 else data['trim']
    dark=data['slacks'];skin=complexions[data['complexion']]
    narrow=.94 if index in (1,2,7) else 1
    # Bottom hem, abdomen, rib cage, axilla, shoulder crest and neck.
    def lv(z,rx,ry,cy=0): return (z+off,0,cy,rx*narrow,ry)
    body.ring_body([lv(.90,.145,.087,.004),lv(.947,.145,.090),lv(1.00,.137,.083)],dark,28,.028,index,.9)
    body.ring_body([lv(1.320,.105,.069,.009),lv(1.355,.079,.059,.007),lv(1.388,.057,.054,.004),
                    lv(1.425,.046,.048,.005),lv(1.457,.046,.051,.009),lv(1.491,.051,.059,.014)],
                   skin,20)
    torso=[lv(.897,.153,.097),lv(.909,.163,.105),lv(.937,.167,.105),lv(1.008,.150,.093),
           lv(1.056,.142,.088),lv(1.137,.149,.094),lv(1.20,.164,.111,-.003),lv(1.267,.172,.108),
           lv(1.316,.191,.087,.002),lv(1.349,.194,.075,.008),lv(1.370,.150,.062,.007),lv(1.394,.063,.057,.005)]
    if style in ('denim','collarless','vest') or index==0:
        torso[:2]=[lv(.862,.157,.105),lv(.874,.168,.108)]
    body.ring_body(torso,fabric,32,.048,index,.87)
    # Broken lines of heavier pigment pick out tailor's creases at native scale.
    # The back has its own folds so the sofa view reads as a dressed adult.
    for s in (-1,1):
        for j in range(3):
            z=.965+j*.029
            body.tube([(s*.128,-.073,z+.060+off),(s*.106,-.082,z+.039+off),
                       (s*.079,-.094,z+.030+off),(s*.051,-.099,z+.017+off)],
                      [.001,.0024,.003,.0007],fabric,6)
        body.tube([(s*.145,.079,1.312+off),(s*.133,.078,1.231+off),(s*.114,.083,1.178+off),
                   (s*.103,.072,1.112+off)],[.0015,.002,.0026,.001],fabric,6)
    # The player wears a cotton chore jacket: reverse yoke, centre seam, curved
    # side panels, under collar and a brass tab visible in the couch composition.
    if index==0 or style in ('denim','collarless','smock','vest'):
        for sign in (-1,1):
            x=lambda a:a*sign*narrow
            def cloth(points,shade):
                body.patch([(x(a),y,z+off) for a,y,z in points],shade)
            left=(index%2==1 and sign<0)
            if style!='vest':
                cloth([(.018,-.077,1.344),(.085,-.069,1.371),(.150,-.055,1.349),
                       (.151,-.073,1.320),(.063,-.101,1.274),(.021,-.108,1.244)],fabric)
            if style in ('denim','vest') or index==0:
                cloth([(.018,-.08,1.337),(.066,-.064,1.391),(.103,-.069,1.368),
                       (.080,-.099,1.310),(.041,-.112,1.329)],trim if index==0 else fabric)
                cloth([(.062,-.112,1.135),(.124,-.094,1.149),(.132,-.090,1.12),
                       (.124,-.095,1.061),(.081,-.107,1.053),(.064,-.111,1.066)],fabric)
                body.tube([(x(.064),-.113,1.139+off),(x(.10),-.108,1.146+off),(x(.125),-.095,1.151+off)],.0020,trim,6)
            else:
                cloth([(.04,-.105,1.30),(.092,-.10,1.35),(.108,-.084,1.359),
                       (.065,-.106,1.259),(.045,-.109,1.239)],fabric)
            # shoulder topstitch and softly collapsed hem at the back
            body.tube([(x(.012),.086,1.292+off),(x(.071),.098,1.295+off),
                       (x(.132),.082,1.308+off),(x(.168),.056,1.322+off)],
                      [.0018,.0026,.0023,.0016],trim if index==0 else fabric,6)
        body.tube([(0,.105,1.286+off),(.003,.109,1.193+off),(-.003,.092,1.081+off),
                   (-.002,.100,.997+off),(.003,.110,.918+off)],.0021,trim if index==0 else fabric,6)
        body.tube([(0,-.062,1.390+off),(0,-.1,1.313+off),(0,-.117,1.250+off),
                   (0,-.1,1.128+off),(0,-.095,1.020+off),(0,-.107,.90+off)],.0034,fabric,6)
        for z,depth in [(1.29,.111),(1.205,.116),(1.12,.10),(1.034,.094),(.944,.106)]:
            body.ovoid((.006,-depth-.002,z+off),(.0041,.0025,.0041),'ad9471',8)
    else:
        body.ring_body([lv(1.369,.074,.059,.005),lv(1.391,.069,.058,.004),
                        lv(1.421 if style=='highneck' else 1.399,.064,.056,.005)],trim,24,.018)
    if index in (1,2):
        # Baristas keep the open collar or banded bob visible above a twill apron.
        apron='72725c' if index==1 else '414e52'
        levels=[(.744,.148,.130),(.822,.150,.129),(.900,.151,.127),(.963,.150,.124),
                (1.03,.130,.113),(1.10,.096,.116),(1.18,.076,.131),(1.25,.073,.136)]
        pts=[];f=[]
        for row,(z,w,d) in enumerate(levels):
            for col in range(9):
                u=(col-4)/4
                pts.append((u*w,-d+.034*u*u+.002*S(8*u+row*.4),z+off+.0025*C(8*u+row)))
                if col and row:
                    k=row*9+col;f.append((k-10,k-9,k,k-1))
        body.add(pts,f,apron)
        for side in (-1,1):
            body.tube([(side*.064,-.119,1.238+off),(side*.079,-.087,1.318+off),
                       (side*.073,-.059,1.377+off),(side*.088,.029,1.372+off),
                       (side*.092,.084,1.308+off)],[.008,.010,.010,.009,.007],apron,7)
        body.patch([(-.084,-.124,.98+off),(.090,-.124,.98+off),(.085,-.128,.882+off),
                    (-.08,-.129,.884+off)],apron)


def make_leg(part, side, data, index, seated):
    x=side*(.092+(.009*C(index*2.1) if index else 0))
    pants=data['slacks'];shoe=data['shoes']
    if seated:
        path=[(x,.004,.133),(x,-.067,.107),(side*.102,-.186,.085),(side*.118,-.305,.074),
              (side*.123,-.394,.059),(side*.124,-.412,.014),(side*.123,-.390,-.080),
              (side*.122,-.372,-.205),(side*.122,-.359,-.330),(side*.120,-.354,-.385)]
        sizes=[(.075,.093),(.083,.096),(.087,.081),(.080,.073),(.075,.069),(.068,.061),
               (.065,.064),(.063,.067),(.046,.051),(.047,.050)]
        f=(side*.120,-.356,-.475)
    else:
        path=[(x,.012,.961),(x,.017,.896),(x+side*.009,.006,.780),
              (x+side*.013,-.005,.653),(x+side*.015,-.014,.507),
              (x+side*.015,-.012,.470),(x+side*.017,.008,.425),
              (x+side*.021,.028,.340),(x+side*.024,.028,.241),(x+side*.022,.019,.160),
              (x+side*.023,.014,.113),(x+side*.023,.012,.092)]
        sizes=[(.079,.09),(.086,.096),(.083,.09),(.076,.078),(.067,.066),(.064,.064),
               (.061,.063),(.064,.075),(.058,.069),(.047,.055),(.046,.048),(.049,.051)]
        lean=(.025*S(index*1.3)+.01)*side if index else 0
        path=[(px,py+lean*j/(len(path)-1),pz) for j,(px,py,pz) in enumerate(path)]
        f=(x+side*.023,.008+lean,0)
    part.tube(path,sizes,pants,16,True)
    x,y,z=f
    # A shaped welt and toebox prevent the lower silhouette reading as a peg.
    part.ring_body([(z+.007,x,y-.042,.052,.116),(z+.022,x,y-.043,.054,.119),
                    (z+.030,x,y-.043,.055,.117)],'373936',20,squash=.78)
    part.ring_body([(z+.028,x,y-.043,.053,.115),(z+.046,x,y-.051,.053,.110),
                    (z+.061,x,y-.031,.052,.093),(z+.080,x,y+.004,.047,.066),
                    (z+.103,x,y+.015,.044,.055)],shoe,20,squash=.82)
    for k in range(3):
        part.tube([(x-.024,y-.057+k*.014,z+.073+k*.007),(x,y-.065+k*.014,z+.077+k*.007),
                   (x+.022,y-.050+k*.014,z+.073+k*.007)],.0024,'8a8276',6)


def make_arm(part, sign, data, index, seated, prop=False):
    off=-.791 if seated else 0
    top=Vector((sign*.179,.005,1.335+off))
    if seated and sign>0:
        elbow=Vector((sign*.246,-.109,.317));wrist=Vector((.205,-.328,.385))
    elif seated:
        elbow=Vector((sign*.246,-.075,.316));wrist=Vector((sign*.128,-.291,.196))
    elif index==0 and sign<0:
        elbow=Vector((-.238,-.053,1.046));wrist=Vector((-.203,-.238,1.192))
    elif index in (1,2) and sign==(-1 if index==1 else 1):
        elbow=Vector((sign*.236,-.038,1.043));wrist=Vector((sign*.115,-.222,1.095))
    elif index in (3,4,5,7) and sign<0:
        elbow=Vector((sign*.252,-.004,1.072));wrist=Vector((sign*.139,-.099,.990))
    else:
        elbow=Vector((sign*.219,.018,1.050));wrist=Vector((sign*.231,-.033,.835+(.014 if sign>0 else 0)))
    cloth='475956' if index==0 else data['fabric']
    if data['outfit']=='vest': cloth=data['trim']
    pts=[top,top.lerp(elbow,.17)+Vector((sign*.011,0,.002)),top.lerp(elbow,.46),
         top.lerp(elbow,.88),elbow,elbow.lerp(wrist,.22),elbow.lerp(wrist,.58),
         elbow.lerp(wrist,.88),wrist]
    sizes=[(.059,.072),(.068,.071),(.060,.063),(.048,.052),(.052,.055),
           (.050,.056),(.043,.046),(.034,.039),(.034,.038)]
    # The cap is cross-cut in horizontal slices. That keeps the acromion low
    # even when a sleeve turns sharply at its attachment to the torso.
    cap=[(1.364,.153,.023,.018),(1.357,.157,.044,.040),(1.346,.163,.054,.053),
         (1.331,.171,.060,.061),(1.313,.179,.064,.066)]
    count=22
    sleeve=[[(sign*cx+rx*C(TAU*k/count),.003-ry*S(TAU*k/count),h+off)
             for k in range(count)] for h,cx,rx,ry in cap]
    # Stitch the top and sleeve as one continuous skin. Intersecting a capped
    # cylinder with a deltoid would leave a dark mechanical joint at native size.
    cutoff=4 if data['outfit']=='tee' else len(pts)
    for j in range(1,cutoff):
        center=pts[j];rx,ry=sizes[j]
        tangent=(pts[min(j+1,len(pts)-1)]-pts[j-1]).normalized()
        side=(Vector((1,0,0))-tangent*tangent.x).normalized()
        depth=tangent.cross(side)
        ring=[]
        for k in range(count):
            a=TAU*k/count
            fold=1+.030*C(5*a+.25*j)+.017*S(7*a-.6*j)
            ring.append(tuple(center+fold*(side*rx*C(a)+depth*ry*S(a))))
        sleeve.append(ring)
    part.loft(sleeve,cloth)
    skin=complexions[data['complexion']]
    if data['outfit']=='tee':
        part.tube(pts[3:],[(.040,.046),(.040,.042),(.041,.045),(.033,.040),(.026,.032),(.024,.030)],skin,14)
    else:
        part.tube([pts[-2].lerp(wrist,.50),wrist],[(.0355,.039),(.035,.038)],
                  data['trim'] if index in (0,3,7) else cloth,14,True)
    vec=(wrist-elbow).normalized()
    if seated or (index==0 and sign<0):
        # Fingertips curl around the handle or remote, the thumb closes the grip.
        anchor=wrist+vec*.060
        part.tube([wrist,wrist+vec*.027,anchor],[.024,(.033,.020),(.031,.018)],skin,12)
        for j in range(4):
            start=anchor+Vector(((j-1.5)*.014,0,0))
            part.tube([start,start+vec*(.021+.005*(j%3)),start+vec*.023+Vector((0,.008,-.012))],
                      [.009,.008,.005],skin,8)
        part.tube([wrist+vec*.025,anchor+Vector((-sign*.027,-.004,0)),anchor+Vector((-sign*.018,-.018,.002))],
                  [.011,.01,.006],skin,9)
    else:
        anchor=wrist+vec*.057
        part.tube([wrist,wrist+vec*.029,anchor,anchor+vec*.022],
                  [(.023,.023),(.028,.023),(.030,.018),(.026,.016)],skin,12)
        for j in range(4):
            start=anchor+vec*.015+Vector(((j-1.5)*.012,0,0));length=[.048,.056,.053,.040][j]
            part.tube([start,start+vec*length*.65,start+vec*length+Vector((0,-.004,0))],
                      [.0078,.0067,.0045],skin,7)
        part.tube([wrist+vec*.032,anchor+Vector((-sign*.029,-.014,.012)),
                   anchor+Vector((-sign*.028,-.019,-.015))],[.011,.009,.006],skin,8)
    return wrist+vec*.052


def remote(part, p):
    x,y,z=p
    # The horizontal nose of the remote points forward from the couch.
    part.ring_body([(z-.009,x,y-.022,.020,.072),(z-.004,x,y-.023,.022,.075),
                    (z+.007,x,y-.023,.022,.074),(z+.012,x,y-.023,.019,.070)],
                   '303c3e',16,squash=.44)
    for j in range(4):
        for k in (-1,1):
            part.ovoid((x+k*.008,y-.059+j*.019,z+.014),(.0043,.0053,.0020),'a38565' if j==0 else 'a4a79c',8)


def cafe_object(part, hand, index):
    """Held objects register a guest's activity before the talk prompt appears."""
    x,y,z=hand
    if index in (3,7):
        # A cloth-spined sketchbook held against the thumb, with exposed paper.
        x+=.014;y-=.017
        for depth,coat in [(0,'9d9a8a'),(-.004,'d0c8ad'),(-.015,'52625f')]:
            part.patch([(x-.050,y+depth,z+.092),(x+.068,y+depth,z+.086),
                        (x+.064,y+depth-.004,z-.071),(x-.055,y+depth-.004,z-.066)],coat)
        part.tube([(x-.051,y-.010,z+.091),(x-.055,y-.014,z-.065)],.003,'483f38',7)
        return
    x+=.031 if index==2 else -.028;y-=.031;z-=.035
    metal=index==2
    ceramic='8f9d98' if metal else ('d9cdb1' if index==1 else '596c6a')
    radii=[(.0,.021),(.008,.024),(.059,.037),(.080,.038),(.0805,.033),(.073,.032)]
    if metal:radii=[(.0,.032),(.007,.035),(.071,.038),(.088,.045),(.089,.042),(.083,.039)]
    part.ring_body([(z+h,x,y,r,r) for h,r in radii],ceramic,24)
    part.ring_body([(z+.069,x,y,.032,.032),(z+.072,x,y,.032,.032)],'372a24',20)
    direction=1 if index!=2 else -1
    part.tube([(x+.032*direction,y,z+.060),(x+.050*direction,y,z+.062),
               (x+.055*direction,y,z+.050),(x+.051*direction,y,z+.030),
               (x+.032*direction,y,z+.024)],.0041,ceramic,8)


def parasol(part,p):
    px,py,pz=p
    center=Vector((-.119,.035,1.985))
    part.tube([(px,py,pz-.025),(px,py,pz+.096),center],.0063,'9aa5a0',8)
    part.tube([(px+.026,py,pz-.069),(px+.014,py,pz-.080),(px,py,pz-.067),(px,py,pz+.030)],
              [.011,.013,.013,.012],'70523b',8)
    ribs=10
    def canopy(k,t,u):
        a=TAU*(k+u)/ribs
        scallop=S(math.pi*u)*t*t
        r=.518*t*(1-.054*scallop)
        return (center.x+r*C(a),center.y+r*S(a),center.z-.012-.149*t*t-.044*t-.004*scallop)
    for k in range(ribs):
        points=[canopy(k,.008+.992*j/5,h/5) for j in range(6) for h in range(6)]
        polys=[(j*6+h,(j+1)*6+h,(j+1)*6+h+1,j*6+h+1) for j in range(5) for h in range(5)]
        part.add(points,polys,'436060' if k%2 else '3c5759')
        part.tube([canopy(k,t,0) for t in (.015,.25,.50,.75,1)],.0029,'8c9d93',6)
        part.tube([canopy(k,1,h/7) for h in range(8)],.0038,'9b987f',6)
    part.ovoid(center,(.012,.012,.018),'8b846b',9)


def figure(index,seated=False):
    data=ROSTER[index];name='PlayerSeated' if seated else data['id']
    scale=heights[index]/1.715;off=-.791 if seated else 0
    coll=bpy.data.collections.new(name+' — '+data['name'])
    scene.collection.children.link(coll)
    root=empty(name,coll)
    root['height_metres']=heights[index]
    root['source_portrait']=data['portrait'] or 'Original visitor'
    legs=.12 if seated else .945
    chin=1.465+off
    pivots={'Body':(0,0,0),'Head':(0,0,chin-.019),'ArmL':(.179,.005,1.335+off),
            'ArmR':(-.179,.005,1.335+off),'LegL':(.089,0,legs),'LegR':(-.089,0,legs)}
    nodes={};parts={}
    for key,piv in pivots.items():
        nodes[key]=empty(name+'_'+key,coll,root,Vector(piv)*scale)
        parts[key]=Surface(name+' '+key,coll,piv,scale)
    face=Surface(name+' portrait',coll,pivots['Head'],scale,face_mat)
    make_head(parts['Head'],face,data,index,chin)
    if face.verts:face.finish(nodes['Head'])
    make_body(parts['Body'],data,index,off)
    for sign,side in [(1,'L'),(-1,'R')]:
        make_leg(parts['Leg'+side],sign,data,index,seated)
        hand=make_arm(parts['Arm'+side],sign,data,index,seated)
        if index in (1,2,3,4,7) and sign==(1 if index==2 else -1):
            cafe_object(parts['Arm'+side],hand,index)
        if index==0 and (sign==1 or not seated):
            accessory='Remote' if sign==1 else 'Umbrella'
            node=empty(name+'_'+accessory,coll,nodes['Arm'+side])
            surface=Surface(name+' '+accessory,coll,pivots['Arm'+side],scale)
            (remote if sign==1 else parasol)(surface,hand)
            surface.finish(node)
    for k,part in parts.items():part.finish(nodes[k])
    return root


def configure_view(point,distance):
    scene.render.engine='BLENDER_WORKBENCH'
    shading=scene.display.shading;shading.color_type='VERTEX';shading.light='STUDIO'
    shading.show_shadows=True;shading.show_cavity=True;shading.cavity_type='WORLD'
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            sp=area.spaces.active;sp.shading.color_type='VERTEX';sp.overlay.show_overlays=False
            sp.region_3d.view_location=point;sp.region_3d.view_distance=distance
            sp.region_3d.view_rotation=Vector((0,1,-.07)).to_track_quat('-Z','Y')


def export(name):
    bpy.ops.export_scene.gltf(filepath=str(GAME/(name+'.glb')),export_format='GLB',
        export_yup=True,export_animations=False,export_lights=False,export_cameras=False,
        export_attributes=False,export_all_vertex_colors=True,export_image_format='AUTO')


roots=[figure(i) for i in range(8)]+[figure(0,True)]
for i,o in enumerate(roots):o.location=((i-4)*.85,0,.495 if i==8 else 0)
configure_view((0,0,1.02),7.4)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'Residents.blend'),compress=True)
for o in roots:o.location=(0,0,0)
export('people')
