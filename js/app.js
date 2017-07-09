/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */,
/* 1 */,
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(3);


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _Canvas = __webpack_require__(4);

var _Canvas2 = _interopRequireDefault(_Canvas);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

window.circles = [];
window.canvas = new _Canvas2.default();

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Circle = __webpack_require__(5);

var _Circle2 = _interopRequireDefault(_Circle);

var _Text = __webpack_require__(6);

var _Text2 = _interopRequireDefault(_Text);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Canvas = function () {
  function Canvas() {
    _classCallCheck(this, Canvas);

    this.circles = [];
    this.pointer = {
      x: 0,
      y: 0
    };

    this.elem = document.getElementById("primary");
    this.ctx = this.elem.getContext("2d");

    this.attachEvents();
    this.resize();

    // Start
    this.animate();
  }

  _createClass(Canvas, [{
    key: 'attachEvents',
    value: function attachEvents() {
      var _this = this;

      window.addEventListener("resize", function () {
        return _this.resize();
      }, false);
      window.addEventListener("mousemove", function (e) {
        return _this.setPointerPosition(e);
      }, false);
      window.addEventListener("deviceorientation", function (e) {
        return _this.handleOrientation(e);
      });
      this.translateTouchToMouseEvents();
    }
  }, {
    key: 'translateTouchToMouseEvents',
    value: function translateTouchToMouseEvents() {
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
  }, {
    key: 'resize',
    value: function resize() {
      this.width = this.elem.width = this.elem.offsetWidth;
      this.height = this.elem.height = this.elem.offsetHeight;

      this.pointer = {
        x: this.width / 2,
        y: this.height * 2 / 5
      };

      this.calculateTotalCircles();
    }
  }, {
    key: 'setPointerPosition',
    value: function setPointerPosition(e) {
      var rect = this.elem.getBoundingClientRect();
      this.pointer.x = e.clientX - rect.left;
      this.pointer.y = e.clientY - rect.top;
    }
  }, {
    key: 'handleOrientation',
    value: function handleOrientation(e) {
      var xmove = (e.gamma + 90) * 150 / 180 - 75;
      var ymove = (e.beta + 90) * 150 / 180 - 75;
      if (!this.touched) {
        this.pointer.x = this.pointer.x + xmove;
        this.pointer.y = this.pointer.y + ymove;
      };
      if (this.pointer.x < 0) this.pointer.x = 0;
      if (this.pointer.y < 0) this.pointer.y = 0;
      if (this.pointer.x > this.width) this.pointer.x = this.width;
      if (this.pointer.y > this.height) this.pointer.y = this.height;
    }
  }, {
    key: 'calculateTotalCircles',
    value: function calculateTotalCircles() {
      var totalCircles = Math.sqrt(this.width * this.height) / 2.5;

      for (var i = 0; i < totalCircles; i++) {
        this.circles.push(new _Circle2.default(this));
      }
      if (this.circles.length > totalCircles) {
        this.circles.splice(Math.round(totalCircles));
      }
    }
  }, {
    key: 'animate',
    value: function animate() {
      var _this2 = this;

      window.requestAnimationFrame(function () {
        return _this2.animate();
      });
      this.ctx.clearRect(0, 0, this.width, this.height);
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.circles[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var c = _step.value;

          c.draw();
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      var text = new _Text2.default('Ht', this);
      text.draw();
    }
  }]);

  return Canvas;
}();

exports.default = Canvas;

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Circle = function () {
  function Circle(canvas) {
    _classCallCheck(this, Circle);

    this.color = "#FFFFFF";

    this.circleMaxSize = 75;

    this.canvas = canvas;
    this.ctx = this.canvas.elem.getContext("2d");
    this.x = Math.random() * this.canvas.width;
    this.y = Math.random() * this.canvas.height;
    this.opacity = 1;
    this.direction = {
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1
    };
    this.changeSize();
    this.draw();
  }

  _createClass(Circle, [{
    key: "draw",
    value: function draw() {
      this.travel();
      this.changeSize();
      this.ctx.beginPath();
      this.ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
      this.ctx.fillStyle = this.color;
      this.ctx.fill();
    }
  }, {
    key: "travel",
    value: function travel() {
      this.x += this.direction.x;
      this.y += this.direction.y;
      this.edgeDetect();
    }
  }, {
    key: "edgeDetect",
    value: function edgeDetect() {
      var margin = this.circleMaxSize;
      if (this.x > this.canvas.width + margin) this.x = -margin;
      if (this.y > this.canvas.height + margin) this.y = -margin;
      if (this.x < 0 - margin) this.x = this.canvas.width + margin;
      if (this.y < 0 - margin) this.y = this.canvas.height + margin;
    }
  }, {
    key: "changeSize",
    value: function changeSize() {
      this.setDistanceFromPointer();
      var o = Math.max(0, 300 - this.distanceFromPointer);
      var t = o / 300;
      this.size = Math.abs(t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t) * this.circleMaxSize;
    }
  }, {
    key: "setDistanceFromPointer",
    value: function setDistanceFromPointer() {
      var x = Math.abs(this.x - this.canvas.pointer.x);
      var y = Math.abs(this.y - this.canvas.pointer.y);
      this.distanceFromPointer = Math.sqrt(x * x + y * y);
    }
  }]);

  return Circle;
}();

exports.default = Circle;

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Text = function () {
  function Text(text, canvas) {
    _classCallCheck(this, Text);

    this.text = text;
    this.font = "Helvetica Neue, Helvetica, Arial, sans-serif";
    this.size = '200px';
    this.color = "#00F";
    this.canvas = canvas;
  }

  _createClass(Text, [{
    key: "draw",
    value: function draw() {
      this.canvas.ctx.fillStyle = this.color;
      this.canvas.ctx.textAlign = "center";
      this.canvas.ctx.textBaseline = "middle";
      this.canvas.ctx.font = "900 " + this.size + " " + this.font;
      this.canvas.ctx.fillText(this.text, this.canvas.width / 2, this.canvas.height * 2 / 5);
    }
  }]);

  return Text;
}();

exports.default = Text;

/***/ })
/******/ ]);
//# sourceMappingURL=app.js.map