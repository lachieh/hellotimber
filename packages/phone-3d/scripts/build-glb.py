"""
Builds public/models/nokia3310-v3.glb from the purchased source model (CGTrader #5212540, the
gitignored `nokia-3310/3dmodel/uploads_files_5212540_Nokia_3310_Complete.blend`; plan 10). Every
control becomes its own named node, the parts are renamed to the runtime's contract (layout.ts),
and the bottom connector (the port access: the grey plate, the charger socket, the contacts and
the microphone) is kept as `port*` nodes. Materials and images are not exported: Nokia3310.tsx
dresses every part in code.

  blender -b <source.blend> --python scripts/build-glb.py -- <out.glb>

then compress it with `gltf-transform draco <out.glb> public/models/nokia3310-v3.glb` (never
`optimize`: it joins meshes by material, losing the named parts).
"""

import sys

import bpy
from mathutils import Vector

out = sys.argv[sys.argv.index("--") + 1]

DROP = {"Camera", "Lamp", "Lamp.001", "Lamp.002", "Plane.005", "Speaker_Plate"}
RENAME = {
    "OK_Button": "key_navi",
    "Power_Button": "key_power",
    "LED_Light": "screen",
    "LED_Glass": "screen_glass",
    "Curve_Frame": "island",
    "Outer_Body": "body",
    "Logo_plate": "badge",
    "Nokia_logo": "badge_logo",
    "Side_Cap": "side_cap",
    # The port access, along the bottom edge.
    "Connector_Board": "port",
    "Connector_Board.001": "port_socket",
    "Electric_Surface": "port_contacts",
    "Cylinder": "port_mic",
}
# Main_Button's loose parts, by their measured centres (x, z) in the source's metres.
KEYS = {
    "key_c": (-0.029, 0.110),
    "rocker": (0.023, 0.105),
    "key_1": (-0.033, 0.083),
    "key_2": (0.0, 0.080),
    "key_3": (0.033, 0.083),
    "key_4": (-0.030, 0.065),
    "key_5": (0.0, 0.062),
    "key_6": (0.030, 0.065),
    "key_7": (-0.029, 0.047),
    "key_8": (0.0, 0.043),
    "key_9": (0.029, 0.047),
    "key_star": (-0.028, 0.029),
    "key_0": (0.0, 0.025),
    "key_hash": (0.028, 0.029),
}


def select_only(*objects):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def centre(o):
    corners = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return sum(corners, Vector()) / 8


for name in DROP:
    o = bpy.data.objects.get(name)
    if o is not None:
        bpy.data.objects.remove(o)

for old, new in RENAME.items():
    bpy.data.objects[old].name = new

# The keypad: one mesh in the source, one node per key here.
buttons = bpy.data.objects["Main_Button"]
select_only(buttons)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")
parts = [o for o in bpy.data.objects if o.name.startswith("Main_Button")]
assert len(parts) == len(KEYS), f"{len(parts)} keypad parts"
for part in parts:
    c = centre(part)
    part.name = min(KEYS, key=lambda k: (KEYS[k][0] - c.x) ** 2 + (KEYS[k][1] - c.z) ** 2)

# The rocker: cut through its wedge gap into its two halves.
rocker = bpy.data.objects["rocker"]
select_only(rocker)
bpy.ops.object.duplicate()
copy = bpy.context.active_object
for o, keep_outer, name in ((rocker, False, "key_down"), (copy, True, "key_up")):
    select_only(o)
    o.name = name
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.bisect(
        plane_co=o.matrix_world.inverted() @ centre(o),
        plane_no=(1, 0, 1),
        clear_inner=keep_outer,
        clear_outer=not keep_outer,
        use_fill=False,
    )
    bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_image_format="NONE",
    export_materials="NONE",
    export_cameras=False,
    export_lights=False,
)
print("exported", sorted(o.name for o in bpy.data.objects))
