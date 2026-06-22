import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, Edges } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Pencil, EyeOff } from "lucide-react";
import { iconFor } from "@/components/dashboard/rfIcons";
import { irIconFor } from "@/components/dashboard/irIcons";

/* ──────────────────────────────────────────────────────────────────────────
 * Coordinate system: 1 unit = 1 foot. The room is 12×12 ft with an 8 ft
 * ceiling, centered on the origin, floor at y = 0.
 *   +X = East  (desk / TV wall)        −X = West (loft bed wall)
 *   +Z = South (door / closet wall)    −Z = North (window / AC wall)
 * ────────────────────────────────────────────────────────────────────────── */

const W = 12; // width  (X)
const D = 12; // depth  (Z)
const H = 8; // height (Y)
const HX = W / 2;
const HZ = D / 2;

/* Palette pulled from the room photos. */
const C = {
  wall: "#cabba0",
  carpet: "#c4b89c",
  carpetDark: "#b3a585",
  ceiling: "#d8cdb6",
  metalDark: "#2c3038",
  metalDark2: "#3a3f48",
  couch: "#79828f",
  couchDark: "#5f6873",
  woodDesk: "#4a3a2b",
  woodDoor: "#6e5034",
  screen: "#101826",
  screenGlow: "#3b2a6b",
  acWhite: "#f2f2ee",
  curtain: "#9fb4d6",
  black: "#15171c",
  fanBlade: "#eceef1",
  glass: "#aac6e6",
};

/* ── Room shell: translucent beige walls + ceiling so you can see in, plus a
 *    solid carpet floor. ──────────────────────────────────────────────────── */
function Shell() {
  return (
    <group>
      {/* carpet floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={C.carpet} roughness={1} />
      </mesh>
      {/* translucent walls + ceiling shell (BackSide so we view the interior) */}
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial
          color={C.wall}
          transparent
          opacity={0.22}
          side={THREE.BackSide}
        />
        <Edges color="#8a7d63" />
      </mesh>
    </group>
  );
}

/* ── Ceiling fan + integrated light, North-center-ish (matches the photo). ─── */
function CeilingFan() {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.y += dt * 1.6;
  });
  return (
    <group position={[0, H - 0.35, 0]}>
      {/* down-rod */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 12]} />
        <meshStandardMaterial color={C.acWhite} />
      </mesh>
      {/* hub */}
      <mesh>
        <cylinderGeometry args={[0.45, 0.5, 0.22, 28]} />
        <meshStandardMaterial color={C.acWhite} metalness={0.2} roughness={0.5} />
      </mesh>
      {/* light dome */}
      <mesh position={[0, -0.18, 0]}>
        <sphereGeometry args={[0.34, 20, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#fff4d6" emissive="#ffe9b0" emissiveIntensity={0.7} />
      </mesh>
      <pointLight position={[0, -0.4, 0]} intensity={6} distance={14} color="#fff1cf" />
      <group ref={blades}>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
            <mesh position={[1.1, 0.02, 0]} rotation={[0.08, 0, 0]}>
              <boxGeometry args={[2.0, 0.03, 0.42]} />
              <meshStandardMaterial color={C.fanBlade} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ── Loft bed (West wall) with couch under it, stairs/cubby at the south end. ─ */
function LoftBed() {
  // Footprint: X from −HX(−6) to −2 (4 ft deep), Z from −HZ(−6) to +2 (8 ft long).
  const x0 = -HX;
  const x1 = -2;
  const z0 = -HZ;
  const z1 = 2;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const deckY = 5; // mattress platform height
  const post = (px: number, pz: number) => (
    <mesh position={[px, deckY / 2 + 0.2, pz]}>
      <boxGeometry args={[0.12, deckY + 0.4, 0.12]} />
      <meshStandardMaterial color={C.metalDark} metalness={0.4} roughness={0.5} />
    </mesh>
  );
  return (
    <group>
      {/* four posts */}
      {post(x0 + 0.1, z0 + 0.1)}
      {post(x1 - 0.1, z0 + 0.1)}
      {post(x0 + 0.1, z1 - 0.1)}
      {post(x1 - 0.1, z1 - 0.1)}
      {/* platform */}
      <mesh position={[cx, deckY, cz]}>
        <boxGeometry args={[x1 - x0, 0.18, z1 - z0]} />
        <meshStandardMaterial color={C.metalDark2} metalness={0.3} roughness={0.6} />
      </mesh>
      {/* mattress */}
      <mesh position={[cx, deckY + 0.32, cz]}>
        <boxGeometry args={[x1 - x0 - 0.4, 0.5, z1 - z0 - 0.4]} />
        <meshStandardMaterial color="#d9d4c8" roughness={0.95} />
      </mesh>
      {/* guard rail on the open (east) side */}
      <mesh position={[x1 - 0.05, deckY + 0.7, cz]}>
        <boxGeometry args={[0.06, 0.9, z1 - z0 - 0.6]} />
        <meshStandardMaterial color={C.metalDark} transparent opacity={0.55} />
      </mesh>

      {/* Couch underneath (faces east, into the room) */}
      <group position={[cx - 0.1, 0, cz - 0.2]}>
        {/* seat base */}
        <mesh position={[0, 0.7, 0]}>
          <boxGeometry args={[3.2, 0.7, 6.0]} />
          <meshStandardMaterial color={C.couch} roughness={1} />
        </mesh>
        {/* backrest against west wall */}
        <mesh position={[-1.1, 1.5, 0]}>
          <boxGeometry args={[0.9, 1.5, 6.0]} />
          <meshStandardMaterial color={C.couchDark} roughness={1} />
        </mesh>
        {/* armrests */}
        <mesh position={[0.2, 1.2, 2.9]}>
          <boxGeometry args={[3.0, 0.9, 0.5]} />
          <meshStandardMaterial color={C.couchDark} roughness={1} />
        </mesh>
        <mesh position={[0.2, 1.2, -2.9]}>
          <boxGeometry args={[3.0, 0.9, 0.5]} />
          <meshStandardMaterial color={C.couchDark} roughness={1} />
        </mesh>
      </group>

      {/* Stair-cubbies climbing to the deck at the south (left) end, by the door */}
      <group position={[x0 + 1.0, 0, 0]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const h = 1.0 + i * 0.95; // each riser is taller and set back toward the bed
          return (
            <mesh key={i} position={[0, h / 2, 3.5 - i * 0.5]}>
              <boxGeometry args={[1.7, h, 0.7]} />
              <meshStandardMaterial color={C.metalDark2} roughness={0.8} />
            </mesh>
          );
        })}
      </group>

      {/* Clock at the head of the bed (north end), on the rail */}
      <group position={[x1 - 0.15, deckY + 0.45, z0 + 0.6]}>
        <mesh>
          <boxGeometry args={[0.5, 0.32, 0.18]} />
          <meshStandardMaterial color={C.black} />
        </mesh>
        <mesh position={[0.0, 0, 0.1]}>
          <boxGeometry args={[0.38, 0.18, 0.02]} />
          <meshStandardMaterial color="#0a2a2a" emissive="#22d3ee" emissiveIntensity={0.8} />
        </mesh>
      </group>
    </group>
  );
}

/* ── Desk along the East wall (L-shaped into the NE corner), with monitors,
 *    lightbar, PC tower, and the P4 hub. ──────────────────────────────────── */
function DeskArea() {
  const topY = 2.5;
  const rz = -HZ + 0.9; // north-wall return line
  return (
    <group>
      {/* L-desk: leg A along the east wall, leg B (return) along the north wall */}
      <DeskSlab x={HX - 0.95} z={-2.5} w={1.7} d={6} topY={topY} />
      <DeskSlab x={2.6} z={rz} w={3.8} d={1.6} topY={topY} />

      {/* PC tower under the return, west end */}
      <mesh position={[1.2, 0.9, rz]}>
        <boxGeometry args={[0.8, 1.7, 1.6]} />
        <meshStandardMaterial color={C.black} roughness={0.6} />
        <Edges color="#6d28d9" />
      </mesh>

      {/* Monitors on the return (north wall), facing south into the room;
          vertical monitor sits to the LEFT of the main ultrawide */}
      <Monitor x={3.3} y={topY + 0.85} z={rz} w={2.4} h={1.1} rotY={0} />
      <Monitor x={1.6} y={topY + 0.95} z={rz} w={1.0} h={1.7} rotY={0} />
      {/* LED lightbar above the main monitor */}
      <mesh position={[3.3, topY + 1.55, rz]}>
        <boxGeometry args={[2.6, 0.06, 0.12]} />
        <meshStandardMaterial color="#222" emissive="#fff2cc" emissiveIntensity={0.6} />
      </mesh>

      {/* Office chair, south of the return */}
      <group position={[2.7, 0, -3.4]}>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[1.4, 0.18, 1.4]} />
          <meshStandardMaterial color={C.black} roughness={0.7} />
        </mesh>
        <mesh position={[-0.55, 1.9, 0]}>
          <boxGeometry args={[0.18, 1.6, 1.3]} />
          <meshStandardMaterial color={C.black} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.0, 10]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      </group>
    </group>
  );
}

function DeskSlab({
  x,
  z,
  w,
  d,
  topY,
}: {
  x: number;
  z: number;
  w: number;
  d: number;
  topY: number;
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, topY, 0]}>
        <boxGeometry args={[w, 0.12, d]} />
        <meshStandardMaterial color={C.woodDesk} roughness={0.7} />
        <Edges color="#2e241a" />
      </mesh>
      {/* legs */}
      {[
        [-w / 2 + 0.1, -d / 2 + 0.1],
        [w / 2 - 0.1, -d / 2 + 0.1],
        [-w / 2 + 0.1, d / 2 - 0.1],
        [w / 2 - 0.1, d / 2 - 0.1],
      ].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, topY / 2, lz]}>
          <boxGeometry args={[0.08, topY, 0.08]} />
          <meshStandardMaterial color={C.metalDark} />
        </mesh>
      ))}
    </group>
  );
}

function Monitor({
  x,
  y,
  z,
  w,
  h,
  rotY,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  rotY: number;
}) {
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[w, h, 0.08]} />
        <meshStandardMaterial color={C.black} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[w - 0.12, h - 0.12]} />
        <meshStandardMaterial color={C.screen} emissive={C.screenGlow} emissiveIntensity={0.6} />
      </mesh>
      {/* stand */}
      <mesh position={[0, -h / 2 - 0.25, 0]}>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
}

/* ── Wall-mounted TV + soundbar (East wall, north end, ~4 ft up). ─────────── */
function TvWall() {
  const x = HX - 0.12;
  const z = -3.9;
  return (
    <group>
      <mesh position={[x, 4.0, z]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[3.3, 1.95, 0.12]} />
        <meshStandardMaterial color={C.black} />
      </mesh>
      <mesh position={[x - 0.04, 4.0, z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[3.1, 1.75]} />
        <meshStandardMaterial color={C.screen} emissive={C.screenGlow} emissiveIntensity={0.35} />
      </mesh>
      {/* soundbar mounted just under the TV */}
      <mesh position={[x - 0.05, 3.0, z]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[2.8, 0.22, 0.18]} />
        <meshStandardMaterial color="#1b1b1b" roughness={0.5} />
      </mesh>

      {/* P4 hub on the desk, near the L corner */}
      <group position={[4.8, 2.62, -3.6]}>
        <mesh>
          <boxGeometry args={[0.7, 0.22, 0.5]} />
          <meshStandardMaterial color={C.metalDark2} />
        </mesh>
        <mesh position={[0, 0.13, 0]} rotation={[-0.5, 0, 0]}>
          <boxGeometry args={[0.55, 0.02, 0.3]} />
          <meshStandardMaterial color="#06283d" emissive="#22d3ee" emissiveIntensity={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/* ── AC tower — floor, right next to the desk's south end. ────────────────── */
function AcUnit() {
  return (
    <group position={[HX - 1.0, 0, 0.8]}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[1.0, 4.0, 1.0]} />
        <meshStandardMaterial color={C.acWhite} roughness={0.4} />
        <Edges color="#cfcfca" />
      </mesh>
      {/* vent slats near the top */}
      <mesh position={[0, 3.4, 0.51]}>
        <boxGeometry args={[0.8, 0.9, 0.02]} />
        <meshStandardMaterial color="#d7d7d2" />
      </mesh>
    </group>
  );
}

/* ── Door (West wall, south end, by the bed) + closet (South wall). ───────── */
function SouthWall() {
  const z = HZ - 0.06;
  const wx = -HX + 0.06;
  return (
    <group>
      {/* door — on the WEST wall, south end (next to the bed stairs) */}
      <mesh position={[wx, 3.35, 3.8]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[2.5, 6.7, 0.1]} />
        <meshStandardMaterial color={C.woodDoor} roughness={0.6} />
        <Edges color="#3a2c1c" />
      </mesh>
      <mesh position={[wx + 0.1, 3.2, 4.7]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="#b8973f" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* closet bifold doors — South wall, east side */}
      <mesh position={[1.0, 3.4, z]}>
        <boxGeometry args={[4.0, 6.8, 0.08]} />
        <meshStandardMaterial color="#d8cdbb" roughness={0.7} />
        <Edges color="#a89a80" />
      </mesh>
    </group>
  );
}

/* ── Audio: subwoofer on the floor + four small surround speakers. ─────────── */
function AudioBits() {
  const surround: [number, number, number][] = [
    // rear surrounds — sitting on top of the couch back
    [-5.1, 2.4, -4.8],
    [-5.1, 2.4, 0.5],
    // front surrounds — on the desk (left end + near the corner)
    [0.9, 2.85, -5.0],
    [4.5, 2.85, -4.9],
  ];
  return (
    <group>
      {/* subwoofer on the floor, by the right (north) end of the couch */}
      <mesh position={[-2.6, 0.55, -4.6]}>
        <boxGeometry args={[0.9, 1.1, 0.9]} />
        <meshStandardMaterial color={C.black} roughness={0.5} />
      </mesh>
      {surround.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.4, 0.6, 0.4]} />
          <meshStandardMaterial color="#1c1c1c" />
        </mesh>
      ))}
    </group>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Control markers — clickable to send, draggable (in edit mode) onto a device.
 * ────────────────────────────────────────────────────────────────────────── */

export type RoomControl = {
  key: string; // "rf:0" | "ir:<uuid>"
  kind: "rf" | "ir";
  label: string;
  iconKey: string;
  learned: boolean;
  pos: [number, number, number];
};

const NO_RAYCAST = () => null;
// Stable reference to the real mesh raycast. Passing `undefined` to the raycast
// prop doesn't reliably restore the default in r3f (it left every marker
// non-raycastable after one drag), so we toggle between this and NO_RAYCAST.
const DEFAULT_RAYCAST = THREE.Mesh.prototype.raycast;

function Marker({
  control,
  pos,
  editing,
  dragging,
  selected,
  onSend,
  onEdit,
  onHide,
  onStartDrag,
}: {
  control: RoomControl;
  pos: [number, number, number];
  editing: boolean;
  dragging: boolean;
  selected: boolean;
  onSend: (c: RoomControl) => void;
  onEdit?: (c: RoomControl) => void;
  onHide?: (c: RoomControl) => void;
  onStartDrag: (c: RoomControl) => void;
}) {
  const Icon = control.kind === "rf" ? iconFor(control.iconKey) : irIconFor(control.iconKey);
  return (
    <group position={pos}>
      {/* invisible hit sphere — ignored by the raycaster while another marker
          is being dragged so the cursor sees the furniture beneath it. */}
      <mesh
        raycast={dragging ? NO_RAYCAST : DEFAULT_RAYCAST}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (!editing) return;
          e.stopPropagation();
          onStartDrag(control);
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (editing) return;
          e.stopPropagation();
          onSend(control);
        }}
        onPointerOver={() => (document.body.style.cursor = editing ? "grab" : "pointer")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Html center distanceFactor={9} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="flex select-none flex-col items-center gap-1">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl border shadow-lg backdrop-blur ${
              selected
                ? "border-amber-400 bg-card text-foreground ring-2 ring-amber-400/70"
                : control.learned
                  ? "border-primary/60 bg-card/90 text-foreground"
                  : "border-destructive/50 bg-card/80 text-muted-foreground"
            }`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <span className="max-w-[100px] truncate rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            {control.label || "(unnamed)"}
          </span>
        </div>
      </Html>

      {/* edit pencil (RF only) — rendered as its own Html so it stays clickable */}
      {editing && onEdit && (
        <Html position={[0.55, 0.55, 0]} center distanceFactor={9} zIndexRange={[30, 0]}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(control);
            }}
            title="Edit"
            className="rounded-full bg-background/90 p-1.5 text-muted-foreground shadow hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </Html>
      )}

      {/* hide from room — rendered as its own Html so it stays clickable */}
      {editing && onHide && (
        <Html position={[-0.55, 0.55, 0]} center distanceFactor={9} zIndexRange={[30, 0]}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHide(control);
            }}
            title="Hide from room"
            className="rounded-full bg-destructive/90 p-1.5 text-white shadow hover:bg-destructive"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        </Html>
      )}
    </group>
  );
}

/* WASD + Space/Shift fly-around. Moves the camera and the OrbitControls target
   together so the orbit pivot follows you. Disabled in edit mode (there those
   keys nudge the selected button instead). */
function KeyboardFly({
  enabled,
  controlsRef,
}: {
  enabled: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const MOVE = new Set(["w", "a", "s", "d", "space", "shift"]);
    const norm = (e: KeyboardEvent) => (e.key === " " ? "space" : e.key.toLowerCase());
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
        return;
      const k = norm(e);
      if (!MOVE.has(k)) return;
      keys.current[k] = true;
      if (enabledRef.current) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[norm(e)] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const fwd = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());
  const UP = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, dt) => {
    if (!enabledRef.current) return;
    const k = keys.current;
    const m = move.current.set(0, 0, 0);
    camera.getWorldDirection(fwd.current);
    fwd.current.y = 0;
    if (fwd.current.lengthSq() < 1e-6) return;
    fwd.current.normalize();
    right.current.crossVectors(fwd.current, UP.current).normalize();
    if (k["w"]) m.add(fwd.current);
    if (k["s"]) m.sub(fwd.current);
    if (k["d"]) m.add(right.current);
    if (k["a"]) m.sub(right.current);
    if (k["space"]) m.y += 1;
    if (k["shift"]) m.y -= 1;
    if (m.lengthSq() === 0) return;
    m.normalize().multiplyScalar(9 * dt); // ~9 ft/s
    camera.position.add(m);
    if (controlsRef.current) controlsRef.current.target.add(m);
  });

  return null;
}

export function Room3D({
  controls,
  editing,
  onSend,
  onEdit,
  onHide,
  onMove,
}: {
  controls: RoomControl[];
  editing: boolean;
  onSend: (c: RoomControl) => void;
  onEdit: (c: RoomControl) => void;
  onHide?: (c: RoomControl) => void;
  onMove: (c: RoomControl, pos: [number, number, number]) => void;
}) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [override, setOverride] = useState<Record<string, [number, number, number]>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  // Refs so the surface-move / pointerup / keydown handlers see live values.
  const draggingRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const overrideRef = useRef(override);
  const onMoveRef = useRef(onMove);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  draggingRef.current = draggingKey;
  selectedRef.current = selectedKey;
  overrideRef.current = override;
  onMoveRef.current = onMove;

  const controlByKey = useRef<Record<string, RoomControl>>({});
  controlByKey.current = Object.fromEntries(
    controls.map((c) => [c.key, c] as [string, RoomControl]),
  );

  // Keyboard nudging of the selected button (edit mode):
  //   arrows = N/E/S/W (world Z/X), spacebar = up, shift = down.
  useEffect(() => {
    if (!editing) {
      setSelectedKey(null);
      return;
    }
    const STEP = 0.25;
    const onKey = (e: KeyboardEvent) => {
      const key = selectedRef.current;
      if (!key) return;
      // Don't hijack typing in dialogs (e.g. the rename input).
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
        return;
      let dx = 0,
        dy = 0,
        dz = 0;
      switch (e.key) {
        case "ArrowUp": dz = -STEP; break; // north
        case "ArrowRight": dx = STEP; break; // east
        case "ArrowDown": dz = STEP; break; // south
        case "ArrowLeft": dx = -STEP; break; // west
        case " ": dy = STEP; break; // spacebar = up
        case "Shift": dy = -STEP; break; // shift = down
        default: return;
      }
      e.preventDefault();
      const cur = overrideRef.current[key] ?? controlByKey.current[key]?.pos;
      if (!cur) return;
      const next: [number, number, number] = [cur[0] + dx, cur[1] + dy, cur[2] + dz];
      setOverride((o) => ({ ...o, [key]: next }));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const c = controlByKey.current[key];
        if (c) onMoveRef.current(c, next);
      }, 350);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  // Commit on pointer-up anywhere (even off a mesh).
  useEffect(() => {
    if (!draggingKey) return;
    const onUp = () => {
      const key = draggingRef.current;
      if (key) {
        const p = overrideRef.current[key];
        const c = controlByKey.current[key];
        if (p && c) onMove(c, p);
      }
      setDraggingKey(null);
      document.body.style.cursor = "auto";
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [draggingKey, onMove]);

  const handleSurfaceMove = (e: ThreeEvent<PointerEvent>) => {
    const key = draggingRef.current;
    if (!key) return;
    e.stopPropagation();
    const { x, y, z } = e.point;
    setOverride((o) => ({ ...o, [key]: [x, y, z] }));
  };

  return (
    <Canvas camera={{ position: [12, 9.5, 14], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={["#0f172a"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[8, 12, 6]} intensity={0.8} />
      <hemisphereLight args={["#fff6e6", "#3a3526", 0.35]} />

      {/* Everything solid lives in one group so a drag reads the hit point
          (e.point) of whatever device is under the cursor. */}
      <group onPointerMove={handleSurfaceMove}>
        <Shell />
        <LoftBed />
        <DeskArea />
        <TvWall />
        <AcUnit />
        <SouthWall />
        <AudioBits />
        <CeilingFan />
      </group>

      {controls.map((c) => (
        <Marker
          key={c.key}
          control={c}
          pos={override[c.key] ?? c.pos}
          editing={editing}
          dragging={draggingKey !== null}
          selected={selectedKey === c.key}
          onSend={onSend}
          onEdit={c.kind === "rf" ? onEdit : undefined}
          onStartDrag={(ctrl) => {
            setDraggingKey(ctrl.key);
            setSelectedKey(ctrl.key);
          }}
        />
      ))}

      <KeyboardFly enabled={!editing} controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={draggingKey === null}
        target={[0, 3.2, 0]}
        minDistance={6}
        maxDistance={32}
        enablePan
      />
    </Canvas>
  );
}
