// Public surface of the minigames module. Others import only from here.
export { gameCommands } from "./commands";
export { registerGameControls, startGames, stopGames } from "./service";
export { registerWordGames, stopWordGames } from "./word-games";
