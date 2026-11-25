"""Seamless, original base-color and roughness textures for the Osaka lane."""
import math
import random
import struct
import tempfile
import zlib
from pathlib import Path
import bpy

def packed_png(name,pixels,size,mode):
    def chunk(t,data):
        return struct.pack('>I',len(data))+t+data+struct.pack('>I',zlib.crc32(t+data))
    header=struct.pack('>IIBBBBB',size,size,8,2 if mode=='RGB' else 0,0,0,0)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',header)+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b'')
    with tempfile.TemporaryDirectory() as directory:
        path=Path(directory)/(name+'.png');path.write_bytes(png)
        im=bpy.data.images.load(str(path));im.name=name
        if mode=='L':im.colorspace_settings.name='Non-Color'
        im.pack();im.filepath='//'+path.name
    return im

def apply(material,surface,size=320):
    rng=random.Random(1178 if surface=='asphalt' else 2402)
    grids={k:[[rng.random() for _ in range(k)] for _ in range(k)] for k in (5,15,37)}
    def noise(x,y,k):
        xx=x*k/size;yy=y*k/size;i=math.floor(xx);j=math.floor(yy)
        u=xx-i;v=yy-j;u=u*u*(3-2*u);v=v*v*(3-2*v);g=grids[k]
        a=g[j%k][i%k]*(1-u)+g[j%k][(i+1)%k]*u
        b=g[(j+1)%k][i%k]*(1-u)+g[(j+1)%k][(i+1)%k]*u
        return a*(1-v)+b*v-.5
    col=bytearray();rg=bytearray()
    for y in range(size):
        col.append(0);rg.append(0)
        for x in range(size):
            a,b,c=[noise(x,y,k) for k in (5,15,37)];grain=rng.uniform(-1,1)
            if surface=='asphalt':
                d=round(19*a+11*b+6*c+grain*8+(5 if grain>.95 else 0))
                rgb=(78+d,85+d,95+d);rough=round(90+85*a+44*b+16*c+grain*14)
            else:
                # Fine laitance mottling and occasional dark pores in the cast skin.
                d=round(7*a+7*b+6*c+grain*2.7-(7 if grain<-.952 else 0))
                rgb=(173+d,177+d,174+d);rough=round(173+28*a+19*b+grain*9)
            col.extend(rgb);rg.append(rough)
    nt=material.node_tree;p=nt.nodes.get('Principled BSDF')
    for suffix,raw,mode,socket in [('aggregate',col,'RGB','Base Color'),('roughness',rg,'L','Roughness')]:
        it=nt.nodes.new('ShaderNodeTexImage');it.image=packed_png(surface+'-'+suffix,raw,size,mode)
        nt.links.new(it.outputs['Color'],p.inputs[socket])

def uv(data,repeat):
    layer=data.uv_layers.new(name='Architectural finish')
    coords=[0.0]*(2*len(data.loops))
    for face in data.polygons:
        axis=max(range(3),key=lambda i:abs(face.normal[i]))
        u,v=((1,2),(0,2),(0,1))[axis]
        for index in face.loop_indices:
            pt=data.vertices[data.loops[index].vertex_index].co
            coords[index*2]=pt[u]/repeat;coords[index*2+1]=pt[v]/repeat
    layer.data.foreach_set('uv',coords)
