// 扫雷核心逻辑（JavaScript 实现浏览器交互）

let rows = 9;
let cols = 9;
let mineCount = 0;
let board = [];
let isGameOver = false;
let revealedCount = 0;
let timerId = null;
let startTime = null;
let flagCount = 0;
let firstClick = true;

function $(id) {
    return document.getElementById(id);
}

function calculateMineCount(r, c) {
    const total = r * c;
    let mines = Math.floor(total * 0.18); // 大约 18% 的格子为雷
    if (mines < 1) mines = 1;
    if (mines > total - 1) mines = total - 1;
    return mines;
}

function initGame() {
    const difficulty = $("difficulty").value;
    if (difficulty === "easy") {
        rows = 5;
        cols = 5;
    } else if (difficulty === "normal") {
        rows = 9;
        cols = 9;
    } else if (difficulty === "hard") {
        rows = 17;
        cols = 17;
    } else {
        const customRows = parseInt($("custom-rows").value, 10) || 1;
        const customCols = parseInt($("custom-cols").value, 10) || 1;
        rows = Math.min(Math.max(customRows, 1), 500);
        cols = Math.min(Math.max(customCols, 1), 500);
    }

    mineCount = calculateMineCount(rows, cols);
    board = [];
    isGameOver = false;
    revealedCount = 0;
    flagCount = 0;
    firstClick = true;
    stopTimer();
    updateTimerText(0);

    $("message").textContent = "";
    $("message").className = "game-message";

    createEmptyBoard();
    renderBoard();
    updateMinesLeft();
}

function createEmptyBoard() {
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({
                isMine: false,
                neighborMines: 0,
                isRevealed: false,
                isFlagged: false,
                element: null,
            });
        }
        board.push(row);
    }
}

function placeMinesSafe(firstRow, firstCol) {
    // 回到“首击必出大空区”的经典规则：
    // 1）第一次点击的位置以及其周围一圈（3x3 区域）都不是雷，
    // 2）这样第一次点击必然是 0，会自动展开出一大片安全区域。
    const total = rows * cols;
    const candidates = [];
    for (let idx = 0; idx < total; idx++) {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        // 距离第一次点击的格子在 1 以内（行列差的绝对值），视为安全区域
        if (Math.abs(r - firstRow) <= 1 && Math.abs(c - firstCol) <= 1) continue;
        candidates.push(idx);
    }

    // 简单洗牌
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const minesToPlace = Math.min(mineCount, candidates.length);
    for (let i = 0; i < minesToPlace; i++) {
        const idx = candidates[i];
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        board[r][c].isMine = true;
    }

    // 计算周围雷数
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c].isMine) continue;
            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                        if (board[nr][nc].isMine) count++;
                    }
                }
            }
            board[r][c].neighborMines = count;
        }
    }
}

function renderBoard() {
    const gameBoard = $("game-board");
    gameBoard.innerHTML = "";
    gameBoard.style.gridTemplateColumns = `repeat(${cols}, 32px)`;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.row = String(r);
            cell.dataset.col = String(c);

            cell.addEventListener("click", onCellLeftClick);
            cell.addEventListener("contextmenu", onCellRightClick);

            board[r][c].element = cell;
            gameBoard.appendChild(cell);
        }
    }
}

function onCellLeftClick(event) {
    if (isGameOver) return;
    const cellElement = event.currentTarget;
    const r = parseInt(cellElement.dataset.row, 10);
    const c = parseInt(cellElement.dataset.col, 10);
    const cell = board[r][c];

    // 如果是已经翻开的数字格子，再次点击时尝试智能开启周围 3x3 区域
    if (cell.isRevealed) {
        handleRevealedNumberClick(r, c);
        return;
    }

    if (cell.isFlagged) return;

    if (firstClick) {
        placeMinesSafe(r, c);
        startTimer();
        firstClick = false;
    }

    revealCell(r, c);
}

function handleRevealedNumberClick(r, c) {
    const cell = board[r][c];
    // 只对已经翻开的数字格子生效（周围有雷的格子）
    if (!cell.isRevealed || cell.neighborMines <= 0 || isGameOver) return;

    let flaggedCount = 0;
    let hasWrongFlag = false;

    // 先统计周围旗子数量，同时检查是否存在“错误旗子”
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const neighbor = board[nr][nc];

            if (neighbor.isFlagged) {
                flaggedCount++;
                if (!neighbor.isMine) {
                    // 玩家把非雷格子标成了雷
                    hasWrongFlag = true;
                }
            }
        }
    }

    // 如果周围存在错误旗子，并且玩家还点击了数字尝试排雷，直接判负并显示所有雷
    if (hasWrongFlag) {
        gameOver(false);
        return;
    }

    // 只有当周围旗子数量刚好等于该数字时，才自动开启剩余的格子
    if (flaggedCount !== cell.neighborMines) {
        return;
    }

    const toOpen = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const neighbor = board[nr][nc];

            if (!neighbor.isRevealed && !neighbor.isFlagged) {
                toOpen.push({ r: nr, c: nc });
            }
        }
    }

    for (const pos of toOpen) {
        revealCell(pos.r, pos.c);
    }
}

function onCellRightClick(event) {
    event.preventDefault();
    if (isGameOver) return;

    const cellElement = event.currentTarget;
    const r = parseInt(cellElement.dataset.row, 10);
    const c = parseInt(cellElement.dataset.col, 10);
    const cell = board[r][c];

    if (cell.isRevealed) return;

    cell.isFlagged = !cell.isFlagged;
    if (cell.isFlagged) {
        // 同时使用文字/emoji 作为兜底显示，避免图片加载失败时什么都看不到
        cell.element.textContent = "🚩";
        cell.element.classList.add("flag");
        flagCount++;
    } else {
        cell.element.textContent = "";
        cell.element.classList.remove("flag");
        flagCount--;
    }
    updateMinesLeft();
}

function revealCell(r, c) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const cell = board[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;
    revealedCount++;
    cell.element.classList.add("revealed");

    if (cell.isMine) {
        cell.element.textContent = "💣";
        cell.element.classList.add("mine", "mine-hit");
        gameOver(false);
        return;
    }

    if (cell.neighborMines > 0) {
        cell.element.textContent = String(cell.neighborMines);
        cell.element.classList.add(`cell-number-${cell.neighborMines}`);
    } else {
        // 空白格，自动展开周围
        floodReveal(r, c);
    }

    checkWin();
}

function floodReveal(r, c) {
    const queue = [];
    queue.push({ r, c });

    const visited = new Set();
    const key = (rr, cc) => `${rr},${cc}`;
    visited.add(key(r, c));

    while (queue.length > 0) {
        const { r: cr, c: cc } = queue.shift();
        const cell = board[cr][cc];

        if (cell.neighborMines > 0) {
            continue;
        }

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = cr + dr;
                const nc = cc + dc;
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                const neighbor = board[nr][nc];
                if (neighbor.isRevealed || neighbor.isFlagged) continue;

                const k = key(nr, nc);
                if (visited.has(k)) continue;
                visited.add(k);

                neighbor.isRevealed = true;
                revealedCount++;
                neighbor.element.classList.add("revealed");
                if (neighbor.isMine) continue;

                if (neighbor.neighborMines > 0) {
                    neighbor.element.textContent = String(neighbor.neighborMines);
                    neighbor.element.classList.add(`cell-number-${neighbor.neighborMines}`);
                } else {
                    queue.push({ r: nr, c: nc });
                }
            }
        }
    }
}

function revealAllMines() {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = board[r][c];
            if (cell.isMine) {
                // 使用地雷图标，同时设置 emoji 文本作为兜底
                cell.element.classList.add("revealed", "mine");
                if (!cell.element.textContent) {
                    cell.element.textContent = "💣";
                }
            } else if (cell.isFlagged) {
                // 被玩家标记为雷，但实际上不是雷：用数字高亮提示这是错误标记
                cell.element.classList.add("revealed", "wrong-flag");
                cell.element.classList.remove("flag");
                cell.element.textContent = cell.neighborMines > 0 ? String(cell.neighborMines) : "0";
                if (cell.neighborMines > 0) {
                    cell.element.classList.add(`cell-number-${cell.neighborMines}`);
                }
            }
        }
    }
}

function checkWin() {
    const totalCells = rows * cols;
    if (revealedCount >= totalCells - mineCount && !isGameOver) {
        gameOver(true);
    }
}

function gameOver(win) {
    isGameOver = true;
    stopTimer();
    if (win) {
        $("message").textContent = "恭喜你，扫雷成功！";
        $("message").classList.add("success");
        playVictorySound();
    } else {
        $("message").textContent = "很遗憾，你踩到了雷，再试一次吧。";
        $("message").classList.add("fail");
        revealAllMines();
    }
}

function startTimer() {
    if (timerId !== null) return;
    startTime = performance.now();
    timerId = window.setInterval(() => {
        const now = performance.now();
        const elapsed = (now - startTime) / 1000;
        updateTimerText(elapsed);
    }, 100);
}

function stopTimer() {
    if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
    }
}

function updateTimerText(seconds) {
    $("timer").textContent = seconds.toFixed(1);
}

function updateMinesLeft() {
    const left = Math.max(mineCount - flagCount, 0);
    $("mines-left").textContent = String(left);
}

function playVictorySound() {
    const audio = $("victory-sound");
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {
        // 浏览器可能因为未交互而禁止自动播放，忽略错误即可
    });
}

function onDifficultyChange() {
    const difficulty = $("difficulty").value;
    const customPanel = $("custom-size-panel");
    if (difficulty === "custom") {
        customPanel.style.display = "flex";
    } else {
        customPanel.style.display = "none";
    }
}

window.addEventListener("DOMContentLoaded", () => {
    $("difficulty").addEventListener("change", onDifficultyChange);
    $("start-btn").addEventListener("click", initGame);
    onDifficultyChange();
    initGame();
});

