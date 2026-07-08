function initField(tile) {
    var el = tile.querySelector('.field');
    var glow = tile.querySelector('.field-glow');
    var probe = tile.querySelector('.probe');
    var RAMP = ' .:-=+*#%@';
    var LOOP_SECONDS = 22; // the whole ambient field tiles perfectly back to its start every N seconds
    var W = (Math.PI * 2) / LOOP_SECONDS;

    var cols = 0, rows = 0, cx = 0, cy = 0;
    var charW = 8, charH = 13;
    var tileRect = { left: 0, top: 0 };
    var resizeTimer = null;

    // mouse, in grid-cell units, plus a smoothed 0..1 presence so the
    // effect fades in/out instead of snapping when the cursor enters/leaves
    var mouseGX = -9999, mouseGY = -9999;
    var influence = 0, targetInfluence = 0;
    var swirlRadius = 15;   // reach of the vortex, in grid cells
    var swirlAmount = 1.6;  // max rotation applied at the cursor, in radians

    function measureChar() {
        var r = probe.getBoundingClientRect();
        return { w: r.width, h: r.height || 13 };
    }

    function build() {
        var char = measureChar();
        charW = char.w;
        charH = char.h;
        tileRect = tile.getBoundingClientRect();
        cols = Math.max(1, Math.ceil(tileRect.width / char.w) + 1);
        rows = Math.max(1, Math.ceil(tileRect.height / char.h) + 1);
        cx = cols / 2;
        cy = rows / 2;
        glow.style.setProperty('--glow-radius', (swirlRadius * charW) + 'px');
    }

    function fieldValue(x, y, t) {
        // plain (unfolded) coordinates so the flow travels linearly across the
        // whole field instead of mirroring into quadrants around the center
        var fx = x - cx;
        var fy = (y - cy) * 1.9; // compensate for character cells being taller than wide

        // domain-warp the coordinates before sampling, for an organic flowing look
        var wx = fx + Math.sin(fy * 0.05 + t * W * 1) * 7;
        var wy = fy + Math.cos(fx * 0.05 + t * W * 1) * 7;

        // the cursor stirs the field like a paddle in water: nearby cells get
        // rotated around the pointer (a vortex) plus a ring of ripples that
        // travel outward, both fading with distance and with hover presence
        if (influence > 0.002) {
            var dxm = x - mouseGX;
            var dym = (y - mouseGY) * 1.9;
            var distm = Math.sqrt(dxm * dxm + dym * dym);
            var reach = influence * Math.exp(-distm / swirlRadius);

            if (reach > 0.002) {
                var angle = reach * swirlAmount;
                var cosA = Math.cos(angle), sinA = Math.sin(angle);
                var rx = dxm * cosA - dym * sinA;
                var ry = dxm * sinA + dym * cosA;
                wx += rx - dxm;
                wy += (ry - dym);

                wx += reach * Math.sin(distm * 0.5 - t * W * 6) * 4;
                wy += reach * Math.cos(distm * 0.5 - t * W * 6) * 4;
            }
        }

        var n = Math.sin(wx * 0.09 + t * W * 2) * Math.cos(wy * 0.07 - t * W * 3)
              + Math.sin((wx + wy) * 0.05 + t * W * 1) * 0.6
              + Math.sin(wx * 0.03 + wy * 0.06 - t * W * 2) * 0.5;

        return Math.min(1, Math.max(0, (n / 2.1 + 1) / 2)); // normalized 0..1
    }

    function frame(ts) {
        var t = ts / 1000;
        influence += (targetInfluence - influence) * 0.08;
        var lines = new Array(rows);
        for (var y = 0; y < rows; y++) {
            var line = '';
            for (var x = 0; x < cols; x++) {
                var d = fieldValue(x, y, t);
                line += RAMP[Math.floor(d * (RAMP.length - 1))];
            }
            lines[y] = line;
        }
        var text = lines.join('\n');
        el.textContent = text;
        glow.textContent = text;
        glow.style.opacity = influence;
        requestAnimationFrame(frame);
    }

    window.addEventListener('mousemove', function (e) {
        var rect = tile.getBoundingClientRect();
        var lx = e.clientX - rect.left;
        var ly = e.clientY - rect.top;
        mouseGX = lx / charW;
        mouseGY = ly / charH;
        targetInfluence = 1;
        glow.style.setProperty('--mx', lx + 'px');
        glow.style.setProperty('--my', ly + 'px');
    });

    window.addEventListener('mouseleave', function () {
        targetInfluence = 0;
    });

    window.addEventListener('touchmove', function (e) {
        var touch = e.touches[0];
        var rect = tile.getBoundingClientRect();
        var lx = touch.clientX - rect.left;
        var ly = touch.clientY - rect.top;
        mouseGX = lx / charW;
        mouseGY = ly / charH;
        targetInfluence = 1;
        glow.style.setProperty('--mx', lx + 'px');
        glow.style.setProperty('--my', ly + 'px');
    }, { passive: true });

    window.addEventListener('touchend', function () {
        targetInfluence = 0;
    });

    build();
    requestAnimationFrame(frame);

    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(build, 200);
    });
}

document.querySelectorAll('.hero-tile').forEach(initField);
