(() => {
  const { useMemo, useState, useEffect, useRef } = React;
  const h = React.createElement;

  const TICKS = 1000;
  const MAX_HISTORY = 10;

  const randomPrice = () => Math.floor(Math.random() * TICKS) + 1;

  const initialHistory = () =>
    Array.from({ length: MAX_HISTORY }, () => randomPrice());

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  /* 
     CRYPTO / PROVABLY FAIR HELPERS 
  */
  // 1. Generate a random Hex string (Server Seed)
  const generateRandomHex = (len = 64) => {
    const arr = new Uint8Array(len / 2);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  // 2. SHA-256 Hash (for hiding server seed)
  const sha256 = async (message) => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  // 3. HMAC-SHA256 (The Core RNG)
  const hmacSha256 = async (keyHex, data) => {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(keyHex),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    return new Uint8Array(signature);
  };

  // 4. Calculate Tick from Hash
  const getTickFromHash = (hashBytes) => {
    // Convert first 4 bytes to an unsigned 32-bit integer
    // We use arithmetic multiplication to avoid JavaScript's bitwise text-to-signed-int32 conversion issue
    let val = 0;
    for (let i = 0; i < 4; i++) {
      val = (val * 256) + hashBytes[i];
    }
    // val is 0 to 4294967295
    const p = val / 4294967296; // Normalize to [0, 1)

    // Map to 0-1000 (inclusive) as requested
    return Math.floor(p * 1001);
  };

  // 5. Main wrapper
  const generateResult = async (serverSeed, clientSeed, nonce) => {
    const data = `${clientSeed}:${nonce}`;
    const hashBytes = await hmacSha256(serverSeed, data);
    return getTickFromHash(hashBytes);
  };

  const formatCurrency = (val) =>
    Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });

  const StatusBadge = ({ status }) => {
    const map = {
      idle: { label: "idle", className: "idle" },
      playing: { label: "live", className: "win" },
      lost: { label: "try again", className: "lose" },
      cashed: { label: "cashed out", className: "win" },
    };
    const info = map[status] || map.idle;
    return h("span", { className: `badge ${info.className}` }, info.label);
  };

  /*
     Shared Layout Constants
     GRAPH_PADDING: Reverted for Vertical Overlay (Top 20px)
  */
  const GRAPH_PADDING = { top: 20, right: 60, bottom: 40, left: 30 }; // Increased bottom padding to 70
  const GRAPH_WIDTH = 560;
  const GRAPH_HEIGHT = 286;

  const LineGraph = ({ data, low, high }) => {
    // Canvas dimensions
    const width = GRAPH_WIDTH;
    const height = GRAPH_HEIGHT;
    const padding = GRAPH_PADDING;
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    const maxVal = TICKS;
    const minVal = 0;
    const span = maxVal - minVal;

    // Helper: Scale X/Y
    const scaleX = (i) => padding.left + (i / Math.max(data.length - 1, 1)) * graphWidth;
    const scaleY = (val) => padding.top + graphHeight - ((val - minVal) / span) * graphHeight;

    const points = useMemo(() => {
      if (!data.length) return "";
      return data
        .map((value, idx) => `${scaleX(idx).toFixed(2)},${scaleY(value).toFixed(2)}`)
        .join(" ");
    }, [data, graphWidth, graphHeight]);

    if (!data.length) {
      return h("div", { className: "graph-empty" }, "Waiting for ticks...");
    }

    // Explicit Grid Lines for Alignment
    const gridYCount = 5; // 0, 200, 400, 600, 800, 1000
    const gridYLines = [];
    const priceLabels = [];

    for (let i = 0; i <= gridYCount; i++) {
      const value = (i / gridYCount) * maxVal;
      const y = scaleY(value);

      // Horizontal Line
      gridYLines.push(
        h("line", {
          key: `grid-y-${i}`,
          x1: padding.left,
          y1: y,
          x2: width - padding.right,
          y2: y,
          stroke: "rgba(255, 255, 255, 0.05)",
          strokeWidth: "1"
        })
      );

      // Price Label
      priceLabels.push(
        h("text", {
          key: `label-y-${i}`,
          x: width - padding.right + 12,
          y: y + 4, // Center vertically roughly
          fill: "rgba(255,255,255,0.4)",
          fontSize: "11",
          fontWeight: "500",
          fontFamily: "Outfit",
          textAnchor: "start",
        }, Math.round(value))
      );
    }

    const gridXLines = [];
    const tickLabels = [];

    // Vertical Lines matching data points exactly
    for (let i = 0; i < data.length; i++) {
      const x = scaleX(i);

      // Vertical Line
      gridXLines.push(
        h("line", {
          key: `grid-x-${i}`,
          x1: x,
          y1: padding.top,
          x2: x,
          y2: height - padding.bottom,
          stroke: "rgba(255, 255, 255, 0.05)",
          strokeWidth: "1",
          strokeDasharray: "4 4" // Dashed for X axis
        })
      );

      // Tick Label
      tickLabels.push(
        h("text", {
          key: `tick-${i}`,
          x: x,
          y: height - padding.bottom + 24,
          fill: "rgba(255,255,255,0.3)",
          fontSize: "10",
          fontFamily: "Outfit",
          textAnchor: "middle",
        }, i === data.length - 1 ? "Now" : `T${i + 1}`)
      );
    }

    return h("div", { className: "graph-wrapper" }, [
      h(
        "svg",
        {
          width: "100%",
          height: "100%",
          viewBox: `0 0 ${width} ${height}`,
          preserveAspectRatio: "none",
          className: "tradingview-chart",
          style: { overflow: 'visible' }
        },
        [
          h("defs", { key: "defs" }, [
            // PINK GRADIENTS (Base)
            h("linearGradient", { id: "pinkAreaGradient", x1: "0%", y1: "0%", x2: "0%", y2: "100%" }, [
              h("stop", { offset: "0%", stopColor: "rgba(236, 72, 153, 0.4)" }, [
                h("animate", { attributeName: "stop-opacity", values: "0.4; 0.6; 0.4", dur: "3s", repeatCount: "indefinite" })
              ]),
              h("stop", { offset: "100%", stopColor: "rgba(236, 72, 153, 0)" })
            ]),
            h("linearGradient", { id: "pinkFlowGradient", x1: "0%", y1: "0%", x2: "100%", y2: "0%" }, [
              h("stop", { offset: "0%", stopColor: "rgba(236, 72, 153, 0)" }),
              h("stop", { offset: "50%", stopColor: "rgba(236, 72, 153, 0.2)" }),
              h("stop", { offset: "100%", stopColor: "rgba(236, 72, 153, 0)" }),
              h("animate", { attributeName: "x1", values: "-100%; 100%", dur: "3s", repeatCount: "indefinite" }),
              h("animate", { attributeName: "x2", values: "0%; 200%", dur: "3s", repeatCount: "indefinite" })
            ]),

            // BLUE GRADIENTS (Overlay)
            h("linearGradient", { id: "blueAreaGradient", x1: "0%", y1: "0%", x2: "0%", y2: "100%" }, [
              h("stop", { offset: "0%", stopColor: "rgba(59, 130, 246, 0.4)" }, [
                h("animate", { attributeName: "stop-opacity", values: "0.4; 0.6; 0.4", dur: "3s", repeatCount: "indefinite" })
              ]),
              h("stop", { offset: "100%", stopColor: "rgba(59, 130, 246, 0)" })
            ]),
            h("linearGradient", { id: "blueFlowGradient", x1: "0%", y1: "0%", x2: "100%", y2: "0%" }, [
              h("stop", { offset: "0%", stopColor: "rgba(59, 130, 246, 0)" }),
              h("stop", { offset: "50%", stopColor: "rgba(59, 130, 246, 0.2)" }),
              h("stop", { offset: "100%", stopColor: "rgba(59, 130, 246, 0)" }),
              h("animate", { attributeName: "x1", values: "-100%; 100%", dur: "3s", repeatCount: "indefinite" }),
              h("animate", { attributeName: "x2", values: "0%; 200%", dur: "3s", repeatCount: "indefinite" })
            ]),

            h("filter", { id: "glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, [
              h("feGaussianBlur", { stdDeviation: "3", result: "coloredBlur" }),
              h("feMerge", { key: "m" }, [
                h("feMergeNode", { in: "coloredBlur" }),
                h("feMergeNode", { in: "SourceGraphic" })
              ])
            ]),

            // CLIP PATH for Selected Range
            h("clipPath", { id: "rangeClip" },
              h("rect", {
                x: padding.left,
                y: scaleY(high),
                width: width - padding.left - padding.right,
                height: Math.max(0, scaleY(low) - scaleY(high)),
              })
            )
          ]),

          // Render Grid First (Behind)
          ...gridYLines,
          ...gridXLines,

          // --- BASE LAYER (PINK) ---
          h("g", { key: "base-layer" }, [
            h("polyline", {
              points: `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`,
              fill: "url(#pinkAreaGradient)",
              stroke: "none",
            }),
            h("polyline", {
              points: `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`,
              fill: "url(#pinkFlowGradient)",
              stroke: "none",
              style: { mixBlendMode: "screen" }
            }),
            h("polyline", {
              points,
              fill: "none",
              stroke: "#ec4899",
              strokeWidth: "3",
              strokeLinejoin: "round",
              strokeLinecap: "round",
              style: { filter: "url(#glow)" }
            })
          ]),

          // --- OVERLAY LAYER (BLUE) - Clipped ---
          h("g", { key: "blue-layer", clipPath: "url(#rangeClip)" }, [
            h("polyline", {
              points: `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`,
              fill: "url(#blueAreaGradient)",
              stroke: "none",
            }),
            h("polyline", {
              points: `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`,
              fill: "url(#blueFlowGradient)",
              stroke: "none",
              style: { mixBlendMode: "screen" }
            }),
            h("polyline", {
              points,
              fill: "none",
              stroke: "#3b82f6",
              strokeWidth: "3",
              strokeLinejoin: "round",
              strokeLinecap: "round",
              style: { filter: "url(#glow)" }
            })
          ]),

          // Data Points (Individual coloring is cheaper/cleaner here than clipping circles)
          points.split(" ").map((p, idx) => {
            const [x, y] = p.split(",").map(Number);
            const val = data[idx];
            const inDist = val >= low && val <= high;
            return h("circle", {
              key: `pt-${idx}`,
              cx: x, cy: y,
              r: 3,
              fill: inDist ? "#3b82f6" : "#ec4899", // Blue if in range, Pink if out
              stroke: "none",
              strokeWidth: "0",
            });
          }),

          ...priceLabels,
          ...tickLabels,
        ]
      )
    ]);
  };

  const RangeOverlay = ({ low, high, onChange, mode = 'over' }) => {
    const overlayRef = useRef(null);
    const bandRef = useRef(null);
    const dragging = useRef(null);
    const dragStartY = useRef(0);
    const dragStartLow = useRef(0);
    const dragStartHigh = useRef(0);

    // Strictly clamp incoming values to valid range
    const clampedLow = clamp(low, 0, TICKS); // Allow 0
    const clampedHigh = clamp(high, 1, TICKS); // Keep high at least 1? Yes, span >= 1
    const validLow = Math.min(clampedLow, clampedHigh - 1);
    const validHigh = Math.max(clampedHigh, validLow + 1);

    // Ensure values are always valid on mount/update
    useEffect(() => {
      if (low !== validLow || high !== validHigh) {
        if (Math.abs(low - validLow) > 0 || Math.abs(high - validHigh) > 0) {
          onChange({ low: validLow, high: validHigh });
        }
      }
    }, [low, high, validLow, validHigh, onChange]);

    const pctY = (val) => 100 - (val / TICKS) * 100;

    // USE SHARED CONSTANTS FOR PERFECT ALIGNMENT (PERCENTAGES)
    const { top: paddingTopPx, bottom: paddingBottomPx, left: paddingLeftPx, right: paddingRightPx } = GRAPH_PADDING;
    const graphHeightPx = GRAPH_HEIGHT;
    const graphWidthPx = GRAPH_WIDTH;

    // Convert Px to % for Responsive Overlay
    const paddingLeftPctStr = `${(paddingLeftPx / graphWidthPx) * 100}%`;
    const paddingRightPctStr = `${(paddingRightPx / graphWidthPx) * 100}%`;

    // Unified Event Helper
    const getClientY = (e) => {
      return e.touches ? e.touches[0].clientY : e.clientY;
    };

    const handleMove = (e) => {
      if (!dragging.current || !overlayRef.current) return;

      // Prevent scrolling on touch devices while dragging
      if (e.touches && e.cancelable) {
        e.preventDefault();
      }

      const rect = overlayRef.current.getBoundingClientRect();
      const clientY = getClientY(e);
      const mouseY = clientY - rect.top;

      // Constrain to graph area (accounting for padding)
      const minY = (paddingTopPx / graphHeightPx) * rect.height; // Scale to actual client height
      const maxY = rect.height - (paddingBottomPx / graphHeightPx) * rect.height;

      // Fallback if rect is 0?
      if (rect.height === 0) return;

      const constrainedY = clamp(mouseY, minY, maxY);
      // Determine ratio within the "active graph area"
      const graphAreaHeight = maxY - minY;
      const ratio = (constrainedY - minY) / graphAreaHeight;

      // Calculate tick from ratio (0 at bottom, TICKS at top)
      const tick = clamp(Math.round((1 - ratio) * TICKS), 0, TICKS);

      let newLow = validLow;
      let newHigh = validHigh;

      if (dragging.current === "band") {
        const deltaY = clientY - dragStartY.current;
        if (Math.abs(deltaY) < 2) return;

        // Delta tick based on percentage of movement
        const deltaRatio = deltaY / graphAreaHeight;
        const deltaTick = Math.round(deltaRatio * TICKS);
        const span = dragStartHigh.current - dragStartLow.current;

        newLow = dragStartLow.current - deltaTick;
        newHigh = newLow + span;

        const validSpan = Math.max(1, Math.min(span, TICKS));
        const maxLow = TICKS - validSpan;

        newLow = clamp(newLow, 0, maxLow);
        newHigh = newLow + validSpan;

      } else if (dragging.current === "low") {
        const maxLow = Math.min(validHigh - 1, TICKS - 1);
        const constrainedTick = Math.max(0, Math.min(tick, maxLow));
        newLow = constrainedTick;
        newHigh = Math.max(constrainedTick + 1, Math.min(validHigh, TICKS));

      } else if (dragging.current === "high") {
        const minHigh = Math.max(validLow + 1, 1);
        const constrainedTick = Math.max(minHigh, Math.min(tick, TICKS));
        newHigh = constrainedTick;
        newLow = Math.max(0, Math.min(validLow, constrainedTick - 1));
      }

      // Enforce 750 Limit (Refactored from 800)
      if (newHigh - newLow > 750) {
        if (dragging.current === "low") {
          newLow = newHigh - 750;
        } else {
          newHigh = newLow + 750;
        }
      }

      onChange({ low: newLow, high: newHigh });
    };

    const handleEnd = () => {
      dragging.current = null;
      if (bandRef.current) bandRef.current.style.opacity = "1";

      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
    };

    const startDrag = (e, type) => {
      // Ignore if clicking handle when we meant band, handled by stopPropagation usually
      // But simpler to just separate handlers or use unified one.
      // Let's keep separate "binders" but unified logic
    };

    const handleBandStart = (e) => {
      if (e.target.classList.contains("range-handle") || e.target.closest(".range-handle")) {
        return;
      }
      // Prevent Default on Touch to stop scrolling/refresh
      if (e.touches) e.preventDefault();
      if (e.type === 'mousedown') {
        e.preventDefault(); // Stop text selection
      }

      dragging.current = "band";
      dragStartY.current = getClientY(e);
      dragStartLow.current = validLow;
      dragStartHigh.current = validHigh;

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleMove, { passive: false });
      document.addEventListener("touchend", handleEnd);

      e.stopPropagation();

      if (bandRef.current) {
        bandRef.current.style.opacity = "0.7";
      }
    };

    const handleHandleStart = (handleType) => (e) => {
      if (e.touches) e.preventDefault();
      if (e.type === 'mousedown') e.preventDefault();

      dragging.current = handleType;
      dragStartY.current = getClientY(e);
      dragStartLow.current = validLow;
      dragStartHigh.current = validHigh;

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleMove, { passive: false });
      document.addEventListener("touchend", handleEnd);

      e.stopPropagation();
    };

    useEffect(() => {
      return () => {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleEnd);
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("touchend", handleEnd);
      };
    }, []);

    // Use clamped values for positioning - BULLETPROOF bounds
    // UPDATED: Allow 0 logic
    const safeHigh = Math.max(1, Math.min(validHigh, TICKS));
    const safeLow = Math.max(0, Math.min(validLow, safeHigh - 1)); // Allow 0


    const topPct = pctY(safeHigh);
    const bottomPct = pctY(safeLow);
    const paddingTopPct = (paddingTopPx / graphHeightPx) * 100;
    const paddingBottomPct = (paddingBottomPx / graphHeightPx) * 100;
    const graphHeightPct = 100 - paddingTopPct - paddingBottomPct;

    const topPosition = paddingTopPct + (topPct / 100) * graphHeightPct;
    const bottomPosition = paddingTopPct + (bottomPct / 100) * graphHeightPct;

    const minTop = paddingTopPct;
    const maxBottom = 100 - paddingBottomPct;
    const adjustedTop = Math.max(minTop, Math.min(topPosition, maxBottom));
    const adjustedBottom = Math.max(minTop, Math.min(bottomPosition, maxBottom));

    const finalTop = Math.max(minTop, Math.min(Math.min(adjustedTop, adjustedBottom), maxBottom));
    const finalBottom = Math.max(minTop, Math.min(Math.max(adjustedTop, adjustedBottom), maxBottom));

    return h(
      "div",
      { className: "range-overlay", ref: overlayRef },
      [
        // Inverted Masks (Unselected Areas)
        // Constrained to GRID AREA only (excluding padding)
        h("div", {
          key: "mask-top",
          className: "range-mask mask-top",
          style: {
            top: `${paddingTopPct}%`, // Start at grid top
            height: `${Math.max(0, finalTop - paddingTopPct)}%`, // Height is distance to band top
            left: paddingLeftPctStr,
            right: paddingRightPctStr,
          }
        }),
        h("div", {
          key: "mask-bottom",
          className: "range-mask mask-bottom",
          style: {
            top: `${finalBottom}%`,
            height: `${Math.max(0, (100 - paddingBottomPct) - finalBottom)}%`, // Height is distance to grid bottom
            left: paddingLeftPctStr,
            right: paddingRightPctStr,
          }
        }),

        // Inner Grid Border (Frames the chart area, excludes axes)
        h("div", {
          key: "grid-border",
          style: {
            position: "absolute",
            top: `${paddingTopPct}%`,
            bottom: `${paddingBottomPct}%`,
            left: paddingLeftPctStr,
            right: paddingRightPctStr,
            border: "1px solid rgba(255, 255, 255, 0.3)",
            borderRadius: "4px",
            pointerEvents: "none",
            zIndex: 10
          }
        }),

        // The Band (Selected Window - Now Transparent)
        h("div", {
          key: "band",
          ref: bandRef,
          className: "band",
          style: {
            top: `${finalTop}%`,
            height: `${finalBottom - finalTop}%`,
            maxHeight: `${100 - paddingTopPct - paddingBottomPct}%`,
            left: paddingLeftPctStr,
            right: paddingRightPctStr,
            width: 'auto'
          },
          onMouseDown: (e) => e.preventDefault(), // Disable band dragging
          onTouchStart: (e) => e.preventDefault() // Disable band dragging
        }),
        // Show Low Handle ONLY if mode is 'over' (user controls low)
        mode === 'over' ? h("div", {
          key: "handle-low",
          className: "range-handle range-handle-low",
          style: {
            top: `calc(${finalBottom}% - 6px)`,
            left: paddingLeftPctStr,
            right: paddingRightPctStr,
          },
          onMouseDown: handleHandleStart("low"),
          onTouchStart: handleHandleStart("low")
        }, h("div", { className: "handle-pill" }, safeLow)) : null,
        mode === 'under' ? h("div", {
          key: "handle-high",
          className: "range-handle range-handle-high",
          style: {
            top: `calc(${finalTop}% - 6px)`,
            left: paddingLeftPctStr,
            right: paddingRightPctStr,
          },
          onMouseDown: handleHandleStart("high"),
          onTouchStart: handleHandleStart("high")
        }, h("div", { className: "handle-pill" }, safeHigh)) : null,
      ]
    );
  };

  /*
     GRAPH LABELS OVERLAY COMPONENT
     Renders text and pills on top of the blur mask
  */
  const GraphLabelsOverlay = ({ data, width, height, padding, low, high }) => {
    // Replicate scaling logic to align perfectly with LineGraph
    const maxY = TICKS; // FIXED: Use global TICKS (1000)
    const minY = 0;
    const rangeY = maxY - minY;

    const scaleX = (width - padding.left - padding.right) / Math.max(data.length - 1, 1); // Match LineGraph X scale
    const scaleY = (height - padding.top - padding.bottom) / rangeY;

    // Check last point status
    const lastVal = data[data.length - 1];
    const isLastInRange = lastVal >= low && lastVal <= high;
    const activeColor = isLastInRange ? "#3b82f6" : "#ec4899";

    return h("svg", {
      width: "100%",
      height: "100%",
      viewBox: `0 0 ${width} ${height}`,

      style: { position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 15 } // Z-Index 15: Above Mask(5), Below Handle(20)
    }, [
      // History Labels (ALL ticks)
      data.map((val, idx) => {
        // if (idx === data.length - 1) return null; // Logic removed: Show Last Tick
        const isLast = idx === data.length - 1;

        const x = padding.left + idx * scaleX;
        const y = height - padding.bottom - (val - minY) * scaleY;
        const priceStr = val.toString();
        // Dynamic Width Calculation
        const charW = 7;
        const paddingW = 12;
        const w = paddingW + (priceStr.length * charW);
        const pillHeight = isLast ? 24 : 16; // Height reference

        // --- Boundary Clamping Logic ---

        // 1. Vertical Positioning (Smart Flip + Clamp)
        // Default to ABOVE the point
        let pillY = y - pillHeight - 8;

        // If it spills off the TOP, flip to BELOW
        if (pillY < 2) {
          pillY = y + 12;
        }

        // Hard Clamp Y to keep inside container (Bottom check)
        // Ensure it doesn't go off the bottom edge
        pillY = Math.max(2, Math.min(height - pillHeight - 2, pillY));

        // 2. Horizontal Clamping (Keep fully visible)
        let pillLeft = x - (w / 2);
        // Clamp Left
        if (pillLeft < 2) pillLeft = 2;
        // Clamp Right
        if (pillLeft + w > width - 2) pillLeft = width - w - 2;

        // Re-derive Center X from clamped Left
        const resultX = pillLeft + (w / 2);


        if (isLast) {
          const lastTickW = 20 + (priceStr.length * 8.5);
          // Re-run horizontal clamp for the possibly wider last tick
          let lastLeft = x - (lastTickW / 2);
          if (lastLeft < 2) lastLeft = 2;
          if (lastLeft + lastTickW > width - 2) lastLeft = width - lastTickW - 2;

          return h("foreignObject", {
            key: `lbl-${idx}`,
            x: lastLeft,
            y: pillY - 2, // Adjust for HTML positioning
            width: lastTickW,
            height: 24,
            style: { overflow: 'visible' }
          }, h("div", {
            className: "handle-pill last-tick",
            style: {
              width: '100%',
              height: '100%',
              padding: '0',
              background: activeColor, // Dynamic Background
              boxShadow: `0 0 12px ${activeColor}cc`, // Dynamic Glow
              borderColor: '#fff'
            }
          }, priceStr));
        }

        return h("g", { key: `lbl-${idx}` }, [
          h("rect", {
            x: resultX - (w / 2), y: pillY, width: w, height: 16, rx: 8,
            fill: "#050505",
            stroke: "rgba(255, 255, 255, 0.2)",
            strokeWidth: "1"
          }),
          h("text", {
            x: resultX, y: pillY + 8,
            textAnchor: "middle",
            fill: "#fff",
            fontSize: "10px",
            fontWeight: "600",
            dominantBaseline: "central",
            style: { pointerEvents: "none" }
          }, priceStr)
        ]);
      }),

      // White Dot (Moved here to be above blur)
      (() => {
        const lastIdx = data.length - 1;
        const lastVal = data[lastIdx];
        const lastX = padding.left + lastIdx * scaleX;
        const lastY = height - padding.bottom - (lastVal - minY) * scaleY;
        return h("circle", {
          key: "last-dot",
          cx: lastX, cy: lastY,
          r: 8,
          fill: "#ffffff",
          stroke: activeColor, // Dynamic Stroke
          strokeWidth: "3",
          style: { filter: "url(#glow)", animation: "pulse-dot 2s infinite" }
        });
      })(),
    ]);
  };



  /* 
     DEFI PREDICTION GAME
     App Component - Implements Swap Interface & Range Logic
  */
  /* 
     PROVABLY FAIR MODAL
  */
  const ProvablyFairModal = ({
    isOpen,
    onClose,
    serverSeedHash,
    clientSeed,
    nonce,
    onRotate,
    onChangeClientSeed,
    prevServerSeed,
    prevClientSeed,
    prevNonceMax
  }) => {
    const [activeTab, setActiveTab] = useState('seeds'); // 'seeds' | 'verify'

    // Verify State
    const [vServerSeed, setVServerSeed] = useState("");
    const [vClientSeed, setVClientSeed] = useState("");
    const [vNonce, setVNonce] = useState("");
    const [vResult, setVResult] = useState(null);
    const [showHelp, setShowHelp] = useState(false); // Help Toggle

    // Auto-fill verify form when rotating
    useEffect(() => {
      if (prevServerSeed) {
        setVServerSeed(prevServerSeed);
        setVClientSeed(prevClientSeed || "");
        // Default to the LAST played game (prevNonceMax - 1) so it matches the screen
        setVNonce(prevNonceMax > 0 ? prevNonceMax - 1 : 0);
      }
    }, [prevServerSeed, prevClientSeed, prevNonceMax]);

    const handleVerify = async () => {
      if (!vServerSeed || !vClientSeed || vNonce === "") return;
      const tick = await generateResult(vServerSeed, vClientSeed, parseInt(vNonce));
      setVResult(tick);
    };

    if (!isOpen) return null;

    return h("div", { className: "modal-backdrop", onClick: onClose }, [
      h("div", { className: "modal", onClick: e => e.stopPropagation() }, [
        h("div", { className: "modal-header" }, [
          h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
            h("h3", { className: "modal-title" }, "Fairness"),
            h("button", {
              className: "icon-btn help-btn",
              onClick: () => setShowHelp(!showHelp),
              title: "How it works"
            }, "?")
          ]),
          h("button", { className: "close", onClick: onClose }, "✕")
        ]),

        showHelp ? h("div", { className: "help-view" }, [
          h("h4", {}, "How to verify fairness"),
          h("p", {}, "Our system uses industry-standard cryptography (HMAC-SHA256) to ensure transparency."),
          h("div", { className: "help-steps" }, [
            h("div", { className: "step" }, [
              h("span", { className: "step-num" }, "1"),
              h("p", {}, "We show you the hashed server seed before you play. This proves we can't change the seed later.")
            ]),
            h("div", { className: "step" }, [
              h("span", { className: "step-num" }, "2"),
              h("p", {}, "You can randomize your Client Seed at any time. The result is calculated using both our seed and yours.")
            ]),
            h("div", { className: "step" }, [
              h("span", { className: "step-num" }, "3"),
              h("p", {}, "Click 'Rotate Seed' to reveal the previous Server Seed. You can then use the 'Verify' tab to check that the game results remain consistent.")
            ]),
          ]),
          h("button", { className: "btn secondary full-width", onClick: () => setShowHelp(false) }, "Got it")

        ]) : [
          // Tabs
          h("div", { className: "modal-tabs", key: "tabs" }, [
            h("button", {
              className: `tab-btn ${activeTab === 'seeds' ? 'active' : ''}`,
              onClick: () => setActiveTab('seeds')
            }, "Active Seeds"),
            h("button", {
              className: `tab-btn ${activeTab === 'verify' ? 'active' : ''}`,
              onClick: () => setActiveTab('verify')
            }, "Verify")
          ]),

          h("div", { className: "modal-body", key: "body" }, [
            activeTab === 'seeds' ? h("div", { className: "seeds-view" }, [
              h("div", { className: "input-group" }, [
                h("label", {}, "Active Client Seed (Editable)"),
                h("div", { className: "input-row" }, [
                  h("input", {
                    type: "text",
                    value: clientSeed,
                    onChange: e => onChangeClientSeed(e.target.value),
                    className: "seed-input"
                  }),
                  h("button", {
                    className: "icon-btn",
                    onClick: () => onChangeClientSeed(generateRandomHex(16)),
                    title: "Randomize"
                  }, "🎲")
                ])
              ]),
              h("div", { className: "input-group" }, [
                h("label", {}, "Active Server Seed (Hashed)"),
                h("input", { type: "text", value: serverSeedHash, readOnly: true, className: "seed-input readonly" })
              ]),
              h("div", { className: "input-group" }, [
                h("label", {}, "Nonce"),
                h("input", { type: "number", value: nonce, readOnly: true, className: "seed-input readonly" })
              ]),
              h("div", { className: "rotate-section" }, [
                h("p", { className: "notice" }, "Rotate your seed to reveal the previous server seed and verify past bets."),
                h("button", { className: "btn primary full-width", onClick: onRotate }, "Rotate Seed")
              ]),

              // Reveal Section
              prevServerSeed && h("div", { className: "revealed-section" }, [
                h("h4", {}, "Previous Seed Pair (Revealed)"),
                h("div", { className: "input-group" }, [
                  h("label", {}, "Server Seed"),
                  h("div", { className: "input-row" }, [
                    h("input", { type: "text", value: prevServerSeed, readOnly: true, className: "seed-input readonly" }),
                    h("button", {
                      className: "icon-btn",
                      onClick: () => navigator.clipboard.writeText(prevServerSeed),
                      title: "Copy"
                    }, "📋")
                  ])
                ]),
                h("div", { className: "input-group" }, [
                  h("label", {}, "Client Seed"),
                  h("div", { className: "input-row" }, [
                    h("input", { type: "text", value: prevClientSeed, readOnly: true, className: "seed-input readonly" }),
                    h("button", {
                      className: "icon-btn",
                      onClick: () => navigator.clipboard.writeText(prevClientSeed),
                      title: "Copy"
                    }, "📋")
                  ])
                ]),
                h("button", {
                  className: "btn secondary full-width",
                  onClick: () => setActiveTab('verify')
                }, "Verify Previous Outcomes")
              ])
            ]) : h("div", { className: "verify-view" }, [
              h("div", { className: "input-group" }, [
                h("label", {}, "Server Seed"),
                h("input", {
                  type: "text",
                  value: vServerSeed,
                  onChange: e => setVServerSeed(e.target.value),
                  className: "seed-input"
                })
              ]),
              h("div", { className: "input-group" }, [
                h("label", {}, "Client Seed"),
                h("input", {
                  type: "text",
                  value: vClientSeed,
                  onChange: e => setVClientSeed(e.target.value),
                  className: "seed-input"
                })
              ]),
              h("div", { className: "input-group" }, [
                h("label", {}, "Nonce"),
                h("input", {
                  type: "number",
                  value: vNonce,
                  onChange: e => setVNonce(e.target.value),
                  className: "seed-input"
                })
              ]),
              h("button", { className: "btn secondary full-width", onClick: handleVerify }, "Verify Outcome"),

              vResult !== null && h("div", { className: "verify-result" }, [
                h("span", {}, "Result:"),
                h("strong", { className: "result-value" }, vResult)
              ])
            ])
          ])
        ]
      ])
    ]);
  };

  /*
     DEFI PREDICTION GAME
     History Tape Component
  */
  const HistoryTape = ({ history }) => {
    // We only want the last 15, excluding the render init ones ideally, but raw history is fine
    // We'll reverse it to show newest left/first
    const show = [...history].reverse().slice(0, 20);
    return h("div", { className: "history-tape" }, [
      show.map((val, idx) =>
        h("div", { key: idx, className: "history-chip" }, [
          h("img", { src: "usdc.png", className: "mini-logo", key: "logo" }),
          val
        ])
      )
    ]);
  };


  /*
     STATS VIEW COMPONENT
  */
  const StatsView = ({ bets, pnl }) => {
    // Calculate Stats
    const totalBets = bets.length;
    const wins = bets.filter(b => b.result === 'win').length;
    const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : 0;

    return h("div", { className: "stats-view" }, [
      // PnL Summary Cards
      h("div", { className: "pnl-summary" }, [
        h("div", { className: "stat-box" }, [
          h("span", { className: "stat-label" }, "Session PnL"),
          h("span", { className: "stat-value", style: { color: pnl >= 0 ? "#27ae60" : "#fd4f4f" } },
            `${pnl >= 0 ? "+" : ""}${formatCurrency(pnl)} USDC`)
        ]),
        h("div", { className: "stat-box" }, [
          h("span", { className: "stat-label" }, "Total Trades"),
          h("span", { className: "stat-value" }, totalBets)
        ]),
        h("div", { className: "stat-box" }, [
          h("span", { className: "stat-label" }, "Win Rate"),
          h("span", { className: "stat-value" }, `${winRate}%`)
        ])
      ]),

      // History Table
      h("div", { className: "stats-card" }, [
        h("h3", { style: { marginTop: 0, fontSize: "16px" } }, "Trade History"),
        bets.length === 0
          ? h("div", { style: { padding: "20px", textAlign: "center", color: "#666" } }, "No trades yet.")
          : h("table", { className: "history-table" }, [
            h("thead", {}, h("tr", {}, [
              h("th", {}, "Result"),
              h("th", {}, "Return"),
              h("th", {}, "Bet"),
              h("th", {}, "Payout"),
              h("th", {}, "Range")
            ])),
            h("tbody", {}, bets.slice().reverse().map((bet, i) =>
              h("tr", { key: i }, [
                h("td", { className: bet.result === 'win' ? "win-text" : "loss-text" },
                  bet.result.toUpperCase()),
                h("td", {}, `${(bet.payout / bet.amount).toFixed(2)}x`),
                h("td", {}, [
                  h("span", {}, bet.amount),
                  h("img", { src: "usdc.png", className: "mini-logo", style: { marginLeft: "4px" } })
                ]),
                h("td", { className: bet.payout > 0 ? "win-text" : "" }, [
                  h("span", {}, bet.payout > 0 ? `+${bet.payout}` : "0"),
                  h("img", { src: "usdc.png", className: "mini-logo", style: { marginLeft: "4px" } })
                ]),
                h("td", { style: { fontSize: "12px", color: "#666" } }, `${bet.range.low}-${bet.range.high}`)
              ])
            ))
          ])
      ])
    ]);
  };

  /*
     DEFI PREDICTION GAME
     App Component - Implements Swap Interface & Range Logic
  */
  const App = () => {
    // Game State
    const [history, setHistory] = useState(initialHistory);
    const [balance, setBalance] = useState(10000);

    // Betting State
    const [baseBet, setBaseBet] = useState(25);
    const [currentBet, setCurrentBet] = useState(25);

    // Mod: Initialize with Over mode default
    const [rangeMode, setRangeMode] = useState('over'); // 'over' | 'under'
    const [range, setRange] = useState({ low: 420, high: TICKS });
    const [status, setStatus] = useState("idle");
    const [lastResult, setLastResult] = useState(null);

    // Provably Fair State
    const [clientSeed, setClientSeed] = useState("client-seed-12345");
    const [serverSeed, setServerSeed] = useState(""); // The ACTUAL secret seed
    const [serverSeedHash, setServerSeedHash] = useState(""); // The PUBLIC hash
    const [nonce, setNonce] = useState(0);
    const [showFairModal, setShowFairModal] = useState(false);

    // Previous Seeds (for verification after rotate)
    const [prevServerSeed, setPrevServerSeed] = useState(null);
    const [prevClientSeed, setPrevClientSeed] = useState(null);
    const [prevNonceMax, setPrevNonceMax] = useState(0);

    // Init Seeds
    useEffect(() => {
      const init = async () => {
        const s = generateRandomHex(64);
        const h = await sha256(s);
        setServerSeed(s);
        setServerSeedHash(h);
        // Randomize default client seed
        setClientSeed(generateRandomHex(16));
      };
      init();
    }, []);

    const rotateSeed = async () => {
      // 1. Save current as "Previous"
      setPrevServerSeed(serverSeed);
      setPrevClientSeed(clientSeed);
      setPrevNonceMax(nonce);

      // 2. Generate New
      const newS = generateRandomHex(64);
      const newH = await sha256(newS);
      setServerSeed(newS);
      setServerSeedHash(newH);
      setNonce(0);
    };

    // Stats State
    const [view, setView] = useState('game'); // 'game' | 'stats'
    const [userBets, setUserBets] = useState([]); // History of rounds
    const [sessionPnL, setSessionPnL] = useState(0);

    // Animation State
    const [animClass, setAnimClass] = useState("");

    // Validation State
    const [payError, setPayError] = useState(null); // For "You Pay" input
    const [payoutError, setPayoutError] = useState(null); // For "You Receive" input

    // Payout Editing State (for seamless UX)
    const [isPayoutFocused, setIsPayoutFocused] = useState(false);
    const [payoutInput, setPayoutInput] = useState("");

    // Derived State
    const [lastPrice, setLastPrice] = useState(null);
    useEffect(() => {
      setLastPrice(history[history.length - 1]);
    }, [history]);

    // Multiplier Logic
    const multiplier = useMemo(() => {
      const size = Math.max(1, range.high - range.low);
      const probability = size / TICKS;
      if (probability <= 0) return 0;
      return Number((0.80 / probability).toFixed(6));
    }, [range]);

    const potentialPayout = useMemo(() => {
      const activeBet = status === 'won_streak' ? currentBet : baseBet;
      return Number((activeBet * multiplier).toFixed(6));
    }, [currentBet, baseBet, multiplier, status]);

    // Sync payoutInput when not editing
    useEffect(() => {
      if (!isPayoutFocused) {
        setPayoutInput(potentialPayout);
      }
    }, [potentialPayout, isPayoutFocused]);

    // Interaction Handlers
    const handleRangeChange = (newRange) => {
      let { low, high } = newRange;

      // Strict Bounds
      low = Math.max(0, Math.min(low, TICKS - 1));
      high = Math.max(low + 1, Math.min(high, TICKS));

      if (rangeMode === 'over') {
        // Enforce pinned TOP
        high = TICKS;
        // Limit Max Size (750) => Min Low = TICKS - 750
        const minLow = TICKS - 750;
        if (low < minLow) low = minLow;
      } else {
        // Enforce pinned BOTTOM
        low = 0;
        // Limit Max Size (750) => Max High = 750
        const maxHigh = 750;
        if (high > maxHigh) high = maxHigh;
      }

      setRange({ low, high });
    };

    const toggleMode = (mode) => {
      if (mode === rangeMode) return;
      setRangeMode(mode);

      if (mode === 'over') {
        // Switching to OVER: Use previous HIGH as the new LOW (Threshold conservation)
        let newLow = range.high;

        // Constraints
        const minLow = TICKS - 750; // Max Range Size 750
        const maxLow = TICKS - 10;  // Min Range Size 10

        if (newLow < minLow) newLow = minLow;
        if (newLow > maxLow) newLow = maxLow;

        setRange({ low: newLow, high: TICKS });
      } else {
        // Switching to UNDER: Use previous LOW as the new HIGH (Threshold conservation)
        let newHigh = range.low;

        // Constraints
        const maxHigh = 750; // Max Range Size 750
        const minHigh = 10;  // Min Range Size 10

        if (newHigh > maxHigh) newHigh = maxHigh;
        if (newHigh < minHigh) newHigh = minHigh;

        setRange({ low: 0, high: newHigh });
      }
    };

    // Reverse Calculation for Payout Input
    const handlePayoutChange = (valStr) => {
      const val = parseFloat(valStr); // Use float to preserve decimals
      if (isNaN(val) || val <= 0) {
        setPayoutError("Enter valid payout");
        return;
      }
      setPayoutInput(valStr);

      const targetPayout = val;
      const activeBet = status === 'won_streak' ? currentBet : baseBet;
      if (activeBet <= 0) return;

      const targetMultiplier = targetPayout / activeBet;

      // Constraint: Size = 800 / Multiplier
      let newSize = Math.round(800 / targetMultiplier);

      // OPTIMIZER: Check neighbors for better precision
      // We want the size that yields a payout closest to targetPayout
      // after the full round-trip logic (tick -> prob -> multiplier(6dp) -> payout)
      const calcPayout = (s) => {
        if (s <= 0) return 0;
        const p = s / TICKS;
        // Maintain 6 decimal precision
        const m = Number((0.80 / p).toFixed(6));
        return Number((activeBet * m).toFixed(6));
      };

      const candidates = [newSize, newSize - 1, newSize + 1];
      let bestSize = newSize;
      let minDiff = Math.abs(calcPayout(newSize) - targetPayout);

      candidates.forEach(s => {
        if (s < 10 || s > 750) return; // Skip invalid (Max 750)
        const diff = Math.abs(calcPayout(s) - targetPayout);
        if (diff < minDiff) {
          minDiff = diff;
          bestSize = s;
        }
      });
      newSize = bestSize;

      let warning = null;

      // Constraints with Feedback
      if (newSize < 10) {
        newSize = 10;
        warning = "Max Payout Limit (80x)";
      } else if (newSize > 750) {
        newSize = 750;
        warning = "Min Payout Limit (Max 75% range)";
      }

      setPayoutError(warning);

      // Mode-Aware Range Setting
      let newLow, newHigh;

      if (rangeMode === 'over') {
        newHigh = TICKS;
        newLow = TICKS - newSize;
      } else {
        newLow = 0;
        newHigh = newSize;
      }

      // Safety
      if (newLow < 0) newLow = 0;
      if (newHigh > TICKS) newHigh = TICKS;

      setRange({ low: newLow, high: newHigh });
    };

    // Game Logic
    // Defined BEFORE playRound to avoid any const hoisting/TDZ issues
    const finalizeRound = async (betAmount) => {
      const finalPrice = await generateResult(serverSeed, clientSeed, nonce);
      // Increment Nonce
      setNonce(n => n + 1);

      setHistory(prev => {
        const shift = prev.slice(1);
        return [...shift, finalPrice];
      });

      const won = finalPrice >= range.low && finalPrice <= range.high;
      // Note: betAmount is the snapshot of what was risked

      if (won) {
        // High Precision accumulation
        const winAmount = Number((betAmount * multiplier).toFixed(6));
        setCurrentBet(winAmount);
        setStatus('won_streak');
        setLastResult({ won: true, price: finalPrice });
        setAnimClass("anim-win");

        // DO NOT LOG INTERMEDIATE WINS ("Ride the Streak")
        // We only log when the "Game" ends (Cashout or Loss)

      } else {
        // Log LOSS (EndOfSession)
        setUserBets(prev => [...prev, {
          result: 'loss',
          price: finalPrice,
          amount: baseBet, // The actual risk capital lost
          payout: 0,
          range: { ...range }
        }]);

        // Auto-Correction Logic for Edge Case:
        // If remaining balance < betAmount, cap the next bet to remaining balance.

        // FIX: Only subtract betAmount if we actually paid from wallet (status === 'idle')
        // In 'won_streak', we are betting logic validBalance, so wallet balance is untouched.
        let remainingBalance;
        if (status === 'idle') {
          remainingBalance = Number((balance - betAmount).toFixed(6));
        } else {
          remainingBalance = balance;
        }

        // Safety clamp
        if (remainingBalance < 0) remainingBalance = 0;

        // If the user wants to bet 'baseBet' again, checks if they can afford it
        let nextBet = baseBet;
        if (remainingBalance < baseBet) {
          nextBet = remainingBalance;
        }

        setStatus('idle');
        setCurrentBet(nextBet);
        setBaseBet(nextBet);

        setLastResult({ won: false, price: finalPrice });
        setAnimClass("anim-loss");
      }
    };

    const playRound = () => {
      const activeBet = status === 'won_streak' ? currentBet : baseBet;

      if (activeBet <= 0) {
        setPayError("Enter a valid bet amount");
        return;
      }

      if (status === 'idle') {
        if (balance < activeBet) {
          setPayError("Insufficient balance");
          return;
        }
        setBalance(b => Number((b - activeBet).toFixed(6))); // Ensure precision
        setCurrentBet(activeBet);
        setSessionPnL(p => Number((p - activeBet).toFixed(6))); // Ensure precision
      }

      setPayError(null);
      setPayoutError(null);
      setStatus('playing');
      setAnimClass("");

      // Use setTimeout for animation delay, but call async finalizeRound
      setTimeout(() => { finalizeRound(activeBet); }, 600);
    };

    const handleCashout = () => {
      setBalance(b => Number((b + currentBet).toFixed(6))); // Ensure precision
      setSessionPnL(p => Number((p + currentBet).toFixed(6))); // Add winnings to PnL, ensure precision

      // Log WIN (EndOfSession - Cashout)
      setUserBets(prev => [...prev, {
        result: 'win',
        price: lastResult ? lastResult.price : 0, // Price of the LAST tick that allowed cashout
        amount: Number(baseBet.toFixed(6)), // Initial Investment, ensure precision
        payout: Number(currentBet.toFixed(6)), // Final Realized Value, ensure precision
        range: { ...range }
      }]);

      setStatus('idle');
      setCurrentBet(baseBet);
    };



    // Quick Bet Handlers (Fixing omission)
    const handleHalfBet = () => {
      if (status !== 'idle') return;
      const newBet = Number((baseBet / 2).toFixed(6)); // No floor, allow decimals, ensure precision
      setBaseBet(newBet);
      if (newBet > balance) setPayError("Insufficient balance");
      else setPayError(null);
    };

    const handleDoubleBet = () => {
      if (status !== 'idle') return;
      let newBet = Number((baseBet * 2).toFixed(6)); // Ensure precision

      if (newBet > balance) {
        newBet = balance;
        setPayError(null); // Suppress error
      } else {
        setPayError(null);
      }
      setBaseBet(newBet);
    };

    return h("div", { className: "shell" }, [
      h(ProvablyFairModal, {
        isOpen: showFairModal,
        onClose: () => setShowFairModal(false),
        serverSeedHash,
        clientSeed,
        nonce,
        onRotate: rotateSeed,
        onChangeClientSeed: setClientSeed,
        prevServerSeed,
        prevClientSeed,
        prevNonceMax
      }),
      // Header
      h("div", { className: "header", key: "header" }, [
        h("div", { className: "header-branding" }, [
          // Group 1: Brand
          h("div", { className: "brand-group" }, [
            h("img", { src: "logo.svg", className: "app-logo", alt: "TickPredict" }),
            h("div", { className: "title", key: "t" }, "TickPredict"),
          ]),

          // Group 2: Nav & Actions
          h("div", { className: "nav-group" }, [
            h("div", { className: "nav-tabs" }, [
              h("div", {
                className: `nav-item ${view === 'game' ? 'active' : ''}`,
                onClick: () => setView('game')
              }, "Trade"),
              h("div", {
                className: `nav-item ${view === 'stats' ? 'active' : ''}`,
                onClick: () => setView('stats')
              }, "Stats"),
            ]),
            // Fairness Button
            h("button", {
              className: "fairness-pill",
              onClick: () => setShowFairModal(true),
              title: "Fairness"
            }, [
              h("span", { style: { fontSize: "14px", lineHeight: 1 } }, "🛡️"),
              "Fairness"
            ])
          ])
        ]),
        h("div", { className: "wallet-pill", key: "w" }, [
          h("span", { style: { opacity: 0.6 } }, "BAL"),
          h("div", { style: { display: "flex", alignItems: "center", gap: "6px" } }, [
            formatCurrency(balance),
            h("img", { src: "usdc.png", className: "mini-logo", alt: "USDC" }),
            "USDC"
          ])
        ])
      ]),

      // View Switcher
      view === 'stats'
        ? h(StatsView, { bets: userBets, pnl: sessionPnL })
        : [
          // Main Grid
          h("div", { className: "grid", key: "g" }, [

            // Left Column: Graph
            h("div", { className: `card ${animClass}`, key: "gc" }, [ // Apply animation here
              h("div", { className: "graph-header", key: "gh" }, [
                h("div", { key: "l1", style: { display: "flex", flexDirection: "column", gap: "4px" } }, [
                  h("span", { style: { fontSize: "16px", fontWeight: "700", color: "#fff" } }, "Guess the next price"),
                  h("span", { style: { fontSize: "13px", color: "#98a1c0" } }, "Shorter range = Higher win")
                ]),
                // Direction Toggle (Moved to Graph Header)
                h("div", { className: "mode-switch" }, [
                  h("button", {
                    className: `mode-option over ${rangeMode === 'over' ? 'active' : ''}`,
                    onClick: () => toggleMode('over')
                  }, "Over"),
                  h("button", {
                    className: `mode-option under ${rangeMode === 'under' ? 'active' : ''}`,
                    onClick: () => toggleMode('under')
                  }, "Under")
                ])
              ]),

              h("div", { className: "graph-shell", key: "gs" }, [
                h("div", { className: "graph", key: "g-inner" }, h(LineGraph, { data: history, low: range.low, high: range.high })),
                h(RangeOverlay, {
                  key: "overlay",
                  low: range.low,
                  high: range.high,
                  mode: rangeMode,
                  onChange: handleRangeChange
                }),
                // New Top Layer for Labels (Unblurred)
                h(GraphLabelsOverlay, {
                  data: history,
                  width: GRAPH_WIDTH,
                  height: GRAPH_HEIGHT,
                  padding: GRAPH_PADDING,
                  low: range.low,
                  high: range.high
                })
              ]), // End Graph Shell
            ]), // End Card (Graph Column)


            // Right Column: Swap Interface
            h("div", { className: "defi-card", key: "dc" }, [
              // "You Pay" Section
              h("div", { className: `swap-input-container ${payError ? 'input-error' : ''}`, key: "pay" }, [
                h("div", { className: "swap-label-row" }, [
                  h("span", {}, status === 'won_streak' ? "Total Winnings" : "You pay"),
                  h("span", { className: "balance-label" }, `Balance: ${formatCurrency(balance)} USDC`)
                ]),

                h("div", { className: "swap-input-row" }, [
                  h("input", {
                    className: "token-input",
                    type: "number",
                    step: "any", // Allow decimals for display (accumulated bet)
                    min: "1",
                    placeholder: "0",
                    // Display full precision for accumulated bets, integer for manual
                    value: status === 'won_streak'
                      ? Number(currentBet.toFixed(6))
                      : (baseBet === 0 ? '' : baseBet),
                    onFocus: e => e.target.select(),
                    // Block non-integer chars ONLY when typing (idle)
                    onKeyDown: (e) => {
                      if (status === 'idle' && ["-", "+", "e", "E", "."].includes(e.key)) {
                        e.preventDefault();
                      }
                    },
                    onChange: e => {
                      if (status === 'idle') {
                        const valStr = e.target.value;
                        // Strict Integer Parsing
                        let val = parseInt(valStr, 10);

                        // Handle NaN (empty input)
                        if (isNaN(val)) val = 0;

                        // Auto-Cap Logic for Manual Input
                        if (val > balance) {
                          val = Math.floor(balance); // Cap at integer balance
                          setPayError(null); // Suppress error
                        } else if (val < 0) {
                          val = 0; // Strictly disallow negative
                          setPayError(null);
                        } else {
                          // MECE Validation
                          // if (val === 0 && valStr !== '') setPayError(null);
                          setPayError(null);
                        }

                        setBaseBet(val);
                      }
                    },
                    disabled: status !== 'idle'
                  }),
                  h("div", { className: "input-quick-actions" }, [
                    h("button", {
                      className: "quick-btn",
                      onClick: handleHalfBet,
                      style: { display: status === 'idle' ? 'inline-flex' : 'none' }
                    }, "1/2"),
                    h("button", {
                      className: "quick-btn",
                      onClick: handleDoubleBet,
                      style: { display: status === 'idle' ? 'inline-flex' : 'none' }
                    }, "2x"),
                  ]),
                  h("span", { className: "token-pill" }, [
                    h("img", { src: "usdc.png", className: "currency-logo" }),
                    "USDC"
                  ])
                ]),
                // Error Message Inside Container
                payError && h("div", { style: { color: "#fd4f4f", fontSize: "12px", marginTop: "8px", fontWeight: "500" } }, payError),
              ]),

              // Arrow
              h("div", { className: "swap-arrow-container", key: "arrow" },
                h("div", { className: "swap-arrow" }, "↓")
              ),

              // "You Receive" Section
              h("div", { className: `swap-input-container ${payoutError ? 'input-error' : ''}`, key: "rec" }, [
                h("div", { className: "swap-label-row" }, [
                  h("span", {}, "You receive (Potential)"),
                  h("span", { className: "balance-label" }, `${Number(multiplier.toFixed(6))}x Payout`) // Smart format: up to 6 decimals
                ]),
                h("div", { className: "swap-input-row" }, [
                  h("input", {
                    className: "token-input",
                    type: "number",
                    step: "any", // Allow decimals for payout
                    // Edit enabled for reverse calculation
                    value: isPayoutFocused ? payoutInput : (typeof potentialPayout === 'number' ? Number(potentialPayout.toFixed(6)) : potentialPayout), // Smart format
                    onFocus: e => {
                      setIsPayoutFocused(true);
                      setPayoutInput(Number(potentialPayout.toFixed(6)).toString()); // Smart format for edit start
                      e.target.select();
                    },
                    onBlur: () => setIsPayoutFocused(false),
                    onChange: e => {
                      setPayoutInput(e.target.value);
                      handlePayoutChange(e.target.value);
                    },
                    style: { color: "#4c82fb" } // Blue for potential profit
                  }),
                  h("span", { className: "token-pill" }, [
                    h("img", { src: "usdc.png", className: "currency-logo" }),
                    "USDC"
                  ])
                ])
              ]),
              payoutError && h("div", { style: { color: "#fd4f4f", fontSize: "12px", marginTop: "4px", paddingLeft: "4px" } }, payoutError),
              h("div", { className: "swap-info", key: "info" }, [
                // 1. Selected Range (First item now)
                h("div", { className: "info-row" }, [
                  h("span", {}, "Selected Range"),
                  h("span", {}, rangeMode === 'over' ? `Over ${range.low} ` : `Under ${range.high} `)
                ]),
                // 3. Win Probability
                h("div", { className: "info-row" }, [
                  h("span", {}, "Win Probability"),
                  h("span", {}, `${((range.high - range.low) / 10).toFixed(1)}% `)
                ])
              ]),
              h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, [
                status === 'won_streak' && h("button", {
                  className: "button-secondary",
                  style: { flex: 1 },
                  onClick: handleCashout
                }, "Cashout"),
                h("button", {
                  className: "button-primary",
                  style: { flex: 1, marginTop: 0 },
                  disabled: status === 'playing' || multiplier <= 0 || (status === 'idle' && baseBet <= 0),
                  onClick: playRound
                }, status === 'playing' ? "Swapping..." : (status === 'won_streak' ? "Compound" : "Place Trade"))
              ])
            ])
          ])
        ]
    ]);
  };

  ReactDOM.createRoot(document.getElementById("root")).render(h(App));
})();
