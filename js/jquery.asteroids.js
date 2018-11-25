/**
 * @file
 * Asteroids jQuery code.
 */

(function ($) {
  $.fn.startAsteroids = function () {


    function Asteroids() {
      if (!window.ASTEROIDS) {
        window.ASTEROIDS = {
          enemiesKilled: 0,
          startedPlaying: (new Date()).getTime()
        };
      }

      /*
        Classes
      */
      function Vector(x, y) {
        if (typeof x === 'Object') {
          this.x = x.x;
          this.y = x.y;
        }
        else {
          this.x = x;
          this.y = y;
        }
      }

      Vector.prototype = {
        cp: function () {
          return new Vector(this.x, this.y);
        },
        mul: function (factor) {
          this.x *= factor;
          this.y *= factor;
          return this;
        },
        mulNew: function (factor) {
          return new Vector(this.x * factor, this.y * factor);
        },
        add: function (vec) {
          this.x += vec.x;
          this.y += vec.y;
          return this;
        },
        sub: function (vec) {
          this.x -= vec.x;
          this.y -= vec.y;
          return this;
        },
        // Angle in radians.
        rotate: function (angle) {
          let x = this.x, y = this.y;
          this.x = x * Math.cos(angle) - Math.sin(angle) * y;
          this.y = x * Math.sin(angle) + Math.cos(angle) * y;
          return this;
        },
        setLength: function (length) {
          let l = this.len();
          if (l) {
            this.mul(length / l);
          }
          else {
            this.x = this.y = length;
          }
          return this;
        },
        setLengthNew: function (length) {
          return this.cp().setLength(length);
        },
        normalize: function () {
          let l = this.len();
          this.x /= l;
          this.y /= l;
          return this;
        },
        angle: function () {
          return Math.atan2(this.y, this.x);
        },
        len: function () {
          let l = Math.sqrt(this.x * this.x + this.y * this.y);
          if (l < 0.005 && l > -0.005) {
            return 0;
          }
          return l;
        },
        is: function (test) {
          return typeof test == 'object' && this.x === test.x && this.y === test.y;
        },
        toString: function () {
          return '[Vector(' + this.x + ', ' + this.y + ') angle: ' + this.angle() + ', length: ' + this.len() + ']';
        }
      };

      function Line(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
      }

      Line.prototype = {
        shift: function (pos) {
          this.p1.add(pos);
          this.p2.add(pos);
        },
      };

      /*
        end classes, begin code
      */
      let that = this;
      // IE gets less performance-intensive.
      let isIE = !!window.ActiveXObject;
      let isIEQuirks = isIE && document.compatMode === "BackCompat";

      // Configuration directives are placed in local variables.
      let w = document.documentElement.clientWidth,
          h = document.documentElement.clientHeight;
      if (isIEQuirks) {
        w = document.body.clientWidth;
        h = document.body.clientHeight;
      }

      let playerWidth = 20, playerHeight = 30;

      let playerVerts = [[-1 * playerHeight / 2, -1 * playerWidth / 2], [-1 * playerHeight / 2, playerWidth / 2], [playerHeight / 2, 0]];

      let ignoredTypes = ['HTML', 'HEAD', 'BODY', 'SCRIPT', 'TITLE', 'META', 'STYLE', 'LINK'];
      if (window.ActiveXObject) {
        ignoredTypes = ['HTML', 'HEAD', 'BODY', 'SCRIPT', 'TITLE', 'META', 'STYLE', 'LINK', 'SHAPE', 'LINE', 'GROUP', 'IMAGE', 'STROKE', 'FILL', 'SKEW', 'PATH', 'TEXTPATH', 'INS'];
      } // Half of these are for IE g_vml
      let hiddenTypes = ['BR', 'HR'];

      let FPS = 50;

      // Units/second.
      let acc = 300;
      let maxSpeed = 600;
      // One rotation per second.
      let rotSpeed = 360;
      let bulletSpeed = 700;
      let particleSpeed = 400;
      // How many milliseconds between shots.
      let timeBetweenFire = 150;
      // Milliseconds between enemy blink.
      let timeBetweenBlink = 250;
      let bulletRadius = 2;
      let maxParticles = isIE ? 20 : 40;
      let maxBullets = isIE ? 10 : 20;
      // Generated every 10 ms.
      this.flame = {r: [], y: []};

      // Blink style.
      this.toggleBlinkStyle = function () {
        if (this.updated.blink.isActive) {
          removeClass(document.body, 'ASTEROIDSBLINK');
        }
        else {
          addClass(document.body, 'ASTEROIDSBLINK');
        }

        this.updated.blink.isActive = !this.updated.blink.isActive;
      };

      addStylesheet(".ASTEROIDSBLINK .ASTEROIDSYEAHENEMY", "outline: 2px dotted red;");

      this.pos = new Vector(100, 100);
      this.lastPos = false;
      this.vel = new Vector(0, 0);
      this.dir = new Vector(0, 1);
      this.keysPressed = {};
      this.firedAt = false;
      this.updated = {
        // If the enemy index has been updated since the user pressed B for Blink.
        enemies: false,
        // The time the flame was last updated.
        flame: new Date().getTime(),
        blink: {time: 0, isActive: false}
      };
      this.scrollPos = new Vector(0, 0);

      this.bullets = [];

      // Enemies lay first in this.enemies, when they are shot they are moved to
      // this.dying.
      this.enemies = [];
      this.dying = [];
      this.totalEnemies = 0;

      // Particles are created when something is shot.
      this.particles = [];

      // Things to shoot is everything textual and an element of type not
      // specified in types AND not a navigation element (see further down).
      function updateEnemyIndex() {
        for (let i = 0, enemy; enemy = that.enemies[i]; i++) {
          removeClass(enemy, "ASTEROIDSYEAHENEMY");
        }

        let all = document.body.getElementsByTagName('*');
        that.enemies = [];
        for (let i = 0, el; el = all[i]; i++) {
          // Elements with className ASTEROIDSYEAH are part of the "game".
          if (indexOf(ignoredTypes, el.tagName.toUpperCase()) === -1 && el.prefix !== 'g_vml_' && hasOnlyTextualChildren(el) && el.className !== "ASTEROIDSYEAH" && el.offsetHeight > 0) {
            el.aSize = size(el);
            that.enemies.push(el);

            addClass(el, "ASTEROIDSYEAHENEMY");

            // This is only for enemycounting.
            if (!el.aAdded) {
              el.aAdded = true;
              that.totalEnemies++;
            }
          }
        }
      }

      updateEnemyIndex();

      // CreateFlames create the vectors for the flames of the ship.
      let createFlames;
      (function () {
        let rWidth = playerWidth,
            rIncrease = playerWidth * 0.1,
            yWidth = playerWidth * 0.6,
            yIncrease = yWidth * 0.2,
            halfR = rWidth / 2,
            halfY = yWidth / 2,
            halfPlayerHeight = playerHeight / 2;

        createFlames = function () {
          // Firstly create red flames.
          that.flame.r = [[-1 * halfPlayerHeight, -1 * halfR]];
          that.flame.y = [[-1 * halfPlayerHeight, -1 * halfY]];

          for (let x = 0; x < rWidth; x += rIncrease) {
            that.flame.r.push([-random(2, 7) - halfPlayerHeight, x - halfR]);
          }

          that.flame.r.push([-1 * halfPlayerHeight, halfR]);

          // ... And now the yellow flames.
          for (let x = 0; x < yWidth; x += yIncrease) {
            that.flame.y.push([-random(2, 7) - halfPlayerHeight, x - halfY]);
          }

          that.flame.y.push([-1 * halfPlayerHeight, halfY]);
        };
      })();

      createFlames();

      /*
        Math operations
      */
      function radians(deg) {
        return deg * 0.0174532925;
      }

      function random(from, to) {
        return Math.floor(Math.random() * (to + 1) + from);
      }

      /*
        Misc operations
      */
      function code(name) {
        let table = {'up': 38, 'down': 40, 'left': 37, 'right': 39, 'esc': 27};
        if (table[name]) {
          return table[name];
        }
        return name.charCodeAt(0);
      }

      function boundsCheck(vec) {
        if (vec.x > w) {
          vec.x = 0;
        }
        else if (vec.x < 0) {
          vec.x = w;
        }

        if (vec.y > h) {
          vec.y = 0;
        }
        else if (vec.y < 0) {
          vec.y = h;
        }
      }

      function size(element) {
        let el = element, left = 0, top = 0;
        do {
          left += el.offsetLeft || 0;
          top += el.offsetTop || 0;
          el = el.offsetParent;
        } while (el);

        return {
          x: left,
          y: top,
          width: element.offsetWidth || 10,
          height: element.offsetHeight || 10
        };
      }

      // Taken from:
      // http://www.quirksmode.org/blog/archives/2005/10/_and_the_winner_1.html.
      function addEvent(obj, type, fn) {
        if (obj.addEventListener) {
          obj.addEventListener(type, fn, false);
        }
        else if (obj.attachEvent) {
          obj["e" + type + fn] = fn;
          obj[type + fn] = function () {
            obj["e" + type + fn](window.event);
          };
          obj.attachEvent("on" + type, obj[type + fn]);
        }
      }

      function removeEvent(obj, type, fn) {
        if (obj.removeEventListener) {
          obj.removeEventListener(type, fn, false);
        }
        else if (obj.detachEvent) {
          obj.detachEvent("on" + type, obj[type + fn]);
          obj[type + fn] = null;
          obj["e" + type + fn] = null;
        }
      }

      function applyVisibility(vis) {
        for (let i = 0, p; p = window.ASTEROIDSPLAYERS[i]; i++) {
          p.gameContainer.style.visibility = vis;
        }
      }

      function getElementFromPoint(x, y) {
        // Hide canvas so it isn't picked up.
        applyVisibility('hidden');

        let element = document.elementFromPoint(x, y);

        if (!element) {
          applyVisibility('visible');
          return false;
        }

        if (element.nodeType === 3) {
          element = element.parentNode;
        }

        // Show the canvas again, hopefully it didn't blink.
        applyVisibility('visible');
        return element;
      }

      function addParticles(startPos) {
        let time = new Date().getTime();
        let amount = maxParticles;
        for (let i = 0; i < amount; i++) {
          that.particles.push({
            // Random direction.
            dir: (new Vector(Math.random() * 20 - 10, Math.random() * 20 - 10)).normalize(),
            pos: startPos.cp(),
            cameAlive: time
          });
        }
      }

      function hasOnlyTextualChildren(element) {
        if (element.offsetLeft < -100 && element.offsetWidth > 0 && element.offsetHeight > 0) {
          return false;
        }
        if (indexOf(hiddenTypes, element.tagName) !== -1) {
          return true;
        }

        if (element.offsetWidth === 0 && element.offsetHeight === 0) {
          return false;
        }
        for (let i = 0; i < element.childNodes.length; i++) {
          // <br /> doesn't count... and empty elements.
          if (
              indexOf(hiddenTypes, element.childNodes[i].tagName) === -1
              && element.childNodes[i].childNodes.length !== 0
          ) {
            return false;
          }
        }
        return true;
      }

      function indexOf(arr, item, from) {
        if (arr.indexOf) {
          return arr.indexOf(item, from);
        }
        let len = arr.length;
        for (let i = (from < 0) ? Math.max(0, len + from) : from || 0; i < len; i++) {
          if (arr[i] === item) {
            return i;
          }
        }
        return -1;
      }

      // Taken from MooTools Core.
      function addClass(element, className) {
        if (element.className.indexOf(className) === -1) {
          element.className = (element.className + ' ' + className).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
        }
      }

      // Taken from MooTools Core.
      function removeClass(element, className) {
        element.className = element.className.replace(new RegExp('(^|\\s)' + className + '(?:\\s|$)'), '$1');
      }

      function addStylesheet(selector, rules) {
        let stylesheet = document.createElement('style');
        stylesheet.type = 'text/css';
        stylesheet.rel = 'stylesheet';
        stylesheet.id = 'ASTEROIDSYEAHSTYLES';
        try {
          stylesheet.innerHTML = selector + "{" + rules + "}";
        }
        catch (e) {
          stylesheet.insertRule(selector, rules);
        }
        document.getElementsByTagName("head")[0].appendChild(stylesheet);
      }

      function removeStylesheet(name) {
        let stylesheet = document.getElementById(name);
        if (stylesheet) {
          stylesheet.parentNode.removeChild(stylesheet);
        }
      }

      /*
        == Setup ==
      */
      this.gameContainer = document.createElement('div');
      this.gameContainer.className = 'ASTEROIDSYEAH';
      document.body.appendChild(this.gameContainer);

      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('width', w);
      this.canvas.setAttribute('height', h);
      this.canvas.className = 'ASTEROIDSYEAH';
      with (this.canvas.style) {
        width = w + "px";
        height = h + "px";
        position = "fixed";
        top = "0px";
        left = "0px";
        bottom = "0px";
        right = "0px";
        zIndex = "10000";
      }

      addEvent(this.canvas, 'mousedown', function (e) {
        e = e || window.event;
        let message = document.createElement('span');
        message.style.position = 'absolute';
        message.style.border = '1px solid #999';
        message.style.background = 'white';
        message.style.color = "black";
        message.innerHTML = 'Press Esc to quit';
        document.body.appendChild(message);

        let x = e.pageX || (e.clientX + document.documentElement.scrollLeft);
        let y = e.pageY || (e.clientY + document.documentElement.scrollTop);
        message.style.left = x - message.offsetWidth / 2 + 'px';
        message.style.top = y - message.offsetHeight / 2 + 'px';

        setTimeout(function () {
          try {
            message.parentNode.removeChild(message);
          }
          catch (e) {
          }
        }, 1000);
      });

      let eventResize = function () {
        if (!isIE) {
          that.canvas.style.display = "none";

          w = document.documentElement.clientWidth;
          h = document.documentElement.clientHeight;

          that.canvas.setAttribute('width', w);
          that.canvas.setAttribute('height', h);

          with (that.canvas.style) {
            display = "block";
            width = w + "px";
            height = h + "px";
          }
        }
        else {
          w = document.documentElement.clientWidth;
          h = document.documentElement.clientHeight;

          if (isIEQuirks) {
            w = document.body.clientWidth;
            h = document.body.clientHeight;
          }

          that.canvas.setAttribute('width', w);
          that.canvas.setAttribute('height', h);
        }
        forceChange = true;
      };
      addEvent(window, 'resize', eventResize);

      this.gameContainer.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");

      this.ctx.fillStyle = "black";
      this.ctx.strokeStyle = "black";

      /*
        == Events ==
      */

      let eventKeydown = function (event) {
        event = event || window.event;
        if (event.ctrlKey || event.shiftKey) {
          return;
        }
        that.keysPressed[event.keyCode] = true;

        switch (event.keyCode) {
          case code(' '):
            that.firedAt = 1;
            break;
        }

        // Check here so we can stop propagation appropriately.
        if (indexOf([code('up'), code('down'), code('right'), code('left'), code(' '), code('B'), code('W'), code('A'), code('S'), code('D')], event.keyCode) !== -1) {
          if (event.ctrlKey || event.shiftKey) {
            return;
          }

          if (event.preventDefault) {
            event.preventDefault();
          }
          if (event.stopPropagation) {
            event.stopPropagation();
          }
          event.returnValue = false;
          event.cancelBubble = true;
          return false;
        }
      };
      addEvent(document, 'keydown', eventKeydown);

      let eventKeypress = function (event) {
        event = event || window.event;
        if (indexOf([code('up'), code('down'), code('right'), code('left'), code(' '), code('W'), code('A'), code('S'), code('D')], event.keyCode || event.which) !== -1) {
          if (event.ctrlKey || event.shiftKey) {
            return;
          }

          if (event.preventDefault) {
            event.preventDefault();
          }
          if (event.stopPropagation) {
            event.stopPropagation();
          }
          event.returnValue = false;
          event.cancelBubble = true;
          return false;
        }
      };
      addEvent(document, 'keypress', eventKeypress);

      let eventKeyup = function (event) {
        event = event || window.event;
        that.keysPressed[event.keyCode] = false;

        if (indexOf([code('up'), code('down'), code('right'), code('left'), code(' '), code('B'), code('W'), code('A'), code('S'), code('D')], event.keyCode) !== -1) {
          if (event.preventDefault) {
            event.preventDefault();
          }
          if (event.stopPropagation) {
            event.stopPropagation();
          }
          event.returnValue = false;
          event.cancelBubble = true;
          return false;
        }
      };
      addEvent(document, 'keyup', eventKeyup);

      /*
        Context operations
      */
      this.ctx.clear = function () {
        this.clearRect(0, 0, w, h);
      };

      this.ctx.clear();

      this.ctx.drawLine = function (xFrom, yFrom, xTo, yTo) {
        this.beginPath();
        this.moveTo(xFrom, yFrom);
        this.lineTo(xTo, yTo);
        this.lineTo(xTo + 1, yTo + 1);
        this.closePath();
        this.fill();
      };

      this.ctx.tracePoly = function (verts) {
        this.beginPath();
        this.moveTo(verts[0][0], verts[0][1]);
        for (let i = 1; i < verts.length; i++) {
          this.lineTo(verts[i][0], verts[i][1]);
        }
        this.closePath();
      };

      let THEPLAYER = false;
      if (window.KICKASSIMG) {
        THEPLAYER = document.createElement('img');
        THEPLAYER.src = window.KICKASSIMG;
      }

      this.ctx.drawPlayer = function () {
        if (!THEPLAYER) {
          this.save();
          this.translate(that.pos.x, that.pos.y);
          this.rotate(that.dir.angle());
          this.tracePoly(playerVerts);
          this.fillStyle = "white";
          this.fill();
          this.tracePoly(playerVerts);
          this.stroke();
          this.restore();
        }
        else {
          this.save();
          this.translate(that.pos.x, that.pos.y);
          this.rotate(that.dir.angle() + Math.PI / 2);
          this.drawImage(THEPLAYER, -THEPLAYER.width / 2, -THEPLAYER.height / 2);
          this.restore();
        }
      };

      let PI_SQ = Math.PI * 2;

      this.ctx.drawBullets = function (bullets) {
        for (let i = 0; i < bullets.length; i++) {
          this.beginPath();
          this.arc(bullets[i].pos.x, bullets[i].pos.y, bulletRadius, 0, PI_SQ, true);
          this.closePath();
          this.fill();
        }
      };

      let randomParticleColor = function () {
        return (['red', 'yellow'])[random(0, 1)];
      };

      this.ctx.drawParticles = function (particles) {
        let oldColor = this.fillStyle;

        for (let i = 0; i < particles.length; i++) {
          this.fillStyle = randomParticleColor();
          this.drawLine(particles[i].pos.x, particles[i].pos.y, particles[i].pos.x - particles[i].dir.x * 10, particles[i].pos.y - particles[i].dir.y * 10);
        }

        this.fillStyle = oldColor;
      };

      this.ctx.drawFlames = function (flame) {
        if (THEPLAYER) {
          return;
        }

        this.save();

        this.translate(that.pos.x, that.pos.y);
        this.rotate(that.dir.angle());

        let oldColor = this.strokeStyle;
        this.strokeStyle = "red";
        this.tracePoly(flame.r);
        this.stroke();

        this.strokeStyle = "yellow";
        this.tracePoly(flame.y);
        this.stroke();

        this.strokeStyle = oldColor;
        this.restore();
      };

      /*
        Game loop
      */
      // Attempt to focus window if possible, so keyboard events are posted to us.
      try {
        window.focus();
      }
      catch (e) {
      }

      addParticles(this.pos);
      addClass(document.body, 'ASTEROIDSYEAH');

      let isRunning = true;
      let lastUpdate = new Date().getTime();
      let forceChange = false;

      this.update = function () {
        // ==
        // logic
        // ==
        let nowTime = new Date().getTime();
        let tDelta = (nowTime - lastUpdate) / 1000;
        lastUpdate = nowTime;

        // Update flame and timer if needed.
        let drawFlame = false;
        if (nowTime - this.updated.flame > 50) {
          createFlames();
          this.updated.flame = nowTime;
        }

        this.scrollPos.x = window.pageXOffset || document.documentElement.scrollLeft;
        this.scrollPos.y = window.pageYOffset || document.documentElement.scrollTop;

        // Update player, move forward.
        if ((this.keysPressed[code('up')]) || (this.keysPressed[code('W')])) {
          this.vel.add(this.dir.mulNew(acc * tDelta));

          drawFlame = true;
        }
        else {
          // Decrease speed of player.
          this.vel.mul(0.96);
        }

        // Rotate counter-clockwise.
        if ((this.keysPressed[code('left')]) || (this.keysPressed[code('A')])) {
          forceChange = true;
          this.dir.rotate(radians(rotSpeed * tDelta * -1));
        }

        // Rotate clockwise.
        if ((this.keysPressed[code('right')]) || (this.keysPressed[code('D')])) {
          forceChange = true;
          this.dir.rotate(radians(rotSpeed * tDelta));
        }

        // Fire.
        if (this.keysPressed[code(' ')] && nowTime - this.firedAt > timeBetweenFire) {
          this.bullets.unshift({
            'dir': this.dir.cp(),
            'pos': this.pos.cp(),
            'startVel': this.vel.cp(),
            'cameAlive': nowTime
          });

          this.firedAt = nowTime;

          if (this.bullets.length > maxBullets) {
            this.bullets.pop();
          }
        }

        // Add blink.
        if (this.keysPressed[code('B')]) {
          if (!this.updated.enemies) {
            updateEnemyIndex();
            this.updated.enemies = true;
          }

          forceChange = true;

          this.updated.blink.time += tDelta * 1000;
          if (this.updated.blink.time > timeBetweenBlink) {
            this.toggleBlinkStyle();
            this.updated.blink.time = 0;
          }
        }
        else {
          this.updated.enemies = false;
        }

        if (this.keysPressed[code('esc')]) {
          destroy.apply(this);
          return;
        }

        // Cap speed.
        if (this.vel.len() > maxSpeed) {
          this.vel.setLength(maxSpeed);
        }

        // Add velocity to player (physics).
        this.pos.add(this.vel.mulNew(tDelta));

        // Check bounds X of player, if we go outside we scroll accordingly.
        if (this.pos.x > w) {
          window.scrollTo(this.scrollPos.x + 50, this.scrollPos.y);
          this.pos.x = 0;
        }
        else if (this.pos.x < 0) {
          window.scrollTo(this.scrollPos.x - 50, this.scrollPos.y);
          this.pos.x = w;
        }

        // Check bounds Y.
        if (this.pos.y > h) {
          window.scrollTo(this.scrollPos.x, this.scrollPos.y + h * 0.75);
          this.pos.y = 0;
        }
        else if (this.pos.y < 0) {
          window.scrollTo(this.scrollPos.x, this.scrollPos.y - h * 0.75);
          this.pos.y = h;
        }

        // Update positions of bullets.
        for (let i = this.bullets.length - 1; i >= 0; i--) {
          // Bullets should only live for 2 seconds.
          if (nowTime - this.bullets[i].cameAlive > 2000) {
            this.bullets.splice(i, 1);
            forceChange = true;
            continue;
          }

          let bulletVel = this.bullets[i].dir.setLengthNew(bulletSpeed * tDelta).add(this.bullets[i].startVel.mulNew(tDelta));

          this.bullets[i].pos.add(bulletVel);
          boundsCheck(this.bullets[i].pos);

          // Check collisions.
          let murdered = getElementFromPoint(this.bullets[i].pos.x, this.bullets[i].pos.y);
          if (
              murdered && murdered.tagName &&
              indexOf(ignoredTypes, murdered.tagName.toUpperCase()) === -1 &&
              hasOnlyTextualChildren(murdered) && murdered.className !== "ASTEROIDSYEAH"
          ) {
            addParticles(this.bullets[i].pos);
            this.dying.push(murdered);

            this.bullets.splice(i, 1);
            continue;
          }
        }

        if (this.dying.length) {
          for (let i = this.dying.length - 1; i >= 0; i--) {
            try {
              // If we have multiple spaceships it might have already been removed.
              if (this.dying[i].parentNode) {
                window.ASTEROIDS.enemiesKilled++;
              }

              this.dying[i].parentNode.removeChild(this.dying[i]);
            }
            catch (e) {
            }
          }
          this.dying = [];
        }

        // Update particles position.
        for (let i = this.particles.length - 1; i >= 0; i--) {
          this.particles[i].pos.add(this.particles[i].dir.mulNew(particleSpeed * tDelta * Math.random()));

          if (nowTime - this.particles[i].cameAlive > 1000) {
            this.particles.splice(i, 1);
            forceChange = true;
            continue;
          }
        }

        // ==
        // drawing
        // ==

        // Reposition the canvas area for IE quirks because it does not
        // understand position: fixed.
        if (isIEQuirks) {
          this.gameContainer.style.left =
              this.canvas.style.left = document.documentElement.scrollLeft + "px";
          this.gameContainer.style.top =
              this.canvas.style.top = document.documentElement.scrollTop + "px";

          this.navigation.style.right = "10px";
          this.navigation.style.top
              = document.documentElement.scrollTop + document.body.clientHeight - this.navigation.clientHeight - 10 + "px";
        }

        // Clear.
        if (forceChange || this.bullets.length !== 0 || this.particles.length !== 0 || !this.pos.is(this.lastPos) || this.vel.len() > 0) {
          this.ctx.clear();

          // Draw player.
          this.ctx.drawPlayer();

          // Draw flames.
          if (drawFlame) {
            this.ctx.drawFlames(that.flame);
          }

          // Draw bullets.
          if (this.bullets.length) {
            this.ctx.drawBullets(this.bullets);
          }

          // Draw particles.
          if (this.particles.length) {
            this.ctx.drawParticles(this.particles);
          }
        }
        this.lastPos = this.pos;
        forceChange = false;
      };

      // Start timer.
      let updateFunc = function () {
        that.update.call(that);
      };
      let interval = setInterval(updateFunc, 1000 / FPS);

      function destroy() {
        clearInterval(interval);
        removeEvent(document, 'keydown', eventKeydown);
        removeEvent(document, 'keypress', eventKeypress);
        removeEvent(document, 'keyup', eventKeyup);
        removeEvent(window, 'resize', eventResize);
        isRunning = false;
        this.gameContainer.parentNode.removeChild(this.gameContainer);
        removeStylesheet();
      }
    }

    if (!window.ASTEROIDSPLAYERS) {
      window.ASTEROIDSPLAYERS = [];
    }

    if (window.ActiveXObject && !document.createElement('canvas').getContext) {
      try {
        let xamlScript = document.createElement('script');
        xamlScript.setAttribute('type', 'text/xaml');
        xamlScript.textContent = '<?xml version="1.0"?><Canvas xmlns="http://schemas.microsoft.com/client/2007"></Canvas>';
        document.getElementsByTagName('head')[0].appendChild(xamlScript);
      }
      catch (e) {
      }

      let script = document.createElement("script");
      script.setAttribute('type', 'text/javascript');
      script.onreadystatechange = function () {
        if (script.readyState === 'loaded' || script.readyState === 'complete') {
          if (typeof G_vmlCanvasManager !== "undefined") {
            window.ASTEROIDSPLAYERS[window.ASTEROIDSPLAYERS.length] = new Asteroids();
          }
        }
      };
      script.src = "/libraries/asteroids/js/excanvas.min.js";
      document.getElementsByTagName('head')[0].appendChild(script);
    }
    else {
      window.ASTEROIDSPLAYERS[window.ASTEROIDSPLAYERS.length] = new Asteroids();
    }
  }
})(jQuery);
