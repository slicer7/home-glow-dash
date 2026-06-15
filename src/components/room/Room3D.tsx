import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Edges } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { Pencil } from "lucide-react";
import { iconFor } from "@/components/dashboard/rfIcons";
import type { RfSignal } from "@/lib/supabase";

/* A simple ceiling fan: down-rod, hub, and four spinning blades. */
function Fan() {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.y += dt * 2.5;
  });
  return (
    <group position={[0, 1.82, 0]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.35, 12]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.14, 28]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.3} roughness={0.4} />
      </mesh>
      <group ref={blades}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <mesh position={[0.5, 0, 0]} rotation={[0.12, 0, 0]}>
              <boxGeometry args={[0.8, 0.02, 0.18]} />
              <meshStandardMaterial color="#cbd5e1" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* Translucent room cube with an outline and a darker floor. */
function Room() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial
          color="#1e293b"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
        />
        <Edges color="#334155" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.99, 0]}>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="#0b1220" />
      </mesh>
    </group>
  );
}

/* A small lab mix curled up sleeping on a mat — built from continuous curved
   forms (torus for the curled body, ellipsoids for head/snout) rather than
   a cluster of spheres, so it reads as a real dog silhouette. */
function SleepingDog() {
  const fur = "#2a2a2a";
  const muzzle = "#3a3a3a";
  const whiteTip = "#e8eaed";
  const nose = "#0a0a0a";
  const pink = "#5b3a3a";

  return (
    <group position={[0, -1.72, 0]} rotation={[-Math.PI / 2, 0, 0.4]}>
      {/* Dog bed / mat (rotate back to floor plane) */}
      <mesh position={[0, 0, -0.08]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.55, 48]} />
        <meshStandardMaterial color="#334155" roughness={1} />
      </mesh>

      {/* === BODY: a thick partial torus = the curled C-shape spine === */}
      {/* Torus lies flat (in the group's local XY plane = floor). Arc ~340deg
          leaves a gap where the head tucks in. Slightly squashed in Z so it
          hugs the floor instead of looking like a donut. */}
      <group scale={[1, 1, 0.55]} position={[0, 0, 0.11]}>
        <mesh rotation={[0, 0, -0.3]}>
          <torusGeometry args={[0.26, 0.13, 20, 48, Math.PI * 1.85]} />
          <meshStandardMaterial color={fur} roughness={0.95} />
        </mesh>
      </group>

      {/* Haunch / rear hip — bulges over the back leg */}
      <mesh position={[0.28, 0.08, 0.1]} scale={[1.1, 0.95, 0.75]}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color={fur} roughness={0.95} />
      </mesh>

      {/* Shoulder mass */}
      <mesh position={[-0.18, -0.22, 0.09]} scale={[1, 1.05, 0.8]}>
        <sphereGeometry args={[0.14, 20, 20]} />
        <meshStandardMaterial color={fur} roughness={0.95} />
      </mesh>

      {/* === HEAD: elongated ellipsoid resting on the floor === */}
      <group position={[-0.34, -0.18, 0.06]} rotation={[0, 0, 0.25]}>
        {/* Skull */}
        <mesh scale={[1.2, 0.95, 0.8]}>
          <sphereGeometry args={[0.11, 24, 24]} />
          <meshStandardMaterial color={fur} roughness={0.95} />
        </mesh>
        {/* Muzzle — tapered, points forward (−X) */}
        <mesh position={[-0.13, -0.01, -0.01]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.85]}>
          <coneGeometry args={[0.07, 0.16, 18]} />
          <meshStandardMaterial color={muzzle} roughness={0.95} />
        </mesh>
        {/* Nose */}
        <mesh position={[-0.21, -0.01, 0]}>
          <sphereGeometry args={[0.024, 12, 12]} />
          <meshStandardMaterial color={nose} roughness={0.4} />
        </mesh>
        {/* Floppy ear — flat plane draped over the head */}
        <mesh position={[0.04, 0.05, 0.03]} rotation={[0.4, 0.3, -0.2]}>
          <boxGeometry args={[0.11, 0.13, 0.012]} />
          <meshStandardMaterial color={fur} roughness={0.95} />
        </mesh>
        {/* Tongue tip peeking out */}
        <mesh position={[-0.19, -0.04, 0.005]} rotation={[0, 0, 0.2]}>
          <boxGeometry args={[0.03, 0.018, 0.008]} />
          <meshStandardMaterial color={pink} roughness={0.7} />
        </mesh>
      </group>

      {/* === LEGS / PAWS — capsules tucked along the body === */}
      {/* Front leg folded under chin */}
      <mesh position={[-0.22, -0.08, 0.05]} rotation={[0, 0, 1.4]}>
        <capsuleGeometry args={[0.05, 0.18, 8, 16]} />
        <meshStandardMaterial color={fur} roughness={0.95} />
      </mesh>
      {/* Front paw — white tip */}
      <mesh position={[-0.31, -0.06, 0.045]} scale={[1.1, 0.9, 0.8]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color={whiteTip} roughness={0.85} />
      </mesh>

      {/* Second front leg crossing over */}
      <mesh position={[-0.18, -0.02, 0.04]} rotation={[0, 0, 1.1]}>
        <capsuleGeometry args={[0.045, 0.16, 8, 16]} />
        <meshStandardMaterial color={fur} roughness={0.95} />
      </mesh>
      <mesh position={[-0.27, 0.02, 0.04]} scale={[1, 0.85, 0.8]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color={whiteTip} roughness={0.85} />
      </mesh>

      {/* Back leg tucked along belly */}
      <mesh position={[0.18, -0.1, 0.05]} rotation={[0, 0, 0.5]}>
        <capsuleGeometry args={[0.055, 0.2, 8, 16]} />
        <meshStandardMaterial color={fur} roughness={0.95} />
      </mesh>
      {/* Back paw — white tip */}
      <mesh position={[0.06, -0.18, 0.045]} scale={[1.1, 0.9, 0.8]}>
        <sphereGeometry args={[0.058, 16, 16]} />
        <meshStandardMaterial color={whiteTip} roughness={0.85} />
      </mesh>

      {/* Tail curled around the haunch */}
      <mesh position={[0.32, -0.05, 0.1]} rotation={[0, 0, -1.1]}>
        <capsuleGeometry args={[0.028, 0.18, 8, 12]} />
        <meshStandardMaterial color={fur} roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Room3D({
  signals,
  onSend,
  onEdit,
}: {
  signals: RfSignal[];
  onSend: (s: RfSignal) => void;
  onEdit: (s: RfSignal) => void;
}) {
  const count = Math.max(signals.length, 1);

  return (
    <Canvas camera={{ position: [4.5, 3.5, 5], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={["#0f172a"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 4]} intensity={0.9} />

      <Room />
      <Fan />
      <SleepingDog />

      {/* Control buttons arranged in a ring around the fan */}
      {signals.map((sig, idx) => {
        const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
        const r = 1.4;
        const pos: [number, number, number] = [
          Math.cos(angle) * r,
          1.82,
          Math.sin(angle) * r,
        ];
        const Icon = iconFor(sig.icon);
        return (
          <Html key={sig.slot} position={pos} center zIndexRange={[20, 0]}>
            <div className="flex select-none flex-col items-center gap-1">
              <button
                onClick={() => onSend(sig)}
                title={sig.learned ? "Tap to send" : "Not learned yet"}
                className={`flex h-14 w-14 items-center justify-center rounded-xl border shadow-lg backdrop-blur transition-transform active:scale-90 ${
                  sig.learned
                    ? "border-primary/60 bg-card/90 text-foreground"
                    : "border-destructive/50 bg-card/80 text-muted-foreground"
                }`}
              >
                <Icon className="h-6 w-6" />
              </button>
              <div className="flex items-center gap-1">
                <span className="max-w-[90px] truncate rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                  {sig.label || "(unnamed)"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(sig);
                  }}
                  title="Edit"
                  className="rounded bg-background/85 p-1 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            </div>
          </Html>
        );
      })}

      <OrbitControls
        makeDefault
        target={[0, 1.4, 0]}
        minDistance={3}
        maxDistance={12}
        enablePan
      />
    </Canvas>
  );
}
