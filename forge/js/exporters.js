// Forge 3D: exporters. GLB / glTF (three.js GLTFExporter), OBJ + MTL and ASCII FBX 7.4 (written here).
// All of them use meters (1 unit = 1 m), so a 1 m cube is a 1 m cube in Unity.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/+esm";
import { GLTFExporter } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/exporters/GLTFExporter.js/+esm";
import { cornerNormals, faceNormal, faceUVAxes } from "./poly.js";

export function download(name, data, type = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safe = (s) => (s || "Object").replace(/[^A-Za-z0-9_\-]+/g, "_").slice(0, 60) || "Object";

export function exportGLTF(roots, binary) {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(roots, (res) => resolve(binary ? res : JSON.stringify(res, null, 1)), reject, { binary, onlyVisible: true });
  });
}

// meshes in world space with their poly data, for OBJ (OBJ has no hierarchy)
function eachMesh(roots, fn) {
  for (const r of roots) r.traverse((o) => { if (o.isMesh && o.userData.poly && o.visible !== false && isShown(o)) fn(o); });
}
function isShown(o) { for (let p = o; p; p = p.parent) { if (p.visible === false) return false; if (p.userData.isWorld) break; } return true; }

export function exportOBJ(roots, base) {
  let obj = "# Made with Forge 3D (game.gamergunner.com/forge)\n# 1 unit = 1 meter\nmtllib " + base + ".mtl\n", mtl = "# Forge 3D materials\n";
  let vo = 1, vno = 1, vto = 1; const used = new Set(); const mats = new Map(); const nm = new THREE.Matrix3(); const v = new THREE.Vector3();
  eachMesh(roots, (o) => {
    o.updateWorldMatrix(true, false); nm.getNormalMatrix(o.matrixWorld);
    const g = o.userData.poly, mat = o.material;
    const key = mat.color.getHexString() + "_" + mat.roughness + "_" + mat.metalness + "_" + mat.opacity;
    if (!mats.has(key)) {
      const name = "mat" + mats.size + "_" + mat.color.getHexString(); mats.set(key, name);
      const c = mat.color.clone().convertLinearToSRGB(); mtl += "\nnewmtl " + name + "\nKd " + c.r.toFixed(4) + " " + c.g.toFixed(4) + " " + c.b.toFixed(4) +
        "\nKa 0 0 0\nKs " + (0.5 * (1 - mat.roughness)).toFixed(3) + " " + (0.5 * (1 - mat.roughness)).toFixed(3) + " " + (0.5 * (1 - mat.roughness)).toFixed(3) +
        "\nNs " + Math.round(10 + 500 * (1 - mat.roughness) ** 2) + "\nd " + mat.opacity.toFixed(3) + "\nillum 2\n";
    }
    let oname = safe(o.name); if (used.has(oname)) { let k = 2; while (used.has(oname + "_" + k)) k++; oname += "_" + k; } used.add(oname);
    obj += "\no " + oname + "\ng " + oname + "\nusemtl " + mats.get(key) + "\n";
    for (const p of g.v) { v.set(p[0], p[1], p[2]).applyMatrix4(o.matrixWorld); obj += "v " + v.x.toFixed(5) + " " + v.y.toFixed(5) + " " + v.z.toFixed(5) + "\n"; }
    const cn = cornerNormals(g, o.userData.smooth), flip = o.matrixWorld.determinant() < 0;
    g.f.forEach((f, fi) => {
      const [a, b] = faceUVAxes(faceNormal(g, f));
      const ids = f.map((i, k) => {
        const n = new THREE.Vector3(...cn[fi][k]).applyMatrix3(nm).normalize();
        obj += "vn " + n.x.toFixed(4) + " " + n.y.toFixed(4) + " " + n.z.toFixed(4) + "\nvt " + g.v[i][a].toFixed(4) + " " + g.v[i][b].toFixed(4) + "\n";
        return (i + vo) + "/" + (vto++) + "/" + (vno++);
      });
      obj += "f " + (flip ? ids.reverse() : ids).join(" ") + "\n";
    });
    vo += g.v.length;
  });
  return { obj, mtl };
}
function polyN(g, f) {
  const n = new THREE.Vector3();
  for (let i = 0; i < f.length; i++) { const a = g.v[f[i]], b = g.v[f[(i + 1) % f.length]]; n.x += (a[1] - b[1]) * (a[2] + b[2]); n.y += (a[2] - b[2]) * (a[0] + b[0]); n.z += (a[0] - b[0]) * (a[1] + b[1]); }
  return n.normalize();
}

// ---------- ASCII FBX 7.4 ----------
// Models keep their hierarchy and local position / rotation / scale; each mesh gets one material with its color.
export function exportFBX(roots) {
  let id = 1000000; const nid = () => ++id;
  const objects = [], conns = []; let nGeo = 0, nModel = 0, nMat = 0;
  const num = (x) => (Math.abs(x) < 1e-9 ? "0" : +x.toFixed(6) + "");
  const arr = (a) => "*" + a.length + " {\n\t\t\ta: " + a.map(num).join(",") + "\n\t\t} ";
  const iarr = (a) => "*" + a.length + " {\n\t\t\ta: " + a.join(",") + "\n\t\t} ";
  const e = new THREE.Euler();
  const walk = (o, parentId) => {
    if (o.visible === false) return;
    const isMesh = o.isMesh && o.userData.poly;
    const mid = nid(); nModel++;
    e.setFromQuaternion(o.quaternion, "ZYX"); // FBX's default XYZ order = three's ZYX matrix order
    const deg = (r) => num(THREE.MathUtils.radToDeg(r));
    objects.push("\tModel: " + mid + ', "Model::' + safe(o.name) + '", "' + (isMesh ? "Mesh" : "Null") + '" {\n\t\tVersion: 232\n\t\tProperties70:  {\n' +
      '\t\t\tP: "RotationActive", "bool", "", "",1\n\t\t\tP: "InheritType", "enum", "", "",1\n\t\t\tP: "ScalingMax", "Vector3D", "Vector", "",0,0,0\n\t\t\tP: "DefaultAttributeIndex", "int", "Integer", "",0\n' +
      '\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",' + num(o.position.x) + "," + num(o.position.y) + "," + num(o.position.z) + "\n" +
      '\t\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",' + deg(e.x) + "," + deg(e.y) + "," + deg(e.z) + "\n" +
      '\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",' + num(o.scale.x) + "," + num(o.scale.y) + "," + num(o.scale.z) + "\n" +
      '\t\t}\n\t\tShading: T\n\t\tCulling: "CullingOff"\n\t}');
    conns.push('\tC: "OO",' + mid + "," + parentId);
    if (isMesh) {
      const g = o.userData.poly, gid = nid(); nGeo++;
      const verts = g.v.flat(), pvi = [], nrm = [], uvs = [];
      const cn = cornerNormals(g, o.userData.smooth);
      g.f.forEach((f, fi) => {
        const [a, b] = faceUVAxes(faceNormal(g, f));
        f.forEach((i, k) => {
          pvi.push(k === f.length - 1 ? -(i + 1) : i);
          nrm.push(...cn[fi][k]);
          uvs.push(g.v[i][a], g.v[i][b]);
        });
      });
      const edges = []; const seen = new Set(); let pv = 0;
      for (const f of g.f) { for (let k = 0; k < f.length; k++) { const a = f[k], b = f[(k + 1) % f.length], key = a < b ? a + "_" + b : b + "_" + a; if (!seen.has(key)) { seen.add(key); edges.push(pv + k); } } pv += f.length; }
      objects.push("\tGeometry: " + gid + ', "Geometry::' + safe(o.name) + '", "Mesh" {\n' +
        "\t\tVertices: " + arr(verts) + "\n\t\tPolygonVertexIndex: " + iarr(pvi) + "\n\t\tEdges: " + iarr(edges) + "\n\t\tGeometryVersion: 124\n" +
        '\t\tLayerElementNormal: 0 {\n\t\t\tVersion: 101\n\t\t\tName: ""\n\t\t\tMappingInformationType: "ByPolygonVertex"\n\t\t\tReferenceInformationType: "Direct"\n\t\t\tNormals: ' + arr(nrm).replace(/\n\t\t\} $/, "\n\t\t\t}") + "\n\t\t}\n" +
        '\t\tLayerElementUV: 0 {\n\t\t\tVersion: 101\n\t\t\tName: "UVMap"\n\t\t\tMappingInformationType: "ByPolygonVertex"\n\t\t\tReferenceInformationType: "IndexToDirect"\n\t\t\tUV: ' + arr(uvs).replace(/\n\t\t\} $/, "\n\t\t\t}") +
        "\n\t\t\tUVIndex: " + iarr(uvs.map((_, i) => i).filter((i) => i < uvs.length / 2)).replace(/\n\t\t\} $/, "\n\t\t\t}") + "\n\t\t}\n" +
        '\t\tLayerElementMaterial: 0 {\n\t\t\tVersion: 101\n\t\t\tName: ""\n\t\t\tMappingInformationType: "AllSame"\n\t\t\tReferenceInformationType: "IndexToDirect"\n\t\t\tMaterials: *1 {\n\t\t\t\ta: 0\n\t\t\t}\n\t\t}\n' +
        '\t\tLayer: 0 {\n\t\t\tVersion: 100\n\t\t\tLayerElement:  {\n\t\t\t\tType: "LayerElementNormal"\n\t\t\t\tTypedIndex: 0\n\t\t\t}\n\t\t\tLayerElement:  {\n\t\t\t\tType: "LayerElementMaterial"\n\t\t\t\tTypedIndex: 0\n\t\t\t}\n\t\t\tLayerElement:  {\n\t\t\t\tType: "LayerElementUV"\n\t\t\t\tTypedIndex: 0\n\t\t\t}\n\t\t}\n\t}');
      conns.push('\tC: "OO",' + gid + "," + mid);
      const m = o.material, c = m.color.clone().convertLinearToSRGB(), matId = nid(); nMat++;
      objects.push("\tMaterial: " + matId + ', "Material::' + safe(o.name) + "_" + m.color.getHexString() + '", "" {\n\t\tVersion: 102\n\t\tShadingModel: "phong"\n\t\tMultiLayer: 0\n\t\tProperties70:  {\n' +
        '\t\t\tP: "DiffuseColor", "Color", "", "A",' + num(c.r) + "," + num(c.g) + "," + num(c.b) + "\n" +
        '\t\t\tP: "DiffuseFactor", "Number", "", "A",1\n' +
        '\t\t\tP: "TransparencyFactor", "Number", "", "A",' + num(1 - m.opacity) + "\n" +
        '\t\t\tP: "Opacity", "double", "Number", "",' + num(m.opacity) + "\n" +
        '\t\t\tP: "SpecularColor", "Color", "", "A",' + num(0.5 * (1 - m.roughness)) + "," + num(0.5 * (1 - m.roughness)) + "," + num(0.5 * (1 - m.roughness)) + "\n" +
        '\t\t\tP: "Shininess", "double", "Number", "",' + num(2 + 100 * (1 - m.roughness) ** 2) + "\n" +
        "\t\t}\n\t}");
      conns.push('\tC: "OO",' + matId + "," + mid);
    }
    for (const c of o.children) if (c.userData.fid) walk(c, mid);
  };
  for (const r of roots) walk(r, 0);
  const now = new Date();
  const head = "; FBX 7.4.0 project file\n; Made with Forge 3D (game.gamergunner.com/forge). 1 unit = 1 meter.\n; ----------------------------------------------------\n\n" +
    "FBXHeaderExtension:  {\n\tFBXHeaderVersion: 1003\n\tFBXVersion: 7400\n\tCreationTimeStamp:  {\n\t\tVersion: 1000\n\t\tYear: " + now.getFullYear() + "\n\t\tMonth: " + (now.getMonth() + 1) + "\n\t\tDay: " + now.getDate() +
    "\n\t\tHour: " + now.getHours() + "\n\t\tMinute: " + now.getMinutes() + "\n\t\tSecond: " + now.getSeconds() + "\n\t\tMillisecond: 0\n\t}\n\tCreator: \"Forge 3D\"\n}\n" +
    "GlobalSettings:  {\n\tVersion: 1000\n\tProperties70:  {\n" +
    '\t\tP: "UpAxis", "int", "Integer", "",1\n\t\tP: "UpAxisSign", "int", "Integer", "",1\n\t\tP: "FrontAxis", "int", "Integer", "",2\n\t\tP: "FrontAxisSign", "int", "Integer", "",1\n' +
    '\t\tP: "CoordAxis", "int", "Integer", "",0\n\t\tP: "CoordAxisSign", "int", "Integer", "",1\n\t\tP: "OriginalUpAxis", "int", "Integer", "",1\n\t\tP: "OriginalUpAxisSign", "int", "Integer", "",1\n' +
    '\t\tP: "UnitScaleFactor", "double", "Number", "",100\n\t\tP: "OriginalUnitScaleFactor", "double", "Number", "",100\n' +
    '\t\tP: "AmbientColor", "ColorRGB", "Color", "",0,0,0\n\t\tP: "DefaultCamera", "KString", "", "", "Producer Perspective"\n\t\tP: "TimeMode", "enum", "", "",11\n' +
    "\t}\n}\n\nDocuments:  {\n\tCount: 1\n\tDocument: 1000, \"\", \"Scene\" {\n\t\tProperties70:  {\n\t\t\tP: \"SourceObject\", \"object\", \"\", \"\"\n\t\t\tP: \"ActiveAnimStackName\", \"KString\", \"\", \"\", \"\"\n\t\t}\n\t\tRootNode: 0\n\t}\n}\n\n" +
    "References:  {\n}\n\n" +
    "Definitions:  {\n\tVersion: 100\n\tCount: " + (1 + nModel + nGeo + nMat) + "\n" +
    '\tObjectType: "GlobalSettings" {\n\t\tCount: 1\n\t}\n' +
    '\tObjectType: "Model" {\n\t\tCount: ' + nModel + "\n\t}\n" +
    '\tObjectType: "Geometry" {\n\t\tCount: ' + nGeo + "\n\t}\n" +
    '\tObjectType: "Material" {\n\t\tCount: ' + nMat + "\n\t}\n}\n\n";
  return head + "Objects:  {\n" + objects.join("\n") + "\n}\n\nConnections:  {\n" + conns.join("\n") + "\n}\n";
}
