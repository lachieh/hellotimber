export default class Text {
  constructor(text, canvas) {
    this.text = text;
    this.font = "Helvetica Neue, Helvetica, Arial, sans-serif";
    this.size = '200px';
    this.color = "#00F";
    this.canvas = canvas;
  }

  draw() {
    this.canvas.ctx.fillStyle = this.color;
    this.canvas.ctx.textAlign = "center";
    this.canvas.ctx.textBaseline = "middle";
    this.canvas.ctx.font = `900 ${this.size} ${this.font}`;
    this.canvas.ctx.fillText(this.text, this.canvas.width / 2, this.canvas.height * 2 / 5);
  }
}
