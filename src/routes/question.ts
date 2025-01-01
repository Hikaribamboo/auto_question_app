import { Router } from 'express';
import { generateQuestion } from '../controllers/questionController';

const router = Router();

// GET /question
router.get('/', (req, res) => {
  res.send('This is the Question Route!');
});

// POST /question
router.post('/', generateQuestion);

export default router;
