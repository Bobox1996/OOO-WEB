"""Forest-Wanna-Be House. Build both editable Blender masters and the actual game GLBs.

Run node paint.cjs first to regenerate the native-pixel artwork. Then run:
  blender -b -t 3 -P build.py [-- cafe-front cafe]
World coordinates in this script are (east, height, toward street), in metres.
The building origin is its front centre. The street places its origin at X -11.8.
"""
import bpy
import math
import random
import sys
from collections import defaultdict
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'art/sumiyoshi/cafe'))
sys.path.insert(0, str(HERE))
import build_cafe as g
from planting import Specimen, crown_limbs

OUT = ROOT / 'public/sumiyoshi/models'
box, rod, solid, profile = g.box, g.rod, g.solid, g.profile
section, swizzle, casing = g.section, g.swizzle, g.casing


def rgb(hexadecimal):
    def linear(s):
        value = int(s, 16) / 255
        return value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4
    return tuple(linear(hexadecimal[i:i + 2]) for i in (0, 2, 4))


def material(name, value, emission=0, alpha=1, rough=.67, metal=0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    c = rgb(value)
    mat.diffuse_color = (*c, alpha)
    bs.inputs['Base Color'].default_value = (*c, 1)
    bs.inputs['Emission Color'].default_value = (*c, 1)
    bs.inputs['Emission Strength'].default_value = emission
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Alpha'].default_value = alpha
    if alpha < 1:
        mat.surface_render_method = 'BLENDED'
    g.materials[name] = mat
    return mat


def pixels(name, basename, emit=0, mode='OPAQUE'):
    mat = material(name, 'ffffff', emit)
    bs = mat.node_tree.nodes.get('Principled BSDF')
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.interpolation = 'Closest'
    tex.image = bpy.data.images.load(str(HERE / (basename + '.png')), check_existing=True)
    tex.image.pack()
    bs.inputs['Roughness'].default_value = .76
    mat.node_tree.links.new(tex.outputs['Color'], bs.inputs['Base Color'])
    if emit:
        mat.node_tree.links.new(tex.outputs['Color'], bs.inputs['Emission Color'])
    if mode == 'MASK':
        cut = mat.node_tree.nodes.new('ShaderNodeMath')
        cut.operation = 'GREATER_THAN'
        cut.inputs[1].default_value = .48
        mat.node_tree.links.new(tex.outputs['Alpha'], cut.inputs[0])
        mat.node_tree.links.new(cut.outputs[0], bs.inputs['Alpha'])
    elif mode == 'BLEND':
        mat.surface_render_method = 'BLENDED'
        mat.node_tree.links.new(tex.outputs['Alpha'], bs.inputs['Alpha'])


def start():
    g.reset()
    finishes = {
        'alabaster':('d5e0d3', .075),'reveal':('4c5e58', .09),'aluminium':('b1c1b9', .12),
        'sill':('839995', .10),'shadow':('182c2b', .10),'brightedge':('d4decb', .19),
        'honey':('ecb879', .78),'lanternLight':('ffdcaa', 2.2),'haze':('edcf92', .34),
        'cedar':('9e6746', .14),'beam':('734638', .13),'lichen':('73865f', .17),
        'redwood':('70453b', .12),'ironwork':('273837', .10),'countertop':('ad8565', .16),
        'paperBlue':('adc1ab', .16),'barLight':('f8deaf', 1.2),'frost':('98b6ad', .22),
        'plinth':('656b64', .12),'tileEdge':('63473b', .08),'service':('c5a77e', .34),
        'wornTeal':('446862', .17),'shadeBrown':('4c382f', .10),
        'dullBrass':('b4986c', .22),'highGlass':('d2dec8', .55),
    }
    for name,(value,emission) in finishes.items():
        material(name, value, emission)
    material('shop glass','86a9a5',.20,.13,.29,.06)
    material('Hopper light reflected in glazing','c8d4cb',.24,.54,.29,.04)
    material('flashing','7b978f',.14,1,.34,.22)
    for name, val in [('teak','98674e'),('wood','a17b5c'),('walnut','644c3f'),('oak','b18b62'),
                      ('ceramic','dfcea4'),('espresso','43342e'),('turquoise','779a88'),
                      ('spruce','435d51'),('iron','3b4341'),('chrome','b2b8a9'),
                      ('brass','c3aa73'),('wine','783f36'),('iodine','3e302c')]:
        material(name, val, .10)
    pixels('Forest House lettering','marquee',.82)
    pixels('Coffee menu','menu',.48)
    pixels('Individually printed food and coffee','stock',.53)
    pixels('Natural walnut veneered boards','walnut',.12)
    pixels('Quarry tile and grout','clinker',.13)
    pixels('Light through polycarbonate webs','flutes',.26,'BLEND')
    pixels('Punched metal sliding doors','punched',.19,'BLEND')
    pixels('Botanical rain leaves','botanical-leaves',.40,'MASK')
    pixels('Room herbarium leaves','botanical-leaves',.44,'MASK')
    pixels('Rain through four panes','rain-garden-window',.62)
    material('Living petioles','617957',.22)
    material('Rain dark bark','756c59',.23,rough=.58)
    material('Pollen','e0bd72',.42)
    for i in range(3):
        pixels('Botanical courtyard crown %s'%i,'crown-%s'%i,.46,'MASK')
    bpy.context.scene.unit_settings.system = 'METRIC'


def quad(name, points, finish, uv=((0,0),(1,0),(1,1),(0,1))):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([swizzle(p) for p in points], [], [(0,1,2,3)])
    layer = mesh.uv_layers.new(name='Artist pixel UV')
    for i, value in enumerate(uv):
        layer.data[i].uv = value
    mesh.materials.append(g.materials[finish])
    g.current[0].objects.link(bpy.data.objects.new(name, mesh))


def panel(name, x, y, z, w, h, mat, u=1, v=1, bay=None, angle=0):
    lo,hi = (0,u) if bay is None else ((bay*64+.5)/256, (bay*64+63.5)/256)
    coords = [(x+sx*w*math.cos(angle)/2, y+sy*h/2, z+sx*w*math.sin(angle)/2)
              for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    quad(name,coords,mat,((lo,0),(hi,0),(hi,v),(lo,v)))


def floor(name,x,z,w,d,y,mat,tiles):
    quad(name,[(x-w/2,y,z+d/2),(x+w/2,y,z+d/2),(x+w/2,y,z-d/2),(x-w/2,y,z-d/2)],
         mat,((0,0),(w/tiles,0),(w/tiles,d/tiles),(0,d/tiles)))


def rail(x1,x2,y,z,h,d,mat):
    box((x1+x2)/2,y,z,x2-x1,h,d,mat,.003)


def rack(x,y,z,w,h,bay,bright=True):
    """A real 25cm recessed cabinet; a shelf strip and price rail sit in front of its stock."""
    box(x,y,z-.16,w+.06,h+.07,.095,'shadeBrown',.006)
    panel('Printed stock bay '+str(bay),x,y,z-.10,w,h,'Individually printed food and coffee',bay=bay)
    for side in (-1,1):
        box(x+side*w/2,y,z-.003,.045,h+.06,.29,'beam',.003)
    for j in range(4):
        yy=y-h/2+j*h/3
        box(x,yy,z+.008,w+.045,.035,.295,'countertop',.004)
        box(x,yy+.017,z+.154,w,.014,.014,'service',0)
    if bright:
        box(x,y+h/2+.025,z+.125,w,.031,.042,'lanternLight',.006)


def facade_tree(x,y,z,w,h,variant):
    # The three composited elevations retain the crown outlines from the OOO photograph.
    # A return deeper in the recess gives foliage thickness; the root flare and underplanting
    # are separate 3D specimens so the crowns remain connected to their openings at oblique views.
    mat='Botanical courtyard crown '+str(variant)
    crown_limbs(x,y,z,w,h,variant)
    panel('Inner foliage in the vent '+str(variant),x-.035,y+h*.51,z-.19,w*.69,h*.86,mat,angle=.91)
    panel('Photographic crown outline '+str(variant),x,y+h/2,z,w,h,mat)
    leaves=Specimen('Planting around vent sill '+str(variant),502+variant,True)
    for j in range(4):
        xx=x+(-.28+.19*j)*min(1,w*.62)
        if j%2:leaves.fern(xx,y+.013,z+.033,.19+.024*j)
        else:leaves.rosette(xx,y+.015,z+.06,.18,7,9)
    leaves.finish()


def room_floor_lamps():
    for xx in (-5.15,-3.45,-1.75):
        rod((xx,3.53,-2.35),(xx,2.64,-2.35),.012,'ironwork',6)
        profile(xx,2.47,-2.35,[(0,.212),(.026,.222),(.065,.198),(.137,.084),(.18,.047)],'wornTeal',18)
        profile(xx,2.474,-2.35,[(0,.191),(.008,.208)],'barLight',18)


def front():
    start()
    section('A / slabs, returns and ground floor proportions')
    # The published frontal photograph was measured from sill to roof. 7.10m between outer edges.
    # Bottom 2.14m clear / 0.45m steel lintel / 3.30m inhabited upper skin.
    width=7.10
    box(0,.034,-2.22,width,.13,4.63,'plinth')
    for side in (-1,1):
        box(side*3.47,1.31,-2.17,.16,2.55,4.45,'alabaster')
        box(side*3.41,3.95,-3.65,.16,2.85,1.38,'reveal')
    box(0,2.35,-1.80,7.10,.42,3.7,'alabaster')
    box(0,2.59,-.025,7.22,.072,.22,'brightedge',.006)
    box(0,2.53,.05,7.19,.035,.15,'sill',.004)
    box(0,2.16,.02,7.0,.054,.10,'reveal',.003)
    box(0,.11,-.10,7.12,.079,.42,'sill')
    for x in (-3.42,3.42):box(x,1.13,-.015,.18,2.08,.19,'alabaster')
    section('B / recessed coffee room seen behind sliding doors')
    floor('Deep sheltered timber floor',0,-1.69,6.82,3.34,.122,'Natural walnut veneered boards',1.45)
    box(0,1.20,-3.37,6.83,2.18,.12,'haze')
    panel('Warm timber panels behind the counter',0,1.16,-3.298,6.66,2.06,'Natural walnut veneered boards',3.25,1.45)
    # Small rear bar and separate racks can be seen behind the perforated metal.
    for j,(x,w) in enumerate([(-2.68,1.0),(-1.56,1.03),(-.37,1.08),(2.61,.96)]):
        rack(x,1.32,-2.83,w,1.25,j)
    box(.98,.54,-2.84,1.65,.83,.49,'cedar')
    panel('Back counter apron',.98,.52,-2.57,1.57,.69,'Natural walnut veneered boards',.9,.55)
    box(.98,.987,-2.82,1.7,.078,.55,'countertop',.009)
    g.mug(.56,1.03,-2.77,.78);g.carafe(1.33,1.03,-2.79,.63,'turquoise')
    # A discreet in-room mark; the actual public facade has no retail fascia.
    panel('Coffee room name inside the recess',1.04,1.76,-3.14,1.60,.242,'Forest House lettering')
    for x in (-2.36,-.75,1.03,2.65):
        box(x,2.09,-2.25,1.08,.045,.10,'lanternLight',.010)
    # Rear sliding glazed doors, side jamb and inside window return.
    for x,w in [(-2.55,1.48),(-1.12,1.31),(.26,1.34),(1.66,1.36),(2.82,.86)]:
        casing(x,1.20,-1.61,w,1.99,.066,'cedar',.047)
        if x<2:panel('Glass in recessed sliding panel',x,1.21,-1.64,w-.09,1.87,'shop glass')
    box(2.81,1.14,-.92,.047,2.04,1.32,'reveal',.003)
    box(2.2,.26,-.85,.22,.25,1.56,'alabaster')
    section('C / sliding perforated screens and off-centre entry')
    # Large sliding panels occupy the west 43%, east panel 17%, clear passage at +1.06m.
    for left,right in [(-2.88,-1.83),(-1.82,-.69),(-.68,-.18),(2.16,3.16)]:
        width=right-left;cx=(left+right)/2
        casing(cx,1.132,.013,width,2.026,.074,'alabaster',.045)
        panel('Perforated screen',cx,1.13,.003,width-.056,1.95,'Punched metal sliding doors',width/.22,1.95/.22)
        box(cx,.151,.045,width-.045,.044,.091,'sill',.005)
    for x in (-.18,2.12):box(x,1.15,-.075,.066,2.06,.17,'brightedge')
    for x in (-.28,2.23):box(x,1.04,.071,.026,.18,.058,'sill',.003)
    box(2.19,.13,-.095,.30,.11,.42,'alabaster',.005)
    box(.99,.138,-.62,2.25,.033,1.19,'plinth',.01)
    box(.97,.157,-.98,1.28,.012,.46,'wornTeal',.004)
    for zz in (-.16,-.25):box(-1.55,.130,zz,2.75,.017,.02,'flashing',0)
    # The reference passage is bordered by low planting and taller stems behind the mesh.
    # All growth stays inside the facade reveal and clear of the opening.
    lower=Specimen('Sheltered planting behind the punched sliders',721)
    lower.camellia(-.29,.146,-.99,1.61)
    for xx,zz,size,cell in [(-.49,-.73,.83,0),(-.84,-.62,.58,7),(-2.94,-.75,.75,2),
                            (-2.56,-.52,.32,1),(-.31,-.73,.32,1),(-.13,-.98,.27,3)]:
        lower.rosette(xx,.145,zz,size,cell,12)
    for xx,zz in [(-.28,-.53),(-.52,-.52),(-.79,-.48),(-2.79,-.48),(-2.98,-.44)]:
        lower.fern(xx,.148,zz,.32)
    lower.finish()
    section('D / inhabited upper storey and operable garden glazing')
    box(0,2.63,-2.49,6.84,.17,4.67,'reveal')
    box(0,4.16,-3.65,6.05,2.99,.15,'shadeBrown')
    panel('Upper timber interior back wall',0,4.22,-3.56,5.98,2.98,'Natural walnut veneered boards',3,.9)
    for x in (-2.78,-1.72,-.69,.37,1.43,2.44):
        box(x,4.23,-1.86,.08,3.13,.12,'cedar',.004)
    for y in (3.16,3.68,4.77,5.37,5.65):
        box(0,y,-1.83,5.86,.069,.14,'cedar',.004)
    for x,y,w,h in [(-2.33,3.36,.72,.43),(-.17,3.36,.76,.43),(.73,3.36,.78,.43),
                     (2.33,3.39,.58,.45),(-.21,4.99,.69,.54),(.6,5.0,.67,.55)]:
        box(x,y,-2.58,w,h,.03,'haze' if x<1 else 'frost',.005)
        casing(x,y,-2.11,w+.08,h+.07,.07,'cedar',.035)
        box(x-w*.23,y,-2.064,.024,h,.027,'beam',.002)
        if y>4:
            for row in range(5):
                box(x,y+h*.38-row*h*.095,-2.491,w-.035,.026,.033,'countertop',.002)
    box(0,5.88,-2.67,6.03,.12,3.49,'sill',.008)
    for xx in (-2.56,2.57):
        box(xx,5.94,-2.71,.78,.074,3.38,'reveal',.005)
    # Upper skin slopes back from the street, with a roof edge narrowed in the reference view.
    def skin(u,y):
        t=(y-2.64)/3.28
        return (u*(3.54-.41*t),y,-.09-.97*t)
    def sheet(name,ul,ur,y1,y2):
        points=[skin(ul,y1),skin(ur,y1),skin(ur,y2),skin(ul,y2)]
        quad(name,points,'Light through polycarbonate webs',((0,0),((ur-ul)*2.6,0),((ur-ul)*2.6,(y2-y1)*.52),(0,(y2-y1)*.52)))
    # The continuous running row of small windows is cut into the surface as openings.
    sheet('Continuous bottom ribbon',-1,1,2.64,3.15)
    for a,b in [(-1,-.87),(-.65,-.45),(.21,.45),(.68,1)]:sheet('Skin between hopper windows',a,b,3.15,3.53)
    for a,b in [(-1,-.64),(-.38,.18),(.47,.71),(.92,1)]:sheet('Skin between planting pockets',a,b,3.53,4.04)
    for a,b in [(-1,-.68),(-.40,-.16),(.13,.23),(.51,1)]:sheet('Upper skin around double-height opening',a,b,4.04,4.71)
    for a,b in [(-1,-.70),(-.43,-.15),(.13,.25),(.56,1)]:sheet('Upper floor glazing return',a,b,4.71,5.61)
    sheet('Flat upper head flashing',-1,1,5.61,5.92)
    for y in (2.64,3.15,3.53,4.02,4.69,5.60,5.92):
        aa,bb=skin(-1,y),skin(1,y)
        rod(aa,bb,.024 if y<5.9 else .038,'brightedge',6)
    for u in (-1,-.75,-.50,-.25,0,.25,.50,.75,1):
        rod(skin(u,2.65),skin(u,3.13),.014,'aluminium',5)
    for u in (-1,1):rod(skin(u,2.64),skin(u,5.92),.032,'aluminium',7)
    # Narrow pale side returns keep the folded outer envelope legible at an angle.
    for side in (-1,1):
        quad('Multiwall flank',[skin(side,2.64), (side*3.30,2.64,-3.67),
                               (side*3.00,5.92,-3.67),skin(side,5.92)],
             'Light through polycarbonate webs',((0,0),(2.5,0),(2.5,1.5),(0,1.5)))
    section('E / high narrow sash, punched balcony edge and hopper stays')
    # The 1707px frontal reference shows a vertical high window slightly left of centre.
    # Its clear opening sits well behind the perforated gallery apron.
    wx=-.25
    box(wx,5.27,-1.62,.86,.80,.056,'reveal',.006)
    box(wx-.16,5.26,-1.575,.39,.64,.020,'wornTeal',.003)
    box(wx+.22,5.26,-1.575,.29,.64,.020,'haze',.003)
    casing(wx,5.27,-1.15,.87,.85,.105,'aluminium',.050)
    box(wx,5.63,-1.087,.80,.11,.072,'cedar',.002)
    box(wx+.082,5.26,-1.083,.034,.68,.074,'sill',.002)
    box(wx,4.866,-1.071,.92,.06,.19,'brightedge',.003)
    # Balcony spans the middle of the skin, with a lapped perforated centre and two wings.
    # Its bottom/handrail follow the inclined polycarbonate plane, standing clear of it.
    for left,right in [(-1.54,-.68),(-.68,.15),(.15,.94)]:
        y0,y1=4.58,4.91
        zb=skin(0,y0)[2]+.093;zt=skin(0,y1)[2]+.093
        quad('Perforated gallery apron',
             [(left,y0,zb),(right,y0,zb),(right,y1,zt),(left,y1,zt)],
             'Punched metal sliding doors',((0,0),((right-left)/.23,0),((right-left)/.23,1.47),(0,1.47)))
        rod((left,y1,zt),(right,y1,zt),.023,'brightedge',6)
        rod((left,y0,zb),(right,y0,zb),.017,'aluminium',6)
        rod((left,y0,zb),(left,y1,zt),.017,'aluminium',6)
    rod((.94,4.58,zb),(.94,4.91,zt),.017,'aluminium',6)
    section('E / four open hopper sashes, planted vent boxes and real canopies')
    for u1,u2 in [(-.87,-.65),(-.44,-.16),(-.15,.21),(.45,.68)]:
        a,b=skin(u1,3.55),skin(u2,3.55)
        c=(b[0],b[1]-.17,b[2]+.32);d=(a[0],a[1]-.17,a[2]+.32)
        quad('Outward opening sash',[d,c,b,a],'Hopper light reflected in glazing')
        for pp,qq in [(a,b),(b,c),(c,d),(d,a)]:rod(pp,qq,.025,'brightedge',6)
        for pp in (c,d):rod((pp[0],3.26,a[2]-.01),pp,.011,'flashing',5)
    for xx,yy,zz,w,h,variant in [(-1.91,4.33,-.39,1.09,2.50,0),
                                      (1.08,4.05,-.48,1.09,2.32,1),
                                      (2.77,3.59,-.24,.81,1.41,2)]:
        depth=(.66,.56,.48)[variant];height=(.47,.35,.33)[variant]
        box(xx,yy-height/2,zz,w,height,depth,'alabaster',.008)
        box(xx,yy+.01,zz,w-.054,.035,depth-.08,'shadeBrown',.001)
        box(xx,yy-height,zz,w+.02,.023,depth+.02,'brightedge',.002)
        crown_width = (2.27,2.45,1.29)[variant]
        facade_tree(xx,yy+.017,zz+.03,crown_width,h,variant)
    finish('cafe-front')


def panel_table(x,z,large=False):
    # Table height and tea service are life-size; the chairs/banquettes follow the navigation footprint.
    profile(x,.045,z,[(0,.265),(.025,.305),(.044,.28),(.095,.14)],'ironwork',18)
    g.cyl(x,.39,z,.043,.63,'dullBrass',12)
    profile(x,.717,z,[(0,.43),(.015,.548),(.054,.553),(.069,.542)],'countertop',24)
    g.mug(x-.14,.786,z+.075,.68,'ceramic')
    g.carafe(x+.20,.786,z-.098,.50,'turquoise')
    if large:
        g.platter(x+.09,.786,z+.18,.13,'ceramic');g.bun(x+.11,.814,z+.17,.61,220)
        # Bent-tube stool pulled underneath the table. Its feet stay within the collision footprint.
        xx=x-.31;zz=z-.16
        g.cyl(xx,.455,zz,.15,.042,'cedar',14)
        for dx,dz in [(-.06,-.075),(.06,-.075),(0,.074)]:
            rod((xx+dx*.65,.438,zz+dz*.65),(xx+dx*1.8,.048,zz+dz*1.8),.015,'ironwork',7)
    else:
        box(x+.07,.800,z+.187,.238,.015,.165,'service',.002)
        box(x+.07,.812,z+.152,.201,.005,.022,'redwood',0)
        for j in range(3):box(x+.05,.812,z+.181+j*.025,.158,.004,.007,'shadeBrown',0)
    for k in range(2):
        rod((x-.06+k*.020,.797,z+.25),(x+.08+k*.020,.797,z+.24),.004,'dullBrass',5)


def tint_interior(name,linear_factor,emission):
    mat=g.materials[name]
    tree=mat.node_tree
    tex=next(n for n in tree.nodes if n.type=='TEX_IMAGE')
    bs=tree.nodes.get('Principled BSDF')
    mult=tree.nodes.new('ShaderNodeMixRGB')
    mult.blend_type='MULTIPLY'
    mult.inputs[0].default_value=1
    mult.inputs[2].default_value=(*linear_factor,1)
    tree.links.new(tex.outputs['Color'],mult.inputs[1])
    tree.links.new(mult.outputs[0],bs.inputs['Base Color'])
    bs.inputs['Emission Strength'].default_value=emission


def ceiling():
    section('H / ceiling, full-height inner linings and shoji')
    for name,colour,emission in [
        ('Ceiling smoked walnut','4c433e',.18),('Ceiling walnut boards','584a40',.18),
        ('Ceiling timber beam','544134',.17),('Ceiling end grain','766452',.14),
        ('Grid bronze','554b3d',.14),('Shoji diffuser','e9d9b5',.95),
        ('Shoji divider','aa997b',.38),('Fan aged metal','4d4c45',.20),
        ('Interior return walls','64584a',.13),('Interior door light','8c9d8c',.24)]:
        material(name,colour,emission)
    # Clip plane: the walk camera sits outside the entry. Inner faces are visible from
    # conversations; looking in from the camera side culls that wall automatically.
    wall=g.materials['Interior return walls']
    wall.use_backface_culling=True
    def front_lining(x1,x2,y1,y2,z,finish):
        g.materials[finish].use_backface_culling=True
        quad('Entry wall indoor face',[(x2,y1,z),(x1,y1,z),(x1,y2,z),(x2,y2,z)],finish)
    for sx in (-1,1):
        x=sx*6.60
        for z,d,h in [(-3.37,2.87,3.48),(-.99,1.91,2.24),(2.41,4.89,.62)]:
            box(x,(3.66+h)/2,z,.16,3.66-h+.02,d,'Interior return walls',.006)
        # Shadowed picture rail gives the formerly open cutaway its top joint.
        box(x-sx*.068,3.32,-.02,.082,.079,9.52,'Ceiling timber beam',.002)
    for x1,x2 in [(-6.56,-.92),(.92,6.56)]:front_lining(x1,x2,.03,3.61,4.78,'Interior return walls')
    front_lining(-.96,.96,2.17,3.61,4.78,'Interior return walls')
    # Two narrow reeded lights are visible when turning from the bar toward the entrance.
    for x in (-3.43,3.44):
        front_lining(x-.83,x+.83,1.48,1.98,4.762,'Interior door light')
        for j in range(7):
            xx=x-.75+j*.25
            front_lining(xx,xx+.026,1.48,1.98,4.751,'Ceiling timber beam')
    # Ceiling underside is at 3.61m. The overrun toward +Z fills the lens when the
    # camera is outside the cutaway shell; the walkable room still ends at 4.8m.
    for i in range(16):
        x=(i-7.5)*.83
        box(x,3.71,2.90,.83,.176,15.52,
            'Ceiling walnut boards' if i%3==1 else 'Ceiling smoked walnut',.002)
    for xx in (-5.93,-2.76,.75,4.72):
        box(xx,3.57,2.8,.105,.11,15.2,'Ceiling timber beam',.004)
    for zz in (-4.38,-.24,3.95,7.92):
        box(0,3.47,zz,13.1,.25,.148,'Ceiling timber beam',.006)
        box(0,3.351,zz+.07,13.1,.018,.018,'Ceiling end grain',.002)
    # One broad recessed luminous grid over the bar. The fixture's outer wood rim,
    # translucent tatami-like lites and double line brass dividers occupy real depths.
    cx,cz=-2.55,-.15
    w,d=5.25,4.18
    box(cx,3.448,cz,w+.21,.229,d+.21,'Ceiling timber beam',.009)
    box(cx,3.325,cz,w+.075,.054,d+.075,'Grid bronze',.005)
    box(cx,3.286,cz,w,.030,d,'Shoji diffuser',.002)
    # Give the grazing game camera enough depth between each transverse line to read the light.
    for j in range(10):
        xx=cx-w*.5+j*w/9
        box(xx,3.260,cz,.036,.029,d+.015,'Grid bronze',.001)
    for j in range(7):
        zz=cz-d*.5+j*d/6
        box(cx,3.258,zz,w+.025,.031,.041,'Grid bronze',.001)
        if j not in (0,6):
            box(cx,3.269,zz+.061,w-.035,.012,.013,'Shoji divider',0)
    # Stationary three-blade fan in the seating bay; the silhouette is separate from the light panel.
    x,y,z=2.74,3.16,-.96
    rod((x,3.61,z),(x,y+.032,z),.029,'Fan aged metal',9)
    g.cyl(x,y+.017,z,.105,.10,'Fan aged metal',14)
    for i in range(3):
        a=.38+i*math.tau/3
        blade=[(.055,-.033),(.275,-.10),(.655,-.108),(.714,-.042),(.659,.035),(.20,.077),(.056,.03)]
        vs=[(x+u*math.cos(a)-v*math.sin(a),y+.019*u,z+u*math.sin(a)+v*math.cos(a)) for u,v in blade]
        solid(vs,[tuple(range(len(vs))),tuple(reversed(range(len(vs))))],'Ceiling end grain')
    g.cyl(x,y-.049,z,.077,.038,'Fan aged metal',12)


def cafe():
    start()
    pixels('OOO Forest House drawing plates','forest-studio-prints',.26)
    tint_interior('Natural walnut veneered boards',(.54,.72,.78),.075)
    tint_interior('Quarry tile and grout',(.67,.79,.84),.08)
    material('countertop','a79880',.12)
    section('A / pale-mortar kiln brick floor and cutaway walls')
    box(0,-.11,0,13.25,.25,9.65,'tileEdge',.02)
    floor('Continuous fired clinker with mortar joints',0,0,13.14,9.56,.033,'Quarry tile and grout',1.20)
    box(0,1.80,-4.78,13.26,3.61,.20,'beam',.012)
    panel('Matched walnut back wall',0,1.8,-4.665,13.04,3.57,'Natural walnut veneered boards',6.5,1.32)
    for sx in (-1,1):
        # The front wall is cut away; side-wall height steps down toward the player.
        x=sx*6.58
        for z,d,h in [(-3.37,2.87,3.48),(-.99,1.91,2.24),(2.41,4.89,.62)]:
            box(x,h/2,z,.18,h,d,'redwood',.010)
            box(x-sx*.007,h,z,.189,.052,d,'countertop',.003)
            box(x-sx*.01,.091,z,.212,.159,d,'shadeBrown',.004)
    section('B / long timber soffit and luminous shoji borrowed light')
    # The cafe interior photo has coffered dark timber, a single luminous overhead grid
    # and a low, compact backbar silhouette. The cutaway keeps seven members visible.
    for x,w in [(-5.42,2.23),(-1.13,5.76),(4.08,5.06)]:
        box(x,3.52,-4.03,w,.131,1.53,'redwood',.008)
    for xx in (-5.94,-4.32,-2.70,-1.08,.54,2.16,3.78,5.40):
        box(xx,3.46,-3.97,.087,.187,1.67,'shadeBrown',.003)
    box(0,3.42,-3.18,13.08,.20,.155,'redwood',.007)
    # Emitting face just below the ceiling, with transverse and axial timbers.
    box(-3.54,3.365,-3.55,4.12,.056,.68,'barLight',.004)
    box(-3.54,3.33,-3.56,4.18,.045,.045,'countertop',.003)
    for i in range(13):
        box(-5.57+i*.338,3.325,-3.55,.026,.044,.76,'beam',.002)
    room_floor_lamps()
    section('C / clearstory planting, shoji and built-in library')
    # A cool garden seen through framed windows at right balances the amber bar.
    box(3.98,2.06,-4.62,4.43,2.34,.098,'shadow',.013)
    for i,x in enumerate((2.44,3.45,4.46,5.48)):
        casing(x,2.08,-4.53,1.01,2.14,.094,'cedar',.058)
        lo=(i+.010)/4;hi=(i+.990)/4
        quad('Garden and blue-hour windows through pane '+str(i),
             [(x-.477,1.035,-4.540),(x+.477,1.035,-4.540),(x+.477,3.106,-4.540),(x-.477,3.106,-4.540)],
             'Rain through four panes',((lo,0),(hi,0),(hi,1),(lo,1)))
        for yy in (1.56,2.58):box(x,yy,-4.462,.91,.039,.065,'beam',.002)
        box(x,2.06,-4.459,.033,1.98,.063,'beam',.002)
    for x in (1.86,6.04):
        box(x,.63,-4.56,.20,1.00,.15,'cedar')
    # Seven people do not share one giant bar. This is a separate wall of small coffee tins.
    for i,x in enumerate((-5.12,-4.02,-2.92,-1.82,-.72)):
        if i in (0,4):
            rack(x,2.09,-4.38,1.035,1.28,i%4,False)
            continue
        box(x,2.09,-4.53,1.05,1.30,.09,'shadeBrown',.004)
        for side in (-1,1):box(x+side*.51,2.09,-4.40,.049,1.28,.32,'cedar',.003)
        for j,yy in enumerate((1.47,1.87,2.31,2.73)):
            box(x,yy,-4.39,1.06,.043,.35,'countertop',.003)
            if j==3:continue
            for k,xx in enumerate((x-.33,x-.06,x+.25)):
                if (k+j+i)%3==0:g.carafe(xx,yy+.025,-4.37,.67,('turquoise','ceramic','wine')[j])
                else:g.mug(xx,yy+.024,-4.34,.61,('ceramic','turquoise','wine')[(i+k)%3],False)
    box(-2.95,2.79,-4.29,5.53,.049,.063,'barLight',.005)
    panel('Coffee list on wall',.72,2.14,-4.54,1.02,.80,'Coffee menu')
    box(.72,1.61,-4.534,1.09,.042,.095,'countertop',.004)
    section('D / under-counter joinery, espresso service and hand-thrown ware')
    box(-2.3,.54,-4.28,7.41,1.04,.68,'beam',.008)
    panel('Vertical grain of low cabinets',-2.30,.55,-3.915,7.35,.94,'Natural walnut veneered boards',5.15,.71)
    box(-2.30,1.08,-4.24,7.45,.09,.76,'service',.008)
    for i in range(9):
        x=-5.98+i*.82
        box(x,.55,-3.91,.021,.91,.023,'shadeBrown',0)
        box(x+.33,.91,-3.88,.18,.018,.044,'dullBrass',.003)
    g.espresso_machine(-4.53,1.13,-4.20);g.grinder(-3.45,1.13,-4.16)
    for i,x in enumerate((-5.64,-2.85,-2.53,-2.21,-.13,.15)):
        if i%3==0:g.carafe(x,1.13,-4.18,.73,'turquoise')
        else:g.mug(x,1.13,-4.15,.67,'ceramic')
    # Sink, high faucet, wand and inset drain; visible in the close conversation camera.
    box(-1.29,1.128,-4.21,.62,.015,.39,'chrome',.019)
    box(-1.29,1.14,-4.21,.48,.012,.27,'ironwork',.017)
    g.tube([(-1.48,1.14,-4.37),(-1.48,1.45,-4.37),(-1.48,1.50,-4.29),(-1.48,1.50,-4.18),(-1.48,1.44,-4.15)],.018,'chrome',8)
    section('E / freestanding brass footrail and walnut bar')
    x,z=-3.615,-1.675
    box(x,.54,z,4.37,1.03,1.00,'shadeBrown',.018)
    panel('Front counter quarter-matched timber',x,.53,-1.155,4.26,.88,'Natural walnut veneered boards',2.85,.65)
    for i in range(7):
        xx=x-2.10+i*.7
        box(xx,.54,-1.147,.044,.95,.042,'cedar',.004)
    for y in (.134,.945):box(x,y,-1.145,4.24,.048,.040,'beam',.003)
    box(x,1.055,z,4.44,.106,1.09,'countertop',.022)
    for xx in (-5.54,-3.60,-1.71):rod((xx,.17,-1.17),(xx,.17,-.99),.020,'dullBrass',8)
    rod((-5.64,.17,-.988),(-1.62,.17,-.988),.022,'dullBrass',9)
    g.platter(-3.61,1.114,-1.61,.25,'ceramic')
    for i in range(3):g.bun(-3.73+i*.115,1.14,-1.63+(i%2)*.07,.61,230+i)
    for i in range(2):g.mug(-3.03+i*.30,1.118,-1.64,.70,('ceramic','turquoise')[i])
    # Hand-brewing station. Pour-over cone, stand and glass server have separate depths and silhouettes.
    box(-4.76,1.122,-1.61,.44,.021,.29,'wornTeal',.004)
    g.carafe(-4.72,1.132,-1.61,.54,'chrome')
    rod((-4.93,1.16,-1.67),(-4.93,1.52,-1.67),.019,'dullBrass',7)
    rod((-4.93,1.51,-1.67),(-4.74,1.51,-1.64),.015,'dullBrass',7)
    profile(-4.72,1.405,-1.61,[(0,.034),(.016,.063),(.160,.124),(.175,.126)],'ceramic',14)
    g.cyl(-4.72,1.582,-1.61,.105,.004,'espresso',14)
    for j in range(6):
        a=j*math.tau/6
        rod((-4.72+.063*math.cos(a),1.448,-1.61+.063*math.sin(a)),(-4.72+.119*math.cos(a),1.564,-1.61+.119*math.sin(a)),.004,'dullBrass',4)
    box(-4.23,1.127,-1.39,.36,.026,.27,'ceramic',.006)
    box(-4.23,1.147,-1.36,.33,.022,.20,'paperBlue',.006)
    for dx in (-.10,-.075):box(-4.23+dx,1.161,-1.36,.009,.005,.18,'wornTeal',0)
    box(-1.93,1.138,-1.68,.39,.058,.28,'shadeBrown',.012)
    box(-1.93,1.265,-1.74,.28,.22,.065,'ironwork',.012)
    panel('Till screen',-1.93,1.265,-1.698,.235,.17,'wornTeal')
    profile(-5.38,1.111,-1.65,[(0,.20),(.035,.23),(.115,.27),(.129,.267)],'wornTeal',24)
    g.cyl(-5.38,1.239,-1.65,.25,.009,'earth',20)
    bonsai=Specimen('Counter black pine / clipped needle pads',489)
    bonsai.pine(-5.38,1.245,-1.65,.80)
    bonsai.fern(-5.56,1.246,-1.61,.10,6)
    bonsai.finish()
    # Planted brackets occupy wall space away from the bar sightline and walking path.
    for x,yy,zz,size in [(-5.84,2.99,-4.30,.49),(5.86,2.80,-4.27,.66)]:
        box(x,yy-.092,zz,.48,.050,.38,'countertop',.009)
        g.pot(x,yy-.065,zz,.12,.155,'turquoise')
        hanging=Specimen('Trailing satin pothos',int(size*100))
        hanging.rosette(x,yy+.09,zz,.21,1,11)
        hanging.vine(x,yy+.11,zz+.12,size,4)
        hanging.finish()
    # One white spathe and long lanceolate leaves catch the garden light east of the counter.
    g.pot(1.69,.038,-4.12,.28,.39,'ceramic')
    lily=Specimen('Peace lily at the garden window',193)
    lily.rosette(1.69,.43,-4.12,.83,0,15,True)
    lily.finish()
    section('F / east banquette, listening tables and café services')
    box(5.95,.27,-1.23,.76,.49,4.91,'redwood',.025)
    box(6.29,.85,-1.23,.15,1.01,4.93,'beam',.023)
    for i in range(6):
        zz=-3.28+i*.815
        box(5.96,.52,zz,.74,.109,.79,'wornTeal',.031)
        box(6.20,.86,zz,.108,.61,.79,'wornTeal',.028)
        box(6.127,.60,zz,.010,.036,.72,'ironwork',.002)
    for i,(xx,zz) in enumerate(((4.48,-2.75),(4.62,.30),(-4.87,2.46))):
        panel_table(xx,zz,i==2)
    # The two small galleries share the sitters' eye line. Actual OOO plates are
    # dry-mounted slightly forward of the wood liner; the brackets carry physical samples.
    for west,zz,yy,w,plate in [(True,-2.42,1.69,1.04,0),(False,-1.50,1.71,.86,1)]:
        side=-1 if west else 1
        h=w*210/224
        x=side*6.448
        box(x,yy,zz,.083,h+.07,w+.07,'shadeBrown',.009)
        box(x-side*.041,yy,zz,.029,h+.026,w+.026,'dullBrass',.003)
        xx=x-side*.060
        # Reading direction reverses across the lane, and for the two opposite walls.
        z0,z1=zz-side*w/2,zz+side*w/2
        uv=((plate/2,0),((plate+1)/2,0),((plate+1)/2,1),(plate/2,1))
        quad('Framed Forest House '+('axonometric' if west else 'floor study'),
             [(xx,yy-h/2,z0),(xx,yy-h/2,z1),(xx,yy+h/2,z1),(xx,yy+h/2,z0)],
             'OOO Forest House drawing plates',uv)
    box(-6.39,1.27,-1.49,.24,.045,.65,'countertop',.006)
    for j,sample_finish in enumerate(('flashing','cedar','ceramic')):
        zz=-1.69+j*.185
        box(-6.391,1.358,zz,.061,.135,.134,sample_finish,.004)
        box(-6.427,1.305,zz,.089,.022,.151,'shadeBrown',.003)
    # Small amber-glazed bud vase with a single branch at the east reading table.
    profile(4.62,.792,.23,[(0,.049),(.015,.064),(.064,.070),(.104,.036),(.141,.029),(.144,.034)],'wine',16)
    g.cyl(4.62,.936,.23,.026,.004,'espresso',12)
    specimen=Specimen('Camellia cutting in an oxblood bud vase',106)
    foot=Vector((4.62,.937,.23))
    tip=foot+Vector((.059,.15,-.011))
    specimen.stem(foot,tip,.003)
    for j in range(3):
        p=foot.lerp(tip,.38+j*.27)
        specimen.leaf(3,p,j*2.1,.062,.024,.022,.19,.50)
    specimen.finish()
    g.pot(5.85,.047,3.32,.36,.45,'wornTeal')
    clump=Specimen('Banquette planting / tall cast iron and variegated leaves',711)
    clump.rosette(5.85,.502,3.32,1.02,2,16)
    clump.fern(5.69,.505,3.45,.39)
    clump.rosette(5.96,.503,3.48,.43,1,10)
    clump.finish()
    # Reading ledge and stacked journals sit entirely within the east banquette footprint.
    box(5.89,.622,.78,.64,.06,.51,'countertop',.01)
    for j,(col,w) in enumerate([('shadeBrown',.34),('paperBlue',.30),('redwood',.32)]):
        box(5.94,.675+j*.026,.78,w,.020,.22,col,.002)
    g.mug(5.70,.65,.73,.54,'turquoise')
    # Door leaf and trim sit OUTSIDE the navigation polygon. Inside entry/exit stays passable.
    section('G / removable foreground entry frame')
    box(.88,1.11,4.69,.061,2.13,.09,'cedar',.004)
    box(-.88,1.11,4.69,.061,2.13,.09,'cedar',.004)
    box(0,2.18,4.69,1.81,.084,.099,'cedar',.004)
    box(0,.058,4.43,1.79,.025,.47,'wornTeal',.006)
    for i in range(9):box(0,.073,4.25+i*.046,1.72,.006,.013,'ironwork',0)
    ceiling()
    finish('cafe')


def finish(name):
    for title,(collection,group) in g.sects.items():
        for m,(verts,faces) in group.items():
            mesh=bpy.data.meshes.new(title+' / '+m)
            mesh.from_pydata(verts,[],faces)
            mesh.materials.append(g.materials[m])
            collection.objects.link(bpy.data.objects.new(mesh.name,mesh))
    sc=bpy.context.scene
    sc['building']='Forest-Wanna-Be House / OOO'
    sc['scale']='metres / axes in build.py expressed as east, up, street'
    sc['entry']='facade centre +1.06 m, clear height 2.10 m'
    sc['finish']='Pixel textures from brush recipes or the studio photograph; native PNGs packed'
    studio=bpy.data.collections.new('Studio preview only')
    sc.collection.children.link(studio)
    is_front=name=='cafe-front'
    camdata=bpy.data.cameras.new('Elevation lens')
    cam=bpy.data.objects.new('Elevation lens',camdata);studio.objects.link(cam)
    target=Vector(swizzle((0,3.04,-.35) if is_front else (-1.0,1.40,-1.02)))
    cam.location=swizzle((.18,3.50,15.1) if is_front else (1.8,2.85,6.8))
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    camdata.lens=40 if is_front else 31;sc.camera=cam
    sc.render.engine='CYCLES';sc.cycles.samples=16;sc.render.resolution_x=800;sc.render.resolution_y=650
    sc.render.resolution_percentage=100
    world=bpy.data.worlds.new('Blue-green city night');world.use_nodes=True;sc.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.20,.21,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45
    for pos,color,energy,size in [((-3,7,5),(.51,.75,.78),470,6),
                                  ((-.5,2.15,-1.3) if is_front else (-3,2.89,-2.5),(1,.67,.36),190 if is_front else 450,3),
                                  ((5,3,2),(.47,.65,.72),160,4)]:
        l=bpy.data.lights.new('Architectural preview fill','AREA');l.color=color;l.energy=energy;l.size=size
        ob=bpy.data.objects.new(l.name,l);studio.objects.link(ob);ob.location=swizzle(pos)
        ob.rotation_euler=(target-ob.location).to_track_quat('-Z','Y').to_euler()
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                view=area.spaces.active;view.region_3d.view_distance=13
                view.region_3d.view_location=target;view.region_3d.view_rotation=cam.rotation_euler.to_quaternion()
                view.shading.color_type='MATERIAL'
    # The .blend keeps collections and individual printed sheets. Only the runtime file is batched.
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/(name+'.blend')),compress=True)
    meshes=[o for o in sc.objects if o.type=='MESH']
    grouped=defaultdict(list)
    for obj in meshes:
        layer='Forest_'
        if any(c.name.startswith('G / removable') for c in obj.users_collection):
            layer='Cutaway_FrontEntry_'
        elif any(c.name.startswith('H / ceiling') for c in obj.users_collection):
            layer='Ceiling_'
        grouped[(layer,obj.data.materials[0].name)].append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    batch=[]
    for (layer,material_name),objects in grouped.items():
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:bpy.ops.object.join()
        obj=bpy.context.view_layer.objects.active
        obj.name=layer+(material_name.removeprefix('Ceiling ') if layer=='Ceiling_' else material_name)
        obj.select_set(False);batch.append(obj)
    for obj in batch:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),use_selection=True,export_format='GLB',
                              export_animations=False,export_lights=False,export_cameras=False)
    print('COMPLETE',name,'with',len(batch),'material batches')


if __name__=='__main__':
    requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['cafe-front','cafe']
    if 'cafe-front' in requested:front()
    if 'cafe' in requested:cafe()
