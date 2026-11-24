"""Pack architectural GLB attributes with the standard KHR_mesh_quantization.
Fused by shader, vertex colour and normals remain per-vertex; no decoder needed.
"""
import json
import struct
from pathlib import Path
import numpy as np

def optimize(file):
    file=Path(file)
    raw=file.read_bytes()
    meta_size=struct.unpack_from('<I',raw,12)[0]
    g=json.loads(raw[20:20+meta_size])
    binary=raw[28+meta_size:]
    access=g['accessors']; views=g['bufferViews']
    out=bytearray();new_views=[];new_access=[]
    def write(b,target=None,stride=None):
        while len(out)%4:out.append(0)
        ref={'buffer':0,'byteOffset':len(out),'byteLength':len(b)}
        if target:ref['target']=target
        if stride:ref['byteStride']=stride
        new_views.append(ref);out.extend(b);return len(new_views)-1
    def extract(i):
        a=access[i];view=views[a['bufferView']]
        off=view.get('byteOffset',0)+a.get('byteOffset',0)
        dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
        cols={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        dt=np.dtype(dtype);step=view.get('byteStride',cols*dt.itemsize)
        return np.ndarray((a['count'],cols),dtype=dt,buffer=binary,offset=off,strides=(step,dt.itemsize))
    scale=16.
    for m in g['meshes']:
        for primitive in m['primitives']:
            attrs=primitive['attributes'];values=[];definitions=[]
            for name,idx in attrs.items():
                x=extract(idx)
                d=dict(type=access[idx]['type'])
                if name=='POSITION':
                    data=np.round(x/scale*32767).astype('<i2')
                    d.update(componentType=5122,normalized=True,min=data.min(0).astype(int).tolist(),max=data.max(0).astype(int).tolist())
                elif name=='NORMAL':
                    data=np.clip(np.rint(x*127),-127,127).astype('i1');d.update(componentType=5120,normalized=True)
                elif name=='COLOR_0':
                    data=np.clip(np.rint(x*255),0,255).astype('u1');d.update(componentType=5121,normalized=True)
                else:
                    data=np.array(x,dtype='<f4');d.update(componentType=5126)
                d['name']=name
                val=np.ascontiguousarray(data)
                asbytes=val.view('u1').reshape(len(val),-1)
                padded=np.zeros((len(val),(asbytes.shape[1]+3)//4*4),dtype='u1')
                padded[:,:asbytes.shape[1]]=asbytes
                values.append(padded);definitions.append(d)
            buf=np.concatenate(values,axis=1)
            ary=np.ascontiguousarray(buf).view(np.dtype((np.void,buf.shape[1]))).reshape(-1)
            _,keep,remap=np.unique(ary,return_index=True,return_inverse=True)
            compact=buf[keep]
            view_id=write(compact.tobytes(),34962,compact.shape[1])
            offset=0
            for value,attr in zip(values,definitions):
                key=attr.pop('name')
                attrs[key]=len(new_access)
                new_access.append(dict(count=len(keep),bufferView=view_id,byteOffset=offset,**attr))
                offset+=value.shape[1]
            idx=remap[extract(primitive['indices'])[:,0]]
            dtype='<u2' if len(keep)<65536 else '<u4'
            view_id=write(idx.astype(dtype).tobytes(),34963)
            primitive['indices']=len(new_access)
            new_access.append(dict(type='SCALAR',componentType=5123 if dtype=='<u2' else 5125,count=len(idx),bufferView=view_id))
    for n in g['nodes']:
        if 'mesh' in n:
            n['scale']=[scale*v for v in n.get('scale',[1,1,1])]
    for img in g.get('images',[]):
        vi=views[img['bufferView']];off=vi.get('byteOffset',0)
        img['bufferView']=write(binary[off:off+vi['byteLength']])
    for m in g.get('materials',[]):
        if 'Painted botanical' in m.get('name',''):
            m['alphaMode']='MASK';m['alphaCutoff']=.43;m['doubleSided']=True
    g['bufferViews']=new_views;g['accessors']=new_access
    g['extensionsUsed']=sorted(set(g.get('extensionsUsed',[]))|{'KHR_mesh_quantization'})
    g['extensionsRequired']=sorted(set(g.get('extensionsRequired',[]))|{'KHR_mesh_quantization'})
    while len(out)%4:out.append(0)
    g['buffers']=[{'byteLength':len(out)}]
    meta=json.dumps(g,ensure_ascii=False,separators=(',',':')).encode('utf8')
    meta+=b' '*((-len(meta))%4)
    size=28+len(meta)+len(out)
    file.write_bytes(struct.pack('<4sIII4s',b'glTF',2,size,len(meta),b'JSON')+meta+struct.pack('<I4s',len(out),b'BIN\0')+out)
    print('Packed GLB bytes =',size)
