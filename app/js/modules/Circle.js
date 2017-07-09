export default class Circle {
	constructor(canvas) {
    this.color = "#FFFFFF";

    this.circleMaxSize = 75;

    this.canvas = canvas;
    this.ctx = this.canvas.elem.getContext("2d");
    this.x = Math.random() * this.canvas.width;
    this.y = Math.random() * this.canvas.height;
    this.opacity = 1;
    this.direction = {
      x: (Math.random() * 2) - 1,
      y: (Math.random() * 2) - 1,
    }
    this.changeSize();
    this.draw();
  }

  draw() {
    this.travel();
    this.changeSize();
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.size,  0, 2 * Math.PI);
    this.ctx.fillStyle = this.color;
    this.ctx.fill();
  }

  travel() {
    this.x += this.direction.x;
    this.y += this.direction.y;
    this.edgeDetect();
  }

  edgeDetect() {
    const margin = this.circleMaxSize;
    if (this.x > this.canvas.width + margin) this.x = -margin;
    if (this.y > this.canvas.height + margin) this.y = -margin;
    if (this.x < 0 - margin) this.x = this.canvas.width + margin;
    if (this.y < 0 - margin) this.y = this.canvas.height + margin;
  }

  changeSize() {
    this.setDistanceFromPointer();
    const o = Math.max(0, 300 - this.distanceFromPointer);
    const t = (o/300);
    this.size = Math.abs(t<.5 ? 2*t*t : -1+(4-2*t)*t) * this.circleMaxSize;
  }

  setDistanceFromPointer() {
    const x = Math.abs(this.x - this.canvas.pointer.x);
    const y = Math.abs(this.y - this.canvas.pointer.y);
    this.distanceFromPointer = Math.sqrt(x*x + y*y);
  }
}
