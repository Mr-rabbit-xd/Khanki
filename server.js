import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pairRoute from './routes/pair.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', pairRoute);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
