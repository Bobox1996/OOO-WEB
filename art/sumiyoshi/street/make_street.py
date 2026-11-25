"""Build a rain-wet Osaka lane and an original VISION glass cola bottle."""
from pathlib import Path
import sys, math, random
from collections import defaultdict
import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.dont_write_bytecode=True
sys.path.insert(0,str(HERE))
import geometry as g
import finishes
from geometry import box, rod, blob, mesh, flat, sign, mat, V, TAU
ROOT=HERE.parents[2]
OUT=ROOT/'public'/'sumiyoshi'/'models'
OUT.mkdir(exist_ok=True,parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(2808)

cast=mat("Architectural concrete","afb4b4",.72)
castside=mat("Concrete returns","9ba19f",.78)
joint=mat("Form joints","8c9392",.8)
hole=mat("Form-tie shadows","6e7570",.84)
tie=mat("Cement cones","a3aaa4",.7)
basalt=mat("Rain-dark fine asphalt","505b68",.32)
wet=mat("Shallow gutter water","667889",.17,.14)
crests=mat("Silvery water crests","8999a5",.24,.11)
concrete=mat("Precast gutter","899294",.59)
grain=mat("Concrete weathering","8d9694",.74)
stone=mat("Wet foundation stone","777e7e",.62)
earth=mat("Umber fill","4c473c",.78)
plaster=[mat("Rain limewash "+str(i),c) for i,c in enumerate(("d0c6ae","b5b7b2","b4a589","aaa896","b4bbb4"))]
timber=mat("Dark chestnut wood","665347",.63)
wood=mat("Honey cedar","9a7653",.58)
board=mat("Weathered cedar","896e57",.65)
char=mat("Soot brown","464342",.52)
tile=mat("Unglazed ceramic roofing","5a6571",.46)
tilehi=mat("Wet tile crowns","727d85",.39)
tilelow=mat("Clay tile ends","50565b",.58)
metal=mat("Weathered zinc","889695",.39,.32)
alum=mat("Brushed aluminium","bbc1bd",.36,.42)
bronze=mat("Bronze window frames","69645d",.43,.25)
copper=mat("Verdigris gutters","64847f",.48,.17)
black=mat("Charcoal metal","353d42",.46,.34)
window=mat("Blue-gray glass","677b83",.24,.26)
darkglass=mat("Smoked glass","435965",.25,.22)
lit=mat("Warm rice-paper shades","e8ba87",.7,0,.18)
lit2=mat("Curtains at dusk","bda48a",.78,0,.10)
warm=mat("Porch lamps","ffdc9d",.28,0,2.1)
khaki=mat("Warm outside enamel","c4c0ad",.60)
clay=mat("Flowerpot stoneware","a7745e",.68)
indigo=mat("Indigo cloth","546777",.84)
sea=mat("Faded turquoise","759d99",.51)
red=mat("Carmine enamel","aa5047",.39,.15)
cream=mat("Ivory lettering","eddfbd",.55)
forest=mat("Evergreen foliage","4d6b57",.72)
leaves=mat("Wet foliage","698461",.65)
green=mat("Sage shoot tips","819472",.68)
floral=mat("Faded pink flowers","cd928b",.69)
brown=mat("Cola glass","71422e",.19,.16)
gold=mat("Fluted cap brass","ba9765",.27,.47)
shine=mat("Cola highlights","a07656",.31,.13)
orange=mat("Juice amber","dcaa62",.38)
finishes.apply(basalt,'asphalt');finishes.apply(cast,'concrete')

def stripe(x,z,w,d,m,y=.006):
    flat(m,[(x-w/2,y,z-d/2),(x-w/2,y,z+d/2),(x+w/2,y,z+d/2),(x+w/2,y,z-d/2)])
def lathe(x,y,z,profile,m,sides=20):
    pts=[];faces=[]
    for h,r in profile:
        for j in range(sides):
            a=TAU*j/sides;pts.append((x+r*math.sin(a),y+h,z+r*math.cos(a)))
    for k in range(len(profile)-1):
        for j in range(sides):
            i=k*sides+j;n=k*sides+(j+1)%sides
            faces.append((i,n,n+sides,i+sides))
    faces.append(tuple(reversed(range(sides))));faces.append(tuple(range((len(profile)-1)*sides,len(profile)*sides)))
    mesh(m,pts,faces,True)
def ring(a,b,r,thickness,m):
    # Wheel from the side, axes along Z.
    x,y,z=a
    for i in range(b):
        t=TAU*i/b;u=TAU*(i+1)/b
        rod((x+r*math.sin(t),y+r*math.cos(t),z),(x+r*math.sin(u),y+r*math.cos(u),z),thickness,thickness,m,6)
def roof_plane(x,w,z1,h1,z2,h2,matl):
    half=w/2
    pts=[(x-half,h1,z1),(x+half,h1,z1),(x+half,h2,z2),(x-half,h2,z2)]
    pts+= [(xx,yy-.12,zz) for xx,yy,zz in pts]
    faces=[(0,1,2,3),(7,6,5,4),(4,5,1,0),(5,6,2,1),(6,7,3,2),(7,4,0,3)]
    if z1<z2:faces=[tuple(reversed(f)) for f in faces]
    mesh(matl,pts,faces)
def wire(a,b,drop,m=black,r=.017,n=12):
    a,b=V(a),V(b)
    def value(t):
        p=a.lerp(b,t);p.y-=4*t*(1-t)*drop;return p
    for k in range(n):rod(value(k/n),value((k+1)/n),r,r,m,5)
def plant(x,z,h,kind=0):
    r=min(.26,h*.25);pot=clay if kind%2==0 else khaki
    lathe(x,0,z,[(.025,r*.70),(.06,r*.75),(.22*h,r*.96),(.25*h,r),(.28*h,r*.90)],pot,12)
    rod((x,.24*h,z),(x,.265*h,z),r*.80,r*.80,earth,12)
    for k in range(6):
        a=k*TAU/6+kind*.7;d=V((math.sin(a),0,math.cos(a)))
        p=V((x,h*.25,z));q=p+d*h*(.13+.07*(k%2))+V((0,h*(.31+.12*((k+1)%3)),0))
        rod(p,q,.012,.006,wood,5)
        if kind in (1,4):
            blob(tuple(q),(h*.19,h*.15,h*.17),(leaves,forest,green)[k%3],7)
            if kind==4 and k%2==0:blob(tuple(q+V((0,h*.095,0))),(h*.052,h*.046,h*.05),floral,7)
        else:
            for j in range(3):
                ang=a+j*2.4;u=V((math.sin(ang),-.17,math.cos(ang)));v=V((-u.z,0,u.x))
                size=h*(.18+.03*j);tip=q+u*size+V((0,size*.33,0));mid=q+u*.51*size
                mesh((green,leaves,forest)[(j+k)%3],[q,mid+v*size*.30,mid+V((0,size*.17,0)),tip,mid-v*size*.30],[(0,1,2),(1,3,2),(2,3,4),(0,2,4)])
def ac(x,y,z,s=1):
    box((x,y,z),(.96*s,.57*s,.36*s),khaki,.045)
    front=z+.191*s
    rod((x-.13*s,y,front),(x-.13*s,y,front+.019),.226*s,.226*s,bronze,18)
    rod((x-.13*s,y,front+.019),(x-.13*s,y,front+.04),.192*s,.192*s,black,18)
    for k in range(6):
        dy=(k-2.5)*.064*s;l=math.sqrt(max(0,(.19*s)**2-dy**2))
        box((x-.13*s,y+dy,front+.046),(2*l,.015*s,.014*s),metal,.005)
    for j in range(5):box((x+.265*s,y+(j-2)*.063*s,front),(.23*s,.014*s,.017*s),bronze,.005)
    for dx in (-.33,.33):box((x+dx*s,y-.31*s,z),(.13*s,.08*s,.31*s),stone,.012)
def lamp(x,y,z):
    box((x,y+.056,z),(.23,.13,.13),char,.026)
    box((x,y-.020,z+.043),(.155,.16,.11),warm,.021)
    box((x,y-.115,z+.045),(.17,.045,.13),bronze,.015)

g.group="01 / Sumiyoshi, concrete threshold"
# Frontage respects the published .80 m clear opening and 6 m wall.
for side in (-1,1):
    box((side*(.4+(1.75-.4)/2),1.15,-.105),(1.35,2.3,.21),cast,.009)
box((0,4.15,-.105),(3.50,3.7,.21),cast,.009)
for side in (-1,1):
    box((side*1.6625,2.91,-7),(.175,5.82,13.96),castside,.013)
box((0,2.92,-13.91),(3.50,5.84,.18),castside,.018)
for z in (-2.22,-11.66):
    box((0,5.795,z),(3.47,.20,4.39),castside,.014)
box((0,2.77,-7),(.75,.13,5.3),castside,.014)
box((0,.018,-7),(3.46,.06,13.94),concrete,.012)
for side in (-1,1):
    box((side*.443,1.15,-.52),(.080,2.3,.70),castside,.008)
box((0,2.353,-.52),(.94,.10,.70),castside,.008)
box((0,1.12,-.78),(.84,2.24,.12),black,.013)
box((0,1.11,-.696),(.71,2.11,.045),timber,.014)
rod((.247,.89,-.659),(.247,1.16,-.659),.015,.015,metal,7)
box((0,.033,.09),(.82,.066,.30),stone,.012)
box((0,4.15,.004),(.010,3.69,.007),joint,.001)
for i in range(1,7):
    y=i*.90
    seg=[(-1.075,1.35),(1.075,1.35)] if y<2.3 else [(0,3.5)]
    for x,w in seg:box((x,y,.003),(w,.012,.007),joint,.001)
for xx in (-1.34,-.43,.43,1.34):
    for i in range(13):
        yy=.22+i*.45
        if yy>5.88:continue
        rod((xx,yy,.002),(xx,yy,.006),.021,.021,hole,9)
        rod((xx,yy-.001,.006),(xx,yy-.001,.007),.016,.016,tie,8)
for xx,zz,h,k in [(-1.4,.23,.96,1),(-1.08,.28,.62,0),(1.32,.28,.92,4),(1.54,.20,.58,2),(.98,.24,.55,1)]:plant(xx,zz,h,k)

def windows(x,y,width,height,z,warmth=0,div=2,shutters=False):
    framing=bronze if warmth!=3 else timber
    box((x,y,z),(width+.12,height+.12,.13),framing,.020)
    box((x,y,z+.064),(width,height,.04),(window,lit2,lit,darkglass)[warmth],.008)
    # Tiny overlaps in closed lace panels give an actual sash depth. Upper
    # windows in blank plaster neighbour walls are intentionally more reserved.
    if warmth in (1,2):
        for side in (-1,1):
            px=x+side*width*.406
            box((px,y,z+.087),(width*.161,height*.97,.011),lit2 if warmth==2 else khaki,.003)
            for j in range(3):
                box((px+(j-1)*width*.048,y,z+.096),(.012,height*.96,.009),plaster[0],.003)
    for n in range(1,div):
        box((x-width/2+width*n/div,y,z+.099),(.035,height,.04),framing,.006)
    box((x,y-height*.14,z+.10),(width,.032,.045),framing,.006)
    box((x,y-height/2-.057,z+.033),(width+.23,.084,.19),framing,.012)
    if shutters:
        for k in range(10):
            box((x-width/2+width*(k+.5)/10,y,z+.13),(.02,height,.026),wood,.004)
def tiled_roof(x,w,front,depth,eave,rise):
    ridge=front-depth*.5;back=front-depth
    for sg in (-1,1):
        xx=x+sg*(w*.5-.045)
        face=[(xx,eave-.035,front-.16),(xx,eave+rise-.07,ridge),(xx,eave-.035,back+.16)]
        mesh(plaster[2],face,[(0,1,2),(2,1,0)])
        for zz in (front,back):
            rod((xx,eave-.03,zz),(xx,eave+rise-.038,ridge),.072,.072,timber,7)
    for edge in (front,back):
        roof_plane(x,w,edge,eave,ridge,eave+rise,tile)
        n=max(8,round(w/.28))
        for i in range(n):
            xx=x-w/2+(i+.5)*w/n
            rod((xx,eave+.014,edge),(xx,eave+rise+.02,ridge),.041,.033,tilehi,7)
            if edge==front:rod((xx,eave,edge-.055),(xx,eave,edge+.04),.073,.073,tilelow,9)
        for j in range(1,8):
            t=j/8;zz=edge+(ridge-edge)*t
            rod((x-w/2,eave+t*rise+.016,zz),(x+w/2,eave+t*rise+.016,zz),.013,.013,tilehi,5)
    rod((x-w/2-.06,eave+rise+.03,ridge),(x+w/2+.06,eave+rise+.03,ridge),.094,.094,tilehi,10)
    box((x,eave-.075,front),(w,.12,.16),timber,.024)
    rod((x-w/2,eave-.11,front+.084),(x+w/2,eave-.11,front+.084),.075,.075,copper,10)
def awning(x,w,y,z,cloth=False):
    roof_plane(x,w,z+.63,y-.19,z-.08,y+.15,indigo if cloth else tile)
    for j in range(max(1,int(w/.35))):
        xx=x-w/2+.15+j*.35
        rod((xx,y-.18,z+.63),(xx,y+.15,z-.08),.020,.019,metal if cloth else tilehi,6)
    box((x,y-.21,z+.63),(w,.14,.062),indigo if cloth else timber,.017)
    for t in (-.43,0,.43):
        xx=x+w*t
        rod((xx,y-.46,z+.045),(xx,y-.19,z+.54),.024,.023,bronze,6)
def door(x,y,z,w,h,style):
    box((x,y+h/2,z),(w+.12,h+.11,.095),char,.018)
    if style%2:
        box((x,y+h/2,z+.051),(w,h,.048),wood,.009)
        box((x,y+h*.66,z+.083),(w*.79,h*.49,.025),lit2,.009)
        for j in range(5):box((x-w*.35+j*w*.175,y+h*.65,z+.107),(.026,h*.5,.025),timber,.003)
        box((x+w*.30,y+h*.46,z+.134),(.032,.20,.045),metal,.009)
    else:
        windows(x,y+h*.50,w-.035,h-.065,z+.05,3,3,True)

def neighbour(id,left,right,height,depth,style):
    g.group=f"02 / Neighbour {id}"
    x=(left+right)/2;w=right-left;front= -.12-.10*(style%3)
    body=plaster[style%len(plaster)]
    box((x,height*.5,front-depth/2),(w-.07,height,depth),body,.036)
    box((x,.19,front+.015),(w-.08,.37,.11),stone,.023)
    if style in (1,2,4,6):
        for j in range(int((height-.4)/.19)):
            box((x,.44+j*.19,front+.021),(w-.13,.017,.019),grain if style%2 else khaki,.004)
    else:
        for j in range(int(w/.18)):
            box((left+.13+j*.18,1.34,front+.048),(.142,2.14,.068),board if j%4 else wood,.015)
        for dx in (left+.12,right-.12,x):box((dx,height*.49,front+.065),(.135,height-.16,.14),timber,.012)
        box((x,2.83,front+.055),(w,.18,.16),timber,.014)
    if style in (2,6):
        box((x,height+.08,front-depth/2),(w+.07,.22,depth+.08),concrete,.045)
        for xx in (left+.09,right-.09):box((xx,height+.22,front-depth/2),(.11,.24,depth),body,.015)
        box((x,height+.22,front),(w,.24,.14),body,.015)
    else:tiled_roof(x,w+.08,front+.29,depth+.46,height,.70 if style==1 else 1.18)
    dx=left+min(w*.27,1.12)
    door(dx,.10,front+.09,.94 if style%2 else 1.05,1.98,style)
    box((dx,.063,front+.24),(1.17,.13,.39),concrete,.026)
    wspan=right-(dx+.70)-.29
    if wspan>.7:windows((right-.28+dx+.7)/2,1.31,wspan,1.0,front+.093,style%4,max(2,round(wspan/.73)),style in (0,3))
    if style!=2:awning(x,min(w-.19,w*.95),2.53,front,style==4)
    topy=min(height-.92,3.91+(style%3)*.26)
    for i in range(2):
        if id=='R1' and i==0:continue
        ww=(w-.89)/2
        px=left+.23+ww/2+i*(ww+.41)
        windows(px,topy,ww,1.08 if style%2 else 1.27,front+.03,(style+i)%4,max(2,round(ww/.72)),style==3)
    if style in (2,5):
        lo=left+w*.52 if id=='R1' else left+.3
        hi=right-.3
        box(((lo+hi)/2,topy-.68,front+.22),(hi-lo,.13,.57),concrete,.025)
        z=front+.49
        rod((lo,topy-.10,z),(hi,topy-.10,z),.026,.026,metal,7)
        for j in range(int((hi-lo)/.21)+1):
            xx=lo+j*.21;rod((xx,topy-.63,z),(xx,topy-.10,z),.011,.011,metal,6)
    gutter=right-.16
    rod((gutter,.09,front+.115),(gutter,height-.17,front+.115),.041,.041,copper,9)
    for y in (.61,2.55,height-.48):box((gutter,y,front+.15),(.109,.031,.052),metal,.005)
    lamp(dx+.64,1.99,front+.155)
    ac(right-.67,.44,front+.31,.82 if w<4.5 else .98)
    for j in range(2+(style%2)):plant(left+.24+.33*j,front+.34,.46+.10*((j+style)%5),(j+style)%5)
    box((dx-.61,1.52,front+.156),(.25,.34,.10),bronze,.018)
    box((dx-.61,1.58,front+.217),(.16,.046,.012),cream,.004)
    if style in (0,3,5):
        # Handwritten orders basket and timber sill at a domestic shopfront.
        px=right-.98
        box((px,.64,front+.19),(1.01,.085,.35),timber,.022)
        for j in range(6):box((px-.37+j*.14,.765,front+.22),(.114,.17,.15),wood,.016)
    if style in (1,3,4):
        # Individually built clay pavers lead from rain gutter into the entry.
        for j in range(4):
            box((dx-.4+j*.27,.091,front+.30),(.252,.030,.19),clay,.009)
    if style==4:
        for j in range(4):
            xx=dx-.42+j*.275
            box((xx,1.88,front+.128),(.265,.44,.046),indigo,.017)
            blob((xx,1.89,front+.158),(.036,.048,.006),cream,7)

# Left two is a reserved, empty frontage for the companion café mesh.
for row in [('L4',-24.35,-19.58,5.57,8.9,5),('L3',-19.55,-15.46,5.05,7.6,3),
    ('L1',-8.13,-1.78,4.89,9,1),('R1',1.78,7.17,6.30,9.4,2),
    ('R2',7.20,11.80,4.96,8.5,0),('R3',11.83,17.35,5.64,8.1,4),
    ('R4',17.38,23.85,5.49,9.1,6)]:
    neighbour(*row)

g.group="03 / Rain lane, gutters and domestic details"
# The lane and connected rear yards share a ground datum beyond the playable
# strip, so an oblique camera does not reveal the underside of a floating slab.
flat(stone,[(-110,-.17,-75),(-110,-.17,52),(110,-.17,52),(110,-.17,-75)])
box((0,-.215,3),(105,.40,10.2),basalt,.08)
for x,w,z in [(-21.9,4.5,-9.1),(-17.5,3.7,-7.8),(-4.93,6,-9.3),
    (4.48,5.1,-9.6),(9.5,4.2,-8.7),(14.6,5.2,-8.3),(20.6,6.1,-9.4)]:
    box((x,.55,z-1.10),(w,1.16,.16),stone,.022)
    box((x,1.14,z-1.10),(w+.09,.09,.21),concrete,.018)
for z in (.44,6.38):
    for i in range(78):
        x=-30.22+i*.785
        box((x,-.042,z),(.775,.11,.37),concrete,.016)
        if i%5==1:
            box((x,.018,z),(.53,.025,.28),black,.012)
            for j in range(8):box((x-.223+j*.063,.035,z),(.026,.026,.25),metal,.005)
        elif i%3==1:
            box((x,.015,z),(.031,.012,.105),stone,.006)
    stripe(0,z+.22,60,.068,wet,-.010)
for x,z,w,d in [(-16.7,1.23,1.8,.27),(-8.2,1.05,.93,.18),(-2.2,1.08,1.3,.17),
    (4.1,5.48,1.75,.18),(10.0,2.18,1.04,.21),(18.2,.98,1.14,.25),(1.8,5.92,1.21,.11),(-13,5.77,1.1,.14)]:
    pts=[];ph=random.random()*TAU
    for i in range(22):
        a=TAU*i/22;k=1+.13*math.sin(3*a+ph)+.07*math.sin(4*a-ph)
        pts.append((x+w*math.cos(a)*k,-.008,z+d*math.sin(a)*k))
    flat(wet,pts)
    stripe(x+w*.2,z+d*.21,w*.35,.010,crests,-.006)
def manhole(x,z,r):
    rod((x,-.014,z),(x,-.001,z),r,r,metal,30)
    rod((x,-.001,z),(x,.003,z),r*.91,r*.91,black,30)
    rod((x,.003,z),(x,.006,z),r*.83,r*.83,bronze,30)
    for i in range(-3,4):
        k=i*r*.19;l=math.sqrt((r*.74)**2-k**2)
        stripe(x,z+k,2*l,.014,black,.007)
    for sg in (-1,1):
        stripe(x+sg*r*.63,z,.022,r*.27,metal,.009)
for x,z,r in [(-14,3.04,.31),(-3.5,4.48,.32),(6.1,2.79,.29),(19.3,4.46,.32)]:manhole(x,z,r)
# Catenary utility lines are behind the walking plane and clear all doorways.
for x,z,h in [(-24.7,-.36,7.2),(-7.90,-.16,6.85),(12.02,-.12,6.90),(24.8,-.42,7.34)]:
    rod((x,-.07,z),(x,h,z),.130,.088,stone,12)
    for yy in (1.5,3.4,5.70):
        rod((x,yy,z),(x,yy+.048,z),.134-.006*yy,.134-.006*yy,metal,10)
    for y,k in [(h-.39,1.08),(h-.79,.80)]:
        rod((x,y,z-.58),(x,y,z+k-.46),.040,.040,black,7)
        for dz in (-.55,.45):
            rod((x,y,z+dz),(x,y+.19,z+dz),.049,.046,khaki,9)
            for j in range(3):rod((x,y+.04*j,z+dz),(x,y+.04*j+.018,z+dz),.068,.066,khaki,9)
    box((x,h-.92,z+.17),(.30,.49,.21),metal,.029)
for xa,xb,ha,hb in [(-24.7,-7.9,7.2,6.85),(-7.9,12.02,6.85,6.9),(12.02,24.8,6.9,7.34)]:
    for index,dz in enumerate((-.71,.25,-.34)):
        wire((xa,ha-.18-index*.14,dz),(xb,hb-.18-index*.14,dz),.39+.11*index,r=.018 if index==0 else .012)
    wire((xa,ha-1.19,-.43),(xb,hb-1.19,-.43),.76,r=.027)
# Last stretch of domestic wiring running down to secondary eaves and small meters.
for x,roof,px in [(-18.45,4.42,-24.70),(-4.22,4.41,-7.90),(5.62,5.33,12.02),(17.84,4.62,24.8)]:
    wire((px,5.74,-.20),(x,roof,-.16),.37,r=.012,n=8)
    box((x,1.39,.045),(.26,.38,.14),khaki,.028)
    box((x,1.47,.125),(.15,.10,.028),darkglass,.012)
    rod((x-.12,.18,.07),(x-.12,1.48,.07),.019,.019,metal,7)
def bicycle(x,z,s=1):
    col=sea
    def p(xd,yd,zd=0):return (x+xd*s,yd*s,z+zd*s)
    for xx in (-.59,.59):
        ring(p(xx,.34),18,.325*s,.022*s,black)
        ring(p(xx,.34),16,.296*s,.010*s,alum)
        for j in range(6):
            ang=TAU*j/6
            rod(p(xx,.34),p(xx+.29*math.sin(ang),.34+.29*math.cos(ang)),.006*s,.006*s,metal,5)
    for a,b in [((-.59,.34),(-.17,.77)),((-.17,.77),(.07,.32)),((.07,.32),(-.59,.34)),
        ((.07,.32),(.39,.69)),((-.17,.68),(.34,.53)),((.32,.79),(.59,.34))]:
        rod(p(*a),p(*b),.019*s,.019*s,col,7)
    rod(p(-.17,.74),p(-.22,.87),.021*s,.021*s,metal);box(p(-.22,.87),(.26*s,.066*s,.13*s),char,.022)
    rod(p(.35,.73),p(.28,.97),.017*s,.017*s,metal);rod(p(.28,.97,-.10),p(.28,.97,.13),.017*s,.017*s,char)
    box(p(.56,.72),(.30*s,.16*s,.18*s),khaki,.023)
    for i in range(5):box(p(.44+i*.06,.74,.10),(.014*s,.13*s,.014*s),bronze,.002)
for x,z,s in [(-6.48,.30,.92),(15.23,.27,.85)]:bicycle(x,z,s)

# Small original cola machine with glazed selection window, crown marks and cast handles.
g.group="04 / VISION drinks"
x,z=8.10,.10
box((x,.065,z),(.91,.13,.76),black,.055)
box((x,1.03,z),(.92,1.90,.70),red,.088)
box((x,1.19,z+.354),(.845,1.34,.063),cream,.040)
box((x,1.193,z+.393),(.755,1.224,.033),red,.029)
box((x,1.67,z+.424),(.656,.232,.061),cream,.025)
sign("VISION",x,1.677,z+.46,.164,red,tracking=1.08)
box((x-.099,1.22,z+.426),(.489,.56,.038),black,.018)
box((x-.099,1.22,z+.451),(.432,.50,.021),darkglass,.010)
for j,(lx,ly) in enumerate([(-.22,1.11),(-.11,1.11),(.007,1.11),(-.22,1.34),(-.11,1.34),(.007,1.34)]):
    b=x+lx
    lathe(b,ly-.084,z+.466,[(0,.037),(.073,.037),(.107,.028),(.13,.016),(.15,.016)],(brown,orange,sea)[j%3],10)
    rod((b,ly+.065,z+.466),(b,ly+.077,z+.466),.018,.018,gold,8)
    rod((b,ly-.052,z+.466),(b,ly-.012,z+.466),.0377,.0377,cream,10)
for h in (1.023,1.26):box((x-.11,h,z+.477),(.46,.035,.05),alum,.009)
for j in range(3):
    box((x+.237,1.36-j*.138,z+.436),(.12,.077,.038),black,.009)
    rod((x+.24,1.36-j*.138,z+.454),(x+.24,1.36-j*.138,z+.47),.024,.023,(warm,orange,green)[j],8)
box((x,.817,z+.437),(.60,.128,.035),cream,.015)
sign("COLD DRINKS",x,.818,z+.46,.075,red,tracking=1.10)
box((x,.48,z+.384),(.57,.235,.08),black,.025)
box((x,.54,z+.428),(.52,.044,.019),alum,.010)
for i in range(6):box((x-.23+i*.093,.219,z+.354),(.064,.096,.016),char,.008)
for xx in (-.385,.385):
    rod((x+xx,.49,z+.323),(x+xx,.60,z+.323),.015,.015,metal,7)
sign("OOO",x,1.916,z+.315,.077,cream,tracking=1.04)

def emit():
    created=[]
    for (category,material),(vs,fs,ss) in g.batches.items():
        col=bpy.data.collections.get(category)
        if col is None:
            col=bpy.data.collections.new(category);bpy.context.scene.collection.children.link(col)
        data=bpy.data.meshes.new(category+" / "+material.name)
        data.from_pydata(vs,[],fs);data.materials.append(material);data.update()
        if material in (basalt,cast):finishes.uv(data,3.1 if material==basalt else 1.8)
        data.polygons.foreach_set('use_smooth',ss)
        ob=bpy.data.objects.new(data.name,data);col.objects.link(ob)
        created.append(ob)
    g.batches.clear()
    return created

def export(path,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects: ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_cameras=False,export_lights=False,export_animations=False,export_yup=True)
# One drawable per shared material in the runtime street. The editable Blender
# scene below keeps separate architectural groups and individual material meshes.
architectural=g.batches
g.batches=defaultdict(lambda:[[],[],[]])
for (category,material),(vs,fs,smooth) in architectural.items():
    dst,dst_faces,dst_smooth=g.batches[("Street",material)]
    offset=len(dst);dst.extend(vs);dst_faces.extend(tuple(offset+j for j in f) for f in fs)
    dst_smooth.extend(smooth)
runtime=emit()
export(OUT/'street.glb',runtime)
for ob in runtime:
    data=ob.data;bpy.data.objects.remove(ob,do_unlink=True);bpy.data.meshes.remove(data)
bpy.data.collections.remove(bpy.data.collections["Street"])
g.batches=architectural
exterior=emit()

g.group="05 / VISION souvenir bottle"
lathe(0,0,0,[(0,.026),(.004,.031),(.009,.034),(.019,.0365),(.042,.0345),(.064,.0328),
    (.073,.0375),(.173,.0375),(.183,.0345),(.195,.029),(.211,.022),
    (.228,.0155),(.246,.014),(.27,.015),(.278,.0175),(.283,.016)],brown,36)
for i in range(12):
    a=TAU*i/12
    def tangent(r,h):return (r*math.sin(a),h,r*math.cos(a))
    rod(tangent(.0344,.019),tangent(.0326,.058),.0012,.0009,shine,5)
lathe(0,0,0,[(.072,.0376),(.074,.038),(.174,.038),(.176,.0375)],cream,48)
for h in (.0734,.175):
    lathe(0,0,0,[(h-.0005,.03795),(h+.0005,.03795)],gold,48)
lathe(0,0,0,[(.271,.0160),(.277,.0191),(.283,.0184)],shine,24)
lathe(0,0,0,[(.281,.0178),(.285,.0201),(.295,.0197),(.300,.0163)],gold,24)
for i in range(18):
    a=TAU*i/18
    rod((.0190*math.sin(a),.284,.0190*math.cos(a)),(.0185*math.sin(a),.295,.0185*math.cos(a)),.0016,.00125,cream,5)
# Small permanent collar mark leaves the paper band for the live vision typography.
lathe(0,0,0,[(.204,.0252),(.222,.0194)],red,32)
sign("OOO",0,.212,.0233,.0085,cream,tracking=1.02)
sign("VISION",0,.188,.033,.0065,cream,tracking=1.04)
emit()
bottle=[ob for ob in bpy.context.scene.objects if ob not in exterior]
export(OUT/'cola.glb',bottle)
for ob in bottle:ob.location.x=27
bpy.ops.object.select_all(action='DESELECT')
scene=bpy.context.scene
scene["building_frontage"]="3.5 x 6 m; central opening .8 x 2.3 m; depth ~14 m"
scene["bottle_label"]="Y=.074–.174 m, radius .0382 m, front +Z"
world=bpy.data.worlds.new("Rainy lane");world.color=(.11,.13,.16);scene.world=world
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        sp=area.spaces.active;sp.shading.color_type='MATERIAL';sp.region_3d.view_distance=33
        sp.region_3d.view_location=(0,1.5,2.5);sp.region_3d.view_rotation=V((.18,-1.3,.55)).to_track_quat('Z','Y')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'Sumiyoshi street.blend'),compress=True)
print("OOO Sumiyoshi street and glass bottle exported.")
