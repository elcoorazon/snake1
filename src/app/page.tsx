'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Direction = 'up' | 'right' | 'down' | 'left';

type Point = {
  x: number;
  y: number;
};

const GRID_SIZE = 24;
const BASE_TICK_MS = 150;
const MIN_TICK_MS = 80;
const SPEEDUP_EVERY_POINTS = 5;
const SPEEDUP_STEP_MS = 8;
const DESKTOP_BOARD_SIZE = 600;
const BEST_SCORE_KEY = 'snake-best-score';

const DIRECTION_VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const LEFT_TURN: Record<Direction, Direction> = {
  up: 'left',
  left: 'down',
  down: 'right',
  right: 'up',
};

const RIGHT_TURN: Record<Direction, Direction> = {
  up: 'right',
  right: 'down',
  down: 'left',
  left: 'up',
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

function createInitialSnake(): Point[] {
  const center = Math.floor(GRID_SIZE / 2);
  return [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
}

function spawnFood(snake: Point[]): Point {
  const occupied = new Set(snake.map(pointKey));
  const emptyCells: Point[] = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = { x, y };
      if (!occupied.has(pointKey(cell))) {
        emptyCells.push(cell);
      }
    }
  }

  if (emptyCells.length === 0) {
    return snake[0];
  }

  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

function getNextTick(score: number): number {
  const level = Math.floor(score / SPEEDUP_EVERY_POINTS);
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - level * SPEEDUP_STEP_MS);
}

function resolveDirectionInput(
  key: string,
  currentDirection: Direction,
): Direction | null {
  switch (key.toLowerCase()) {
    case 'arrowup':
      return 'up';
    case 'arrowright':
      return 'right';
    case 'arrowdown':
      return 'down';
    case 'arrowleft':
      return 'left';
    case 'w':
      return currentDirection;
    case 'a':
      return LEFT_TURN[currentDirection];
    case 'd':
      return RIGHT_TURN[currentDirection];
    default:
      return null;
  }
}

function stepGame(
  snake: Point[],
  direction: Direction,
  food: Point,
): {
  nextSnake: Point[];
  nextFood: Point;
  ateFood: boolean;
  isGameOver: boolean;
} {
  const head = snake[0];
  const delta = DIRECTION_VECTORS[direction];
  const newHead = { x: head.x + delta.x, y: head.y + delta.y };

  const hitsWall =
    newHead.x < 0 ||
    newHead.y < 0 ||
    newHead.x >= GRID_SIZE ||
    newHead.y >= GRID_SIZE;

  if (hitsWall) {
    return {
      nextSnake: snake,
      nextFood: food,
      ateFood: false,
      isGameOver: true,
    };
  }

  const ateFood = newHead.x === food.x && newHead.y === food.y;
  const bodyToCheck = ateFood ? snake : snake.slice(0, -1);

  if (bodyToCheck.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
    return {
      nextSnake: snake,
      nextFood: food,
      ateFood: false,
      isGameOver: true,
    };
  }

  const nextSnake = [newHead, ...snake];
  if (!ateFood) {
    nextSnake.pop();
  }

  return {
    nextSnake,
    nextFood: ateFood ? spawnFood(nextSnake) : food,
    ateFood,
    isGameOver: false,
  };
}

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [snake, setSnake] = useState<Point[]>(() => createInitialSnake());
  const [direction, setDirection] = useState<Direction>('right');
  const [food, setFood] = useState<Point>(() => spawnFood(createInitialSnake()));
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  const directionRef = useRef<Direction>('right');
  const pendingDirectionRef = useRef<Direction | null>(null);

  const tickMs = useMemo(() => getNextTick(score), [score]);

  const resetGame = useCallback(() => {
    const initialSnake = createInitialSnake();
    setSnake(initialSnake);
    setDirection('right');
    directionRef.current = 'right';
    pendingDirectionRef.current = null;
    setFood(spawnFood(initialSnake));
    setScore(0);
    setIsPaused(false);
    setIsGameOver(false);
  }, []);

  const applyInputDirection = useCallback(
    (requestedDirection: Direction) => {
      const activeDirection = pendingDirectionRef.current ?? directionRef.current;
      if (requestedDirection === OPPOSITE_DIRECTION[activeDirection]) {
        return;
      }
      pendingDirectionRef.current = requestedDirection;
    },
    [],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BEST_SCORE_KEY);
      if (stored) {
        const parsed = Number.parseInt(stored, 10);
        if (!Number.isNaN(parsed)) {
          setBestScore(parsed);
        }
      }
    } catch {
      // localStorage can be unavailable in private contexts.
    }
  }, []);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      try {
        window.localStorage.setItem(BEST_SCORE_KEY, String(score));
      } catch {
        // Ignore storage failures.
      }
    }
  }, [score, bestScore]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        if (!isStarted || isGameOver) {
          return;
        }
        setIsPaused((prev) => !prev);
        return;
      }

      const mapped = resolveDirectionInput(event.key, directionRef.current);
      if (!mapped) {
        return;
      }

      event.preventDefault();
      if (!isStarted || isPaused || isGameOver) {
        return;
      }

      applyInputDirection(mapped);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyInputDirection, isGameOver, isPaused, isStarted]);

  useEffect(() => {
    if (!isStarted || isPaused || isGameOver) {
      return;
    }

    const timer = window.setTimeout(() => {
      const activeDirection = pendingDirectionRef.current ?? directionRef.current;
      pendingDirectionRef.current = null;
      directionRef.current = activeDirection;
      setDirection(activeDirection);

      const result = stepGame(snake, activeDirection, food);
      setSnake(result.nextSnake);
      setFood(result.nextFood);

      if (result.ateFood) {
        setScore((prev) => prev + 1);
      }

      if (result.isGameOver) {
        setIsGameOver(true);
        setIsPaused(false);
      }
    }, tickMs);

    return () => window.clearTimeout(timer);
  }, [food, isGameOver, isPaused, isStarted, snake, tickMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    const logicalSize = DESKTOP_BOARD_SIZE;
    canvas.width = Math.floor(logicalSize * pixelRatio);
    canvas.height = Math.floor(logicalSize * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, logicalSize, logicalSize);

    const cellSize = logicalSize / GRID_SIZE;

    context.fillStyle = '#020617';
    context.fillRect(0, 0, logicalSize, logicalSize);

    context.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    context.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i += 1) {
      const offset = i * cellSize;
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset, logicalSize);
      context.stroke();

      context.beginPath();
      context.moveTo(0, offset);
      context.lineTo(logicalSize, offset);
      context.stroke();
    }

    context.fillStyle = '#f43f5e';
    context.fillRect(food.x * cellSize + 2, food.y * cellSize + 2, cellSize - 4, cellSize - 4);

    snake.forEach((segment, index) => {
      context.fillStyle = index === 0 ? '#22c55e' : '#4ade80';
      context.fillRect(
        segment.x * cellSize + 1,
        segment.y * cellSize + 1,
        cellSize - 2,
        cellSize - 2,
      );
    });
  }, [food, snake]);

  const statusLabel = isGameOver
    ? 'Game Over'
    : isStarted
      ? isPaused
        ? 'Пауза'
        : 'Игра идёт'
      : 'Не начато';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-6 p-4 md:p-8">
      <h1 className="text-3xl font-bold tracking-tight">Snake</h1>

      <section className="grid w-full gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-[1fr_auto] md:items-start">
        <div className="space-y-3 text-sm md:text-base">
          <p>
            <span className="font-semibold">Статус:</span> {statusLabel}
          </p>
          <p>
            <span className="font-semibold">Счёт:</span> {score}
          </p>
          <p>
            <span className="font-semibold">Лучший результат:</span> {bestScore}
          </p>
          <p>
            <span className="font-semibold">Скорость:</span> {tickMs} мс / шаг
          </p>

          <div className="pt-2 text-slate-300">
            <p className="font-semibold text-slate-100">Управление:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <kbd>W</kbd> — вперёд относительно текущего направления.
              </li>
              <li>
                <kbd>A</kbd> / <kbd>D</kbd> — поворот влево / вправо.
              </li>
              <li>Стрелки — классическое управление.</li>
              <li>
                <kbd>Space</kbd> — пауза / продолжить.
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:flex-col">
          <button
            type="button"
            className="rounded-md bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400"
            onClick={() => {
              if (!isStarted) {
                resetGame();
              }
              setIsStarted(true);
              setIsPaused(false);
              setIsGameOver(false);
            }}
          >
            Start
          </button>
          <button
            type="button"
            className="rounded-md bg-amber-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isStarted || isGameOver}
            onClick={() => setIsPaused((prev) => !prev)}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            className="rounded-md bg-rose-500 px-4 py-2 font-semibold text-white transition hover:bg-rose-400"
            onClick={() => {
              resetGame();
              setIsStarted(true);
            }}
          >
            Restart
          </button>
        </div>
      </section>

      <section className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 md:p-4">
        <div className="mx-auto aspect-square w-full max-w-[600px]">
          <canvas
            ref={canvasRef}
            className="h-full w-full rounded-lg border border-slate-700 bg-slate-950"
            aria-label="Snake game board"
          />
        </div>
      </section>
    </main>
  );
}
