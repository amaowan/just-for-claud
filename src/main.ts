import { getGameData } from './gameData.ts';
import { mountApp } from './ui/app.ts';
import './ui/style.css';

const root = document.querySelector<HTMLDivElement>('#app');
if (root) mountApp(root, getGameData());
