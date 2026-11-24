"""Botanical studies in metres: atlas-backed folded leaves and structural timber.

Positions use east, up, street axes to match the facade survey in build.py.
The Blender masters keep each specimen separately editable. Runtime export
batches them by material so additional leaves do not add draw calls.
"""
import math
import random
import bpy
from mathutils import Vector
import build_cafe as g


class Specimen:
    def __init__(self, name, seed, outside=False):
        self.name = name
        self.random = random.Random(seed)
        self.material = 'Botanical rain leaves' if outside else 'Room herbarium leaves'
        self.verts, self.faces, self.uv = [], [], []

    def leaf(self, cell, base, angle, length, width, rise, bow=.13, tilt=.43):
        """A folded ribbon that exposes the lighter upper surface and shadowed turned edge."""
        forward = Vector((math.cos(angle), 0, math.sin(angle)))
        up = Vector((0, 1, 0))
        side = Vector((-forward.z, tilt, forward.x)).normalized()
        offset = len(self.verts)
        for t in (0, .3, .64, 1):
            hump = math.sin(math.pi*t)
            axis = Vector(base) + forward*(length*t) + up*(rise*t + length*bow*hump)
            for across in (-1, 0, 1):
                point = axis + side*(width*.5*across) + up*((1-abs(across))*.08*width*hump)
                self.verts.append(g.swizzle(point))
                # Atlas coordinates inset by half a texel and oriented base-to-tip.
                u = ((cell%4)*64+.5+(across+1)*31.5)/256
                v = 1-((cell//4)*64+.5+(1-t)*63)/128
                self.uv.append((u,v))
        for j in range(3):
            for k in (0,1):
                idx = offset+j*3+k
                self.faces.append((idx,idx+1,idx+4,idx+3))

    def finish(self):
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts, [], self.faces)
        uv = mesh.uv_layers.new(name='Individual species in native pixel atlas')
        for loop in mesh.loops:
            uv.data[loop.index].uv = self.uv[loop.vertex_index]
        mesh.materials.append(g.materials[self.material])
        g.current[0].objects.link(bpy.data.objects.new(self.name,mesh))

    def stem(self, a, b, r, tip=None):
        g.rod(a,b,r,'Living petioles',5,tip if tip else .72*r)

    def rosette(self, x, y, z, scale, cell, count=14, flowering=False):
        base = Vector((x,y,z))
        for n in range(count):
            a = n*2.39996 + self.random.uniform(-.14,.14)
            t = (n+.5)/count
            spread = scale*(.39+.46*t)*self.random.uniform(.85,1.13)
            petiole = base+Vector((math.cos(a)*scale*(.05+.11*t),scale*(.62-.33*t),math.sin(a)*scale*(.05+.11*t)))
            self.stem(base,petiole,scale*.0085)
            self.leaf(cell,petiole,a,spread,scale*(.17+.10*t),scale*(.33-.51*t),.26,self.random.uniform(-.6,.9))
        if flowering:
            for a,ratio in [(1.5,.87),(-.65,1.05)]:
                flower = base+Vector((.08*scale*math.cos(a),ratio*scale,.12*scale*math.sin(a)))
                self.stem(base,flower,scale*.009)
                self.leaf(6,flower,a,.13*scale,.16*scale,.25*scale,.2,.8)
                top = flower+Vector((.027*scale,.145*scale,.018*scale))
                g.rod(flower,top,.015*scale,'Pollen',7,.012*scale)

    def fern(self, x, y, z, scale, count=11):
        for i in range(count):
            angle=i*2.39996+self.random.uniform(-.17,.17)
            r=scale*self.random.uniform(.38,.88)
            self.leaf(4,(x,y,z),angle,r,r*.44,scale*self.random.uniform(.08,.45),.48,
                      self.random.uniform(-.8,1))

    def vine(self, x, y, z, length, strands=3):
        for j in range(strands):
            a=j*2.12+.7
            p=Vector((x+.028*j,y,z))
            for k in range(8):
                step=length/8
                q=p+Vector((math.cos(a+k*.58)*step*.37,-step*(.37 if k<2 else .84),step*(.55 if k<2 else .02)))
                self.stem(p,q,max(.0025,length*.004))
                self.leaf(1,q,a+(-1)**k*.95,length*.165,length*.092,-length*.065,.16,.6)
                p=q

    def pine(self, x, y, z, scale):
        """Asymmetric black pine: tapering trunk, open branch intervals and planar needle pads."""
        base=Vector((x,y,z))
        knots=[base+Vector((dx,dy,dz))*scale for dx,dy,dz in
               [(0,0,0),(-.08,.13,-.02),(.04,.27,.04),(.13,.46,.05),(.07,.64,.02),(.18,.79,-.03)]]
        for i in range(len(knots)-1):
            g.rod(knots[i],knots[i+1],scale*(.059-i*.009),'Rain dark bark',8,scale*(.048-i*.008))
        for j,(joint,angle,extension,rise) in enumerate([(1,2.7,.51,.20),(2,-.41,.54,.13),
                 (3,3.8,.38,.13),(3,1.42,.35,.20),(4,2.67,.37,.14),(5,-.6,.19,.10)]):
            origin=knots[joint]
            direction=Vector((math.cos(angle),0,math.sin(angle)))
            elbow=origin+scale*(direction*extension*.51+Vector((0,.019,0)))
            tip=origin+scale*(direction*extension+Vector((0,rise,0)))
            g.rod(origin,elbow,.018*scale,'Rain dark bark',7,.010*scale)
            g.rod(elbow,tip,.01*scale,'Rain dark bark',6,.006*scale)
            for k in range(25):
                a=self.random.uniform(0,math.tau)
                radial=.125*scale*math.sqrt(self.random.random())
                shoot=tip+Vector((math.cos(a)*radial,self.random.uniform(-.020,.025)*scale,math.sin(a)*radial))
                self.leaf(5,shoot,a,.138*scale,.095*scale,self.random.uniform(.0,.095)*scale,.15,.54)

    def camellia(self, x, y, z, height):
        """Open, upright, multi-stem sasanqua in the shadow of the entry gallery."""
        base=Vector((x,y,z))
        for n in range(4):
            azimuth=n*2.4+.61
            direction=Vector((math.cos(azimuth),0,math.sin(azimuth)))
            spread=.37 if n else .21
            fork=base+direction*(spread*.54)+Vector((0,height*.43,0))
            top=base+direction*spread+Vector((0,height*(1-n*.09),0))
            g.rod(base,fork,.023,'Rain dark bark',7,.014)
            g.rod(fork,top,.014,'Rain dark bark',6,.006)
            for j in range(8):
                origin=fork.lerp(top,.02+j*.133)
                a=azimuth+j*1.94
                turn=Vector((math.cos(a),0,math.sin(a)))
                tip=origin+turn*self.random.uniform(.12,.20)+Vector((0,.09,0))
                self.stem(origin,tip,.006,.003)
                for k in range(5):
                    mu=(k+.5)/5
                    self.leaf(3,origin.lerp(tip,mu),a+(-1)**k*.82,.114,.046,.045,.18,.51)


def crown_limbs(x,y,z,width,height,variant):
    """Exposed multi-stems between the sill and the photo-matched leaf clusters."""
    rng=random.Random(112+variant)
    base=Vector((x,y,z))
    leaders=[
        [(-.26,.45,.034),(.16,.83,-.09),(.29,.71,-.04),(-.09,.49,.092)],
        [(-.22,.49,.034),(.15,.78,-.09),(.28,.69,-.04),(-.05,.52,.092)],
        [(-.19,.49,.034),(.19,.75,-.09),(.27,.67,-.04),(-.07,.47,.092)],
    ]
    for k,(dx,dy,dz) in enumerate(leaders[variant]):
        p=base+Vector(((k-1.5)*.024,.0,(k%2)*.025))
        fork=base+Vector((dx*width*.42,dy*height*.43,dz*.36))
        top=base+Vector((dx*width,dy*height,dz))
        g.rod(p,fork,.011*height,'Rain dark bark',7,.0065*height)
        g.rod(fork,top,.0065*height,'Rain dark bark',6,.0026*height)
        for j in range(3):
            start=fork.lerp(top,.10+j*.26)
            branch=start+Vector((rng.choice((-1,1))*width*rng.uniform(.09,.17),height*.15,rng.uniform(-.09,.08)))
            g.rod(start,branch,.0041*height,'Rain dark bark',5,.0019*height)
