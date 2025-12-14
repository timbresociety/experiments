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

  /*
     Shared Layout Constants
     GRAPH_PADDING: Reverted for Vertical Overlay (Top 20px)
  */
  const GRAPH_PADDING = { top: 20, right: 60, bottom: 70, left: 30 }; // Increased bottom padding to 70
  const GRAPH_WIDTH = 560;
  const GRAPH_HEIGHT = 300;

  const LineGraph = ({ data }) => {
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
            // Gradients definitions...
            h("linearGradient", { id: "areaGradient", x1: "0%", y1: "0%", x2: "0%", y2: "100%" }, [
              h("stop", { offset: "0%", stopColor: "rgba(236, 72, 153, 0.2)" }),
              h("stop", { offset: "100%", stopColor: "rgba(236, 72, 153, 0)" })
            ]),
            h("filter", { id: "glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, [
              h("feGaussianBlur", { stdDeviation: "3", result: "coloredBlur" }),
              h("feMerge", { key: "m" }, [
                h("feMergeNode", { in: "coloredBlur" }),
                h("feMergeNode", { in: "SourceGraphic" })
              ])
            ])
          ]),

          // Render Grid First (Behind)
          ...gridYLines,
          ...gridXLines,

          // Area Fill
          h("polyline", {
            key: "area",
            points: `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`,
            fill: "url(#areaGradient)",
            stroke: "none",
          }),

          // Main Line
          h("polyline", {
            key: "line",
            points,
            fill: "none",
            stroke: "#ec4899",
            strokeWidth: "3",
            strokeLinejoin: "round",
            strokeLinecap: "round",
            style: { filter: "url(#glow)" }
          }),

          // Data Points
          points.split(" ").map((p, idx) => {
            const [x, y] = p.split(",").map(Number);
            const isLast = idx === data.length - 1;
            return h("circle", {
              key: `pt-${idx}`,
              cx: x, cy: y,
              r: isLast ? 6 : 3,
              fill: isLast ? "#ffffff" : "#ec4899",
              stroke: isLast ? "#3b82f6" : "none",
              strokeWidth: isLast ? "3" : "0",
              style: isLast ? { filter: "url(#glow)", animation: "pulse-dot 2s infinite" } : {},
            });
          }),

          ...priceLabels,
          ...tickLabels,
        ]
      )
    ]);
  };

  const RangeOverlay = ({ low, high, onChange }) => {
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

    const handleMouseMove = (e) => {
      if (!dragging.current || !overlayRef.current) return;

      const rect = overlayRef.current.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;

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
      // range 0 to TICKS
      const tick = clamp(Math.round((1 - ratio) * TICKS), 0, TICKS); // Allow 0

      let newLow = validLow;
      let newHigh = validHigh;

      if (dragging.current === "band") {
        const deltaY = e.clientY - dragStartY.current;
        if (Math.abs(deltaY) < 2) return;

        // Delta tick based on percentage of movement
        const deltaRatio = deltaY / graphAreaHeight;
        const deltaTick = Math.round(deltaRatio * TICKS);
        const span = dragStartHigh.current - dragStartLow.current;

        newLow = dragStartLow.current - deltaTick;
        newHigh = newLow + span;

        const validSpan = Math.max(1, Math.min(span, TICKS)); // Span can be TICKS (0-1000)
        const maxLow = TICKS - validSpan;

        newLow = clamp(newLow, 0, maxLow); // Allow 0
        newHigh = newLow + validSpan;

      } else if (dragging.current === "low") {
        const maxLow = Math.min(validHigh - 1, TICKS - 1);
        const constrainedTick = Math.max(0, Math.min(tick, maxLow)); // Allow 0
        newLow = constrainedTick;
        newHigh = Math.max(constrainedTick + 1, Math.min(validHigh, TICKS));

      } else if (dragging.current === "high") {
        const minHigh = Math.max(validLow + 1, 1); // High must be > low (>=0) so >=1
        const constrainedTick = Math.max(minHigh, Math.min(tick, TICKS));
        newHigh = constrainedTick;
        newLow = Math.max(0, Math.min(validLow, constrainedTick - 1)); // Allow 0
      }

      if (newHigh - newLow > 800) {
        if (dragging.current === "low") {
          newLow = newHigh - 800; // Recalc low if high is fixed? No, logic above is fine
          // Re-enforce limit logic here if needed or separate
          // Let's stick to the existing snippet logic structure but fixed constraints
          // Actually the snippet above had this block:
        }
      }

      // Re-apply max range check simply
      if (newHigh - newLow > 800) {
        if (dragging.current === 'low') {
          // If moving low down expanded range > 800, cap low? 
          // Logic is tricky. Let's simplify:
          // Just pass the calculated values?
          // The original code caped it.
        }
        if (dragging.current === "low") {
          // We pulled low down too far
          newHigh = newLow + 800; // Move high down? Or limit low?
          // Typically range resize limits the HANDLE you are dragging.
          // But original code:
          // if (dragging.current === "low") newLow = newHigh - 800;
          // Wait, if I drag LOW down, newLow decreases. Range increases. 
          // If range > 800, set newLow to high - 800. Correct.
          newLow = newHigh - 800;
        } else {
          // Dragging high up
          newHigh = newLow + 800;
        }
      }

      onChange({ low: newLow, high: newHigh });
    };

    const handleMouseUp = () => {
      dragging.current = null;
      if (bandRef.current) bandRef.current.style.opacity = "1";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    const handleBandMouseDown = (e) => {
      if (e.target.classList.contains("range-handle") || e.target.closest(".range-handle")) {
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
          onMouseDown: handleBandMouseDown,
        }),
        h("div", {
          key: "handle-low",
          className: "range-handle range-handle-low",
          style: {
            top: `calc(${finalBottom}% - 6px)`,
            left: paddingLeftPctStr,
            right: paddingRightPctStr,
          },
          onMouseDown: handleHandleMouseDown("low"),
        }),
        h("div", {
          key: "handle-high",
          className: "range-handle range-handle-high",
          style: {
            top: `calc(${finalTop}% - 6px)`,
            left: paddingLeftPctStr,
            right: paddingRightPctStr,
          },
          onMouseDown: handleHandleMouseDown("high"),
        }),
      ]
    );
  };



  /* 
     DEFI PREDICTION GAME
     App Component - Implements Swap Interface & Range Logic
  */
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

    const [range, setRange] = useState({ low: 420, high: 620 });
    const [status, setStatus] = useState("idle");
    const [lastResult, setLastResult] = useState(null);

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

    // Multiplier Logic (85% RTP)
    const multiplier = useMemo(() => {
      const size = Math.max(1, range.high - range.low);
      const probability = size / TICKS;
      if (probability <= 0) return 0;
      return Number((0.85 / probability).toFixed(2));
    }, [range]);

    const potentialPayout = useMemo(() => {
      const activeBet = status === 'won_streak' ? currentBet : baseBet;
      return Number((activeBet * multiplier).toFixed(2));
    }, [currentBet, baseBet, multiplier, status]);

    // Sync payoutInput when not editing
    useEffect(() => {
      if (!isPayoutFocused) {
        setPayoutInput(potentialPayout);
      }
    }, [potentialPayout, isPayoutFocused]);

    // Interaction Handlers
    const handleRangeChange = (newRange) => {
      // UPDATED: Allow 0 logic
      let { low, high } = newRange;
      low = Math.max(0, Math.min(low, TICKS - 1)); // Allow 0
      high = Math.max(low + 1, Math.min(high, TICKS));
      setRange({ low, high });
    };

    // Reverse Calculation for Payout Input
    const handlePayoutChange = (val) => {
      const targetPayout = Number(val);
      const activeBet = status === 'won_streak' ? currentBet : baseBet;

      if (!targetPayout || targetPayout <= 0 || activeBet <= 0) return;

      // Formula: Payout = Bet * (0.85 / Probability)
      // Multiplier = Payout / Bet
      const targetMultiplier = targetPayout / activeBet;

      // Multiplier = 0.85 / (Size / 1000) = 850 / Size
      // Size = 850 / Multiplier
      let newSize = Math.round(850 / targetMultiplier);

      let warning = null;

      // Constraints with Feedback
      if (newSize < 10) {
        newSize = 10;
        warning = "Max Payout Limit (85x)";
      } else if (newSize > 800) {
        newSize = 800;
        warning = "Min Payout Limit (Start with 80% range)";
      }

      setPayoutError(warning);

      // Center the new size on current center
      const currentCenter = Math.round((range.low + range.high) / 2);
      let newLow = Math.round(currentCenter - (newSize / 2));
      let newHigh = newLow + newSize;

      // Boundary Checks
      if (newLow < 1) {
        newLow = 1;
        newHigh = newLow + newSize;
      }
      if (newHigh > TICKS) {
        newHigh = TICKS;
        newLow = newHigh - newSize;
      }

      setRange({ low: newLow, high: newHigh });
    };

    // Game Logic
    // Defined BEFORE playRound to avoid any const hoisting/TDZ issues
    const finalizeRound = (betAmount) => {
      const finalPrice = randomPrice();

      setHistory(prev => {
        const shift = prev.slice(1);
        return [...shift, finalPrice];
      });

      const won = finalPrice >= range.low && finalPrice <= range.high;
      // Note: betAmount is the snapshot of what was risked

      if (won) {
        const winAmount = Number((betAmount * multiplier).toFixed(2));
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

        setCurrentBet(baseBet);
        setStatus('idle');
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
        setBalance(b => b - activeBet);
        setCurrentBet(activeBet);
        setSessionPnL(p => p - activeBet);
      }

      setPayError(null);
      setPayoutError(null);
      setStatus('playing');
      setAnimClass("");

      setTimeout(() => { finalizeRound(activeBet); }, 600);
    };

    const handleCashout = () => {
      setBalance(b => b + currentBet);
      setSessionPnL(p => p + currentBet); // Add winnings to PnL

      // Log WIN (EndOfSession - Cashout)
      setUserBets(prev => [...prev, {
        result: 'win',
        price: lastResult ? lastResult.price : 0, // Price of the LAST tick that allowed cashout
        amount: baseBet, // Initial Investment
        payout: currentBet, // Final Realized Value
        range: { ...range }
      }]);

      setStatus('idle');
      setCurrentBet(baseBet);
    };


    return h("div", { className: "shell" }, [
      // Header
      h("div", { className: "header", key: "header" }, [
        h("div", { style: { display: "flex", alignItems: "center" } }, [
          h("img", { src: "logo.svg", className: "app-logo", alt: "TickPredict" }),
          h("div", { className: "title", key: "t" }, "TickPredict"),
          // Navigation Tabs
          h("div", { className: "nav-tabs" }, [
            h("div", {
              className: `nav-item ${view === 'game' ? 'active' : ''}`,
              onClick: () => setView('game')
            }, "Trade"),
            h("div", {
              className: `nav-item ${view === 'stats' ? 'active' : ''}`,
              onClick: () => setView('stats')
            }, "Stats")
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
          // History Tape
          h(HistoryTape, { history, key: "tape" }),

          // Main Grid
          h("div", { className: "grid", key: "g" }, [

            // Left Column: Graph
            h("div", { className: `card ${animClass}`, key: "gc" }, [ // Apply animation here
              h("div", { className: "graph-header", key: "gh" }, [
                h("span", { key: "l1", style: { fontSize: "13px", color: "#98a1c0" } },
                  "Guess the next price • Shorter range = Higher win"
                ),
                h("span", { key: "l2", className: "chip", style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
                  lastResult ? "Result:" : "Last:",
                  h("span", { style: { fontWeight: 700, color: "#fff" } }, lastResult ? lastResult.price : lastPrice),
                  h("img", { src: "usdc.png", className: "mini-logo" }),
                ])
              ]),
              h("div", { className: "graph-shell", key: "gs" }, [
                h("div", { className: "graph", key: "g-inner" }, h(LineGraph, { data: history })),
                h(RangeOverlay, {
                  key: "overlay",
                  low: range.low,
                  high: range.high,
                  onChange: handleRangeChange
                })
              ])
            ]),

            // Right Column: Swap Interface
            h("div", { className: "defi-card", key: "dc" }, [
              // "You Pay" Section
              h("div", { className: `swap-input-container ${payError ? 'input-error' : ''}`, key: "pay" }, [
                h("div", { className: "swap-label-row" }, [
                  h("span", {}, status === 'won_streak' ? "Accumulated Bet" : "You pay"),
                  h("span", { className: "balance-label" }, `Balance: ${formatCurrency(balance)} USDC`)
                ]),
                h("div", { className: "swap-input-row" }, [
                  h("input", {
                    className: "token-input",
                    type: "number",
                    placeholder: "0",
                    value: status === 'won_streak' ? currentBet : (baseBet === 0 ? '' : baseBet),
                    onFocus: e => e.target.select(),
                    onChange: e => {
                      if (status === 'idle') {
                        const valStr = e.target.value;
                        const val = Number(valStr);
                        setBaseBet(val);

                        // MECE Validation
                        if (val < 0) setPayError("Values cannot be negative");
                        else if (val === 0 || valStr === '') setPayError(null);
                        else if (val > balance) setPayError("Insufficient balance");
                        else setPayError(null);
                      }
                    },
                    disabled: status !== 'idle'
                  }),
                  h("span", { className: "token-pill" }, [
                    h("img", { src: "usdc.png", className: "currency-logo" }),
                    "USDC"
                  ])
                ])
              ]),
              payError && h("div", { style: { color: "#fd4f4f", fontSize: "12px", marginTop: "4px", paddingLeft: "4px" } }, payError),

              // Arrow
              h("div", { className: "swap-arrow-container", key: "arrow" },
                h("div", { className: "swap-arrow" }, "↓")
              ),

              // "You Receive" Section
              h("div", { className: `swap-input-container ${payoutError ? 'input-error' : ''}`, key: "rec" }, [
                h("div", { className: "swap-label-row" }, [
                  h("span", {}, "You receive (Potential)"),
                  h("span", { className: "balance-label" }, `${multiplier}x Payout`)
                ]),
                h("div", { className: "swap-input-row" }, [
                  h("input", {
                    className: "token-input",
                    type: "number",
                    // Edit enabled for reverse calculation
                    value: isPayoutFocused ? payoutInput : potentialPayout,
                    onFocus: e => {
                      setIsPayoutFocused(true);
                      setPayoutInput(potentialPayout);
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
                h("div", { className: "info-row" }, [
                  h("span", {}, "Selected Range"),
                  h("span", {}, `${range.low} - ${range.high}`) // Display 0-based index
                ]),
                h("div", { className: "info-row" }, [
                  h("span", {}, "Win Probability"),
                  h("span", {}, `${((range.high - range.low) / 10).toFixed(1)}%`)
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
