import { RoundedBox } from "@react-three/drei";
import { MATERIALS } from "./materials";

const GRILLE_DOT_XS = [-0.45, -0.15, 0.15, 0.45];

/** Static phone shell: candy-bar body, face plate, screen bezel, earpiece grille.
 *  1 world unit = 1 cm; body is 4.8 × 11.3 × 2.2 (48 × 113 × 22 mm, spec §1). */
export function PhoneBody() {
  return (
    <group>
      {/* Rounded "pebble" candy-bar shell */}
      <RoundedBox args={[4.8, 11.3, 2.2]} radius={0.6} smoothness={4}>
        <meshStandardMaterial {...MATERIALS.body} />
      </RoundedBox>
      {/* Face plate — front at z = 1.12, just proud of the shell */}
      <RoundedBox args={[4.2, 10.5, 0.12]} radius={0.06} smoothness={4} position={[0, 0, 1.06]}>
        <meshStandardMaterial {...MATERIALS.face} />
      </RoundedBox>
      {/* Near-black screen bezel, upper third — front at z = 1.15 */}
      <RoundedBox args={[3.2, 2.0, 0.1]} radius={0.05} smoothness={4} position={[0, 2.0, 1.1]}>
        <meshStandardMaterial {...MATERIALS.bezel} />
      </RoundedBox>
      {/* Earpiece grille dots above the display */}
      {GRILLE_DOT_XS.map((x) => (
        <mesh key={x} position={[x, 4.2, 1.13]}>
          <circleGeometry args={[0.07, 16]} />
          <meshStandardMaterial {...MATERIALS.grille} />
        </mesh>
      ))}
    </group>
  );
}
