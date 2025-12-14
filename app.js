(() => {
  const { useMemo, useState, useEffect, useRef } = React;
  const h = React.createElement;

  const TICKS = 1000;
  const MAX_HISTORY = 10;

  const randomPrice = () => Math.floor(Math.random() * TICKS) + 1;

  const initialHistory = () =>
    Array.from({ length: MAX_HISTORY }, () => randomPrice());

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const formatCurrency = (val) =>
    Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

  const LineGraph = ({ data }) => {
    const width = 560;
    const height = 300;
    const padding = { top: 20, right: 50, bottom: 30, left: 10 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    
    const maxVal = TICKS;
    const minVal = 1;
    const span = Math.max(maxVal - minVal, 1);
    
    const points = useMemo(() => {
      if (!data.length) return "";
      return data
        .map((value, idx) => {
          const x = padding.left + (idx / Math.max(data.length - 1, 1)) * graphWidth;
          const y = padding.top + graphHeight - ((value - minVal) / span) * graphHeight;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ");
    }, [data, graphWidth, graphHeight]);

    if (!data.length) {
      return h("div", { className: "graph-empty" }, "Waiting for ticks...");
    }

    const last = data[data.length - 1];
    const gridLines = 5;
    const priceLabels = [];
    const tickLabels = [];

    // Generate grid lines and price labels
    for (let i = 0; i <= gridLines; i++) {
      const price = minVal + (span * i) / gridLines;
      const y = padding.top + graphHeight - ((price - minVal) / span) * graphHeight;
      priceLabels.push(
        h("text", {
          key: `price-${i}`,
          x: width - padding.right + 8,
          y: y + 4,
          fill: "#6b7280",
          fontSize: "11",
          textAnchor: "start",
        }, Math.round(price))
      );
    }

    // Generate tick labels on X-axis
    for (let i = 0; i < data.length; i++) {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * graphWidth;
      tickLabels.push(
        h("text", {
          key: `tick-${i}`,
          x: x,
          y: height - padding.bottom + 18,
          fill: "#6b7280",
          fontSize: "10",
          textAnchor: "middle",
        }, i === data.length - 1 ? "Now" : `T${i + 1}`)
      );
    }

    return h(
      "svg",
      {
        width: "100%",
        height: "100%",
        viewBox: `0 0 ${width} ${height}`,
        className: "tradingview-chart",
      },
      [
        h(
          "defs",
          { key: "defs" },
          [
            h(
              "linearGradient",
              { id: "lineGradient", x1: "0%", x2: "100%" },
              [
                h("stop", { offset: "0%", stopColor: "#FC72FF", key: "s1" }),
                h("stop", { offset: "100%", stopColor: "#FC72FF", key: "s2" }),
              ]
            ),
            h(
              "linearGradient",
              { id: "areaGradient", x1: "0%", x2: "0%", y1: "0%", y2: "100%" },
              [
                h("stop", {
                  offset: "0%",
                  stopColor: "rgba(252, 114, 255, 0.2)",
                  key: "sa1",
                }),
                h("stop", {
                  offset: "100%",
                  stopColor: "rgba(252, 114, 255, 0.02)",
                  key: "sa2",
                }),
              ]
            ),
          ]
        ),
        // Horizontal grid lines
        Array.from({ length: gridLines + 1 }).map((_, i) => {
          const price = minVal + (span * i) / gridLines;
          const y = padding.top + graphHeight - ((price - minVal) / span) * graphHeight;
          return h("line", {
            key: `grid-h-${i}`,
            x1: padding.left,
            y1: y,
            x2: width - padding.right,
            y2: y,
            stroke: i === gridLines ? "#374151" : "#1f2937",
            strokeWidth: i === gridLines ? "1.5" : "1",
            strokeDasharray: i === gridLines ? "none" : "2 2",
          });
        }),
        // Vertical grid lines
        Array.from({ length: data.length }).map((_, i) => {
          const x = padding.left + (i / Math.max(data.length - 1, 1)) * graphWidth;
          return h("line", {
            key: `grid-v-${i}`,
            x1: x,
            y1: padding.top,
            x2: x,
            y2: height - padding.bottom,
            stroke: "#1f2937",
            strokeWidth: "1",
            strokeDasharray: "2 2",
          });
        }),
        // Area fill
        h("polyline", {
          key: "area",
          points: `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`,
          fill: "url(#areaGradient)",
          stroke: "none",
        }),
        // Main line
        h("polyline", {
          key: "line",
          points,
          fill: "none",
          stroke: "#FC72FF",
          strokeWidth: "2.5",
          strokeLinejoin: "round",
          strokeLinecap: "round",
        }),
        // Data points
        points.split(" ").map((p, idx) => {
          const [x, y] = p.split(",").map(Number);
          const isLast = idx === data.length - 1;
          return h("circle", {
            key: `pt-${idx}`,
            cx: x,
            cy: y,
            r: isLast ? 4 : 2.5,
            fill: isLast ? "#FC72FF" : "#FC72FF",
            opacity: isLast ? 1 : 0.6,
            stroke: isLast ? "#fff" : "none",
            strokeWidth: isLast ? "1.5" : "0",
          });
        }),
        // Price labels on right
        ...priceLabels,
        // Tick labels on bottom
        ...tickLabels,
        // Current price indicator
        h(
          "text",
          {
            key: "current-price",
            x: width - padding.right + 8,
            y: padding.top - 8,
            textAnchor: "start",
            fill: "#FC72FF",
            fontSize: "13",
            fontWeight: "600",
          },
          `Price: ${last}`
        ),
      ]
    );
  };

  const RangeBar = ({ low, high }) => {
    const left = (low / TICKS) * 100;
    const right = (high / TICKS) * 100;
    return h(
      "div",
      { className: "range-bar" },
      h("div", {
        className: "range-highlight",
        style: {
          left: `${left}%`,
          width: `${Math.max(right - left, 1)}%`,
        },
      })
    );
  };

  const RangeOverlay = ({ low, high, onChange }) => {
    const overlayRef = useRef(null);
    const bandRef = useRef(null);
    const dragging = useRef(null);
    const dragStartY = useRef(0);
    const dragStartLow = useRef(0);
    const dragStartHigh = useRef(0);

    // Strictly clamp incoming values to valid range
    const clampedLow = clamp(low, 1, TICKS);
    const clampedHigh = clamp(high, 1, TICKS);
    const validLow = Math.min(clampedLow, clampedHigh - 1);
    const validHigh = Math.max(clampedHigh, validLow + 1);

    // Ensure values are always valid on mount/update
    useEffect(() => {
      if (low !== validLow || high !== validHigh) {
        // Only update if significantly different to avoid loops
        if (Math.abs(low - validLow) > 0 || Math.abs(high - validHigh) > 0) {
          onChange({ low: validLow, high: validHigh });
        }
      }
    }, []);

    const pctY = (val) => 100 - (val / TICKS) * 100;

    // Account for graph padding: top 20px, bottom 30px out of 300px height
    const paddingTopPx = 20;
    const paddingBottomPx = 30;
    const graphHeightPx = 300;

    const handleMouseMove = (e) => {
      if (!dragging.current || !overlayRef.current) return;
      
      const rect = overlayRef.current.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      
      // Constrain to graph area (accounting for padding)
      const minY = paddingTopPx;
      const maxY = graphHeightPx - paddingBottomPx;
      const graphAreaHeight = maxY - minY;
      const constrainedY = clamp(mouseY, minY, maxY);
      
      const ratio = (constrainedY - paddingTopPx) / graphAreaHeight; // 0 top, 1 bottom
      const tick = clamp(Math.round((1 - ratio) * TICKS), 1, TICKS);
      
      if (dragging.current === "band") {
        // Reduce sensitivity - only update if moved at least 2 pixels
        const deltaY = e.clientY - dragStartY.current;
        if (Math.abs(deltaY) < 2) return; // Dead zone to reduce sensitivity
        
        // Calculate tick delta more carefully
        const deltaTick = Math.round((deltaY / graphAreaHeight) * TICKS);
        const span = dragStartHigh.current - dragStartLow.current;
        
        // Calculate new positions
        let newLow = dragStartLow.current - deltaTick;
        let newHigh = newLow + span;
        
        // BULLETPROOF: Strictly constrain to valid range
        // First ensure span is valid
        const validSpan = Math.max(1, Math.min(span, TICKS - 1));
        
        // Calculate bounds
        const maxLow = TICKS - validSpan;
        const minHigh = 1 + validSpan;
        
        // Clamp low first
        newLow = clamp(newLow, 1, maxLow);
        // Then set high based on low
        newHigh = newLow + validSpan;
        // Double-check high is within bounds
        if (newHigh > TICKS) {
          newHigh = TICKS;
          newLow = newHigh - validSpan;
          newLow = clamp(newLow, 1, TICKS);
        }
        if (newLow < 1) {
          newLow = 1;
          newHigh = newLow + validSpan;
          newHigh = clamp(newHigh, 1, TICKS);
        }
        
        // Final absolute validation
        const finalLow = Math.max(1, Math.min(newLow, TICKS - 1));
        const finalHigh = Math.max(finalLow + 1, Math.min(newHigh, TICKS));
        
        // Only update if values are valid
        if (finalLow >= 1 && finalLow < finalHigh && finalHigh <= TICKS) {
          onChange({ low: finalLow, high: finalHigh });
        }
      } else if (dragging.current === "low") {
        // BULLETPROOF: Clamp low handle
        const maxLow = Math.min(validHigh - 1, TICKS - 1);
        const constrainedTick = Math.max(1, Math.min(tick, maxLow));
        const newHigh = Math.max(constrainedTick + 1, Math.min(validHigh, TICKS));
        onChange({ low: constrainedTick, high: newHigh });
      } else if (dragging.current === "high") {
        // BULLETPROOF: Clamp high handle
        const minHigh = Math.max(validLow + 1, 2);
        const constrainedTick = Math.max(minHigh, Math.min(tick, TICKS));
        const newLow = Math.max(1, Math.min(validLow, constrainedTick - 1));
        onChange({ low: newLow, high: constrainedTick });
      }
    };

    const handleMouseUp = () => {
      dragging.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (bandRef.current) {
        bandRef.current.style.opacity = "";
      }
    };

    const handleBandMouseDown = (e) => {
      // Don't start band drag if clicking on a handle
      if (e.target.classList.contains("range-handle") || 
          e.target.closest(".range-handle")) {
        return;
      }
      
      dragging.current = "band";
      dragStartY.current = e.clientY;
      dragStartLow.current = validLow;
      dragStartHigh.current = validHigh;
      
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      e.preventDefault();
      e.stopPropagation();
      
      if (bandRef.current) {
        bandRef.current.style.opacity = "0.7";
      }
    };

    const handleHandleMouseDown = (handleType) => (e) => {
      dragging.current = handleType;
      dragStartY.current = e.clientY;
      dragStartLow.current = validLow;
      dragStartHigh.current = validHigh;
      
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      e.preventDefault();
      e.stopPropagation();
    };

    useEffect(() => {
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, []);

    // Use clamped values for positioning - BULLETPROOF bounds
    const safeHigh = Math.max(1, Math.min(validHigh, TICKS));
    const safeLow = Math.max(1, Math.min(validLow, safeHigh - 1));
    
    const topPct = pctY(safeHigh);
    const bottomPct = pctY(safeLow);
    const paddingTopPct = (paddingTopPx / graphHeightPx) * 100;
    const paddingBottomPct = (paddingBottomPx / graphHeightPx) * 100;
    const graphHeightPct = 100 - paddingTopPct - paddingBottomPct;
    
    // Calculate positions and strictly clamp to graph bounds
    const topPosition = paddingTopPct + (topPct / 100) * graphHeightPct;
    const bottomPosition = paddingTopPct + (bottomPct / 100) * graphHeightPct;
    
    // BULLETPROOF: Ensure band stays within graph bounds - no spillover
    const minTop = paddingTopPct;
    const maxBottom = 100 - paddingBottomPct;
    const adjustedTop = Math.max(minTop, Math.min(topPosition, maxBottom));
    const adjustedBottom = Math.max(minTop, Math.min(bottomPosition, maxBottom));
    const adjustedHeight = Math.max(Math.abs(adjustedBottom - adjustedTop), 0.5);
    
    // Ensure top is above bottom and within bounds
    const finalTop = Math.max(minTop, Math.min(Math.min(adjustedTop, adjustedBottom), maxBottom));
    const finalBottom = Math.max(minTop, Math.min(Math.max(adjustedTop, adjustedBottom), maxBottom));

    return h(
      "div",
      { className: "range-overlay", ref: overlayRef },
      [
        h("div", {
          key: "band",
          ref: bandRef,
          className: "band",
          style: {
            top: `${finalTop}%`,
            height: `${finalBottom - finalTop}%`,
            maxHeight: `${100 - paddingTopPct - paddingBottomPct}%`,
          },
          onMouseDown: handleBandMouseDown,
        }),
        h("div", {
          key: "handle-low",
          className: "range-handle range-handle-low",
          style: { 
            top: `calc(${finalBottom}% - 4px)`,
            maxTop: `${100 - paddingBottomPct}%`,
          },
          onMouseDown: handleHandleMouseDown("low"),
        }),
        h("div", {
          key: "handle-high",
          className: "range-handle range-handle-high",
          style: { 
            top: `calc(${finalTop}% - 4px)`,
            minTop: `${paddingTopPct}%`,
          },
          onMouseDown: handleHandleMouseDown("high"),
        }),
      ]
    );
  };

  const App = () => {
    const [history, setHistory] = useState(initialHistory);
    const [betAmount, setBetAmount] = useState(25);
    const [balance, setBalance] = useState(10000);
    const [sessionStake, setSessionStake] = useState(0);
    const [range, setRange] = useState({ low: 420, high: 620 });
    const [status, setStatus] = useState("idle");
    const [streak, setStreak] = useState(0);
    const [lastPrice, setLastPrice] = useState(null);
    const [nextPrice, setNextPrice] = useState(null);
    const [payout, setPayout] = useState(0);
    const [message, setMessage] = useState(
      "Pick your range and predict where the next tick will land."
    );
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
      setLastPrice(history[history.length - 1]);
    }, []);

    const multiplier = useMemo(() => {
      if (streak <= 0) return 1;
      const raw = 1 + streak * 0.35;
      return Number((raw * 0.85).toFixed(2)); // house edge 15%
    }, [streak]);

    const expectedMultiplier = useMemo(() => {
      const span = Math.max(range.high - range.low + 1, 1);
      const p = span / TICKS;
      if (p <= 0) return 1;
      const fair = 1 / p;
      return Number((fair * 0.85).toFixed(2)); // apply 15% house edge
    }, [range.high, range.low]);

    const setRangeSafe = (nextLow, nextHigh) => {
      // BULLETPROOF validation for numeric inputs
      let low = Math.max(1, Math.min(Math.round(nextLow || 1), TICKS));
      let high = Math.max(1, Math.min(Math.round(nextHigh || 1), TICKS));
      
      // Ensure low < high
      if (low >= high) {
        if (low === TICKS) {
          low = TICKS - 1;
        } else {
          high = low + 1;
        }
      }
      
      // Final validation
      low = Math.max(1, Math.min(low, TICKS - 1));
      high = Math.max(low + 1, Math.min(high, TICKS));
      
      if (low >= 1 && low < high && high <= TICKS) {
        setRange({ low, high });
      }
    };

    const handleRangeChange = (key) => (e) => {
      // BULLETPROOF validation for input changes
      let value = Math.max(1, Math.min(Math.round(Number(e.target.value || 1)), TICKS));
      
      setRange((prev) => {
        let low = prev.low;
        let high = prev.high;
        
        if (key === "low") {
          low = value;
          // Ensure low < high
          if (low >= high) {
            if (low === TICKS) {
              low = TICKS - 1;
            } else {
              high = low + 1;
            }
          }
        } else {
          high = value;
          // Ensure low < high
          if (low >= high) {
            if (high === 1) {
              high = 2;
            } else {
              low = high - 1;
            }
          }
        }
        
        // Final validation
        low = Math.max(1, Math.min(low, TICKS - 1));
        high = Math.max(low + 1, Math.min(high, TICKS));
        
        if (low >= 1 && low < high && high <= TICKS) {
          return { low, high };
        }
        return prev; // Don't update if invalid
      });
    };

  const takeTick = () => {
      const price = randomPrice();
      setNextPrice(price);
      setHistory((prev) => {
        const next = [...prev.slice(-(MAX_HISTORY - 1)), price];
        setLastPrice(next[next.length - 1]);
        return next;
      });
      return price;
    };

  const [rounds, setRounds] = useState([]);

  const onPredict = () => {
      if (!betAmount || betAmount <= 0) {
        setMessage("Enter a bet amount greater than zero.");
        return;
      }
    if (streak === 0) {
      if (betAmount > balance) {
        setMessage("Insufficient balance for that bet.");
        return;
      }
      setSessionStake(betAmount);
      setBalance((prev) => prev - betAmount);
    }
      const price = takeTick();
      const win = price >= range.low && price <= range.high;
      if (win) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
      const rawMult = 1 + nextStreak * 0.35;
      const edgedMult = Number((rawMult * 0.85).toFixed(2));
      setPayout(Number((sessionStake * edgedMult).toFixed(2)));
        setStatus("playing");
      setRounds((prev) => [
        {
          price,
          result: "win",
          multiplier: edgedMult,
        },
        ...prev,
      ]);
        setMessage(
        `Nice read! Price landed at ${price}. Multiplier now x${edgedMult}.`
        );
      } else {
        setStatus("lost");
        setStreak(0);
        setPayout(0);
      setSessionStake(0);
      setRounds((prev) => [
        {
          price,
          result: "lose",
          multiplier: 0,
        },
        ...prev,
      ]);
        setMessage(
          `Price landed at ${price}. Outside your range. Try again—don't lose hope!`
        );
      }
    };

    const onCashout = () => {
      if (status === "playing" && streak > 0) {
      setBalance((prev) => prev + payout);
        setStatus("cashed");
        setMessage(
          `You cashed out x${multiplier}. Claimed ${formatCurrency(
            payout
          )}.`
        );
      setStreak(0);
      setSessionStake(0);
      setPayout(0);
      }
    };

    const onReset = () => {
      const seed = initialHistory();
      setHistory(seed);
      setLastPrice(seed[seed.length - 1]);
      setNextPrice(null);
      setStatus("idle");
      setStreak(0);
      setPayout(0);
    setSessionStake(0);
    setRounds([]);
      setMessage("Pick your range and predict where the next tick will land.");
    };

    const statusCopy = {
      idle: "Awaiting your next prediction.",
      playing: "Live streak—keep going or cash out.",
      lost: "Price fell outside your range.",
      cashed: "Session ended. Play again anytime.",
    }[status];

    return h(
      React.Fragment,
      null,
      [
        h(
          "div",
          { className: "shell" },
          [
            h(
              "div",
              { className: "header", key: "header" },
              [
                h("div", { key: "title-wrap" }, [
                  h("div", { className: "title", key: "title" }, "Price Range Predictor"),
                  h(
                    "p",
                    { className: "subtitle", key: "subtitle" },
                    "Pick a band, watch 10 previous ticks, guess the next one, and ride the multiplier—cash out before you miss."
                  ),
                ]),
                h("span", { className: "pill", key: "pill" }, "Inspired by Uniswap range UI"),
              ]
            ),

            h(
              "div",
              { className: "grid", key: "grid" },
              [
                h(
                  "div",
                  { className: "card", key: "graph-card" },
                  [
                    h(
                      "div",
                      { className: "graph-header", key: "graph-header" },
                      [
                        h("span", { key: "label" }, `Last ${MAX_HISTORY} ticks`),
                        h(
                          "span",
                          { className: "chip", key: "chip" },
                          [
                            "Last price: ",
                            h("strong", { key: "strong" }, lastPrice ?? "…"),
                          ]
                        ),
                      ]
                    ),
                    h(
                      "div",
                      { className: "graph-shell", key: "graph-shell" },
                      [
                        h("div", { className: "graph", key: "graph" }, h(LineGraph, { data: history })),
                        h(RangeOverlay, {
                          key: "overlay",
                          low: range.low,
                          high: range.high,
                          onChange: (next) => {
                            // BULLETPROOF validation - multiple layers
                            let low = next.low;
                            let high = next.high;
                            
                            // Step 1: Clamp to absolute bounds
                            low = Math.max(1, Math.min(low, TICKS));
                            high = Math.max(1, Math.min(high, TICKS));
                            
                            // Step 2: Ensure low < high
                            if (low >= high) {
                              if (low === TICKS) {
                                low = TICKS - 1;
                              } else {
                                high = low + 1;
                              }
                            }
                            
                            // Step 3: Final bounds check
                            low = Math.max(1, Math.min(low, TICKS - 1));
                            high = Math.max(low + 1, Math.min(high, TICKS));
                            
                            // Step 4: Only set if valid
                            if (low >= 1 && low < high && high <= TICKS) {
                              setRange({ low, high });
                            }
                          },
                        }),
                      ]
                    ),
                    h(
                      "div",
                      { className: "metrics", key: "metrics" },
                      [
                        h(
                          "div",
                          { className: "metric", key: "metric1" },
                          [
                            h(
                              "label",
                              null,
                              [
                                "Expected multiplier (range)",
                                h(
                                  "button",
                                  {
                                    className: "icon-btn",
                                    onClick: () => setShowModal(true),
                                    title: "How multipliers work",
                                  },
                                  "?"
                                ),
                              ]
                            ),
                            h("div", { className: "value" }, `x${expectedMultiplier.toFixed(2)}`),
                          ]
                        ),
                        h(
                          "div",
                          { className: "metric", key: "metric2" },
                          [
                            h("label", null, "Streak"),
                            h("div", { className: "value" }, `${streak} correct`),
                          ]
                        ),
                        h(
                          "div",
                          { className: "metric", key: "metric3" },
                          [
                            h("label", null, "Potential cashout"),
                            h("div", { className: "value" }, `$${formatCurrency((sessionStake || betAmount) * multiplier)}`),
                          ]
                        ),
                        h(
                          "div",
                          { className: "metric", key: "metric4" },
                          [
                            h("label", null, "Next price"),
                            h("div", { className: "value" }, nextPrice ?? "?"),
                          ]
                        ),
                      ]
                    ),
                  ]
                ),

                h(
                  "div",
                  { className: "card", key: "controls-card" },
                  [
                    h("h3", null, "Set your bet & range"),
                    h(
                      "div",
                      { className: "message", style: { marginBottom: 10 } },
                      `Demo balance: $${formatCurrency(balance)}`
                    ),
                    h(
                      "div",
                      { className: "controls" },
                      [
                        h(
                          "div",
                          { className: "input-group", key: "bet" },
                          [
                            h(
                              "label",
                              null,
                              [
                                "Bet amount",
                                h("span", null, `$${formatCurrency(betAmount)}`),
                              ]
                            ),
                            h("input", {
                              type: "number",
                              min: "1",
                              step: "1",
                              value: betAmount,
                              onChange: (e) =>
                                setBetAmount(clamp(Number(e.target.value || 0), 1, 100000)),
                            }),
                          ]
                        ),
                        h(
                          "div",
                          { className: "input-group", key: "bounds-numeric" },
                          [
                            h(
                              "label",
                              null,
                              [
                                "Bounds (numeric)",
                                h(
                                  "span",
                                  null,
                                  `${range.low} - ${range.high}`
                                ),
                              ]
                            ),
                            h(
                              "div",
                              { className: "range-row" },
                              [
                                h("input", {
                                  type: "number",
                                  min: "1",
                                  max: TICKS,
                                  value: range.low,
                                  onChange: (e) =>
                                    setRangeSafe(
                                      Number(e.target.value || 1),
                                      range.high
                                    ),
                                }),
                                h("input", {
                                  type: "number",
                                  min: "1",
                                  max: TICKS,
                                  value: range.high,
                                  onChange: (e) =>
                                    setRangeSafe(
                                      range.low,
                                      Number(e.target.value || TICKS)
                                    ),
                                }),
                              ]
                            ),
                            h(
                              "div",
                              { className: "notice" },
                              "Values are clamped to 1-1000; swapped if out of order."
                            ),
                          ]
                        ),
                      ]
                    ),

                    h(RangeBar, { low: range.low, high: range.high }),

                    h(
                      "div",
                      { className: "actions", style: { marginTop: 12 } },
                      [
                        h(
                          "button",
                          { className: "btn primary", onClick: onPredict },
                          "Predict next tick"
                        ),
                        h(
                          "button",
                          {
                            className: "btn secondary",
                            onClick: onCashout,
                            disabled: streak === 0 || status === "cashed",
                          },
                          "Cash out"
                        ),
                        h(
                          "button",
                          { className: "btn ghost", onClick: onReset },
                          "Play again"
                        ),
                      ]
                    ),

                    h(
                      "div",
                      { className: "status" },
                      [
                        h(StatusBadge, { status }),
                        h("span", null, statusCopy),
                      ]
                    ),

                    h("div", { className: "message", style: { marginTop: 10 } }, message),

                    status === "lost"
                      ? h(
                          "div",
                          { className: "cta" },
                          "Price slipped your band. Try again—keep refining your range!"
                        )
                      : null,

                    status === "playing"
                      ? h(
                          "div",
                          { className: "cashout" },
                          [
                            h(
                              "div",
                              null,
                              [
                                "Live multiplier ",
                                h("strong", null, `x${multiplier.toFixed(2)}`),
                                h(
                                  "div",
                                  { className: "notice" },
                                  "Cash out anytime to lock winnings."
                                ),
                              ]
                            ),
                            h(
                              "button",
                              { className: "btn secondary", onClick: onCashout },
                              "Cash out now"
                            ),
                          ]
                        )
                      : null,
                    h(
                      "div",
                      { className: "input-group", style: { marginTop: 12 } },
                      [
                        h("label", null, "Recent rounds"),
                        rounds.length === 0
                          ? h("div", { className: "message" }, "No rounds yet. Make a prediction.")
                          : h(
                              "div",
                              { className: "list" },
                              rounds.slice(0, 6).map((r, idx) =>
                                h(
                                  "div",
                                  { className: "row", key: idx },
                                  [
                                    h("span", null, `Price: ${r.price}`),
                                    h(
                                      "span",
                                      { className: `pill ${r.result === "win" ? "" : ""}` },
                                      r.result === "win" ? "Win" : "Miss"
                                    ),
                                    h("span", null, r.result === "win" ? `x${r.multiplier.toFixed(2)}` : "—"),
                                  ]
                                )
                              )
                            ),
                      ]
                    ),
                  ]
                ),
              ]
            ),
          ]
        ),

        showModal
          ? h(
              "div",
              {
                className: "modal-backdrop",
                onClick: () => setShowModal(false),
              },
              h(
                "div",
                {
                  className: "modal",
                  onClick: (e) => e.stopPropagation(),
                },
                [
                  h(
                    "button",
                    {
                      className: "close",
                      onClick: () => setShowModal(false),
                      title: "Close",
                    },
                    "✕"
                  ),
                  h("h4", null, "How multipliers are calculated"),
                  h(
                    "ul",
                    null,
                    [
                      h(
                        "li",
                        null,
                        "Expected multiplier: fair odds (1 / p) where p = band width / 1000, then a 15% house edge is applied (× 0.85)."
                      ),
                      h(
                        "li",
                        null,
                        "Live streak multiplier: starts at 1.0, adds 0.35 per correct guess, then applies the same 15% edge."
                      ),
                      h(
                        "li",
                        null,
                        "Payout when correct: current stake × edged streak multiplier. Cashout locks this amount and resets the streak."
                      ),
                      h(
                        "li",
                        null,
                        "Balance: bet is deducted when starting a new run (streak 0), and winnings are credited on cashout."
                      ),
                    ]
                  ),
                ]
              )
            )
          : null,
      ]
    );
  };

  ReactDOM.createRoot(document.getElementById("root")).render(h(App));
})();

