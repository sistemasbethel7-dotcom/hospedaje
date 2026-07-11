import 'dotenv/config';
import { createApp } from './src/app.js';

const app = createApp();
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API escuchando en el puerto ${port}`);
});
