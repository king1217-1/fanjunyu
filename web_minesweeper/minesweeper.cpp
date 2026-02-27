#include <iostream>
#include <vector>
#include <random>
#include <chrono>
#include <algorithm>

struct Cell {
    bool isMine = false;
    bool isRevealed = false;
    bool isFlagged = false;
    int neighborMines = 0;
};

int rowsCount = 0;
int colsCount = 0;
int mineCount = 0;
std::vector<Cell> grid;
bool firstMove = true;
bool gameOverFlag = false;
bool winFlag = false;
int revealedSafeCells = 0;

int indexOf(int r, int c) {
    return r * colsCount + c;
}

bool inBounds(int r, int c) {
    return r >= 0 && r < rowsCount && c >= 0 && c < colsCount;
}

int calculateMineCount(int r, int c) {
    int total = r * c;
    int mines = static_cast<int>(total * 0.18); // 约 18% 为雷
    if (mines < 1) mines = 1;
    if (mines > total - 1) mines = total - 1;
    return mines;
}

void chooseDifficulty() {
    std::cout << "请选择难度：" << std::endl;
    std::cout << "1. 简单（5 x 5）" << std::endl;
    std::cout << "2. 普通（9 x 9）" << std::endl;
    std::cout << "3. 困难（17 x 17）" << std::endl;
    std::cout << "4. 自定义（最大 500 x 500）" << std::endl;
    int choice = 0;
    std::cin >> choice;

    if (choice == 1) {
        rowsCount = 5;
        colsCount = 5;
    } else if (choice == 2) {
        rowsCount = 9;
        colsCount = 9;
    } else if (choice == 3) {
        rowsCount = 17;
        colsCount = 17;
    } else {
        std::cout << "请输入自定义行数 (1 - 500)：";
        std::cin >> rowsCount;
        std::cout << "请输入自定义列数 (1 - 500)：";
        std::cin >> colsCount;
        if (rowsCount < 1) rowsCount = 1;
        if (rowsCount > 500) rowsCount = 500;
        if (colsCount < 1) colsCount = 1;
        if (colsCount > 500) colsCount = 500;
    }

    mineCount = calculateMineCount(rowsCount, colsCount);
}

void resetBoard() {
    grid.assign(rowsCount * colsCount, Cell{});
    firstMove = true;
    gameOverFlag = false;
    winFlag = false;
    revealedSafeCells = 0;
}

void placeMinesSafe(int safeR, int safeC) {
    int total = rowsCount * colsCount;
    std::vector<int> candidates;
    candidates.reserve(total - 1);
    int safeIndex = indexOf(safeR, safeC);
    for (int i = 0; i < total; ++i) {
        if (i == safeIndex) continue;
        candidates.push_back(i);
    }

    std::random_device rd;
    std::mt19937 gen(rd());
    std::shuffle(candidates.begin(), candidates.end(), gen);

    int minesToPlace = std::min(mineCount, (int)candidates.size());
    for (int i = 0; i < minesToPlace; ++i) {
        int idx = candidates[i];
        grid[idx].isMine = true;
    }

    // 计算周围雷数
    for (int r = 0; r < rowsCount; ++r) {
        for (int c = 0; c < colsCount; ++c) {
            int idx = indexOf(r, c);
            if (grid[idx].isMine) continue;
            int count = 0;
            for (int dr = -1; dr <= 1; ++dr) {
                for (int dc = -1; dc <= 1; ++dc) {
                    if (dr == 0 && dc == 0) continue;
                    int nr = r + dr;
                    int nc = c + dc;
                    if (inBounds(nr, nc)) {
                        if (grid[indexOf(nr, nc)].isMine) ++count;
                    }
                }
            }
            grid[idx].neighborMines = count;
        }
    }
}

void printBoard(bool revealAll = false) {
    std::cout << "   ";
    for (int c = 0; c < colsCount; ++c) {
        if (c < 10) std::cout << c << " ";
        else std::cout << c % 10 << " ";
    }
    std::cout << std::endl;

    for (int r = 0; r < rowsCount; ++r) {
        if (r < 10) std::cout << " " << r << " ";
        else std::cout << r % 10 << " ";
        for (int c = 0; c < colsCount; ++c) {
            int idx = indexOf(r, c);
            const Cell &cell = grid[idx];
            char ch = '#';
            if (revealAll || cell.isRevealed) {
                if (cell.isMine) {
                    ch = '*';
                } else if (cell.neighborMines > 0) {
                    ch = '0' + cell.neighborMines;
                } else {
                    ch = ' ';
                }
            } else if (cell.isFlagged) {
                ch = 'F';
            }
            std::cout << ch << " ";
        }
        std::cout << std::endl;
    }
}

void floodReveal(int startR, int startC) {
    std::vector<std::pair<int, int>> queue;
    std::vector<bool> visited(rowsCount * colsCount, false);
    queue.emplace_back(startR, startC);
    visited[indexOf(startR, startC)] = true;

    while (!queue.empty()) {
        auto [r, c] = queue.back();
        queue.pop_back();
        int idx = indexOf(r, c);
        Cell &cell = grid[idx];
        if (cell.isRevealed || cell.isFlagged) continue;

        cell.isRevealed = true;
        if (!cell.isMine) {
            ++revealedSafeCells;
        }

        if (cell.neighborMines > 0) {
            continue;
        }

        for (int dr = -1; dr <= 1; ++dr) {
            for (int dc = -1; dc <= 1; ++dc) {
                int nr = r + dr;
                int nc = c + dc;
                if (!inBounds(nr, nc)) continue;
                int nIdx = indexOf(nr, nc);
                if (visited[nIdx]) continue;
                visited[nIdx] = true;
                if (!grid[nIdx].isMine) {
                    queue.emplace_back(nr, nc);
                }
            }
        }
    }
}

void checkWin() {
    int safeCells = rowsCount * colsCount - mineCount;
    if (revealedSafeCells >= safeCells) {
        winFlag = true;
        gameOverFlag = true;
    }
}

void revealCell(int r, int c) {
    if (!inBounds(r, c)) return;
    int idx = indexOf(r, c);
    Cell &cell = grid[idx];
    if (cell.isFlagged || cell.isRevealed) return;

    if (cell.isMine) {
        cell.isRevealed = true;
        gameOverFlag = true;
        winFlag = false;
        return;
    }

    if (cell.neighborMines > 0) {
        cell.isRevealed = true;
        ++revealedSafeCells;
    } else {
        floodReveal(r, c);
    }

    checkWin();
}

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    chooseDifficulty();
    resetBoard();

    std::cout << "雷区大小：" << rowsCount << " 行 x " << colsCount << " 列，雷数约为 " << mineCount << " 个。\n";
    std::cout << "输入格式：行 列 操作（o = 打开，f = 标记/取消标记），例如： 3 4 o\n";

    int r, c;
    char op;

    auto startTime = std::chrono::steady_clock::now();

    while (!gameOverFlag) {
        printBoard(false);
        std::cout << "请输入操作（行 列 操作）：";
        if (!(std::cin >> r >> c >> op)) {
            std::cout << "输入结束或格式错误，游戏退出。\n";
            return 0;
        }

        if (!inBounds(r, c)) {
            std::cout << "坐标越界，请重新输入。\n";
            continue;
        }

        int idx = indexOf(r, c);
        Cell &cell = grid[idx];

        if (firstMove) {
            placeMinesSafe(r, c);
            firstMove = false;
            startTime = std::chrono::steady_clock::now();
        }

        if (op == 'f' || op == 'F') {
            if (cell.isRevealed) {
                std::cout << "该格已经被打开，不能标记。\n";
                continue;
            }
            cell.isFlagged = !cell.isFlagged;
        } else if (op == 'o' || op == 'O') {
            if (cell.isFlagged) {
                std::cout << "该格已被标记为雷，如需打开请先取消标记。\n";
                continue;
            }
            revealCell(r, c);
        } else {
            std::cout << "未知操作，请使用 o（打开）或 f（标记）。\n";
            continue;
        }
    }

    auto endTime = std::chrono::steady_clock::now();
    std::chrono::duration<double> elapsed = endTime - startTime;

    std::cout << "\n===== 游戏结束 =====\n";
    printBoard(true);

    if (winFlag) {
        std::cout << "恭喜你，扫雷成功！\n";
        std::cout << "用时：" << elapsed.count() << " 秒。\n";
    } else {
        std::cout << "很遗憾，你踩到了雷。\n";
    }

    return 0;
}

