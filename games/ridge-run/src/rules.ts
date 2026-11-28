export const routes = [
  { sum: 2, height: 3 }, { sum: 3, height: 4 }, { sum: 4, height: 5 },
  { sum: 5, height: 6 }, { sum: 6, height: 7 }, { sum: 7, height: 8 },
  { sum: 8, height: 7 }, { sum: 9, height: 6 }, { sum: 10, height: 5 },
  { sum: 11, height: 4 }, { sum: 12, height: 3 },
] as const;

export type Route = (typeof routes)[number]['sum'];
export type Progress = Partial<Record<Route, number>>;
export type Move = { route: Route; steps: number };
export const FINISH_SCORE = 7;
export const DICE_COUNT = 3;

export function routeHeight(route: Route) {
  return routes[route - 2].height;
}

export function availableMoves(dice: readonly number[], camp: Progress, climb: Progress): Move[] {
  const moveByRoute = new Map<Route, number>();
  const openRoutes = Object.keys(climb).length;
  for (let left = 0; left < dice.length; left++) {
    for (let right = left + 1; right < dice.length; right++) {
      const route = (dice[left] + dice[right]) as Route;
      const temporary = climb[route] ?? 0;
      if (!temporary && openRoutes >= 2) continue;
      const remaining = routeHeight(route) - (camp[route] ?? 0) - temporary;
      if (remaining <= 0) continue;
      const steps = Math.min(remaining, dice[left] === dice[right] ? 2 : 1);
      moveByRoute.set(route, Math.max(moveByRoute.get(route) ?? 0, steps));
    }
  }
  return [...moveByRoute].map(([route, steps]) => ({ route, steps })).sort((a, b) => a.route - b.route);
}
