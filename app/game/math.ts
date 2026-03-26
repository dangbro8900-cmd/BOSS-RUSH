export class Vector2 {
  constructor(public x: number, public y: number) {}
  add(v: Vector2) { return new Vector2(this.x + v.x, this.y + v.y); }
  sub(v: Vector2) { return new Vector2(this.x - v.x, this.y - v.y); }
  mult(n: number) { return new Vector2(this.x * n, this.y * n); }
  div(n: number) { return new Vector2(this.x / n, this.y / n); }
  mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  normalize() {
    const m = this.mag();
    return m === 0 ? new Vector2(0, 0) : this.div(m);
  }
  dist(v: Vector2) { return this.sub(v).mag(); }
  copy() { return new Vector2(this.x, this.y); }
  dot(v: Vector2) { return this.x * v.x + this.y * v.y; }
}

export function rectIntersect(
  r1: { x: number; y: number; w: number; h: number },
  r2: { x: number; y: number; w: number; h: number }
) {
  return !(
    r2.x > r1.x + r1.w ||
    r2.x + r2.w < r1.x ||
    r2.y > r1.y + r1.h ||
    r2.y + r2.h < r1.y
  );
}

export function circleIntersect(
  c1: { pos: Vector2; radius: number },
  c2: { pos: Vector2; radius: number }
) {
  const dx = c1.pos.x - c2.pos.x;
  const dy = c1.pos.y - c2.pos.y;
  const distSq = dx * dx + dy * dy;
  const rSum = c1.radius + c2.radius;
  return distSq < rSum * rSum;
}

export function circleLineIntersect(
  circle: { pos: Vector2; radius: number },
  lineStart: Vector2,
  lineDir: Vector2,
  lineWidth: number
) {
  const toCircle = circle.pos.sub(lineStart);
  const projLength = toCircle.dot(lineDir);
  if (projLength < 0) return false;
  
  const projPoint = lineStart.add(lineDir.mult(projLength));
  const distToLine = circle.pos.dist(projPoint);
  
  return distToLine <= circle.radius + lineWidth / 2;
}
