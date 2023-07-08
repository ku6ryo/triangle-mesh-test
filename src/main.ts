import "sanitize.css"
import styles from "./style.module.scss"
import { Vector2 } from "./Vector2"
import Delaunator from "delaunator"

function drawCircle(ctx: CanvasRenderingContext2D , center: Vector2, radius: number, color: string = "red") {
  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function drawLine(ctx: CanvasRenderingContext2D, p1: Vector2, p2: Vector2, width: number = 1, color: string = "red") {
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.closePath()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}


async function drawClosedPath(ctx: CanvasRenderingContext2D, points: Vector2[], width: number = 1, color: string = "red") {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.closePath()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomDiff(divisions: number) {
  return (Math.random() - 0.5) * Math.PI * 2 / divisions * 0.5
}

async function drawRecursive(
  ctx: CanvasRenderingContext2D,
  center: Vector2,
  radius: number,
  divisions: number,
  startAngle: number,
  depth: number
): Promise<Vector2[]> {
  if (divisions % 2 !== 0) {
    throw new Error("Divisions must be even")
  }
  if (depth === 0) {
    return []
  }
  const dAngle = Math.PI * 2 / divisions
  const points: Vector2[] = []
  for (let i = 0; i < divisions / 2; i++) {
    const angle = i * dAngle * 2 + startAngle
    const aPlus = angle + dAngle / 2
    const aMinus = angle - dAngle / 2
    const vAngle = new Vector2(Math.cos(angle), Math.sin(angle)).multiply(radius)
    const vN = new Vector2(Math.cos(aMinus) + randomDiff(divisions), Math.sin(aMinus) + randomDiff(divisions)).multiply(radius).add(center)
    points.push(vN)
    drawCircle(ctx, vN, 4, "#ffb900")
    const childPoints = await drawRecursive(ctx, center.add(vAngle.multiply(2)), radius / 2, divisions, angle - Math.PI + dAngle, depth - 1)
    points.push(...childPoints)
    const vP = new Vector2(Math.cos(aPlus) + randomDiff(divisions), Math.sin(aPlus) + randomDiff(divisions)).multiply(radius).add(center)
    points.push(vP)
    drawCircle(ctx, vP, 4, "#ffb900")
  }
  return points
}

function calcDiffAngle(v1: Vector2, v2: Vector2) {
  const sin = v1.normalize().cross(v2.normalize())
  const cos = v1.normalize().dot(v2.normalize())
  if (sin >= 0) {
    return Math.acos(cos)
  } else {
    return 2 * Math.PI - Math.acos(cos)
  }
}

const appContainer = document.querySelector<HTMLButtonElement>("#app")
if (!appContainer) throw new Error("No app container found")
appContainer.classList.add(styles.app)

const canvasSize = 600

const canvas = document.createElement("canvas")
canvas.className = styles.canvas
canvas.width = canvasSize
canvas.height = canvasSize
appContainer.appendChild(canvas)

const ctx = canvas.getContext("2d")
if (!ctx) throw new Error("Failed to get canvas context")

const center = new Vector2(canvasSize / 2, canvasSize / 2)
const radius = 80
const divisions = 6

;(async () => {
  const points = await drawRecursive(ctx, center, radius, divisions, 0, 3)
  await drawClosedPath(ctx, points, 4, "white")

  const delaunay = Delaunator.from(points.map(p => [p.x, p.y]))
  const triangleIndices = delaunay.triangles

  function isOutlineOrInside(fromIndex: number, toIndex: number) {
    const p = fromIndex === 0 ? points[points.length - 1] : points[fromIndex - 1]
    const f = points[fromIndex]
    const n = fromIndex === points.length - 1 ? points[0] : points[fromIndex + 1]
    const t = points[toIndex]
    const vfp = p.sub(f)
    const vfn = n.sub(f)
    const vft = t.sub(f)
    const anglePT = calcDiffAngle(vfp, vft)
    const anglePN = calcDiffAngle(vfp, vfn)
    return anglePT >= anglePN || (vfp.x === vft.x && vfp.y === vft.y)
  }

  const insideMesh: number[][] = []
  const outsideMesh: number[][] = []
  for (let i = 0; i < triangleIndices.length; i += 3) {
    const ip1 = triangleIndices[i]
    const ip2 = triangleIndices[i + 1]
    const ip3 = triangleIndices[i + 2]
    const inside12 = isOutlineOrInside(ip1, ip2)
    const inside23 = isOutlineOrInside(ip2, ip3)
    const inside31 = isOutlineOrInside(ip3, ip1)
    if (inside12 && inside23 && inside31) {
      insideMesh.push([ip1, ip2, ip3])
    } else {
      outsideMesh.push([ip1, ip2, ip3])
    }
  }

  for (const [ip1, ip2, ip3] of outsideMesh) {
    const p1 = points[ip1]
    const p2 = points[ip2]
    const p3 = points[ip3]
    drawLine(ctx, p1, p2, 2, "#444")
    drawLine(ctx, p2, p3, 2, "#444")
    drawLine(ctx, p3, p1, 2, "#444")
  }

  for (const [ip1, ip2, ip3] of insideMesh) {
    const p1 = points[ip1]
    const p2 = points[ip2]
    const p3 = points[ip3]
    drawLine(ctx, p1, p2, 2, "#f0e")
    drawLine(ctx, p2, p3, 2, "#f0e")
    drawLine(ctx, p3, p1, 2, "#f0e")
  }
})()


