import "@fontsource/poppins/400.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "@fontsource/poppins/900.css";
import "./ui/styles.css";
import { Game } from "./game/Game";
import { UI } from "./ui/ui";

const game = new Game(document.getElementById("scene") as HTMLCanvasElement);
const ui = new UI(game);

// Android hardware back button: pause the ride or go back to home
document.addEventListener("backbutton", () => (game.running ? ui.pause() : ui.home()));
(window as unknown as { __game: Game }).__game = game;
