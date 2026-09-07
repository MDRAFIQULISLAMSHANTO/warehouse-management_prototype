/**
 * Interactive 3D warehouse.
 *
 * Modelled on Odoo's own stock 3D view: translucent, colour-coded location
 * volumes with dark wireframe edges, location labels that appear as you zoom
 * in, and a click-through card giving capacity, available space and contents.
 *
 * The colours are computed from live store state, so validating a pick, a
 * put-away or a relocation repaints the affected positions immediately - the
 * view is a window onto the same dataset the dashboards read, not a separate
 * model.
 *
 * All positions share one InstancedMesh, and all their edges share one merged
 * LineSegments. Several thousand individual meshes would stall the frame; two
 * draw calls hold 60fps on a presentation laptop.
 *
 * SCHEMATIC. Rack runs, bay counts, level counts and position totals come from
 * the MinMax drawings; plan coordinates are approximate, not surveyed.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { Link } from "react-router-dom";
import type { CellRow, RackRow, WarehouseRow } from "@/data/derive";
import type { Rack } from "@/data/types";
import { formatInt, formatQty } from "@/odoo/format";
import { useDerived } from "@/store/appStore";
import {
  LEVEL_HEIGHT,
  PLAN_SCALE,
  VISUAL_COLOR,
  VISUAL_LEGEND,
  boundsOf,
  buildCellBoxes,
  type CellBox,
  type CellVisual,
} from "./warehouse3dGeometry";

/**
 * A unit box carrying an all-white `color` attribute.
 *
 * `vertexColors` makes the shader read a per-vertex `color` attribute. A bare
 * BoxGeometry has none, and WebGL then feeds the attribute as (0,0,0), so every
 * instance renders black no matter what setColorAt writes. Supplying white
 * vertex colours makes the final colour equal the per-instance colour.
 */
function makeColouredBox(): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const vertices = geometry.attributes.position.count;
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(vertices * 3).fill(1), 3),
  );
  return geometry;
}

const CELL_GEOMETRY = makeColouredBox();
/** Unit-cube edge positions, reused to build the merged wireframe. */
const UNIT_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

const TEMP_OBJECT = new THREE.Object3D();
const TEMP_COLOR = new THREE.Color();
const WASH = new THREE.Color("#dfe3e6");

/** Camera distance under which individual position labels are drawn. */
const LABEL_DISTANCE = 34;
const MAX_LABELS = 60;
/** Wireframe edges fade in between these camera distances. */
const EDGE_FADE_FAR = 62;
const EDGE_FADE_NEAR = 26;
const ORIGIN = new THREE.Vector3();

// --------------------------------------------------------------- instances

function CellInstances({
  boxes,
  selectedId,
  dimmed,
  onPick,
  onHover,
}: {
  boxes: CellBox[];
  selectedId?: string;
  dimmed?: Set<string>;
  onPick: (cellId: string) => void;
  onHover: (cellId: string | null, clientX: number, clientY: number) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  // Positions change only when the warehouse or its racking changes.
  useEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;

    // The per-instance colour attribute has to exist before the material is
    // compiled, otherwise the shader is built without it and every box renders
    // black regardless of what setColorAt is given afterwards.
    const count = Math.max(1, boxes.length);
    if (!instanced.instanceColor || instanced.instanceColor.count !== count) {
      instanced.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(count * 3).fill(1),
        3,
      );
      const material = instanced.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => (entry.needsUpdate = true));
      } else {
        material.needsUpdate = true;
      }
    }

    boxes.forEach((box, i) => {
      TEMP_OBJECT.position.set(box.x, box.y, box.z);
      TEMP_OBJECT.scale.set(box.width, box.height, box.depth);
      TEMP_OBJECT.updateMatrix();
      instanced.setMatrixAt(i, TEMP_OBJECT.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
  }, [boxes]);

  // Colours are re-applied whenever stock changes, which is what makes the
  // view live: a validated operation flows straight through to this effect.
  useEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    boxes.forEach((box, i) => {
      TEMP_COLOR.set(VISUAL_COLOR[box.visual]);
      // A selection washes everything else out, so the picked volume reads
      // even when it sits deep inside the racking.
      if (selectedId && box.cellId !== selectedId) {
        TEMP_COLOR.lerp(WASH, 0.82);
      } else if (dimmed && !dimmed.has(box.cellId)) {
        TEMP_COLOR.lerp(WASH, 0.78);
      }
      instanced.setColorAt(i, TEMP_COLOR);
    });
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  }, [boxes, selectedId, dimmed]);

  const handleMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      const index = event.instanceId;
      if (index === undefined) return;
      const box = boxes[index];
      if (box) onHover(box.cellId, event.clientX, event.clientY);
    },
    [boxes, onHover],
  );

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      const index = event.instanceId;
      if (index === undefined) return;
      const box = boxes[index];
      if (box) onPick(box.cellId);
    },
    [boxes, onPick],
  );

  return (
    <instancedMesh
      key={boxes.length}
      ref={mesh}
      args={[CELL_GEOMETRY, undefined, Math.max(1, boxes.length)]}
      onPointerMove={handleMove}
      onPointerOut={() => onHover(null, 0, 0)}
      onClick={handleClick}
    >
      {/* Translucent, like Odoo's view, so racking behind stays readable. */}
      <meshLambertMaterial
        vertexColors
        transparent
        opacity={0.62}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/**
 * One merged LineSegments carrying the edges of every box.
 *
 * Drawing an outline per box would mean thousands of objects. Baking all the
 * edge vertices into a single buffer keeps it to one draw call, and the edges
 * are what make neighbouring volumes readable as separate locations.
 */
function CellEdges({ boxes }: { boxes: CellBox[] }) {
  const material = useRef<THREE.LineBasicMaterial>(null);
  const { camera, controls } = useThree();

  /**
   * Edges are what make neighbouring volumes readable close up, but drawn over
   * a whole warehouse of 1,300+ positions at once they turn the wide shot into
   * a grey mesh. They fade in as the camera approaches.
   */
  useFrame(() => {
    const line = material.current;
    if (!line) return;
    const target =
      (controls as unknown as { target?: THREE.Vector3 } | null)?.target ??
      ORIGIN;
    const distance = camera.position.distanceTo(target);
    const opacity =
      distance >= EDGE_FADE_FAR
        ? 0
        : distance <= EDGE_FADE_NEAR
          ? 0.45
          : 0.45 * (1 - (distance - EDGE_FADE_NEAR) / (EDGE_FADE_FAR - EDGE_FADE_NEAR));
    if (Math.abs(line.opacity - opacity) > 0.01) {
      line.opacity = opacity;
      line.visible = opacity > 0.02;
    }
  });

  const geometry = useMemo(() => {
    const unit = UNIT_EDGES.attributes.position.array as ArrayLike<number>;
    const stride = unit.length;
    const out = new Float32Array(boxes.length * stride);
    let cursor = 0;
    for (const box of boxes) {
      for (let i = 0; i < stride; i += 3) {
        out[cursor++] = unit[i] * box.width + box.x;
        out[cursor++] = unit[i + 1] * box.height + box.y;
        out[cursor++] = unit[i + 2] * box.depth + box.z;
      }
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.BufferAttribute(out, 3));
    return merged;
  }, [boxes]);

  // The merged buffer is rebuilt per warehouse; release the previous one.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={material}
        color="#2f3538"
        transparent
        opacity={0}
        visible={false}
      />
    </lineSegments>
  );
}

/**
 * Location labels, drawn only for the boxes nearest the camera once it is
 * close enough to read them. Labelling all several thousand positions at once
 * would be unreadable as well as slow.
 */
function PositionLabels({
  boxes,
  cellById,
  selectedId,
}: {
  boxes: CellBox[];
  cellById: Map<string, CellRow>;
  selectedId?: string;
}) {
  const { camera, controls } = useThree();
  const [visible, setVisible] = useState<CellBox[]>([]);
  const lastRun = useRef(0);
  const lastKey = useRef("");

  useFrame(() => {
    const now = performance.now();
    if (now - lastRun.current < 220) return;
    lastRun.current = now;

    const target =
      (controls as unknown as { target?: THREE.Vector3 } | null)?.target ??
      new THREE.Vector3();
    const distance = camera.position.distanceTo(target);
    if (distance > LABEL_DISTANCE) {
      if (lastKey.current !== "") {
        lastKey.current = "";
        setVisible([]);
      }
      return;
    }

    const near = boxes
      .map((box) => ({
        box,
        d:
          (box.x - target.x) ** 2 +
          (box.y - target.y) ** 2 +
          (box.z - target.z) ** 2,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_LABELS)
      .map((entry) => entry.box);

    const key = near.map((b) => b.cellId).join("|");
    if (key !== lastKey.current) {
      lastKey.current = key;
      setVisible(near);
    }
  });

  return (
    <>
      {visible.map((box) => {
        const cell = cellById.get(box.cellId);
        if (!cell) return null;
        return (
          <Text
            key={box.cellId}
            position={[box.x, box.y, box.z + box.depth / 2 + 0.03]}
            fontSize={Math.min(0.32, box.width * 0.2)}
            maxWidth={box.width * 0.94}
            color={box.cellId === selectedId ? "#111111" : "#2f3538"}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.012}
            outlineColor="#ffffff"
          >
            {cell.name}
          </Text>
        );
      })}
    </>
  );
}

interface RackGeometry {
  rack: Rack;
  levels: number;
  code: string;
}

/** Rack code floating over each run, so the view can be navigated by label. */
function RackLabels({ racks }: { racks: RackGeometry[] }) {
  return (
    <>
      {racks.map(({ rack, levels, code }) => (
        <Text
          key={rack.id}
          position={[
            (rack.x + rack.width / 2 - 500) * PLAN_SCALE,
            levels * LEVEL_HEIGHT + 0.7,
            (rack.y + rack.depth / 2 - 250) * PLAN_SCALE,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.62}
          color="#37424c"
          anchorX="center"
          anchorY="middle"
        >
          {code}
        </Text>
      ))}
    </>
  );
}

/** The white floor the racking stands on, as in Odoo's view. */
function Floor({ bounds }: { bounds: ReturnType<typeof boundsOf> }) {
  const pad = Math.max(6, bounds.span * 0.12);
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[bounds.centreX, -0.04, bounds.centreZ]}
    >
      <planeGeometry
        args={[
          bounds.maxX - bounds.minX + pad * 2,
          bounds.maxZ - bounds.minZ + pad * 2,
        ]}
      />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
}

/**
 * Camera behaviour: frame the whole building, and glide in on a selected
 * position when one is picked.
 */
function CameraRig({
  bounds,
  resetKey,
  focus,
}: {
  bounds: ReturnType<typeof boundsOf>;
  resetKey: string;
  focus: CellBox | null;
}) {
  const { camera } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const desired = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(
    null,
  );

  // Reset / warehouse change: jump straight to the framed view.
  useEffect(() => {
    const distance = Math.max(22, bounds.span * 0.72);
    const pos = new THREE.Vector3(
      bounds.centreX + distance * 0.7,
      Math.max(16, bounds.span * 0.5),
      bounds.centreZ + distance * 0.86,
    );
    const target = new THREE.Vector3(
      bounds.centreX,
      bounds.maxY / 2,
      bounds.centreZ,
    );
    camera.position.copy(pos);
    const orbit = controls.current;
    if (orbit) {
      orbit.target.copy(target);
      orbit.update();
    }
    desired.current = null;
  }, [camera, bounds, resetKey]);

  // Selecting a position asks the camera to glide in on it.
  useEffect(() => {
    if (!focus) return;
    // Approach from the aisle side, far enough out to keep neighbours in shot.
    const reach = Math.max(4.5, focus.width * 6);
    desired.current = {
      pos: new THREE.Vector3(
        focus.x + reach * 0.55,
        focus.y + reach * 0.5,
        focus.z + reach,
      ),
      target: new THREE.Vector3(focus.x, focus.y, focus.z),
    };
  }, [focus]);

  useFrame(() => {
    const next = desired.current;
    if (!next) return;
    const orbit = controls.current;
    camera.position.lerp(next.pos, 0.09);
    if (orbit) {
      orbit.target.lerp(next.target, 0.09);
      orbit.update();
    }
    // Stop steering once we are close, so the user regains full control.
    if (camera.position.distanceTo(next.pos) < 0.35) desired.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      minDistance={2}
      maxDistance={Math.max(160, bounds.span * 3)}
      // Keep the camera above the floor so the view never ends up underneath
      // the racking, which is disorienting during a presentation.
      maxPolarAngle={Math.PI / 2.06}
    />
  );
}

// ------------------------------------------------------------------ public

export interface Warehouse3DProps {
  warehouse: WarehouseRow;
  racks: RackRow[];
  cells: CellRow[];
  rackById: Map<string, Rack>;
  selectedCellId?: string;
  onSelectCell?: (cellId: string) => void;
  /** When set, positions outside the set are washed out rather than hidden. */
  highlightCellIds?: Set<string>;
  height?: number;
  showLabels?: boolean;
}

export function Warehouse3D({
  warehouse,
  racks,
  cells,
  rackById,
  selectedCellId,
  onSelectCell,
  highlightCellIds,
  height = 520,
  showLabels = true,
}: Warehouse3DProps) {
  const [hover, setHover] = useState<{ cellId: string; x: number; y: number } | null>(
    null,
  );
  const [resetKey, setResetKey] = useState(warehouse.id);

  const boxes = useMemo(() => buildCellBoxes(cells, rackById), [cells, rackById]);
  const bounds = useMemo(() => boundsOf(boxes), [boxes]);

  const cellById = useMemo(() => {
    const map = new Map<string, CellRow>();
    for (const cell of cells) map.set(cell.id, cell);
    return map;
  }, [cells]);

  const boxById = useMemo(() => {
    const map = new Map<string, CellBox>();
    for (const box of boxes) map.set(box.cellId, box);
    return map;
  }, [boxes]);

  const rackGeometry = useMemo(() => {
    const out: RackGeometry[] = [];
    for (const row of racks) {
      const rack = rackById.get(row.id);
      if (rack) out.push({ rack, levels: row.levels, code: row.code });
    }
    return out;
  }, [racks, rackById]);

  const selectedCell = selectedCellId ? cellById.get(selectedCellId) : undefined;
  const focusBox = selectedCellId ? (boxById.get(selectedCellId) ?? null) : null;
  const hoveredCell = hover ? cellById.get(hover.cellId) : undefined;

  // Re-frame when the warehouse changes.
  useEffect(() => setResetKey(warehouse.id), [warehouse.id]);

  const counts = useMemo(() => {
    const tally = new Map<CellVisual, number>();
    for (const box of boxes) tally.set(box.visual, (tally.get(box.visual) ?? 0) + 1);
    return tally;
  }, [boxes]);

  return (
    <div className="relative">
      <div
        className="rounded-[var(--o-radius-md)] border border-[var(--o-border)] overflow-hidden"
        style={{ height, background: "#e9ebed" }}
      >
        <Canvas
          dpr={[1, 2]}
          camera={{ fov: 42, near: 0.1, far: 4000 }}
          gl={{ antialias: true }}
        >
          <Suspense fallback={null}>
            <hemisphereLight args={["#ffffff", "#c3cad0", 1.9]} />
            <directionalLight position={[40, 60, 30]} intensity={0.9} />
            <directionalLight position={[-35, 30, -25]} intensity={0.4} />

            <Floor bounds={bounds} />
            <CellEdges boxes={boxes} />
            <CellInstances
              boxes={boxes}
              selectedId={selectedCellId}
              dimmed={highlightCellIds}
              onPick={(cellId) => onSelectCell?.(cellId)}
              onHover={(cellId, x, y) => setHover(cellId ? { cellId, x, y } : null)}
            />
            <PositionLabels
              boxes={boxes}
              cellById={cellById}
              selectedId={selectedCellId}
            />
            {showLabels && <RackLabels racks={rackGeometry} />}

            <CameraRig bounds={bounds} resetKey={resetKey} focus={focusBox} />
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute left-2 top-2 flex items-center gap-1.5">
        <button
          type="button"
          className="o-btn o-btn-secondary o-btn-sm"
          onClick={() => {
            onSelectCell?.("");
            setResetKey(`${warehouse.id}-${Date.now()}`);
          }}
          title="Return the camera to the framed view and clear the selection"
        >
          Reset view
        </button>
        <span
          className="px-2 py-0.5 rounded-[var(--o-radius)] text-[var(--o-fs-xxs)] text-[var(--o-text-muted)]"
          style={{ background: "rgba(255,255,255,0.85)" }}
        >
          Drag to orbit · scroll to zoom · right-drag to pan · click a position
        </span>
      </div>

      {/* Odoo draws the legend inside the scene, top right. */}
      <div
        className="absolute right-2 top-2 px-2.5 py-2 rounded-[var(--o-radius)] text-[var(--o-fs-xs)] flex flex-col gap-0.5"
        style={{ background: "rgba(255,255,255,0.9)", minWidth: 190 }}
      >
        {VISUAL_LEGEND.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2" title={entry.hint}>
            <span
              style={{
                width: 13,
                height: 13,
                borderRadius: 2,
                background: entry.color,
                display: "inline-block",
                flex: "0 0 auto",
              }}
            />
            <span className="font-medium">{entry.label}</span>
            <span className="ml-auto o-tabular text-[var(--o-text-subtle)]">
              {formatInt(counts.get(entry.id) ?? 0)}
            </span>
          </div>
        ))}
      </div>

      {hover && hoveredCell && !selectedCell && (
        <div
          className="o-popover px-2 py-1.5 pointer-events-none text-[var(--o-fs-xs)]"
          style={{
            position: "fixed",
            left: Math.min(hover.x + 14, window.innerWidth - 260),
            top: Math.min(hover.y + 14, window.innerHeight - 110),
            width: 240,
            zIndex: 1200,
          }}
        >
          <div className="font-medium">{hoveredCell.completeName}</div>
          <div className="text-[var(--o-text-muted)]">
            {hoveredCell.palletName
              ? `${hoveredCell.palletName} · ${hoveredCell.productName ?? "empty pallet"}`
              : hoveredCell.blocked
                ? (hoveredCell.blockNote ?? "Blocked")
                : hoveredCell.reservedIncoming
                  ? "Reserved for incoming stock"
                  : "Empty position"}
          </div>
        </div>
      )}

      {selectedCell && (
        <LocationCard cell={selectedCell} onClose={() => onSelectCell?.("")} />
      )}

      <p className="mt-2 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
        {formatInt(boxes.length)} installed positions drawn. Schematic layout:
        bay counts, level counts and position totals come from{" "}
        {warehouse.drawingRef}; plan coordinates are approximate and level
        heights are uniform rather than the drawn beam heights.
      </p>
    </div>
  );
}

/**
 * The selected-position card.
 *
 * Mirrors what Odoo shows when a location is clicked: the location reference,
 * its capacity, the space still available, and the contents. Available space
 * goes negative if a position ever holds more than its capacity, and the card
 * turns red - which is what "Overload" means in the legend.
 */
function LocationCard({ cell, onClose }: { cell: CellRow; onClose: () => void }) {
  const derived = useDerived();
  const contents = useMemo(
    () =>
      cell.palletId ? derived.stock.filter((s) => s.palletId === cell.palletId) : [],
    [derived.stock, cell.palletId],
  );

  const capacity = cell.capacityQty;
  const available = capacity !== undefined ? capacity - cell.quantity : undefined;
  const overloaded = available !== undefined && available < 0;
  const atCapacity = available !== undefined && available <= 0;

  return (
    <div
      className="absolute o-popover"
      style={{
        right: 12,
        bottom: 12,
        width: 330,
        border: `2px solid ${atCapacity ? "var(--o-danger)" : "var(--o-border-strong)"}`,
        zIndex: 20,
      }}
      role="dialog"
      aria-label={`Position ${cell.completeName}`}
    >
      <div className="flex items-start gap-2 px-3 pt-2.5 pb-1.5">
        <div className="min-w-0">
          <div className="font-medium text-[var(--o-fs-sm)]">
            Location: {cell.name}
          </div>
          <div className="text-[var(--o-fs-xxs)] text-[var(--o-text-muted)] o-truncate">
            {cell.completeName}
          </div>
        </div>
        <button
          type="button"
          className="o-btn o-btn-ghost o-btn-sm ml-auto shrink-0"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="px-3 pb-2 text-center text-[var(--o-fs-sm)]">
        {capacity !== undefined ? (
          <>
            <div>
              <strong>Total Capacity:</strong> {formatQty(capacity, cell.uom)}
            </div>
            <div
              className={overloaded ? "text-[var(--o-danger-text)] font-medium" : ""}
            >
              <strong>Available Space:</strong> {formatQty(available ?? 0, cell.uom)}
            </div>
            <div className="text-[var(--o-fs-xxs)] text-[var(--o-text-muted)] mt-0.5">
              Capacity is this product's own full-pallet quantity, not the{" "}
              {cell.maxWeightKg} kg structural rating of the position.
            </div>
          </>
        ) : (
          <div className="text-[var(--o-text-muted)]">
            {cell.blocked
              ? (cell.blockNote ?? "Blocked position")
              : cell.reservedIncoming
                ? "Empty, reserved for incoming stock"
                : "Empty position"}
            <div className="text-[var(--o-fs-xxs)] mt-0.5">
              Position rating {cell.maxWeightKg} kg · one pallet
            </div>
          </div>
        )}
      </div>

      {contents.length > 0 && (
        <table className="o-list">
          <thead>
            <tr>
              <th style={{ width: 26 }}>#</th>
              <th>Product</th>
              <th style={{ textAlign: "right" }}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {contents.map((row, i) => (
              <tr key={row.id}>
                <td>{i + 1}</td>
                <td>
                  <Link to={`/products/${row.productId}`}>{row.productName}</Link>
                  {row.lotName && (
                    <div className="text-[var(--o-fs-xxs)] text-[var(--o-text-muted)]">
                      {row.lotName}
                    </div>
                  )}
                </td>
                <td className="num">{formatQty(row.quantity, row.uom)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex gap-1.5 px-3 py-2 border-t border-[var(--o-border-subtle)]">
        <Link
          className="o-btn o-btn-secondary o-btn-sm"
          to={`/locations/cells/${cell.id}`}
        >
          Open position
        </Link>
        {cell.palletId && (
          <Link className="o-btn o-btn-primary o-btn-sm" to={`/pallets/${cell.palletId}`}>
            Open pallet
          </Link>
        )}
      </div>
    </div>
  );
}
