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

/* A small black lab mix curled up sleeping on the floor. */
function SleepingDog() {
  const black = "#1a1a1a";
  const charcoal = "#2d2d2d";
  const whiteTip = "#e2e8f0";
  const nose = "#0f0f0f";

  return (
    <group position={[0, -1.72, 0]} rotation={[0, Math.PI / 6, 0]}>
      {/* Curled torso — three overlapping spheres form the C-shape */}
      <mesh position={[0, 0, 0.18]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={black} roughness={0.9} />
      </mesh>
      <mesh position={[0.14, 0, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={black} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, -0.18]}>
        <sphereGeometry args={[0.17, 16, 16]} />
        <meshStandardMaterial color={black} roughness={0.9} />
      </mesh>

      {/* Head resting near the tail */}
      <group position={[-0.12, 0.06, -0.22]}>
        <mesh>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color={black} roughness={0.9} />
        </mesh>
        {/* Snout */}
        <mesh position={[0.04, -0.02, 0.08]}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshStandardMaterial color={charcoal} roughness={0.9} />
        </mesh>
        {/* Nose */}
        <mesh position={[0.06, -0.01, 0.12]}>
          <sphereGeometry args={[0.025, 10, 10]} />
          <meshStandardMaterial color={nose} roughness={0.6} />
        </mesh>
        {/* Ear (floppy) */}
        <mesh position={[-0.06, 0.02, -0.02]} rotation={[0.2, 0, -0.3]}>
          <boxGeometry args={[0.06, 0.1, 0.02]} />
          <meshStandardMaterial color={black} roughness={0.95} />
        </mesh>
      </group>

      {/* Tail curled around */}
      <mesh position={[0.16, 0.02, 0.14]} rotation={[0, 0, -0.4]}>
        <capsuleGeometry args={[0.035, 0.14, 8, 8]} />
        <meshStandardMaterial color={black} roughness={0.9} />
      </mesh>

      {/* Front paws tucked in — white tips visible */}
      <mesh position={[-0.06, -0.1, 0.1]} rotation={[0.3, 0, 0]}>
        <capsuleGeometry args={[0.03, 0.08, 8, 8]} />
        <meshStandardMaterial color={black} roughness={0.9} />
      </mesh>
      {/* Front paw white tip */}
      <mesh position={[-0.06, -0.1, 0.15]}>
        <sphereGeometry args={[0.028, 10, 10]} />
        <meshStandardMaterial color={whiteTip} roughness={0.8} />
      </mesh>

      {/* Back paws tucked under — white tips */}
      <mesh position={[0.18, -0.1, -0.06]} rotation={[0.2, 0.5, 0]}>
        <capsuleGeometry args={[0.032, 0.09, 8, 8]} />
        <meshStandardMaterial color={black} roughness={0.9} />
      </mesh>
      {/* Back paw white tip */}
      <mesh position={[0.22, -0.1, -0.08]}>
        <sphereGeometry args={[0.03, 10, 10]} />
        <meshStandardMaterial color={whiteTip} roughness={0.8} />
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
