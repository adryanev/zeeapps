import * as THREE from "three";

const axleAxis = new THREE.Vector3(0, 1, 0);
const rollMarkerGeometry = new THREE.SphereGeometry(0.13, 8, 6);
const rollMarkerMaterial = new THREE.MeshStandardMaterial({ color: 0xf5d59a, roughness: 0.8 });

export type RollingWheel = {
  tire: THREE.Mesh;
  hub: THREE.Object3D;
  radius: number;
  axleSign: number;
};

/** The fleet GLBs keep their cylinders along local Y, even when the rig turns them sideways. */
export function collectRollingWheels(vehicle: THREE.Object3D): RollingWheel[] {
  vehicle.updateMatrixWorld(true);
  const wheels: RollingWheel[] = [];
  vehicle.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.name.includes("_Wheel_")) return;
    const hub = vehicle.getObjectByName(object.name.replace("_Wheel_", "_Hub_"));
    if (!hub) throw new Error(`Missing hub for ${object.name}`);
    object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox;
    if (!bounds) throw new Error(`Missing bounds for ${object.name}`);
    const scale = object.getWorldScale(new THREE.Vector3());
    const radius = Math.max(
      (bounds.max.x - bounds.min.x) * scale.x,
      (bounds.max.z - bounds.min.z) * scale.z,
    ) / 2;
    const axle = axleAxis.clone().applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
    if (radius <= 0 || Math.abs(axle.z) < 0.95) throw new Error(`Invalid rolling axis for ${object.name}`);
    const axleSign = Math.sign(axle.z);
    const localRadius = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2;
    const face = Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y));
    const marker = new THREE.Mesh(rollMarkerGeometry, rollMarkerMaterial);
    marker.name = "Roll_marker";
    marker.position.set(localRadius * 0.65, axleSign * (face + 0.055), 0);
    marker.scale.setScalar(localRadius);
    object.add(marker);
    wheels.push({ tire: object, hub, radius, axleSign });
  });
  return wheels;
}

export function rollWheels(wheels: RollingWheel[], distance: number): void {
  if (distance === 0) return;
  for (const wheel of wheels) {
    const angle = -wheel.axleSign * distance / wheel.radius;
    wheel.tire.rotateOnAxis(axleAxis, angle);
    wheel.hub.rotateOnAxis(axleAxis, angle);
  }
}
