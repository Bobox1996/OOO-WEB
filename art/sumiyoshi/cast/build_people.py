"""Original OOO avatars for the Sumiyoshi street. Blender 5.3, background mode.
Edit roster.json and run blender -b --python build_people.py. Coordinates below
are Blender metres: +X along the street, -Y in front, +Z up."""
from math import cos, sin, pi, sqrt, radians, exp
from pathlib import Path
import json

import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
WEB = OUT.parents[2] / "public/sumiyoshi/models"
WEB.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
TAU = 2 * pi
palette = {}
active_part = None
active_collection = None
alpha_mat = None


def linear(s):
    v = int(s, 16) / 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4


def paint(hex_code):
    if hex_code in palette:
        return palette[hex_code]
    mat = bpy.data.materials.new(hex_code)
    col = tuple(linear(hex_code[i:i+2]) for i in (0, 2, 4)) + (1,)
    mat.diffuse_color = col
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = col
    bs.inputs["Roughness"].default_value = .68
    palette[hex_code] = mat
    return mat


def obj(name, mesh=None):
    o = bpy.data.objects.new(name, mesh)
    active_collection.objects.link(o)
    return o


def shape(name, verts, faces, color, smooth=True):
    geo = bpy.data.meshes.new(name)
    geo.from_pydata(verts, [], faces)
    geo.update()
    o = obj(name, geo)
    o.parent = active_part
    # Shapes are authored at figure-local coordinates and grouped about pivots.
    o.location = -active_part.location
    o.data.materials.append(paint(color) if isinstance(color, str) else color)
    for p in geo.polygons:
        p.use_smooth = smooth
    return o


def rings(name, rows, color, caps=True, smooth=True):
    n = len(rows[0])
    faces = []
    for j in range(len(rows)-1):
        for i in range(n):
            k = (i+1) % n
            faces.append((j*n+i, j*n+k, (j+1)*n+k, (j+1)*n+i))
    if caps:
        faces.extend((tuple(reversed(range(n))), tuple((len(rows)-1)*n+i for i in range(n))))
    return shape(name, [p for ring in rows for p in ring], faces, color, smooth)


def profile(name, loc, levels, color, n=22):
    x,y,z = loc
    rows = [[(x+rx*cos(TAU*i/n), y+ry*sin(TAU*i/n), z+dz)
             for i in range(n)] for dz,rx,ry in levels]
    return rings(name, rows, color)


def oval(name, p, sizes, color, n=18, m=10, tilt=0):
    x,y,z = p
    rx,ry,rz = sizes
    rows=[]
    for j in range(m+1):
        a = -pi/2+.033+(pi-.066)*j/m
        row=[]
        for i in range(n):
            ang=TAU*i/n
            dx=rx*cos(a)*cos(ang)
            dz=rz*sin(a)
            row.append((x+dx*cos(tilt)+dz*sin(tilt), y+ry*cos(a)*sin(ang),
                        z-dx*sin(tilt)+dz*cos(tilt)))
        rows.append(row)
    return rings(name, rows, color)


def tube(name, coords, radius, color, sides=8):
    pts=[Vector(p) for p in coords]
    radii = [radius]*len(pts) if isinstance(radius, (float,int)) else radius
    rows=[]
    prev=None
    for i,p in enumerate(pts):
        axis=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        if prev is None:
            ref=Vector((0,0,1)) if abs(axis.z)<.85 else Vector((0,1,0))
            side=axis.cross(ref).normalized()
        else:
            side=(prev-axis*prev.dot(axis)).normalized()
        other=axis.cross(side)
        rows.append([tuple(p+radii[i]*(side*cos(TAU*j/sides)+other*sin(TAU*j/sides))) for j in range(sides)])
        prev=side
    return rings(name, rows, color)


def rounded_label(name, center, width, height, radius, depth, color):
    x,y,z=center
    outline=[]
    for dx,dz,base in [(width/2-radius,height/2-radius,0),(-width/2+radius,height/2-radius,90),
                       (-width/2+radius,-height/2+radius,180),(width/2-radius,-height/2+radius,270)]:
        for j in range(4):
            a=radians(base+j*30)
            outline.append((x+dx+radius*cos(a), z+dz+radius*sin(a)))
    n=len(outline)
    verts=[(a,y+d,b) for d in (depth/2,-depth/2) for a,b in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return shape(name,verts,faces,color,False)

INK="352F31"
PAPER="FFF2CD"
TAU=2*pi
SKINS={"biscuit":("EDBD98","D9957D"),"apricot":("E5AD8B","CF8D74"),"honey":("D8A17E","C4866E")}
HAIR={"umber":("493A37","62504A"),"ink":("323238","49494D"),"cocoa":("4A3D37","68544B"),"ash":("B5B3A4","CBC9B9")}
# The wide, flattened facial plane carries the graphic eyes and cheeks.
HEAD=[(.70,.052,.055),(.718,.139,.116),(.767,.236,.190),(.832,.298,.233),
      (.914,.335,.267),(1.015,.347,.283),(1.11,.342,.289),(1.198,.314,.269),
      (1.274,.258,.222),(1.328,.158,.136),(1.358,.024,.022)]
parts={}

def group(root,key):
    global active_part
    active_part=parts[root.name][key]

def front_y(x,z):
    for j in range(1,len(HEAD)):
        z0,rx0,ry0=HEAD[j-1]
        z1,rx1,ry1=HEAD[j]
        if z<=z1:
            t=min(1,max(0,(z-z0)/(z1-z0)))
            rx=rx0+(rx1-rx0)*t
            ry=ry0+(ry1-ry0)*t
            return -ry*sqrt(max(.025,1-(x/rx)**2))
    return -.02

def decal(name,contour,color,offset=.003):
    area=sum(a*d-c*b for (a,b),(c,d) in zip(contour,contour[1:]+contour[:1]))
    if area<0:contour=list(reversed(contour))
    x=sum(p[0] for p in contour)/len(contour)
    z=sum(p[1] for p in contour)/len(contour)
    pts=[(x,front_y(x,z)-offset,z)]
    faces=[];count=len(contour)
    # Follow the cheek curvature across the graphic, especially near the temples.
    # A single flat triangle fan can disappear into the rounded facial shell.
    for j,fraction in enumerate((.34,.67,1.0)):
        start=len(pts)
        for a,b in contour:
            px=x+(a-x)*fraction;pz=z+(b-z)*fraction
            pts.append((px,front_y(px,pz)-offset,pz))
        for k in range(count):
            nxt=(k+1)%count
            if j==0:faces.append((0,start+k,start+nxt))
            else:faces.append((start-count+k,start+k,start+nxt,start-count+nxt))
    return shape(name,pts,faces,color,True)

def ellipse(name,x,z,rx,rz,color,offset=.003,tilt=0):
    ring=[]
    for i in range(26):
        a=TAU*i/26;dx=rx*cos(a);dz=rz*sin(a)
        ring.append((x+dx*cos(tilt)-dz*sin(tilt),z+dx*sin(tilt)+dz*cos(tilt)))
    return decal(name,ring,color,offset)

def inkstroke(name,points,t,color,offset=.009):
    line=[(x,front_y(x,z)-offset,z) for x,z in points]
    return tube(name,line,t,color,8)

def glasses(r):
    thick=r["glasses"]=="square"
    colour="38393B" if thick else "887A6A"
    t=.009 if thick else .005
    for sign in (-1,1):
        cx=.139*sign
        pts=[]
        for i in range(33):
            a=i*TAU/32
            cp=cos(a);sp=sin(a)
            x=cx+.092*(1 if cp>=0 else -1)*abs(cp)**.6
            z=1.009+.063*(1 if sp>=0 else -1)*abs(sp)**.6
            pts.append((x,front_y(x,z)-.022,z))
        tube("Acetate frame" if thick else "Wire frame",pts,t,colour,8)
        tube("Hinged temple",[(.228*sign,-.236,1.026),(.278*sign,-.192,1.031),
             (.327*sign,-.095,1.024),(.344*sign,-.023,1.012)],t*.72,colour,8)
        oval("Hinge pin",(.226*sign,-.238,1.032),(.0065,.004,.005),"CEAE79",9,6)
    inkstroke("Bridge",[(-.048,1.025),(-.028,1.034),(0,1.037),(.028,1.034),(.048,1.025)],t,colour,.027)

def face(r):
    skin,shadow=SKINS[r["complexion"]];hair,glint=HAIR[r["hairColor"]]
    profile("Peach round face",(0,0,0),HEAD,skin,48)
    for side in (-1,1):
        oval("Round ear",(side*.331,-.01,.952),(.063,.042,.074),skin,18,9,tilt=side*.20)
        oval("Ear inner",(side*.358,-.041,.953),(.028,.008,.043),shadow,14,7,tilt=side*.22)
        x=.142*side;z=1.014
        eye=r["eyes"]
        w={"oval":.046,"soft":.054,"almond":.062,"level":.058}[eye]
        h={"oval":.075,"soft":.063,"almond":.052,"level":.051}[eye]
        contour=[]
        for j in range(32):
            a=TAU*j/32
            dx=w*cos(a)
            dz=h*sin(a)*(1-.24*abs(cos(a)) if eye in ("almond","soft") else 1)
            if eye=="level" and dz>.020: dz=.020+(dz-.020)*.4
            dz+=(dx*side)*(.13 if eye in ("almond","soft") else .03)
            contour.append((x+dx,z+dz))
        decal("Printed eye shape",contour,INK,.006)
        ellipse("Warm ink iris",x+.001,z-.013,w*.53,h*.50,"554943",.010)
        ellipse("Eye catchlight",x-.011,z+.017,.012,.014,PAPER,.014)
        if eye in ("soft","almond"):
            inkstroke("Outer lash",[(x+.038*side,z+.020),(x+.055*side,z+.027),(x+.065*side,z+.034)],
                      [.007,.005,.002],INK,.010)
        brow=.115 if eye=="oval" else .089
        inkstroke("Brush eyebrow",[(x-.049*side,z+brow-.006),(x-.012*side,z+brow+.005),
                  (x+.026*side,z+brow+.005),(x+.045*side,z+brow-.002)],
                  [.003,.007,.006,.002],hair,.005)
        if r["cheeks"]!="none":
            muted=r["cheeks"]=="muted"
            cx=.234*side
            ellipse("Soft powder edge",cx,.922,.056,.025,
                    "E5A68C" if muted else "E4A08B",.0045,side*.04)
            ellipse("Powder centre",cx,.922,.045,.018,
                    "E4A28A" if muted else "DF9885",.007,side*.04)
    nose=r["nose"]
    if nose=="kite":
        coords=[(-.044,.949),(-.025,.959),(.031,.955),(.044,.943),(.012,.917),(-.008,.913)]
    elif nose=="short":
        coords=[(-.039,.945),(-.025,.953),(.023,.953),(.036,.946),(.009,.925),(-.006,.925)]
    else:
        coords=[(-.034,.945),(-.022,.957),(.016,.959),(.034,.950),(.033,.932),(.015,.923),(-.010,.919),(-.030,.930)]
    decal("Gouache nose",coords,shadow,.009)
    inkstroke("Nose upper light",[(a,.95+.004*cos(a*70)) for a in (-.018,-.010,0,.010)],.003,"EDB294",.012)
    mouth=r["mouth"]
    if mouth=="smile":
        decal("Open smile",[(-.063,.874),(-.031,.868),(0,.866),(.031,.869),(.061,.879),(.045,.858),
              (.021,.846),(-.007,.842),(-.036,.849),(-.050,.860)],"86504A",.009)
        inkstroke("Warm smile highlight",[(-.021,.850),(0,.847),(.021,.851)],.003,"E19A87",.012)
    else:
        depth=.009 if mouth=="quiet" else .020
        inkstroke("Painted mouth",[(-.051,.867),(-.033,.866-depth*.40),(0,.866-depth),
                  (.029,.866-depth*.53),(.052,.871)], [.003,.006,.0065,.005,.002],"88594F",.009)
    if r["glasses"]!="none":glasses(r)

def lock(name,curve,widths,thickness,color):
    """A tapered polygon-combed lock, oriented across its descending or swept centreline."""
    rows=[];pts=[Vector(x) for x in curve]
    for j,p in enumerate(pts):
        d=(pts[min(len(pts)-1,j+1)]-pts[max(0,j-1)]).normalized()
        side=Vector((d.z,0,-d.x))
        if side.length<.015:side=Vector((1,0,0))
        side.normalize()
        normal=d.cross(side).normalized()
        rows.append([tuple(p+side*widths[j]*cos(TAU*k/12)+normal*thickness*(.18+.82*widths[j]/max(widths))*sin(TAU*k/12)) for k in range(12)])
    return rings(name,rows,color)

def hairdo(r):
    style=r["hair"];colour,light=HAIR[r["hairColor"]]
    n=48;rows=[]
    for layer in range(15):
        ring=[]
        for i in range(n):
            a=TAU*i/n;front=max(0,-sin(a))
            end=2.22-.98*front**1.8
            if style in ("blunt","page","wing"):end+=.13*(1-front)
            if style=="brush":end=1.93-.95*front**1.25+.065*cos(7*a)
            if style in ("quiff","broken"):end-=.16*(1-front)
            if style=="curtain":end+=.08*(1-front)
            if style=="page" and sin(a)>0:end+=.085*cos(8*a+.5)*sin(a)
            phi=end*(1-layer/14)+.018*layer/14
            ring.append((.378*sin(phi)*cos(a),.331*sin(phi)*sin(a)+.003,1.050+.360*cos(phi)))
        rows.append(ring)
    rings("Single sculpted cap",rows,colour,caps=False)
    # Hair follows a part instead of duplicating egg-shaped bangs.
    for k in range(11):
        a=-pi+.27*k
        line=[]
        for j in range(7):
            u=j/6;phi=.22+.75*u+.04*cos(k)
            theta=a+.30*(1-u)
            line.append((.3785*sin(phi)*cos(theta),.3315*sin(phi)*sin(theta)+.003,1.050+.3605*cos(phi)))
        tube("Combed hair line",line,[.001,.002,.003,.003,.003,.002,.001],light,6)
    if style=="page":
        # The camera follows the player from behind. Broad shallow ribbons follow
        # a side whorl down toward the nape, fading into the same coloured cap.
        for k in range(11):
            a=.10+k*(pi-.18)/10
            layers=[];accent="53433F" if k%3 else "5B4943"
            end=2.32+.067*cos(a*8+.5)-.04*(k%3)
            for i in range(14):
                u=i/13
                phi=.29+(end-.29)*u
                angle=a+.32*(1-u)**2-.084*sin(u*pi*1.38+k*.22)
                width=.001+.068*sin(pi*u)**.68
                row=[]
                for j in range(5):
                    v=(j-2)/2
                    ang=angle+v*width
                    h=.0015+.0065*sin(pi*u)*(1-v*v)
                    row.append(((.378+h)*sin(phi)*cos(ang),
                             .003+(.331+h)*sin(phi)*sin(ang),1.05+(.360+h)*cos(phi)))
                layers.extend(row)
            polys=[(i*5+j,i*5+j+1,(i+1)*5+j+1,(i+1)*5+j) for i in range(13) for j in range(4)]
            shape("Satin nape lock",layers,polys,accent)
    if style in ("ripple","blunt","wing","curtain","page"):
        low={"ripple":.571,"blunt":.831,"wing":.835,"curtain":.867,"page":.907}[style]
        for side in (-1,1):
            for j in range(4):
                f=j/3;x0=side*(.204+.085*f);tip=low+.03*j
                if style=="ripple":tip+=.116 if side==1 else 0
                dx=.025 if style=="ripple" else -.020
                pts=[(x0,.067+.09*f,1.213),(side*.288,.045+.1*f,1.099),
                     (side*(.315+.009*f),.035+.11*f,.957),
                     (side*(.314+dx),.047+.11*f,(tip+.957)/2),
                     (side*((.198 if style=="ripple" else .264)+dx+.018*cos(j)),.028+.11*f,tip)]
                lock("Long curl" if style=="ripple" else "Rounded bob panel",pts,
                     [.035,.071,.071,.068,.012],.046,colour)
            if style=="ripple":
                lock("Hair sweeping over shoulder",[(side*.25,-.103,1.17),(side*.314,-.086,1.04),
                     (side*.305,-.100,.88),(side*.268,-.123,.76),(side*.194,-.119,low+.006)],
                     [.035,.046,.055,.047,.011],.035,colour)
            if style in ("blunt","wing"):
                # These two cuts sit in front of the ears. The blunt one cups the jaw,
                # while the winged cut lifts the tails to reveal its square glasses.
                stop=.803 if style=="blunt" else .857
                lock("Face framing temple",[(side*.23,-.162,1.217),(side*.300,-.153,1.117),
                     (side*.334,-.134,1.002),(side*.325,-.132,stop+.046),(side*.276,-.144,stop)],
                     [.031,.055,.058,.049,.015],.032,colour)
    styles={
      "page":[(-.84,-.91,.99),(-.38,-.52,1.086),(.02,-.19,1.107),(.45,.00,1.132),(.89,.32,1.142)],
      "ripple":[(-.21,-.93,1.005),(-.12,-.76,1.095),(.12,.82,1.11),(.24,1.00,1.034)],
      "blunt":[(-.77,-.91,1.077),(-.51,-.62,1.104),(-.29,-.39,1.096),(-.075,-.13,1.119),(.13,.21,1.111),(.35,.45,1.093),(.67,.76,1.093),(.83,.9,1.05)],
      "quiff":[(-.11,-.86,1.07),(.25,-.68,1.15),(.47,-.46,1.18),(.64,-.15,1.192),(.65,.52,1.122),(.9,.91,1.08)],
      "broken":[(-.74,-.88,1.085),(-.39,-.60,1.057),(-.16,-.31,1.107),(.11,.015,1.086),(.28,.36,1.062),(.59,.52,1.123),(.75,.91,1.069)],
      "curtain":[(-.05,-.59,1.104),(-.18,-.89,.999),(-.33,-.97,.965),(.06,.59,1.108),(.18,.86,1.025),(.32,.96,.962)],
      "brush":[],
      "wing":[(-.11,-.61,1.14),(-.19,-.86,1.057),(-.32,-.95,.973),(.03,.26,1.15),(.15,.63,1.112),(.27,.91,1.021)]}
    for k,(a,b,z) in enumerate(styles[style]):
        xs=[.30*a,.30*(.72*a+.28*b),.30*(.35*a+.65*b),.30*b]
        zz=[1.317+.014*cos(k),1.272+.013*cos(k),z+(1.27-z)*.48,z]
        pp=[(x,.004-.330*sqrt(max(.012,1-(x/.378)**2-((h-1.05)/.360)**2)),h) for x,h in zip(xs,zz)]
        w=.070 if style in ("quiff","page","curtain","ripple") else .051
        lock("Swept fringe",pp,[.010,w,w*.84,.004],.016,colour)
    if style in ("brush","broken","quiff"):
        total={"brush":19,"broken":8,"quiff":5}[style]
        for k in range(total):
            a=k*2.40;x=.19*cos(a)*(1-.23*(k%3));y=.15*sin(a)
            h=1.05+.352*sqrt(max(.1,1-(x/.378)**2-(y/.331)**2))-.013
            burst=.039 if style=="brush" else .010
            dx=.062*cos(a)+(-.044 if style in ("quiff","brush") else 0)
            lock("Lifted crown tip",[(x,y,h),(x+dx*.22,y+.006,h+.026),
                 (x+dx*.65,y+.017,h+.045),(x+dx,y+.029,h+.044+burst+.021*sin(k))],
                 [.033,.037,.021,.002],.019,colour if k%4 else light)
    if style=="brush":
        for k in range(19):
            a=-pi+k*pi/18
            front=-sin(a)
            phi=1.87-.88*front
            def hairpoint(az,angle,extra):
                return ((.379+extra)*sin(angle)*cos(az),(.332+extra)*sin(angle)*sin(az)+.003,
                        1.050+(.361+extra)*cos(angle))
            line=[hairpoint(a,phi-.015,.000),hairpoint(a+.036,phi-.17,.014),
                  hairpoint(a+.09,phi-.35,.026),hairpoint(a+.17,phi-.52,.051+.022*sin(k*3))]
            lock("Uplifted silver brushstroke",line,[.019,.035,.031,.002],.020,colour if k%4 else light)
        for sign in (-1,1):
            for k in range(5):
                h=1.206+.034*k
                x=sign*(.312-.031*k)
                lock("Windblown side wisp",[(x,-.041,h-.047),(x+sign*.03,-.046,h-.015),
                     (x+sign*.064,-.034,h+.016),(x+sign*.091,-.02,h+.036)],
                     [.021,.029,.018,.001],.017,colour if k%3 else light)

def body(root,r,seated):
    group(root,"Body")
    top,trim,pants,shoe=(r[k] for k in ("fabric","trim","slacks","shoes"))
    skin=SKINS[r["complexion"]][0];style=r["outfit"]
    profile("Small neck",(0,0,.660),[(0,.063,.061),(.097,.071,.065)],skin,20)
    profile("Trouser seat",(0,.006,.268),[(0,.095,.090),(.025,.143,.110),(.094,.148,.108),(.14,.130,.103)],pants)
    garment=top
    profile("Tailored garment",(0,.002,.320),[(0,.176,.113),(.016,.181,.120),(.055,.175,.119),(.185,.156,.112),
                (.285,.184,.114),(.339,.166,.103),(.375,.082,.079)],garment,30)
    if style in ("crew","stripe","tee","highneck","vest","smock"):
        h=.04 if style in ("highneck","vest") else .014
        profile("Neck binding",(0,.0,.675),[(0,.093,.084),(h,.083,.073)],trim if style in ("crew","stripe","tee","vest") else top,24)
    if style=="stripe":
        for i in range(4):
            z=.379+i*.055
            rx=[.176,.168,.161,.170][i]; ry=[.12,.119,.115,.115][i]
            profile("Horizontal knitted stripe",(0,.002,z),[(0,rx,ry),(.018,rx,ry)],trim,28)
    if style in ("collarless","smock","denim"):
        tube("Button placket",[(.006,-.089,.675),(.008,-.114,.581),(.008,-.113,.468),(.007,-.12,.356)],
             .004,trim,8)
        for j in range(4):
            z=.393+j*.066
            oval("Pearl snap",(.009,-.12+(j%3)*.002,z),(.006,.003,.007),"B6AA94",10,6)
    if style=="denim":
        for sign in (-1,1):
            coords=[(.025*sign,-.096,.689),(.087*sign,-.082,.690),(.146*sign,-.076,.632),(.087*sign,-.107,.615),(.055*sign,-.109,.649)]
            shape("Folded work shirt collar",coords,[(0,4,3),(0,3,2),(0,2,1)] if sign>0 else [(0,3,4),(0,2,3),(0,1,2)],trim)
            rounded_label("Patch pocket",(.104*sign,-.085,.508),.075,.065,.008,.009,top)
            tube("Pocket bar tack",[(.069*sign,-.103,.530),(.131*sign,-.076,.530)],.003,trim,6)
    if style=="vest":
        v=[(-.076,-.089,.684),(.076,-.089,.684),(.034,-.116,.601),(0,-.123,.554),(-.034,-.116,.601)]
        shape("Dark sweater neckline",v,[(0,4,3),(0,3,1),(1,3,2)],trim)
        for sign in (-1,1):
            coords=[(.077*sign,-.070,.682),(.148*sign,-.047,.659),(.167*sign,-.030,.595),
                    (.171*sign,-.044,.348),(.034*sign,-.120,.33),(.012*sign,-.124,.391),(.016*sign,-.113,.558)]
            centre=tuple(sum(v[i] for v in coords)/len(coords) for i in range(3))
            shape("Tweed vest front",[centre,*coords],[(0,1+(j+1)%len(coords),1+j) if sign>0 else
                  (0,1+j,1+(j+1)%len(coords)) for j in range(len(coords))],top)
            # Sparse alternating needlework reads as wool at conversation distance.
            for j in range(4):
                for k in range(3):
                    x=(.038+k*.038+.009*(j%2))*sign;z=.38+j*.054
                    y=-.126+.044*(abs(x)/.15)**2
                    tube("Woven fleck",[(x,y,z),(x+.008*sign,y+.002,z+.013)],.0019,trim,5)
        for j in range(3):
            oval("Walnut button",(.023,-.13,.405+j*.062),(.007,.005,.008),"5C5144",10,6)
    if style=="highneck":
        for sign in (-1,1):
            tube("Raglan seam",[(sign*.072,-.061,.687),(sign*.118,-.095,.616),(sign*.15,-.087,.576)],.003,trim)
    for sign,limb in [(1,"L"),(-1,"R")]:
        group(root,"Arm"+limb)
        active=(r["id"]=="Player" and sign==1)
        if seated and active:
            coords=[(sign*.151,0,.610),(sign*.190,-.005,.593),(sign*.225,-.068,.519),(sign*.222,-.156,.506),(sign*.189,-.219,.554)]
        elif seated:
            coords=[(sign*.151,0,.610),(sign*.190,-.005,.593),(sign*.220,-.065,.484),(sign*.213,-.123,.458),(sign*.16,-.195,.425)]
        elif r["id"]=="Player" and sign<0:
            coords=[(-.154,0,.610),(-.183,-.002,.59),(-.215,-.03,.527),(-.229,-.105,.520),(-.229,-.153,.551)]
        else:
            coords=[(sign*.150,0,.61),(sign*.181,-.002,.582),(sign*.210,-.011,.50),
                    (sign*.217,-.026,.436),(sign*.231,-.046,.394)]
        last=Vector(coords[-1]);pre=Vector(coords[-2]);unit=(last-pre).normalized()
        sleeve=trim if style=="vest" else garment
        oval("Dropped shoulder",(sign*.154,0,.602),(.069,.072,.067),sleeve,16,8,tilt=-sign*.24)
        sleeve_end=coords[-2] if style=="tee" else coords[-1]
        if style=="tee":
            tube("T-shirt sleeve",coords[:3],[.064,.068,.060],garment,16)
            tube("Forearm",coords[2:],[.047,.046,.042],skin,14)
        else:
            tube("Sleeve",coords,[.067,.074,.062,.056,.049],sleeve,16)
            cuffcolour=trim if style in ("stripe","crew","highneck","vest") else garment
            tube("Cuff",[last-unit*.021,last],[.055,.052],cuffcolour,16)
        hand=last+unit*.031
        oval("Mitten palm",tuple(hand),(.052,.049,.057),skin,16,9,tilt=-sign*.20)
        oval("Thumb",(hand.x-sign*.035,hand.y-.024,hand.z+.009),(.021,.027,.026),skin,12,7)
        group(root,"Leg"+limb)
        x=sign*.087
        if seated:
            # The bent knee clears the cushion edge. The planted sole is 24 cm below the seat.
            points=[(x,.005,.340),(x,-.069,.349),(x,-.138,.353),(x,-.214,.344),
                    (x,-.232,.305),(x,-.224,.214),(x,-.218,.143)]
            tube("Bent trouser leg",points,[.074,.078,.079,.072,.061,.055,.054],pants,18)
            fy=-.234;fz=.079
        else:
            profile("Straight trouser leg",(x,0,.091),[(0,.059,.06),(.025,.064,.065),(.146,.072,.074),(.256,.078,.080)],pants,20)
            fy=-.008;fz=.045
        profile("Ankle sock",(x,fy,fz+.029),[(0,.050,.045),(.066,.054,.052)],trim,16)
        profile("Stitched sole",(x,fy-.029,fz-.035),[(0,.065,.095),(.012,.068,.100),(.022,.068,.098)],"A48E76",18)
        oval("Loafer",(x,fy-.032,fz+.014),(.069,.100,.047),shoe,18,9)
        tube("Vamp seam",[(x-.040,fy-.063,fz+.043),(x,fy-.084,fz+.054),(x+.040,fy-.063,fz+.043)],.004,"B59C84",7)

def remote(root,seated):
    group(root,"Remote")
    # A pocket remote with soft battery case, D pad, channel rocker and coral power button.
    x,y,z=(.181,-.271,.588) if seated else (.225,-.085,.393)
    rounded_label("Remote shell",(x,y,z),.075,.152,.016,.024,"3D484D")
    rounded_label("Remote face",(x,y-.015,z+.001),.064,.139,.012,.009,"637077")
    rounded_label("Broad channel rocker",(x,y-.022,z+.001),.044,.048,.012,.006,"CCD1B9")
    oval("Navigation key",(x,y-.027,z+.002),(.010,.003,.013),"657169",10,6)
    oval("Power key",(x-.013,y-.026,z+.045),(.009,.004,.009),"D3876F",12,6)
    for j in range(2):
        for k in range(2):
            oval("Rubber remote key",(x+(k-.5)*.025,y-.027,z-.033-j*.016),(.007,.004,.005),"BEB8A4",10,6)

PIVOTS={"Head":(0,0,.695),"Body":(0,0,0),"ArmL":(.155,0,.607),"ArmR":(-.155,0,.607),
        "LegL":(.088,0,.311),"LegR":(-.088,0,.311),"Remote":(.155,0,.607),"Umbrella":(-.155,0,.607)}
people=json.loads((OUT/"roster.json").read_text(encoding="utf8"))["people"]

def figure(r,i,seated=False):
    global active_collection
    name="PlayerSeated" if seated else r["id"]
    active_collection=bpy.data.collections.new(name+" | "+r["name"])
    scene.collection.children.link(active_collection)
    root=obj(name)
    root.empty_display_size=.20
    parts[name]={}
    for part,pivot in PIVOTS.items():
        if part in ("Remote","Umbrella") and r["id"]!="Player":continue
        if part=="Umbrella" and seated:continue
        node=obj(name+"_"+part)
        node.parent=root;node.location=pivot;node.empty_display_size=.025
        parts[name][part]=node
    root.location=((i%4-1.5)*1.4,i//4*2.1,0)
    group(root,"Head");face(r);hairdo(r)
    body(root,r,seated)
    if r["id"]=="Player":
        remote(root,seated)
        if not seated:umbrella(root)
    return root

def umbrella(root):
    group(root,"Umbrella")
    x=-.227;y=-.167
    # The pole leans back behind the face. Ribs and trimmed scallops catch wet-night lighting.
    cx=-.15;cy=.035
    tube("Brushed umbrella shaft",[(x,y,.569),(x,y,.735),(cx-.027,cy-.048,1.46),(cx,cy,1.689)],.009,"AFBBBE",10)
    tube("Curved umbrella handle",[(x+.032,y,.51),(x+.029,y,.492),(x+.012,y,.487),(x-.002,y,.499),
        (x,y,.529),(x,y,.621)],.015,"865E47",10)
    n=9;r=.551
    for k in range(n):
        a=TAU*k/n
        def pos(t,u):
            tangle=a+u*TAU/n
            scallop=sin(pi*u)*t*t
            rr=r*t*(1-.085*scallop)
            return (cx+rr*cos(tangle),cy+rr*sin(tangle),1.708-.158*t*t-.056*t-.019*scallop)
        facet=[]
        for v in range(6):
            for h in range(5):
                facet.append(pos(.014+.986*v/5,h/4))
        polys=[(j*5+i,j*5+i+1,(j+1)*5+i+1,(j+1)*5+i) for j in range(5) for i in range(4)]
        shape("Clear umbrella panel",facet,[tuple(reversed(f)) for f in polys],alpha_mat)
        tube("Steel canopy rib",[pos(t,0) for t in (.01,.22,.47,.75,1)],.0045,"ABBABC",6)
        tube("Rain binding",[pos(1,h/6) for h in range(7)],.007,"A2C4C2",7)
        ex,ey,ez=pos(1,0)
        oval("Rubber umbrella tip",(ex,ey,ez-.004),(.008,.008,.012),"D8C6A2",9,5)
        if k%2:
            for t,u in ((.64,.32),(.82,.61)):
                px,py,pz=pos(t,u)
                oval("Rain bead",(px,py,pz+.002),(.008,.011,.006),"CDDCD6",9,5)
    oval("Ferrule",(cx,cy,1.711),(.015,.015,.029),"937454",12,7)



def merge_draws(root, part, children, transparent=False):
    verts=[]; faces=[]; colors=[]; smooth=[]
    pivot=Vector(PIVOTS[part.name.split('_')[-1]])
    for source in children:
        col=tuple(source.data.materials[0].diffuse_color)
        offset=len(verts)
        verts.extend(tuple(v.co-pivot) for v in source.data.vertices)
        colors.extend([col]*len(source.data.vertices))
        for poly in source.data.polygons:
            faces.append([v+offset for v in poly.vertices]);smooth.append(poly.use_smooth)
    if not verts:return
    geo=bpy.data.meshes.new(part.name+("Canopy" if transparent else "Surface"))
    geo.from_pydata(verts,[],faces)
    geo.update()
    merged=bpy.data.objects.new(geo.name,geo)
    scene.collection.objects.link(merged)
    merged.parent=part
    if transparent:
        geo.materials.append(alpha_mat)
    else:
        geo.materials.append(runtime_material)
        attr=geo.color_attributes.new(name="Palette",type="BYTE_COLOR",domain="POINT")
        cl=[c for color in colors for c in color]
        attr.data.foreach_set("color",cl)
    for p,v in zip(geo.polygons,smooth):p.use_smooth=v
    return merged


alpha_mat=paint("B4D8E0").copy()
alpha_mat.name="Umbrella | smoked clear vinyl"
alpha_mat.diffuse_color=(*alpha_mat.diffuse_color[:3],.14)
bs=alpha_mat.node_tree.nodes.get("Principled BSDF")
bs.inputs["Alpha"].default_value=.14
bs.inputs["Roughness"].default_value=.23
alpha_mat.surface_render_method="BLENDED"
alpha_mat.use_backface_culling=False


roots=[figure(r,i) for i,r in enumerate(people)]+[figure(people[0],8,True)]
for root in roots:
    for key,limb in (("Remote","ArmL"),("Umbrella","ArmR")):
        if key in parts[root.name]:
            accessory=parts[root.name][key];accessory.parent=parts[root.name][limb]
            accessory.location=(0,0,0)
    if root.name=="PlayerSeated":
        # Blender and glTF share the contact point at the top of the sofa cushion.
        for node in root.children:node.location.z-=.268
scene.render.engine="BLENDER_WORKBENCH"
shade=scene.display.shading;shade.light="STUDIO";shade.color_type="MATERIAL"
shade.show_shadows=True;shade.show_cavity=True;shade.cavity_type="WORLD"
world=bpy.data.worlds.new("Warm grey");world.color=(.12,.14,.15);scene.world=world
for area in bpy.context.screen.areas:
    if area.type=="VIEW_3D":
        sp=area.spaces.active;sp.region_3d.view_distance=7.25
        sp.region_3d.view_location=(0,1.2,.78)
        sp.region_3d.view_rotation=Vector((0,8,-2)).to_track_quat('-Z','Y')
        sp.shading.color_type="MATERIAL";sp.overlay.show_overlays=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"Sumiyoshi-People.blend"),compress=True)
runtime_material=bpy.data.materials.new("OOO | printed enamel and woven wool")
runtime_material.use_nodes=True
bs=runtime_material.node_tree.nodes.get("Principled BSDF")
bs.inputs["Roughness"].default_value=.73
attr=runtime_material.node_tree.nodes.new("ShaderNodeVertexColor")
attr.layer_name="Palette"
runtime_material.node_tree.links.new(attr.outputs["Color"],bs.inputs["Base Color"])
exports=[]
for root in roots:
    root.location=(0,0,0)
    exports.append(root)
    for part in parts[root.name].values():
        children=[node for node in part.children if node.type=="MESH"]
        by_surface=([c for c in children if c.data.materials[0]!=alpha_mat],
                    [c for c in children if c.data.materials[0]==alpha_mat])
        exports.append(part)
        for j,items in enumerate(by_surface):
            if items:
                exports.append(merge_draws(root,part,items,transparent=j==1))
        for source in children:
            bpy.data.objects.remove(source,do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
for node in exports:node.select_set(True)
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(WEB/"people.glb"),export_format="GLB",use_selection=True,
    export_yup=True,export_texcoords=False,export_cameras=False,export_lights=False,export_animations=False,
    export_attributes=False,export_all_vertex_colors=True)
