import Circle from './Circle';
import Text from './Text';

export default class Canvas {
	constructor() {
    this.circles = [];
    this.pointer = {
      x: 0,
      y: 0,
    };

    this.elem = document.getElementById("primary");
    this.ctx = this.elem.getContext("2d");

    this.attachEvents();
    this.resize();

    // Start
    this.animate();
  }

  attachEvents() {
    window.addEventListener("resize", () => this.resize(), false);
    window.addEventListener("mousemove", (e) => this.setPointerPosition(e), false);
    window.addEventListener("deviceorientation", (e) => this.handleOrientation(e));
    this.translateTouchToMouseEvents();
  }

  translateTouchToMouseEvents() {
    window.addEventListener("touchstart", function (e) {
      var touch = e.touches[0];
      var mouseEvent = new MouseEvent("mousedown", {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      window.dispatchEvent(mouseEvent);
      this.touched = true;
    }, false);

    window.addEventListener("touchmove", function (e) {
      var touch = e.touches[0];
      var mouseEvent = new MouseEvent("mousemove", {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      window.dispatchEvent(mouseEvent);
    }, false);

    window.addEventListener("touchend", function (e) {
      var mouseEvent = new MouseEvent("mouseup", {});
      window.dispatchEvent(mouseEvent);
      this.touched = false;
    }, false);
  }

  resize() {
    this.width = this.elem.width = this.elem.offsetWidth;
    this.height = this.elem.height = this.elem.offsetHeight;

    this.pointer = {
      x: this.width / 2,
      y: this.height * 2 / 5,
    };

    this.calculateTotalCircles();
  }

  setPointerPosition(e) {
    const rect = this.elem.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
  }

  handleOrientation(e) {
    const xmove = (((e.gamma + 90) * 150) / 180) - 75;
    const ymove = (((e.beta + 90) * 150) / 180) - 75;
    if (!this.touched) {
      this.pointer.x = this.pointer.x + xmove;
      this.pointer.y = this.pointer.y + ymove;
    };
    if (this.pointer.x < 0) this.pointer.x = 0;
    if (this.pointer.y < 0) this.pointer.y = 0;
    if (this.pointer.x > this.width) this.pointer.x = this.width;
    if (this.pointer.y > this.height) this.pointer.y = this.height;
  }

  calculateTotalCircles() {
    const totalCircles = Math.sqrt(this.width * this.height) / 2.5;

    for (let i = 0; i < totalCircles; i++) {
      this.circles.push(new Circle(this))
    }
    if (this.circles.length > totalCircles) {
      this.circles.splice(Math.round(totalCircles));
    }
  }

  animate(){
    window.requestAnimationFrame(() => this.animate());
    this.ctx.clearRect(0,0, this.width, this.height);
    for (const c of this.circles) {
     c.draw();
    }
    const text = new Text('Ht', this);
    text.draw();
  }
}
