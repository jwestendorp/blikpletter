import { useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CanModel } from './CanModel'

const coarse = matchMedia('(pointer: coarse)').matches

// Studio-style reflections for the metal, from three's built-in room.
function Room() {
  const gl = useThree((s) => s.gl)
  const env = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.02).texture
    pmrem.dispose()
    return texture
  }, [gl])
  useEffect(() => () => env.dispose(), [env])
  return <Environment map={env} environmentIntensity={1.7} />
}

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, coarse ? 1.75 : 2]}
      camera={{ fov: 30, near: 0.01, far: 10, position: [0.2, 0.15, 0.45] }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 0.9
      }}
      style={{ touchAction: 'none' }}
    >
      <Room />
      <directionalLight
        position={[0.3, 0.6, 0.4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={coarse ? 1024 : 2048}
        shadow-camera-left={-0.25}
        shadow-camera-right={0.25}
        shadow-camera-top={0.25}
        shadow-camera-bottom={-0.25}
      />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[0.6, 64]} />
        <shadowMaterial opacity={0.18} />
      </mesh>
      <OrbitControls makeDefault enableDamping minDistance={0.1} maxDistance={1.5} />
      <CanModel />
    </Canvas>
  )
}
