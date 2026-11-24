"""Rebuild the editable 2.5D residents and the production GLB from residents.png."""
import bpy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
frames = json.loads((HERE / 'sprite-frames.json').read_text())
heights = [1.715, 1.684, 1.641, 1.764, 1.752, 1.734, 1.770, 1.651]
ink = bpy.data.materials.new('Illustrated residents')
ink.use_nodes = True
bsdf = ink.node_tree.nodes.get('Principled BSDF')
atlas = ink.node_tree.nodes.new('ShaderNodeTexImage')
atlas.image = bpy.data.images.load(str(HERE / 'residents.png'))
atlas.image.pack()
atlas.image.filepath = '//residents.png'
atlas.interpolation = 'Closest'
ink.node_tree.links.new(atlas.outputs['Color'], bsdf.inputs['Base Color'])
ink.node_tree.links.new(atlas.outputs['Alpha'], bsdf.inputs['Alpha'])
bsdf.inputs['Roughness'].default_value = 1

def empty(name, x):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location.x = x
    return obj

def card(parent, name, index, height, bottom=0):
    f = frames[index]
    width = height * f['w'] / f['h']
    verts = [(-width/2,0,bottom),(width/2,0,bottom),(width/2,0,bottom+height),(-width/2,0,bottom+height)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [(0,1,2,3)])
    uv = mesh.uv_layers.new()
    atlas_w,atlas_h=atlas.image.size
    u,v = f['x']/atlas_w, 1-(f['y']+f['h'])/atlas_h
    du,dv = f['w']/atlas_w, f['h']/atlas_h
    for i,point in enumerate([(u,v),(u+du,v),(u+du,v+dv),(u,v+dv)]):
        uv.data[i].uv=point
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent=parent
    mesh.materials.append(ink)
    return obj

player=empty('Player',0)
for frame,name in [(0,'Front'),(8,'StrideA'),(9,'StrideB'),(10,'Side'),(11,'AwayA'),(12,'Back'),(13,'AwayB')]:
    card(player,'Player_'+name,frame,heights[0])

# Rain poses include the hand, shaft and canopy in the same drawing, even during a stride.
for i,name in enumerate(['Front','StrideA','Side','StrideB','Back','AwayA','AwayB','Approach']):
    card(player,'Rain_'+name,16+i,1.98)

seat=empty('PlayerSeated',1.35)
card(seat,'Seated_Rest',14,1.22,-.43)
card(seat,'Seated_Change',15,1.22,-.43)
for i in range(1,8):
    name='Member%02d'%i
    parent=empty(name,1.35+i*.95)
    card(parent,name+'_Drawing',i,heights[i])

# The first pose is visible in the source editor; the exporter includes all alternatives.
for obj in list(player.children)+list(seat.children):
    if obj.name not in ['Player_Front','Seated_Rest']:obj.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'Residents.blend'),compress=True)
for obj in bpy.context.scene.objects:obj.hide_set(False)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/sumiyoshi/models/people.glb'),
                          export_format='GLB',export_lights=False,export_cameras=False,export_animations=False)
